import React, { useState } from 'react';
import {
  Company,
  Pool,
  LotteryGame,
  QuotaPurchase,
  AuditLog,
  UserRole,
  SystemUser,
  PlayerSuggestion,
} from '../types';
import {
  LOTTERY_CONFIGS,
  formatCurrencyBRL,
  generateSmartDesdobramento,
  calculateCompanyMostPlayedNumbers,
  generateStatisticalSmartBet,
} from '../utils/lotteryMath';
import {
  Calculator,
  Plus,
  RefreshCw,
  ShieldCheck,
  Award,
  Hash,
  TrendingUp,
  Sparkles,
  ThumbsUp,
  Check,
  Building2,
} from 'lucide-react';

interface GamesAuditTabProps {
  currentUser: SystemUser;
  companies: Company[];
  company: Company;
  pool: Pool;
  games: LotteryGame[];
  suggestions: PlayerSuggestion[];
  purchases: QuotaPurchase[];
  auditLogs: AuditLog[];
  userRole: UserRole;
  onSelectCompanyTenant: (companyId: string) => void;
  onAddGames: (games: any[]) => Promise<void>;
  onCreateSuggestion: (payload: {
    numbers: number[];
    rationale: string;
  }) => Promise<void>;
  onSuggestionAction: (
    suggestionId: string,
    action: 'VOTE' | 'APPROVE_GAME',
    cost?: number,
    equivalentSimpleBets?: number
  ) => Promise<void>;
  onUpdateDrawnNumbers: (
    poolId: string,
    drawnNumbers: number[],
    prizeAmount: number
  ) => Promise<void>;
}

