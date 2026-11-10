import type { LotteryType, LotteryGame, PlayerSuggestion } from '../types.ts';

export interface LotteryRulesConfig {
  type: LotteryType;
  name: string;
  specialName: string;
  specialContestName: string;
  accentColor: string;
  bgTint: string;
  minNumbers: number;
  maxNumbers: number;
  totalPoolNumbers: number;
  baseSimpleBetPrice: number;
  prizeTiers: string[];
  priceTable: Record<number, { betsEquivalent: number; price: number; probabilityOneIn: number }>;
  allTimeMostPlayed: { number: number; drawnCount: number; frequencyPct: number }[];
  specialContestMostPlayed: { number: number; drawnCount: number; frequencyPct: number }[];
}

export const ALL_LOTTERY_TYPES: LotteryType[] = [
  'MEGA_SENA',
  'LOTOFACIL',
  'QUINA',
  'LOTOMANIA',
  'DUPLA_SENA',
  'TIMEMANIA',
  'DIA_DE_SORTE',
];

export const LOTTERY_CONFIGS: Record<LotteryType, LotteryRulesConfig> = {
  MEGA_SENA: {
    type: 'MEGA_SENA',
    name: 'Mega-Sena',
    specialName: 'Mega da Virada — Concurso 2950',
    specialContestName: 'Mega da Virada',
    accentColor: '#008B47',
    bgTint: '#F0FDF4',
    minNumbers: 6,
    maxNumbers: 20,
    totalPoolNumbers: 60,
    baseSimpleBetPrice: 5.0,
    prizeTiers: ['Sena (6 acertos)', 'Quina (5 acertos)', 'Quadra (4 acertos)'],
    priceTable: {
      6: { betsEquivalent: 1, price: 5.0, probabilityOneIn: 50063860 },
      7: { betsEquivalent: 7, price: 35.0, probabilityOneIn: 7151980 },
      8: { betsEquivalent: 28, price: 140.0, probabilityOneIn: 1787995 },
      9: { betsEquivalent: 84, price: 420.0, probabilityOneIn: 595998 },
      10: { betsEquivalent: 210, price: 1050.0, probabilityOneIn: 238399 },
      11: { betsEquivalent: 462, price: 2310.0, probabilityOneIn: 108363 },
      12: { betsEquivalent: 924, price: 4620.0, probabilityOneIn: 54182 },
      13: { betsEquivalent: 1716, price: 8580.0, probabilityOneIn: 29175 },
      14: { betsEquivalent: 3003, price: 15015.0, probabilityOneIn: 16671 },
      15: { betsEquivalent: 5005, price: 25025.0, probabilityOneIn: 10003 },
      16: { betsEquivalent: 8008, price: 40040.0, probabilityOneIn: 6252 },
      17: { betsEquivalent: 12376, price: 61880.0, probabilityOneIn: 4045 },
      18: { betsEquivalent: 18564, price: 92820.0, probabilityOneIn: 2697 },
      19: { betsEquivalent: 27132, price: 135660.0, probabilityOneIn: 1845 },
      20: { betsEquivalent: 38760, price: 193800.0, probabilityOneIn: 1292 },
    },
    // Historical Official All-Time Most Drawn & Played Numbers (Mega-Sena)
    allTimeMostPlayed: [
      { number: 10, drawnCount: 329, frequencyPct: 11.8 },
      { number: 53, drawnCount: 319, frequencyPct: 11.4 },
      { number: 5, drawnCount: 311, frequencyPct: 11.1 },
      { number: 37, drawnCount: 304, frequencyPct: 10.9 },
      { number: 34, drawnCount: 302, frequencyPct: 10.8 },
      { number: 33, drawnCount: 300, frequencyPct: 10.7 },
      { number: 38, drawnCount: 298, frequencyPct: 10.6 },
      { number: 23, drawnCount: 297, frequencyPct: 10.5 },
      { number: 4, drawnCount: 295, frequencyPct: 10.4 },
      { number: 17, drawnCount: 294, frequencyPct: 10.4 },
      { number: 42, drawnCount: 293, frequencyPct: 10.3 },
      { number: 30, drawnCount: 291, frequencyPct: 10.2 },
    ],
    specialContestMostPlayed: [
      { number: 10, drawnCount: 5, frequencyPct: 31.2 },
      { number: 5, drawnCount: 4, frequencyPct: 25.0 },
      { number: 33, drawnCount: 4, frequencyPct: 25.0 },
      { number: 3, drawnCount: 4, frequencyPct: 25.0 },
      { number: 20, drawnCount: 4, frequencyPct: 25.0 },
      { number: 34, drawnCount: 4, frequencyPct: 25.0 },
      { number: 36, drawnCount: 4, frequencyPct: 25.0 },
      { number: 58, drawnCount: 4, frequencyPct: 25.0 },
    ],
  },
  LOTOFACIL: {
    type: 'LOTOFACIL',
    name: 'Lotofácil',
    specialName: 'Lotofácil da Independência / Fim de Ano',
    specialContestName: 'Lotofácil da Independência',
    accentColor: '#7E22CE',
    bgTint: '#FAF5FF',
    minNumbers: 15,
    maxNumbers: 20,
    totalPoolNumbers: 25,
    baseSimpleBetPrice: 3.0,
    prizeTiers: ['15 pontos', '14 pontos', '13 pontos', '12 pontos', '11 pontos'],
    priceTable: {
      15: { betsEquivalent: 1, price: 3.0, probabilityOneIn: 3268760 },
      16: { betsEquivalent: 16, price: 48.0, probabilityOneIn: 204298 },
      17: { betsEquivalent: 136, price: 408.0, probabilityOneIn: 24035 },
      18: { betsEquivalent: 816, price: 2448.0, probabilityOneIn: 4006 },
      19: { betsEquivalent: 3876, price: 11628.0, probabilityOneIn: 843 },
      20: { betsEquivalent: 15504, price: 46512.0, probabilityOneIn: 211 },
    },
    allTimeMostPlayed: [
      { number: 20, drawnCount: 2118, frequencyPct: 62.8 },
      { number: 10, drawnCount: 2104, frequencyPct: 62.4 },
      { number: 25, drawnCount: 2095, frequencyPct: 62.1 },
      { number: 11, drawnCount: 2081, frequencyPct: 61.7 },
      { number: 13, drawnCount: 2069, frequencyPct: 61.3 },
      { number: 24, drawnCount: 2062, frequencyPct: 61.1 },
      { number: 14, drawnCount: 2058, frequencyPct: 61.0 },
      { number: 3, drawnCount: 2051, frequencyPct: 60.8 },
      { number: 4, drawnCount: 2047, frequencyPct: 60.6 },
      { number: 1, drawnCount: 2040, frequencyPct: 60.4 },
      { number: 12, drawnCount: 2036, frequencyPct: 60.3 },
      { number: 2, drawnCount: 2031, frequencyPct: 60.1 },
      { number: 15, drawnCount: 2028, frequencyPct: 60.0 },
      { number: 22, drawnCount: 2020, frequencyPct: 59.8 },
      { number: 9, drawnCount: 2015, frequencyPct: 59.6 },
    ],
    specialContestMostPlayed: [
      { number: 3, drawnCount: 12, frequencyPct: 85.7 },
      { number: 6, drawnCount: 12, frequencyPct: 85.7 },
      { number: 22, drawnCount: 12, frequencyPct: 85.7 },
      { number: 12, drawnCount: 11, frequencyPct: 78.6 },
      { number: 14, drawnCount: 11, frequencyPct: 78.6 },
      { number: 23, drawnCount: 11, frequencyPct: 78.6 },
      { number: 24, drawnCount: 11, frequencyPct: 78.6 },
      { number: 25, drawnCount: 11, frequencyPct: 78.6 },
    ],
  },
  QUINA: {
    type: 'QUINA',
    name: 'Quina',
    specialName: 'Quina de São João / Especial Corporativo',
    specialContestName: 'Quina de São João',
    accentColor: '#005CA9',
    bgTint: '#EFF6FF',
    minNumbers: 5,
    maxNumbers: 15,
    totalPoolNumbers: 80,
    baseSimpleBetPrice: 2.5,
    prizeTiers: ['Quina (5 acertos)', 'Quadra (4 acertos)', 'Terno (3 acertos)', 'Duque (2 acertos)'],
    priceTable: {
      5: { betsEquivalent: 1, price: 2.5, probabilityOneIn: 24040016 },
      6: { betsEquivalent: 6, price: 15.0, probabilityOneIn: 4006669 },
      7: { betsEquivalent: 21, price: 52.5, probabilityOneIn: 1144763 },
      8: { betsEquivalent: 56, price: 140.0, probabilityOneIn: 429286 },
      9: { betsEquivalent: 126, price: 315.0, probabilityOneIn: 190794 },
      10: { betsEquivalent: 252, price: 630.0, probabilityOneIn: 95396 },
      11: { betsEquivalent: 462, price: 1155.0, probabilityOneIn: 52035 },
      12: { betsEquivalent: 792, price: 1980.0, probabilityOneIn: 30354 },
      13: { betsEquivalent: 1287, price: 3217.5, probabilityOneIn: 18679 },
      14: { betsEquivalent: 2002, price: 5005.0, probabilityOneIn: 12008 },
      15: { betsEquivalent: 3003, price: 7507.5, probabilityOneIn: 8005 },
    },
    allTimeMostPlayed: [
      { number: 4, drawnCount: 469, frequencyPct: 7.4 },
      { number: 49, drawnCount: 454, frequencyPct: 7.2 },
      { number: 26, drawnCount: 451, frequencyPct: 7.1 },
      { number: 52, drawnCount: 448, frequencyPct: 7.1 },
      { number: 31, drawnCount: 443, frequencyPct: 7.0 },
      { number: 44, drawnCount: 440, frequencyPct: 6.9 },
      { number: 39, drawnCount: 438, frequencyPct: 6.9 },
      { number: 53, drawnCount: 436, frequencyPct: 6.8 },
      { number: 15, drawnCount: 434, frequencyPct: 6.8 },
      { number: 5, drawnCount: 431, frequencyPct: 6.7 },
    ],
    specialContestMostPlayed: [
      { number: 55, drawnCount: 4, frequencyPct: 28.6 },
      { number: 14, drawnCount: 4, frequencyPct: 28.6 },
      { number: 15, drawnCount: 3, frequencyPct: 21.4 },
      { number: 17, drawnCount: 3, frequencyPct: 21.4 },
      { number: 26, drawnCount: 3, frequencyPct: 21.4 },
      { number: 28, drawnCount: 3, frequencyPct: 21.4 },
      { number: 79, drawnCount: 3, frequencyPct: 21.4 },
      { number: 7, drawnCount: 3, frequencyPct: 21.4 },
    ],
  },
  LOTOMANIA: {
    type: 'LOTOMANIA',
    name: 'Lotomania',
    specialName: 'Lotomania de Páscoa',
    specialContestName: 'Lotomania de Páscoa',
    accentColor: '#EA580C',
    bgTint: '#FFF7ED',
    minNumbers: 20,
    maxNumbers: 50,
    totalPoolNumbers: 100,
    baseSimpleBetPrice: 3.0,
    prizeTiers: ['20 acertos', '19 acertos', '18 acertos', '17 acertos', '16 acertos', '0 acertos'],
    priceTable: {
      20: { betsEquivalent: 1, price: 3.0, probabilityOneIn: 11372635 },
      50: { betsEquivalent: 1, price: 3.0, probabilityOneIn: 11372635 },
    },
    allTimeMostPlayed: [
      { number: 47, drawnCount: 540, frequencyPct: 21.2 },
      { number: 43, drawnCount: 536, frequencyPct: 21.0 },
      { number: 49, drawnCount: 534, frequencyPct: 20.9 },
      { number: 54, drawnCount: 530, frequencyPct: 20.8 },
      { number: 31, drawnCount: 528, frequencyPct: 20.7 },
      { number: 17, drawnCount: 525, frequencyPct: 20.6 },
      { number: 41, drawnCount: 523, frequencyPct: 20.5 },
      { number: 92, drawnCount: 520, frequencyPct: 20.4 },
      { number: 24, drawnCount: 518, frequencyPct: 20.3 },
      { number: 67, drawnCount: 515, frequencyPct: 20.2 },
    ],
    specialContestMostPlayed: [
      { number: 47, drawnCount: 5, frequencyPct: 45.0 },
      { number: 17, drawnCount: 5, frequencyPct: 45.0 },
      { number: 43, drawnCount: 4, frequencyPct: 36.0 },
      { number: 31, drawnCount: 4, frequencyPct: 36.0 },
      { number: 54, drawnCount: 4, frequencyPct: 36.0 },
      { number: 92, drawnCount: 4, frequencyPct: 36.0 },
      { number: 24, drawnCount: 4, frequencyPct: 36.0 },
      { number: 67, drawnCount: 4, frequencyPct: 36.0 },
    ],
  },
  DUPLA_SENA: {
    type: 'DUPLA_SENA',
    name: 'Dupla Sena',
    specialName: 'Dupla de Páscoa',
    specialContestName: 'Dupla de Páscoa',
    accentColor: '#BE123C',
    bgTint: '#FFF1F2',
    minNumbers: 6,
    maxNumbers: 15,
    totalPoolNumbers: 50,
    baseSimpleBetPrice: 2.5,
    prizeTiers: ['Sena (6 acertos)', 'Quina (5 acertos)', 'Quadra (4 acertos)', 'Terno (3 acertos)'],
    priceTable: {
      6: { betsEquivalent: 1, price: 2.5, probabilityOneIn: 15890700 },
      7: { betsEquivalent: 7, price: 17.5, probabilityOneIn: 2270100 },
      8: { betsEquivalent: 28, price: 70.0, probabilityOneIn: 567525 },
      9: { betsEquivalent: 84, price: 210.0, probabilityOneIn: 189175 },
      10: { betsEquivalent: 210, price: 525.0, probabilityOneIn: 75670 },
      11: { betsEquivalent: 462, price: 1155.0, probabilityOneIn: 34395 },
      12: { betsEquivalent: 924, price: 2310.0, probabilityOneIn: 17197 },
      13: { betsEquivalent: 1716, price: 4290.0, probabilityOneIn: 9260 },
      14: { betsEquivalent: 3003, price: 7507.5, probabilityOneIn: 5291 },
      15: { betsEquivalent: 5005, price: 12512.5, probabilityOneIn: 3174 },
    },
    allTimeMostPlayed: [
      { number: 39, drawnCount: 382, frequencyPct: 14.1 },
      { number: 14, drawnCount: 378, frequencyPct: 13.9 },
      { number: 33, drawnCount: 375, frequencyPct: 13.8 },
      { number: 19, drawnCount: 372, frequencyPct: 13.7 },
      { number: 45, drawnCount: 370, frequencyPct: 13.6 },
      { number: 12, drawnCount: 368, frequencyPct: 13.5 },
      { number: 25, drawnCount: 365, frequencyPct: 13.4 },
      { number: 4, drawnCount: 362, frequencyPct: 13.3 },
      { number: 28, drawnCount: 360, frequencyPct: 13.2 },
      { number: 50, drawnCount: 358, frequencyPct: 13.1 },
    ],
    specialContestMostPlayed: [
      { number: 39, drawnCount: 4, frequencyPct: 33.3 },
      { number: 14, drawnCount: 4, frequencyPct: 33.3 },
      { number: 33, drawnCount: 4, frequencyPct: 33.3 },
      { number: 19, drawnCount: 3, frequencyPct: 25.0 },
      { number: 45, drawnCount: 3, frequencyPct: 25.0 },
      { number: 12, drawnCount: 3, frequencyPct: 25.0 },
      { number: 25, drawnCount: 3, frequencyPct: 25.0 },
      { number: 4, drawnCount: 3, frequencyPct: 25.0 },
    ],
  },
  TIMEMANIA: {
    type: 'TIMEMANIA',
    name: 'Timemania',
    specialName: 'Timemania Especial',
    specialContestName: 'Timemania Especial',
    accentColor: '#15803D',
    bgTint: '#F0FDF4',
    minNumbers: 10,
    maxNumbers: 10,
    totalPoolNumbers: 80,
    baseSimpleBetPrice: 3.5,
    prizeTiers: ['7 acertos', '6 acertos', '5 acertos', '4 acertos', '3 acertos', 'Time do Coração'],
    priceTable: {
      10: { betsEquivalent: 1, price: 3.5, probabilityOneIn: 26472637 },
    },
    allTimeMostPlayed: [
      { number: 20, drawnCount: 248, frequencyPct: 11.4 },
      { number: 72, drawnCount: 245, frequencyPct: 11.2 },
      { number: 66, drawnCount: 242, frequencyPct: 11.1 },
      { number: 21, drawnCount: 239, frequencyPct: 11.0 },
      { number: 35, drawnCount: 236, frequencyPct: 10.8 },
      { number: 50, drawnCount: 234, frequencyPct: 10.7 },
      { number: 49, drawnCount: 231, frequencyPct: 10.6 },
      { number: 79, drawnCount: 229, frequencyPct: 10.5 },
      { number: 42, drawnCount: 227, frequencyPct: 10.4 },
      { number: 15, drawnCount: 225, frequencyPct: 10.3 },
    ],
    specialContestMostPlayed: [
      { number: 20, drawnCount: 4, frequencyPct: 28.0 },
      { number: 72, drawnCount: 4, frequencyPct: 28.0 },
      { number: 66, drawnCount: 3, frequencyPct: 21.0 },
      { number: 21, drawnCount: 3, frequencyPct: 21.0 },
      { number: 35, drawnCount: 3, frequencyPct: 21.0 },
      { number: 50, drawnCount: 3, frequencyPct: 21.0 },
      { number: 49, drawnCount: 3, frequencyPct: 21.0 },
      { number: 79, drawnCount: 3, frequencyPct: 21.0 },
    ],
  },
  DIA_DE_SORTE: {
    type: 'DIA_DE_SORTE',
    name: 'Dia de Sorte',
    specialName: 'Dia de Sorte Especial',
    specialContestName: 'Dia de Sorte Especial',
    accentColor: '#D97706',
    bgTint: '#FFFBEB',
    minNumbers: 7,
    maxNumbers: 15,
    totalPoolNumbers: 31,
    baseSimpleBetPrice: 2.5,
    prizeTiers: ['7 acertos', '6 acertos', '5 acertos', '4 acertos', 'Mês da Sorte'],
    priceTable: {
      7: { betsEquivalent: 1, price: 2.5, probabilityOneIn: 2629575 },
      8: { betsEquivalent: 8, price: 20.0, probabilityOneIn: 328696 },
      9: { betsEquivalent: 36, price: 90.0, probabilityOneIn: 73043 },
      10: { betsEquivalent: 120, price: 300.0, probabilityOneIn: 21913 },
      11: { betsEquivalent: 330, price: 825.0, probabilityOneIn: 7968 },
      12: { betsEquivalent: 792, price: 1980.0, probabilityOneIn: 3320 },
      13: { betsEquivalent: 1716, price: 4290.0, probabilityOneIn: 1532 },
      14: { betsEquivalent: 3432, price: 8580.0, probabilityOneIn: 766 },
      15: { betsEquivalent: 6435, price: 16087.5, probabilityOneIn: 408 },
    },
    allTimeMostPlayed: [
      { number: 10, drawnCount: 256, frequencyPct: 25.4 },
      { number: 7, drawnCount: 252, frequencyPct: 25.0 },
      { number: 23, drawnCount: 249, frequencyPct: 24.7 },
      { number: 4, drawnCount: 246, frequencyPct: 24.4 },
      { number: 18, drawnCount: 244, frequencyPct: 24.2 },
      { number: 20, drawnCount: 241, frequencyPct: 23.9 },
      { number: 15, drawnCount: 239, frequencyPct: 23.7 },
      { number: 8, drawnCount: 237, frequencyPct: 23.5 },
      { number: 11, drawnCount: 235, frequencyPct: 23.3 },
      { number: 29, drawnCount: 233, frequencyPct: 23.1 },
    ],
    specialContestMostPlayed: [
      { number: 10, drawnCount: 5, frequencyPct: 35.0 },
      { number: 7, drawnCount: 5, frequencyPct: 35.0 },
      { number: 23, drawnCount: 4, frequencyPct: 28.0 },
      { number: 4, drawnCount: 4, frequencyPct: 28.0 },
      { number: 18, drawnCount: 4, frequencyPct: 28.0 },
      { number: 20, drawnCount: 4, frequencyPct: 28.0 },
      { number: 15, drawnCount: 4, frequencyPct: 28.0 },
      { number: 8, drawnCount: 4, frequencyPct: 28.0 },
    ],
  },
};

