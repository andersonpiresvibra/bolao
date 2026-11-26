import express from 'express';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { getDefaultLotteryStats } from './src/utils/lotteryMath.ts';
import type { LotteryType } from './src/types.ts';

import {
  isSupabaseConfigured,
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
} from './server/supabaseRepo.ts';
import {
  verifyAsaasConnection,
  verifyAsaasWebhookToken,
} from './server/asaasClient.ts';

dotenv.config();

function ensureSupabase(res: express.Response): boolean {
  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error:
        'Supabase não configurado no servidor. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
    });
    return false;
  }
  return true;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: isSupabaseConfigured() ? 'supabase' : 'unconfigured',
      asaas: {
        apiKey: Boolean(process.env.ASAAS_API_KEY),
        apiUrl: Boolean(process.env.ASAAS_API_URL),
        platformWalletId: Boolean(process.env.ASAAS_PLATFORM_WALLET_ID),
        webhookToken: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/asaas/verify', async (_req, res) => {
    try {
      const result = await verifyAsaasConnection();
      return res.status(result.ok ? 200 : 502).json(result);
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message || 'Erro ao verificar Asaas.' });
    }
  });

  // 1. GET full synchronized database state from Supabase
  app.get('/api/state', async (_req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const state = await fetchFullDatabaseState();
      return res.json(state);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao carregar estado do Supabase.' });
    }
  });

  // 1.0 GET Hot/Cold Lottery Statistics (Fetches live official Caixa API + mirror + caches in Supabase)
  const liveLotteryCache = new Map<
    LotteryType,
    { expiresAt: number; payload: ReturnType<typeof getDefaultLotteryStats> }
  >();

  app.get('/api/lottery-stats/:lotteryType', async (req, res) => {
    const rawType = String(req.params.lotteryType || 'MEGA_SENA').toUpperCase();
    const slugByLottery: Record<LotteryType, string> = {
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
    const lotteryType: LotteryType =
      rawType in slugByLottery ? (rawType as LotteryType) : 'MEGA_SENA';

    const cached = liveLotteryCache.get(lotteryType);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.payload);
    }

    const baseStats = getDefaultLotteryStats(lotteryType);
    const apiSlug = slugByLottery[lotteryType];

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
      let usedOfficialCaixa = Boolean(rawData && (rawData.numero || rawData.concurso));

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
          contestNumber: String(
            nextContestNumRaw || baseStats.nextContest?.contestNumber || ''
          ),
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
          if (!isNaN(latestNum) && latestNum > 2) {
            try {
              const prevPromises = [latestNum - 1, latestNum - 2].map(async (cNum) => {
                const pData =
                  (await fetchJsonWithTimeout(
                    `https://servicebus2.caixa.gov.br/portaldeloterias/api/${apiSlug}/${cNum}`,
                    2000
                  )) ||
                  (await fetchJsonWithTimeout(
                    `https://loteriascaixa-api.herokuapp.com/api/${apiSlug}/${cNum}`,
                    2000
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
                    contestNumber: String(pData.numero ?? pData.concurso ?? cNum),
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

    res.json(baseStats);
  });

  // 1a. POST Login with CPF/Email/Username and Password (Supabase Auth)
  app.post('/api/auth/login', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res
          .status(400)
          .json({ error: 'Informe seu CPF/E-mail e sua senha para entrar.' });
      }
      const result = await loginUserSupabase(identifier, password);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ user: result.user, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao autenticar.' });
    }
  });

  // 1b. POST User Registration (Supabase Auth + profiles)
  app.post('/api/auth/register-login', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { name, whatsapp, cpf, email, pixKey } = req.body;
      if (!name || !whatsapp || !cpf || !email || !pixKey) {
        return res.status(400).json({
          error:
            'Preencha os campos obrigatórios: Nome, WhatsApp, CPF, E-mail e Chave Pix.',
        });
      }
      const result = await registerOrUpdateUserSupabase(req.body);
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao realizar cadastro.' });
    }
  });

  // 1c. POST Recover Password (Supabase Auth admin password reset)
  app.post('/api/auth/recover-password', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { identifier, newPassword } = req.body;
      if (!identifier || !newPassword) {
        return res.status(400).json({
          error:
            'Informe seu CPF, E-mail ou Nome de usuário cadastrado e defina a nova senha.',
        });
      }
      const result = await recoverPasswordSupabase(identifier, newPassword);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ ok: true, message: result.message, user: result.user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao recuperar senha.' });
    }
  });

  // 1d. PUT Update User Profile & Preferences (Meu Espaço)
  app.put('/api/users/:userId', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { userId } = req.params;
      const result = await updateUserSupabase(userId, req.body);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ user: result.user, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar perfil do usuário.' });
    }
  });

  // 2. POST create a new bolão group & initial lottery pool
  app.post('/api/companies', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const result = await createCompanyAndPoolSupabase(req.body);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ company: result.company, pool: result.pool, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao cadastrar grupo de bolão.' });
    }
  });

  // 3. PUT update pool configuration
  app.put('/api/pools/:poolId', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { poolId } = req.params;
      const result = await updatePoolSupabase(poolId, req.body);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ pool: result.pool, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar bolão.' });
    }
  });

  // 4. POST register participant
  app.post('/api/participants', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const result = await registerParticipantSupabase(req.body);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ participant: result.participant, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao cadastrar participante.' });
    }
  });

  // 5. POST create Asaas Pix Charge with automatic Split
  app.post('/api/payments/pix', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const result = await createPixPurchaseSupabase(req.body);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({
        purchase: result.purchase,
        asaasSplitPayload: result.asaasSplitPayload,
        state: result.state,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao gerar cobrança Pix com Split.' });
    }
  });

  // 6. POST Asaas Webhook / Instant Bank Reconciliation for Pending Pix
  app.post('/api/webhooks/asaas-conciliate', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { purchaseId } = req.body;
      const result = await conciliatePixPurchaseSupabase(purchaseId);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ purchase: result.purchase, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao conciliar Pix.' });
    }
  });

  // 6b. POST Official Asaas Webhook Receiver (validates asaas-access-token header)
  app.post('/api/webhooks/asaas', async (req, res) => {
    if (!ensureSupabase(res)) return;
    if (!process.env.ASAAS_WEBHOOK_TOKEN?.trim()) {
      return res.status(503).json({ error: 'ASAAS_WEBHOOK_TOKEN não configurado.' });
    }
    const receivedToken = req.header('asaas-access-token');
    if (!verifyAsaasWebhookToken(receivedToken)) {
      return res.status(401).json({ error: 'Token de autenticação do Webhook inválido.' });
    }
    try {
      const eventName = typeof req.body?.event === 'string' ? req.body.event : '';
      const payment =
        req.body?.payment && typeof req.body.payment === 'object' ? req.body.payment : undefined;
      const outcome = await handleAsaasWebhookEventSupabase(eventName, payment);
      return res.status(200).json({ received: true, ...outcome });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro ao processar webhook Asaas.' });
    }
  });

  // 7. POST register lottery games
  app.post('/api/games', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const result = await registerGamesSupabase(req.body);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ games: result.games, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao registrar jogos.' });
    }
  });

  // 7b. POST create player suggestion
  app.post('/api/suggestions', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const result = await createSuggestionSupabase(req.body);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ suggestion: result.suggestion, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao salvar palpite.' });
    }
  });

  // 7c. POST vote, edit numbers, or approve a player suggestion
  app.post('/api/suggestions/:suggestionId/action', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { suggestionId } = req.params;
      const result = await suggestionActionSupabase(suggestionId, req.body);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ suggestion: result.suggestion, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao processar ação no palpite.' });
    }
  });

  // 8. PUT update global platform settings
  app.put('/api/settings', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const result = await updateSettingsSupabase(req.body);
      return res.json({ settings: result.settings, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar configurações.' });
    }
  });

  // 9. DELETE owned pool (requires owner Supabase Auth verification)
  app.delete('/api/pools/:poolId', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { poolId } = req.params;
      const { email, password } = req.body || {};
      const result = await deletePoolOwnedSupabase(poolId, email, password);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ ok: true, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao excluir bolão.' });
    }
  });

  // 10. DELETE own account (requires password verification)
  app.delete('/api/users/:userId', async (req, res) => {
    if (!ensureSupabase(res)) return;
    try {
      const { userId } = req.params;
      const { password } = req.body || {};
      const result = await deleteOwnAccountSupabase(userId, password);
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ ok: true, state: result.state });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao excluir conta.' });
    }
  });

  const distPath = path.join(process.cwd(), 'dist');
  const distStatic = express.static(distPath);

  if (process.env.NODE_ENV !== 'production') {
    let viteInstance: any = null;
    const vitePromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        })
      )
      .then((v) => {
        viteInstance = v;
        return v;
      });

    app.use(async (req, res, next) => {
      try {
        if (viteInstance) {
          return viteInstance.middlewares(req, res, next);
        }
        const vite = await Promise.race([
          vitePromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (vite) {
          return vite.middlewares(req, res, next);
        }
        if (fs.existsSync(path.join(distPath, 'index.html'))) {
          return distStatic(req, res, () => {
            res.sendFile(path.join(distPath, 'index.html'));
          });
        }
        const fullVite = await vitePromise;
        return fullVite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(distStatic);
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
  });
}

startServer();
