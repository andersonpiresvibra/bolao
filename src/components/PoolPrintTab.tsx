import React, { useEffect, useMemo, useState } from 'react';
import {
  Company,
  LotteryGame,
  Pool,
} from '../types';
import { LOTTERY_CONFIGS } from '../utils/lotteryMath';
import {
  DEFAULT_CALIBRATION_BY_LOTTERY,
  downloadSlipsVectorPdf,
  getSlipGeometry,
  groupGamesIntoSlips,
  GuideOverlaySubStep,
  SlipCalibrationConfig,
  SlipCardBatch,
  SlipPrintMode,
} from '../utils/slipPrinterPdf';
import {
  Printer,
  FileDown,
  Sliders,
  CheckSquare,
  Square,
  RotateCcw,
  Layers,
  Scissors,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Lock,
} from 'lucide-react';

interface PoolPrintTabProps {
  company: Company;
  pool: Pool;
  games: LotteryGame[];
  onOpenGamesTab?: () => void;
}

const CALIBRATION_STORAGE_PREFIX = 'lotocorp_slip_calibration_v1_';

export const PoolPrintTab: React.FC<PoolPrintTabProps> = ({
  company,
  pool,
  games,
  onOpenGamesTab,
}) => {
  const lotteryMeta = LOTTERY_CONFIGS[pool.lotteryType];
  const geom = getSlipGeometry(pool.lotteryType);

  // Only approved and locked official games of this pool enter the print batch
  const approvedPoolGames = useMemo(
    () =>
      games.filter(
        (g) => g.poolId === pool.id && g.companyId === company.id
      ),
    [games, pool.id, company.id]
  );

  const [printMode, setPrintMode] = useState<SlipPrintMode>('DIRECT_SLIP');
  const [guideSubStep, setGuideSubStep] =
    useState<GuideOverlaySubStep>('PRINT_GUIDE_SHEET');
  const [showCalibration, setShowCalibration] = useState<boolean>(false);

  const [calibration, setCalibration] = useState<SlipCalibrationConfig>(() => {
    try {
      const saved = localStorage.getItem(
        `${CALIBRATION_STORAGE_PREFIX}${pool.lotteryType}`
      );
      if (saved) {
        return {
          ...DEFAULT_CALIBRATION_BY_LOTTERY[pool.lotteryType],
          ...JSON.parse(saved),
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_CALIBRATION_BY_LOTTERY[pool.lotteryType];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        `${CALIBRATION_STORAGE_PREFIX}${pool.lotteryType}`
      );
      if (saved) {
        setCalibration({
          ...DEFAULT_CALIBRATION_BY_LOTTERY[pool.lotteryType],
          ...JSON.parse(saved),
        });
      } else {
        setCalibration(DEFAULT_CALIBRATION_BY_LOTTERY[pool.lotteryType]);
      }
    } catch {
      setCalibration(DEFAULT_CALIBRATION_BY_LOTTERY[pool.lotteryType]);
    }
  }, [pool.lotteryType]);

  const updateCalibration = (patch: Partial<SlipCalibrationConfig>) => {
    setCalibration((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(
          `${CALIBRATION_STORAGE_PREFIX}${pool.lotteryType}`,
          JSON.stringify(next)
        );
      } catch {
        // ignore
      }
      return next;
    });
  };

  const resetCalibration = () => {
    const def = DEFAULT_CALIBRATION_BY_LOTTERY[pool.lotteryType];
    setCalibration(def);
    try {
      localStorage.removeItem(
        `${CALIBRATION_STORAGE_PREFIX}${pool.lotteryType}`
      );
    } catch {
      // ignore
    }
  };

  // Group approved games into physical slips (up to 3 games per Caixa slip)
  const allSlipBatches = useMemo(
    () => groupGamesIntoSlips(approvedPoolGames, calibration.gamesPerSlip),
    [approvedPoolGames, calibration.gamesPerSlip]
  );

  const [selectedSlipIndices, setSelectedSlipIndices] = useState<number[]>([]);
  const [previewSlipIndex, setPreviewSlipIndex] = useState<number>(1);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  useEffect(() => {
    const allIndices = allSlipBatches.map((b) => b.slipIndex);
    setSelectedSlipIndices(allIndices);
    if (allIndices.length > 0 && !allIndices.includes(previewSlipIndex)) {
      setPreviewSlipIndex(allIndices[0]);
    }
  }, [allSlipBatches.length, calibration.gamesPerSlip]);

  const activeBatches = useMemo(
    () =>
      allSlipBatches.filter((b) => selectedSlipIndices.includes(b.slipIndex)),
    [allSlipBatches, selectedSlipIndices]
  );

  const currentPreviewBatch: SlipCardBatch | undefined = useMemo(
    () =>
      allSlipBatches.find((b) => b.slipIndex === previewSlipIndex) ||
      allSlipBatches[0],
    [allSlipBatches, previewSlipIndex]
  );

  const toggleSlipSelection = (slipIdx: number) => {
    setSelectedSlipIndices((prev) =>
      prev.includes(slipIdx)
        ? prev.filter((id) => id !== slipIdx)
        : [...prev, slipIdx].sort((a, b) => a - b)
    );
  };

  const selectAllSlips = () => {
    setSelectedSlipIndices(allSlipBatches.map((b) => b.slipIndex));
  };

  const selectOnlyFirstTestSlip = () => {
    if (allSlipBatches.length === 0) return;
    const firstIdx = allSlipBatches[0].slipIndex;
    setSelectedSlipIndices([firstIdx]);
    setPreviewSlipIndex(firstIdx);
    setFeedbackBanner(
      'Modo Teste (1 Cartão) selecionado: imprima em papel comum e coloque contra a luz junto ao volante da Caixa para conferir o alinhamento.'
    );
  };

  const handleExportPdf = (onlyTestSingle = false) => {
    const batchesToExport = onlyTestSingle
      ? allSlipBatches.slice(0, 1)
      : activeBatches;

    if (batchesToExport.length === 0) return;

    downloadSlipsVectorPdf({
      batches: batchesToExport,
      lotteryType: pool.lotteryType,
      lotteryName: lotteryMeta.name,
      contestNumber: pool.contestNumber,
      poolTitle: pool.title,
      mode: printMode,
      guideSubStep,
      calibration,
    });

    setFeedbackBanner(
      `PDF vetorial em escala real 100% gerado com ${batchesToExport.length} cartão(ões)! Abra e imprima em 'Tamanho Real (100%)'.`
    );
  };

  const handleDirectBrowserPrint = () => {
    if (activeBatches.length === 0) return;
    window.print();
  };

  // Renders an SVG of a single slip in exact millimeter coordinates (83 x 158 viewBox)
  const renderSlipSvg = (batch: SlipCardBatch, isPrintSheet = false) => {
    const isGuideSheetOnly =
      printMode === 'A4_GUIDE_OVERLAY' && guideSubStep === 'PRINT_GUIDE_SHEET';
    const isMarksOnly =
      printMode === 'DIRECT_SLIP' ||
      (printMode === 'A4_GUIDE_OVERLAY' && guideSubStep === 'PRINT_MARKS_ONLY');
    const isFullMold = printMode === 'A4_FULL_MOLD';

    const calX = calibration.offsetXMm;
    const calY = calibration.offsetYMm;

    return (
      <svg
        viewBox={`0 0 ${geom.slipWidthMm} ${geom.slipHeightMm}`}
        className="w-full h-auto block select-none"
      >
        {/* Background paper representation */}
        <rect
          x={0}
          y={0}
          width={geom.slipWidthMm}
          height={geom.slipHeightMm}
          fill={isMarksOnly && !isPrintSheet ? '#FFFDF7' : '#FFFFFF'}
          stroke={isFullMold || isGuideSheetOnly ? '#005CA9' : '#CBD5E1'}
          strokeWidth={isGuideSheetOnly ? 0.7 : 0.4}
          strokeDasharray={isFullMold || isGuideSheetOnly ? '2.5,1.5' : undefined}
        />

        {/* If Guide Sheet Only (Step 1 of A4 Guide): show instructions box for taping the Caixa slip */}
        {isGuideSheetOnly ? (
          <g>
            {/* Corner L-registration marks */}
            <rect x={0} y={0} width={6} height={1.3} fill="#000000" />
            <rect x={0} y={0} width={1.3} height={6} fill="#000000" />
            <rect
              x={geom.slipWidthMm - 6}
              y={0}
              width={6}
              height={1.3}
              fill="#000000"
            />
            <rect
              x={geom.slipWidthMm - 1.3}
              y={0}
              width={1.3}
              height={6}
              fill="#000000"
            />
            <rect
              x={0}
              y={geom.slipHeightMm - 1.3}
              width={6}
              height={1.3}
              fill="#000000"
            />
            <rect
              x={0}
              y={geom.slipHeightMm - 6}
              width={1.3}
              height={6}
              fill="#000000"
            />
            <rect
              x={geom.slipWidthMm - 6}
              y={geom.slipHeightMm - 1.3}
              width={6}
              height={1.3}
              fill="#000000"
            />
            <rect
              x={geom.slipWidthMm - 1.3}
              y={geom.slipHeightMm - 6}
              width={1.3}
              height={6}
              fill="#000000"
            />

            <rect
              x={5}
              y={10}
              width={geom.slipWidthMm - 10}
              height={14}
              rx={1.5}
              fill="#EBF4FC"
            />
            <text
              x={geom.slipWidthMm / 2}
              y={16.5}
              textAnchor="middle"
              fontSize={3.4}
              fontWeight="bold"
              fill="#005CA9"
            >
              {`COLE AQUI O CARTÃO #${String(batch.slipIndex).padStart(2, '0')}`}
            </text>
            <text
              x={geom.slipWidthMm / 2}
              y={21}
              textAnchor="middle"
              fontSize={2.6}
              fill="#1E293B"
            >
              {`Volante Oficial ${lotteryMeta.name} (${geom.slipWidthMm}x${geom.slipHeightMm}mm)`}
            </text>

            <text x={7} y={36} fontSize={2.6} fill="#334155" fontWeight="bold">
              Como usar esta Folha-Guia:
            </text>
            <text x={7} y={42} fontSize={2.4} fill="#475569">
              1. Alinhe o cartão da Caixa nos cantos pretos.
            </text>
            <text x={7} y={47} fontSize={2.4} fill="#475569">
              2. Prenda o topo com fita crepe pequena.
            </text>
            <text x={7} y={52} fontSize={2.4} fill="#475569">
              3. Volte a folha para a bandeja da impressora.
            </text>
            <text x={7} y={57} fontSize={2.4} fill="#475569">
              4. Mude para o Passo 2 (Imprimir Marcações).
            </text>

            {/* Preview of which games belong to this slot */}
            <rect
              x={6}
              y={68}
              width={geom.slipWidthMm - 12}
              height={46}
              rx={1.5}
              fill="#F8FAFC"
              stroke="#CBD5E1"
              strokeWidth={0.3}
            />
            <text x={9} y={74} fontSize={2.5} fontWeight="bold" fill="#0F172A">
              Jogos que serão marcados neste cartão:
            </text>
            {[0, 1, 2].map((idx) => {
              const g = batch.games[idx];
              return (
                <text
                  key={idx}
                  x={9}
                  y={81 + idx * 9}
                  fontSize={2.2}
                  fill={g ? '#005CA9' : '#94A3B8'}
                >
                  {g
                    ? `Quadro ${idx + 1}: ${g.numbers
                        .map((n) => String(n).padStart(2, '0'))
                        .slice(0, 8)
                        .join(' ')}${g.numbers.length > 8 ? '...' : ''}`
                    : `Quadro ${idx + 1}: (Vazio)`}
                </text>
              );
            })}
          </g>
        ) : (
          <g>
            {/* Header band (Full Mold draws dark blue header; Marks-Only draws ghost watermark on screen only) */}
            {isFullMold ? (
              <g>
                <rect
                  x={calX + 3}
                  y={calY + 3}
                  width={geom.slipWidthMm - 6}
                  height={13}
                  rx={1}
                  fill="#005CA9"
                />
                <text
                  x={calX + 6}
                  y={calY + 9.2}
                  fontSize={3.6}
                  fontWeight="bold"
                  fill="#FFFFFF"
                >
                  {`${lotteryMeta.name.toUpperCase()} — VOLANTE #${String(
                    batch.slipIndex
                  ).padStart(2, '0')}`}
                </text>
                <text
                  x={calX + 6}
                  y={calY + 13.8}
                  fontSize={2.4}
                  fill="#E0F2FE"
                >
                  {`Conc. ${pool.contestNumber} • ${batch.games.length} jogo(s) neste cartão`}
                </text>
              </g>
            ) : !isPrintSheet ? (
              <g>
                <rect
                  x={3}
                  y={3}
                  width={geom.slipWidthMm - 6}
                  height={13}
                  rx={1}
                  fill="#F1F5F9"
                  stroke="#E2E8F0"
                  strokeWidth={0.3}
                />
                <text
                  x={6}
                  y={9}
                  fontSize={3.1}
                  fontWeight="bold"
                  fill="#64748B"
                >
                  {`CARTÃO FÍSICO CAIXA #${String(batch.slipIndex).padStart(
                    2,
                    '0'
                  )} (${lotteryMeta.name.toUpperCase()})`}
                </text>
                <text x={6} y={13.5} fontSize={2.2} fill="#94A3B8">
                  Na impressora saem apenas os quadrados pretos (■)
                </text>
              </g>
            ) : (
              <text
                x={calX + geom.slipWidthMm - 15}
                y={calY + 4.5}
                fontSize={2.2}
                fill="#334155"
              >
                {`#${String(batch.slipIndex).padStart(2, '0')}`}
              </text>
            )}

            {/* Up to 3 Game Boards (Quadro 1, Quadro 2, Quadro 3) */}
            {[0, 1, 2].map((boardIdx) => {
              const game = batch.games[boardIdx];
              const boardTopMm =
                calY +
                geom.boardTopStartMm +
                boardIdx * (geom.boardHeightMm + geom.boardGapMm);

              const choices = geom.allowedDozensChoices.slice(0, 10);
              const qtyPitchX = geom.gridWidthMm / Math.max(6, choices.length);
              const qtyRowYMm =
                boardTopMm + 2.2 + geom.rows * geom.cellPitchYMm;

              return (
                <g key={boardIdx}>
                  {/* Board frame & title (Full Mold always; Marks-Only only on screen preview as faint guide) */}
                  {(isFullMold || !isPrintSheet) && (
                    <g>
                      <rect
                        x={calX + 6.5}
                        y={boardTopMm - 3.2}
                        width={geom.slipWidthMm - 9.5}
                        height={geom.boardHeightMm + 2.2}
                        fill="none"
                        stroke={isFullMold ? '#CBD5E1' : '#E2E8F0'}
                        strokeWidth={0.3}
                      />
                      <text
                        x={calX + 8}
                        y={boardTopMm - 0.8}
                        fontSize={2.3}
                        fontWeight="bold"
                        fill={isFullMold ? '#1E293B' : '#94A3B8'}
                      >
                        {game
                          ? `JOGO ${boardIdx + 1} (${
                              game.numbers.length
                            } DEZ) — ${(
                              game.authorName || 'Organizador'
                            ).slice(0, 18)}`
                          : `JOGO ${boardIdx + 1} (NÃO UTILIZADO)`}
                      </text>
                    </g>
                  )}

                  {/* Rows & Columns of numbers */}
                  {Array.from({ length: geom.rows }).map((_, r) => {
                    const rowYMm = boardTopMm + 1.8 + r * geom.cellPitchYMm;
                    return (
                      <g key={r}>
                        {/* Left optical timing track bar */}
                        {(isFullMold || !isPrintSheet) && (
                          <rect
                            x={calX + 2.2}
                            y={
                              rowYMm +
                              (geom.cellPitchYMm - calibration.markHeightMm) / 2
                            }
                            width={3.2}
                            height={calibration.markHeightMm}
                            fill={isFullMold ? '#000000' : '#CBD5E1'}
                          />
                        )}

                        {Array.from({ length: geom.cols }).map((__, c) => {
                          const num = r * geom.cols + c + 1;
                          if (num > geom.totalNumbers) return null;

                          const cellXMm =
                            calX + geom.gridLeftMm + c * geom.cellPitchXMm;
                          const isMarked = game
                            ? game.numbers.includes(num)
                            : false;

                          const markXMm =
                            cellXMm +
                            (geom.cellPitchXMm - calibration.markWidthMm) / 2;
                          const markYMm =
                            rowYMm +
                            (geom.cellPitchYMm - calibration.markHeightMm) / 2;

                          return (
                            <g key={c}>
                              {/* Faint cell outline when unmarked (in Full Mold or screen preview) */}
                              {!isMarked && (isFullMold || !isPrintSheet) && (
                                <g>
                                  <rect
                                    x={markXMm}
                                    y={markYMm}
                                    width={calibration.markWidthMm}
                                    height={calibration.markHeightMm}
                                    fill="none"
                                    stroke={isFullMold ? '#D97777' : '#E2E8F0'}
                                    strokeWidth={0.22}
                                  />
                                  <text
                                    x={markXMm + calibration.markWidthMm / 2}
                                    y={
                                      markYMm +
                                      calibration.markHeightMm / 2 +
                                      0.7
                                    }
                                    textAnchor="middle"
                                    fontSize={1.85}
                                    fontWeight="bold"
                                    fill={isFullMold ? '#993333' : '#94A3B8'}
                                  >
                                    {String(num).padStart(2, '0')}
                                  </text>
                                </g>
                              )}

                              {/* SOLID BLACK ALVÉOLO MARK (Printed in all modes!) */}
                              {isMarked && (
                                <g>
                                  <rect
                                    x={markXMm}
                                    y={markYMm}
                                    width={calibration.markWidthMm}
                                    height={calibration.markHeightMm}
                                    fill="#000000"
                                  />
                                  {!isPrintSheet && (
                                    <text
                                      x={markXMm + calibration.markWidthMm / 2}
                                      y={
                                        markYMm +
                                        calibration.markHeightMm / 2 +
                                        0.7
                                      }
                                      textAnchor="middle"
                                      fontSize={1.75}
                                      fontWeight="bold"
                                      fill="#FFFFFF"
                                    >
                                      {String(num).padStart(2, '0')}
                                    </text>
                                  )}
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Quantity of Dozens Row */}
                  <g>
                    {(isFullMold || !isPrintSheet) && (
                      <rect
                        x={calX + 2.2}
                        y={qtyRowYMm}
                        width={3.2}
                        height={calibration.markHeightMm * 0.85}
                        fill={isFullMold ? '#000000' : '#CBD5E1'}
                      />
                    )}
                    {choices.map((choiceNum, idx) => {
                      const qx = calX + geom.gridLeftMm + idx * qtyPitchX;
                      const isQtySelected = game
                        ? game.numbers.length === choiceNum
                        : false;
                      const qMarkW = Math.min(
                        calibration.markWidthMm,
                        qtyPitchX - 0.8
                      );
                      const qMarkH = calibration.markHeightMm * 0.85;

                      return (
                        <g key={choiceNum}>
                          {!isQtySelected && (isFullMold || !isPrintSheet) && (
                            <g>
                              <rect
                                x={qx}
                                y={qtyRowYMm}
                                width={qMarkW}
                                height={qMarkH}
                                fill="none"
                                stroke={isFullMold ? '#D97777' : '#E2E8F0'}
                                strokeWidth={0.22}
                              />
                              <text
                                x={qx + qMarkW / 2}
                                y={qtyRowYMm + qMarkH / 2 + 0.6}
                                textAnchor="middle"
                                fontSize={1.65}
                                fontWeight="bold"
                                fill={isFullMold ? '#993333' : '#94A3B8'}
                              >
                                {choiceNum}
                              </text>
                            </g>
                          )}

                          {isQtySelected && (
                            <rect
                              x={qx}
                              y={qtyRowYMm}
                              width={qMarkW}
                              height={qMarkH}
                              fill="#000000"
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                </g>
              );
            })}

            {/* Bottom Optical Timing Anchor in Full Mold */}
            {isFullMold && (
              <g>
                <rect
                  x={calX + 2.2}
                  y={calY + geom.slipHeightMm - 5.5}
                  width={5.5}
                  height={2.2}
                  fill="#000000"
                />
                <rect
                  x={calX + geom.slipWidthMm - 7.7}
                  y={calY + geom.slipHeightMm - 5.5}
                  width={5.5}
                  height={2.2}
                  fill="#000000"
                />
                <text
                  x={calX + geom.slipWidthMm / 2}
                  y={calY + geom.slipHeightMm - 3.6}
                  textAnchor="middle"
                  fontSize={1.9}
                  fill="#475569"
                >
                  ESCALA 100% REAL • RECORTAR NA LINHA TRACEJADA
                </text>
              </g>
            )}
          </g>
        )}
      </svg>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {onOpenGamesTab && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenGamesTab}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-white border border-[#D8E2EC] text-[#005CA9] font-bold text-xs hover:bg-[#EBF4FC] transition-colors cursor-pointer"
          >
            <span>← Voltar para Jogos</span>
          </button>
          <span className="text-[11px] font-semibold text-[#5F6C7B]">
            {pool.title}
          </span>
        </div>
      )}

      {/* Top Hero Card */}
      <section className="bg-white border border-[#D8E2EC] rounded-[6px] p-4 shadow-2xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-[#005CA9]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#005CA9]">
                Central de Impressão & PDF 100%
              </span>
            </div>
            <h1 className="text-base font-extrabold text-[#1E293B] mt-0.5">
              Imprimir Cartões da {lotteryMeta.name}
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Somente jogos aprovados e travados pelo organizador entram no lote
              de impressão.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 bg-[#E8F6EE] text-[#008A47] border border-[#B8E6CB] px-2 py-1 rounded-[4px] text-[11px] font-bold shrink-0">
            <Lock className="w-3 h-3" />
            {approvedPoolGames.length} Travados
          </span>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2.5">
            <div className="text-[10px] font-bold uppercase text-[#64748B]">
              Jogos Aprovados
            </div>
            <div className="text-sm font-black text-[#1E293B] tabular-nums mt-0.5">
              {approvedPoolGames.length} jogo(s)
            </div>
          </div>
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2.5">
            <div className="text-[10px] font-bold uppercase text-[#64748B]">
              Cartões Físicos
            </div>
            <div className="text-sm font-black text-[#005CA9] tabular-nums mt-0.5">
              {allSlipBatches.length} volante(s)
            </div>
          </div>
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2.5">
            <div className="text-[10px] font-bold uppercase text-[#64748B]">
              Medida Oficial
            </div>
            <div className="text-sm font-black text-[#008A47] tabular-nums mt-0.5">
              83 × 158 mm
            </div>
          </div>
        </div>
      </section>

      {approvedPoolGames.length === 0 ? (
        <section className="bg-white border border-[#D8E2EC] rounded-[6px] p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#D97706] mx-auto" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[#1E293B]">
              Nenhum jogo aprovado e travado ainda
            </h2>
            <p className="text-xs text-[#64748B]">
              Para evitar erros ou alterações após a impressão, apenas os jogos
              já aprovados como volantes oficiais aparecem aqui.
            </p>
          </div>
          {onOpenGamesTab && (
            <button
              type="button"
              onClick={onOpenGamesTab}
              className="px-4 py-2 bg-[#005CA9] text-white text-xs font-bold rounded-[4px] hover:bg-[#004A87] transition-colors cursor-pointer"
            >
              Ir para Volantes e Aprovar Jogos
            </button>
          )}
        </section>
      ) : (
        <>
          {/* Mode Selector (The 3 Confirmed Print Options) */}
          <section className="bg-white border border-[#D8E2EC] rounded-[6px] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E293B]">
                1. Escolha o Modo de Impressão
              </span>
              <span className="text-[11px] font-semibold text-[#005CA9]">
                Escala 1:1 (Milímetros)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setPrintMode('DIRECT_SLIP')}
                className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  printMode === 'DIRECT_SLIP'
                    ? 'bg-[#EBF4FC] border-[#005CA9] text-[#005CA9] shadow-2xs'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]'
                }`}
              >
                <Sparkles className="w-4 h-4 mb-1 text-[#005CA9]" />
                <div>
                  <div className="text-[11px] font-extrabold leading-tight">
                    Direto no Cartão
                  </div>
                  <div className="text-[9px] text-[#64748B] mt-0.5 leading-tight">
                    Volante 83×158mm na bandeja
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('A4_GUIDE_OVERLAY')}
                className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  printMode === 'A4_GUIDE_OVERLAY'
                    ? 'bg-[#EBF4FC] border-[#005CA9] text-[#005CA9] shadow-2xs'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]'
                }`}
              >
                <Layers className="w-4 h-4 mb-1 text-[#008A47]" />
                <div>
                  <div className="text-[11px] font-extrabold leading-tight">
                    Guia A4 (3 Cartões)
                  </div>
                  <div className="text-[9px] text-[#64748B] mt-0.5 leading-tight">
                    Colar 3 cartões da Caixa na A4
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('A4_FULL_MOLD')}
                className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  printMode === 'A4_FULL_MOLD'
                    ? 'bg-[#EBF4FC] border-[#005CA9] text-[#005CA9] shadow-2xs'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]'
                }`}
              >
                <Scissors className="w-4 h-4 mb-1 text-[#D97706]" />
                <div>
                  <div className="text-[11px] font-extrabold leading-tight">
                    Molde A4 Completo
                  </div>
                  <div className="text-[9px] text-[#64748B] mt-0.5 leading-tight">
                    3 cartões em A4 para recortar
                  </div>
                </div>
              </button>
            </div>

            {/* Mode explanation & Sub-step selector for A4 Guide Overlay */}
            {printMode === 'DIRECT_SLIP' && (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2.5 text-[11px] text-[#334155] space-y-1">
                <div className="font-bold text-[#005CA9]">
                  Modo 1 — Impressão Direta no Volante Oficial da Caixa (83 × 158 mm):
                </div>
                <p>
                  Insira os cartões originais da Caixa centralizados nas guias
                  ajustáveis da impressora. O sistema envia{' '}
                  <strong>somente os quadradinhos pretos (■)</strong> nas
                  coordenadas exatas de cada dezena.
                </p>
              </div>
            )}

            {printMode === 'A4_GUIDE_OVERLAY' && (
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[4px] p-3 space-y-2.5">
                <div className="text-[11px] font-bold text-[#065F46]">
                  Modo 2 — Truque Profissional das Lotéricas (Impressoras que não puxam papel estreito):
                </div>
                <p className="text-[11px] text-[#1E293B]">
                  Primeiro imprima a <strong>Folha-Guia A4</strong> em papel
                  comum, cole até <strong>3 cartões originais da Caixa</strong>{' '}
                  nos retângulos indicados com um pedacinho de fita crepe no
                  topo e recoloque a folha na impressora para imprimir só as
                  marcações pretas!
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGuideSubStep('PRINT_GUIDE_SHEET')}
                    className={`py-2 px-2.5 rounded-[4px] text-[11px] font-bold border cursor-pointer transition-colors ${
                      guideSubStep === 'PRINT_GUIDE_SHEET'
                        ? 'bg-[#005CA9] text-white border-[#005CA9]'
                        : 'bg-white text-[#1E293B] border-[#CBD5E1]'
                    }`}
                  >
                    1º Passo: Folha-Guia A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideSubStep('PRINT_MARKS_ONLY')}
                    className={`py-2 px-2.5 rounded-[4px] text-[11px] font-bold border cursor-pointer transition-colors ${
                      guideSubStep === 'PRINT_MARKS_ONLY'
                        ? 'bg-[#008A47] text-white border-[#008A47]'
                        : 'bg-white text-[#1E293B] border-[#CBD5E1]'
                    }`}
                  >
                    2º Passo: Só Marcações (■)
                  </button>
                </div>
              </div>
            )}

            {printMode === 'A4_FULL_MOLD' && (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[4px] p-2.5 text-[11px] text-[#92400E] space-y-1">
                <div className="font-bold">
                  Modo 3 — Folha A4 com 3 Volantes Completos + Marcas Ópticas Laterais:
                </div>
                <p>
                  Imprime 3 cartões por folha A4 em escala real (83 × 158 mm
                  cada) com as barras pretas laterais de sincronismo óptico e
                  linhas pontilhadas para recortar ou conferir na lotérica.
                </p>
              </div>
            )}
          </section>

          {/* Printer Millimeter Calibration ("Teste Contra a Luz") */}
          <section className="bg-white border border-[#D8E2EC] rounded-[6px] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowCalibration((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#1E293B] cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-[#005CA9]" />
                <span>
                  2. Calibração Fina da Impressora (X: {calibration.offsetXMm}mm
                  | Y: {calibration.offsetYMm}mm)
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowCalibration((prev) => !prev)}
                className="text-[11px] font-bold text-[#005CA9] underline cursor-pointer"
              >
                {showCalibration ? 'Ocultar' : 'Ajustar mm'}
              </button>
            </div>

            {showCalibration && (
              <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
                <p className="text-[11px] text-[#475569]">
                  <strong>Dica Teste Contra a Luz:</strong> Imprima 1 cartão em
                  folha sulfite comum e coloque sobre o cartão da Caixa contra a
                  luz. Se precisar mover os quadradinhos pretos 1 ou 2 mm para o
                  lado ou para baixo, ajuste aqui:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2.5 space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-[#475569]">
                      Deslocamento Horizontal (X mm)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateCalibration({
                            offsetXMm: Number(
                              (calibration.offsetXMm - 0.5).toFixed(1)
                            ),
                          })
                        }
                        className="px-2 py-1 bg-white border border-[#CBD5E1] rounded text-xs font-bold cursor-pointer"
                      >
                        -0.5
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        min="-15"
                        max="15"
                        value={calibration.offsetXMm}
                        onChange={(e) =>
                          updateCalibration({
                            offsetXMm: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full text-center text-xs font-bold bg-white border border-[#CBD5E1] rounded py-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateCalibration({
                            offsetXMm: Number(
                              (calibration.offsetXMm + 0.5).toFixed(1)
                            ),
                          })
                        }
                        className="px-2 py-1 bg-white border border-[#CBD5E1] rounded text-xs font-bold cursor-pointer"
                      >
                        +0.5
                      </button>
                    </div>
                    <span className="block text-[9px] text-[#64748B]">
                      Negativo = Esquerda | Positivo = Direita
                    </span>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2.5 space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-[#475569]">
                      Deslocamento Vertical (Y mm)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateCalibration({
                            offsetYMm: Number(
                              (calibration.offsetYMm - 0.5).toFixed(1)
                            ),
                          })
                        }
                        className="px-2 py-1 bg-white border border-[#CBD5E1] rounded text-xs font-bold cursor-pointer"
                      >
                        -0.5
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        min="-15"
                        max="15"
                        value={calibration.offsetYMm}
                        onChange={(e) =>
                          updateCalibration({
                            offsetYMm: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full text-center text-xs font-bold bg-white border border-[#CBD5E1] rounded py-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateCalibration({
                            offsetYMm: Number(
                              (calibration.offsetYMm + 0.5).toFixed(1)
                            ),
                          })
                        }
                        className="px-2 py-1 bg-white border border-[#CBD5E1] rounded text-xs font-bold cursor-pointer"
                      >
                        +0.5
                      </button>
                    </div>
                    <span className="block text-[9px] text-[#64748B]">
                      Negativo = Sobe | Positivo = Desce
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2">
                    <label className="block text-[10px] font-bold text-[#475569]">
                      Largura Marca (mm)
                    </label>
                    <input
                      type="number"
                      step="0.2"
                      min="2.5"
                      max="7.0"
                      value={calibration.markWidthMm}
                      onChange={(e) =>
                        updateCalibration({
                          markWidthMm: parseFloat(e.target.value) || 4.2,
                        })
                      }
                      className="w-full mt-1 text-xs font-bold bg-white border border-[#CBD5E1] rounded px-2 py-1"
                    />
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2">
                    <label className="block text-[10px] font-bold text-[#475569]">
                      Altura Marca (mm)
                    </label>
                    <input
                      type="number"
                      step="0.2"
                      min="1.5"
                      max="5.0"
                      value={calibration.markHeightMm}
                      onChange={(e) =>
                        updateCalibration({
                          markHeightMm: parseFloat(e.target.value) || 2.5,
                        })
                      }
                      className="w-full mt-1 text-xs font-bold bg-white border border-[#CBD5E1] rounded px-2 py-1"
                    />
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2">
                    <label className="block text-[10px] font-bold text-[#475569]">
                      Jogos / Cartão
                    </label>
                    <select
                      value={calibration.gamesPerSlip}
                      onChange={(e) =>
                        updateCalibration({
                          gamesPerSlip: Number(e.target.value) as 1 | 2 | 3,
                        })
                      }
                      className="w-full mt-1 text-xs font-bold bg-white border border-[#CBD5E1] rounded px-1.5 py-1"
                    >
                      <option value={3}>3 Jogos (Padrão)</option>
                      <option value={2}>2 Jogos / Cartão</option>
                      <option value={1}>1 Jogo / Cartão</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={resetCalibration}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#64748B] hover:text-[#1E293B] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Padrão Caixa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportPdf(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6] rounded-[4px] text-[11px] font-bold cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Baixar PDF Teste (1 Cartão)
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Action Bar: Print Now & Export Vector PDF */}
          <section className="bg-white border border-[#D8E2EC] rounded-[6px] p-3.5 space-y-2.5">
            {feedbackBanner && (
              <div className="bg-[#E8F6EE] border border-[#B8E6CB] text-[#065F46] p-2.5 rounded-[4px] text-[11px] font-semibold flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#008A47] shrink-0 mt-0.5" />
                  <span>{feedbackBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackBanner(null)}
                  className="text-[10px] font-bold underline shrink-0"
                >
                  OK
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={activeBatches.length === 0}
                onClick={() => handleExportPdf(false)}
                className="py-2.5 px-3 bg-[#005CA9] hover:bg-[#004A87] disabled:opacity-50 text-white rounded-[4px] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Exportar PDF ({activeBatches.length})</span>
              </button>

              <button
                type="button"
                disabled={activeBatches.length === 0}
                onClick={handleDirectBrowserPrint}
                className="py-2.5 px-3 bg-[#008A47] hover:bg-[#007039] disabled:opacity-50 text-white rounded-[4px] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Agora ({activeBatches.length})</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
              <span>
                Selecionados: <strong>{activeBatches.length}</strong> de{' '}
                <strong>{allSlipBatches.length}</strong> cartão(ões)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectOnlyFirstTestSlip}
                  className="text-[#005CA9] font-bold hover:underline cursor-pointer"
                >
                  Só 1º (Teste)
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={selectAllSlips}
                  className="text-[#005CA9] font-bold hover:underline cursor-pointer"
                >
                  Todos ({allSlipBatches.length})
                </button>
              </div>
            </div>
          </section>

          {/* Slip Batch Selector Pills + Live Interactive Slip Preview */}
          <section className="bg-white border border-[#D8E2EC] rounded-[6px] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#005CA9]" />
                <span className="text-xs font-bold text-[#1E293B]">
                  3. Espelho Fiel dos Cartões ({allSlipBatches.length})
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[#64748B]">
                Toque para visualizar / marcar
              </span>
            </div>

            {/* List of Slips with Checkboxes */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {allSlipBatches.map((batch) => {
                const isSelected = selectedSlipIndices.includes(batch.slipIndex);
                const isPreviewing =
                  currentPreviewBatch?.slipIndex === batch.slipIndex;

                return (
                  <div
                    key={batch.slipIndex}
                    onClick={() => setPreviewSlipIndex(batch.slipIndex)}
                    className={`p-2.5 rounded-[4px] border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isPreviewing
                        ? 'bg-[#EBF4FC] border-[#005CA9]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSlipSelection(batch.slipIndex);
                        }}
                        className="text-[#005CA9] shrink-0 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-[#94A3B8]" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-[#1E293B]">
                          Cartão Físico #{String(batch.slipIndex).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] text-[#64748B] truncate">
                          {batch.games
                            .map(
                              (g, idx) =>
                                `Q${idx + 1}: ${g.numbers.length} dez (${
                                  g.authorName?.split(' ')[0] || 'Oficial'
                                })`
                            )
                            .join(' • ')}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#CBD5E1] text-[#005CA9] shrink-0">
                      {batch.games.length} jogo(s)
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Active Slip Visual Preview */}
            {currentPreviewBatch && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#334155]">
                  <span>
                    Visualizando Cartão #
                    {String(currentPreviewBatch.slipIndex).padStart(2, '0')}
                  </span>
                  <span className="text-[#005CA9]">
                    {printMode === 'DIRECT_SLIP'
                      ? 'Impressão Direta (Só Marcações ■)'
                      : printMode === 'A4_GUIDE_OVERLAY'
                      ? guideSubStep === 'PRINT_GUIDE_SHEET'
                        ? 'Folha-Guia A4 para Colagem'
                        : 'Marcações sobre Guia A4 (■)'
                      : 'Molde Completo c/ Barras Ópticas'}
                  </span>
                </div>

                <div className="max-w-[290px] mx-auto bg-[#E2E8F0] p-3 rounded-[6px] shadow-inner">
                  {renderSlipSvg(currentPreviewBatch, false)}
                </div>

                {/* Detailed numbers breakdown for the 3 games on this slip */}
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] p-2.5 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-[#64748B]">
                    Conferência das Dezenas do Cartão #
                    {String(currentPreviewBatch.slipIndex).padStart(2, '0')}
                  </div>
                  {[0, 1, 2].map((idx) => {
                    const g = currentPreviewBatch.games[idx];
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] py-1 border-b last:border-b-0 border-[#E2E8F0]"
                      >
                        <span className="font-bold text-[#1E293B] shrink-0 mr-2">
                          Quadro {idx + 1}:
                        </span>
                        {g ? (
                          <span className="font-mono font-bold text-[#005CA9] text-right">
                            {g.numbers
                              .map((n) => String(n).padStart(2, '0'))
                              .join(' - ')}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] italic">
                            Em branco (não preenchido)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Hidden-on-screen Print Container rendered when user triggers window.print() */}
          <div className="hidden print:block fixed inset-0 bg-white z-50 p-0 m-0">
            {activeBatches.map((batch) => (
              <div
                key={batch.slipIndex}
                className="w-[83mm] h-[158mm] break-after-page mx-auto"
              >
                {renderSlipSvg(batch, true)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
