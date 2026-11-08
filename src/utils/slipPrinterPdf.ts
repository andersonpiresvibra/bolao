import { LotteryGame, LotteryType } from '../types';

export type SlipPrintMode =
  | 'DIRECT_SLIP'
  | 'A4_GUIDE_OVERLAY'
  | 'A4_FULL_MOLD';

export type GuideOverlaySubStep = 'PRINT_GUIDE_SHEET' | 'PRINT_MARKS_ONLY';

export interface SlipCalibrationConfig {
  offsetXMm: number;
  offsetYMm: number;
  markWidthMm: number;
  markHeightMm: number;
  gamesPerSlip: 1 | 2 | 3;
}

export interface SlipCardBatch {
  slipIndex: number; // 1-based
  games: LotteryGame[];
}

export const DEFAULT_CALIBRATION_BY_LOTTERY: Record<
  LotteryType,
  SlipCalibrationConfig
> = {
  MEGA_SENA: {
    offsetXMm: 0,
    offsetYMm: 0,
    markWidthMm: 4.2,
    markHeightMm: 2.5,
    gamesPerSlip: 3,
  },
  LOTOFACIL: {
    offsetXMm: 0,
    offsetYMm: 0,
    markWidthMm: 5.8,
    markHeightMm: 3.0,
    gamesPerSlip: 3,
  },
  QUINA: {
    offsetXMm: 0,
    offsetYMm: 0,
    markWidthMm: 4.2,
    markHeightMm: 2.2,
    gamesPerSlip: 3,
  },
};

export interface LotterySlipGeometry {
  slipWidthMm: number;
  slipHeightMm: number;
  cols: number;
  rows: number;
  totalNumbers: number;
  allowedDozensChoices: number[];
  headerHeightMm: number;
  boardTopStartMm: number;
  boardHeightMm: number;
  boardGapMm: number;
  gridLeftMm: number;
  gridWidthMm: number;
  cellPitchXMm: number;
  cellPitchYMm: number;
}

export function getSlipGeometry(lotteryType: LotteryType): LotterySlipGeometry {
  // Official Caixa Econômica Federal physical slip dimensions: 83mm x 158mm
  const slipWidthMm = 83;
  const slipHeightMm = 158;

  if (lotteryType === 'LOTOFACIL') {
    const cols = 5;
    const rows = 5;
    const gridLeftMm = 9.5;
    const gridWidthMm = 64;
    const boardHeightMm = 37;
    return {
      slipWidthMm,
      slipHeightMm,
      cols,
      rows,
      totalNumbers: 25,
      allowedDozensChoices: [15, 16, 17, 18, 19, 20],
      headerHeightMm: 22,
      boardTopStartMm: 25,
      boardHeightMm,
      boardGapMm: 4.5,
      gridLeftMm,
      gridWidthMm,
      cellPitchXMm: gridWidthMm / cols,
      cellPitchYMm: 4.6,
    };
  }

  if (lotteryType === 'QUINA') {
    const cols = 10;
    const rows = 8;
    const gridLeftMm = 8.5;
    const gridWidthMm = 66;
    const boardHeightMm = 39;
    return {
      slipWidthMm,
      slipHeightMm,
      cols,
      rows,
      totalNumbers: 80,
      allowedDozensChoices: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      headerHeightMm: 20,
      boardTopStartMm: 22,
      boardHeightMm,
      boardGapMm: 3.5,
      gridLeftMm,
      gridWidthMm,
      cellPitchXMm: gridWidthMm / cols,
      cellPitchYMm: 3.6,
    };
  }

  // MEGA_SENA (Default: 60 numbers = 10 cols x 6 rows per board)
  const cols = 10;
  const rows = 6;
  const gridLeftMm = 8.5;
  const gridWidthMm = 66;
  const boardHeightMm = 38;
  return {
    slipWidthMm,
    slipHeightMm,
    cols,
    rows,
    totalNumbers: 60,
    allowedDozensChoices: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    headerHeightMm: 22,
    boardTopStartMm: 24,
    boardHeightMm,
    boardGapMm: 4.0,
    gridLeftMm,
    gridWidthMm,
    cellPitchXMm: gridWidthMm / cols,
    cellPitchYMm: 4.3,
  };
}

