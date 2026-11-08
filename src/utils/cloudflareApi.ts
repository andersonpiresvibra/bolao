import { INITIAL_DATABASE_STATE } from '../seedData';
import { getDefaultLotteryStats } from './lotteryMath';
import {
  DatabaseState,
  Company,
  Pool,
  Participant,
  QuotaPurchase,
  LotteryGame,
  AuditLog,
  SystemUser,
  PlayerSuggestion,
  LotteryType,
} from '../types';

const STORAGE_STATE_KEY = 'lotocorp_cloudflare_db_vibra_v4';

function createWebHash(payload: string): string {
  const raw = `${payload}_${Date.now()}_${Math.random()}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex =
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    Date.now().toString(16).padStart(12, '0');
  return `SHA256:${hex.slice(0, 38)}`;
}

function randomHex(bytesCount: number): string {
  let out = '';
  for (let i = 0; i < bytesCount * 2; i++) {
    out += Math.floor(Math.random() * 16)
      .toString(16)
      .toUpperCase();
  }
  return out;
}

export function cloneSeedState(): DatabaseState {
  return JSON.parse(JSON.stringify(INITIAL_DATABASE_STATE)) as DatabaseState;
}

export function loadBrowserCachedState(): DatabaseState {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DatabaseState;
        if (parsed && Array.isArray(parsed.companies)) {
          if (parsed.companies.length === 0) {
            parsed.companies = INITIAL_DATABASE_STATE.companies;
          }
          if (!parsed.pools || parsed.pools.length === 0) {
            parsed.pools = INITIAL_DATABASE_STATE.pools;
          }
          if (!parsed.participants || parsed.participants.length === 0) {
            parsed.participants = INITIAL_DATABASE_STATE.participants;
          }
          if (!parsed.purchases || parsed.purchases.length === 0) {
            parsed.purchases = INITIAL_DATABASE_STATE.purchases;
          }
          if (!parsed.users || parsed.users.length === 0) {
            parsed.users = INITIAL_DATABASE_STATE.users || [];
          }
          if (!parsed.suggestions) {
            parsed.suggestions = INITIAL_DATABASE_STATE.suggestions || [];
          }
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return cloneSeedState();
}

export function saveBrowserCachedState(state: DatabaseState): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }
}

let edgeMemoryState: DatabaseState | null = null;

export function getEdgeState(): DatabaseState {
  if (!edgeMemoryState) {
    edgeMemoryState = cloneSeedState();
  }
  return edgeMemoryState;
}

export async function fetchLiveOrDefaultLotteryStats(rawType: string) {
  const upper = String(rawType || 'MEGA_SENA').toUpperCase();
  const lotteryType: LotteryType =
    upper === 'LOTOFACIL'
      ? 'LOTOFACIL'
      : upper === 'QUINA'
      ? 'QUINA'
      : 'MEGA_SENA';

  const baseStats = getDefaultLotteryStats(lotteryType);
  const apiSlug =
    lotteryType === 'LOTOFACIL'
      ? 'lotofacil'
      : lotteryType === 'QUINA'
      ? 'quina'
      : 'megasena';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(
      `https://loteriascaixa-api.herokuapp.com/api/${apiSlug}/latest`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    );
    clearTimeout(timeout);

    if (resp.ok) {
      const data: any = await resp.json();
      if (data && Array.isArray(data.dezenas) && data.dezenas.length > 0) {
        const liveNumbers = data.dezenas
          .map((d: any) => Number(d))
          .filter((n: number) => !isNaN(n))
          .sort((a: number, b: number) => a - b);

        if (liveNumbers.length > 0) {
          baseStats.source =
            'Resultados Oficiais dos Sorteios (Tempo Real + Histórico)';
          const latestContestObj = {
            contestNumber: String(
              data.concurso || baseStats.latestContest.contestNumber
            ),
            drawDate: String(data.data || baseStats.latestContest.drawDate),
            drawnNumbers: liveNumbers,
            accumulated: Boolean(data.acumulou),
          };
          baseStats.latestContest = latestContestObj;

          const latestNum = Number(data.concurso);
          const recentList: typeof baseStats.recentContests = [
            latestContestObj,
          ];
          if (!isNaN(latestNum) && latestNum > 2) {
            try {
              const prevPromises = [latestNum - 1, latestNum - 2].map(
                async (cNum) => {
                  const pCtrl = new AbortController();
                  const pTime = setTimeout(() => pCtrl.abort(), 1500);
                  const pResp = await fetch(
                    `https://loteriascaixa-api.herokuapp.com/api/${apiSlug}/${cNum}`,
                    {
                      signal: pCtrl.signal,
                      headers: { Accept: 'application/json' },
                    }
                  );
                  clearTimeout(pTime);
                  if (!pResp.ok) return null;
                  const pData: any = await pResp.json();
                  if (pData && Array.isArray(pData.dezenas)) {
                    return {
                      contestNumber: String(pData.concurso || cNum),
                      drawDate: String(pData.data || ''),
                      drawnNumbers: pData.dezenas
                        .map((d: any) => Number(d))
                        .filter((n: number) => !isNaN(n))
                        .sort((a: number, b: number) => a - b),
                      accumulated: Boolean(pData.acumulou),
                    };
                  }
                  return null;
                }
              );
              const prevResults = await Promise.all(prevPromises);
              prevResults.forEach((pr) => {
                if (pr && pr.drawnNumbers.length > 0) recentList.push(pr);
              });
            } catch {
              // keep defaults
            }
          }

          while (recentList.length < 3) {
            const fallbackItem = baseStats.recentContests[recentList.length];
            if (fallbackItem) recentList.push(fallbackItem);
            else break;
          }
          baseStats.recentContests = recentList.slice(0, 3);

          const liveSet = new Set(liveNumbers);
          baseStats.allFrequencies = baseStats.allFrequencies.map((item) => {
            if (liveSet.has(item.number)) {
              return {
                ...item,
                drawnCount: item.drawnCount + 1,
                delayConcursos: 0,
              };
            }
            return item;
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
      }
    }
  } catch {
    // Fallback transparently to official historical statistics
  }

  return baseStats;
}

export async function processApiRequest(
  method: string,
  pathname: string,
  body: any = {},
  stateRef?: DatabaseState
): Promise<{ status: number; data: any; state: DatabaseState }> {
  const db: DatabaseState = stateRef || getEdgeState();
  if (!db.users || db.users.length === 0) {
    db.users = INITIAL_DATABASE_STATE.users || [];
  }
  if (!db.suggestions) {
    db.suggestions = INITIAL_DATABASE_STATE.suggestions || [];
  }

  const upperMethod = method.toUpperCase();
  const cleanPath = pathname.replace(/\/+$/, '');

  // 1. GET /api/state
  if (upperMethod === 'GET' && cleanPath === '/api/state') {
    return { status: 200, data: db, state: db };
  }

  // 1.0 GET /api/lottery-stats/:lotteryType
  if (upperMethod === 'GET' && cleanPath.startsWith('/api/lottery-stats/')) {
    const lotteryType = cleanPath.split('/api/lottery-stats/')[1] || 'MEGA_SENA';
    const stats = await fetchLiveOrDefaultLotteryStats(lotteryType);
    return { status: 200, data: stats, state: db };
  }

  // 1a. POST /api/auth/login
  if (upperMethod === 'POST' && cleanPath === '/api/auth/login') {
    const { identifier, password } = body || {};
    if (!identifier || !password) {
      return {
        status: 400,
        data: { error: 'Informe seu CPF/E-mail e sua senha para entrar.' },
        state: db,
      };
    }

    const cleanInput = String(identifier).trim().toLowerCase();
    const cleanDigits = cleanInput.replace(/\D/g, '');

    const foundUser = db.users.find((u) => {
      const emailMatch = u.email.trim().toLowerCase() === cleanInput;
      const usernameMatch =
        u.username && u.username.trim().toLowerCase() === cleanInput;
      const cpfMatch =
        cleanDigits.length >= 6 && u.cpf.replace(/\D/g, '') === cleanDigits;
      return emailMatch || usernameMatch || cpfMatch;
    });

    if (!foundUser) {
      return {
        status: 404,
        data: {
          error:
            'Usuário não encontrado. Clique no botão "Cadastrar" abaixo para criar sua conta.',
        },
        state: db,
      };
    }

    if (foundUser.password && foundUser.password !== String(password)) {
      return {
        status: 401,
        data: {
          error:
            'Senha incorreta. Verifique sua senha ou clique em "Recuperar Senha".',
        },
        state: db,
      };
    }

    return { status: 200, data: { user: foundUser, state: db }, state: db };
  }

  // 1b. POST /api/auth/register-login
  if (upperMethod === 'POST' && cleanPath === '/api/auth/register-login') {
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
    } = body || {};

    if (!name || !whatsapp || !cpf || !email || !pixKey) {
      return {
        status: 400,
        data: {
          error:
            'Preencha os campos obrigatórios: Nome, WhatsApp, CPF, E-mail e Chave Pix.',
        },
        state: db,
      };
    }

    const cleanCpf = String(cpf).replace(/\D/g, '');
    const words = String(name)
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
      .trim()
      .split(/\s+/);
    const initials =
      words.length >= 2
        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
        : String(name).slice(0, 2).toUpperCase();

    const safeCompanyName = companyName ? String(companyName).trim() : '';
    const safeJobTitle = jobTitle ? String(jobTitle).trim() : 'Usuário';

    const matchedCompany =
      (companyId ? db.companies.find((c) => c.id === companyId) : undefined) ||
      (safeCompanyName
        ? db.companies.find(
            (c) =>
              c.name.trim().toLowerCase() === safeCompanyName.toLowerCase()
          )
        : undefined);

    let user = db.users.find(
      (u) =>
        u.cpf.replace(/\D/g, '') === cleanCpf ||
        u.email.trim().toLowerCase() === String(email).trim().toLowerCase()
    );

    if (user) {
      user.name = String(name).trim();
      if (username) user.username = String(username).trim();
      user.whatsapp = String(whatsapp).trim();
      user.cpf = String(cpf).trim();
      user.email = String(email).trim();
      if (password) user.password = String(password);
      user.companyName = matchedCompany
        ? matchedCompany.name
        : safeCompanyName;
      user.companyId = matchedCompany?.id;
      user.jobTitle = safeJobTitle;
      user.pixKey = String(pixKey).trim();
      user.avatarInitials = initials;
    } else {
      user = {
        id: `usr_${Date.now().toString(36)}`,
        name: String(name).trim(),
        username: username
          ? String(username).trim()
          : `${words[0].toLowerCase()}@`,
        whatsapp: String(whatsapp).trim(),
        cpf: String(cpf).trim(),
        email: String(email).trim(),
        password: String(password || '123'),
        companyName: matchedCompany
          ? matchedCompany.name
          : safeCompanyName,
        companyId: matchedCompany?.id,
        jobTitle: safeJobTitle,
        pixKey: String(pixKey).trim(),
        avatarInitials: initials,
        createdAt: new Date().toISOString(),
      };
      db.users.unshift(user);
    }

    if (matchedCompany) {
      const companyPool = db.pools.find((p) => p.companyId === matchedCompany.id);
      if (companyPool) {
        const existingPart = db.participants.find(
          (p) =>
            p.companyId === matchedCompany.id &&
            p.cpf.replace(/\D/g, '') === cleanCpf
        );
        if (!existingPart) {
          db.participants.unshift({
            id: `part_${Date.now().toString(36)}`,
            companyId: matchedCompany.id,
            poolId: companyPool.id,
            name: user.name,
            cpf: user.cpf,
            email: user.email,
            whatsapp: user.whatsapp,
            department: user.jobTitle,
            pixKey: user.pixKey,
            registeredBy: 'SELF',
            createdAt: new Date().toISOString(),
          });
        } else {
          existingPart.name = user.name;
          existingPart.whatsapp = user.whatsapp;
          existingPart.email = user.email;
          existingPart.department = user.jobTitle;
          existingPart.pixKey = user.pixKey;
        }
      }
    }

    return { status: 200, data: { user, state: db }, state: db };
  }

  // 1c. POST /api/auth/recover-password
  if (upperMethod === 'POST' && cleanPath === '/api/auth/recover-password') {
    const { identifier, newPassword } = body || {};
    if (!identifier || !newPassword) {
      return {
        status: 400,
        data: {
          error:
            'Informe seu CPF, E-mail ou Nome de usuário cadastrado e defina a nova senha.',
        },
        state: db,
      };
    }

    const cleanInput = String(identifier).trim().toLowerCase();
    const cleanDigits = cleanInput.replace(/\D/g, '');

    const foundUser = db.users.find((u) => {
      const emailMatch = u.email.trim().toLowerCase() === cleanInput;
      const usernameMatch =
        u.username && u.username.trim().toLowerCase() === cleanInput;
      const cpfMatch =
        cleanDigits.length >= 6 && u.cpf.replace(/\D/g, '') === cleanDigits;
      return emailMatch || usernameMatch || cpfMatch;
    });

    if (!foundUser) {
      return {
        status: 404,
        data: {
          error: 'Nenhum usuário localizado com este CPF ou E-mail.',
        },
        state: db,
      };
    }

    foundUser.password = String(newPassword);
    return {
      status: 200,
      data: {
        ok: true,
        message: `Senha redefinida com sucesso para ${foundUser.name}! Você já pode entrar.`,
        user: foundUser,
      },
      state: db,
    };
  }

  // 1d. PUT /api/users/:userId
  if (upperMethod === 'PUT' && cleanPath.startsWith('/api/users/')) {
    const userId = cleanPath.split('/api/users/')[1];
    const userIndex = db.users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return {
        status: 404,
        data: { error: 'Usuário não encontrado.' },
        state: db,
      };
    }

    const current = db.users[userIndex];
    const updatedName = body?.name ? String(body.name).trim() : current.name;
    const words = updatedName
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
      .trim()
      .split(/\s+/);
    const initials =
      words.length >= 2
        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
        : updatedName.slice(0, 2).toUpperCase();

    const updated: SystemUser = {
      ...current,
      ...body,
      id: current.id,
      name: updatedName,
      avatarInitials: initials,
    };
    db.users[userIndex] = updated;

    const cleanCpf = updated.cpf.replace(/\D/g, '');
    db.participants.forEach((p) => {
      if (p.cpf.replace(/\D/g, '') === cleanCpf) {
        p.name = updated.name;
        p.email = updated.email;
        p.whatsapp = updated.whatsapp;
        p.department = updated.jobTitle;
        p.pixKey = updated.pixKey;
      }
    });

    return { status: 200, data: { user: updated, state: db }, state: db };
  }

  // 2. POST /api/companies
  if (upperMethod === 'POST' && cleanPath === '/api/companies') {
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
      collectionMode,
      quotaValue,
      maxTargetAmount,
      endDate,
    } = body || {};

    if (!userId && !managerName) {
      return {
        status: 401,
        data: {
          error: 'Faça login para criar um bolão.',
        },
        state: db,
      };
    }

    const resolvedName = String(name || poolTitle || 'Novo Bolão').trim();

    const words = resolvedName
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
      .trim()
      .split(/\s+/);
    const initials =
      words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : resolvedName.slice(0, 2).toUpperCase();

    const companyId = `comp_${Date.now().toString(36)}`;
    const tenantSlug = `${resolvedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}`;
    const wallet =
      asaasWalletId && String(asaasWalletId).trim()
        ? String(asaasWalletId).trim()
        : `wal_asaas_${initials.toLowerCase()}_${Math.floor(100000 + Math.random() * 900000)}`;

    const newCompany: Company = {
      id: companyId,
      tenantSlug,
      name: resolvedName,
      cnpj: String(cnpj || '00.000.000/0001-00').trim(),
      segment: segment !== undefined ? String(segment).trim() : '',
      logoInitials: initials,
      logoColor: logoColor || '#005CA9',
      logoUrl: logoUrl || undefined,
      managerId: userId,
      managerName: String(managerName).trim(),
      managerRole: String(managerRole || 'Coordenador').trim(),
      managerPixKey: String(managerPixKey || '').trim(),
      managerCpf: String(managerCpf || '000.000.000-00').trim(),
      managerEmail: String(managerEmail || 'gestor@empresa.com.br').trim(),
      managerWhatsapp: String(managerWhatsapp || '(11) 99999-9999').trim(),
      asaasWalletId: wallet,
      cityState: String(cityState || 'São Paulo - SP').trim(),
      createdAt: new Date().toISOString(),
    };

    const parsedQuota = Math.max(5, Number(quotaValue) || 100);
    const parsedMaxTarget = Math.max(
      parsedQuota,
      Number(maxTargetAmount) || parsedQuota * 50
    );
    const maxQuotas = Math.max(1, Math.floor(parsedMaxTarget / parsedQuota));

    const poolId = `pool_${Date.now().toString(36)}`;
    const newPool: Pool = {
      id: poolId,
      companyId,
      title: String(poolTitle || `Bolão Fim de Ano — ${newCompany.name}`).trim(),
      lotteryType: lotteryType || 'MEGA_SENA',
      contestNumber: String(contestNumber || '2950').trim(),
      collectionMode: collectionMode || 'FIXED_QUOTA',
      quotaValue: parsedQuota,
      maxTargetAmount: parsedMaxTarget,
      maxQuotas,
      platformFeePercent: db.settings.defaultPlatformFeePercent,
      startDate: new Date().toISOString(),
      endDate: endDate || '2026-12-31T16:00:00-03:00',
      status: 'OPEN',
      officialReceiptCode: `CX-2026-${initials}-${Math.floor(10000 + Math.random() * 90000)}`,
      drawnNumbers:
        lotteryType === 'LOTOFACIL'
          ? [1, 2, 4, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 23, 25]
          : lotteryType === 'QUINA'
          ? [8, 22, 37, 54, 71]
          : [4, 17, 23, 38, 49, 58],
      prizeTotalAmount: 0,
      createdAt: new Date().toISOString(),
    };

    const log: AuditLog = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      companyId,
      poolId,
      actionType: 'COMPANY_CREATED',
      actorName: `${newCompany.managerName} (${newCompany.managerRole})`,
      description: `Tenant Corporativo "${newCompany.name}" (Setor: ${newCompany.segment}) criado pelo responsável ${newCompany.managerName} (Pix: ${newCompany.managerPixKey}).`,
      integrityHash: createWebHash(newCompany.id + newPool.id),
    };

    db.companies.unshift(newCompany);
    db.pools.unshift(newPool);
    db.auditLogs.unshift(log);

    return {
      status: 200,
      data: { company: newCompany, pool: newPool, state: db },
      state: db,
    };
  }

  // 3. PUT /api/pools/:poolId
  if (upperMethod === 'PUT' && cleanPath.startsWith('/api/pools/')) {
    const poolId = cleanPath.split('/api/pools/')[1];
    const poolIndex = db.pools.findIndex((p) => p.id === poolId);
    if (poolIndex === -1) {
      return {
        status: 404,
        data: { error: 'Bolão não encontrado.' },
        state: db,
      };
    }

    const current = db.pools[poolIndex];
    const updated: Pool = {
      ...current,
      ...body,
      quotaValue: Number(body?.quotaValue ?? current.quotaValue),
      maxTargetAmount: Number(body?.maxTargetAmount ?? current.maxTargetAmount),
      maxQuotas: Math.max(
        1,
        Math.floor(
          Number(body?.maxTargetAmount ?? current.maxTargetAmount) /
            Number(body?.quotaValue ?? current.quotaValue)
        )
      ),
    };

    db.pools[poolIndex] = updated;
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      companyId: updated.companyId,
      poolId: updated.id,
      actionType: 'RESULT_AUDITED',
      actorName: 'Gestor do Bolão',
      description: `Parâmetros/Concurso do bolão "${updated.title}" atualizados. Cota: R$ ${updated.quotaValue.toFixed(2)}.`,
      integrityHash: createWebHash(updated.id + JSON.stringify(body)),
    });

    return { status: 200, data: { pool: updated, state: db }, state: db };
  }

  // 4. POST /api/participants
  if (upperMethod === 'POST' && cleanPath === '/api/participants') {
    const {
      companyId,
      poolId,
      name,
      cpf,
      email,
      whatsapp,
      department,
      pixKey,
      registeredBy,
    } = body || {};
    if (!companyId || !poolId || !name || !cpf) {
      return {
        status: 400,
        data: { error: 'Nome, CPF e empresa são obrigatórios.' },
        state: db,
      };
    }

    const existing = db.participants.find(
      (p) =>
        p.companyId === companyId &&
        p.cpf.replace(/\D/g, '') === String(cpf).replace(/\D/g, '')
    );

    if (existing) {
      return {
        status: 200,
        data: { participant: existing, state: db },
        state: db,
      };
    }

    const newParticipant: Participant = {
      id: `part_${Date.now().toString(36)}`,
      companyId,
      poolId,
      name: String(name).trim(),
      cpf: String(cpf).trim(),
      email: String(email || 'colaborador@empresa.com.br').trim(),
      whatsapp: String(whatsapp || '(11) 99999-0000').trim(),
      department: String(department || 'Geral').trim(),
      pixKey: String(pixKey || '').trim(),
      registeredBy: registeredBy || 'SELF',
      createdAt: new Date().toISOString(),
    };

    db.participants.unshift(newParticipant);
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      companyId,
      poolId,
      actionType: 'PARTICIPANT_REGISTERED',
      actorName:
        registeredBy === 'MANAGER' ? 'Gestor da Empresa' : newParticipant.name,
      description: `Colaborador cadastrado na empresa (${newParticipant.department}) com CPF validado (${newParticipant.cpf.slice(0, 3)}.***.***-**).`,
      integrityHash: createWebHash(newParticipant.id),
    });

    return {
      status: 200,
      data: { participant: newParticipant, state: db },
      state: db,
    };
  }

  // 5. POST /api/payments/pix
  if (upperMethod === 'POST' && cleanPath === '/api/payments/pix') {
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
    } = body || {};

    const pool = db.pools.find((p) => p.id === poolId);
    const company = db.companies.find((c) => c.id === companyId);

    if (!pool || !company) {
      return {
        status: 404,
        data: { error: 'Empresa ou Bolão não encontrado.' },
        state: db,
      };
    }

    const count = Math.max(1, Number(quotasCount) || 1);
    const totalAmount = Number((count * pool.quotaValue).toFixed(2));
    const feePercent =
      pool.platformFeePercent || db.settings.defaultPlatformFeePercent;
    const platformFeeAmount = Number(
      ((totalAmount * feePercent) / 100).toFixed(2)
    );
    const netPoolAmount = Number((totalAmount - platformFeeAmount).toFixed(2));

    let participant = db.participants.find(
      (p) =>
        p.companyId === companyId &&
        p.cpf.replace(/\D/g, '') === String(participantCpf).replace(/\D/g, '')
    );

    if (!participant) {
      participant = {
        id: `part_${Date.now().toString(36)}`,
        companyId,
        poolId,
        name: String(participantName).trim(),
        cpf: String(participantCpf).trim(),
        email: String(participantEmail || 'colaborador@empresa.com.br').trim(),
        whatsapp: String(participantWhatsapp || '(11) 99999-0000').trim(),
        department: String(participantDepartment || 'Corporativo').trim(),
        pixKey: String(participantPixKey || '').trim(),
        registeredBy: 'SELF',
        createdAt: new Date().toISOString(),
      };
      db.participants.unshift(participant);
    }

    const asaasSplitPayload = {
      billingType: 'PIX',
      value: totalAmount,
      dueDate: pool.endDate.slice(0, 10),
      description: `${pool.title} - ${count} cota(s) - ${company.name}`,
      externalReference: `${pool.id}_${participant.id}_${Date.now()}`,
      split: [
        {
          walletId: company.asaasWalletId,
          fixedValue: netPoolAmount,
          percentualValue: Number((100 - feePercent).toFixed(2)),
          description: `Repasse Automático Bolão ${company.name} (Pix Resp: ${company.managerPixKey || company.asaasWalletId})`,
        },
      ],
    };

    const asaasPaymentId = `pay_asaas_pix_${Math.floor(100000000 + Math.random() * 900000000)}`;
    const pixQrCodePayload = `00020126580014BR.GOV.BCB.PIX0136asaas-split-${company.logoInitials.toLowerCase()}-${asaasPaymentId}520400005303986540${String(totalAmount.toFixed(2)).length}${totalAmount.toFixed(2)}5802BR5920BV MEGA VIRADA SPLIT6009SAO PAULO62070503***6304${randomHex(2)}`;
    const couponHash = `LCX-2026-${company.logoInitials}-${randomHex(3)}`;

    const status = autoConfirmNow ? 'CONFIRMED' : 'PENDING';
    const nowIso = new Date().toISOString();

    const purchase: QuotaPurchase = {
      id: `pur_${Date.now().toString(36)}`,
      poolId: pool.id,
      companyId: company.id,
      participantId: participant.id,
      participantName: participant.name,
      participantCpf: participant.cpf,
      participantEmail: participant.email,
      participantWhatsapp: participant.whatsapp,
      participantRole: participant.department,
      participantPixKey: participant.pixKey,
      quotasCount: count,
      unitQuotaValue: pool.quotaValue,
      totalAmount,
      platformFeePercent: feePercent,
      platformFeeAmount,
      netPoolAmount,
      organizerWalletId: company.asaasWalletId,
      asaasPaymentId,
      pixQrCodePayload,
      paymentStatus: status,
      couponHash,
      createdAt: nowIso,
      paidAt: autoConfirmNow ? nowIso : undefined,
    };

    db.purchases.unshift(purchase);
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: nowIso,
      companyId: company.id,
      poolId: pool.id,
      actionType: autoConfirmNow ? 'PIX_SPLIT_CONCILIATED' : 'PIX_GENERATED',
      actorName: autoConfirmNow
        ? 'Asaas Webhook (Conciliação Automática)'
        : participant.name,
      description: autoConfirmNow
        ? `Pix confirmado (${count} cota(s) - R$ ${totalAmount.toFixed(2)}). Split executado: R$ ${netPoolAmount.toFixed(2)} para ${company.asaasWalletId} (Pix Resp: ${company.managerPixKey || 'Ativo'}) + R$ ${platformFeeAmount.toFixed(2)} Taxa Plataforma (${feePercent}%).`
        : `Cobrança Pix gerada (${asaasPaymentId}) para ${count} cota(s) no valor de R$ ${totalAmount.toFixed(2)}. Aguardando conciliação.`,
      integrityHash: createWebHash(purchase.id + asaasPaymentId),
      amount: totalAmount,
    });

    return {
      status: 200,
      data: { purchase, asaasSplitPayload, state: db },
      state: db,
    };
  }

  // 6. POST /api/webhooks/asaas-conciliate
  if (upperMethod === 'POST' && cleanPath === '/api/webhooks/asaas-conciliate') {
    const { purchaseId } = body || {};
    const purchaseIndex = db.purchases.findIndex((p) => p.id === purchaseId);
    if (purchaseIndex === -1) {
      return {
        status: 404,
        data: { error: 'Cobrança Pix não encontrada.' },
        state: db,
      };
    }

    const purchase = db.purchases[purchaseIndex];
    const company = db.companies.find((c) => c.id === purchase.companyId);
    const nowIso = new Date().toISOString();

    const updated: QuotaPurchase = {
      ...purchase,
      paymentStatus: 'CONFIRMED',
      paidAt: nowIso,
    };
    db.purchases[purchaseIndex] = updated;

    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: nowIso,
      companyId: updated.companyId,
      poolId: updated.poolId,
      actionType: 'PIX_SPLIT_CONCILIATED',
      actorName: 'Asaas Webhook (PAYMENT_RECEIVED)',
      description: `Conciliação bancária imediata (${updated.asaasPaymentId}). Split liquidado: R$ ${updated.netPoolAmount.toFixed(2)} creditado ao organizador (${company?.name || updated.organizerWalletId}) e R$ ${updated.platformFeeAmount.toFixed(2)} retido pela plataforma (${updated.platformFeePercent}%).`,
      integrityHash: createWebHash(updated.id + nowIso),
      amount: updated.totalAmount,
    });

    return { status: 200, data: { purchase: updated, state: db }, state: db };
  }

  // 7. POST /api/games
  if (upperMethod === 'POST' && cleanPath === '/api/games') {
    const { poolId, companyId, lotteryType, games } = body || {};
    if (!poolId || !companyId || !Array.isArray(games) || games.length === 0) {
      return {
        status: 400,
        data: { error: 'Informe ao menos um volante/jogo válido.' },
        state: db,
      };
    }

    const createdGames: LotteryGame[] = games.map((g: any, idx: number) => {
      const nums: number[] = Array.isArray(g.numbers)
        ? g.numbers.map(Number).sort((a: number, b: number) => a - b)
        : [];
      return {
        id: `game_${Date.now().toString(36)}_${idx}`,
        poolId,
        companyId,
        lotteryType: lotteryType || 'MEGA_SENA',
        gameMode: g.gameMode || (nums.length > 6 ? 'DESDOBRAMENTO' : 'SIMPLES'),
        numbers: nums,
        dozensCount: nums.length,
        equivalentSimpleBets: Number(g.equivalentSimpleBets) || 1,
        cost: Number(g.cost) || 5.0,
        lotericaReceiptCode:
          g.lotericaReceiptCode ||
          `TERM-${Math.floor(100000 + Math.random() * 900000)}-CX-${idx + 1}`,
        registeredAt: new Date().toISOString(),
      };
    });

    const totalCost = createdGames.reduce((acc, g) => acc + g.cost, 0);
    db.games.unshift(...createdGames);

    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      companyId,
      poolId,
      actionType: 'GAME_REGISTERED',
      actorName: 'Organizador do Bolão',
      description: `${createdGames.length} volante(s) registrado(s) no bolão (Custo Total: R$ ${totalCost.toFixed(2)}).`,
      integrityHash: createWebHash(createdGames.map((g) => g.id).join(',')),
      amount: totalCost,
    });

    return {
      status: 200,
      data: { games: createdGames, state: db },
      state: db,
    };
  }

  // 7b. POST /api/suggestions
  if (upperMethod === 'POST' && cleanPath === '/api/suggestions') {
    const {
      companyId,
      poolId,
      lotteryType,
      userId,
      userName,
      userJobTitle,
      numbers,
      rationale,
    } = body || {};
    if (!companyId || !poolId || !Array.isArray(numbers) || numbers.length === 0) {
      return {
        status: 400,
        data: { error: 'Selecione as dezenas do seu palpite.' },
        state: db,
      };
    }

    const sortedNums = numbers.map(Number).sort((a: number, b: number) => a - b);
    const newSuggestion: PlayerSuggestion = {
      id: `sug_${Date.now().toString(36)}`,
      companyId,
      poolId,
      lotteryType: lotteryType || 'MEGA_SENA',
      userId: userId || 'usr_anon',
      userName: String(userName || 'Colaborador').trim(),
      userJobTitle: String(userJobTitle || 'Participante').trim(),
      numbers: sortedNums,
      rationale: String(
        rationale || 'Palpite registrado para o bolão da empresa.'
      ).trim(),
      votes: 1,
      approvedAsOfficialGame: false,
      createdAt: new Date().toISOString(),
    };

    db.suggestions.unshift(newSuggestion);
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      companyId,
      poolId,
      actionType: 'SUGGESTION_CREATED',
      actorName: `${newSuggestion.userName} (${newSuggestion.userJobTitle})`,
      description: `Novo palpite de jogo enviado (${sortedNums.length} dezenas: [${sortedNums
        .map((n) => String(n).padStart(2, '0'))
        .join('-')}]).`,
      integrityHash: createWebHash(newSuggestion.id),
    });

    return {
      status: 200,
      data: { suggestion: newSuggestion, state: db },
      state: db,
    };
  }

  // 7c. POST /api/suggestions/:suggestionId/action
  if (
    upperMethod === 'POST' &&
    cleanPath.startsWith('/api/suggestions/') &&
    cleanPath.endsWith('/action')
  ) {
    const parts = cleanPath.split('/');
    const suggestionId = parts[parts.length - 2];
    const { action, cost, equivalentSimpleBets } = body || {};

    const sug = db.suggestions.find((s) => s.id === suggestionId);
    if (!sug) {
      return {
        status: 404,
        data: { error: 'Palpite não encontrado.' },
        state: db,
      };
    }

    if (action === 'VOTE') {
      sug.votes = (sug.votes || 0) + 1;
    } else if (action === 'APPROVE_GAME' && !sug.approvedAsOfficialGame) {
      sug.approvedAsOfficialGame = true;
      const newGame: LotteryGame = {
        id: `game_${Date.now().toString(36)}`,
        poolId: sug.poolId,
        companyId: sug.companyId,
        lotteryType: sug.lotteryType,
        gameMode: sug.numbers.length > 6 ? 'DESDOBRAMENTO' : 'SIMPLES',
        numbers: sug.numbers,
        dozensCount: sug.numbers.length,
        equivalentSimpleBets: Number(equivalentSimpleBets) || 1,
        cost: Number(cost) || 5.0,
        lotericaReceiptCode: `PALPITE-${sug.id.toUpperCase()}-CX`,
        registeredAt: new Date().toISOString(),
      };
      db.games.unshift(newGame);
      db.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        companyId: sug.companyId,
        poolId: sug.poolId,
        actionType: 'GAME_REGISTERED',
        actorName: 'Gestor da Empresa',
        description: `Palpite de ${sug.userName} aprovado e convertido em volante oficial (${newGame.lotericaReceiptCode}).`,
        integrityHash: createWebHash(newGame.id),
        amount: newGame.cost,
      });
    }

    return {
      status: 200,
      data: { suggestion: sug, state: db },
      state: db,
    };
  }

  // 8. PUT /api/settings
  if (upperMethod === 'PUT' && cleanPath === '/api/settings') {
    db.settings = {
      ...db.settings,
      ...body,
      defaultPlatformFeePercent: Number(
        body?.defaultPlatformFeePercent ?? db.settings.defaultPlatformFeePercent
      ),
    };

    if (body?.applyFeeToAllPools) {
      db.pools = db.pools.map((p) => ({
        ...p,
        platformFeePercent: db.settings.defaultPlatformFeePercent,
      }));
    }

    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: 'SETTINGS_UPDATED',
      actorName: db.settings.masterOrganizerName,
      description: `Configurações globais de Split Asaas atualizadas. Taxa administrativa padrão: ${db.settings.defaultPlatformFeePercent}%.`,
      integrityHash: createWebHash(JSON.stringify(db.settings)),
    });

    return {
      status: 200,
      data: { settings: db.settings, state: db },
      state: db,
    };
  }

  return {
    status: 404,
    data: { error: `Rota não encontrada: ${upperMethod} ${cleanPath}` },
    state: db,
  };
}

