import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import { INITIAL_DATABASE_STATE } from './src/seedData.ts';
import { getDefaultLotteryStats } from './src/utils/lotteryMath.ts';
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
} from './src/types.ts';

dotenv.config();

const DATA_FILE_PATH = path.resolve(process.cwd(), '.lotocorp-db.json');

function loadDatabase(): DatabaseState {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (!parsed.users || parsed.users.length === 0) {
        parsed.users = INITIAL_DATABASE_STATE.users || [];
      }
      if (!parsed.suggestions) {
        parsed.suggestions = INITIAL_DATABASE_STATE.suggestions || [];
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error loading local database, using seed state:', err);
  }
  const initial = JSON.parse(JSON.stringify(INITIAL_DATABASE_STATE)) as DatabaseState;
  saveDatabase(initial);
  return initial;
}

function saveDatabase(state: DatabaseState): void {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local database:', err);
  }
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

let db: DatabaseState = loadDatabase();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. GET full synchronized database state
  app.get('/api/state', (_req, res) => {
    res.json(db);
  });

  // 1.0 GET Hot/Cold Lottery Statistics (Fetches live draw results API + Historical Frequency Table)
  app.get('/api/lottery-stats/:lotteryType', async (req, res) => {
    const rawType = String(req.params.lotteryType || 'MEGA_SENA').toUpperCase();
    const lotteryType: LotteryType =
      rawType === 'LOTOFACIL'
        ? 'LOTOFACIL'
        : rawType === 'QUINA'
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
            baseStats.source = 'Resultados Oficiais dos Sorteios (Tempo Real + Histórico)';
            const latestContestObj = {
              contestNumber: String(data.concurso || baseStats.latestContest.contestNumber),
              drawDate: String(data.data || baseStats.latestContest.drawDate),
              drawnNumbers: liveNumbers,
              accumulated: Boolean(data.acumulou),
            };
            baseStats.latestContest = latestContestObj;

            // Try to fetch previous 2 contests in parallel if contest number is numeric
            const latestNum = Number(data.concurso);
            const recentList: typeof baseStats.recentContests = [latestContestObj];
            if (!isNaN(latestNum) && latestNum > 2) {
              try {
                const prevPromises = [latestNum - 1, latestNum - 2].map(async (cNum) => {
                  const pCtrl = new AbortController();
                  const pTime = setTimeout(() => pCtrl.abort(), 1500);
                  const pResp = await fetch(
                    `https://loteriascaixa-api.herokuapp.com/api/${apiSlug}/${cNum}`,
                    { signal: pCtrl.signal, headers: { Accept: 'application/json' } }
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
                });
                const prevResults = await Promise.all(prevPromises);
                prevResults.forEach((pr) => {
                  if (pr && pr.drawnNumbers.length > 0) recentList.push(pr);
                });
              } catch {
                // Keep defaults for remaining slots
              }
            }

            while (recentList.length < 3) {
              const fallbackItem = baseStats.recentContests[recentList.length];
              if (fallbackItem) recentList.push(fallbackItem);
              else break;
            }
            baseStats.recentContests = recentList.slice(0, 3);

            // Increment frequency of latest drawn numbers and reset their delay
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

    res.json(baseStats);
  });

  // 1a. POST Login with Login (CPF or Email) and Password
  app.post('/api/auth/login', (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Informe seu CPF/E-mail e sua senha para entrar.' });
      }

      if (!db.users) db.users = INITIAL_DATABASE_STATE.users || [];

      const cleanInput = String(identifier).trim().toLowerCase();
      const cleanDigits = cleanInput.replace(/\D/g, '');

      const foundUser = db.users.find((u) => {
        const emailMatch = u.email.trim().toLowerCase() === cleanInput;
        const usernameMatch = u.username && u.username.trim().toLowerCase() === cleanInput;
        const cpfMatch = cleanDigits.length >= 6 && u.cpf.replace(/\D/g, '') === cleanDigits;
        return emailMatch || usernameMatch || cpfMatch;
      });

      if (!foundUser) {
        return res.status(404).json({
          error: 'Usuário não encontrado. Clique no botão "Cadastrar" abaixo para criar sua conta.',
        });
      }

      if (foundUser.password && foundUser.password !== String(password)) {
        return res.status(401).json({
          error: 'Senha incorreta. Verifique sua senha ou clique em "Recuperar Senha".',
        });
      }

      res.json({ user: foundUser, state: db });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao autenticar.' });
    }
  });

  // 1b. POST User Registration ("Cadastrar" 4-step flow)
  app.post('/api/auth/register-login', (req, res) => {
    try {
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
      } = req.body;

      if (!name || !whatsapp || !cpf || !email || !companyName || !jobTitle || !pixKey) {
        return res.status(400).json({
          error:
            'Preencha todos os campos obrigatórios: Nome completo, WhatsApp, CPF, E-mail, Empresa, Função e Chave Pix.',
        });
      }

      if (!db.users) db.users = [];

      const cleanCpf = String(cpf).replace(/\D/g, '');
      const words = String(name)
        .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
        .trim()
        .split(/\s+/);
      const initials =
        words.length >= 2
          ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
          : String(name).slice(0, 2).toUpperCase();

      let matchedCompany =
        db.companies.find((c) => c.id === companyId) ||
        db.companies.find(
          (c) => c.name.trim().toLowerCase() === String(companyName).trim().toLowerCase()
        );

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
        user.companyName = matchedCompany ? matchedCompany.name : String(companyName).trim();
        user.companyId = matchedCompany?.id;
        user.jobTitle = String(jobTitle).trim();
        user.pixKey = String(pixKey).trim();
        user.avatarInitials = initials;
      } else {
        user = {
          id: `usr_${Date.now().toString(36)}`,
          name: String(name).trim(),
          username: username ? String(username).trim() : `${words[0].toLowerCase()}@`,
          whatsapp: String(whatsapp).trim(),
          cpf: String(cpf).trim(),
          email: String(email).trim(),
          password: String(password || '123'),
          companyName: matchedCompany ? matchedCompany.name : String(companyName).trim(),
          companyId: matchedCompany?.id,
          jobTitle: String(jobTitle).trim(),
          pixKey: String(pixKey).trim(),
          avatarInitials: initials,
          createdAt: new Date().toISOString(),
        };
        db.users.unshift(user);
      }

      if (matchedCompany) {
        const companyPool = db.pools.find((p) => p.companyId === matchedCompany!.id);
        if (companyPool) {
          const existingPart = db.participants.find(
            (p) =>
              p.companyId === matchedCompany!.id &&
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

      saveDatabase(db);
      res.json({ user, state: db });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao realizar cadastro.' });
    }
  });

  // 1c. POST Recover Password ("Recuperar Senha" button flow)
  app.post('/api/auth/recover-password', (req, res) => {
    try {
      const { identifier, newPassword } = req.body;
      if (!identifier || !newPassword) {
        return res.status(400).json({
          error: 'Informe seu CPF, E-mail ou Nome de usuário cadastrado e defina a nova senha.',
        });
      }

      if (!db.users) db.users = INITIAL_DATABASE_STATE.users || [];

      const cleanInput = String(identifier).trim().toLowerCase();
      const cleanDigits = cleanInput.replace(/\D/g, '');

      const foundUser = db.users.find((u) => {
        const emailMatch = u.email.trim().toLowerCase() === cleanInput;
        const usernameMatch = u.username && u.username.trim().toLowerCase() === cleanInput;
        const cpfMatch = cleanDigits.length >= 6 && u.cpf.replace(/\D/g, '') === cleanDigits;
        return emailMatch || usernameMatch || cpfMatch;
      });

      if (!foundUser) {
        return res.status(404).json({
          error: 'Nenhum usuário localizado com este CPF ou E-mail.',
        });
      }

      foundUser.password = String(newPassword);
      saveDatabase(db);

      res.json({
        ok: true,
        message: `Senha redefinida com sucesso para ${foundUser.name}! Você já pode entrar.`,
        user: foundUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao recuperar senha.' });
    }
  });

  // 1d. PUT Update User Profile & Preferences (Meu Espaço: Perfil, Teto Mensal, Dezenas e Jogos Favoritos)
  app.put('/api/users/:userId', (req, res) => {
    try {
      const { userId } = req.params;
      if (!db.users) db.users = INITIAL_DATABASE_STATE.users || [];

      const userIndex = db.users.findIndex((u) => u.id === userId);
      if (userIndex === -1) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const current = db.users[userIndex];
      const updatedName = req.body.name ? String(req.body.name).trim() : current.name;
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
        ...req.body,
        id: current.id,
        name: updatedName,
        avatarInitials: initials,
      };

      db.users[userIndex] = updated;

      // Also sync participant records matching this user's CPF
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

      saveDatabase(db);
      res.json({ user: updated, state: db });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar perfil do usuário.' });
    }
  });

  // 2. POST create a new corporate group & initial lottery pool (Multitenant, Unique company name)
  app.post('/api/companies', (req, res) => {
    try {
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
      } = req.body;

      if (!userId && !managerName) {
        return res.status(401).json({
          error: 'Apenas usuários cadastrados e logados no sistema podem cadastrar empresas.',
        });
      }

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
      }

      const normalizedNewName = String(name).trim().toLowerCase();
      const duplicateCompany = db.companies.find(
        (c) => c.name.trim().toLowerCase() === normalizedNewName
      );
      if (duplicateCompany) {
        return res.status(409).json({
          error: `A empresa "${String(name).trim()}" já está cadastrada no sistema. O nome da empresa não pode ser repetido.`,
        });
      }

      const words = String(name)
        .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
        .trim()
        .split(/\s+/);
      const initials =
        words.length >= 2
          ? (words[0][0] + words[1][0]).toUpperCase()
          : String(name).slice(0, 2).toUpperCase();

      const companyId = `comp_${Date.now().toString(36)}`;
      const tenantSlug = String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const wallet =
        asaasWalletId && String(asaasWalletId).trim()
          ? String(asaasWalletId).trim()
          : `wal_asaas_${initials.toLowerCase()}_${Math.floor(100000 + Math.random() * 900000)}`;

      const newCompany: Company = {
        id: companyId,
        tenantSlug,
        name: String(name).trim(),
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

      const parsedQuota = Math.max(1, Number(quotaValue) || 100);
      const rawMaxTarget = maxTargetAmount !== undefined ? Number(maxTargetAmount) : 0;
      const parsedMaxTarget = Number.isFinite(rawMaxTarget) && rawMaxTarget > 0 ? rawMaxTarget : 0;
      const resolvedCollectionMode = parsedMaxTarget > 0 ? 'MAX_TARGET' : 'FIXED_QUOTA';
      const maxQuotas =
        parsedMaxTarget > 0 ? Math.max(1, Math.floor(parsedMaxTarget / parsedQuota)) : 9999;

      const poolId = `pool_${Date.now().toString(36)}`;
      const newPool: Pool = {
        id: poolId,
        companyId,
        title: String(poolTitle || `Bolão Fim de Ano — ${newCompany.name}`).trim(),
        lotteryType: lotteryType || 'MEGA_SENA',
        contestNumber: String(contestNumber || '2950').trim(),
        collectionMode: resolvedCollectionMode,
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
        integrityHash: createHash(newCompany.id + newPool.id),
      };

      db.companies.unshift(newCompany);
      db.pools.unshift(newPool);
      db.auditLogs.unshift(log);
      saveDatabase(db);

      res.json({ company: newCompany, pool: newPool, state: db });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao cadastrar empresa.' });
    }
  });

  // 3. PUT update pool configuration
  app.put('/api/pools/:poolId', (req, res) => {
    const { poolId } = req.params;
    const poolIndex = db.pools.findIndex((p) => p.id === poolId);
    if (poolIndex === -1) {
      return res.status(404).json({ error: 'Bolão não encontrado.' });
    }

    const current = db.pools[poolIndex];
    const nextQuota = Math.max(1, Number(req.body.quotaValue ?? current.quotaValue) || 100);
    const nextMaxTarget =
      req.body.maxTargetAmount !== undefined
        ? Math.max(0, Number(req.body.maxTargetAmount) || 0)
        : current.maxTargetAmount;
    const nextCollectionMode = nextMaxTarget > 0 ? 'MAX_TARGET' : 'FIXED_QUOTA';
    const nextMaxQuotas =
      nextMaxTarget > 0 ? Math.max(1, Math.floor(nextMaxTarget / nextQuota)) : 9999;

    const confirmedSum = db.purchases
      .filter((p) => p.poolId === current.id && p.paymentStatus === 'CONFIRMED')
      .reduce((acc, p) => acc + p.totalAmount, 0);

    const nextEndDate = req.body.endDate || current.endDate;
    const isPastDeadline = new Date(nextEndDate).getTime() <= Date.now();
    const isTargetReached = nextMaxTarget > 0 && confirmedSum >= nextMaxTarget;

    const updated: Pool = {
      ...current,
      ...req.body,
      collectionMode: nextCollectionMode,
      quotaValue: nextQuota,
      maxTargetAmount: nextMaxTarget,
      maxQuotas: nextMaxQuotas,
      status:
        current.status === 'DRAWN'
          ? current.status
          : isTargetReached || isPastDeadline
          ? 'CLOSED'
          : 'OPEN',
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
      integrityHash: createHash(updated.id + JSON.stringify(req.body)),
    });

    saveDatabase(db);
    res.json({ pool: updated, state: db });
  });

  // 4. POST register participant
  app.post('/api/participants', (req, res) => {
    const { companyId, poolId, name, cpf, email, whatsapp, department, pixKey, registeredBy } =
      req.body;
    if (!companyId || !poolId || !name || !cpf) {
      return res.status(400).json({ error: 'Nome, CPF e empresa são obrigatórios.' });
    }

    const existing = db.participants.find(
      (p) =>
        p.companyId === companyId &&
        p.cpf.replace(/\D/g, '') === String(cpf).replace(/\D/g, '')
    );

    if (existing) {
      return res.json({ participant: existing, state: db });
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
      actorName: registeredBy === 'MANAGER' ? 'Gestor da Empresa' : newParticipant.name,
      description: `Colaborador cadastrado na empresa (${newParticipant.department}) com CPF validado (${newParticipant.cpf.slice(0, 3)}.***.***-**).`,
      integrityHash: createHash(newParticipant.id),
    });

    saveDatabase(db);
    res.json({ participant: newParticipant, state: db });
  });

  // 5. POST create Asaas Pix Charge with automatic Split
  app.post('/api/payments/pix', async (req, res) => {
    try {
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
      } = req.body;

      const pool = db.pools.find((p) => p.id === poolId);
      const company = db.companies.find((c) => c.id === companyId);

      if (!pool || !company) {
        return res.status(404).json({ error: 'Empresa ou Bolão não encontrado.' });
      }

      const count = Math.max(1, Number(quotasCount) || 1);
      const totalAmount = Number((count * pool.quotaValue).toFixed(2));
      const feePercent = pool.platformFeePercent || db.settings.defaultPlatformFeePercent;
      const platformFeeAmount = Number(((totalAmount * feePercent) / 100).toFixed(2));
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

      let asaasPaymentId = `pay_asaas_pix_${Math.floor(100000000 + Math.random() * 900000000)}`;
      let pixQrCodePayload = `00020126580014BR.GOV.BCB.PIX0136asaas-split-${company.logoInitials.toLowerCase()}-${asaasPaymentId}520400005303986540${String(totalAmount.toFixed(2)).length}${totalAmount.toFixed(2)}5802BR5920BV MEGA VIRADA SPLIT6009SAO PAULO62070503***6304${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      if (process.env.ASAAS_API_KEY) {
        try {
          const asaasUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
          const resp = await fetch(`${asaasUrl}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              access_token: process.env.ASAAS_API_KEY,
            },
            body: JSON.stringify(asaasSplitPayload),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            if (data.id) asaasPaymentId = data.id;
          }
        } catch (apiErr) {
          console.warn('Asaas sandbox fallback activated:', apiErr);
        }
      }

      const couponHash = `LCX-2026-${company.logoInitials}-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;

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

      if (autoConfirmNow) {
        const confirmedTotal = db.purchases
          .filter((p) => p.poolId === pool.id && p.paymentStatus === 'CONFIRMED')
          .reduce((acc, p) => acc + p.totalAmount, 0);
        if (pool.maxTargetAmount > 0 && confirmedTotal >= pool.maxTargetAmount) {
          pool.status = 'CLOSED';
        }
      }

      db.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        timestamp: nowIso,
        companyId: company.id,
        poolId: pool.id,
        actionType: autoConfirmNow ? 'PIX_SPLIT_CONCILIATED' : 'PIX_GENERATED',
        actorName: autoConfirmNow ? 'Asaas Webhook (Conciliação Automática)' : participant.name,
        description: autoConfirmNow
          ? `Pix confirmado (${count} cota(s) - R$ ${totalAmount.toFixed(2)}). Split executado: R$ ${netPoolAmount.toFixed(2)} para ${company.asaasWalletId} (Pix Resp: ${company.managerPixKey || 'Ativo'}) + R$ ${platformFeeAmount.toFixed(2)} Taxa Plataforma (${feePercent}%).`
          : `Cobrança Pix gerada (${asaasPaymentId}) para ${count} cota(s) no valor de R$ ${totalAmount.toFixed(2)}. Aguardando conciliação.`,
        integrityHash: createHash(purchase.id + asaasPaymentId),
        amount: totalAmount,
      });

      saveDatabase(db);
      res.json({
        purchase,
        asaasSplitPayload,
        state: db,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao gerar cobrança Pix com Split.' });
    }
  });

  // 6. POST Asaas Webhook / Instant Bank Reconciliation for Pending Pix
  app.post('/api/webhooks/asaas-conciliate', (req, res) => {
    const { purchaseId } = req.body;
    const purchaseIndex = db.purchases.findIndex((p) => p.id === purchaseId);

    if (purchaseIndex === -1) {
      return res.status(404).json({ error: 'Cobrança Pix não encontrada.' });
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

    const poolToUpdate = db.pools.find((p) => p.id === updated.poolId);
    if (poolToUpdate) {
      const confirmedTotal = db.purchases
        .filter((p) => p.poolId === poolToUpdate.id && p.paymentStatus === 'CONFIRMED')
        .reduce((acc, p) => acc + p.totalAmount, 0);
      if (poolToUpdate.maxTargetAmount > 0 && confirmedTotal >= poolToUpdate.maxTargetAmount) {
        poolToUpdate.status = 'CLOSED';
      }
    }

    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: nowIso,
      companyId: updated.companyId,
      poolId: updated.poolId,
      actionType: 'PIX_SPLIT_CONCILIATED',
      actorName: 'Asaas Webhook (PAYMENT_RECEIVED)',
      description: `Conciliação bancária imediata (${updated.asaasPaymentId}). Split liquidado: R$ ${updated.netPoolAmount.toFixed(2)} creditado ao organizador (${company?.name || updated.organizerWalletId}) e R$ ${updated.platformFeeAmount.toFixed(2)} retido pela plataforma (${updated.platformFeePercent}%).`,
      integrityHash: createHash(updated.id + nowIso),
      amount: updated.totalAmount,
    });

    saveDatabase(db);
    res.json({ purchase: updated, state: db });
  });

  // 7. POST register lottery games
  app.post('/api/games', (req, res) => {
    const { poolId, companyId, lotteryType, games, authorId, authorName, authorAvatar } =
      req.body;
    if (!poolId || !companyId || !Array.isArray(games) || games.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um volante/jogo válido.' });
    }

    const createdGames: LotteryGame[] = games.map((g: any, idx: number) => {
      const nums: number[] = Array.isArray(g.numbers)
        ? g.numbers.map(Number).sort((a: number, b: number) => a - b)
        : [];
      const resolvedAuthorName = String(g.authorName || authorName || 'Organizador do Bolão').trim();
      const parts = resolvedAuthorName.split(/\s+/).filter(Boolean);
      const fallbackAvatar =
        parts.length > 1
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : resolvedAuthorName.slice(0, 2).toUpperCase();

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
        authorId: g.authorId || authorId || 'usr_org',
        authorName: resolvedAuthorName,
        authorAvatar: g.authorAvatar || authorAvatar || fallbackAvatar,
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
      actorName: String(authorName || 'Organizador do Bolão'),
      description: `${createdGames.length} volante(s) registrado(s) no bolão (Custo Total: R$ ${totalCost.toFixed(2)}).`,
      integrityHash: createHash(createdGames.map((g) => g.id).join(',')),
      amount: totalCost,
    });

    saveDatabase(db);
    res.json({ games: createdGames, state: db });
  });

  // 7b. POST create player suggestion ("Palpite de Jogo" inside company's betting section)
  app.post('/api/suggestions', (req, res) => {
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
    } = req.body;
    if (!companyId || !poolId || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Selecione as dezenas do seu palpite.' });
    }

    if (!db.suggestions) db.suggestions = [];

    const resolvedName = String(userName || 'Participante').trim();
    const parts = resolvedName.split(/\s+/).filter(Boolean);
    const computedAvatar =
      parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : resolvedName.slice(0, 2).toUpperCase();

    const sortedNums = numbers.map(Number).sort((a: number, b: number) => a - b);
    const newSuggestion: PlayerSuggestion = {
      id: `sug_${Date.now().toString(36)}`,
      companyId,
      poolId,
      lotteryType: lotteryType || 'MEGA_SENA',
      userId: userId || 'usr_anon',
      userName: resolvedName,
      userAvatar: userAvatar || computedAvatar,
      userJobTitle: String(userJobTitle || 'Apostador').trim(),
      numbers: sortedNums,
      rationale: String(rationale || 'Jogo elaborado para o bolão.').trim(),
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
      description: `Novo jogo indicado (${sortedNums.length} dezenas: [${sortedNums
        .map((n) => String(n).padStart(2, '0'))
        .join('-')}]).`,
      integrityHash: createHash(newSuggestion.id),
    });

    saveDatabase(db);
    res.json({ suggestion: newSuggestion, state: db });
  });

  // 7c. POST vote, edit numbers (before approval by author only), or approve a player suggestion
  app.post('/api/suggestions/:suggestionId/action', (req, res) => {
    const { suggestionId } = req.params;
    const {
      action,
      cost,
      equivalentSimpleBets,
      numbers,
      rationale,
      actorId,
      actorName,
    } = req.body; // 'VOTE' | 'APPROVE_GAME' | 'EDIT_NUMBERS'

    if (!db.suggestions) db.suggestions = [];
    const sug = db.suggestions.find((s) => s.id === suggestionId);
    if (!sug) {
      return res.status(404).json({ error: 'Jogo indicado não encontrado.' });
    }

    if (action === 'VOTE') {
      sug.votes = (sug.votes || 0) + 1;
    } else if (action === 'EDIT_NUMBERS') {
      if (sug.approvedAsOfficialGame) {
        return res.status(400).json({
          error:
            'Este jogo já foi aprovado pelo organizador e suas dezenas não podem mais ser alteradas.',
        });
      }
      const isAuthor =
        sug.userId === actorId ||
        sug.userName.trim().toLowerCase() === String(actorName || '').trim().toLowerCase();
      if (!isAuthor) {
        return res.status(403).json({
          error: 'Somente quem elaborou este jogo pode alterar as dezenas antes da aprovação.',
        });
      }
      if (Array.isArray(numbers) && numbers.length > 0) {
        sug.numbers = numbers.map(Number).sort((a: number, b: number) => a - b);
      }
      if (rationale !== undefined) {
        sug.rationale = String(rationale).trim();
      }
      sug.updatedAt = new Date().toISOString();
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
        lotericaReceiptCode: `VOLANTE-${sug.id.toUpperCase()}-CX`,
        registeredAt: new Date().toISOString(),
        authorId: sug.userId,
        authorName: sug.userName,
        authorAvatar: sug.userAvatar,
      };
      db.games.unshift(newGame);
      db.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        companyId: sug.companyId,
        poolId: sug.poolId,
        actionType: 'GAME_REGISTERED',
        actorName: 'Organizador do Bolão',
        description: `Jogo elaborado por ${sug.userName} aprovado como volante oficial (${newGame.lotericaReceiptCode}). Dezenas bloqueadas.`,
        integrityHash: createHash(newGame.id),
        amount: newGame.cost,
      });
    }

    saveDatabase(db);
    res.json({ suggestion: sug, state: db });
  });

  // 8. PUT update global platform settings
  app.put('/api/settings', (req, res) => {
    db.settings = {
      ...db.settings,
      ...req.body,
      defaultPlatformFeePercent: Number(
        req.body.defaultPlatformFeePercent ?? db.settings.defaultPlatformFeePercent
      ),
    };

    if (req.body.applyFeeToAllPools) {
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
      integrityHash: createHash(JSON.stringify(db.settings)),
    });

    saveDatabase(db);
    res.json({ settings: db.settings, state: db });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BV-Mega da Virada Server running on http://localhost:${PORT}`);
  });
}

startServer();
