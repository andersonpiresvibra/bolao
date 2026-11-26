import crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LOTTERY_CONFIGS, type LotteryStatsResponse } from '../src/utils/lotteryMath.ts';
import {
  isAsaasConfigured,
  getAsaasEnvironment,
  ensureAsaasCustomer,
  createAsaasPixPayment,
} from './asaasClient.ts';
import type {
  AuditLog,
  Company,
  DatabaseState,
  EffectiveGame,
  FavoriteGame,
  LotteryGame,
  LotteryType,
  Participant,
  PlatformSettings,
  PlayerSuggestion,
  Pool,
  QuotaPurchase,
  SystemUser,
} from '../src/types.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(String(value).trim()));
}

function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  return { url, serviceRoleKey, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, serviceRoleKey } = getSupabaseEnv();
  return Boolean(url && serviceRoleKey);
}

let cachedAdminClient: SupabaseClient | null = null;
let cachedAuthClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados.');
  }
  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedAdminClient;
}

function getSupabaseAuthClient(): SupabaseClient {
  if (cachedAuthClient) return cachedAuthClient;
  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  cachedAuthClient = createClient(url, anonKey || serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedAuthClient;
}

function createHash(payload: string): string {
  return (
    'SHA256:' +
    crypto
      .createHash('sha256')
      .update(payload + Date.now().toString())
      .digest('hex')
      .slice(0, 38)
  );
}

function computeInitials(name: string, fallback = 'US'): string {
  const words = String(name || '')
    .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  const clean = String(name || '').replace(/[^a-zA-ZÀ-ÿ]/g, '');
  return clean.length >= 2 ? clean.slice(0, 2).toUpperCase() : fallback;
}

function sanitizeDigits(val?: string | null): string {
  return String(val || '').replace(/\D/g, '');
}

const ALLOWED_IMAGE_MIMES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export async function uploadLogoIfDataUrl(params: {
  logoUrl?: string;
  ownerUserId: string;
  poolId?: string | null;
}): Promise<{ publicUrl?: string; storagePath?: string }> {
  const raw = String(params.logoUrl || '').trim();
  if (!raw) return {};

  // Already a normal URL (never store raw base64 in the database)
  if (!raw.startsWith('data:')) {
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
      return { publicUrl: raw };
    }
    return {};
  }

  const match = raw.match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error('Formato de logotipo inválido. Use PNG, JPG, WEBP ou SVG.');
  }

  const mimeType = match[1].toLowerCase();
  const ext = ALLOWED_IMAGE_MIMES[mimeType];
  const base64Data = match[2].replace(/\s/g, '');
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    throw new Error('O logotipo deve ter entre 1 byte e 5 MB.');
  }

  const sb = getSupabaseAdmin();
  const safePoolPart = params.poolId && isUuid(params.poolId) ? params.poolId : 'logo';
  const storagePath = `${params.ownerUserId}/${safePoolPart}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await sb.storage
    .from('pool-logos')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Falha ao enviar logotipo para o Storage: ${uploadErr.message}`);
  }

  const { data: pub } = sb.storage.from('pool-logos').getPublicUrl(storagePath);
  const publicUrl = pub.publicUrl;

  await sb.from('pool_logo_assets').insert({
    owner_user_id: params.ownerUserId,
    pool_id: params.poolId && isUuid(params.poolId) ? params.poolId : null,
    asset_kind: 'LOGO',
    storage_bucket: 'pool-logos',
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: mimeType,
    file_size_bytes: buffer.length,
    is_active: true,
  });

  return { publicUrl, storagePath };
}