/**
 * Groups approved games into physical slips (up to gamesPerSlip games per slip: Jogo 1, Jogo 2, Jogo 3)
 */
export function groupGamesIntoSlips(
  approvedGames: LotteryGame[],
  gamesPerSlip: 1 | 2 | 3 = 3
): SlipCardBatch[] {
  const batches: SlipCardBatch[] = [];
  for (let i = 0; i < approvedGames.length; i += gamesPerSlip) {
    batches.push({
      slipIndex: batches.length + 1,
      games: approvedGames.slice(i, i + gamesPerSlip),
    });
  }
  return batches;
}

// Helper to escape ASCII strings for PDF literals
function pdfEscapeText(input: string): string {
  const ascii = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
  return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const MM_TO_PT = 72 / 25.4; // 1 mm = 2.83464567 pt

function mmToPt(mm: number): number {
  return Number((mm * MM_TO_PT).toFixed(2));
}

/**
 * Draws a single slip at top-left origin (originXMm, originYMm) into PDF content stream commands.
 * Note: PDF Y-coordinates grow upward from the bottom of the page, so we convert from top-down mm.
 */
function buildSingleSlipPdfCommands(params: {
  pageHeightMm: number;
  originXMm: number;
  originYMm: number;
  batch: SlipCardBatch;
  lotteryType: LotteryType;
  lotteryName: string;
  contestNumber: string;
  poolTitle: string;
  mode: SlipPrintMode;
  guideSubStep: GuideOverlaySubStep;
  calibration: SlipCalibrationConfig;
}): string {
  const {
    pageHeightMm,
    originXMm,
    originYMm,
    batch,
    lotteryType,
    lotteryName,
    contestNumber,
    poolTitle,
    mode,
    guideSubStep,
    calibration,
  } = params;

  const geom = getSlipGeometry(lotteryType);
  const cmds: string[] = [];

  // Helper to convert top-down (xMm, yMm, wMm, hMm) into PDF bottom-up rectangle
  const rectMm = (xMm: number, yMm: number, wMm: number, hMm: number) => {
    const xPt = mmToPt(xMm);
    const yPt = mmToPt(pageHeightMm - yMm - hMm);
    const wPt = mmToPt(wMm);
    const hPt = mmToPt(hMm);
    return `${xPt} ${yPt} ${wPt} ${hPt} re`;
  };

  const textMm = (
    xMm: number,
    yMm: number,
    sizePt: number,
    text: string,
    rgb: [number, number, number] = [0, 0, 0]
  ) => {
    const xPt = mmToPt(xMm);
    const yPt = mmToPt(pageHeightMm - yMm);
    return [
      'BT',
      `${rgb[0]} ${rgb[1]} ${rgb[2]} rg`,
      `/F1 ${sizePt} Tf`,
      `${xPt} ${yPt} Td`,
      `(${pdfEscapeText(text)}) Tj`,
      'ET',
    ].join('\n');
  };

  const isGuideSheetOnly =
    mode === 'A4_GUIDE_OVERLAY' && guideSubStep === 'PRINT_GUIDE_SHEET';
  const isMarksOnly =
    mode === 'DIRECT_SLIP' ||
    (mode === 'A4_GUIDE_OVERLAY' && guideSubStep === 'PRINT_MARKS_ONLY');
  const isFullMold = mode === 'A4_FULL_MOLD';

  // 1. If Guide Sheet Only: draw alignment frame for taping the physical Caixa slip
  if (isGuideSheetOnly) {
    cmds.push('q');
    cmds.push('0 0.36 0.66 RG');
    cmds.push('0.8 w');
    cmds.push('[4 2] 0 d');
    cmds.push(`${rectMm(originXMm, originYMm, geom.slipWidthMm, geom.slipHeightMm)} S`);
    cmds.push('[] 0 d');

    // Corner registration L-marks
    cmds.push('0 0 0 rg');
    cmds.push(`${rectMm(originXMm, originYMm, 6, 1.2)} f`);
    cmds.push(`${rectMm(originXMm, originYMm, 1.2, 6)} f`);
    cmds.push(`${rectMm(originXMm + geom.slipWidthMm - 6, originYMm, 6, 1.2)} f`);
    cmds.push(`${rectMm(originXMm + geom.slipWidthMm - 1.2, originYMm, 1.2, 6)} f`);

    cmds.push(
      textMm(
        originXMm + 6,
        originYMm + 14,
        9,
        `CARTAO OFICIAL #${String(batch.slipIndex).padStart(2, '0')} (${lotteryName.toUpperCase()})`,
        [0, 0.36, 0.66]
      )
    );
    cmds.push(
      textMm(
        originXMm + 6,
        originYMm + 20,
        7.5,
        '1. Posicione o volante fisico da Caixa exatamente neste retangulo',
        [0.2, 0.25, 0.3]
      )
    );
    cmds.push(
      textMm(
        originXMm + 6,
        originYMm + 25,
        7.5,
        '2. Prenda o topo com um pedaco pequeno de fita crepe suave',
        [0.2, 0.25, 0.3]
      )
    );
    cmds.push(
      textMm(
        originXMm + 6,
        originYMm + 30,
        7.5,
        '3. Volte a folha para a bandeja e clique no Passo 2 (Imprimir Marcacoes)',
        [0.2, 0.25, 0.3]
      )
    );
    cmds.push(
      textMm(
        originXMm + 6,
        originYMm + 42,
        8,
        `Medida oficial: ${geom.slipWidthMm} mm x ${geom.slipHeightMm} mm`,
        [0, 0.54, 0.28]
      )
    );
    cmds.push('Q');
    return cmds.join('\n');
  }

  // Apply user printer calibration offsets (X and Y in mm) when printing marks
  const calOriginX = originXMm + calibration.offsetXMm;
  const calOriginY = originYMm + calibration.offsetYMm;

  // 2. If Full Mold: draw cut line, header, optical timing bars, and cell outlines
  if (isFullMold) {
    cmds.push('q');
    // Dashed outer cut border
    cmds.push('0.55 0.62 0.70 RG');
    cmds.push('0.5 w');
    cmds.push('[3 2] 0 d');
    cmds.push(`${rectMm(originXMm, originYMm, geom.slipWidthMm, geom.slipHeightMm)} S`);
    cmds.push('[] 0 d');

    // Header band
    cmds.push('0 0.36 0.66 rg');
    cmds.push(`${rectMm(calOriginX + 3, calOriginY + 3, geom.slipWidthMm - 6, 13)} f`);
    cmds.push(
      textMm(
        calOriginX + 6,
        calOriginY + 9.5,
        9.5,
        `${lotteryName.toUpperCase()} - VOLANTE #${String(batch.slipIndex).padStart(2, '0')}`,
        [1, 1, 1]
      )
    );
    cmds.push(
      textMm(
        calOriginX + 6,
        calOriginY + 14,
        6.5,
        `Conc. ${contestNumber} | ${poolTitle.slice(0, 32)}`,
        [0.9, 0.95, 1]
      )
    );
    cmds.push('Q');
  }

  // 3. Draw up to 3 game boards (Quadro 1, Quadro 2, Quadro 3)
  for (let boardIdx = 0; boardIdx < 3; boardIdx++) {
    const game = batch.games[boardIdx];
    const boardTopMm =
      calOriginY +
      geom.boardTopStartMm +
      boardIdx * (geom.boardHeightMm + geom.boardGapMm);

    if (isFullMold) {
      // Board title & subtle frame
      cmds.push('q');
      cmds.push('0.82 0.86 0.90 RG');
      cmds.push('0.4 w');
      cmds.push(
        `${rectMm(
          calOriginX + 6.5,
          boardTopMm - 3.5,
          geom.slipWidthMm - 10,
          geom.boardHeightMm + 2.5
        )} S`
      );
      cmds.push(
        textMm(
          calOriginX + 8.5,
          boardTopMm - 0.8,
          6.5,
          game
            ? `JOGO ${boardIdx + 1} (${game.numbers.length} DEZ) - AUTOR: ${(
                game.authorName || 'ORGANIZADOR'
              ).slice(0, 18)}`
            : `JOGO ${boardIdx + 1} (EM BRANCO / NAO UTILIZADO)`,
          [0.15, 0.2, 0.28]
        )
      );
      cmds.push('Q');
    }

    // Iterate through rows and cols of the board
    for (let r = 0; r < geom.rows; r++) {
      const rowYMm = boardTopMm + 1.8 + r * geom.cellPitchYMm;

      // Left optical timing synchronization track (Mandatory in Full Mold for optical reader)
      if (isFullMold) {
        cmds.push('0 0 0 rg');
        cmds.push(
          `${rectMm(
            calOriginX + 2.2,
            rowYMm + (geom.cellPitchYMm - calibration.markHeightMm) / 2,
            3.2,
            calibration.markHeightMm
          )} f`
        );
      }

      for (let c = 0; c < geom.cols; c++) {
        const num = r * geom.cols + c + 1;
        if (num > geom.totalNumbers) continue;

        const cellXMm = calOriginX + geom.gridLeftMm + c * geom.cellPitchXMm;
        const isMarked = game ? game.numbers.includes(num) : false;

        const markXMm =
          cellXMm + (geom.cellPitchXMm - calibration.markWidthMm) / 2;
        const markYMm =
          rowYMm + (geom.cellPitchYMm - calibration.markHeightMm) / 2;

        if (isFullMold && !isMarked) {
          // Light cell box + number label
          cmds.push('0.75 0.45 0.45 RG');
          cmds.push('0.25 w');
          cmds.push(
            `${rectMm(
              markXMm,
              markYMm,
              calibration.markWidthMm,
              calibration.markHeightMm
            )} S`
          );
          cmds.push(
            textMm(
              markXMm + 0.7,
              markYMm + calibration.markHeightMm - 0.5,
              5.2,
              String(num).padStart(2, '0'),
              [0.55, 0.25, 0.25]
            )
          );
        }

        // SOLID BLACK MARK (Printed in both Full Mold and Direct/Overlay Marks Mode!)
        if (isMarked) {
          cmds.push('0 0 0 rg');
          cmds.push(
            `${rectMm(
              markXMm,
              markYMm,
              calibration.markWidthMm,
              calibration.markHeightMm
            )} f`
          );
        }
      }
    }

    // Dozens quantity selector row at the bottom of each board
    const qtyRowYMm = boardTopMm + 2.2 + geom.rows * geom.cellPitchYMm;
    const choices = geom.allowedDozensChoices.slice(0, 10);
    const qtyPitchX = geom.gridWidthMm / Math.max(6, choices.length);

    if (isFullMold) {
      // Optical timing mark for the quantity row
      cmds.push('0 0 0 rg');
      cmds.push(
        `${rectMm(
          calOriginX + 2.2,
          qtyRowYMm,
          3.2,
          calibration.markHeightMm * 0.85
        )} f`
      );
    }

    choices.forEach((choiceNum, idx) => {
      const qx = calOriginX + geom.gridLeftMm + idx * qtyPitchX;
      const isQtySelected = game ? game.numbers.length === choiceNum : false;
      const qMarkW = Math.min(calibration.markWidthMm, qtyPitchX - 0.8);
      const qMarkH = calibration.markHeightMm * 0.85;

      if (isFullMold && !isQtySelected) {
        cmds.push('0.75 0.45 0.45 RG');
        cmds.push('0.25 w');
        cmds.push(`${rectMm(qx, qtyRowYMm, qMarkW, qMarkH)} S`);
        cmds.push(
          textMm(
            qx + 0.6,
            qtyRowYMm + qMarkH - 0.4,
            4.8,
            String(choiceNum),
            [0.55, 0.25, 0.25]
          )
        );
      }

      if (isQtySelected) {
        cmds.push('0 0 0 rg');
        cmds.push(`${rectMm(qx, qtyRowYMm, qMarkW, qMarkH)} f`);
      }
    });
  }

  // Bottom optical anchor bar in Full Mold mode
  if (isFullMold) {
    cmds.push('0 0 0 rg');
    cmds.push(
      `${rectMm(calOriginX + 2.2, calOriginY + geom.slipHeightMm - 5.5, 5.5, 2.2)} f`
    );
    cmds.push(
      `${rectMm(
        calOriginX + geom.slipWidthMm - 7.7,
        calOriginY + geom.slipHeightMm - 5.5,
        5.5,
        2.2
      )} f`
    );
    cmds.push(
      textMm(
        calOriginX + 10,
        calOriginY + geom.slipHeightMm - 3.8,
        5.5,
        'ESCALA 100% REAL - RECORTAR NA LINHA TRACEJADA',
        [0.35, 0.4, 0.45]
      )
    );
  } else if (isMarksOnly) {
    // Tiny micro-index at top-right margin so organizer knows which slip is which
    cmds.push(
      textMm(
        calOriginX + geom.slipWidthMm - 18,
        calOriginY + 4.5,
        5.5,
        `#${String(batch.slipIndex).padStart(2, '0')}`,
        [0.2, 0.2, 0.2]
      )
    );
  }

  return cmds.join('\n');
}

/**
 * Generates a binary-valid Vector PDF 1.4 Blob at exact 100% physical millimeter scale
 * and triggers a browser file download.
 */
export function downloadSlipsVectorPdf(params: {
  batches: SlipCardBatch[];
  lotteryType: LotteryType;
  lotteryName: string;
  contestNumber: string;
  poolTitle: string;
  mode: SlipPrintMode;
  guideSubStep: GuideOverlaySubStep;
  calibration: SlipCalibrationConfig;
}): void {
  const {
    batches,
    lotteryType,
    lotteryName,
    contestNumber,
    poolTitle,
    mode,
    guideSubStep,
    calibration,
  } = params;

  if (batches.length === 0) return;

  const geom = getSlipGeometry(lotteryType);

  // Page size in mm:
  // - DIRECT_SLIP: 1 slip per page of exact 83mm x 158mm
  // - A4 modes: 3 slips side-by-side on A4 Landscape (297mm x 210mm)
  const isDirectSingle = mode === 'DIRECT_SLIP';
  const pageWidthMm = isDirectSingle ? geom.slipWidthMm : 297;
  const pageHeightMm = isDirectSingle ? geom.slipHeightMm : 210;

  const pageStreams: string[] = [];

  if (isDirectSingle) {
    for (const batch of batches) {
      pageStreams.push(
        buildSingleSlipPdfCommands({
          pageHeightMm,
          originXMm: 0,
          originYMm: 0,
          batch,
          lotteryType,
          lotteryName,
          contestNumber,
          poolTitle,
          mode,
          guideSubStep,
          calibration,
        })
      );
    }
  } else {
    // 3 slips per A4 Landscape sheet (297mm wide x 210mm high)
    // Total width of 3 slips = 3 * 83 = 249mm. Remaining 48mm => 12mm left margin + 12mm gap between slips
    const leftMarginMm = 12;
    const topMarginMm = 22;
    const slipGapMm = 12;

    for (let i = 0; i < batches.length; i += 3) {
      const sheetBatches = batches.slice(i, i + 3);
      const sheetCmds: string[] = [];

      // Sheet header outside the cut area
      const sheetNum = Math.floor(i / 3) + 1;
      const modeTitle =
        mode === 'A4_GUIDE_OVERLAY'
          ? guideSubStep === 'PRINT_GUIDE_SHEET'
            ? 'FOLHA-GUIA A4 PARA COLAR 3 CARTOES OFICIAIS DA CAIXA'
            : 'IMPRESSAO DE MARCACOES SOBRE OS 3 CARTOES COLADOS NA GUIA A4'
          : 'FOLHA A4 COM MOLDE COMPLETO E MARCAS OPTICAS (RECORTAR NA LINHA TRACEJADA)';

      sheetCmds.push('BT');
      sheetCmds.push('0 0.25 0.50 rg');
      sheetCmds.push('/F1 9 Tf');
      sheetCmds.push(
        `${mmToPt(leftMarginMm)} ${mmToPt(pageHeightMm - 10)} Td`
      );
      sheetCmds.push(
        `(${pdfEscapeText(
          `${poolTitle.toUpperCase()} - ${modeTitle} - FOLHA #${sheetNum}`
        )}) Tj`
      );
      sheetCmds.push('ET');

      sheetCmds.push('BT');
      sheetCmds.push('0.35 0.40 0.45 rg');
      sheetCmds.push('/F1 7.5 Tf');
      sheetCmds.push(
        `${mmToPt(leftMarginMm)} ${mmToPt(pageHeightMm - 15)} Td`
      );
      sheetCmds.push(
        `(${pdfEscapeText(
          `IMPORTANTE: Imprima em Escala 100% (Tamanho Real). Nao marque 'Ajustar a pagina'. Offset calibrado: X=${calibration.offsetXMm}mm, Y=${calibration.offsetYMm}mm.`
        )}) Tj`
      );
      sheetCmds.push('ET');

      sheetBatches.forEach((batch, slotIdx) => {
        const originXMm =
          leftMarginMm + slotIdx * (geom.slipWidthMm + slipGapMm);
        const originYMm = topMarginMm;

        sheetCmds.push(
          buildSingleSlipPdfCommands({
            pageHeightMm,
            originXMm,
            originYMm,
            batch,
            lotteryType,
            lotteryName,
            contestNumber,
            poolTitle,
            mode,
            guideSubStep,
            calibration,
          })
        );
      });

      pageStreams.push(sheetCmds.join('\n'));
    }
  }

  // Assemble PDF 1.4 objects
  // Obj 1: Catalog
  // Obj 2: Pages
  // Obj 3: Font (/Helvetica-Bold)
  // For each page i: Obj (4 + i*2) = Page, Obj (5 + i*2) = Content stream
  const objects: string[] = [];
  const pageObjNumbers: number[] = [];

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // Placeholder for Obj 2 (Pages), filled after we know pageObjNumbers
  objects.push('');
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj'
  );

  const pageWPt = mmToPt(pageWidthMm);
  const pageHPt = mmToPt(pageHeightMm);

  pageStreams.forEach((streamContent, idx) => {
    const pageObjNum = 4 + idx * 2;
    const contentObjNum = 5 + idx * 2;
    pageObjNumbers.push(pageObjNum);

    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWPt} ${pageHPt}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`
    );
  });

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNumbers
    .map((n) => `${n} 0 R`)
    .join(' ')}] /Count ${pageObjNumbers.length} >>\nendobj`;

  let pdfBody = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const objStr of objects) {
    offsets.push(pdfBody.length);
    pdfBody += objStr + '\n';
  }

  const xrefOffset = pdfBody.length;
  pdfBody += `xref\n0 ${objects.length + 1}\n`;
  pdfBody += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdfBody += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdfBody += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdfBody], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = poolTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  link.href = url;
  link.download = `volantes-${slug || 'bolao'}-${mode.toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
