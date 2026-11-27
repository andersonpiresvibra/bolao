import { getDefaultLotteryStats } from '../src/utils/lotteryMath.ts';
import type { LotteryType } from '../src/types.ts';
import {
  isSupabaseConfigured,
  verifyAuthTokenSupabase,
  fetchFullDatabaseState,
  loginUserSupabase,
  registerOrUpdateUserSupabase,
  recoverPasswordSupabase,
  updateUserSupabase,
  createCompanyAndPoolSupabase,
  updatePoolSupabase,
  registerParticipantSupabase,
  createPixPurchaseSupabase,
  conciliatePixPurchaseSupabase,
  handleAsaasWebhookEventSupabase,
  registerGamesSupabase,
  createSuggestionSupabase,
  suggestionActionSupabase,
  updateSettingsSupabase,
  cacheLotteryResultSupabase,
  deletePoolOwnedSupabase,
  deleteOwnAccountSupabase,
  type AuthenticatedActor,
} from './supabaseRepo.ts';
import {
  verifyAsaasConnection,
  verifyAsaasWebhookToken,
} from './asaasClient.ts';
import {
  getPublicVapidInfo,
  savePushSubscription,
  removePushSubscription,
  sendPushToUser,
} from './pushService.ts';
import { getEnv, getRuntimeKind } from './runtimeEnv.ts';

const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024; // 5MB

const liveLotteryCache = new Map<
  LotteryType,
  { expiresAt: number; payload: ReturnType<typeof getDefaultLotteryStats> }
>();