export async function fetchFullDatabaseState(): Promise<DatabaseState> {
  const sb = getSupabaseAdmin();

  const [
    settingsRes,
    profilesRes,
    favNumsRes,
    favGamesRes,
    effGamesRes,
    companiesRes,
    poolsRes,
    brandingRes,
    participantsRes,
    purchasesRes,
    gamesRes,
    suggestionsRes,
    auditRes,
  ] = await Promise.all([
    sb.from('platform_settings').select('*').eq('id', true).maybeSingle(),
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('user_favorite_numbers').select('*'),
    sb.from('user_favorite_games').select('*').order('created_at', { ascending: false }),
    sb.from('user_effective_games').select('*').order('created_at', { ascending: false }),
    sb.from('companies').select('*').order('created_at', { ascending: false }),
    sb.from('pools').select('*').order('created_at', { ascending: false }),
    sb.from('pool_branding_layouts').select('*'),
    sb.from('pool_participants').select('*').order('created_at', { ascending: false }),
    sb.from('quota_purchases').select('*').order('created_at', { ascending: false }),
    sb.from('pool_games').select('*').order('registered_at', { ascending: false }),
    sb.from('pool_suggestions').select('*').order('created_at', { ascending: false }),
    sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  const firstErr = [
    settingsRes.error,
    profilesRes.error,
    favNumsRes.error,
    favGamesRes.error,
    effGamesRes.error,
    companiesRes.error,
    poolsRes.error,
    brandingRes.error,
    participantsRes.error,
    purchasesRes.error,
    gamesRes.error,
    suggestionsRes.error,
    auditRes.error,
  ].find(Boolean);

  if (firstErr) {
    throw new Error(`Erro ao ler estado do Supabase: ${firstErr.message}`);
  }

  const sRow = settingsRes.data;
  const settings: PlatformSettings = {
    defaultPlatformFeePercent: Number(sRow?.default_platform_fee_percent ?? 3.5),
    platformAsaasWalletId:
      process.env.ASAAS_PLATFORM_WALLET_ID?.trim() || sRow?.platform_asaas_wallet_id || '',
    asaasEnvironment: isAsaasConfigured()
      ? getAsaasEnvironment()
      : (sRow?.asaas_environment as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX',
    asaasWebhookActive: Boolean(
      sRow?.asaas_webhook_active || process.env.ASAAS_WEBHOOK_TOKEN?.trim()
    ),
    masterOrganizerName: sRow?.master_organizer_name || 'Administrador',
    supabaseSyncEnabled: true,
    supabaseProjectUrl: getSupabaseEnv().url,
  };

  const brandingByPoolId = new Map<string, any>();
  for (const b of brandingRes.data || []) {
    brandingByPoolId.set(b.pool_id, b);
  }

  const favNumsByUser = new Map<string, Partial<Record<LotteryType, number[]>>>();
  for (const row of favNumsRes.data || []) {
    const map = favNumsByUser.get(row.user_id) || {};
    map[row.lottery_type as LotteryType] = (row.numbers || []).map(Number);
    favNumsByUser.set(row.user_id, map);
  }

  const favGamesByUser = new Map<string, FavoriteGame[]>();
  for (const row of favGamesRes.data || []) {
    const list = favGamesByUser.get(row.user_id) || [];
    list.push({
      id: row.id,
      label: row.label,
      lotteryType: row.lottery_type as LotteryType,
      numbers: (row.numbers || []).map(Number),
      createdAt: row.created_at,
    });
    favGamesByUser.set(row.user_id, list);
  }

  const effGamesByUser = new Map<string, EffectiveGame[]>();
  for (const row of effGamesRes.data || []) {
    const list = effGamesByUser.get(row.user_id) || [];
    list.push({
      id: row.id,
      label: row.label,
      lotteryType: row.lottery_type as LotteryType,
      contestMode: row.contest_mode as 'REGULAR' | 'SPECIAL',
      contestNumber: row.contest_number,
      numbers: (row.numbers || []).map(Number),
      cost: Number(row.cost || 0),
      status: row.status as EffectiveGame['status'],
      createdAt: row.created_at,
    });
    effGamesByUser.set(row.user_id, list);
  }

  const companies: Company[] = (companiesRes.data || []).map((c: any) => ({
    id: c.id,
    tenantSlug: c.tenant_slug,
    name: c.name,
    cnpj: c.cnpj || '00.000.000/0001-00',
    segment: c.segment || '',
    logoInitials: c.logo_initials || 'BL',
    logoColor: c.logo_color || '#005CA9',
    logoUrl: c.logo_url || undefined,
    managerId: c.owner_user_id || undefined,
    managerName: c.manager_name || 'Organizador',
    managerRole: c.manager_role || 'Organizador',
    managerPixKey: c.manager_pix_key || '',
    managerCpf: c.manager_cpf || '',
    managerEmail: c.manager_email || '',
    managerWhatsapp: c.manager_whatsapp || '',
    asaasWalletId: c.asaas_wallet_id || '',
    cityState: c.city_state || '',
    createdAt: c.created_at,
  }));

  const companyByOwnerId = new Map<string, Company>();
  for (const c of companies) {
    if (c.managerId && !companyByOwnerId.has(c.managerId)) {
      companyByOwnerId.set(c.managerId, c);
    }
  }

  const users: SystemUser[] = (profilesRes.data || []).map((p: any) => {
    const ownedCompany = companyByOwnerId.get(p.id);
    return {
      id: p.id,
      name: p.name,
      username: p.username || undefined,
      whatsapp: p.whatsapp || '',
      cpf: p.cpf || '',
      email: p.email,
      companyName: p.company_name || ownedCompany?.name || '',
      companyId: ownedCompany?.id,
      jobTitle: p.job_title || 'Usuário',
      pixKey: p.pix_key || '',
      avatarInitials: p.avatar_initials || computeInitials(p.name),
      monthlySpendingLimit: Number(p.monthly_spending_limit ?? 300),
      favoriteLotteries: (p.favorite_lotteries || ['MEGA_SENA']) as LotteryType[],
      favoriteNumbersByLottery: favNumsByUser.get(p.id) || {},
      favoriteGames: favGamesByUser.get(p.id) || [],
      effectiveGames: effGamesByUser.get(p.id) || [],
      createdAt: p.created_at,
    };
  });

  const pools: Pool[] = (poolsRes.data || []).map((p: any) => {
    const branding = brandingByPoolId.get(p.id);
    // Keep company logo synced with pool branding if company doesn't have one
    if (branding?.logo_url && p.company_id) {
      const comp = companies.find((c) => c.id === p.company_id);
      if (comp && !comp.logoUrl) {
        comp.logoUrl = branding.logo_url;
      }
    }
    return {
      id: p.id,
      companyId: p.company_id || '',
      title: p.title,
      lotteryType: p.lottery_type as LotteryType,
      contestNumber: p.contest_number,
      collectionMode: p.collection_mode as Pool['collectionMode'],
      quotaValue: Number(p.quota_value),
      maxTargetAmount: Number(p.max_target_amount || 0),
      maxQuotas: Number(p.max_quotas || 9999),
      platformFeePercent: Number(p.platform_fee_percent ?? settings.defaultPlatformFeePercent),
      startDate: p.start_date,
      endDate: p.end_date,
      status: p.status as Pool['status'],
      officialReceiptCode: p.official_receipt_code || '',
      drawnNumbers: (p.drawn_numbers || []).map(Number),
      prizeTotalAmount: Number(p.prize_total_amount || 0),
      createdAt: p.created_at,
    };
  });

  const participants: Participant[] = (participantsRes.data || []).map((pt: any) => ({
    id: pt.id,
    companyId: pt.company_id || '',
    poolId: pt.pool_id,
    name: pt.name,
    cpf: pt.cpf,
    email: pt.email || '',
    whatsapp: pt.whatsapp || '',
    department: pt.department || 'Participante',
    pixKey: pt.pix_key || '',
    registeredBy: (pt.registered_by as 'SELF' | 'MANAGER') || 'SELF',
    createdAt: pt.created_at,
  }));

  const purchases: QuotaPurchase[] = (purchasesRes.data || []).map((q: any) => ({
    id: q.id,
    poolId: q.pool_id,
    companyId: q.company_id || '',
    participantId: q.participant_id || '',
    participantName: q.participant_name,
    participantCpf: q.participant_cpf,
    participantEmail: q.participant_email || '',
    participantWhatsapp: q.participant_whatsapp || '',
    participantRole: q.participant_role || '',
    participantPixKey: q.participant_pix_key || '',
    quotasCount: Number(q.quotas_count),
    unitQuotaValue: Number(q.unit_quota_value),
    totalAmount: Number(q.total_amount),
    platformFeePercent: Number(q.platform_fee_percent),
    platformFeeAmount: Number(q.platform_fee_amount),
    netPoolAmount: Number(q.net_pool_amount),
    organizerWalletId: q.organizer_wallet_id || '',
    asaasPaymentId: q.asaas_payment_id || '',
    pixQrCodePayload: q.pix_qr_code_payload || '',
    paymentStatus: q.payment_status as QuotaPurchase['paymentStatus'],
    couponHash: q.coupon_hash,
    createdAt: q.created_at,
    paidAt: q.paid_at || undefined,
  }));

  const games: LotteryGame[] = (gamesRes.data || []).map((g: any) => ({
    id: g.id,
    poolId: g.pool_id,
    companyId: g.company_id || '',
    lotteryType: g.lottery_type as LotteryType,
    gameMode: g.game_mode as LotteryGame['gameMode'],
    numbers: (g.numbers || []).map(Number),
    dozensCount: Number(g.dozens_count),
    equivalentSimpleBets: Number(g.equivalent_simple_bets || 1),
    cost: Number(g.cost || 0),
    lotericaReceiptCode: g.loterica_receipt_code,
    registeredAt: g.registered_at,
    authorId: g.author_user_id || undefined,
    authorName: g.author_name,
    authorAvatar: g.author_avatar || 'OR',
  }));

  const suggestions: PlayerSuggestion[] = (suggestionsRes.data || []).map((s: any) => ({
    id: s.id,
    companyId: s.company_id || '',
    poolId: s.pool_id,
    lotteryType: s.lottery_type as LotteryType,
    userId: s.author_user_id,
    userName: s.user_name,
    userAvatar: s.user_avatar || 'US',
    userJobTitle: s.user_job_title || 'Participante',
    numbers: (s.numbers || []).map(Number),
    rationale: s.rationale || '',
    votes: Number(s.votes_count || 0),
    approvedAsOfficialGame: Boolean(s.approved_as_official_game),
    createdAt: s.created_at,
    updatedAt: s.updated_at || undefined,
  }));

  const auditLogs: AuditLog[] = (auditRes.data || []).map((a: any) => ({
    id: a.id,
    timestamp: a.created_at,
    companyId: a.company_id || undefined,
    poolId: a.pool_id || undefined,
    actionType: a.action_type as AuditLog['actionType'],
    actorName: a.actor_name,
    description: a.description,
    integrityHash: a.integrity_hash,
    amount: a.amount !== null && a.amount !== undefined ? Number(a.amount) : undefined,
  }));

  return {
    settings,
    users,
    companies,
    pools,
    participants,
    purchases,
    games,
    suggestions,
    auditLogs,
  };
}

async function findProfileByIdentifier(identifier: string) {
  const sb = getSupabaseAdmin();
  const cleanInput = String(identifier || '').trim().toLowerCase();
  const cleanDigits = sanitizeDigits(cleanInput);

  const { data: profiles, error } = await sb.from('profiles').select('*');
  if (error) throw new Error(error.message);

  return (profiles || []).find((p: any) => {
    const emailMatch = String(p.email || '').trim().toLowerCase() === cleanInput;
    const usernameMatch = p.username && String(p.username).trim().toLowerCase() === cleanInput;
    const cpfMatch = cleanDigits.length >= 6 && sanitizeDigits(p.cpf) === cleanDigits;
    return emailMatch || usernameMatch || cpfMatch;
  });
}

export async function loginUserSupabase(identifier: string, password: string) {
  const profile = await findProfileByIdentifier(identifier);
  if (!profile) {
    return {
      status: 404 as const,
      error: 'Usuário não encontrado. Clique no botão "Cadastrar" abaixo para criar sua conta.',
    };
  }

  const authClient = getSupabaseAuthClient();
  const { error: signInErr } = await authClient.auth.signInWithPassword({
    email: profile.email,
    password: String(password),
  });

  if (signInErr) {
    return {
      status: 401 as const,
      error: 'Senha incorreta. Verifique sua senha ou clique em "Recuperar Senha".',
    };
  }

  const state = await fetchFullDatabaseState();
  const user = (state.users || []).find((u) => u.id === profile.id);
  return { status: 200 as const, user: user!, state };
}

export async function registerOrUpdateUserSupabase(body: any) {
  const {
    name,
    username,
    whatsapp,
    cpf,
    email,
    password,
    companyName,
    companyId,
    jobTitle,
    pixKey,
  } = body;

  const sb = getSupabaseAdmin();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanCpf = sanitizeDigits(cpf);
  const initials = computeInitials(name);
  const safeCompanyName = companyName ? String(companyName).trim() : '';
  const safeJobTitle = jobTitle ? String(jobTitle).trim() : 'Usuário';
  const safePassword = String(password || '123456').length >= 6
    ? String(password || '123456')
    : `${String(password || '123')}000`;

  const { data: allProfiles } = await sb.from('profiles').select('*');
  const existingProfile = (allProfiles || []).find(
    (p: any) =>
      String(p.email || '').trim().toLowerCase() === cleanEmail ||
      (cleanCpf.length >= 6 && sanitizeDigits(p.cpf) === cleanCpf)
  );

  let userId: string;

  if (existingProfile) {
    userId = existingProfile.id;
    const { error: updErr } = await sb
      .from('profiles')
      .update({
        name: String(name).trim(),
        username: username ? String(username).trim() : existingProfile.username,
        whatsapp: String(whatsapp).trim(),
        cpf: String(cpf).trim(),
        email: cleanEmail,
        company_name: safeCompanyName || existingProfile.company_name || '',
        job_title: safeJobTitle,
        pix_key: String(pixKey).trim(),
        avatar_initials: initials,
      })
      .eq('id', userId);
    if (updErr) throw new Error(updErr.message);

    if (password) {
      await sb.auth.admin.updateUserById(userId, { password: safePassword });
    }
  } else {
    const { data: createdAuth, error: authErr } = await sb.auth.admin.createUser({
      email: cleanEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: {
        name: String(name).trim(),
        username: username ? String(username).trim() : undefined,
        cpf: String(cpf).trim(),
        whatsapp: String(whatsapp).trim(),
        company_name: safeCompanyName,
        job_title: safeJobTitle,
        pix_key: String(pixKey).trim(),
      },
    });

    if (authErr || !createdAuth.user) {
      throw new Error(authErr?.message || 'Erro ao criar usuário no Supabase Auth.');
    }

    userId = createdAuth.user.id;
    // Ensure profile row has all fields even if trigger ran with partial metadata
    await sb.from('profiles').upsert(
      {
        id: userId,
        name: String(name).trim(),
        username: username ? String(username).trim() : null,
        cpf: String(cpf).trim(),
        email: cleanEmail,
        whatsapp: String(whatsapp).trim(),
        company_name: safeCompanyName,
        job_title: safeJobTitle,
        pix_key: String(pixKey).trim(),
        avatar_initials: initials,
      },
      { onConflict: 'id' }
    );
  }

  // Link as participant if company exists
  let matchedCompanyId: string | null = null;
  if (companyId && isUuid(companyId)) {
    matchedCompanyId = companyId;
  } else if (safeCompanyName) {
    const { data: comp } = await sb
      .from('companies')
      .select('id')
      .ilike('name', safeCompanyName)
      .maybeSingle();
    if (comp?.id) matchedCompanyId = comp.id;
  }

  if (matchedCompanyId) {
    const { data: pool } = await sb
      .from('pools')
      .select('id')
      .eq('company_id', matchedCompanyId)
      .limit(1)
      .maybeSingle();

    if (pool?.id) {
      await sb.from('pool_participants').upsert(
        {
          pool_id: pool.id,
          company_id: matchedCompanyId,
          user_id: userId,
          name: String(name).trim(),
          cpf: String(cpf).trim(),
          email: cleanEmail,
          whatsapp: String(whatsapp).trim(),
          department: safeJobTitle,
          pix_key: String(pixKey).trim(),
          registered_by: 'SELF',
        },
        { onConflict: 'pool_id,cpf' }
      );
    }
  }

  const state = await fetchFullDatabaseState();
  const user = (state.users || []).find((u) => u.id === userId)!;
  return { user, state };
}

export async function recoverPasswordSupabase(identifier: string, newPassword: string) {
  const profile = await findProfileByIdentifier(identifier);
  if (!profile) {
    return { status: 404 as const, error: 'Nenhum usuário localizado com este CPF ou E-mail.' };
  }

  const safePassword = String(newPassword).length >= 6 ? String(newPassword) : `${newPassword}000`;
  const sb = getSupabaseAdmin();
  const { error } = await sb.auth.admin.updateUserById(profile.id, { password: safePassword });
  if (error) throw new Error(error.message);

  const state = await fetchFullDatabaseState();
  const user = (state.users || []).find((u) => u.id === profile.id);
  return {
    status: 200 as const,
    ok: true,
    message: `Senha redefinida com sucesso para ${profile.name}! Você já pode entrar.`,
    user,
  };
}

export async function updateUserSupabase(userId: string, body: any) {
  const sb = getSupabaseAdmin();
  if (!isUuid(userId)) {
    return { status: 404 as const, error: 'Usuário não encontrado.' };
  }

  const { data: current, error: findErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!current) {
    return { status: 404 as const, error: 'Usuário não encontrado.' };
  }

  const updatedName = body.name ? String(body.name).trim() : current.name;
  const initials = computeInitials(updatedName, current.avatar_initials || 'US');

  const profilePatch: Record<string, any> = {
    name: updatedName,
    avatar_initials: initials,
  };
  if (body.username !== undefined) profilePatch.username = body.username || null;
  if (body.whatsapp !== undefined) profilePatch.whatsapp = String(body.whatsapp || '').trim();
  if (body.cpf !== undefined) profilePatch.cpf = String(body.cpf || '').trim() || null;
  if (body.email !== undefined) profilePatch.email = String(body.email || '').trim().toLowerCase();
  if (body.companyName !== undefined) profilePatch.company_name = String(body.companyName || '').trim();
  if (body.jobTitle !== undefined) profilePatch.job_title = String(body.jobTitle || 'Usuário').trim();
  if (body.pixKey !== undefined) profilePatch.pix_key = String(body.pixKey || '').trim();
  if (body.monthlySpendingLimit !== undefined) {
    profilePatch.monthly_spending_limit = Math.max(0, Number(body.monthlySpendingLimit) || 0);
  }
  if (Array.isArray(body.favoriteLotteries)) {
    profilePatch.favorite_lotteries = body.favoriteLotteries;
  }

  const { error: updErr } = await sb.from('profiles').update(profilePatch).eq('id', userId);
  if (updErr) throw new Error(updErr.message);

  // Sync favoriteNumbersByLottery
  if (body.favoriteNumbersByLottery && typeof body.favoriteNumbersByLottery === 'object') {
    const entries = Object.entries(body.favoriteNumbersByLottery);
    for (const [lotType, nums] of entries) {
      if (lotType in LOTTERY_CONFIGS && Array.isArray(nums)) {
        await sb.from('user_favorite_numbers').upsert(
          {
            user_id: userId,
            lottery_type: lotType,
            numbers: nums.map(Number),
          },
          { onConflict: 'user_id,lottery_type' }
        );
      }
    }
  }

  // Sync favoriteGames
  if (Array.isArray(body.favoriteGames)) {
    await sb.from('user_favorite_games').delete().eq('user_id', userId);
    if (body.favoriteGames.length > 0) {
      const rows = body.favoriteGames
        .filter((g: any) => Array.isArray(g.numbers) && g.numbers.length > 0)
        .map((g: any) => ({
          ...(isUuid(g.id) ? { id: g.id } : {}),
          user_id: userId,
          label: String(g.label || 'Jogo Favorito'),
          lottery_type: g.lotteryType || 'MEGA_SENA',
          numbers: g.numbers.map(Number),
        }));
      if (rows.length > 0) {
        const { error: fgErr } = await sb.from('user_favorite_games').insert(rows);
        if (fgErr) throw new Error(fgErr.message);
      }
    }
  }

  // Sync effectiveGames (Meus Jogos: ELABORADO / A_FAZER / FEITO)
  if (Array.isArray(body.effectiveGames)) {
    await sb.from('user_effective_games').delete().eq('user_id', userId);
    if (body.effectiveGames.length > 0) {
      const rows = body.effectiveGames
        .filter((g: any) => Array.isArray(g.numbers) && g.numbers.length > 0)
        .map((g: any) => ({
          ...(isUuid(g.id) ? { id: g.id } : {}),
          user_id: userId,
          label: String(g.label || 'Meu Jogo'),
          lottery_type: g.lotteryType || 'MEGA_SENA',
          contest_mode: g.contestMode === 'SPECIAL' ? 'SPECIAL' : 'REGULAR',
          contest_number: String(g.contestNumber || 'Atual'),
          numbers: g.numbers.map(Number),
          cost: Math.max(0, Number(g.cost) || 0),
          status: ['ELABORADO', 'A_FAZER', 'FEITO'].includes(g.status) ? g.status : 'ELABORADO',
          loterica_receipt_code: g.lotericaReceiptCode || null,
        }));
      if (rows.length > 0) {
        const { error: egErr } = await sb.from('user_effective_games').insert(rows);
        if (egErr) throw new Error(egErr.message);
      }
    }
  }

  // Sync participant details for this user
  await sb
    .from('pool_participants')
    .update({
      name: updatedName,
      email: profilePatch.email ?? current.email,
      whatsapp: profilePatch.whatsapp ?? current.whatsapp,
      department: profilePatch.job_title ?? current.job_title,
      pix_key: profilePatch.pix_key ?? current.pix_key,
    })
    .eq('user_id', userId);

  const state = await fetchFullDatabaseState();
  const user = (state.users || []).find((u) => u.id === userId)!;
  return { status: 200 as const, user, state };
}

export async function createCompanyAndPoolSupabase(body: any) {
  const {
    userId,
    name,
    cnpj,
    segment,
    logoColor,
    logoUrl,
    managerName,
    managerRole,
    managerPixKey,
    managerCpf,
    managerEmail,
    managerWhatsapp,
    asaasWalletId,
    cityState,
    poolTitle,
    lotteryType,
    contestNumber,
    quotaValue,
    maxTargetAmount,
    endDate,
  } = body;

  if (!userId && !managerName) {
    return { status: 401 as const, error: 'Faça login para criar um bolão.' };
  }

  const sb = getSupabaseAdmin();

  // Resolve creator profile UUID
  let creatorProfile: any = null;
  if (isUuid(userId)) {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    creatorProfile = data;
  }
  if (!creatorProfile && managerEmail) {
    const { data } = await sb
      .from('profiles')
      .select('*')
      .ilike('email', String(managerEmail).trim())
      .maybeSingle();
    creatorProfile = data;
  }
  if (!creatorProfile) {
    const { data } = await sb.from('profiles').select('*').limit(1).maybeSingle();
    creatorProfile = data;
  }
  if (!creatorProfile) {
    return {
      status: 401 as const,
      error: 'Cadastre ou faça login com uma conta antes de criar um bolão.',
    };
  }

  const resolvedName = String(name || poolTitle || 'Novo Bolão').trim();
  const initials = computeInitials(resolvedName, 'BL');
  const tenantSlug = `${resolvedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'bolao'}-${Date.now().toString(36).slice(-5)}`;
  const wallet =
    asaasWalletId && String(asaasWalletId).trim()
      ? String(asaasWalletId).trim()
      : `wal_asaas_${initials.toLowerCase()}_${Math.floor(100000 + Math.random() * 900000)}`;

  const resolvedManagerName = String(
    managerName || creatorProfile.name || 'Organizador'
  ).trim();
  const resolvedPixKey = String(managerPixKey || creatorProfile.pix_key || '').trim();

  // Upload logo DataURL to Supabase Storage bucket `pool-logos` (zero base64 in DB)
  const uploadedLogo = await uploadLogoIfDataUrl({
    logoUrl,
    ownerUserId: creatorProfile.id,
  });

  const { data: compRow, error: compErr } = await sb
    .from('companies')
    .insert({
      tenant_slug: tenantSlug,
      owner_user_id: creatorProfile.id,
      name: resolvedName,
      cnpj: String(cnpj || '00.000.000/0001-00').trim(),
      segment: segment !== undefined ? String(segment).trim() : '',
      logo_initials: initials,
      logo_color: logoColor || '#005CA9',
      logo_url: uploadedLogo.publicUrl || null,
      manager_name: resolvedManagerName,
      manager_role: String(managerRole || creatorProfile.job_title || 'Coordenador').trim(),
      manager_pix_key: resolvedPixKey,
      manager_cpf: String(managerCpf || creatorProfile.cpf || '000.000.000-00').trim(),
      manager_email: String(managerEmail || creatorProfile.email || '').trim(),
      manager_whatsapp: String(managerWhatsapp || creatorProfile.whatsapp || '').trim(),
      asaas_wallet_id: wallet,
      city_state: String(cityState || 'São Paulo - SP').trim(),
    })
    .select('*')
    .single();

  if (compErr || !compRow) {
    throw new Error(compErr?.message || 'Erro ao criar grupo do bolão.');
  }

  const { data: settingsRow } = await sb
    .from('platform_settings')
    .select('default_platform_fee_percent')
    .eq('id', true)
    .maybeSingle();

  const parsedQuota = Math.max(1, Number(quotaValue) || 100);
  const rawMaxTarget = maxTargetAmount !== undefined ? Number(maxTargetAmount) : 0;
  const parsedMaxTarget = Number.isFinite(rawMaxTarget) && rawMaxTarget > 0 ? rawMaxTarget : 0;
  const resolvedCollectionMode = parsedMaxTarget > 0 ? 'MAX_TARGET' : 'FIXED_QUOTA';
  const maxQuotas =
    parsedMaxTarget > 0 ? Math.max(1, Math.floor(parsedMaxTarget / parsedQuota)) : 9999;

  const resolvedLottery: LotteryType =
    lotteryType && lotteryType in LOTTERY_CONFIGS ? (lotteryType as LotteryType) : 'MEGA_SENA';

  const { data: poolRow, error: poolErr } = await sb
    .from('pools')
    .insert({
      company_id: compRow.id,
      creator_user_id: creatorProfile.id,
      category: 'PRIVATE_USER',
      visibility: 'PUBLIC',
      title: String(poolTitle || `Bolão — ${resolvedName}`).trim(),
      lottery_type: resolvedLottery,
      contest_mode: 'REGULAR',
      contest_number: String(contestNumber || '2950').trim(),
      collection_mode: resolvedCollectionMode,
      quota_value: parsedQuota,
      max_target_amount: parsedMaxTarget,
      max_quotas: maxQuotas,
      platform_fee_percent: Number(settingsRow?.default_platform_fee_percent ?? 3.5),
      start_date: new Date().toISOString(),
      end_date: endDate || '2026-12-31T16:00:00-03:00',
      status: 'OPEN',
      official_receipt_code: `CX-2026-${initials}-${Math.floor(10000 + Math.random() * 90000)}`,
      drawn_numbers: [],
      prize_total_amount: 0,
    })
    .select('*')
    .single();

  if (poolErr || !poolRow) {
    throw new Error(poolErr?.message || 'Erro ao criar bolão.');
  }

  // Create dedicated private_pool record (trigger auto-adds creator as OWNER in private_pool_members)
  await sb.from('private_pools').insert({
    pool_id: poolRow.id,
    owner_user_id: creatorProfile.id,
    organizer_pix_key: resolvedPixKey,
    organizer_asaas_wallet_id: wallet,
  });

  // Update auto-created pool_branding_layouts with chosen logo and primary color
  await sb
    .from('pool_branding_layouts')
    .update({
      logo_url: uploadedLogo.publicUrl || null,
      logo_storage_path: uploadedLogo.storagePath || null,
      logo_initials: initials,
      primary_color: logoColor || '#005CA9',
    })
    .eq('pool_id', poolRow.id);

  // Link uploaded asset to pool_id if present
  if (uploadedLogo.storagePath) {
    await sb
      .from('pool_logo_assets')
      .update({ pool_id: poolRow.id })
      .eq('storage_path', uploadedLogo.storagePath);
  }

  await sb.from('audit_logs').insert({
    company_id: compRow.id,
    pool_id: poolRow.id,
    actor_user_id: creatorProfile.id,
    action_type: 'PRIVATE_POOL_CREATED',
    actor_name: `${resolvedManagerName} (${compRow.manager_role})`,
    description: `Bolão "${poolRow.title}" criado por ${resolvedManagerName}.`,
    integrity_hash: createHash(compRow.id + poolRow.id),
  });

  const state = await fetchFullDatabaseState();
  const company = state.companies.find((c) => c.id === compRow.id)!;
  const pool = state.pools.find((p) => p.id === poolRow.id)!;
  return { status: 200 as const, company, pool, state };
}

export async function updatePoolSupabase(poolId: string, body: any) {
  if (!isUuid(poolId)) {
    return { status: 404 as const, error: 'Bolão não encontrado.' };
  }

  const sb = getSupabaseAdmin();
  const { data: current, error: findErr } = await sb
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!current) {
    return { status: 404 as const, error: 'Bolão não encontrado.' };
  }

  const nextQuota = Math.max(1, Number(body.quotaValue ?? current.quota_value) || 100);
  const nextMaxTarget =
    body.maxTargetAmount !== undefined
      ? Math.max(0, Number(body.maxTargetAmount) || 0)
      : Number(current.max_target_amount || 0);
  const nextCollectionMode = nextMaxTarget > 0 ? 'MAX_TARGET' : 'FIXED_QUOTA';
  const nextMaxQuotas =
    nextMaxTarget > 0 ? Math.max(1, Math.floor(nextMaxTarget / nextQuota)) : 9999;

  const { data: confirmedPurchases } = await sb
    .from('quota_purchases')
    .select('total_amount')
    .eq('pool_id', poolId)
    .eq('payment_status', 'CONFIRMED');

  const confirmedSum = (confirmedPurchases || []).reduce(
    (acc: number, row: any) => acc + Number(row.total_amount || 0),
    0
  );

  const nextEndDate = body.endDate || current.end_date;
  const isPastDeadline = new Date(nextEndDate).getTime() <= Date.now();
  const isTargetReached = nextMaxTarget > 0 && confirmedSum >= nextMaxTarget;

  const nextStatus =
    current.status === 'DRAWN'
      ? current.status
      : isTargetReached || isPastDeadline
      ? 'CLOSED'
      : 'OPEN';

  const patch: Record<string, any> = {
    collection_mode: nextCollectionMode,
    quota_value: nextQuota,
    max_target_amount: nextMaxTarget,
    max_quotas: nextMaxQuotas,
    end_date: nextEndDate,
    status: nextStatus,
  };
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.lotteryType !== undefined && body.lotteryType in LOTTERY_CONFIGS) {
    patch.lottery_type = body.lotteryType;
  }
  if (body.contestNumber !== undefined) patch.contest_number = String(body.contestNumber).trim();
  if (Array.isArray(body.drawnNumbers)) patch.drawn_numbers = body.drawnNumbers.map(Number);
  if (body.prizeTotalAmount !== undefined) {
    patch.prize_total_amount = Math.max(0, Number(body.prizeTotalAmount) || 0);
  }

  const { error: updErr } = await sb.from('pools').update(patch).eq('id', poolId);
  if (updErr) throw new Error(updErr.message);

  await sb.from('audit_logs').insert({
    company_id: current.company_id,
    pool_id: poolId,
    action_type: 'RESULT_AUDITED',
    actor_name: 'Gestor do Bolão',
    description: `Parâmetros/Concurso do bolão "${patch.title || current.title}" atualizados. Cota: R$ ${nextQuota.toFixed(2)}.`,
    integrity_hash: createHash(poolId + JSON.stringify(body)),
  });

  const state = await fetchFullDatabaseState();
  const pool = state.pools.find((p) => p.id === poolId)!;
  return { status: 200 as const, pool, state };
}

export async function registerParticipantSupabase(body: any) {
  const { companyId, poolId, name, cpf, email, whatsapp, department, pixKey, registeredBy } = body;
  if (!companyId || !poolId || !name || !cpf) {
    return { status: 400 as const, error: 'Nome, CPF e empresa são obrigatórios.' };
  }
  if (!isUuid(poolId)) {
    return { status: 404 as const, error: 'Bolão não encontrado.' };
  }

  const sb = getSupabaseAdmin();
  const cleanDigits = sanitizeDigits(cpf);

  const { data: existingList } = await sb
    .from('pool_participants')
    .select('*')
    .eq('pool_id', poolId);

  const existing = (existingList || []).find(
    (p: any) => sanitizeDigits(p.cpf) === cleanDigits
  );

  if (existing) {
    const state = await fetchFullDatabaseState();
    const participant = state.participants.find((p) => p.id === existing.id)!;
    return { status: 200 as const, participant, state };
  }

  // Try matching an existing profile by CPF or email
  const matchedProfile = await findProfileByIdentifier(cpf).catch(() => null);

  const { data: inserted, error } = await sb
    .from('pool_participants')
    .insert({
      pool_id: poolId,
      company_id: isUuid(companyId) ? companyId : null,
      user_id: matchedProfile?.id || null,
      name: String(name).trim(),
      cpf: String(cpf).trim(),
      email: String(email || '').trim(),
      whatsapp: String(whatsapp || '').trim(),
      department: String(department || 'Geral').trim(),
      pix_key: String(pixKey || '').trim(),
      registered_by: registeredBy === 'MANAGER' ? 'MANAGER' : 'SELF',
    })
    .select('*')
    .single();

  if (error || !inserted) throw new Error(error?.message || 'Erro ao cadastrar participante.');

  await sb.from('audit_logs').insert({
    company_id: isUuid(companyId) ? companyId : null,
    pool_id: poolId,
    actor_user_id: matchedProfile?.id || null,
    action_type: 'PARTICIPANT_REGISTERED',
    actor_name: registeredBy === 'MANAGER' ? 'Gestor do Bolão' : inserted.name,
    description: `Participante cadastrado (${inserted.department}) com CPF validado (${inserted.cpf.slice(0, 3)}.***.***-**).`,
    integrity_hash: createHash(inserted.id),
  });

  const state = await fetchFullDatabaseState();
  const participant = state.participants.find((p) => p.id === inserted.id)!;
  return { status: 200 as const, participant, state };
}

export async function createPixPurchaseSupabase(body: any) {
  const {
    poolId,
    companyId,
    participantName,
    participantCpf,
    participantEmail,
    participantWhatsapp,
    participantDepartment,
    participantPixKey,
    quotasCount,
    autoConfirmNow,
  } = body;

  if (!isUuid(poolId) || !isUuid(companyId)) {
    return { status: 404 as const, error: 'Empresa ou Bolão não encontrado.' };
  }

  const sb = getSupabaseAdmin();
  const [{ data: pool }, { data: company }] = await Promise.all([
    sb.from('pools').select('*').eq('id', poolId).maybeSingle(),
    sb.from('companies').select('*').eq('id', companyId).maybeSingle(),
  ]);

  if (!pool || !company) {
    return { status: 404 as const, error: 'Empresa ou Bolão não encontrado.' };
  }

  const { data: settingsRow } = await sb
    .from('platform_settings')
    .select('default_platform_fee_percent')
    .eq('id', true)
    .maybeSingle();

  const count = Math.max(1, Number(quotasCount) || 1);
  const unitQuotaValue = Number(pool.quota_value);
  const totalAmount = Number((count * unitQuotaValue).toFixed(2));
  const feePercent = Number(pool.platform_fee_percent ?? settingsRow?.default_platform_fee_percent ?? 3.5);
  const platformFeeAmount = Number(((totalAmount * feePercent) / 100).toFixed(2));
  const netPoolAmount = Number((totalAmount - platformFeeAmount).toFixed(2));

  // Ensure participant exists
  const cleanDigits = sanitizeDigits(participantCpf);
  const { data: existingParts } = await sb
    .from('pool_participants')
    .select('*')
    .eq('pool_id', poolId);
  let participant = (existingParts || []).find((p: any) => sanitizeDigits(p.cpf) === cleanDigits);

  const matchedProfile = await findProfileByIdentifier(participantCpf || participantEmail || '').catch(() => null);

  if (!participant) {
    const { data: newPart, error: partErr } = await sb
      .from('pool_participants')
      .insert({
        pool_id: poolId,
        company_id: companyId,
        user_id: matchedProfile?.id || null,
        name: String(participantName).trim(),
        cpf: String(participantCpf).trim(),
        email: String(participantEmail || '').trim(),
        whatsapp: String(participantWhatsapp || '').trim(),
        department: String(participantDepartment || 'Participante').trim(),
        pix_key: String(participantPixKey || '').trim(),
        registered_by: 'SELF',
      })
      .select('*')
      .single();
    if (partErr || !newPart) throw new Error(partErr?.message || 'Erro ao registrar participante.');
    participant = newPart;
  }

  const asaasSplitPayload = {
    billingType: 'PIX',
    value: totalAmount,
    dueDate: String(pool.end_date).slice(0, 10),
    description: `${pool.title} - ${count} cota(s) - ${company.name}`,
    externalReference: `${pool.id}_${participant.id}_${Date.now()}`,
    split: [
      {
        walletId: company.asaas_wallet_id,
        fixedValue: netPoolAmount,
        percentualValue: Number((100 - feePercent).toFixed(2)),
        description: `Repasse Automático Bolão ${company.name}`,
      },
    ],
  };

  let asaasPaymentId = `pay_asaas_pix_${Math.floor(100000000 + Math.random() * 900000000)}`;
  let pixQrCodePayload = `00020126580014BR.GOV.BCB.PIX0136asaas-split-${String(company.logo_initials || 'bl').toLowerCase()}-${asaasPaymentId}520400005303986540${String(totalAmount.toFixed(2)).length}${totalAmount.toFixed(2)}5802BR5920BOLAO LOTERIAS SPLIT6009SAO PAULO62070503***6304${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  if (isAsaasConfigured()) {
    try {
      const customerId = await ensureAsaasCustomer({
        name: participant.name,
        cpfCnpj: participant.cpf,
        email: participant.email || undefined,
        mobilePhone: participant.whatsapp || undefined,
      });
      if (customerId) {
        const livePix = await createAsaasPixPayment({
          customerId,
          value: totalAmount,
          dueDate: String(pool.end_date).slice(0, 10),
          description: asaasSplitPayload.description,
          externalReference: asaasSplitPayload.externalReference,
          organizerWalletId: company.asaas_wallet_id || undefined,
          netPoolAmount,
          feePercent,
        });
        if (livePix?.paymentId) {
          asaasPaymentId = livePix.paymentId;
          if (livePix.pixQrCodePayload) {
            pixQrCodePayload = livePix.pixQrCodePayload;
          }
        }
      }
    } catch {
      // Keep graceful local payment reference if Asaas Sandbox rejects invalid test CPF
    }
  }

  const couponHash = `LCX-2026-${company.logo_initials || 'BL'}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
  const nowIso = new Date().toISOString();
  const paymentStatus = autoConfirmNow ? 'CONFIRMED' : 'PENDING';

  const { data: insertedPurchase, error: purErr } = await sb
    .from('quota_purchases')
    .insert({
      pool_id: poolId,
      company_id: companyId,
      participant_id: participant.id,
      buyer_user_id: participant.user_id || matchedProfile?.id || null,
      participant_name: participant.name,
      participant_cpf: participant.cpf,
      participant_email: participant.email || '',
      participant_whatsapp: participant.whatsapp || '',
      participant_role: participant.department || '',
      participant_pix_key: participant.pix_key || '',
      quotas_count: count,
      unit_quota_value: unitQuotaValue,
      total_amount: totalAmount,
      platform_fee_percent: feePercent,
      platform_fee_amount: platformFeeAmount,
      net_pool_amount: netPoolAmount,
      organizer_wallet_id: company.asaas_wallet_id || '',
      asaas_payment_id: asaasPaymentId,
      pix_qr_code_payload: pixQrCodePayload,
      payment_status: paymentStatus,
      coupon_hash: couponHash,
      paid_at: autoConfirmNow ? nowIso : null,
    })
    .select('*')
    .single();

  if (purErr || !insertedPurchase) {
    throw new Error(purErr?.message || 'Erro ao registrar compra de cota.');
  }

  if (autoConfirmNow && Number(pool.max_target_amount || 0) > 0) {
    const { data: confirmedRows } = await sb
      .from('quota_purchases')
      .select('total_amount')
      .eq('pool_id', poolId)
      .eq('payment_status', 'CONFIRMED');
    const confirmedTotal = (confirmedRows || []).reduce(
      (acc: number, r: any) => acc + Number(r.total_amount || 0),
      0
    );
    if (confirmedTotal >= Number(pool.max_target_amount)) {
      await sb.from('pools').update({ status: 'CLOSED' }).eq('id', poolId);
    }
  }

  await sb.from('audit_logs').insert({
    company_id: companyId,
    pool_id: poolId,
    actor_user_id: participant.user_id || null,
    action_type: autoConfirmNow ? 'PIX_SPLIT_CONCILIATED' : 'PIX_GENERATED',
    actor_name: autoConfirmNow ? 'Asaas Webhook (Conciliação Automática)' : participant.name,
    description: autoConfirmNow
      ? `Pix confirmado (${count} cota(s) - R$ ${totalAmount.toFixed(2)}). Split: R$ ${netPoolAmount.toFixed(2)} repassado + R$ ${platformFeeAmount.toFixed(2)} taxa (${feePercent}%).`
      : `Cobrança Pix gerada (${asaasPaymentId}) para ${count} cota(s) — R$ ${totalAmount.toFixed(2)}.`,
    integrity_hash: createHash(insertedPurchase.id + asaasPaymentId),
    amount: totalAmount,
  });

  const state = await fetchFullDatabaseState();
  const purchase = state.purchases.find((p) => p.id === insertedPurchase.id)!;
  return { status: 200 as const, purchase, asaasSplitPayload, state };
}

export async function conciliatePixPurchaseSupabase(purchaseId: string) {
  if (!isUuid(purchaseId)) {
    return { status: 404 as const, error: 'Cobrança Pix não encontrada.' };
  }

  const sb = getSupabaseAdmin();
  const { data: purchase, error: findErr } = await sb
    .from('quota_purchases')
    .select('*')
    .eq('id', purchaseId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!purchase) {
    return { status: 404 as const, error: 'Cobrança Pix não encontrada.' };
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await sb
    .from('quota_purchases')
    .update({ payment_status: 'CONFIRMED', paid_at: nowIso })
    .eq('id', purchaseId);

  if (updErr) throw new Error(updErr.message);

  const { data: pool } = await sb.from('pools').select('*').eq('id', purchase.pool_id).maybeSingle();
  if (pool && Number(pool.max_target_amount || 0) > 0) {
    const { data: confirmedRows } = await sb
      .from('quota_purchases')
      .select('total_amount')
      .eq('pool_id', pool.id)
      .eq('payment_status', 'CONFIRMED');
    const confirmedTotal = (confirmedRows || []).reduce(
      (acc: number, r: any) => acc + Number(r.total_amount || 0),
      0
    );
    if (confirmedTotal >= Number(pool.max_target_amount)) {
      await sb.from('pools').update({ status: 'CLOSED' }).eq('id', pool.id);
    }
  }

  await sb.from('audit_logs').insert({
    company_id: purchase.company_id,
    pool_id: purchase.pool_id,
    action_type: 'PIX_SPLIT_CONCILIATED',
    actor_name: 'Asaas Webhook (PAYMENT_RECEIVED)',
    description: `Conciliação bancária imediata (${purchase.asaas_payment_id}). Split liquidado: R$ ${Number(purchase.net_pool_amount).toFixed(2)} + R$ ${Number(purchase.platform_fee_amount).toFixed(2)} taxa.`,
    integrity_hash: createHash(purchase.id + nowIso),
    amount: Number(purchase.total_amount),
  });

  const state = await fetchFullDatabaseState();
  const updated = state.purchases.find((p) => p.id === purchaseId)!;
  return { status: 200 as const, purchase: updated, state };
}

export async function handleAsaasWebhookEventSupabase(
  eventName: string,
  payment?: { id?: string; status?: string; value?: number }
) {
  const asaasPaymentId = String(payment?.id || '').trim();
  if (!asaasPaymentId) {
    return { handled: false, reason: 'missing_payment_id' };
  }

  const sb = getSupabaseAdmin();
  const { data: purchase, error: findErr } = await sb
    .from('quota_purchases')
    .select('*')
    .eq('asaas_payment_id', asaasPaymentId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!purchase) {
    return { handled: false, reason: 'purchase_not_found' };
  }

  const normalizedEvent = String(eventName || '').toUpperCase();

  if (normalizedEvent === 'PAYMENT_RECEIVED' || normalizedEvent === 'PAYMENT_CONFIRMED') {
    if (purchase.payment_status === 'CONFIRMED') {
      return { handled: true, status: 'already_confirmed', purchaseId: purchase.id };
    }
    await conciliatePixPurchaseSupabase(purchase.id);
    return { handled: true, status: 'confirmed', purchaseId: purchase.id };
  }

  if (
    normalizedEvent === 'PAYMENT_OVERDUE' ||
    normalizedEvent === 'PAYMENT_DELETED' ||
    normalizedEvent === 'PAYMENT_REFUNDED'
  ) {
    await sb
      .from('quota_purchases')
      .update({ payment_status: 'OVERDUE' })
      .eq('id', purchase.id);
    return { handled: true, status: 'overdue', purchaseId: purchase.id };
  }

  return { handled: false, reason: 'ignored_event' };
}

export async function registerGamesSupabase(body: any) {
  const { poolId, companyId, lotteryType, games, authorId, authorName, authorAvatar } = body;
  if (!poolId || !companyId || !Array.isArray(games) || games.length === 0) {
    return { status: 400 as const, error: 'Informe ao menos um volante/jogo válido.' };
  }
  if (!isUuid(poolId)) {
    return { status: 404 as const, error: 'Bolão não encontrado.' };
  }

  const sb = getSupabaseAdmin();
  const resolvedLottery: LotteryType =
    lotteryType && lotteryType in LOTTERY_CONFIGS ? (lotteryType as LotteryType) : 'MEGA_SENA';
  const minNumbers = LOTTERY_CONFIGS[resolvedLottery].minNumbers;

  const rows = games.map((g: any, idx: number) => {
    const nums: number[] = Array.isArray(g.numbers)
      ? g.numbers.map(Number).sort((a: number, b: number) => a - b)
      : [];
    const resolvedAuthorName = String(g.authorName || authorName || 'Organizador do Bolão').trim();
    const resolvedAuthorId = isUuid(g.authorId) ? g.authorId : isUuid(authorId) ? authorId : null;

    return {
      pool_id: poolId,
      company_id: isUuid(companyId) ? companyId : null,
      lottery_type: resolvedLottery,
      game_mode: g.gameMode || (nums.length > minNumbers ? 'DESDOBRAMENTO' : 'SIMPLES'),
      numbers: nums,
      dozens_count: nums.length,
      equivalent_simple_bets: Math.max(1, Number(g.equivalentSimpleBets) || 1),
      cost: Math.max(0, Number(g.cost) || 5.0),
      loterica_receipt_code:
        g.lotericaReceiptCode ||
        `TERM-${Math.floor(100000 + Math.random() * 900000)}-CX-${idx + 1}`,
      author_user_id: resolvedAuthorId,
      author_name: resolvedAuthorName,
      author_avatar: g.authorAvatar || authorAvatar || computeInitials(resolvedAuthorName, 'OR'),
    };
  });

  const { data: insertedGames, error } = await sb.from('pool_games').insert(rows).select('*');
  if (error || !insertedGames) throw new Error(error?.message || 'Erro ao registrar volantes.');

  const totalCost = rows.reduce((acc: number, r: any) => acc + Number(r.cost || 0), 0);
  await sb.from('audit_logs').insert({
    company_id: isUuid(companyId) ? companyId : null,
    pool_id: poolId,
    actor_user_id: isUuid(authorId) ? authorId : null,
    action_type: 'GAME_REGISTERED',
    actor_name: String(authorName || 'Organizador do Bolão'),
    description: `${insertedGames.length} volante(s) registrado(s) no bolão (Custo Total: R$ ${totalCost.toFixed(2)}).`,
    integrity_hash: createHash(insertedGames.map((g: any) => g.id).join(',')),
    amount: totalCost,
  });

  const state = await fetchFullDatabaseState();
  const createdIds = new Set(insertedGames.map((g: any) => g.id));
  const mappedGames = state.games.filter((g) => createdIds.has(g.id));
  return { status: 200 as const, games: mappedGames, state };
}

export async function createSuggestionSupabase(body: any) {
  const {
    companyId,
    poolId,
    lotteryType,
    userId,
    userName,
    userAvatar,
    userJobTitle,
    numbers,
    rationale,
  } = body;

  if (!companyId || !poolId || !Array.isArray(numbers) || numbers.length === 0) {
    return { status: 400 as const, error: 'Selecione as dezenas do seu palpite.' };
  }
  if (!isUuid(poolId)) {
    return { status: 404 as const, error: 'Bolão não encontrado.' };
  }

  const sb = getSupabaseAdmin();
  let authorUserId: string | null = isUuid(userId) ? userId : null;
  if (!authorUserId) {
    const { data: fallbackProf } = await sb.from('profiles').select('id').limit(1).maybeSingle();
    authorUserId = fallbackProf?.id || null;
  }
  if (!authorUserId) {
    return { status: 401 as const, error: 'Faça login para enviar palpites.' };
  }

  const resolvedName = String(userName || 'Participante').trim();
  const sortedNums = numbers.map(Number).sort((a: number, b: number) => a - b);
  const resolvedLottery: LotteryType =
    lotteryType && lotteryType in LOTTERY_CONFIGS ? (lotteryType as LotteryType) : 'MEGA_SENA';

  const { data: inserted, error } = await sb
    .from('pool_suggestions')
    .insert({
      pool_id: poolId,
      company_id: isUuid(companyId) ? companyId : null,
      lottery_type: resolvedLottery,
      author_user_id: authorUserId,
      user_name: resolvedName,
      user_avatar: userAvatar || computeInitials(resolvedName, 'US'),
      user_job_title: String(userJobTitle || 'Apostador').trim(),
      numbers: sortedNums,
      rationale: String(rationale || 'Jogo elaborado para o bolão.').trim(),
      votes_count: 0,
      approved_as_official_game: false,
    })
    .select('*')
    .single();

  if (error || !inserted) throw new Error(error?.message || 'Erro ao criar palpite.');

  // Initial author vote (triggers trg_suggestion_votes_sync -> votes_count = 1)
  await sb
    .from('pool_suggestion_votes')
    .upsert({ suggestion_id: inserted.id, user_id: authorUserId }, { onConflict: 'suggestion_id,user_id' });

  await sb.from('audit_logs').insert({
    company_id: isUuid(companyId) ? companyId : null,
    pool_id: poolId,
    actor_user_id: authorUserId,
    action_type: 'SUGGESTION_CREATED',
    actor_name: `${resolvedName} (${inserted.user_job_title})`,
    description: `Novo jogo indicado (${sortedNums.length} dezenas: [${sortedNums.map((n) => String(n).padStart(2, '0')).join('-')}]).`,
    integrity_hash: createHash(inserted.id),
  });

  const state = await fetchFullDatabaseState();
  const suggestion = (state.suggestions || []).find((s) => s.id === inserted.id)!;
  return { status: 200 as const, suggestion, state };
}

export async function suggestionActionSupabase(suggestionId: string, body: any) {
  if (!isUuid(suggestionId)) {
    return { status: 404 as const, error: 'Jogo indicado não encontrado.' };
  }

  const { action, cost, equivalentSimpleBets, numbers, rationale, actorId, actorName } = body;
  const sb = getSupabaseAdmin();

  const { data: sug, error: findErr } = await sb
    .from('pool_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!sug) {
    return { status: 404 as const, error: 'Jogo indicado não encontrado.' };
  }

  if (action === 'VOTE') {
    if (isUuid(actorId)) {
      const { data: existingVote } = await sb
        .from('pool_suggestion_votes')
        .select('suggestion_id')
        .eq('suggestion_id', suggestionId)
        .eq('user_id', actorId)
        .maybeSingle();

      if (!existingVote) {
        await sb
          .from('pool_suggestion_votes')
          .insert({ suggestion_id: suggestionId, user_id: actorId });
      } else {
        await sb
          .from('pool_suggestions')
          .update({ votes_count: Number(sug.votes_count || 0) + 1 })
          .eq('id', suggestionId);
      }
    } else {
      await sb
        .from('pool_suggestions')
        .update({ votes_count: Number(sug.votes_count || 0) + 1 })
        .eq('id', suggestionId);
    }
  } else if (action === 'EDIT_NUMBERS') {
    if (sug.approved_as_official_game) {
      return {
        status: 400 as const,
        error: 'Este jogo já foi aprovado pelo organizador e suas dezenas não podem mais ser alteradas.',
      };
    }
    const isAuthor =
      sug.author_user_id === actorId ||
      String(sug.user_name || '').trim().toLowerCase() === String(actorName || '').trim().toLowerCase();
    if (!isAuthor) {
      return {
        status: 403 as const,
        error: 'Somente quem elaborou este jogo pode alterar as dezenas antes da aprovação.',
      };
    }

    const patch: Record<string, any> = {};
    if (Array.isArray(numbers) && numbers.length > 0) {
      patch.numbers = numbers.map(Number).sort((a: number, b: number) => a - b);
    }
    if (rationale !== undefined) {
      patch.rationale = String(rationale).trim();
    }
    const { error: updErr } = await sb.from('pool_suggestions').update(patch).eq('id', suggestionId);
    if (updErr) throw new Error(updErr.message);
  } else if (action === 'APPROVE_GAME' && !sug.approved_as_official_game) {
    const sugLottery = sug.lottery_type as LotteryType;
    const minNumbers = LOTTERY_CONFIGS[sugLottery]?.minNumbers ?? 6;
    const sugNums = (sug.numbers || []).map(Number);

    const { data: newGame, error: gameErr } = await sb
      .from('pool_games')
      .insert({
        pool_id: sug.pool_id,
        company_id: sug.company_id,
        lottery_type: sugLottery,
        game_mode: sugNums.length > minNumbers ? 'DESDOBRAMENTO' : 'SIMPLES',
        numbers: sugNums,
        dozens_count: sugNums.length,
        equivalent_simple_bets: Math.max(1, Number(equivalentSimpleBets) || 1),
        cost: Math.max(0, Number(cost) || 5.0),
        loterica_receipt_code: `VOLANTE-${suggestionId.slice(0, 8).toUpperCase()}-CX`,
        author_user_id: sug.author_user_id,
        author_name: sug.user_name,
        author_avatar: sug.user_avatar || 'US',
      })
      .select('*')
      .single();

    if (gameErr || !newGame) throw new Error(gameErr?.message || 'Erro ao aprovar jogo.');

    await sb
      .from('pool_suggestions')
      .update({ approved_as_official_game: true, approved_game_id: newGame.id })
      .eq('id', suggestionId);

    await sb.from('audit_logs').insert({
      company_id: sug.company_id,
      pool_id: sug.pool_id,
      actor_user_id: isUuid(actorId) ? actorId : null,
      action_type: 'GAME_REGISTERED',
      actor_name: 'Organizador do Bolão',
      description: `Jogo elaborado por ${sug.user_name} aprovado como volante oficial (${newGame.loterica_receipt_code}). Dezenas bloqueadas.`,
      integrity_hash: createHash(newGame.id),
      amount: Number(newGame.cost),
    });
  }

  const state = await fetchFullDatabaseState();
  const suggestion = (state.suggestions || []).find((s) => s.id === suggestionId)!;
  return { status: 200 as const, suggestion, state };
}

export async function updateSettingsSupabase(body: any) {
  const sb = getSupabaseAdmin();
  const { data: current } = await sb
    .from('platform_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();

  const nextFee = Number(body.defaultPlatformFeePercent ?? current?.default_platform_fee_percent ?? 3.5);
  const patch = {
    default_platform_fee_percent: nextFee,
    platform_asaas_wallet_id: body.platformAsaasWalletId ?? current?.platform_asaas_wallet_id ?? '',
    asaas_environment: body.asaasEnvironment ?? current?.asaas_environment ?? 'SANDBOX',
    asaas_webhook_active:
      body.asaasWebhookActive !== undefined
        ? Boolean(body.asaasWebhookActive)
        : Boolean(current?.asaas_webhook_active),
    master_organizer_name: body.masterOrganizerName ?? current?.master_organizer_name ?? 'Administrador',
  };

  const { error } = await sb.from('platform_settings').update(patch).eq('id', true);
  if (error) throw new Error(error.message);

  if (body.applyFeeToAllPools) {
    await sb.from('pools').update({ platform_fee_percent: nextFee }).not('id', 'is', null);
  }

  await sb.from('audit_logs').insert({
    action_type: 'SETTINGS_UPDATED',
    actor_name: patch.master_organizer_name,
    description: `Configurações globais de Split Asaas atualizadas. Taxa administrativa padrão: ${nextFee}%.`,
    integrity_hash: createHash(JSON.stringify(patch)),
  });

  const state = await fetchFullDatabaseState();
  return { status: 200 as const, settings: state.settings, state };
}

export async function cacheLotteryResultSupabase(stats: LotteryStatsResponse): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const latest = stats.latestContest || stats.recentContests?.[0];
    if (!latest?.contestNumber) return;
    const sb = getSupabaseAdmin();
    await sb.from('lottery_results_cache').upsert(
      {
        lottery_type: stats.lotteryType,
        contest_number: String(latest.contestNumber),
        draw_date: String(latest.drawDate || ''),
        drawn_numbers: (latest.drawnNumbers || []).map(Number),
        accumulated: Boolean(latest.accumulated),
        next_contest_number: stats.nextContest?.contestNumber || null,
        next_draw_date: stats.nextContest?.drawDate || null,
        next_estimated_prize: stats.nextContest?.estimatedPrize ?? null,
        special_accumulated_prize: stats.specialAccumulatedPrize ?? null,
        source: stats.source || 'API Oficial Loterias Caixa',
        raw_payload: stats,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'lottery_type,contest_number' }
    );
  } catch {
    // non-fatal cache write
  }
}

export async function deletePoolOwnedSupabase(poolId: string, email: string, password: string) {
  if (!isUuid(poolId)) return { status: 404 as const, error: 'Bolão não encontrado.' };
  if (!email || !password) {
    return { status: 401 as const, error: 'Credenciais obrigatórias para excluir bolão.' };
  }

  const authClient = getSupabaseAuthClient();
  const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password: String(password),
  });
  if (authErr || !authData.user) {
    return { status: 401 as const, error: 'Credenciais inválidas.' };
  }

  const sb = getSupabaseAdmin();
  const { data: pool } = await sb.from('pools').select('*').eq('id', poolId).maybeSingle();
  if (!pool) return { status: 404 as const, error: 'Bolão não encontrado.' };
  if (pool.creator_user_id !== authData.user.id) {
    return { status: 403 as const, error: 'Somente o criador do bolão pode excluí-lo.' };
  }

  // Clean up Storage logos attached to this pool
  const { data: assets } = await sb
    .from('pool_logo_assets')
    .select('storage_path')
    .eq('pool_id', poolId);
  const paths = (assets || []).map((a: any) => a.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await sb.storage.from('pool-logos').remove(paths);
  }

  await sb.from('audit_logs').delete().eq('pool_id', poolId);
  await sb.from('pools').delete().eq('id', poolId);
  if (pool.company_id) {
    await sb.from('companies').delete().eq('id', pool.company_id);
  }

  const state = await fetchFullDatabaseState();
  return { status: 200 as const, ok: true, state };
}

