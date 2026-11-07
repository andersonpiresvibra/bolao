import { LotteryGame, LotteryType, PlayerSuggestion } from '../types';

export interface HistoricalContest {
  contestNumber: string;
  date: string;
  label: string;
  lotteryType: LotteryType;
  numbers: number[];
  prizeFormatted: string;
}

export interface PastDrawMatchResult {
  tier: 'SENA_EXATA' | 'QUINA_HISTORICA' | 'QUADRA_HISTORICA';
  hitsCount: number;
  matchedNumbers: number[];
  contest: HistoricalContest;
  funnyHeadline: string;
  funnyDescription: string;
}

export const HISTORICAL_CONTESTS: HistoricalContest[] = [
  // MEGA-SENA & MEGA DA VIRADA
  {
    contestNumber: '2670',
    date: '31/12/2023',
    label: 'Mega da Virada 2023',
    lotteryType: 'MEGA_SENA',
    numbers: [21, 24, 33, 41, 48, 56],
    prizeFormatted: 'R$ 588.891.921,26',
  },
  {
    contestNumber: '2550',
    date: '31/12/2022',
    label: 'Mega da Virada 2022',
    lotteryType: 'MEGA_SENA',
    numbers: [4, 5, 10, 34, 58, 59],
    prizeFormatted: 'R$ 541.969.966,29',
  },
  {
    contestNumber: '2440',
    date: '31/12/2021',
    label: 'Mega da Virada 2021',
    lotteryType: 'MEGA_SENA',
    numbers: [12, 15, 23, 32, 33, 46],
    prizeFormatted: 'R$ 378.124.727,47',
  },
  {
    contestNumber: '2330',
    date: '31/12/2020',
    label: 'Mega da Virada 2020',
    lotteryType: 'MEGA_SENA',
    numbers: [17, 20, 22, 35, 41, 42],
    prizeFormatted: 'R$ 325.250.216,44',
  },
  {
    contestNumber: '2220',
    date: '31/12/2019',
    label: 'Mega da Virada 2019',
    lotteryType: 'MEGA_SENA',
    numbers: [3, 35, 38, 40, 57, 58],
    prizeFormatted: 'R$ 304.213.838,63',
  },
  {
    contestNumber: '2110',
    date: '31/12/2018',
    label: 'Mega da Virada 2018',
    lotteryType: 'MEGA_SENA',
    numbers: [5, 10, 12, 18, 25, 33],
    prizeFormatted: 'R$ 302.536.382,72',
  },
  {
    contestNumber: '1990',
    date: '18/11/2017',
    label: 'Mega-Sena Acumulada',
    lotteryType: 'MEGA_SENA',
    numbers: [4, 10, 17, 23, 37, 53],
    prizeFormatted: 'R$ 76.540.110,00',
  },
  {
    contestNumber: '2485',
    date: '28/05/2022',
    label: 'Mega-Sena Especial',
    lotteryType: 'MEGA_SENA',
    numbers: [5, 10, 23, 33, 38, 53],
    prizeFormatted: 'R$ 92.180.420,15',
  },
  {
    contestNumber: '2740',
    date: '22/06/2024',
    label: 'Mega-Sena Acumulada',
    lotteryType: 'MEGA_SENA',
    numbers: [6, 13, 21, 34, 42, 55],
    prizeFormatted: 'R$ 114.320.000,00',
  },
  // LOTOFÁCIL
  {
    contestNumber: '3190',
    date: '09/09/2024',
    label: 'Lotofácil da Independência',
    lotteryType: 'LOTOFACIL',
    numbers: [1, 2, 3, 4, 10, 11, 12, 13, 14, 15, 20, 22, 23, 24, 25],
    prizeFormatted: 'R$ 202.506.469,10',
  },
  {
    contestNumber: '2900',
    date: '09/09/2023',
    label: 'Lotofácil da Independência 2023',
    lotteryType: 'LOTOFACIL',
    numbers: [1, 3, 4, 5, 6, 7, 10, 11, 14, 18, 19, 20, 23, 24, 25],
    prizeFormatted: 'R$ 192.375.820,00',
  },
  // QUINA
  {
    contestNumber: '6462',
    date: '22/06/2024',
    label: 'Quina de São João 2024',
    lotteryType: 'QUINA',
    numbers: [21, 38, 60, 64, 70],
    prizeFormatted: 'R$ 229.916.465,20',
  },
  {
    contestNumber: '6172',
    date: '24/06/2023',
    label: 'Quina de São João 2023',
    lotteryType: 'QUINA',
    numbers: [4, 15, 26, 39, 71],
    prizeFormatted: 'R$ 216.787.542,80',
  },
];