export const GamesAuditTab: React.FC<GamesAuditTabProps> = ({
  currentUser,
  companies,
  company,
  pool,
  games,
  suggestions,
  purchases,
  auditLogs,
  userRole,
  onSelectCompanyTenant,
  onAddGames,
  onCreateSuggestion,
  onSuggestionAction,
  onUpdateDrawnNumbers,
}) => {
  const lotteryConfig = LOTTERY_CONFIGS[pool.lotteryType];
  const poolGames = games.filter((g) => g.poolId === pool.id && g.companyId === company.id);
  const companySuggestions = suggestions.filter(
    (s) => s.poolId === pool.id && s.companyId === company.id
  );
  const confirmedPurchases = purchases.filter(
    (p) => p.poolId === pool.id && p.paymentStatus === 'CONFIRMED'
  );

  const totalNetPoolBudget = confirmedPurchases.reduce((acc, p) => acc + p.netPoolAmount, 0);
  const totalQuotasConfirmed = Math.max(
    1,
    confirmedPurchases.reduce((acc, p) => acc + p.quotasCount, 0)
  );
  const totalGamesCost = poolGames.reduce((acc, g) => acc + g.cost, 0);

  // Calculate Most Played Numbers by Players of THIS Company (Tenant)
  const companyMostPlayed = calculateCompanyMostPlayedNumbers(
    poolGames,
    companySuggestions,
    12
  );

  // Sub-section navigation inside the Company's Exclusive Betting Workspace
  const [activeSubSection, setActiveSubSection] = useState<
    'PALPITES' | 'PROBABILIDADES' | 'VOLANTES'
  >('PALPITES');

  // Player Suggestion ("Palpite de Jogo") State
  const [palpiteNumbers, setPalpiteNumbers] = useState<number[]>([]);
  const [palpiteRationale, setPalpiteRationale] = useState('');
  const [sendingPalpite, setSendingPalpite] = useState(false);

  // Mathematical Desdobramento Generator State
  const [universeCount, setUniverseCount] = useState<number>(
    pool.lotteryType === 'LOTOFACIL' ? 20 : 14
  );
  const [dozensPerTicket, setDozensPerTicket] = useState<number>(
    pool.lotteryType === 'LOTOFACIL' ? 17 : pool.lotteryType === 'QUINA' ? 8 : 8
  );
  const [ticketsToGenerate, setTicketsToGenerate] = useState<number>(3);
  const [previewBatch, setPreviewBatch] = useState<{
    universeNumbers: number[];
    tickets: { numbers: number[]; cost: number; betsEquivalent: number }[];
    totalCost: number;
  } | null>(null);

  // Official Result Checker / Simulator State
  const [drawnInput, setDrawnInput] = useState<string>(
    pool.drawnNumbers.map((n) => String(n).padStart(2, '0')).join(', ')
  );
  const [simulatedPrizeTotal, setSimulatedPrizeTotal] = useState<string>(
    String(pool.prizeTotalAmount || 185000)
  );
  const [savingGames, setSavingGames] = useState(false);

  const canManageGames = userRole === 'MANAGER' || userRole === 'SUPER_ADMIN';

  const togglePalpiteNumber = (num: number) => {
    if (palpiteNumbers.includes(num)) {
      setPalpiteNumbers(palpiteNumbers.filter((n) => n !== num));
    } else {
      if (palpiteNumbers.length >= lotteryConfig.maxNumbers) return;
      setPalpiteNumbers([...palpiteNumbers, num].sort((a, b) => a - b));
    }
  };

  const handleAutoFillStatisticalPalpite = (mode: 'HYBRID' | 'ALL_TIME' | 'COMPANY_TOP') => {
    if (mode === 'ALL_TIME') {
      const topHistorical = lotteryConfig.allTimeMostPlayed
        .slice(0, lotteryConfig.minNumbers)
        .map((x) => x.number)
        .sort((a, b) => a - b);
      setPalpiteNumbers(topHistorical);
      setPalpiteRationale(
        `Baseado nas ${lotteryConfig.minNumbers} dezenas mais sorteadas da história da ${lotteryConfig.name}.`
      );
    } else if (mode === 'COMPANY_TOP') {
      const topComp = companyMostPlayed.map((x) => x.number);
      const merged = generateStatisticalSmartBet(
        pool.lotteryType,
        lotteryConfig.minNumbers,
        topComp
      );
      setPalpiteNumbers(merged);
      setPalpiteRationale(
        `Baseado nas dezenas mais jogadas pelos colaboradores da ${company.name}.`
      );
    } else {
      const topComp = companyMostPlayed.map((x) => x.number);
      const hybrid = generateStatisticalSmartBet(
        pool.lotteryType,
        lotteryConfig.minNumbers,
        topComp
      );
      setPalpiteNumbers(hybrid);
      setPalpiteRationale(
        `Combinação estatística híbrida: Campeãs históricas dos sorteios + Favoritas dos colaboradores ${company.logoInitials}.`
      );
    }
  };

  const handleSubmitPalpite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (palpiteNumbers.length < lotteryConfig.minNumbers) return;
    setSendingPalpite(true);
    try {
      await onCreateSuggestion({
        numbers: palpiteNumbers,
        rationale:
          palpiteRationale.trim() ||
          `Palpite de ${palpiteNumbers.length} dezenas sugerido por ${currentUser.name} (${currentUser.jobTitle}).`,
      });
      setPalpiteNumbers([]);
      setPalpiteRationale('');
    } finally {
      setSendingPalpite(false);
    }
  };

  const handleRegisterPalpiteDirectlyAsGame = async () => {
    if (palpiteNumbers.length < lotteryConfig.minNumbers) return;
    const priceInfo = lotteryConfig.priceTable[palpiteNumbers.length] || {
      betsEquivalent: 1,
      price: lotteryConfig.baseSimpleBetPrice,
    };
    setSavingGames(true);
    try {
      await onAddGames([
        {
          gameMode:
            palpiteNumbers.length > lotteryConfig.minNumbers ? 'DESDOBRAMENTO' : 'SIMPLES',
          numbers: palpiteNumbers,
          equivalentSimpleBets: priceInfo.betsEquivalent,
          cost: priceInfo.price,
          lotericaReceiptCode: `TERM-${Math.floor(100000 + Math.random() * 900000)}-CX`,
        },
      ]);
      setPalpiteNumbers([]);
      setPalpiteRationale('');
      setActiveSubSection('VOLANTES');
    } finally {
      setSavingGames(false);
    }
  };

  const handleGeneratePreview = () => {
    const generated = generateSmartDesdobramento(
      pool.lotteryType,
      universeCount,
      dozensPerTicket,
      ticketsToGenerate
    );
    setPreviewBatch(generated);
  };

  const handleConfirmBatchRegistration = async () => {
    if (!previewBatch) return;
    setSavingGames(true);
    try {
      await onAddGames(
        previewBatch.tickets.map((t, idx) => ({
          gameMode: t.numbers.length > lotteryConfig.minNumbers ? 'DESDOBRAMENTO' : 'SIMPLES',
          numbers: t.numbers,
          equivalentSimpleBets: t.betsEquivalent,
          cost: t.cost,
          lotericaReceiptCode: `TERM-${Math.floor(100000 + Math.random() * 900000)}-CX-${idx + 1}`,
        }))
      );
      setPreviewBatch(null);
      setActiveSubSection('VOLANTES');
    } finally {
      setSavingGames(false);
    }
  };

  const handleSaveAuditResult = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedNums = drawnInput
      .split(/[\s,;-]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= lotteryConfig.totalPoolNumbers);
    if (parsedNums.length > 0) {
      await onUpdateDrawnNumbers(
        pool.id,
        parsedNums,
        Number(simulatedPrizeTotal) || 0
      );
    }
  };

  const prizeNumeric = Number(simulatedPrizeTotal) || 0;
  const prizePerQuota = prizeNumeric / totalQuotasConfirmed;

  return (
    <div className="px-4 py-4 space-y-5">
      {/* 1. MULTITENANT COMPANY SUMMARY CARD (Exact Image 2 "Resumo" Style) */}
      <div className="caixa-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#005CA9]">
            <Building2 className="w-4 h-4" />
            <span>Sala de Apostas do Grupo de Bolão</span>
          </div>
          <span className="text-[10px] font-mono-tabular font-semibold bg-[#EBF4FC] text-[#005CA9] px-2 py-0.5 rounded-[4px]">
            Tenant: {company.tenantSlug || company.id}
          </span>
        </div>

        {/* Tenant Switcher Dropdown */}
        <div>
          <select
            value={company.id}
            onChange={(e) => onSelectCompanyTenant(e.target.value)}
            className="caixa-input font-bold"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — Setor {c.segment}
              </option>
            ))}
          </select>
        </div>

        {/* Clean Key-Value Financial & Game Rows */}
        <div className="pt-2 border-t border-[#EDF2F7] space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Saldo líquido para jogos</span>
            <span className="font-mono-tabular font-bold text-[#008B47]">
              {formatCurrencyBRL(totalNetPoolBudget)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Palpites dos colaboradores</span>
            <span className="font-mono-tabular font-bold text-[#005CA9]">
              {companySuggestions.length} palpites
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Volantes registrados</span>
            <span className="font-mono-tabular font-bold text-[#333E48]">
              {poolGames.length} jogos ({formatCurrencyBRL(totalGamesCost)})
            </span>
          </div>
        </div>
      </div>

      {/* 2. 3-Column Service Cards for Sub-Sections */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-[#333E48]">
            Serviços de apostas
          </h2>
          <span className="text-xs font-bold text-[#005CA9]">
            {lotteryConfig.name}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setActiveSubSection('PALPITES')}
            className={`caixa-tile p-3 flex flex-col items-center justify-center text-center gap-2 ${
              activeSubSection === 'PALPITES' ? 'ring-1 ring-[#005CA9]' : ''
            }`}
          >
            <div className="caixa-icon-halo">
              <Sparkles className="w-5 h-5 text-[#005CA9]" />
            </div>
            <span className="font-display font-bold text-xs text-[#005CA9] leading-tight">
              Apostas e palpites
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubSection('PROBABILIDADES')}
            className={`caixa-tile p-3 flex flex-col items-center justify-center text-center gap-2 ${
              activeSubSection === 'PROBABILIDADES' ? 'ring-1 ring-[#005CA9]' : ''
            }`}
          >
            <div className="caixa-icon-halo">
              <TrendingUp className="w-5 h-5 text-[#005CA9]" />
            </div>
            <span className="font-display font-bold text-xs text-[#005CA9] leading-tight">
              Probabilidades
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubSection('VOLANTES')}
            className={`caixa-tile p-3 flex flex-col items-center justify-center text-center gap-2 ${
              activeSubSection === 'VOLANTES' ? 'ring-1 ring-[#005CA9]' : ''
            }`}
          >
            <div className="caixa-icon-halo">
              <Calculator className="w-5 h-5 text-[#005CA9]" />
            </div>
            <span className="font-display font-bold text-xs text-[#005CA9] leading-tight">
              Fechamentos ({poolGames.length})
            </span>
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SUB-SECTION 1: EXCLUSIVE COMPANY BETTING & PLAYER SUGGESTIONS         */}
      {/* ===================================================================== */}
      {activeSubSection === 'PALPITES' && (
        <div className="space-y-5">
          {/* Interactive Volante Card */}
          <div className="caixa-card p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-sm text-[#333E48]">
                  Volante Digital — {company.name}
                </h3>
                <p className="text-xs text-[#5F6C7B] mt-0.5">
                  Escolha de {lotteryConfig.minNumbers} a {lotteryConfig.maxNumbers} dezenas para dar seu palpite.
                </p>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-mono-tabular font-bold bg-[#EBF4FC] text-[#005CA9] rounded-[4px] shrink-0">
                {palpiteNumbers.length}/{lotteryConfig.minNumbers} DEZ
              </span>
            </div>

            {/* Smart Fillers */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleAutoFillStatisticalPalpite('ALL_TIME')}
                className="min-h-[34px] px-2 py-1 bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#D5E0EC] text-[10px] font-bold text-[#005CA9] rounded-[4px]"
              >
                + Campeãs História
              </button>
              <button
                type="button"
                onClick={() => handleAutoFillStatisticalPalpite('COMPANY_TOP')}
                className="min-h-[34px] px-2 py-1 bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#D5E0EC] text-[10px] font-bold text-[#005CA9] rounded-[4px]"
              >
                + Top do Grupo
              </button>
              <button
                type="button"
                onClick={() => handleAutoFillStatisticalPalpite('HYBRID')}
                className="min-h-[34px] px-2 py-1 bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[10px] font-bold text-[#005CA9] rounded-[4px]"
              >
                + Mistura Ideal
              </button>
            </div>

            {/* Number Grid */}
            <div className="grid grid-cols-10 gap-1.5 pt-1">
              {Array.from({ length: lotteryConfig.totalPoolNumbers }, (_, i) => i + 1).map(
                (num) => {
                  const selected = palpiteNumbers.includes(num);
                  const isCompanyFavorite = companyMostPlayed
                    .slice(0, 6)
                    .some((item) => item.number === num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => togglePalpiteNumber(num)}
                      className={`h-8 font-mono-tabular text-xs font-bold rounded-[4px] transition-colors ${
                        selected
                          ? 'bg-[#005CA9] text-white'
                          : isCompanyFavorite
                          ? 'bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6]'
                          : 'bg-[#F7F9FC] text-[#333E48] hover:bg-[#EDF2F7]'
                      }`}
                    >
                      {String(num).padStart(2, '0')}
                    </button>
                  );
                }
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#5F6C7B]">
              <span>Tons azuis claros = favoritos dos colegas de {company.name}</span>
              {palpiteNumbers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPalpiteNumbers([])}
                  className="text-[#005CA9] font-bold hover:underline"
                >
                  Limpar seleção
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitPalpite} className="space-y-2.5 pt-1 text-xs">
              <input
                type="text"
                value={palpiteRationale}
                onChange={(e) => setPalpiteRationale(e.target.value)}
                placeholder="Comentário sobre seu palpite (opcional)"
                className="caixa-input"
              />

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="submit"
                  disabled={palpiteNumbers.length < lotteryConfig.minNumbers || sendingPalpite}
                  className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] disabled:bg-slate-300 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enviar Palpite</span>
                </button>

                <button
                  type="button"
                  disabled={palpiteNumbers.length < lotteryConfig.minNumbers || savingGames}
                  onClick={handleRegisterPalpiteDirectlyAsGame}
                  className="min-h-[42px] bg-[#008B47] hover:bg-emerald-800 disabled:bg-slate-300 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Oficializar Jogo</span>
                </button>
              </div>
            </form>
          </div>

          {/* Mural de Palpites dos Jogadores */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#333E48]">
                Palpites dos colaboradores ({companySuggestions.length})
              </h3>
              <span className="text-xs font-bold text-[#005CA9]">Votação aberta</span>
            </div>

            {companySuggestions.length === 0 ? (
              <div className="caixa-card p-6 text-center text-xs text-[#5F6C7B]">
                Nenhum palpite enviado ainda neste Grupo de Bolão. Escolha suas dezenas acima!
              </div>
            ) : (
              <div className="space-y-3">
                {companySuggestions.map((sug) => {
                  const priceInfo = lotteryConfig.priceTable[sug.numbers.length] || {
                    betsEquivalent: 1,
                    price: lotteryConfig.baseSimpleBetPrice,
                  };
                  return (
                    <div key={sug.id} className="caixa-card p-4 space-y-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#333E48]">
                            {sug.userName}{' '}
                            <span className="font-normal text-[#5F6C7B]">
                              ({sug.userJobTitle})
                            </span>
                          </div>
                          {sug.rationale && (
                            <p className="text-xs text-[#5F6C7B] mt-0.5">{sug.rationale}</p>
                          )}
                        </div>
                        {sug.approvedAsOfficialGame ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-[#008B47] font-bold text-[10px] rounded-[4px] shrink-0">
                            OFICIALIZADO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-[#EBF4FC] text-[#005CA9] font-semibold text-[10px] rounded-[4px] shrink-0">
                            EM VOTAÇÃO
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {sug.numbers.map((num) => (
                          <span
                            key={num}
                            className="w-7 h-7 font-mono-tabular text-xs font-bold bg-[#EBF4FC] text-[#005CA9] flex items-center justify-center rounded-[4px]"
                          >
                            {String(num).padStart(2, '0')}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#EDF2F7]">
                        <button
                          type="button"
                          onClick={() => onSuggestionAction(sug.id, 'VOTE')}
                          className="px-3 py-1.5 bg-[#F7F9FC] hover:bg-[#EBF4FC] text-[#005CA9] font-bold text-xs rounded-[4px] flex items-center gap-1.5"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Apoiar ({sug.votes})</span>
                        </button>

                        {!sug.approvedAsOfficialGame && canManageGames && (
                          <button
                            type="button"
                            onClick={() =>
                              onSuggestionAction(
                                sug.id,
                                'APPROVE_GAME',
                                priceInfo.price,
                                priceInfo.betsEquivalent
                              )
                            }
                            className="px-3 py-1.5 bg-[#005CA9] text-white font-bold text-xs rounded-[4px]"
                          >
                            Aprovar volante ({formatCurrencyBRL(priceInfo.price)})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-SECTION 2: PROBABILITY & MOST PLAYED NUMBERS                      */}
      {/* ===================================================================== */}
      {activeSubSection === 'PROBABILIDADES' && (
        <div className="space-y-5">
          {/* A. All-Time Most Played / Drawn Numbers in History */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#333E48]">
                Mais sorteados na história
              </h3>
              <span className="text-xs font-bold text-[#005CA9]">
                {lotteryConfig.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {lotteryConfig.allTimeMostPlayed.map((item, idx) => (
                <div
                  key={item.number}
                  className="caixa-card p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="caixa-icon-halo w-9 h-9 font-mono-tabular font-extrabold text-xs">
                      {String(item.number).padStart(2, '0')}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#5F6C7B]">
                        #{idx + 1} histórico
                      </div>
                      <div className="font-mono-tabular font-bold text-xs text-[#333E48]">
                        {item.drawnCount} sorteios
                      </div>
                    </div>
                  </div>
                  <span className="font-mono-tabular font-bold text-xs text-[#008B47]">
                    {item.frequencyPct}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* B. Most Played Numbers by Players of THIS Company */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#333E48]">
                Mais jogados em {company.name}
              </h3>
              <span className="text-xs font-bold text-[#005CA9]">Ranking interno</span>
            </div>

            <div className="caixa-card p-4 space-y-3">
              {companyMostPlayed.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#5F6C7B]">
                  Ainda não há jogos suficientes neste Grupo de Bolão para calcular o ranking.
                </div>
              ) : (
                companyMostPlayed.map((item, idx) => (
                  <div key={item.number} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-[#EBF4FC] text-[#005CA9] font-mono-tabular font-bold text-[11px] flex items-center justify-center rounded-[4px]">
                          {String(item.number).padStart(2, '0')}
                        </span>
                        <span className="font-semibold text-[#333E48]">
                          Dezena {String(item.number).padStart(2, '0')} ({idx + 1}º no grupo)
                        </span>
                      </div>
                      <span className="font-mono-tabular font-bold text-[#005CA9]">
                        {item.count} jogo(s) · {item.percentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#EDF2F7] rounded-[4px] overflow-hidden">
                      <div
                        className="h-full bg-[#005CA9]"
                        style={{ width: `${Math.max(12, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* C. Official Mathematical Probability Table */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#333E48]">
                Chances matemáticas
              </h3>
              <span className="text-xs text-[#5F6C7B]">Tabela oficial de probabilidades</span>
            </div>

            <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
              {Object.entries(lotteryConfig.priceTable).map(([dez, info]) => (
                <div
                  key={dez}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-[#333E48]">
                      {dez} dezenas ({info.betsEquivalent}x apostas)
                    </div>
                    <div className="text-[11px] text-[#5F6C7B]">
                      Chance: 1 em {info.probabilityOneIn.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#005CA9]">
                    {formatCurrencyBRL(info.price)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-SECTION 3: MATHEMATICAL CLOSURES, OFFICIAL VOLANTES & AUDIT       */}
      {/* ===================================================================== */}
      {activeSubSection === 'VOLANTES' && (
        <div className="space-y-5">
          {/* Smart Mathematical Closure Generator */}
          <div className="caixa-card p-4 space-y-3.5 text-xs">
            <div>
              <h3 className="font-display font-bold text-sm text-[#333E48]">
                Gerador de Fechamentos Matemáticos
              </h3>
              <p className="text-xs text-[#5F6C7B] mt-0.5">
                Gere combinações inteligentes equilibrando dezenas pares, ímpares e quadrantes.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-[#333E48] mb-1 text-[11px]">
                  Universo cercado
                </label>
                <input
                  type="number"
                  min={lotteryConfig.minNumbers}
                  max={lotteryConfig.totalPoolNumbers}
                  value={universeCount}
                  onChange={(e) => setUniverseCount(Number(e.target.value))}
                  className="caixa-input font-mono-tabular font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#333E48] mb-1 text-[11px]">
                  Dezenas/volante
                </label>
                <select
                  value={dozensPerTicket}
                  onChange={(e) => setDozensPerTicket(Number(e.target.value))}
                  className="caixa-input font-mono-tabular font-bold px-1.5"
                >
                  {Object.entries(lotteryConfig.priceTable).map(([dez, info]) => (
                    <option key={dez} value={dez}>
                      {dez} dez ({formatCurrencyBRL(info.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#333E48] mb-1 text-[11px]">
                  Qtd. volantes
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={ticketsToGenerate}
                  onChange={(e) =>
                    setTicketsToGenerate(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="caixa-input font-mono-tabular font-bold"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGeneratePreview}
              className="w-full min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Simular Fechamento Matemático</span>
            </button>

            {previewBatch && (
              <div className="pt-3 border-t border-[#EDF2F7] space-y-2.5">
                <div className="text-xs text-[#5F6C7B]">
                  Universo cercado:{' '}
                  <strong className="font-mono-tabular text-[#005CA9]">
                    {previewBatch.universeNumbers
                      .map((n) => String(n).padStart(2, '0'))
                      .join(' ')}
                  </strong>
                </div>

                <div className="divide-y divide-[#EDF2F7]">
                  {previewBatch.tickets.map((t, i) => (
                    <div
                      key={i}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-mono-tabular font-bold text-[#333E48]">
                        Jogo #{i + 1}: [
                        {t.numbers.map((n) => String(n).padStart(2, '0')).join(' - ')}]
                      </span>
                      <span className="font-mono-tabular text-[#5F6C7B] shrink-0">
                        {formatCurrencyBRL(t.cost)}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={savingGames}
                  onClick={handleConfirmBatchRegistration}
                  className="w-full min-h-[42px] bg-[#008B47] hover:bg-emerald-800 text-white font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Confirmar {previewBatch.tickets.length} Volante(s) no Bolão
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Registered Volantes & Automatic Result Auditor */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#333E48]">
                Volantes oficiais ({poolGames.length})
              </h3>
              <span className="text-xs font-bold text-[#008B47]">
                Rateio: {formatCurrencyBRL(prizePerQuota)}/cota
              </span>
            </div>

            <div className="caixa-card p-4 space-y-3 text-xs">
              <form onSubmit={handleSaveAuditResult} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-[#333E48] mb-1">
                      Dezenas sorteadas oficiais
                    </label>
                    <input
                      type="text"
                      value={drawnInput}
                      onChange={(e) => setDrawnInput(e.target.value)}
                      className="caixa-input font-mono-tabular font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#333E48] mb-1">
                      Prêmio simulado (R$)
                    </label>
                    <input
                      type="number"
                      value={simulatedPrizeTotal}
                      onChange={(e) => setSimulatedPrizeTotal(e.target.value)}
                      className="caixa-input font-mono-tabular font-bold text-[#008B47]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full min-h-[38px] bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] font-bold rounded-[4px]"
                >
                  Atualizar Conferência de Acertos
                </button>
              </form>
            </div>

            <div className="space-y-3">
              {poolGames.map((game, index) => {
                const hits = game.numbers.filter((n) => pool.drawnNumbers.includes(n));
                return (
                  <div key={game.id} className="caixa-card p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#333E48]">
                        Volante #{String(index + 1).padStart(2, '0')} · {game.dozensCount} dezenas
                      </span>
                      <span className="font-mono-tabular font-bold text-[#008B47] bg-emerald-50 px-2 py-0.5 text-[10px] rounded-[4px]">
                        {hits.length} ACERTO(S)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {game.numbers.map((num) => {
                        const isHit = pool.drawnNumbers.includes(num);
                        return (
                          <span
                            key={num}
                            className={`w-7 h-7 font-mono-tabular text-xs font-bold flex items-center justify-center rounded-[4px] ${
                              isHit
                                ? 'bg-[#008B47] text-white'
                                : 'bg-[#F7F9FC] text-[#333E48]'
                            }`}
                          >
                            {String(num).padStart(2, '0')}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#5F6C7B] font-mono-tabular pt-1 border-t border-[#EDF2F7]">
                      <span>Recibo: {game.lotericaReceiptCode}</span>
                      <span className="font-bold text-[#333E48]">
                        {formatCurrencyBRL(game.cost)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Audit Trail */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#333E48]">
                Auditoria de integridade
              </h3>
              <ShieldCheck className="w-4 h-4 text-[#005CA9]" />
            </div>

            <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
              {auditLogs
                .filter((l) => !l.companyId || l.companyId === company.id)
                .slice(0, 5)
                .map((log) => (
                  <div key={log.id} className="py-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-[#5F6C7B]">
                      <span className="font-bold text-[#333E48]">{log.actorName}</span>
                      <span className="font-mono-tabular">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-[#5F6C7B] leading-snug">{log.description}</p>
                    <div className="flex items-center gap-1 text-[10px] font-mono-tabular text-[#005CA9]">
                      <Hash className="w-3 h-3" />
                      <span className="truncate">{log.integrityHash}</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
