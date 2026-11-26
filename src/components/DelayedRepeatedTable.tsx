import React, { useMemo, useState } from 'react';
import { Clock, Repeat2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import {
  LotteryStatsResponse,
  computeDelayedAndRepeatedStats,
} from '../utils/lotteryMath';

interface DelayedRepeatedTableProps {
  stats: LotteryStatsResponse;
  windowSize: 3 | 5;
  onChangeWindowSize: (size: 3 | 5) => void;
  /** Currently selected / included numbers (highlighted in blue/green) */
  selectedNumbers?: number[];
  /** Pending numbers (funnel step 1 selection before Reaproveitar/Excluir) */
  pendingNumbers?: number[];
  /** Excluded numbers (struck-through red) */
  excludedNumbers?: number[];
  /** Callback when user taps a number pill in either table */
  onToggleNumber?: (num: number) => void;
  /** Optional quick action to apply top repeated numbers */
  onQuickSelectRepeated?: (nums: number[]) => void;
  /** Optional quick action to apply top delayed numbers */
  onQuickSelectDelayed?: (nums: number[]) => void;
  /** Optional compact subtitle override */
  subtitle?: string;
}

export const DelayedRepeatedTable: React.FC<DelayedRepeatedTableProps> = ({
  stats,
  windowSize,
  onChangeWindowSize,
  selectedNumbers = [],
  pendingNumbers = [],
  excludedNumbers = [],
  onToggleNumber,
  onQuickSelectRepeated,
  onQuickSelectDelayed,
  subtitle,
}) => {
  const [showAllRepeated, setShowAllRepeated] = useState(false);
  const [showAllDelayed, setShowAllDelayed] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);
  const pendingSet = useMemo(() => new Set(pendingNumbers), [pendingNumbers]);
  const excludedSet = useMemo(() => new Set(excludedNumbers), [excludedNumbers]);

  const analysis = useMemo(
    () => computeDelayedAndRepeatedStats(stats, windowSize),
    [stats, windowSize]
  );

  const visibleRepeated = showAllRepeated
    ? analysis.repeated.slice(0, 15)
    : analysis.repeated.slice(0, 6);

  const visibleDelayed = showAllDelayed
    ? analysis.delayed.slice(0, 15)
    : analysis.delayed.slice(0, 6);

  const maxDelay = analysis.delayed[0]?.delayConcursos || 1;

  const getBallStyle = (num: number, defaultTheme: 'REPEATED' | 'DELAYED') => {
    if (pendingSet.has(num)) {
      return 'bg-[#1E293B] text-white border-[#0F172A] ring-2 ring-[#94A3B8] scale-105';
    }
    if (selectedSet.has(num)) {
      return 'bg-[#008B47] text-white border-[#006835]';
    }
    if (excludedSet.has(num)) {
      return 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5] line-through';
    }
    if (defaultTheme === 'REPEATED') {
      return 'bg-[#F3E8FF] text-[#7E22CE] border-[#D8B4FE] hover:bg-[#E9D5FF]';
    }
    return 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D] hover:bg-[#FDE68A]';
  };

  const contestRangeLabel =
    analysis.contestsUsed.length > 1
      ? `Conc. ${analysis.contestsUsed[analysis.contestsUsed.length - 1]?.contestNumber} a ${analysis.contestsUsed[0]?.contestNumber}`
      : analysis.contestsUsed[0]
        ? `Conc. ${analysis.contestsUsed[0].contestNumber}`
        : '';

  return (
    <section className="caixa-card p-3 space-y-3">
      {/* Cabeçalho da Seção + Alternador 3 / 5 Concursos */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#EDF2F7]">
        <div className="min-w-0">
          <h4 className="text-xs font-extrabold text-[#1E293B] flex items-center gap-1.5">
            <Repeat2 className="w-3.5 h-3.5 text-[#7E22CE] shrink-0" />
            <span>Mais Repetidas &amp; Mais Atrasadas</span>
          </h4>
          <p className="text-[10px] text-[#5F6C7B] mt-0.5">
            {subtitle ||
              `Base: últimos ${analysis.contestsUsed.length} concursos (${contestRangeLabel}) · toque na dezena para selecionar`}
          </p>
        </div>

        <div
          className="inline-flex items-center rounded-[5px] bg-[#F1F5F9] p-0.5 border border-[#E2E8F0] shrink-0"
          role="group"
          aria-label="Janela de concursos analisados"
        >
          <button
            type="button"
            onClick={() => onChangeWindowSize(3)}
            className={`h-6 px-2 rounded-[4px] text-[10px] font-bold transition-colors cursor-pointer ${
              windowSize === 3
                ? 'bg-[#005CA9] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#1E293B]'
            }`}
          >
            Últimos 3
          </button>
          <button
            type="button"
            onClick={() => onChangeWindowSize(5)}
            className={`h-6 px-2 rounded-[4px] text-[10px] font-bold transition-colors cursor-pointer ${
              windowSize === 5
                ? 'bg-[#005CA9] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#1E293B]'
            }`}
          >
            Últimos 5
          </button>
        </div>
      </div>

      {/* Grade de 2 Tabelas: Mais Repetidas + Mais Atrasadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* TABELA 1: MAIS REPETIDAS DOS ÚLTIMOS 3 OU 5 CONCURSOS */}
        <div className="rounded-[6px] border border-[#E9D5FF] bg-[#FAF5FF]/50 overflow-hidden flex flex-col">
          <div className="px-2.5 py-2 bg-[#F3E8FF]/70 border-b border-[#E9D5FF] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Repeat2 className="w-3.5 h-3.5 text-[#7E22CE] shrink-0" />
              <span className="text-[11px] font-extrabold text-[#581C87] truncate">
                Mais Repetidas (últimos {analysis.contestsUsed.length})
              </span>
            </div>
            {onQuickSelectRepeated && analysis.repeated.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onQuickSelectRepeated(
                    analysis.repeated.slice(0, 6).map((r) => r.number)
                  )
                }
                className="h-5.5 px-1.5 rounded-[4px] bg-white hover:bg-[#F3E8FF] border border-[#D8B4FE] text-[#7E22CE] text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Usar Top</span>
              </button>
            )}
          </div>

          {!analysis.hasTrueRepeats && windowSize === 3 && (
            <div className="px-2.5 py-1.5 bg-white/80 border-b border-[#E9D5FF] flex items-center justify-between gap-2 text-[10px] text-[#6B21A8]">
              <span>Sem repetições 2x+ nos últimos 3 concursos.</span>
              <button
                type="button"
                onClick={() => onChangeWindowSize(5)}
                className="font-bold underline text-[#005CA9] shrink-0 cursor-pointer"
              >
                Ver 5 conc.
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E9D5FF] bg-white/60 text-[9px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-1.5 px-2 font-bold">Dez.</th>
                  <th className="py-1.5 px-2 font-bold">Repetições</th>
                  <th className="py-1.5 px-2 font-bold text-right">Concursos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3E8FF] text-[11px]">
                {visibleRepeated.map((item) => (
                  <tr
                    key={item.number}
                    className="hover:bg-white/70 transition-colors"
                  >
                    <td className="py-1.5 px-2">
                      <button
                        type="button"
                        disabled={!onToggleNumber}
                        onClick={() => onToggleNumber?.(item.number)}
                        className={`w-6.5 h-6.5 rounded-full border font-mono-tabular font-extrabold text-[10px] inline-flex items-center justify-center transition-all ${
                          onToggleNumber ? 'cursor-pointer' : 'cursor-default'
                        } ${getBallStyle(item.number, 'REPEATED')}`}
                        title={`Dezena ${String(item.number).padStart(2, '0')} — saiu ${item.count}x nos últimos ${item.totalContests} concursos`}
                      >
                        {String(item.number).padStart(2, '0')}
                      </button>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-tabular font-extrabold text-[#581C87] text-[10px] whitespace-nowrap">
                          {item.count}/{item.totalContests}
                        </span>
                        <div className="w-12 h-1.5 rounded-full bg-[#E9D5FF] overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full bg-[#7E22CE]"
                            style={{ width: `${Math.min(100, item.pct)}%` }}
                          />
                        </div>
                        <span className="font-mono-tabular text-[9px] text-[#64748B]">
                          {item.pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono-tabular text-[9px] text-[#475569] whitespace-nowrap">
                      {item.contests.slice(0, 3).join(', ')}
                      {item.contests.length > 3 ? ` +${item.contests.length - 3}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analysis.repeated.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllRepeated((prev) => !prev)}
              className="w-full py-1.5 border-t border-[#E9D5FF] bg-white/70 hover:bg-[#F3E8FF]/60 text-[10px] font-bold text-[#7E22CE] flex items-center justify-center gap-1 cursor-pointer"
            >
              {showAllRepeated ? (
                <>
                  <span>Mostrar menos</span>
                  <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  <span>
                    Ver mais ({Math.min(15, analysis.repeated.length)} dezenas)
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>

        {/* TABELA 2: MAIS ATRASADAS (MAIOR JEJUM SEM SAIR) */}
        <div className="rounded-[6px] border border-[#FDE68A] bg-[#FFFBEB]/50 overflow-hidden flex flex-col">
          <div className="px-2.5 py-2 bg-[#FEF3C7]/70 border-b border-[#FDE68A] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
              <span className="text-[11px] font-extrabold text-[#92400E] truncate">
                Mais Atrasadas (maior jejum)
              </span>
            </div>
            {onQuickSelectDelayed && analysis.delayed.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onQuickSelectDelayed(
                    analysis.delayed.slice(0, 6).map((d) => d.number)
                  )
                }
                className="h-5.5 px-1.5 rounded-[4px] bg-white hover:bg-[#FEF3C7] border border-[#FCD34D] text-[#B45309] text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Usar Top</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#FDE68A] bg-white/60 text-[9px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-1.5 px-2 font-bold">Dez.</th>
                  <th className="py-1.5 px-2 font-bold">Atraso</th>
                  <th className="py-1.5 px-2 font-bold text-right">Histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FEF3C7] text-[11px]">
                {visibleDelayed.map((item) => {
                  const barPct = Math.max(
                    12,
                    Math.round((item.delayConcursos / maxDelay) * 100)
                  );
                  return (
                    <tr
                      key={item.number}
                      className="hover:bg-white/70 transition-colors"
                    >
                      <td className="py-1.5 px-2">
                        <button
                          type="button"
                          disabled={!onToggleNumber}
                          onClick={() => onToggleNumber?.(item.number)}
                          className={`w-6.5 h-6.5 rounded-full border font-mono-tabular font-extrabold text-[10px] inline-flex items-center justify-center transition-all ${
                            onToggleNumber ? 'cursor-pointer' : 'cursor-default'
                          } ${getBallStyle(item.number, 'DELAYED')}`}
                          title={`Dezena ${String(item.number).padStart(2, '0')} — ${item.delayConcursos} concursos sem sair`}
                        >
                          {String(item.number).padStart(2, '0')}
                        </button>
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-tabular font-extrabold text-[#B45309] text-[10px] whitespace-nowrap">
                            {item.delayConcursos} conc.
                          </span>
                          <div className="w-12 h-1.5 rounded-full bg-[#FEF3C7] overflow-hidden shrink-0">
                            <div
                              className="h-full rounded-full bg-[#D97706]"
                              style={{ width: `${Math.min(100, barPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono-tabular text-[9px] text-[#475569] whitespace-nowrap">
                        {item.drawnCount}x ({item.frequencyPct.toFixed(1)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {analysis.delayed.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllDelayed((prev) => !prev)}
              className="w-full py-1.5 border-t border-[#FDE68A] bg-white/70 hover:bg-[#FEF3C7]/60 text-[10px] font-bold text-[#B45309] flex items-center justify-center gap-1 cursor-pointer"
            >
              {showAllDelayed ? (
                <>
                  <span>Mostrar menos</span>
                  <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  <span>
                    Ver mais ({Math.min(15, analysis.delayed.length)} dezenas)
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