export function getInitialsFromName(name: string): string {
  const parts = (name || 'Participante')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'US';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Checks if a PUBLISHED game (suggestion or official game) matches a historical contest!
 * Used ONLY after publication so the author doesn't see it beforehand and gets teased by the group.
 */
export function findPastDrawMatch(
  lotteryType: LotteryType,
  numbers: number[],
  authorName: string
): PastDrawMatchResult | null {
  const contests = HISTORICAL_CONTESTS.filter((c) => c.lotteryType === lotteryType);
  const fullTargetHits =
    lotteryType === 'LOTOFACIL' ? 15 : lotteryType === 'QUINA' ? 5 : 6;

  let bestMatch: {
    contest: HistoricalContest;
    matched: number[];
  } | null = null;

  for (const contest of contests) {
    const matched = contest.numbers.filter((n) => numbers.includes(n));
    if (!bestMatch || matched.length > bestMatch.matched.length) {
      bestMatch = { contest, matched };
    }
  }

  if (!bestMatch) return null;

  const hits = bestMatch.matched.length;
  const firstName = (authorName || 'O apostador').split(' ')[0];

  if (hits >= fullTargetHits) {
    return {
      tier: 'SENA_EXATA',
      hitsCount: hits,
      matchedNumbers: bestMatch.matched,
      contest: bestMatch.contest,
      funnyHeadline: `Viajante do Passado! Jogo já saiu no Concurso ${bestMatch.contest.contestNumber}!`,
      funnyDescription: `O jogo de ${firstName} cravou TODAS as dezenas do Concurso ${bestMatch.contest.contestNumber} (${bestMatch.contest.label} em ${bestMatch.contest.date})! Se tivesse jogado lá atrás levava ${bestMatch.contest.prizeFormatted}, mas repetir resultado inteiro nunca aconteceu na história! 😂`,
    };
  }

  if (
    (lotteryType === 'MEGA_SENA' && hits === 5) ||
    (lotteryType === 'LOTOFACIL' && hits === 14) ||
    (lotteryType === 'QUINA' && hits === 4)
  ) {
    return {
      tier: 'QUINA_HISTORICA',
      hitsCount: hits,
      matchedNumbers: bestMatch.matched,
      contest: bestMatch.contest,
      funnyHeadline: `Atrasado! Já bateu ${lotteryType === 'MEGA_SENA' ? 'Quina' : 'Quase Tudo'} no Concurso ${bestMatch.contest.contestNumber}`,
      funnyDescription: `Essas dezenas de ${firstName} já saíram quase todas juntas (${hits} acertos) no Concurso ${bestMatch.contest.contestNumber} (${bestMatch.contest.date})! Será que vai trocar depois que a galera viu? 👀`,
    };
  }

  if (lotteryType === 'MEGA_SENA' && hits === 4) {
    return {
      tier: 'QUADRA_HISTORICA',
      hitsCount: hits,
      matchedNumbers: bestMatch.matched,
      contest: bestMatch.contest,
      funnyHeadline: `Quadra no Passado — Concurso ${bestMatch.contest.contestNumber} (${bestMatch.contest.date})`,
      funnyDescription: `O jogo de ${firstName} já teve 4 dezenas sorteadas juntas no Concurso ${bestMatch.contest.contestNumber} (${bestMatch.contest.label}).`,
    };
  }

  return null;
}

export interface AuthorRankItem {
  authorName: string;
  authorAvatar: string;
  jobTitle: string;
  gamesCount: number;
  approvedCount: number;
  totalLikes: number;
}

export function buildAuthorLeaderboard(
  games: LotteryGame[],
  suggestions: PlayerSuggestion[]
): AuthorRankItem[] {
  const map = new Map<string, AuthorRankItem>();

  for (const sug of suggestions) {
    const key = sug.userName.trim().toLowerCase();
    const existing = map.get(key) || {
      authorName: sug.userName,
      authorAvatar: sug.userAvatar || getInitialsFromName(sug.userName),
      jobTitle: sug.userJobTitle || 'Apostador',
      gamesCount: 0,
      approvedCount: 0,
      totalLikes: 0,
    };
    existing.gamesCount += 1;
    if (sug.approvedAsOfficialGame) existing.approvedCount += 1;
    existing.totalLikes += sug.votes || 0;
    map.set(key, existing);
  }

  for (const g of games) {
    const name = g.authorName || 'Organizador do Bolão';
    const key = name.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        authorName: name,
        authorAvatar: g.authorAvatar || getInitialsFromName(name),
        jobTitle: 'Organizador',
        gamesCount: 1,
        approvedCount: 1,
        totalLikes: 2,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.totalLikes !== a.totalLikes) return b.totalLikes - a.totalLikes;
    return b.approvedCount - a.approvedCount;
  });
}

export interface CopycatPair {
  authorA: string;
  avatarA: string;
  authorB: string;
  avatarB: string;
  sharedNumbers: number[];
}

export function findCopycatPairs(suggestions: PlayerSuggestion[]): CopycatPair[] {
  const pairs: CopycatPair[] = [];
  for (let i = 0; i < suggestions.length; i++) {
    for (let j = i + 1; j < suggestions.length; j++) {
      const a = suggestions[i];
      const b = suggestions[j];
      if (a.userName.toLowerCase() === b.userName.toLowerCase()) continue;
      const shared = a.numbers.filter((n) => b.numbers.includes(n));
      if (shared.length >= 3) {
        pairs.push({
          authorA: a.userName,
          avatarA: a.userAvatar || getInitialsFromName(a.userName),
          authorB: b.userName,
          avatarB: b.userAvatar || getInitialsFromName(b.userName),
          sharedNumbers: shared,
        });
      }
    }
  }
  return pairs.sort((x, y) => y.sharedNumbers.length - x.sharedNumbers.length);
}
