import React, { useState } from 'react';
import {
  Company,
  Pool,
  Participant,
  LotteryGame,
  PlayerSuggestion,
  QuotaPurchase,
} from '../types';
import {
  LOTTERY_CONFIGS,
  formatCurrencyBRL,
  calculateCompanyMostPlayedNumbers,
} from '../utils/lotteryMath';
import {
  findPastDrawMatch,
  buildAuthorLeaderboard,
  findCopycatPairs,
  getInitialsFromName,
} from '../utils/historicalDraws';
import {
  maskCurrencyBRL,
  numberToCurrencyMask,
  parseCurrencyBRL,
} from '../utils/inputMasks';
import {
  Flame,
  Trophy,
  AlertTriangle,
  Users,
  ThumbsUp,
  RefreshCw,
  Award,
  Landmark,
  FileText,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Scale,
} from 'lucide-react';

interface PoolStatsTabProps {
  company: Company;
  pool: Pool;
  participants?: Participant[];
  games: LotteryGame[];
  suggestions: PlayerSuggestion[];
  purchases: QuotaPurchase[];
  onUpdateDrawnNumbers: (
    poolId: string,
    drawnNumbers: number[],
    prizeAmount: number
  ) => Promise<void>;
}

export const PoolStatsTab: React.FC<PoolStatsTabProps> = ({
  company,
  pool,
  participants = [],
  games,
  suggestions,
  purchases,
  onUpdateDrawnNumbers,
}) => {
  const lotteryConfig = LOTTERY_CONFIGS[pool.lotteryType];
  const poolGames = games.filter(
    (g) => g.poolId === pool.id && g.companyId === company.id
  );
  const poolSuggestions = suggestions.filter(
    (s) => s.poolId === pool.id && s.companyId === company.id
  );
  const poolParticipants = participants.filter(
    (p) => p.poolId === pool.id || p.companyId === company.id
  );
  const confirmedPurchases = purchases.filter(
    (p) => p.poolId === pool.id && p.paymentStatus === 'CONFIRMED'
  );
  const totalQuotas = Math.max(
    1,
    confirmedPurchases.reduce((acc, p) => acc + p.quotasCount, 0)
  );
  const defaultParticipantsCount = Math.max(
    1,
    poolParticipants.length || confirmedPurchases.length || 10
  );

  // Tira-Teima Simulator state
  const [simulatedNumbers, setSimulatedNumbers] = useState<number[]>(
    pool.drawnNumbers && pool.drawnNumbers.length > 0
      ? pool.drawnNumbers
      : [4, 10, 17, 23, 38, 53]
  );
  const [simulatedPrizeMasked, setSimulatedPrizeMasked] = useState<string>(
    numberToCurrencyMask(pool.prizeTotalAmount || 550000000)
  );
  const [simulatedParticipantsCount, setSimulatedParticipantsCount] =
    useState<number>(defaultParticipantsCount);

  // 1. Detect published games (both pending suggestions and approved official games) that already came out in past contests!
  const allPublishedForRadar = [
    ...poolSuggestions.map((sug) => ({
      id: sug.id,
      userName: sug.userName,
      userAvatar: sug.userAvatar || getInitialsFromName(sug.userName),
      numbers: sug.numbers,
      approvedAsOfficialGame: !!sug.approvedAsOfficialGame,
    })),
    ...poolGames
      .filter(
        (g) =>
          !poolSuggestions.some(
            (s) =>
              s.numbers.length === g.numbers.length &&
              s.numbers.every((n, i) => n === g.numbers[i])
          )
      )
      .map((g) => {
        const authorName = g.authorName || company.managerName;
        return {
          id: g.id,
          userName: authorName,
          userAvatar: g.authorAvatar || getInitialsFromName(authorName),
          numbers: g.numbers,
          approvedAsOfficialGame: true,
        };
      }),
  ];

  const pastMatches = allPublishedForRadar
    .map((item) => {
      const match = findPastDrawMatch(
        pool.lotteryType,
        item.numbers,
        item.userName
      );
      return match ? { sug: item, match } : null;
    })
    .filter(
      (
        entry
      ): entry is {
        sug: (typeof allPublishedForRadar)[number];
        match: NonNullable<ReturnType<typeof findPastDrawMatch>>;
      } => entry !== null
    );

  // 2. Author Leaderboard (Rei do Palpite vs Lanterna)
  const leaderboard = buildAuthorLeaderboard(poolGames, poolSuggestions);

  // 3. Copycat pairs (Detector de Cola)
  const copycatPairs = findCopycatPairs(poolSuggestions);

  // 4. Most Disputed vs Forgotten Numbers
  const mostPlayed = calculateCompanyMostPlayedNumbers(
    poolGames,
    poolSuggestions,
    8
  );
  const allPickedSet = new Set<number>();
  poolGames.forEach((g) => g.numbers.forEach((n) => allPickedSet.add(n)));
  poolSuggestions.forEach((s) => s.numbers.forEach((n) => allPickedSet.add(n)));

  const forgottenNumbers: number[] = [];
  for (let n = 1; n <= lotteryConfig.totalPoolNumbers; n++) {
    if (!allPickedSet.has(n)) {
      forgottenNumbers.push(n);
    }
  }

  // Random draw generator for Tira-Teima
  const handleRollRandomSimulation = async () => {
    const drawCount = lotteryConfig.minNumbers;
    const poolNums = Array.from(
      { length: lotteryConfig.totalPoolNumbers },
      (_, i) => i + 1
    );
    const chosen: number[] = [];
    while (chosen.length < drawCount && poolNums.length > 0) {
      const idx = Math.floor(Math.random() * poolNums.length);
      chosen.push(poolNums[idx]);
      poolNums.splice(idx, 1);
    }
    const sorted = chosen.sort((a, b) => a - b);
    setSimulatedNumbers(sorted);
    await onUpdateDrawnNumbers(
      pool.id,
      sorted,
      parseCurrencyBRL(simulatedPrizeMasked)
    );
  };

  // Financial & Tax Calculations based on Official Caixa Econômica Federal Rules:
  // - The prize advertised by Caixa (simulatedPrizeNumeric) is ALREADY NET of 30% IRRF (Art. 14, Lei 4.506/64).
  // - Therefore: Net Prize = 70% of Gross Prize => Gross Prize = Net Prize / 0.70, and IRRF Withheld = Gross Prize * 0.30.
  const simulatedPrizeNumeric = parseCurrencyBRL(simulatedPrizeMasked);
  const safeParticipants = Math.max(1, simulatedParticipantsCount);
  const prizePerParticipant = simulatedPrizeNumeric / safeParticipants;
  const prizePerQuota = simulatedPrizeNumeric / totalQuotas;

  const grossPrizeBeforeTax = simulatedPrizeNumeric / 0.7;
  const withheldIncomeTax30Pct = grossPrizeBeforeTax - simulatedPrizeNumeric;

  // Evaluate all suggestions & official games against simulatedNumbers
  const evaluatedGames = [
    ...poolSuggestions.map((s) => ({
      id: s.id,
      authorName: s.userName,
      authorAvatar: s.userAvatar || getInitialsFromName(s.userName),
      numbers: s.numbers,
      isApproved: !!s.approvedAsOfficialGame,
      hits: s.numbers.filter((n) => simulatedNumbers.includes(n)),
    })),
    ...poolGames
      .filter(
        (g) =>
          !poolSuggestions.some(
            (s) =>
              s.numbers.length === g.numbers.length &&
              s.numbers.every((n, i) => n === g.numbers[i])
          )
      )
      .map((g) => {
        const authorName = g.authorName || company.managerName;
        return {
          id: g.id,
          authorName,
          authorAvatar: g.authorAvatar || getInitialsFromName(authorName),
          numbers: g.numbers,
          isApproved: true,
          hits: g.numbers.filter((n) => simulatedNumbers.includes(n)),
        };
      }),
  ].sort((a, b) => b.hits.length - a.hits.length);

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header Card */}
      <div className="caixa-card p-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#005CA9] uppercase">
            Estatísticas & Resenha · {company.name}
          </span>
          <span className="text-[11px] font-semibold text-[#5F6C7B]">
            {lotteryConfig.name}
          </span>
        </div>
        <h1 className="font-display font-bold text-base text-[#1E293B]">
          Arena de Palpites do Bolão
        </h1>
        <p className="text-xs text-[#5F6C7B]">
          Curiosidades dos jogos divulgados, combinações que já saíram no
          passado, simulador tira-teima e balanço oficial da Caixa.
        </p>
      </div>

      {/* 1. RADAR VIAJANTE DO PASSADO (Jogos propostos que já saíram em sorteios anteriores!) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#D97706]" />
            <span>Resenha: Jogos Já Sorteados no Passado</span>
          </h2>
          <span className="text-[11px] text-[#5F6C7B]">
            {pastMatches.length} detectado(s)
          </span>
        </div>

        {pastMatches.length === 0 ? (
          <div className="caixa-card p-4 text-xs text-[#5F6C7B]">
            Nenhum jogo divulgado até agora repetiu resultados históricos da{' '}
            {lotteryConfig.name}. Todo mundo com combinações inéditas!
          </div>
        ) : (
          <div className="space-y-3">
            {pastMatches.map(({ sug, match }) => (
              <div
                key={sug.id}
                className={`caixa-card p-4 space-y-2.5 border-l-4 ${
                  match.tier === 'SENA_EXATA'
                    ? 'border-l-red-600 bg-[#FFFBEB]'
                    : 'border-l-amber-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-[4px] bg-[#005CA9] text-white font-display font-extrabold text-xs flex items-center justify-center shrink-0">
                      {sug.userAvatar || getInitialsFromName(sug.userName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[#1E293B] truncate">
                        {sug.userName}
                      </div>
                      <div className="text-[11px] font-bold text-red-700">
                        {match.funnyHeadline}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#92400E] shrink-0">
                    {sug.approvedAsOfficialGame
                      ? 'Aprovado · Travado'
                      : 'Ainda pode trocar!'}
                  </span>
                </div>

                <p className="text-xs text-[#333E48] leading-snug">
                  {match.funnyDescription}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {sug.numbers.map((num) => {
                    const isRepeated = match.matchedNumbers.includes(num);
                    return (
                      <span
                        key={num}
                        className={`w-7 h-7 font-mono-tabular text-xs font-bold flex items-center justify-center rounded-[4px] ${
                          isRepeated
                            ? 'bg-red-600 text-white'
                            : 'bg-[#F7F9FC] text-[#333E48] border border-[#D5E0EC]'
                        }`}
                      >
                        {String(num).padStart(2, '0')}
                      </span>
                    );
                  })}
                </div>

                {!sug.approvedAsOfficialGame && (
                  <p className="text-[11px] text-[#92400E] font-semibold">
                    💡 Como o jogo ainda não foi aprovado pelo organizador,{' '}
                    {sug.userName.split(' ')[0]} pode ir na aba Jogos e alterar
                    as dezenas depois dessa zoeira!
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. RANKING DA TURMA: REI DO PALPITE VS LANTERNA */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-[#005CA9]" />
            <span>Ranking dos Palpiteiros da Galera</span>
          </h2>
          <span className="text-[11px] text-[#5F6C7B]">Por curtidas</span>
        </div>

        <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
          {leaderboard.length === 0 ? (
            <div className="py-5 text-center text-xs text-[#5F6C7B]">
              Ainda não há jogos elaborados neste bolão.
            </div>
          ) : (
            leaderboard.map((item, idx) => {
              const isLeader = idx === 0 && leaderboard.length > 1;
              const isLanterna =
                idx === leaderboard.length - 1 && leaderboard.length > 1;
              return (
                <div
                  key={item.authorName}
                  className="py-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-[4px] font-display font-extrabold text-xs flex items-center justify-center shrink-0 ${
                        isLeader
                          ? 'bg-[#008B47] text-white'
                          : isLanterna
                          ? 'bg-slate-200 text-[#5F6C7B]'
                          : 'bg-[#EBF4FC] text-[#005CA9]'
                      }`}
                    >
                      {item.authorAvatar}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#1E293B] truncate">
                        {idx + 1}º {item.authorName}
                      </div>
                      <div className="text-[11px] text-[#5F6C7B]">
                        {isLeader
                          ? '👑 Rei do Palpite · Mais curtido da turma'
                          : isLanterna
                          ? '🥶 Zona da Seca · Precisa de votos da galera'
                          : `${item.gamesCount} jogo(s) · ${item.approvedCount} aprovado(s)`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono-tabular font-bold text-[#005CA9] flex items-center justify-end gap-1">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{item.totalLikes}</span>
                    </div>
                    <span className="text-[10px] text-[#5F6C7B]">curtidas</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 3. DETECTOR DE COLA DE VOLANTE (Jogos Muito Parecidos) */}
      {copycatPairs.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#005CA9]" />
              <span>Detector de "Cola" entre Apostadores</span>
            </h2>
          </div>

          <div className="space-y-2.5">
            {copycatPairs.slice(0, 3).map((pair, idx) => (
              <div key={idx} className="caixa-card p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-bold flex items-center justify-center text-[11px]">
                      {pair.avatarA}
                    </span>
                    <span className="font-bold text-[#1E293B]">
                      {pair.authorA.split(' ')[0]}
                    </span>
                    <span className="text-[#5F6C7B]">×</span>
                    <span className="w-7 h-7 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-bold flex items-center justify-center text-[11px]">
                      {pair.avatarB}
                    </span>
                    <span className="font-bold text-[#1E293B]">
                      {pair.authorB.split(' ')[0]}
                    </span>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#005CA9]">
                    {pair.sharedNumbers.length} dezenas iguais!
                  </span>
                </div>
                <p className="text-[11px] text-[#5F6C7B]">
                  Repetiram juntos as dezenas:{' '}
                  <strong className="font-mono-tabular text-[#1E293B]">
                    {pair.sharedNumbers
                      .map((n) => String(n).padStart(2, '0'))
                      .join(' - ')}
                  </strong>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. DEZENAS MAIS DISPUTADAS VS ESQUECIDAS */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#008B47]" />
            <span>Dezenas Queridinhas vs Esquecidas</span>
          </h2>
        </div>

        <div className="caixa-card p-4 space-y-3 text-xs">
          <div>
            <div className="font-bold text-[#1E293B] mb-2">
              🔥 As Mais Disputadas nos Jogos do Grupo
            </div>
            <div className="flex flex-wrap gap-2">
              {mostPlayed.map((item) => (
                <div
                  key={item.number}
                  className="px-2.5 py-1.5 bg-[#EBF4FC] rounded-[4px] flex items-center gap-1.5"
                >
                  <span className="font-mono-tabular font-extrabold text-[#005CA9]">
                    {String(item.number).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-[#5F6C7B]">
                    ({item.count}x · {item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#EDF2F7]">
            <div className="font-bold text-[#1E293B] mb-1.5">
              🧊 Dezenas Abandonadas (Ninguém escolheu ainda)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {forgottenNumbers.slice(0, 14).map((num) => (
                <span
                  key={num}
                  className="w-7 h-7 font-mono-tabular text-[11px] font-semibold bg-[#F7F9FC] text-[#5F6C7B] border border-[#E2E8F0] flex items-center justify-center rounded-[4px]"
                >
                  {String(num).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. SIMULADOR TIRA-TEIMA DA GALERA ("E se saísse agora?") */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#005CA9]" />
            <span>Simulador Tira-Teima ("E se saísse agora?")</span>
          </h2>
        </div>

        <div className="caixa-card p-4 space-y-3.5 text-xs">
          {/* Top bar with Quick Draw button */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#EDF2F7]">
            <div>
              <span className="text-[#5F6C7B] block text-[10px] uppercase font-bold">
                Rateio por Participante ({safeParticipants} pessoas)
              </span>
              <span className="font-mono-tabular font-extrabold text-sm text-[#008B47]">
                {formatCurrencyBRL(prizePerParticipant)} / pessoa
              </span>
            </div>
            <button
              type="button"
              onClick={handleRollRandomSimulation}
              className="h-9 px-3 bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs rounded-[4px] flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sortear Agora</span>
            </button>
          </div>

          {/* Inputs: Valor do Prêmio + Quantidade de Participantes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#333E48] mb-1">
                Valor do Prêmio Anunciado (R$)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={simulatedPrizeMasked}
                onChange={(e) =>
                  setSimulatedPrizeMasked(maskCurrencyBRL(e.target.value))
                }
                className="caixa-input font-mono-tabular font-bold text-[#008B47]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-[#333E48]">
                  Qtd. de Participantes
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSimulatedParticipantsCount(defaultParticipantsCount)
                  }
                  className="text-[10px] font-bold text-[#005CA9] hover:underline cursor-pointer"
                >
                  Usar atual ({defaultParticipantsCount})
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setSimulatedParticipantsCount((prev) =>
                      Math.max(1, prev - 1)
                    )
                  }
                  className="h-9 w-9 rounded-[4px] bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#CBD5E1] font-bold text-sm text-[#005CA9] flex items-center justify-center cursor-pointer shrink-0"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={simulatedParticipantsCount}
                  onChange={(e) =>
                    setSimulatedParticipantsCount(
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                  className="caixa-input text-center font-mono-tabular font-extrabold text-[#005CA9]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSimulatedParticipantsCount((prev) =>
                      Math.min(500, prev + 1)
                    )
                  }
                  className="h-9 w-9 rounded-[4px] bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#CBD5E1] font-bold text-sm text-[#005CA9] flex items-center justify-center cursor-pointer shrink-0"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Dual Comparison Box: Por Participante vs Por Cota */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-[4px] bg-[#F0FDF4] border border-[#B8E6CB]">
              <span className="text-[10px] font-bold text-[#008B47] uppercase block">
                Divisão por {safeParticipants} Participante(s)
              </span>
              <span className="font-mono-tabular font-extrabold text-xs text-[#008B47] mt-0.5 block">
                {formatCurrencyBRL(prizePerParticipant)}
              </span>
              <span className="text-[10px] text-[#5F6C7B]">
                Valor líquido se dividido igual
              </span>
            </div>

            <div className="p-2.5 rounded-[4px] bg-[#EBF4FC] border border-[#CBE2F6]">
              <span className="text-[10px] font-bold text-[#005CA9] uppercase block">
                Divisão por {totalQuotas} Cota(s) Ativa(s)
              </span>
              <span className="font-mono-tabular font-extrabold text-xs text-[#005CA9] mt-0.5 block">
                {formatCurrencyBRL(prizePerQuota)}
              </span>
              <span className="text-[10px] text-[#5F6C7B]">
                Valor líquido por cada 1 cota
              </span>
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-[#333E48] mb-1.5">
              Dezenas sorteadas na simulação:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {simulatedNumbers.map((num) => (
                <span
                  key={num}
                  className="w-8 h-8 font-mono-tabular text-xs font-extrabold bg-[#008B47] text-white flex items-center justify-center rounded-[4px]"
                >
                  {String(num).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-[#EDF2F7] space-y-2">
            <div className="font-bold text-[#1E293B]">
              Resultado da Simulação nos Jogos da Galera:
            </div>
            {evaluatedGames.map((g, i) => (
              <div
                key={g.id}
                className="py-2 px-2.5 rounded-[4px] bg-[#F7F9FC] flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-bold text-[11px] flex items-center justify-center shrink-0">
                    {g.authorAvatar}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-[#1E293B] truncate">
                      {i === 0 && g.hits.length > 0 ? '🏆 ' : ''}
                      {g.authorName}
                    </div>
                    <div className="text-[10px] text-[#5F6C7B]">
                      {g.hits.length === 0
                        ? 'Pé Frio (0 acertos nesta simulação)'
                        : `Acertou: ${g.hits
                            .map((n) => String(n).padStart(2, '0'))
                            .join(', ')}`}
                    </div>
                  </div>
                </div>
                <span
                  className={`font-mono-tabular font-bold text-xs shrink-0 ${
                    g.hits.length >= 4
                      ? 'text-[#008B47]'
                      : g.hits.length > 0
                      ? 'text-[#005CA9]'
                      : 'text-[#5F6C7B]'
                  }`}
                >
                  {g.hits.length} acerto(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. CARD EXPLICATIVO: BALANÇO OFICIAL DA CAIXA (PAGAMENTOS & DESCONTOS) */}
      {/* ===================================================================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-[#005CA9]" />
            <span>Balanço Oficial Caixa: Pagamentos e Descontos</span>
          </h2>
          <span className="text-[10px] font-bold text-[#008B47] bg-[#E8F6EE] px-2 py-0.5 rounded-[3px]">
            Normas Loterias Caixa
          </span>
        </div>

        <div className="caixa-card overflow-hidden text-xs">
          {/* Banner Superior de Destaque */}
          <div className="bg-[#005CA9] text-white px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/85">
                Demonstrativo Contábil de Premiação
              </span>
              <span className="text-[10px] font-mono-tabular bg-white/15 px-2 py-0.5 rounded">
                Lei Federal nº 4.506/64 (Art. 14)
              </span>
            </div>
            <div className="font-display font-bold text-sm">
              O prêmio anunciado pela Caixa já é LÍQUIDO de Imposto de Renda!
            </div>
            <p className="text-[11px] text-white/90 leading-snug">
              Os <strong>30% de IRRF</strong> são descontados diretamente na
              fonte pela Caixa antes de divulgar o valor do prêmio. Você não
              sofre nenhum novo desconto de imposto ao sacar na agência.
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* BLOCO 1: DRE / BALANÇO CONTÁBIL DO PRÊMIO SIMULADO */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-xs text-[#1E293B] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#005CA9]" />
                  <span>
                    1. Balanço de Descontos sobre o Prêmio Simulado
                  </span>
                </span>
                <span className="text-[10px] text-[#5F6C7B]">
                  Cálculo Oficial
                </span>
              </div>

              <div className="rounded-[4px] border border-[#D8E2EC] divide-y divide-[#EDF2F7] overflow-hidden">
                <div className="px-3 py-2 bg-[#F8FAFC] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[#333E48] block">
                      (+) Prêmio Bruto Oficial (100%)
                    </span>
                    <span className="text-[10px] text-[#64748B]">
                      Fundo de premiação antes da retenção tributária
                    </span>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#333E48]">
                    {formatCurrencyBRL(grossPrizeBeforeTax)}
                  </span>
                </div>

                <div className="px-3 py-2 bg-[#FFFBEB] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[#B45309] block">
                      (-) Imposto de Renda Retido na Fonte — IRRF (30%)
                    </span>
                    <span className="text-[10px] text-[#92400E]">
                      Retido pela Caixa antes da divulgação (Tributação
                      Exclusiva)
                    </span>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#B45309]">
                    - {formatCurrencyBRL(withheldIncomeTax30Pct)}
                  </span>
                </div>

                <div className="px-3 py-2.5 bg-[#E8F6EE] flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-[#008B47] block">
                      (=) Prêmio Líquido Anunciado pela Caixa (70%)
                    </span>
                    <span className="text-[10px] text-[#065F46]">
                      Valor real pago integralmente aos ganhadores
                    </span>
                  </div>
                  <span className="font-mono-tabular font-extrabold text-sm text-[#008B47]">
                    {formatCurrencyBRL(simulatedPrizeNumeric)}
                  </span>
                </div>

                <div className="px-3 py-2 bg-white flex items-center justify-between">
                  <span className="text-[#475569] font-semibold">
                    (÷) Líquido por Participante ({safeParticipants} pessoas)
                  </span>
                  <span className="font-mono-tabular font-extrabold text-[#005CA9]">
                    {formatCurrencyBRL(prizePerParticipant)}
                  </span>
                </div>

                <div className="px-3 py-2 bg-white flex items-center justify-between">
                  <span className="text-[#475569] font-semibold">
                    (÷) Líquido por Cota ({totalQuotas} cotas ativas)
                  </span>
                  <span className="font-mono-tabular font-extrabold text-[#005CA9]">
                    {formatCurrencyBRL(prizePerQuota)}
                  </span>
                </div>
              </div>
            </div>

            {/* BLOCO 2: DESTINAÇÃO DA ARRECADAÇÃO DAS LOTERIAS CAIXA */}
            <div className="space-y-2 pt-2 border-t border-[#EDF2F7]">
              <div className="font-display font-bold text-xs text-[#1E293B]">
                2. Para onde vai o dinheiro das apostas? (Rateio da Arrecadação)
              </div>
              <p className="text-[11px] text-[#5F6C7B]">
                De cada R$ 100,00 apostados nas Loterias Caixa, a legislação
                federal distribui o montante da seguinte forma:
              </p>

              {/* Barra Visual Proporcional */}
              <div className="w-full h-3 rounded-[4px] overflow-hidden flex">
                <div
                  className="bg-[#008B47] h-full w-[30%]"
                  title="Prêmio Líquido (30,35%)"
                />
                <div
                  className="bg-[#D97706] h-full w-[13%]"
                  title="IRRF sobre o Prêmio (13,00%)"
                />
                <div
                  className="bg-[#005CA9] h-full w-[38%]"
                  title="Repasses Sociais (37,61%)"
                />
                <div
                  className="bg-[#64748B] h-full w-[19%]"
                  title="Custeio e Comissão Lotérica (19,04%)"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[10px] font-bold text-[#008B47] block">
                    ● 43,35% Prêmio Bruto Total
                  </span>
                  <span className="text-[10px] text-[#5F6C7B]">
                    Sendo 30,35% Prêmio Líquido pago + 13,00% retido de IRRF na
                    fonte
                  </span>
                </div>
                <div className="p-2 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[10px] font-bold text-[#005CA9] block">
                    ● 37,61% Repasses Sociais
                  </span>
                  <span className="text-[10px] text-[#5F6C7B]">
                    Seguridade Social, FIES, Segurança Pública (FNSP), Esporte e
                    Cultura
                  </span>
                </div>
              </div>
            </div>

            {/* BLOCO 3: REGRAS DE SAQUE, LOCAIS E PRAZOS (DOCUMENTAÇÃO CAIXA) */}
            <div className="space-y-2.5 pt-2 border-t border-[#EDF2F7]">
              <div className="font-display font-bold text-xs text-[#1E293B] flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-[#005CA9]" />
                <span>
                  3. Regras Oficiais de Resgate, Limites e Prazos da Caixa
                </span>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0] flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#008B47] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#1E293B]">
                      Até R$ 2.259,20 (Isento de IR / Saque Rápido)
                    </div>
                    <p className="text-[11px] text-[#5F6C7B] mt-0.5">
                      Prêmios dentro da faixa de isenção podem ser recebidos em{' '}
                      <strong>qualquer Casa Lotérica</strong> credenciada ou nas
                      agências da Caixa.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0] flex items-start gap-2.5">
                  <Landmark className="w-4 h-4 text-[#005CA9] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#1E293B]">
                      Acima de R$ 2.259,20 (Exclusivo em Agência da Caixa)
                    </div>
                    <p className="text-[11px] text-[#5F6C7B] mt-0.5">
                      Pagos <strong>exclusivamente nas Agências da Caixa</strong>{' '}
                      mediante apresentação do bilhete original premiado (com
                      nome completo e CPF preenchidos no verso) + RG e CPF.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-[4px] bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#92400E]">
                      Valores ≥ R$ 10.000,00 (Prazo Mínimo de 2 Dias Úteis — D+2)
                    </div>
                    <p className="text-[11px] text-[#92400E] mt-0.5">
                      Por norma de segurança e conformidade do Banco Central,
                      prêmios iguais ou superiores a <strong>R$ 10 mil</strong>{' '}
                      são liberados no prazo mínimo de{' '}
                      <strong>2 dias úteis (D+2)</strong> após a apresentação do
                      bilhete na agência.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#005CA9] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#1E293B]">
                      Validade de 90 Dias & Declaração no IRPF
                    </div>
                    <p className="text-[11px] text-[#5F6C7B] mt-0.5">
                      O direito ao resgate prescreve em{' '}
                      <strong>90 dias corridos</strong> a partir do sorteio
                      (após isso o valor vai para o FIES). Na declaração anual
                      do Imposto de Renda, basta declarar o valor líquido
                      recebido em{' '}
                      <em>
                        "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva"
                      </em>{' '}
                      (sem pagar imposto adicional).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