export async function deleteOwnAccountSupabase(userId: string, password: string) {
  if (!isUuid(userId)) return { status: 404 as const, error: 'Usuário não encontrado.' };
  if (!password) return { status: 401 as const, error: 'Informe sua senha para excluir a conta.' };

  const sb = getSupabaseAdmin();
  const { data: profile } = await sb.from('profiles').select('id, email').eq('id', userId).maybeSingle();
  if (!profile) return { status: 404 as const, error: 'Usuário não encontrado.' };

  const authClient = getSupabaseAuthClient();
  const { error: authErr } = await authClient.auth.signInWithPassword({
    email: profile.email,
    password: String(password),
  });
  if (authErr) return { status: 401 as const, error: 'Senha incorreta.' };

  // Clean up user storage files, pools, companies, audit logs, and auth account
  const { data: assets } = await sb
    .from('pool_logo_assets')
    .select('storage_path')
    .eq('owner_user_id', userId);
  const paths = (assets || []).map((a: any) => a.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await sb.storage.from('pool-logos').remove(paths);
  }

  await sb.from('audit_logs').delete().eq('actor_user_id', userId);
  await sb.from('pools').delete().eq('creator_user_id', userId);
  await sb.from('companies').delete().eq('owner_user_id', userId);
  await sb.auth.admin.deleteUser(userId);

  const state = await fetchFullDatabaseState();
  return { status: 200 as const, ok: true, state };
}