const SLUG_BY_LOTTERY: Record<LotteryType, string> = {
  MEGA_SENA: 'megasena',
  LOTOFACIL: 'lotofacil',
  QUINA: 'quina',
  LOTOMANIA: 'lotomania',
  TIMEMANIA: 'timemania',
  DUPLA_SENA: 'duplasena',
  DIA_DE_SORTE: 'diadesorte',
  SUPER_SETE: 'supersete',
  MAIS_MILIONARIA: 'maismilionaria',
  LOTECA: 'loteca',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function ensureSupabaseResponse(): Response | null {
  if (!isSupabaseConfigured()) {
    return jsonResponse(
      {
        error:
          'Supabase não configurado no servidor. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
      },
      503
    );
  }
  return null;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function resolveOptionalAuth(request: Request): Promise<AuthenticatedActor | null> {
  const token = extractBearerToken(request);
  if (!token) return null;
  try {
    return await verifyAuthTokenSupabase(token);
  } catch {
    return null;
  }
}

async function requireAuth(
  request: Request
): Promise<{ actor: AuthenticatedActor; errorResponse?: undefined } | { actor?: undefined; errorResponse: Response }> {
  const sbErr = ensureSupabaseResponse();
  if (sbErr) return { errorResponse: sbErr };
  const actor = await resolveOptionalAuth(request);
  if (!actor) {
    return {
      errorResponse: jsonResponse(
        { error: 'Sessão não autenticada ou expirada. Faça login para continuar.' },
        401
      ),
    };
  }
  return { actor };
}

async function readJsonBody(
  request: Request
): Promise<{ body: any; errorResponse?: undefined } | { body?: undefined; errorResponse: Response }> {
  try {
    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const len = Number(contentLengthHeader);
      if (Number.isFinite(len) && len > MAX_JSON_BODY_BYTES) {
        return { errorResponse: jsonResponse({ error: 'Payload excede o limite de 5 MB.' }, 413) };
      }
    }
    const text = await request.text();
    if (text.length > MAX_JSON_BODY_BYTES) {
      return { errorResponse: jsonResponse({ error: 'Payload excede o limite de 5 MB.' }, 413) };
    }
    if (!text.trim()) {
      return { body: {} };
    }
    const parsed = JSON.parse(text);
    return { body: parsed && typeof parsed === 'object' ? parsed : {} };
  } catch {
    return { errorResponse: jsonResponse({ error: 'JSON inválido no corpo da requisição.' }, 400) };
  }
}

function safeDecodeParam(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

async function handleLotteryStats(rawLotteryType: string): Promise<Response> {
  const rawType = String(rawLotteryType || 'MEGA_SENA').toUpperCase();
  const lotteryType: LotteryType =
    rawType in SLUG_BY_LOTTERY ? (rawType as LotteryType) : 'MEGA_SENA';

  const cached = liveLotteryCache.get(lotteryType);
  if (cached && cached.expiresAt > Date.now()) {
    return jsonResponse(cached.payload);
  }

  const baseStats = getDefaultLotteryStats(lotteryType);
  const apiSlug = SLUG_BY_LOTTERY[lotteryType];

  const fetchJsonWithTimeout = async (url: string, ms: number): Promise<any | null> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  };

  try {
    let rawData = await fetchJsonWithTimeout(
      `https://servicebus2.caixa.gov.br/portaldeloterias/api/${apiSlug}`,
      4000
    );
    const usedOfficialCaixa = Boolean(rawData && (rawData.numero || rawData.concurso));

    if (!usedOfficialCaixa) {
      rawData = await fetchJsonWithTimeout(
        `https://loteriascaixa-api.herokuapp.com/api/${apiSlug}/latest`,
        4000
      );
    }

    if (rawData && (rawData.numero || rawData.concurso)) {
      const contestNumRaw = rawData.numero ?? rawData.concurso;
      const drawDateRaw = rawData.dataApuracao ?? rawData.data;
      const nextContestNumRaw =
        rawData.numeroConcursoProximo ??
        rawData.proximoConcurso ??
        (!isNaN(Number(contestNumRaw)) ? Number(contestNumRaw) + 1 : undefined);
      const nextDrawDateRaw = rawData.dataProximoConcurso;
      const estimatedPrizeRaw = Number(rawData.valorEstimadoProximoConcurso);
      const specialPrizeRaw = Number(rawData.valorAcumuladoConcursoEspecial);
      const rawDezenas = Array.isArray(rawData.listaDezenas)
        ? rawData.listaDezenas
        : Array.isArray(rawData.dezenas)
          ? rawData.dezenas
          : [];

      baseStats.source = usedOfficialCaixa
        ? 'API Oficial Loterias Caixa (Tempo Real)'
        : 'Resultados Oficiais dos Sorteios (Tempo Real + Histórico)';
      baseStats.updatedAt = new Date().toISOString();

      baseStats.nextContest = {
        contestNumber: String(nextContestNumRaw || baseStats.nextContest?.contestNumber || ''),
        drawDate: String(nextDrawDateRaw || baseStats.nextContest?.drawDate || ''),
        estimatedPrize:
          !isNaN(estimatedPrizeRaw) && estimatedPrizeRaw > 0
            ? estimatedPrizeRaw
            : baseStats.nextContest?.estimatedPrize || 0,
      };

      if (!isNaN(specialPrizeRaw) && specialPrizeRaw > 0) {
        baseStats.specialAccumulatedPrize = specialPrizeRaw;
      }

      const liveNumbers = rawDezenas
        .map((d: any) => Number(d))
        .filter((n: number) => !isNaN(n))
        .sort((a: number, b: number) => a - b);

      if (liveNumbers.length > 0) {
        const latestContestObj = {
          contestNumber: String(contestNumRaw || baseStats.latestContest.contestNumber),
          drawDate: String(drawDateRaw || baseStats.latestContest.drawDate),
          drawnNumbers: liveNumbers,
          accumulated: Boolean(rawData.acumulado ?? rawData.acumulou),
        };
        baseStats.latestContest = latestContestObj;

        const latestNum = Number(contestNumRaw);
        const recentList: typeof baseStats.recentContests = [latestContestObj];
        if (!isNaN(latestNum) && latestNum > 4) {
          try {
            const prevPromises = [
              latestNum - 1,
              latestNum - 2,
              latestNum - 3,
              latestNum - 4,
            ].map(async (cNum) => {
              const safeNum = Math.trunc(cNum);
              const pData =
                (await fetchJsonWithTimeout(
                  `https://servicebus2.caixa.gov.br/portaldeloterias/api/${apiSlug}/${safeNum}`,
                  2200
                )) ||
                (await fetchJsonWithTimeout(
                  `https://loteriascaixa-api.herokuapp.com/api/${apiSlug}/${safeNum}`,
                  2200
                ));
              const pDezenas = pData
                ? Array.isArray(pData.listaDezenas)
                  ? pData.listaDezenas
                  : Array.isArray(pData.dezenas)
                    ? pData.dezenas
                    : null
                : null;
              if (pData && pDezenas) {
                return {
                  contestNumber: String(pData.numero ?? pData.concurso ?? safeNum),
                  drawDate: String(pData.dataApuracao ?? pData.data ?? ''),
                  drawnNumbers: pDezenas
                    .map((d: any) => Number(d))
                    .filter((n: number) => !isNaN(n))
                    .sort((a: number, b: number) => a - b),
                  accumulated: Boolean(pData.acumulado ?? pData.acumulou),
                };
              }
              return null;
            });
            const prevResults = await Promise.all(prevPromises);
            prevResults.forEach((pr) => {
              if (pr && pr.drawnNumbers.length > 0) recentList.push(pr);
            });
          } catch {
            // Keep remaining slots from base stats
          }
        }

        while (recentList.length < 5) {
          const fallbackItem = baseStats.recentContests[recentList.length];
          if (fallbackItem) recentList.push(fallbackItem);
          else break;
        }
        baseStats.recentContests = recentList.slice(0, 5);

        const firstSeenDelay = new Map<number, number>();
        baseStats.recentContests.forEach((c, idx) => {
          c.drawnNumbers.forEach((num) => {
            if (!firstSeenDelay.has(num)) {
              firstSeenDelay.set(num, idx);
            }
          });
        });

        const liveSet = new Set(liveNumbers);
        baseStats.allFrequencies = baseStats.allFrequencies.map((item) => {
          const exactRecentDelay = firstSeenDelay.get(item.number);
          const nextCount = liveSet.has(item.number) ? item.drawnCount + 1 : item.drawnCount;
          const nextDelay =
            exactRecentDelay !== undefined
              ? exactRecentDelay
              : Math.max(item.delayConcursos, baseStats.recentContests.length);
          return {
            ...item,
            drawnCount: nextCount,
            delayConcursos: nextDelay,
          };
        });

        const sortedDesc = [...baseStats.allFrequencies].sort(
          (a, b) => b.drawnCount - a.drawnCount || a.number - b.number
        );
        const sortedAsc = [...baseStats.allFrequencies].sort(
          (a, b) => a.drawnCount - b.drawnCount || b.delayConcursos - a.delayConcursos
        );
        baseStats.hotNumbers = sortedDesc
          .slice(0, 12)
          .map((i) => ({ ...i, temperature: 'HOT' }));
        baseStats.coldNumbers = sortedAsc
          .slice(0, 12)
          .map((i) => ({ ...i, temperature: 'COLD' }));
      }

      liveLotteryCache.set(lotteryType, {
        expiresAt: Date.now() + 5 * 60 * 1000,
        payload: baseStats,
      });
      if (isSupabaseConfigured()) {
        void cacheLotteryResultSupabase(baseStats);
      }
    }
  } catch {
    // Keep statistical structure if Caixa API is unreachable
  }

  return jsonResponse(baseStats);
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  // 0. Health check (boolean readiness flags only — never exposes secret values)
  if (method === 'GET' && pathname === '/api/health') {
    const hasSupabaseUrl = Boolean(getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL'));
    const hasSupabaseServiceRole = Boolean(getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const hasSupabaseAnon = Boolean(getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY'));
    const hasAsaasKey = Boolean(getEnv('ASAAS_API_KEY'));
    const hasAsaasUrl = Boolean(getEnv('ASAAS_API_URL'));
    const hasPlatformWallet = Boolean(getEnv('ASAAS_PLATFORM_WALLET_ID'));
    const hasWebhookToken = Boolean(getEnv('ASAAS_WEBHOOK_TOKEN'));
    const hasVapidPub = Boolean(getEnv('VAPID_PUBLIC_KEY'));
    const hasVapidPriv = Boolean(getEnv('VAPID_PRIVATE_KEY'));

    return jsonResponse({
      status: 'ok',
      runtime: getRuntimeKind(),
      database: isSupabaseConfigured() ? 'supabase' : 'unconfigured',
      supabase: {
        url: hasSupabaseUrl,
        serviceRoleKey: hasSupabaseServiceRole,
        anonKey: hasSupabaseAnon,
      },
      asaas: {
        apiKey: hasAsaasKey,
        apiUrl: hasAsaasUrl,
        platformWalletId: hasPlatformWallet,
        webhookToken: hasWebhookToken,
      },
      push: {
        vapidPersistent: Boolean(hasVapidPub && hasVapidPriv),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // 0b. Asaas connection verification
  if (method === 'GET' && pathname === '/api/asaas/verify') {
    try {
      const result = await verifyAsaasConnection();
      return jsonResponse(result, result.ok ? 200 : 502);
    } catch (error: any) {
      return jsonResponse(
        { ok: false, error: error?.message || 'Erro ao verificar Asaas.' },
        500
      );
    }
  }

  // 1. Synchronized database state
  if (method === 'GET' && pathname === '/api/state') {
    const sbErr = ensureSupabaseResponse();
    if (sbErr) return sbErr;
    try {
      const viewer = await resolveOptionalAuth(request);
      const state = await fetchFullDatabaseState(viewer);
      return jsonResponse(state);
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao carregar estado do Supabase.' },
        500
      );
    }
  }

  // 1.0 Lottery stats
  if (method === 'GET' && pathname.startsWith('/api/lottery-stats/')) {
    const rawParam = pathname.slice('/api/lottery-stats/'.length);
    const decoded = safeDecodeParam(rawParam);
    if (!decoded) return jsonResponse({ error: 'Parâmetro inválido.' }, 400);
    return handleLotteryStats(decoded);
  }

  // 1a. Login
  if (method === 'POST' && pathname === '/api/auth/login') {
    const sbErr = ensureSupabaseResponse();
    if (sbErr) return sbErr;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const { identifier, password } = body;
      if (!identifier || !password) {
        return jsonResponse(
          { error: 'Informe seu CPF/E-mail e sua senha para entrar.' },
          400
        );
      }
      const result = await loginUserSupabase(identifier, password);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({
        accessToken: result.accessToken,
        user: result.user,
        state: result.state,
      });
    } catch (error: any) {
      return jsonResponse({ error: error?.message || 'Erro ao autenticar.' }, 500);
    }
  }

  // 1b. Registration
  if (method === 'POST' && pathname === '/api/auth/register-login') {
    const sbErr = ensureSupabaseResponse();
    if (sbErr) return sbErr;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const { name, whatsapp, cpf, email, pixKey, password } = body;
      if (!name || !whatsapp || !cpf || !email || !pixKey || !password) {
        return jsonResponse(
          {
            error:
              'Preencha os campos obrigatórios: Nome, Senha, WhatsApp, CPF, E-mail e Chave Pix.',
          },
          400
        );
      }
      const result = await registerOrUpdateUserSupabase(body);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({
        accessToken: result.accessToken,
        user: result.user,
        state: result.state,
      });
    } catch (error: any) {
      return jsonResponse({ error: error?.message || 'Erro ao realizar cadastro.' }, 500);
    }
  }

  // 1c. Password recovery
  if (method === 'POST' && pathname === '/api/auth/recover-password') {
    const sbErr = ensureSupabaseResponse();
    if (sbErr) return sbErr;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const { email, cpf, whatsapp, newPassword } = body;
      if (!email || !cpf || !whatsapp || !newPassword) {
        return jsonResponse(
          {
            error:
              'Informe seu E-mail, CPF completo, WhatsApp cadastrados e a nova senha.',
          },
          400
        );
      }
      const result = await recoverPasswordSupabase({ email, cpf, whatsapp, newPassword });
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({ ok: true, message: result.message });
    } catch (error: any) {
      return jsonResponse({ error: error?.message || 'Erro ao recuperar senha.' }, 500);
    }
  }

  // 1d / 10. Users PUT & DELETE (/api/users/:userId)
  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch) {
    const userId = safeDecodeParam(userMatch[1]);
    if (!userId) return jsonResponse({ error: 'ID de usuário inválido.' }, 400);

    if (method === 'PUT') {
      const auth = await requireAuth(request);
      if (auth.errorResponse) return auth.errorResponse;
      const { body, errorResponse } = await readJsonBody(request);
      if (errorResponse) return errorResponse;
      try {
        const result = await updateUserSupabase(userId, body, auth.actor);
        if (result.status !== 200) {
          return jsonResponse({ error: result.error }, result.status);
        }
        return jsonResponse({ user: result.user, state: result.state });
      } catch (error: any) {
        return jsonResponse(
          { error: error?.message || 'Erro ao atualizar perfil do usuário.' },
          500
        );
      }
    }

    if (method === 'DELETE') {
      const auth = await requireAuth(request);
      if (auth.errorResponse) return auth.errorResponse;
      const { body, errorResponse } = await readJsonBody(request);
      if (errorResponse) return errorResponse;
      try {
        const { password } = body || {};
        const result = await deleteOwnAccountSupabase(userId, password, auth.actor);
        if (result.status !== 200) {
          return jsonResponse({ error: result.error }, result.status);
        }
        return jsonResponse({ ok: true, state: result.state });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Erro ao excluir conta.' }, 500);
      }
    }
  }

  // 2. Create company + initial pool
  if (method === 'POST' && pathname === '/api/companies') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const result = await createCompanyAndPoolSupabase(body, auth.actor);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({
        company: result.company,
        pool: result.pool,
        state: result.state,
      });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao cadastrar grupo de bolão.' },
        500
      );
    }
  }

  // 3 / 9. Pools PUT & DELETE (/api/pools/:poolId)
  const poolMatch = pathname.match(/^\/api\/pools\/([^/]+)$/);
  if (poolMatch) {
    const poolId = safeDecodeParam(poolMatch[1]);
    if (!poolId) return jsonResponse({ error: 'ID de bolão inválido.' }, 400);

    if (method === 'PUT') {
      const auth = await requireAuth(request);
      if (auth.errorResponse) return auth.errorResponse;
      const { body, errorResponse } = await readJsonBody(request);
      if (errorResponse) return errorResponse;
      try {
        const result = await updatePoolSupabase(poolId, body, auth.actor);
        if (result.status !== 200) {
          return jsonResponse({ error: result.error }, result.status);
        }
        return jsonResponse({ pool: result.pool, state: result.state });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Erro ao atualizar bolão.' }, 500);
      }
    }

    if (method === 'DELETE') {
      const auth = await requireAuth(request);
      if (auth.errorResponse) return auth.errorResponse;
      const { body, errorResponse } = await readJsonBody(request);
      if (errorResponse) return errorResponse;
      try {
        const { email, password } = body || {};
        const result = await deletePoolOwnedSupabase(poolId, email, password, auth.actor);
        if (result.status !== 200) {
          return jsonResponse({ error: result.error }, result.status);
        }
        return jsonResponse({ ok: true, state: result.state });
      } catch (error: any) {
        return jsonResponse({ error: error?.message || 'Erro ao excluir bolão.' }, 500);
      }
    }
  }

  // 4. Register participant
  if (method === 'POST' && pathname === '/api/participants') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const result = await registerParticipantSupabase(body, auth.actor);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({ participant: result.participant, state: result.state });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao cadastrar participante.' },
        500
      );
    }
  }

  // 5. Create Asaas Pix Charge with automatic Split
  if (method === 'POST' && pathname === '/api/payments/pix') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const result = await createPixPurchaseSupabase(body, auth.actor);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({
        purchase: result.purchase,
        asaasSplitPayload: result.asaasSplitPayload,
        state: result.state,
      });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao gerar cobrança Pix com Split.' },
        500
      );
    }
  }

  // 6. Manual Organizer Reconciliation for Pending Pix
  if (method === 'POST' && pathname === '/api/webhooks/asaas-conciliate') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const { purchaseId } = body;
      const result = await conciliatePixPurchaseSupabase(purchaseId, auth.actor);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({ purchase: result.purchase, state: result.state });
    } catch (error: any) {
      return jsonResponse({ error: error?.message || 'Erro ao conciliar Pix.' }, 500);
    }
  }

  // 6b. Official Asaas Webhook Receiver (constant-time token verification)
  if (method === 'POST' && pathname === '/api/webhooks/asaas') {
    const sbErr = ensureSupabaseResponse();
    if (sbErr) return sbErr;
    if (!getEnv('ASAAS_WEBHOOK_TOKEN')) {
      return jsonResponse({ error: 'ASAAS_WEBHOOK_TOKEN não configurado.' }, 503);
    }
    const receivedToken = request.headers.get('asaas-access-token') || undefined;
    if (!verifyAsaasWebhookToken(receivedToken)) {
      return jsonResponse({ error: 'Token de autenticação do Webhook inválido.' }, 401);
    }
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const eventName = typeof body?.event === 'string' ? body.event : '';
      const payment =
        body?.payment && typeof body.payment === 'object' ? body.payment : undefined;
      const outcome = await handleAsaasWebhookEventSupabase(eventName, payment);
      return jsonResponse({ received: true, ...outcome }, 200);
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao processar webhook Asaas.' },
        500
      );
    }
  }

  // 7. Register lottery games
  if (method === 'POST' && pathname === '/api/games') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const result = await registerGamesSupabase(body, auth.actor);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({ games: result.games, state: result.state });
    } catch (error: any) {
      return jsonResponse({ error: error?.message || 'Erro ao registrar jogos.' }, 500);
    }
  }

  // 7b. Create player suggestion
  if (method === 'POST' && pathname === '/api/suggestions') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const result = await createSuggestionSupabase(body, auth.actor);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({ suggestion: result.suggestion, state: result.state });
    } catch (error: any) {
      return jsonResponse({ error: error?.message || 'Erro ao salvar palpite.' }, 500);
    }
  }

  // 7c. Suggestion action (/api/suggestions/:suggestionId/action)
  const suggestionActionMatch = pathname.match(/^\/api\/suggestions\/([^/]+)\/action$/);
  if (method === 'POST' && suggestionActionMatch) {
    const suggestionId = safeDecodeParam(suggestionActionMatch[1]);
    if (!suggestionId) return jsonResponse({ error: 'ID de palpite inválido.' }, 400);
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const result = await suggestionActionSupabase(suggestionId, body, auth.actor);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({
        alreadyVoted: result.alreadyVoted,
        suggestion: result.suggestion,
        state: result.state,
      });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao processar ação no palpite.' },
        500
      );
    }
  }

  // 8. Global settings (SUPER_ADMIN only)
  if (method === 'PUT' && pathname === '/api/settings') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const result = await updateSettingsSupabase(body, auth.actor);
      if (result.status !== 200) {
        return jsonResponse({ error: result.error }, result.status);
      }
      return jsonResponse({ settings: result.settings, state: result.state });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao atualizar configurações.' },
        500
      );
    }
  }

  // 11. Web Push endpoints
  if (method === 'GET' && pathname === '/api/push/vapid-public-key') {
    try {
      const info = getPublicVapidInfo();
      return jsonResponse(info);
    } catch (error: any) {
      return jsonResponse({ error: error?.message || 'Erro ao obter chave Push.' }, 500);
    }
  }

  if (method === 'POST' && pathname === '/api/push/subscribe') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      const result = await savePushSubscription(
        auth.actor.id,
        body?.subscription,
        request.headers.get('user-agent') || ''
      );
      if (!result.ok) {
        return jsonResponse({ error: result.error || 'Inscrição inválida.' }, 400);
      }
      return jsonResponse({ ok: true });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao salvar inscrição Push.' },
        500
      );
    }
  }

  if (method === 'POST' && pathname === '/api/push/unsubscribe') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { body, errorResponse } = await readJsonBody(request);
    if (errorResponse) return errorResponse;
    try {
      await removePushSubscription(auth.actor.id, body?.endpoint);
      return jsonResponse({ ok: true });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao remover inscrição Push.' },
        500
      );
    }
  }

  if (method === 'POST' && pathname === '/api/push/test') {
    const auth = await requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    try {
      const result = await sendPushToUser(auth.actor.id, {
        title: 'Bolão & Loterias — Notificações Ativas',
        body: `Olá ${auth.actor.name}! Você receberá avisos em segundo plano sobre Pix e resultados.`,
        url: '/',
        tag: 'bolao-test-push',
      });
      if (result.sent === 0) {
        return jsonResponse(
          {
            error:
              'Nenhum dispositivo ativo encontrado. Ative as notificações Push primeiro.',
          },
          400
        );
      }
      return jsonResponse({
        ok: true,
        sent: result.sent,
        message:
          'Notificação Push enviada! Verifique a barra de notificações do seu dispositivo.',
      });
    } catch (error: any) {
      return jsonResponse(
        { error: error?.message || 'Erro ao enviar Push de teste.' },
        500
      );
    }
  }

  return jsonResponse({ error: 'Rota de API não encontrada.' }, 404);
}