export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '').padStart(11, '0');
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function maskName(_name: string, index: number): string {
  return `Participante Corporativo #${String(index + 1).padStart(3, '0')}`;
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calculates the most played numbers by players of a specific company
 * combining official games and player suggestions (palpites).
 */
export function calculateCompanyMostPlayedNumbers(
  companyGames: LotteryGame[],
  companySuggestions: PlayerSuggestion[],
  topLimit = 12
): { number: number; count: number; percentage: number }[] {
  const counts: Record<number, number> = {};
  const totalTickets = Math.max(1, companyGames.length + companySuggestions.length);

  companyGames.forEach((g) => {
    g.numbers.forEach((n) => {
      counts[n] = (counts[n] || 0) + 1;
    });
  });

  companySuggestions.forEach((s) => {
    s.numbers.forEach((n) => {
      counts[n] = (counts[n] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .map(([numStr, count]) => ({
      number: Number(numStr),
      count,
      percentage: Math.min(100, Math.round((count / totalTickets) * 100)),
    }))
    .sort((a, b) => b.count - a.count || a.number - b.number)
    .slice(0, topLimit);
}

/**
 * Generates a smart combination merging All-Time Most Played numbers + Company Players' Most Played numbers
 */
export function generateStatisticalSmartBet(
  lotteryType: LotteryType,
  dozensCount: number,
  companyTopNumbers: number[]
): number[] {
  const config = LOTTERY_CONFIGS[lotteryType];
  const allTimeTop = config.allTimeMostPlayed.map((item) => item.number);
  const selected = new Set<number>();

  // Take 50% from Company's favorite numbers, 50% from All-Time Historical Top numbers
  const half = Math.ceil(dozensCount / 2);
  for (const n of companyTopNumbers) {
    if (selected.size < half && n >= 1 && n <= config.totalPoolNumbers) {
      selected.add(n);
    }
  }
  for (const n of allTimeTop) {
    if (selected.size < dozensCount && n >= 1 && n <= config.totalPoolNumbers) {
      selected.add(n);
    }
  }

  // Fill any remaining slots with balanced numbers
  while (selected.size < dozensCount) {
    const candidate = Math.floor(1 + Math.random() * config.totalPoolNumbers);
    selected.add(candidate);
  }

  return Array.from(selected).sort((a, b) => a - b);
}

export function generateSmartDesdobramento(
  lotteryType: LotteryType,
  baseUniverseCount: number,
  dozensPerTicket: number,
  ticketsCount: number
): {
  universeNumbers: number[];
  tickets: { numbers: number[]; cost: number; betsEquivalent: number }[];
  totalCost: number;
} {
  const config = LOTTERY_CONFIGS[lotteryType];
  const priceInfo = config.priceTable[dozensPerTicket] || {
    betsEquivalent: 1,
    price: config.baseSimpleBetPrice,
    probabilityOneIn: 1000000,
  };

  const allNumbers = Array.from({ length: config.totalPoolNumbers }, (_, i) => i + 1);
  const shuffled = [...allNumbers].sort(() => Math.random() - 0.5);
  const universeNumbers = shuffled
    .slice(0, Math.max(baseUniverseCount, dozensPerTicket))
    .sort((a, b) => a - b);

  const tickets: { numbers: number[]; cost: number; betsEquivalent: number }[] = [];
  const usedKeys = new Set<string>();

  for (let i = 0; i < ticketsCount; i++) {
    let selected: number[] = [];
    let attempts = 0;
    while (attempts < 40) {
      const rotated = [...universeNumbers].sort(() => Math.random() - 0.5);
      selected = rotated.slice(0, dozensPerTicket).sort((a, b) => a - b);
      const key = selected.join('-');
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        break;
      }
      attempts++;
    }
    tickets.push({
      numbers: selected,
      cost: priceInfo.price,
      betsEquivalent: priceInfo.betsEquivalent,
    });
  }

  return {
    universeNumbers,
    tickets,
    totalCost: tickets.reduce((acc, t) => acc + t.cost, 0),
  };
}

export interface LotteryFrequencyItem {
  number: number;
  drawnCount: number;
  frequencyPct: number;
  delayConcursos: number;
  temperature: 'HOT' | 'COLD' | 'NEUTRAL';
}

export interface RecentContestResult {
  contestNumber: string;
  drawDate: string;
  drawnNumbers: number[];
  accumulated?: boolean;
}

export interface LotteryStatsResponse {
  lotteryType: LotteryType;
  source: string;
  updatedAt: string;
  latestContest: RecentContestResult;
  recentContests: RecentContestResult[];
  hotNumbers: LotteryFrequencyItem[];
  coldNumbers: LotteryFrequencyItem[];
  allFrequencies: LotteryFrequencyItem[];
}

const COLD_NUMBERS_SEED: Record<
  LotteryType,
  { number: number; drawnCount: number; frequencyPct: number; delayConcursos: number }[]
> = {
  MEGA_SENA: [
    { number: 26, drawnCount: 242, frequencyPct: 8.6, delayConcursos: 41 },
    { number: 21, drawnCount: 245, frequencyPct: 8.7, delayConcursos: 34 },
    { number: 55, drawnCount: 251, frequencyPct: 8.9, delayConcursos: 29 },
    { number: 15, drawnCount: 254, frequencyPct: 9.0, delayConcursos: 27 },
    { number: 22, drawnCount: 257, frequencyPct: 9.1, delayConcursos: 23 },
    { number: 48, drawnCount: 259, frequencyPct: 9.2, delayConcursos: 21 },
    { number: 31, drawnCount: 261, frequencyPct: 9.3, delayConcursos: 19 },
    { number: 3, drawnCount: 262, frequencyPct: 9.3, delayConcursos: 18 },
    { number: 40, drawnCount: 264, frequencyPct: 9.4, delayConcursos: 16 },
    { number: 9, drawnCount: 265, frequencyPct: 9.4, delayConcursos: 15 },
    { number: 57, drawnCount: 266, frequencyPct: 9.5, delayConcursos: 14 },
    { number: 19, drawnCount: 268, frequencyPct: 9.5, delayConcursos: 12 },
  ],
  LOTOFACIL: [
    { number: 16, drawnCount: 1912, frequencyPct: 56.6, delayConcursos: 6 },
    { number: 8, drawnCount: 1924, frequencyPct: 57.0, delayConcursos: 5 },
    { number: 23, drawnCount: 1938, frequencyPct: 57.4, delayConcursos: 4 },
    { number: 6, drawnCount: 1945, frequencyPct: 57.6, delayConcursos: 4 },
    { number: 17, drawnCount: 1953, frequencyPct: 57.8, delayConcursos: 3 },
    { number: 7, drawnCount: 1961, frequencyPct: 58.1, delayConcursos: 3 },
    { number: 21, drawnCount: 1969, frequencyPct: 58.3, delayConcursos: 3 },
    { number: 5, drawnCount: 1975, frequencyPct: 58.5, delayConcursos: 2 },
    { number: 18, drawnCount: 1982, frequencyPct: 58.7, delayConcursos: 2 },
    { number: 19, drawnCount: 1989, frequencyPct: 58.9, delayConcursos: 2 },
  ],
  QUINA: [
    { number: 3, drawnCount: 356, frequencyPct: 5.6, delayConcursos: 58 },
    { number: 47, drawnCount: 362, frequencyPct: 5.7, delayConcursos: 49 },
    { number: 25, drawnCount: 368, frequencyPct: 5.8, delayConcursos: 44 },
    { number: 68, drawnCount: 371, frequencyPct: 5.8, delayConcursos: 39 },
    { number: 58, drawnCount: 374, frequencyPct: 5.9, delayConcursos: 36 },
    { number: 20, drawnCount: 376, frequencyPct: 5.9, delayConcursos: 33 },
    { number: 65, drawnCount: 379, frequencyPct: 6.0, delayConcursos: 30 },
    { number: 11, drawnCount: 381, frequencyPct: 6.0, delayConcursos: 28 },
    { number: 77, drawnCount: 383, frequencyPct: 6.0, delayConcursos: 25 },
    { number: 32, drawnCount: 385, frequencyPct: 6.1, delayConcursos: 22 },
  ],
  LOTOMANIA: [
    { number: 84, drawnCount: 445, frequencyPct: 17.5, delayConcursos: 15 },
    { number: 13, drawnCount: 448, frequencyPct: 17.6, delayConcursos: 14 },
    { number: 69, drawnCount: 451, frequencyPct: 17.7, delayConcursos: 12 },
    { number: 98, drawnCount: 454, frequencyPct: 17.8, delayConcursos: 11 },
    { number: 2, drawnCount: 456, frequencyPct: 17.9, delayConcursos: 10 },
    { number: 38, drawnCount: 459, frequencyPct: 18.0, delayConcursos: 9 },
  ],
  DUPLA_SENA: [
    { number: 1, drawnCount: 312, frequencyPct: 11.4, delayConcursos: 28 },
    { number: 47, drawnCount: 315, frequencyPct: 11.5, delayConcursos: 24 },
    { number: 22, drawnCount: 318, frequencyPct: 11.6, delayConcursos: 21 },
    { number: 9, drawnCount: 320, frequencyPct: 11.7, delayConcursos: 19 },
    { number: 31, drawnCount: 322, frequencyPct: 11.8, delayConcursos: 16 },
    { number: 40, drawnCount: 325, frequencyPct: 11.9, delayConcursos: 14 },
  ],
  TIMEMANIA: [
    { number: 16, drawnCount: 185, frequencyPct: 8.5, delayConcursos: 32 },
    { number: 54, drawnCount: 188, frequencyPct: 8.6, delayConcursos: 28 },
    { number: 9, drawnCount: 190, frequencyPct: 8.7, delayConcursos: 25 },
    { number: 73, drawnCount: 192, frequencyPct: 8.8, delayConcursos: 22 },
    { number: 38, drawnCount: 195, frequencyPct: 8.9, delayConcursos: 19 },
    { number: 61, drawnCount: 198, frequencyPct: 9.1, delayConcursos: 17 },
  ],
  DIA_DE_SORTE: [
    { number: 31, drawnCount: 142, frequencyPct: 14.1, delayConcursos: 18 },
    { number: 22, drawnCount: 198, frequencyPct: 19.6, delayConcursos: 14 },
    { number: 16, drawnCount: 202, frequencyPct: 20.0, delayConcursos: 12 },
    { number: 13, drawnCount: 205, frequencyPct: 20.3, delayConcursos: 10 },
    { number: 26, drawnCount: 208, frequencyPct: 20.6, delayConcursos: 9 },
    { number: 30, drawnCount: 210, frequencyPct: 20.8, delayConcursos: 8 },
  ],
};

export function getDefaultLotteryStats(lotteryType: LotteryType): LotteryStatsResponse {
  const config = LOTTERY_CONFIGS[lotteryType];
  const hotSeed = config.allTimeMostPlayed;
  const coldSeed = COLD_NUMBERS_SEED[lotteryType];

  const hotMap = new Map(hotSeed.map((h, idx) => [h.number, { ...h, delay: (idx % 4) + 1 }]));
  const coldMap = new Map(coldSeed.map((c) => [c.number, c]));

  const allFrequencies: LotteryFrequencyItem[] = [];
  for (let n = 1; n <= config.totalPoolNumbers; n++) {
    const hotEntry = hotMap.get(n);
    const coldEntry = coldMap.get(n);
    if (hotEntry) {
      allFrequencies.push({
        number: n,
        drawnCount: hotEntry.drawnCount,
        frequencyPct: hotEntry.frequencyPct,
        delayConcursos: hotEntry.delay,
        temperature: 'HOT',
      });
    } else if (coldEntry) {
      allFrequencies.push({
        number: n,
        drawnCount: coldEntry.drawnCount,
        frequencyPct: coldEntry.frequencyPct,
        delayConcursos: coldEntry.delayConcursos,
        temperature: 'COLD',
      });
    } else {
      const avgCount =
        lotteryType === 'LOTOFACIL' ? 2002 : lotteryType === 'QUINA' ? 410 : 280;
      const avgPct =
        lotteryType === 'LOTOFACIL' ? 59.3 : lotteryType === 'QUINA' ? 6.4 : 9.9;
      allFrequencies.push({
        number: n,
        drawnCount: avgCount + ((n * 7) % 15) - 7,
        frequencyPct: avgPct,
        delayConcursos: ((n * 3) % 11) + 3,
        temperature: 'NEUTRAL',
      });
    }
  }

  const sortedByFreqDesc = [...allFrequencies].sort(
    (a, b) => b.drawnCount - a.drawnCount || a.number - b.number
  );
  const sortedByFreqAsc = [...allFrequencies].sort(
    (a, b) => a.drawnCount - b.drawnCount || b.delayConcursos - a.delayConcursos
  );

  const recentDefaults: Record<LotteryType, RecentContestResult[]> = {
    MEGA_SENA: [
      {
        contestNumber: '2949',
        drawDate: '31/10/2026',
        drawnNumbers: [4, 10, 23, 34, 37, 53],
        accumulated: true,
      },
      {
        contestNumber: '2948',
        drawDate: '29/10/2026',
        drawnNumbers: [5, 17, 28, 33, 42, 58],
        accumulated: true,
      },
      {
        contestNumber: '2947',
        drawDate: '27/10/2026',
        drawnNumbers: [8, 14, 23, 30, 38, 49],
        accumulated: false,
      },
    ],
    LOTOFACIL: [
      {
        contestNumber: '3348',
        drawDate: '02/11/2026',
        drawnNumbers: [1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 20, 22, 24, 25],
        accumulated: false,
      },
      {
        contestNumber: '3347',
        drawDate: '31/10/2026',
        drawnNumbers: [1, 3, 5, 6, 8, 10, 11, 13, 15, 17, 19, 20, 21, 24, 25],
        accumulated: false,
      },
      {
        contestNumber: '3346',
        drawDate: '30/10/2026',
        drawnNumbers: [2, 3, 4, 7, 9, 10, 12, 13, 14, 16, 18, 20, 22, 23, 25],
        accumulated: false,
      },
    ],
    QUINA: [
      {
        contestNumber: '6685',
        drawDate: '02/11/2026',
        drawnNumbers: [4, 15, 26, 49, 52],
        accumulated: true,
      },
      {
        contestNumber: '6684',
        drawDate: '31/10/2026',
        drawnNumbers: [5, 31, 39, 44, 71],
        accumulated: true,
      },
      {
        contestNumber: '6683',
        drawDate: '30/10/2026',
        drawnNumbers: [12, 22, 37, 53, 64],
        accumulated: false,
      },
    ],
    LOTOMANIA: [
      {
        contestNumber: '2715',
        drawDate: '01/11/2026',
        drawnNumbers: [3, 8, 12, 17, 24, 29, 31, 36, 41, 43, 47, 49, 54, 62, 67, 73, 81, 88, 92, 99],
        accumulated: true,
      },
      {
        contestNumber: '2714',
        drawDate: '30/10/2026',
        drawnNumbers: [4, 9, 15, 19, 22, 27, 33, 39, 44, 48, 51, 56, 60, 65, 71, 77, 83, 89, 94, 97],
        accumulated: false,
      },
    ],
    DUPLA_SENA: [
      {
        contestNumber: '2760',
        drawDate: '01/11/2026',
        drawnNumbers: [4, 12, 14, 25, 33, 39],
        accumulated: true,
      },
      {
        contestNumber: '2759',
        drawDate: '30/10/2026',
        drawnNumbers: [7, 19, 28, 35, 45, 50],
        accumulated: false,
      },
    ],
    TIMEMANIA: [
      {
        contestNumber: '2185',
        drawDate: '01/11/2026',
        drawnNumbers: [15, 20, 21, 35, 49, 66, 72],
        accumulated: true,
      },
      {
        contestNumber: '2184',
        drawDate: '30/10/2026',
        drawnNumbers: [8, 14, 29, 42, 50, 68, 79],
        accumulated: true,
      },
    ],
    DIA_DE_SORTE: [
      {
        contestNumber: '1012',
        drawDate: '01/11/2026',
        drawnNumbers: [4, 7, 10, 15, 18, 20, 23],
        accumulated: false,
      },
      {
        contestNumber: '1011',
        drawDate: '30/10/2026',
        drawnNumbers: [2, 8, 11, 14, 19, 25, 29],
        accumulated: true,
      },
    ],
  };

  return {
    lotteryType,
    source: 'Base Estatística Oficial dos Sorteios',
    updatedAt: new Date().toISOString(),
    latestContest: recentDefaults[lotteryType][0],
    recentContests: recentDefaults[lotteryType],
    hotNumbers: sortedByFreqDesc.slice(0, 12).map((i) => ({ ...i, temperature: 'HOT' })),
    coldNumbers: sortedByFreqAsc.slice(0, 12).map((i) => ({ ...i, temperature: 'COLD' })),
    allFrequencies,
  };
}

export interface GeneratedPalpiteItem {
  id: string;
  lotteryType: LotteryType;
  numbers: number[];
  fromFavorites: number[];
  fromFixed: number[];
  fromHot: number[];
  fromCold: number[];
  cost: number;
  probabilityOneIn: number;
  createdAt: string;
}

export function generateCustomUserPalpites(params: {
  lotteryType: LotteryType;
  dozensCount: number;
  gamesCount: number;
  useFavorites: boolean;
  favoriteNumbers: number[];
  fixedNumbers: number[];
  excludedNumbers: number[];
  hotPercentage: number; // 0 to 100
  isPureRandom?: boolean;
  stats: LotteryStatsResponse;
}): GeneratedPalpiteItem[] {
  const {
    lotteryType,
    dozensCount,
    gamesCount,
    useFavorites,
    favoriteNumbers,
    fixedNumbers,
    excludedNumbers,
    hotPercentage,
    isPureRandom,
    stats,
  } = params;

  const config = LOTTERY_CONFIGS[lotteryType];
  const validDozens = Math.min(
    config.maxNumbers,
    Math.max(config.minNumbers, dozensCount)
  );
  const priceInfo = config.priceTable[validDozens] || {
    betsEquivalent: 1,
    price: config.baseSimpleBetPrice,
    probabilityOneIn: 50063860,
  };

  const excludedSet = new Set(excludedNumbers);
  const cleanFixed = fixedNumbers.filter(
    (n) => n >= 1 && n <= config.totalPoolNumbers && !excludedSet.has(n)
  );
  const cleanFavorites = useFavorites
    ? favoriteNumbers.filter(
        (n) =>
          n >= 1 &&
          n <= config.totalPoolNumbers &&
          !excludedSet.has(n) &&
          !cleanFixed.includes(n)
      )
    : [];

  // Rank available pool numbers by frequency
  const sortedByFreqDesc = [...stats.allFrequencies]
    .filter((item) => !excludedSet.has(item.number))
    .sort((a, b) => b.drawnCount - a.drawnCount);

  const midIndex = Math.max(1, Math.floor(sortedByFreqDesc.length / 2));
  const hotPool = sortedByFreqDesc.slice(0, midIndex).map((i) => i.number);
  const coldPool = sortedByFreqDesc.slice(midIndex).map((i) => i.number);
  const hotSet = new Set(stats.hotNumbers.map((h) => h.number));
  const coldSet = new Set(stats.coldNumbers.map((c) => c.number));

  const results: GeneratedPalpiteItem[] = [];
  const generatedKeys = new Set<string>();

  const pickRandomFrom = (candidates: number[], currentSet: Set<number>): number | null => {
    const available = candidates.filter((n) => !currentSet.has(n) && !excludedSet.has(n));
    if (available.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
  };

  const allAllowedNumbers = Array.from(
    { length: config.totalPoolNumbers },
    (_, i) => i + 1
  ).filter((n) => !excludedSet.has(n));

  const batchTimestamp = new Date().toISOString();

  for (let g = 0; g < Math.max(1, Math.min(10, gamesCount)); g++) {
    let attempts = 0;
    let finalNumbers: number[] = [];

    while (attempts < 40) {
      const chosen = new Set<number>();

      // 1. Add user's fixed numbers ("dezenas para ajudar o sistema")
      for (const fn of cleanFixed) {
        if (chosen.size < validDozens) {
          chosen.add(fn);
        }
      }

      // 2. Add user's favorite numbers if enabled (shuffled so multi-game generation has variety if user has many favorites)
      if (useFavorites && cleanFavorites.length > 0 && chosen.size < validDozens) {
        const shuffledFavs = [...cleanFavorites].sort(() => Math.random() - 0.5);
        // Leave room for hot/cold mix if generating multiple games, or use up to half of remaining slots
        const maxFavSlots =
          gamesCount > 1
            ? Math.min(shuffledFavs.length, Math.ceil((validDozens - chosen.size) * 0.6))
            : shuffledFavs.length;
        for (let i = 0; i < maxFavSlots && chosen.size < validDozens; i++) {
          chosen.add(shuffledFavs[i]);
        }
      }

      // 3. Fill remaining slots according to Hot vs Cold proportion
      const remainingSlots = validDozens - chosen.size;
      if (remainingSlots > 0) {
        if (isPureRandom) {
          while (chosen.size < validDozens) {
            const picked = pickRandomFrom(allAllowedNumbers, chosen);
            if (picked === null) break;
            chosen.add(picked);
          }
        } else {
          const targetHotCount = Math.round((remainingSlots * hotPercentage) / 100);
          const targetColdCount = remainingSlots - targetHotCount;

          // Prioritize top hot numbers first, then broader hot half
          const topHotNumbers = stats.hotNumbers
            .map((h) => h.number)
            .filter((n) => !excludedSet.has(n));
          const topColdNumbers = stats.coldNumbers
            .map((c) => c.number)
            .filter((n) => !excludedSet.has(n));

          for (let h = 0; h < targetHotCount && chosen.size < validDozens; h++) {
            const pick =
              pickRandomFrom(topHotNumbers, chosen) ?? pickRandomFrom(hotPool, chosen);
            if (pick !== null) chosen.add(pick);
          }

          for (let c = 0; c < targetColdCount && chosen.size < validDozens; c++) {
            const pick =
              pickRandomFrom(topColdNumbers, chosen) ?? pickRandomFrom(coldPool, chosen);
            if (pick !== null) chosen.add(pick);
          }

          // Fallback if pool is constrained by many exclusions
          while (chosen.size < validDozens) {
            const picked = pickRandomFrom(allAllowedNumbers, chosen);
            if (picked === null) break;
            chosen.add(picked);
          }
        }
      }

      finalNumbers = Array.from(chosen).sort((a, b) => a - b);
      const key = finalNumbers.join('-');
      if (!generatedKeys.has(key) || attempts >= 35) {
        generatedKeys.add(key);
        break;
      }
      attempts++;
    }

    const favSet = new Set(cleanFavorites);
    const fixSet = new Set(cleanFixed);

    results.push({
      id: `palp_${Date.now().toString(36)}_${g}_${Math.floor(Math.random() * 1000)}`,
      lotteryType,
      numbers: finalNumbers,
      fromFixed: finalNumbers.filter((n) => fixSet.has(n)),
      fromFavorites: finalNumbers.filter((n) => !fixSet.has(n) && favSet.has(n)),
      fromHot: finalNumbers.filter(
        (n) => !fixSet.has(n) && !favSet.has(n) && hotSet.has(n)
      ),
      fromCold: finalNumbers.filter(
        (n) => !fixSet.has(n) && !favSet.has(n) && coldSet.has(n)
      ),
      cost: priceInfo.price,
      probabilityOneIn: priceInfo.probabilityOneIn,
      createdAt: batchTimestamp,
    });
  }

  return results;
}

export interface PrizeEvaluationResult {
  isAwarded: boolean;
  tierLabel: string | null;
  requiredDrawnCount: number;
}

export function evaluatePrizeTier(
  lotteryType: LotteryType,
  hitsCount: number
): PrizeEvaluationResult {
  switch (lotteryType) {
    case 'MEGA_SENA':
      if (hitsCount >= 6) {
        return { isAwarded: true, tierLabel: 'Sena (6 acertos)', requiredDrawnCount: 6 };
      }
      if (hitsCount === 5) {
        return { isAwarded: true, tierLabel: 'Quina (5 acertos)', requiredDrawnCount: 6 };
      }
      if (hitsCount === 4) {
        return { isAwarded: true, tierLabel: 'Quadra (4 acertos)', requiredDrawnCount: 6 };
      }
      return { isAwarded: false, tierLabel: null, requiredDrawnCount: 6 };

    case 'LOTOFACIL':
      if (hitsCount >= 11) {
        return {
          isAwarded: true,
          tierLabel: `${Math.min(15, hitsCount)} Pontos`,
          requiredDrawnCount: 15,
        };
      }
      return { isAwarded: false, tierLabel: null, requiredDrawnCount: 15 };

    case 'QUINA':
      if (hitsCount >= 5) {
        return { isAwarded: true, tierLabel: 'Quina (5 acertos)', requiredDrawnCount: 5 };
      }
      if (hitsCount === 4) {
        return { isAwarded: true, tierLabel: 'Quadra (4 acertos)', requiredDrawnCount: 5 };
      }
      if (hitsCount === 3) {
        return { isAwarded: true, tierLabel: 'Terno (3 acertos)', requiredDrawnCount: 5 };
      }
      if (hitsCount === 2) {
        return { isAwarded: true, tierLabel: 'Duque (2 acertos)', requiredDrawnCount: 5 };
      }
      return { isAwarded: false, tierLabel: null, requiredDrawnCount: 5 };

    case 'LOTOMANIA':
      if (hitsCount >= 15) {
        return {
          isAwarded: true,
          tierLabel: `${Math.min(20, hitsCount)} acertos`,
          requiredDrawnCount: 20,
        };
      }
      if (hitsCount === 0) {
        return { isAwarded: true, tierLabel: '0 acertos (Faixa Especial)', requiredDrawnCount: 20 };
      }
      return { isAwarded: false, tierLabel: null, requiredDrawnCount: 20 };

    case 'DUPLA_SENA':
      if (hitsCount >= 6) {
        return { isAwarded: true, tierLabel: 'Sena (6 acertos)', requiredDrawnCount: 6 };
      }
      if (hitsCount === 5) {
        return { isAwarded: true, tierLabel: 'Quina (5 acertos)', requiredDrawnCount: 6 };
      }
      if (hitsCount === 4) {
        return { isAwarded: true, tierLabel: 'Quadra (4 acertos)', requiredDrawnCount: 6 };
      }
      if (hitsCount === 3) {
        return { isAwarded: true, tierLabel: 'Terno (3 acertos)', requiredDrawnCount: 6 };
      }
      return { isAwarded: false, tierLabel: null, requiredDrawnCount: 6 };

    case 'TIMEMANIA':
      if (hitsCount >= 3) {
        return {
          isAwarded: true,
          tierLabel: `${Math.min(7, hitsCount)} acertos`,
          requiredDrawnCount: 7,
        };
      }
      return { isAwarded: false, tierLabel: null, requiredDrawnCount: 7 };

    case 'DIA_DE_SORTE':
      if (hitsCount >= 4) {
        return {
          isAwarded: true,
          tierLabel: `${Math.min(7, hitsCount)} acertos`,
          requiredDrawnCount: 7,
        };
      }
      return { isAwarded: false, tierLabel: null, requiredDrawnCount: 7 };
  }
}


