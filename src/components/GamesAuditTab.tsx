import React, { useState, useRef } from 'react';
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
  calculateCompanyMostPlayedNumbers,
  generateStatisticalSmartBet,
} from '../utils/lotteryMath';
import {
  findPastDrawMatch,
  getInitialsFromName,
} from '../utils/historicalDraws';
import {
  Plus,
  ThumbsUp,
  Check,
  Lock,
  Edit3,
  AlertTriangle,
  Sparkles,
  Printer,
  X,
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
    action: 'VOTE' | 'APPROVE_GAME' | 'EDIT_NUMBERS',
    cost?: number,
    equivalentSimpleBets?: number,
    numbers?: number[],
    rationale?: string
  ) => Promise<void>;
  onUpdateDrawnNumbers: (
    poolId: string,
    drawnNumbers: number[],
    prizeAmount: number
  ) => Promise<void>;
  onOpenStatsTab?: () => void;
  onOpenPrintTab?: () => void;
}

export const GamesAuditTab: React.FC<GamesAuditTabProps> = ({
  currentUser,
  company,
  pool,
  games,
  suggestions,
  purchases,
  userRole,
  onAddGames,
  onCreateSuggestion,
  onSuggestionAction,
  onOpenStatsTab,
  onOpenPrintTab,
}) => {
  const lotteryConfig = LOTTERY_CONFIGS[pool.lotteryType];
  const volanteRef = useRef<HTMLDivElement | null>(null);

  const poolGames = games.filter(
    (g) => g.poolId === pool.id && g.companyId === company.id
  );
  const companySuggestions = suggestions.filter(
    (s) => s.poolId === pool.id && s.companyId === company.id
  );
  const pendingSuggestions = companySuggestions.filter(
    (s) => !s.approvedAsOfficialGame
  );
  const approvedSuggestions = companySuggestions.filter(
    (s) => !!s.approvedAsOfficialGame
  );

  const confirmedPurchases = purchases.filter(
    (p) => p.poolId === pool.id && p.paymentStatus === 'CONFIRMED'
  );

  const totalNetPoolBudget = confirmedPurchases.reduce(
    (acc, p) => acc + p.netPoolAmount,
    0
  );
  const totalGamesCost = poolGames.reduce((acc, g) => acc + g.cost, 0);
  const remainingBalanceForGames = Math.max(0, totalNetPoolBudget - totalGamesCost);

  const companyMostPlayed = calculateCompanyMostPlayedNumbers(
    poolGames,
    companySuggestions,
    12
  );

  const cleanUserCpf = currentUser.cpf.replace(/\D/g, '');
  const isOrganizer =
    userRole === 'MANAGER' ||
    userRole === 'SUPER_ADMIN' ||
    company.managerId === currentUser.id ||
    company.managerEmail.toLowerCase() === currentUser.email.toLowerCase() ||
    company.managerCpf.replace(/\D/g, '') === cleanUserCpf ||
    company.managerName.toLowerCase() === currentUser.name.toLowerCase();

  const isPayingParticipant = confirmedPurchases.some(
    (p) =>
      p.participantCpf.replace(/\D/g, '') === cleanUserCpf ||
      p.participantEmail.toLowerCase() === currentUser.email.toLowerCase() ||
      p.participantName.toLowerCase() === currentUser.name.toLowerCase()
  );

  const canElaborateGame = isOrganizer || isPayingParticipant;

  // Volante Digital State (Create or Edit own Pending Game)
  const [palpiteNumbers, setPalpiteNumbers] = useState<number[]>([]);
  const [palpiteRationale, setPalpiteRationale] = useState('');
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(
    null
  );
  const [submittingGame, setSubmittingGame] = useState(false);

  const isAuthorOfSuggestion = (sug: PlayerSuggestion) =>
    sug.userId === currentUser.id ||
    sug.userName.trim().toLowerCase() === currentUser.name.trim().toLowerCase();

  const togglePalpiteNumber = (num: number) => {
    if (palpiteNumbers.includes(num)) {
      setPalpiteNumbers(palpiteNumbers.filter((n) => n !== num));
    } else {
      if (palpiteNumbers.length >= lotteryConfig.maxNumbers) return;
      setPalpiteNumbers([...palpiteNumbers, num].sort((a, b) => a - b));
    }
  };

  const handleAutoFillStatisticalPalpite = (
    mode: 'HYBRID' | 'ALL_TIME' | 'COMPANY_TOP'
  ) => {
    if (mode === 'ALL_TIME') {
      const topHistorical = lotteryConfig.allTimeMostPlayed
        .slice(0, lotteryConfig.minNumbers)
        .map((x) => x.number)
        .sort((a, b) => a - b);
      setPalpiteNumbers(topHistorical);
    } else if (mode === 'COMPANY_TOP') {
      const topComp = companyMostPlayed.map((x) => x.number);
      const merged = generateStatisticalSmartBet(
        pool.lotteryType,
        lotteryConfig.minNumbers,
        topComp
      );
      setPalpiteNumbers(merged);
    } else {
      const topComp = companyMostPlayed.map((x) => x.number);
      const hybrid = generateStatisticalSmartBet(
        pool.lotteryType,
        lotteryConfig.minNumbers,
        topComp
      );
      setPalpiteNumbers(hybrid);
    }
  };

  const handleStartEditSuggestion = (sug: PlayerSuggestion) => {
    if (sug.approvedAsOfficialGame || !isAuthorOfSuggestion(sug)) return;
    setEditingSuggestionId(sug.id);
    setPalpiteNumbers([...sug.numbers].sort((a, b) => a - b));
    setPalpiteRationale(sug.rationale || '');
    volanteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelEdit = () => {
    setEditingSuggestionId(null);
    setPalpiteNumbers([]);
    setPalpiteRationale('');
  };

  const handleSubmitGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (palpiteNumbers.length < lotteryConfig.minNumbers) return;
    setSubmittingGame(true);
    try {
      if (editingSuggestionId) {
        await onSuggestionAction(
          editingSuggestionId,
          'EDIT_NUMBERS',
          undefined,
          undefined,
          palpiteNumbers,
          palpiteRationale.trim() ||
            `Jogo atualizado por ${currentUser.name} (${palpiteNumbers.length} dezenas).`
        );
        setEditingSuggestionId(null);
      } else {
        await onCreateSuggestion({
          numbers: palpiteNumbers,
          rationale:
            palpiteRationale.trim() ||
            `Jogo elaborado por ${currentUser.name}.`,
        });
      }
      setPalpiteNumbers([]);
      setPalpiteRationale('');
    } finally {
      setSubmittingGame(false);
    }
  };

  const handleCreateApprovedDirectly = async () => {
    if (!isOrganizer || palpiteNumbers.length < lotteryConfig.minNumbers) return;
    const priceInfo = lotteryConfig.priceTable[palpiteNumbers.length] || {
      betsEquivalent: 1,
      price: lotteryConfig.baseSimpleBetPrice,
    };
    setSubmittingGame(true);
    try {
      await onAddGames([
        {
          gameMode:
            palpiteNumbers.length > lotteryConfig.minNumbers
              ? 'DESDOBRAMENTO'
              : 'SIMPLES',
          numbers: palpiteNumbers,
          equivalentSimpleBets: priceInfo.betsEquivalent,
          cost: priceInfo.price,
          lotericaReceiptCode: `TERM-${Math.floor(100000 + Math.random() * 900000)}-CX`,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorAvatar:
            currentUser.avatarInitials || getInitialsFromName(currentUser.name),
        },
      ]);
      setPalpiteNumbers([]);
      setPalpiteRationale('');
    } finally {
      setSubmittingGame(false);
    }
  };

  const drawDateFormatted = new Date(pool.endDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 1. RESUMO FINANCEIRO DE JOGOS DO BOLÃO + BOTÃO IMPRIMIR */}
      <div className="caixa-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#EDF2F7]">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-[#005CA9] block">
              Concurso {pool.contestNumber} - {drawDateFormatted}
            </span>
            <h1 className="font-display font-bold text-sm text-[#1E293B] truncate">
              Jogos — {pool.title}
            </h1>
            <p className="text-xs text-[#5F6C7B] mt-0.5">
              Jogos elaborados pelo organizador e apostadores pagantes
            </p>
          </div>
          <span className="text-[11px] font-bold text-[#005CA9] shrink-0">
            {lotteryConfig.name}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-[4px] bg-[#F7F9FC]">
            <span className="text-[10px] text-[#5F6C7B] block">Caixa Líquido</span>
            <span className="font-mono-tabular font-bold text-[#333E48]">
              {formatCurrencyBRL(totalNetPoolBudget)}
            </span>
          </div>
          <div className="p-2.5 rounded-[4px] bg-[#F7F9FC]">
            <span className="text-[10px] text-[#5F6C7B] block">
              Jogos Travados
            </span>
            <span className="font-mono-tabular font-bold text-[#005CA9]">
              {formatCurrencyBRL(totalGamesCost)}
            </span>
          </div>
          <div className="p-2.5 rounded-[4px] bg-[#F0FDF4]">
            <span className="text-[10px] text-[#008B47] block font-semibold">
              Saldo Livre
            </span>
            <span className="font-mono-tabular font-bold text-[#008B47]">
              {formatCurrencyBRL(remainingBalanceForGames)}
            </span>
          </div>
        </div>

        {/* Botão Imprimir (Só fica ativo se houver jogo travado / definido para aposta) */}
        <div className="pt-1">
          <button
            type="button"
            disabled={poolGames.length === 0}
            onClick={() => {
              if (poolGames.length > 0 && onOpenPrintTab) {
                onOpenPrintTab();
              }
            }}
            className={`w-full h-10 px-3 rounded-[4px] font-display font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
              poolGames.length > 0
                ? 'bg-[#005CA9] hover:bg-[#004A87] text-white cursor-pointer shadow-xs'
                : 'bg-[#EDF2F7] text-[#94A3B8] border border-[#D5E0EC] cursor-not-allowed'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>
              {poolGames.length > 0
                ? `Imprimir (${poolGames.length} jogo${
                    poolGames.length === 1 ? '' : 's'
                  } travado${poolGames.length === 1 ? '' : 's'})`
                : 'Imprimir (Aguardando jogo travado)'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. ELABORAR OU EDITAR JOGO (Sem alerta instantâneo para não entregar antes de divulgar!) */}
      <div ref={volanteRef} className="caixa-card p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-[4px] bg-[#005CA9] text-white font-display font-extrabold text-xs flex items-center justify-center shrink-0">
              {currentUser.avatarInitials || getInitialsFromName(currentUser.name)}
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm text-[#1E293B]">
                {editingSuggestionId
                  ? 'Editar Meu Jogo Pendente'
                  : 'Elaborar Jogo para o Bolão'}
              </h2>
              <p className="text-[11px] text-[#5F6C7B] truncate">
                Autor: <strong className="text-[#333E48]">{currentUser.name}</strong>{' '}
                ({isOrganizer ? 'Organizador' : isPayingParticipant ? 'Apostador Pagante' : 'Participante'})
              </p>
            </div>
          </div>

          <span className="font-mono-tabular font-bold text-xs text-[#005CA9] shrink-0">
            {palpiteNumbers.length}/{lotteryConfig.minNumbers} dez
          </span>
        </div>

        {editingSuggestionId && (
          <div className="p-2.5 rounded-[4px] bg-[#EBF4FC] border border-[#CBE2F6] flex items-center justify-between gap-2 text-xs text-[#005CA9]">
            <span className="font-semibold">
              Você está alterando as dezenas do seu jogo ainda não aprovado.
            </span>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="p-1 hover:bg-white/60 rounded-[4px] text-[#005CA9] cursor-pointer"
              title="Cancelar edição"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!canElaborateGame && (
          <div className="p-2.5 rounded-[4px] bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            Apenas o organizador e apostadores com pagamento confirmado têm prioridade na aprovação, mas você já pode montar e divulgar seu jogo abaixo.
          </div>
        )}

        {/* Sugestões rápidas de preenchimento */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleAutoFillStatisticalPalpite('ALL_TIME')}
            className="min-h-[32px] px-2 py-1 bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#D5E0EC] text-[10px] font-bold text-[#005CA9] rounded-[4px] cursor-pointer"
          >
            + Campeãs
          </button>
          <button
            type="button"
            onClick={() => handleAutoFillStatisticalPalpite('COMPANY_TOP')}
            className="min-h-[32px] px-2 py-1 bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#D5E0EC] text-[10px] font-bold text-[#005CA9] rounded-[4px] cursor-pointer"
          >
            + Top Grupo
          </button>
          <button
            type="button"
            onClick={() => handleAutoFillStatisticalPalpite('HYBRID')}
            className="min-h-[32px] px-2 py-1 bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[10px] font-bold text-[#005CA9] rounded-[4px] cursor-pointer"
          >
            + Surpresinha
          </button>
        </div>

        {/* Grade de Dezenas do Volante */}
        <div className="grid grid-cols-10 gap-1.5 pt-1">
          {Array.from(
            { length: lotteryConfig.totalPoolNumbers },
            (_, i) => i + 1
          ).map((num) => {
            const selected = palpiteNumbers.includes(num);
            return (
              <button
                key={num}
                type="button"
                onClick={() => togglePalpiteNumber(num)}
                className={`h-8 font-mono-tabular text-xs font-bold rounded-[4px] transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#005CA9] text-white'
                    : 'bg-[#F7F9FC] text-[#333E48] hover:bg-[#EBF4FC]'
                }`}
              >
                {String(num).padStart(2, '0')}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#5F6C7B]">
          <span>
            Selecione de {lotteryConfig.minNumbers} a {lotteryConfig.maxNumbers}{' '}
            dezenas
          </span>
          {palpiteNumbers.length > 0 && (
            <button
              type="button"
              onClick={() => setPalpiteNumbers([])}
              className="text-[#005CA9] font-bold hover:underline cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        <form onSubmit={handleSubmitGame} className="space-y-2.5 pt-1 text-xs">
          <input
            type="text"
            value={palpiteRationale}
            onChange={(e) => setPalpiteRationale(e.target.value)}
            placeholder="Comentário ou justificativa do seu jogo (opcional)"
            className="caixa-input"
          />

          {editingSuggestionId ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="min-h-[40px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  palpiteNumbers.length < lotteryConfig.minNumbers ||
                  submittingGame
                }
                className="min-h-[40px] bg-[#005CA9] hover:bg-[#004A87] disabled:bg-slate-300 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar</span>
              </button>
            </div>
          ) : (
            <div
              className={`grid ${
                isOrganizer ? 'grid-cols-2' : 'grid-cols-1'
              } gap-2`}
            >
              <button
                type="submit"
                disabled={
                  palpiteNumbers.length < lotteryConfig.minNumbers ||
                  submittingGame
                }
                className="min-h-[40px] bg-[#005CA9] hover:bg-[#004A87] disabled:bg-slate-300 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Indicar Jogo</span>
              </button>

              {isOrganizer && (
                <button
                  type="button"
                  disabled={
                    palpiteNumbers.length < lotteryConfig.minNumbers ||
                    submittingGame
                  }
                  onClick={handleCreateApprovedDirectly}
                  className="min-h-[40px] bg-[#008B47] hover:bg-[#00743B] disabled:bg-slate-300 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Aprovar Direto</span>
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      {/* ===================================================================== */}
      {/* 3. JOGOS PENDENTES DE APROVAÇÃO (Com Likes, Indicação Compacta e Edição só pelo Autor) */}
      {/* ===================================================================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#005CA9]" />
            <span>
              Jogos Pendentes de Aprovação ({pendingSuggestions.length})
            </span>
          </h2>
          <span className="text-[11px] text-[#5F6C7B]">
            Curtidas abertas
          </span>
        </div>

        {pendingSuggestions.length === 0 ? (
          <div className="caixa-card p-5 text-center text-xs text-[#5F6C7B]">
            Nenhum jogo pendente de aprovação no momento. Indique um jogo acima!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingSuggestions.map((sug) => {
              const priceInfo = lotteryConfig.priceTable[sug.numbers.length] || {
                betsEquivalent: 1,
                price: lotteryConfig.baseSimpleBetPrice,
              };
              const isAuthor = isAuthorOfSuggestion(sug);
              const pastMatch = findPastDrawMatch(
                pool.lotteryType,
                sug.numbers,
                sug.userName
              );

              return (
                <div
                  key={sug.id}
                  className={`caixa-card p-4 space-y-3 text-xs ${
                    pastMatch ? 'ring-1 ring-amber-400' : ''
                  }`}
                >
                  {/* Cabeçalho: Avatar + Nome de quem elaborou o jogo */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-display font-extrabold text-xs flex items-center justify-center shrink-0">
                        {sug.userAvatar || getInitialsFromName(sug.userName)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1E293B] truncate">
                          {sug.userName}
                        </div>
                        <div className="text-[11px] text-[#5F6C7B]">
                          Elaborador · {sug.userJobTitle}
                          {sug.updatedAt ? ' · Editado' : ''}
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-[#D97706] shrink-0">
                      Pendente
                    </span>
                  </div>

                  {sug.rationale && (
                    <p className="text-xs text-[#5F6C7B] leading-snug">
                      "{sug.rationale}"
                    </p>
                  )}

                  {/* Dezenas do Jogo */}
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

                  {/* INDICAÇÃO COMPACTA DE JOGO JÁ SORTEADO (A resenha completa fica em Estatísticas) */}
                  {pastMatch && (
                    <div className="px-2.5 py-1.5 rounded-[4px] bg-[#FFFBEB] border border-amber-300 flex items-center justify-between gap-2 text-[11px] text-[#92400E]">
                      <span className="inline-flex items-center gap-1.5 font-semibold truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                        <span className="truncate">
                          Já sorteado no Conc. {pastMatch.contest.contestNumber} ({pastMatch.contest.date})
                        </span>
                      </span>
                      {onOpenStatsTab && (
                        <button
                          type="button"
                          onClick={onOpenStatsTab}
                          className="font-bold text-[#005CA9] hover:underline shrink-0 cursor-pointer"
                        >
                          Ver estatísticas
                        </button>
                      )}
                    </div>
                  )}

                  {/* Barra de Ações: Like (todos), Editar (somente o elaborador enquanto não aprovado) e Aprovar (organizador) */}
                  <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSuggestionAction(sug.id, 'VOTE')}
                        className="h-8 px-2.5 bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#D5E0EC] text-[#005CA9] font-bold text-xs rounded-[4px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Curtir ({sug.votes})</span>
                      </button>

                      {isAuthor ? (
                        <button
                          type="button"
                          onClick={() => handleStartEditSuggestion(sug)}
                          className="h-8 px-2.5 bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] font-bold text-xs rounded-[4px] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#5F6C7B]">
                          Só {sug.userName.split(' ')[0]} pode editar
                        </span>
                      )}
                    </div>

                    {isOrganizer && (
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
                        className="h-8 px-3 bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs rounded-[4px] flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aprovar ({formatCurrencyBRL(priceInfo.price)})</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 4. JOGOS DEFINIDOS / APROVADOS PARA O SORTEIO (Dezenas Travadas!)     */}
      {/* ===================================================================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-[#008B47]" />
            <span>
              Jogos Definidos para {drawDateFormatted} ({poolGames.length})
            </span>
          </h2>
          {poolGames.length > 0 && onOpenPrintTab ? (
            <button
              type="button"
              onClick={onOpenPrintTab}
              className="h-7 px-2.5 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-[#94A3B8]">
              Sem jogos travados
            </span>
          )}
        </div>

        <p className="text-[11px] text-[#5F6C7B]">
          Após aprovado pelo organizador, o elaborador não pode mais alterar as
          dezenas do jogo.
        </p>

        {poolGames.length === 0 && approvedSuggestions.length === 0 ? (
          <div className="caixa-card p-5 text-center text-xs text-[#5F6C7B]">
            Nenhum volante aprovado ainda para este bolão.
          </div>
        ) : (
          <div className="space-y-3">
            {poolGames.map((game, index) => {
              const authorName = game.authorName || company.managerName;
              const authorAvatar =
                game.authorAvatar || getInitialsFromName(authorName);
              const matchingSuggestion = approvedSuggestions.find(
                (s) =>
                  s.numbers.length === game.numbers.length &&
                  s.numbers.every((n, idx) => n === game.numbers[idx])
              );
              const likesCount = matchingSuggestion?.votes || 1;
              const pastMatch = findPastDrawMatch(
                pool.lotteryType,
                game.numbers,
                authorName
              );

              return (
                <div
                  key={game.id}
                  className="caixa-card p-4 space-y-2.5 text-xs border-l-4 border-l-[#008B47]"
                >
                  {/* Cabeçalho: Avatar + Nome do Elaborador + Selo Aprovado/Travado */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-[4px] bg-[#008B47] text-white font-display font-extrabold text-xs flex items-center justify-center shrink-0">
                        {authorAvatar}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1E293B] truncate">
                          {authorName}
                        </div>
                        <div className="text-[11px] text-[#5F6C7B]">
                          Volante #{String(index + 1).padStart(2, '0')} ·{' '}
                          {game.dozensCount} dezenas · Data: {drawDateFormatted}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#008B47] shrink-0">
                      <Lock className="w-3 h-3" />
                      <span>Aprovado</span>
                    </span>
                  </div>

                  {/* Dezenas Definidas */}
                  <div className="flex flex-wrap gap-1.5">
                    {game.numbers.map((num) => (
                      <span
                        key={num}
                        className="w-7 h-7 font-mono-tabular text-xs font-bold bg-[#008B47] text-white flex items-center justify-center rounded-[4px]"
                      >
                        {String(num).padStart(2, '0')}
                      </span>
                    ))}
                  </div>

                  {/* INDICAÇÃO COMPACTA DE JOGO JÁ SORTEADO (A resenha completa fica em Estatísticas) */}
                  {pastMatch && (
                    <div className="px-2.5 py-1.5 rounded-[4px] bg-[#FFFBEB] border border-amber-300 flex items-center justify-between gap-2 text-[11px] text-[#92400E]">
                      <span className="inline-flex items-center gap-1.5 font-semibold truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                        <span className="truncate">
                          Já sorteado no Conc. {pastMatch.contest.contestNumber} ({pastMatch.contest.date})
                        </span>
                      </span>
                      {onOpenStatsTab && (
                        <button
                          type="button"
                          onClick={onOpenStatsTab}
                          className="font-bold text-[#005CA9] hover:underline shrink-0 cursor-pointer"
                        >
                          Ver estatísticas
                        </button>
                      )}
                    </div>
                  )}

                  {/* Rodapé com Curtidas, Custo e Aviso de Trava */}
                  <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between text-[11px] text-[#5F6C7B]">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#005CA9]">
                        <ThumbsUp className="w-3 h-3" />
                        <span>{likesCount} curtida(s)</span>
                      </span>
                      <span>Edição bloqueada</span>
                    </div>
                    <span className="font-mono-tabular font-bold text-[#1E293B]">
                      {formatCurrencyBRL(game.cost)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