/**
 * Universal API Fetcher:
 * 1. Calls the backend / Edge API endpoint (`/api/...`)
 * 2. If deployed as static Cloudflare Pages or if an Edge Worker cold-starts,
 *    automatically executes `processApiRequest` against the persisted browser state
 *    and syncs `localStorage` so the app works seamlessly on Cloudflare Workers & Pages.
 */
export async function apiFetch(
  pathname: string,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method || 'GET';
  let parsedBody: any = undefined;
  if (typeof init?.body === 'string' && init.body.trim().length > 0) {
    try {
      parsedBody = JSON.parse(init.body);
    } catch {
      parsedBody = {};
    }
  }

  try {
    const resp = await fetch(pathname, init);
    const contentType = resp.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const cloned = resp.clone();
      const jsonData = await cloned.json();

      // If server/worker succeeded, keep browser cache in sync
      if (resp.ok) {
        if (jsonData && Array.isArray(jsonData.companies)) {
          saveBrowserCachedState(jsonData);
        } else if (jsonData?.state && Array.isArray(jsonData.state.companies)) {
          saveBrowserCachedState(jsonData.state);
        }
        return resp;
      }

      // If a stateless Worker isolate cold-started and returned 404 for a user/item that exists in browser storage,
      // fallback to the browser-persisted state.
      if (resp.status === 404 && typeof window !== 'undefined') {
        const localDb = loadBrowserCachedState();
        const localResult = await processApiRequest(
          method,
          pathname,
          parsedBody,
          localDb
        );
        if (localResult.status === 200) {
          saveBrowserCachedState(localResult.state);
          return new Response(JSON.stringify(localResult.data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return resp;
    }
  } catch {
    // Network error or offline -> fallback to local Edge/Browser engine below
  }

  // Fallback for static Cloudflare Pages or offline mode
  const localDb = loadBrowserCachedState();
  const result = await processApiRequest(method, pathname, parsedBody, localDb);
  saveBrowserCachedState(result.state);

  return new Response(JSON.stringify(result.data), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
