import React, { useState, useMemo, useEffect } from 'react';
import {
  SystemUser,
  Company,
  Pool,
  Participant,
  QuotaPurchase,
  LotteryGame,
  PlayerSuggestion,
  LotteryType,
  UserRole,
  FavoriteGame,
} from '../types';
import {
  LOTTERY_CONFIGS,
  formatCurrencyBRL,
  maskCpf,
  maskName,
  calculateCompanyMostPlayedNumbers,
  getDefaultLotteryStats,
  generateCustomUserPalpites,
  LotteryStatsResponse,
  GeneratedPalpiteItem,
} from '../utils/lotteryMath';
import { apiFetch } from '../utils/cloudflareApi';
import {
  maskCurrencyBRL,
  numberToCurrencyMask,
  parseCurrencyBRL,
  maskCpfInput,
  maskPhoneInput,
  maskSmartIdentifier,
  buildPoolShareUrl,
  shareOrCopyPoolLink,
} from '../utils/inputMasks';
import {
  Users,
  Calendar,
  Ticket,
  Sparkles,
  Heart,
  Star,
  ShieldAlert,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Send,
  FileText,
  ChevronRight,
  Award,
  TrendingUp,
  Lock,
  Wand2,
  ArrowLeft,
  Flame,
  Snowflake,
  RefreshCw,
  Copy,
  Share2,
  BookmarkPlus,
  Check,
  User,
  LogOut,
  ChevronDown,
  Ban,
  Pin,
  ThumbsUp,
  Link2,
} from 'lucide-react';

export type ModalTopic =
  | 'INICIO'
  | 'PERFIL'
  | 'GRUPOS'
  | 'FAVORITOS'
  | 'NOVO'
  | 'PALPITES'
  | 'DEZENAS_FAV'
  | 'JOGOS_FAV'
  | 'INVESTIMENTOS'
  | 'ESTATISTICAS'
  | null;

interface UserAreaTabProps {
  currentUser: SystemUser;
  userRole: UserRole;
  companies: Company[];
  pools: Pool[];
  participants: Participant[];
  purchases: QuotaPurchase[];
  games: LotteryGame[];
  suggestions: PlayerSuggestion[];
  selectedCompanyId: string;
  directOpenCompanyId?: string | null;
  onClearDirectOpenCompany?: () => void;
  onSelectCompany: (companyId: string) => void;
  onUpdateUser: (updatedFields: Partial<SystemUser>) => Promise<void>;
  onCreateSuggestion: (payload: { numbers: number[]; rationale: string }) => Promise<void>;
  onOpenCoupon: (purchase: QuotaPurchase) => void;
  activeModalTopic?: ModalTopic;
  onChangeModalTopic?: (topic: ModalTopic) => void;
  onLogout?: () => void;
  onNotify?: (msg: string) => void;
}

interface HistoricalPoolSummary {
  id: string;
  companyId?: string;
  poolId?: string;
  year: '2026' | '2025' | '2024';
  title: string;
  companyName: string;
  segment: string;
  managerName: string;
  lotteryType: LotteryType;
  contestNumber: string;
  statusLabel: string;
  myQuotas: number;
  myInvested: number;
  poolTotalRaised: number;
  maxTargetAmount: number;
  participantsCount: number;
  prizeReceived: number;
  dateLabel: string;
}

export const UserAreaTab: React.FC<UserAreaTabProps> = ({
  currentUser,
  userRole,
  companies,
  pools,
  participants,
  purchases,
  games,
  suggestions,
  selectedCompanyId,
  directOpenCompanyId,
  onClearDirectOpenCompany,
  onSelectCompany,
  onUpdateUser,
  onCreateSuggestion,
  onOpenCoupon,
  activeModalTopic,
  onChangeModalTopic,
  onLogout,
  onNotify,
}) => {
  const [internalSection, setInternalSection] = useState<ModalTopic>(null);
  const activeSection = activeModalTopic !== undefined ? activeModalTopic : internalSection;
  const setActiveSection = (topic: ModalTopic) => {
    if (onChangeModalTopic) {
      onChangeModalTopic(topic);
    } else {
      setInternalSection(topic);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Avatar Menu inside Top Summary Card
  const [cardAvatarMenuOpen, setCardAvatarMenuOpen] = useState(false);

  // 1. State for Profile Editor Section (4-step fields)
  const [profileStep, setProfileStep] = useState<1 | 2 | 3 | 4>(1);
  const [editName, setEditName] = useState(currentUser.name);
  const [editUsername, setEditUsername] = useState(
    currentUser.username || `${currentUser.name.split(' ')[0].toLowerCase()}@`
  );
  const [editWhatsapp, setEditWhatsapp] = useState(currentUser.whatsapp);
  const [editEmail, setEditEmail] = useState(currentUser.email);
  const [editCompanyName, setEditCompanyName] = useState(currentUser.companyName);
  const [editJobTitle, setEditJobTitle] = useState(currentUser.jobTitle);
  const [editCpf, setEditCpf] = useState(currentUser.cpf);
  const [editPixKey, setEditPixKey] = useState(currentUser.pixKey);
  const [savingProfile, setSavingProfile] = useState(false);

  // 2. State for Annual Filter (2026, 2025, 2024)
  const [selectedYear, setSelectedYear] = useState<'2026' | '2025' | '2024'>('2026');

  // 3. State for Favorite Numbers Section
  const [favLotteryType, setFavLotteryType] = useState<LotteryType>('MEGA_SENA');
  const [tempFavNumbers, setTempFavNumbers] = useState<number[]>(
    currentUser.favoriteNumbers?.['MEGA_SENA'] || [4, 10, 17, 23, 37, 53]
  );

  // 4. State for Favorite Games Section
  const [newGameLabel, setNewGameLabel] = useState('');
  const [newGameLottery, setNewGameLottery] = useState<LotteryType>('MEGA_SENA');
  const [newGameNumbers, setNewGameNumbers] = useState<number[]>([4, 10, 17, 23, 38, 53]);

  // 5. State for Responsible Gaming (Meus Investimentos)
  const monthlyLimit = currentUser.monthlySpendingLimit ?? 300;
  const [limitInput, setLimitInput] = useState<string>(
    numberToCurrencyMask(monthlyLimit)
  );

  // 6. State for Pool Statistics Section
  const activeCompaniesPools = useMemo(() => {
    const validCompIds = new Set(companies.map((c) => c.id));
    return pools.filter((p) => validCompIds.has(p.companyId));
  }, [companies, pools]);

  const [statsPoolId, setStatsPoolId] = useState<string>(
    activeCompaniesPools.find((p) => p.companyId === selectedCompanyId)?.id ||
      activeCompaniesPools[0]?.id ||
      pools[0]?.id ||
      ''
  );
  const [statsActiveTab, setStatsActiveTab] = useState<
    'TERMOMETRO' | 'SORTEIOS' | 'CHANCES'
  >('TERMOMETRO');
  const [recentContestTabIdx, setRecentContestTabIdx] = useState<number>(0);
  const [groupTabByPoolId, setGroupTabByPoolId] = useState<
    Record<string, 'RESUMO' | 'JOGOS' | 'DEZENAS' | 'COTAS'>
  >({});
  const [selectedGroupItemId, setSelectedGroupItemId] = useState<string | null>(null);
  const [likedPoolGameIds, setLikedPoolGameIds] = useState<Record<string, boolean>>({});
  const [poolGameLikesCount, setPoolGameLikesCount] = useState<Record<string, number>>({});
  const [favGameTabIdx, setFavGameTabIdx] = useState<number>(0);
  const [palpitesActiveTab, setPalpitesActiveTab] = useState<
    'GERADOR' | 'COMPARTILHADOS' | 'COMBINACOES'
  >('GERADOR');
  const [expandedGenBoxes, setExpandedGenBoxes] = useState<Record<string, boolean>>({
    quentesFrias: false,
    ultimos3: false,
    favoritas: false,
    fixasExcluidas: false,
    mistura: false,
    quantidade: false,
  });
  const toggleGeneratorBox = (key: string) => {
    setExpandedGenBoxes((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const [approvedComboVotes, setApprovedComboVotes] = useState<Record<string, number>>({});
  const [userApprovedComboIds, setUserApprovedComboIds] = useState<Record<string, boolean>>({});

  // =========================================================================
  // 7. STATE FOR GERADOR INTELIGENTE DE PALPITES (FULL-SCREEN SECTION)
  // =========================================================================
  const [genLotteryType, setGenLotteryType] = useState<LotteryType>('MEGA_SENA');
  const [genDozensCount, setGenDozensCount] = useState<number>(6);
  const [genGamesCount, setGenGamesCount] = useState<number>(3);
  const [genUseFavorites, setGenUseFavorites] = useState<boolean>(true);
  const [genFixedNumbers, setGenFixedNumbers] = useState<number[]>([]);
  const [genExcludedNumbers, setGenExcludedNumbers] = useState<number[]>([]);
  const [genBoardMode, setGenBoardMode] = useState<'FIX' | 'EXCLUDE'>('FIX');
  const [genMixPreset, setGenMixPreset] = useState<
    'BALANCED' | 'HOT_FOCUS' | 'COLD_FOCUS' | 'PURE_RANDOM' | 'CUSTOM'
  >('BALANCED');
  const [genHotPercentage, setGenHotPercentage] = useState<number>(50);
  const [lotteryStats, setLotteryStats] = useState<LotteryStatsResponse>(() =>
    getDefaultLotteryStats('MEGA_SENA')
  );
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [generatedPalpites, setGeneratedPalpites] = useState<GeneratedPalpiteItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sentPalpiteIds, setSentPalpiteIds] = useState<Record<string, boolean>>({});
  const [savedPalpiteIds, setSavedPalpiteIds] = useState<Record<string, boolean>>({});

  const fetchLotteryStatsFromApi = async (lt: LotteryType) => {
    setLoadingStats(true);
    try {
      const resp = await apiFetch(`/api/lottery-stats/${lt}`);
      if (resp.ok) {
        const data = (await resp.json()) as LotteryStatsResponse;
        setLotteryStats(data);
      } else {
        setLotteryStats(getDefaultLotteryStats(lt));
      }
    } catch {
      setLotteryStats(getDefaultLotteryStats(lt));
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    const cfg = LOTTERY_CONFIGS[genLotteryType];
    setGenDozensCount(cfg.minNumbers);
    setGenFixedNumbers([]);
    setGenExcludedNumbers([]);
    setRecentContestTabIdx(0);
    const nextStats = getDefaultLotteryStats(genLotteryType);
    setLotteryStats(nextStats);
    fetchLotteryStatsFromApi(genLotteryType);
  }, [genLotteryType]);

  // Saved Favorite Numbers for the currently selected generator lottery
  const currentGenFavNumbers = useMemo(() => {
    const saved = currentUser.favoriteNumbers?.[genLotteryType];
    if (saved && saved.length > 0) return saved;
    if (genLotteryType === favLotteryType && tempFavNumbers.length > 0) return tempFavNumbers;
    return LOTTERY_CONFIGS[genLotteryType].allTimeMostPlayed
      .slice(0, 4)
      .map((x) => x.number);
  }, [currentUser.favoriteNumbers, genLotteryType, favLotteryType, tempFavNumbers]);

  const handleToggleGeneratorBoardNumber = (num: number) => {
    const cfg = LOTTERY_CONFIGS[genLotteryType];
    if (genBoardMode === 'FIX') {
      // Remove from excluded if present
      if (genExcludedNumbers.includes(num)) {
        setGenExcludedNumbers((prev) => prev.filter((n) => n !== num));
      }
      setGenFixedNumbers((prev) => {
        if (prev.includes(num)) return prev.filter((n) => n !== num);
        if (prev.length >= genDozensCount - 1) {
          onNotify?.(
            `Você pode fixar até ${genDozensCount - 1} dezenas para um jogo de ${genDozensCount} dezenas.`
          );
          return prev;
        }
        return [...prev, num].sort((a, b) => a - b);
      });
    } else {
      // EXCLUDE mode: remove from fixed if present
      if (genFixedNumbers.includes(num)) {
        setGenFixedNumbers((prev) => prev.filter((n) => n !== num));
      }
      const maxExcludable = cfg.totalPoolNumbers - genDozensCount - 2;
      setGenExcludedNumbers((prev) => {
        if (prev.includes(num)) return prev.filter((n) => n !== num);
        if (prev.length >= maxExcludable) {
          onNotify?.('Limite máximo de dezenas excluídas atingido para manter números suficientes.');
          return prev;
        }
        return [...prev, num].sort((a, b) => a - b);
      });
    }
  };

  const handleExecuteGenerator = () => {
    const items = generateCustomUserPalpites({
      lotteryType: genLotteryType,
      dozensCount: genDozensCount,
      gamesCount: genGamesCount,
      useFavorites: genUseFavorites,
      favoriteNumbers: currentGenFavNumbers,
      fixedNumbers: genFixedNumbers,
      excludedNumbers: genExcludedNumbers,
      hotPercentage: genHotPercentage,
      isPureRandom: genMixPreset === 'PURE_RANDOM',
      stats: lotteryStats,
    });
    setGeneratedPalpites((prev) => [...items, ...prev]);
    onNotify?.(
      `${items.length} novo(s) jogo(s) gerado(s) no topo da lista para a ${LOTTERY_CONFIGS[genLotteryType].name}!`
    );
  };

  const handleSendGeneratedToPool = async (item: GeneratedPalpiteItem) => {
    const mixLabel =
      genMixPreset === 'PURE_RANDOM'
        ? 'Aleatório Livre'
        : `${genHotPercentage}% Quentes / ${100 - genHotPercentage}% Frias`;
    await onCreateSuggestion({
      numbers: item.numbers,
      rationale: `Gerador Inteligente (${mixLabel}${
        item.fromFavorites.length > 0 ? ` · ${item.fromFavorites.length} Favorita(s)` : ''
      }${item.fromFixed.length > 0 ? ` · ${item.fromFixed.length} Fixa(s)` : ''})`,
    });
    setSentPalpiteIds((prev) => ({ ...prev, [item.id]: true }));
  };

  const handleSendAllGeneratedToPool = async () => {
    for (const item of generatedPalpites) {
      if (!sentPalpiteIds[item.id]) {
        await handleSendGeneratedToPool(item);
      }
    }
    onNotify?.(
      `Todos os ${generatedPalpites.length} palpites foram enviados para o bolão ativo!`
    );
  };

  const handleSaveGeneratedToFavorites = async (item: GeneratedPalpiteItem, idx: number) => {
    const newEntry: FavoriteGame = {
      id: `fav_gen_${Date.now().toString(36)}_${idx}`,
      label: `Palpite Gerador #${idx + 1} (${genHotPercentage}% Quentes)`,
      lotteryType: item.lotteryType,
      numbers: item.numbers,
      createdAt: new Date().toISOString(),
    };
    const updatedList = [newEntry, ...userFavoriteGames];
    await onUpdateUser({ favoriteGames: updatedList });
    setSavedPalpiteIds((prev) => ({ ...prev, [item.id]: true }));
    onNotify?.('Combinação salva em Meus Jogos Favoritos!');
  };

  const handleCopyOrSharePalpite = async (item: GeneratedPalpiteItem, idx?: number) => {
    const formattedNums = item.numbers.map((n) => String(n).padStart(2, '0')).join(' - ');
    const text = `BV-Mega da Virada · Palpite ${LOTTERY_CONFIGS[item.lotteryType].name}${
      idx !== undefined ? ` #${idx + 1}` : ''
    }: [ ${formattedNums} ]`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2500);
      onNotify?.('Dezenas copiadas para a área de transferência!');
    } catch {
      onNotify?.(text);
    }
  };

  const handleCopyAllPalpites = async () => {
    const lines = generatedPalpites.map(
      (item, i) =>
        `Jogo ${String(i + 1).padStart(2, '0')} (${LOTTERY_CONFIGS[item.lotteryType].name}): ${item.numbers
          .map((n) => String(n).padStart(2, '0'))
          .join(' - ')}`
    );
    const fullText = `Palpites Gerados — BV-Mega da Virada\n${lines.join('\n')}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
      }
      setCopiedId('ALL');
      setTimeout(() => setCopiedId(null), 2500);
      onNotify?.(`Todos os ${generatedPalpites.length} jogos copiados com sucesso!`);
    } catch {
      onNotify?.('Copiado!');
    }
  };

  // Identify user's purchases & suggestions
  const cleanUserCpf = currentUser.cpf.replace(/\D/g, '');
  const myPurchases = useMemo(() => {
    return purchases.filter(
      (p) =>
        p.participantCpf.replace(/\D/g, '') === cleanUserCpf ||
        p.participantEmail.toLowerCase() === currentUser.email.toLowerCase() ||
        p.participantName.toLowerCase() === currentUser.name.toLowerCase()
    );
  }, [purchases, cleanUserCpf, currentUser]);

  const mySuggestions = useMemo(() => {
    return suggestions.filter(
      (s) =>
        s.userId === currentUser.id ||
        s.userName.toLowerCase() === currentUser.name.toLowerCase()
    );
  }, [suggestions, currentUser]);

  // Calculate current month investment
  const currentMonthInvested = useMemo(() => {
    const directSum = myPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
    return directSum > 0 ? directSum : 240.0;
  }, [myPurchases]);

  const limitUsagePct = Math.min(
    100,
    Math.round((currentMonthInvested / Math.max(1, monthlyLimit)) * 100)
  );
  const isNearLimit = currentMonthInvested >= monthlyLimit * 0.8;
  const isOverLimit = currentMonthInvested >= monthlyLimit;

  const [removedGroupIds, setRemovedGroupIds] = useState<string[]>([
    'pool_c',
    'hist_2025_2',
    'hist_2024_2',
  ]);

  // Multi-year groups/pools history (2026 live + 2025/2024 historical corporate records)
  const allYearPools: HistoricalPoolSummary[] = useMemo(() => {
    const poolsToInclude =
      activeCompaniesPools.length > 0 ? activeCompaniesPools : pools.slice(0, 1);

    const live2026: HistoricalPoolSummary[] = poolsToInclude.map((pool) => {
      const comp = companies.find((c) => c.id === pool.companyId);
      const poolPurchases = purchases.filter(
        (pur) => pur.poolId === pool.id && pur.paymentStatus === 'CONFIRMED'
      );
      const totalRaised = poolPurchases.reduce((acc, pur) => acc + pur.totalAmount, 0);
      const userPur = myPurchases.filter((pur) => pur.poolId === pool.id);
      const userQuotas = userPur.reduce((acc, pur) => acc + pur.quotasCount, 0) || 2;
      const userSpent =
        userPur.reduce((acc, pur) => acc + pur.totalAmount, 0) || pool.quotaValue * 2;
      const compParts = participants.filter((part) => part.companyId === pool.companyId);
      const isTargetReached =
        pool.maxTargetAmount > 0 && totalRaised >= pool.maxTargetAmount;

      return {
        id: pool.id,
        companyId: comp?.id,
        poolId: pool.id,
        year: '2026',
        title: pool.title,
        companyName: comp?.name || 'Vibra Energia',
        segment: comp?.segment || 'Colaboradores da Vibra',
        managerName: comp?.managerName || 'Alex Torres',
        lotteryType: pool.lotteryType,
        contestNumber: pool.contestNumber || '2950',
        statusLabel:
          pool.status === 'CLOSED' || isTargetReached
            ? 'Encerrado'
            : pool.status === 'OPEN'
            ? 'Aberto — Em Captação'
            : 'Sorteio Realizado',
        myQuotas: userQuotas,
        myInvested: userSpent,
        poolTotalRaised: totalRaised,
        maxTargetAmount: pool.maxTargetAmount,
        participantsCount: compParts.length || 10,
        prizeReceived: 0,
        dateLabel: '31/12/26',
      };
    });

    const history2025: HistoricalPoolSummary[] = [
      {
        id: 'hist_2025_1',
        companyId: companies[0]?.id,
        poolId: pools[0]?.id,
        year: '2025',
        title: 'Bolão dos Colaboradores da Vibra — 2025',
        companyName: companies[0]?.name || 'Vibra Energia',
        segment: companies[0]?.segment || 'Colaboradores da Vibra',
        managerName: companies[0]?.managerName || 'Alex Torres',
        lotteryType: 'MEGA_SENA',
        contestNumber: '2810',
        statusLabel: 'Concluído — Quadra Premiada',
        myQuotas: 3,
        myInvested: 300.0,
        poolTotalRaised: 7500.0,
        maxTargetAmount: 7500.0,
        participantsCount: 10,
        prizeReceived: 412.5,
        dateLabel: '31/12/25',
      },
    ];

    const history2024: HistoricalPoolSummary[] = [
      {
        id: 'hist_2024_1',
        companyId: companies[0]?.id,
        poolId: pools[0]?.id,
        year: '2024',
        title: 'Bolão dos Colaboradores da Vibra — 2024',
        companyName: companies[0]?.name || 'Vibra Energia',
        segment: companies[0]?.segment || 'Colaboradores da Vibra',
        managerName: companies[0]?.managerName || 'Alex Torres',
        lotteryType: 'MEGA_SENA',
        contestNumber: '2670',
        statusLabel: 'Concluído — Encerrado',
        myQuotas: 2,
        myInvested: 200.0,
        poolTotalRaised: 6000.0,
        maxTargetAmount: 6000.0,
        participantsCount: 10,
        prizeReceived: 0,
        dateLabel: '31/12/24',
      },
    ];

    return [...live2026, ...history2025, ...history2024].filter(
      (item) => !removedGroupIds.includes(item.id)
    );
  }, [
    activeCompaniesPools,
    companies,
    pools,
    participants,
    purchases,
    myPurchases,
    currentUser.companyName,
    removedGroupIds,
  ]);

  const filteredYearPools = useMemo(
    () => allYearPools.filter((p) => p.year === selectedYear),
    [allYearPools, selectedYear]
  );

  // Favorite Games list with defaults
  const userFavoriteGames: FavoriteGame[] = useMemo(() => {
    if (currentUser.favoriteGames && currentUser.favoriteGames.length > 0) {
      return currentUser.favoriteGames;
    }
    return [
      {
        id: 'fav_default_1',
        label: 'Jogo Campeão — Históricas Mega-Sena',
        lotteryType: 'MEGA_SENA',
        numbers: [4, 10, 17, 23, 37, 53],
        createdAt: '2026-10-15T10:00:00Z',
      },
      {
        id: 'fav_default_2',
        label: 'Fechamento Lotofácil 15 Dezenas',
        lotteryType: 'LOTOFACIL',
        numbers: [1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 20, 22, 24, 25],
        createdAt: '2026-10-18T14:30:00Z',
      },
    ];
  }, [currentUser.favoriteGames]);

  // Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onUpdateUser({
        name: editName,
        username: editUsername,
        whatsapp: editWhatsapp,
        email: editEmail,
        companyName: editCompanyName,
        jobTitle: editJobTitle,
        cpf: editCpf,
        pixKey: editPixKey,
      });
      setActiveSection(null);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleFavNumber = (num: number) => {
    setTempFavNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b)
    );
  };

  const handleSaveFavNumbers = async () => {
    const nextMap = {
      ...(currentUser.favoriteNumbers || {}),
      [favLotteryType]: tempFavNumbers,
    };
    await onUpdateUser({ favoriteNumbers: nextMap });
  };

  const handleToggleNewGameNumber = (num: number) => {
    const maxAllowed = LOTTERY_CONFIGS[newGameLottery].maxNumbers;
    setNewGameNumbers((prev) => {
      if (prev.includes(num)) return prev.filter((n) => n !== num);
      if (prev.length >= maxAllowed) return prev;
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  const handleSaveFavoriteGame = async () => {
    const minRequired = LOTTERY_CONFIGS[newGameLottery].minNumbers;
    if (newGameNumbers.length < minRequired) return;
    const newEntry: FavoriteGame = {
      id: `fav_${Date.now().toString(36)}`,
      label:
        newGameLabel.trim() ||
        `Meu Jogo ${LOTTERY_CONFIGS[newGameLottery].name} (${newGameNumbers.length} dez.)`,
      lotteryType: newGameLottery,
      numbers: newGameNumbers,
      createdAt: new Date().toISOString(),
    };
    const updatedList = [newEntry, ...userFavoriteGames];
    await onUpdateUser({ favoriteGames: updatedList });
    setNewGameLabel('');
  };

  const handleDeleteFavoriteGame = async (id: string) => {
    const updatedList = userFavoriteGames.filter((g) => g.id !== id);
    await onUpdateUser({ favoriteGames: updatedList });
  };

  useEffect(() => {
    if (!directOpenCompanyId) return;
    setSelectedYear('2026');
    const targetPool = allYearPools.find((p) => p.companyId === directOpenCompanyId);
    if (targetPool) {
      setSelectedGroupItemId(targetPool.id);
      onClearDirectOpenCompany?.();
    }
  }, [directOpenCompanyId, allYearPools, onClearDirectOpenCompany]);

  const handleSaveMonthlyLimit = async () => {
    const parsed = Math.max(50, parseCurrencyBRL(limitInput) || 300);
    setLimitInput(numberToCurrencyMask(parsed));
    await onUpdateUser({ monthlySpendingLimit: parsed });
  };

  // Pool Statistics Calculations
  const currentStatsPool =
    activeCompaniesPools.find((p) => p.id === statsPoolId) ||
    activeCompaniesPools[0] ||
    pools[0];
  const currentStatsCompany = companies.find((c) => c.id === currentStatsPool?.companyId);
  const currentPoolPurchases = purchases.filter((p) => p.poolId === currentStatsPool?.id);
  const currentPoolConfirmedAmount = currentPoolPurchases
    .filter((p) => p.paymentStatus === 'CONFIRMED')
    .reduce((acc, p) => acc + p.totalAmount, 0);
  const currentPoolQuotasSold = currentPoolPurchases.reduce(
    (acc, p) => acc + p.quotasCount,
    0
  );
  const currentPoolGames = games.filter((g) => g.poolId === currentStatsPool?.id);
  const currentPoolSuggestions = suggestions.filter(
    (s) => s.poolId === currentStatsPool?.id
  );

  const poolStatsMath = useMemo(() => {
    if (!currentStatsPool) {
      return {
        totalSimpleBets: 1,
        baseSingleOdd: 50063860,
        poolCombinedOdd: 50063860,
        multiplier: 1,
      };
    }
    const config = LOTTERY_CONFIGS[currentStatsPool.lotteryType];
    const baseSingleOdd =
      config.priceTable[config.minNumbers]?.probabilityOneIn || 50063860;
    const totalSimpleBets = Math.max(
      1,
      currentPoolGames.reduce((acc, g) => acc + (g.equivalentSimpleBets || 1), 0)
    );
    const poolCombinedOdd = Math.max(1, Math.round(baseSingleOdd / totalSimpleBets));
    return {
      totalSimpleBets,
      baseSingleOdd,
      poolCombinedOdd,
      multiplier: totalSimpleBets,
    };
  }, [currentStatsPool, currentPoolGames]);

  const poolMostBetNumbers = useMemo(() => {
    return calculateCompanyMostPlayedNumbers(
      currentPoolGames,
      currentPoolSuggestions,
      10
    );
  }, [currentPoolGames, currentPoolSuggestions]);

  const allTimeMostDrawn = useMemo(() => {
    if (!currentStatsPool) return [];
    return LOTTERY_CONFIGS[currentStatsPool.lotteryType].allTimeMostPlayed.slice(0, 10);
  }, [currentStatsPool]);

  // Grid Cards Definition (Gerador de Palpites unified inside Meus Palpites)
  const serviceGridItems: {
    id: ModalTopic;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badgeAlert?: boolean;
    highlight?: boolean;
  }[] = [
    {
      id: 'GRUPOS',
      title: 'Meus Grupos',
      subtitle: 'Grupos e Minhas Cotas',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'PALPITES',
      title: 'Meus Palpites',
      subtitle: 'Palpites & Gerador',
      icon: <Sparkles className="w-5 h-5" />,
      highlight: true,
    },
    {
      id: 'FAVORITOS',
      title: 'Favoritos',
      subtitle: 'Jogos & Dezenas',
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: 'NOVO',
      title: 'Novo',
      subtitle: 'Bolões Recém-Criados',
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: 'INVESTIMENTOS',
      title: 'Investimentos',
      subtitle: isNearLimit ? 'Alerta 80% Teto' : 'Jogo Responsável',
      icon: <ShieldAlert className="w-5 h-5" />,
      badgeAlert: isNearLimit,
    },
    {
      id: 'ESTATISTICAS',
      title: 'Estatísticas',
      subtitle: 'Sorteios, Dezenas & Grupo',
      icon: <BarChart2 className="w-5 h-5" />,
    },
  ];

  // =========================================================================
  // FULL-SCREEN SECTION VIEW (NO MODALS! OPENS AS FULL SCREEN SECTION)
  // =========================================================================
  if (activeSection !== null) {
    const sectionTitles: Record<Exclude<ModalTopic, null>, { title: string; subtitle: string }> = {
      INICIO: {
        title: 'Início',
        subtitle: '',
      },
      PERFIL: {
        title: 'Meu Perfil Cadastral',
        subtitle: 'Dados pessoais, empresa, CPF e Chave Pix para prêmios',
      },
      GRUPOS: {
        title: 'Meus Grupos e Minhas Cotas',
        subtitle: 'Grupos participantes, minhas cotas e comprovantes Split Pix por ano (2024–2026)',
      },
      FAVORITOS: {
        title: 'Meus Favoritos',
        subtitle: 'Acesse suas combinações de Jogos Favoritos e suas Dezenas Favoritas',
      },
      NOVO: {
        title: 'Novidades: Bolões Recém-Criados',
        subtitle: 'Confira os novos bolões recém-lançados abertos para adesão imediata',
      },
      PALPITES: {
        title: 'Meus Palpites e Gerador Inteligente',
        subtitle: 'Seus palpites sugeridos nos bolões e gerador com dezenas Quentes, Frias, Favoritas, Fixas e Excluídas',
      },
      DEZENAS_FAV: {
        title: 'Minhas Dezenas Favoritas',
        subtitle: 'Seus números da sorte salvos por loteria',
      },
      JOGOS_FAV: {
        title: 'Meus Jogos Favoritos',
        subtitle: 'Suas combinações prontas para aplicar nos bolões',
      },
      INVESTIMENTOS: {
        title: 'Meus Investimentos e Jogo Responsável',
        subtitle: 'Controle de teto mensal e extrato anual por bolão',
      },
      ESTATISTICAS: {
        title: 'Estatísticas Completas',
        subtitle: 'Sorteios recentes, dezenas quentes e frias, ranking histórico, probabilidades e participantes',
      },
    };

    const currentHeader = sectionTitles[activeSection];

    return (
      <div className="min-h-full bg-[#F7F9FC] pb-8">
        {/* Full-Screen Section Navigation Bar */}
        <div className="bg-white border-b border-[#DCE5F0] sticky top-0 z-20">
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className="h-9 px-3 rounded-[4px] bg-[#EBF4FC] hover:bg-[#D5E8FA] text-[#005CA9] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            <h2 className="text-sm font-extrabold text-[#1E293B] leading-snug text-right">
              {currentHeader.title}
            </h2>
          </div>

          {activeSection === 'PALPITES' && (
            <div className="w-full grid grid-cols-3 divide-x divide-white border-t border-[#DCE5F0]">
              {(['MEGA_SENA', 'LOTOFACIL', 'QUINA'] as LotteryType[]).map((lt) => (
                <button
                  key={lt}
                  type="button"
                  onClick={() => setGenLotteryType(lt)}
                  className={`h-9 w-full text-xs font-bold transition-colors cursor-pointer ${
                    genLotteryType === lt
                      ? 'bg-[#005CA9] text-white'
                      : 'bg-[#D5DEE8] text-[#1E293B] hover:bg-[#C5D1DF]'
                  }`}
                >
                  {LOTTERY_CONFIGS[lt].name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Full-Screen Section Body */}
        <div className="px-4 py-4 space-y-4">
          {/* =============================================================== */}
          {/* SEÇÃO EM BRANCO: INÍCIO                                         */}
          {/* =============================================================== */}
          {activeSection === 'INICIO' && <section className="min-h-[320px]" />}

          {/* =============================================================== */}
          {/* SEÇÃO MEUS PALPITES E GERADOR INTELIGENTE                       */}
          {/* =============================================================== */}
          {activeSection === 'PALPITES' && (
            <div className="space-y-4">
              {/* FERRAMENTAS DO GERADOR DE PALPITES */}
              <div className="space-y-4">
                {/* 1º Colocação (Sem Expansão): Últimos 3 Resultados */}
                <div className="caixa-card p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-[#1E293B]">
                        Últimos 3 Resultados ({LOTTERY_CONFIGS[genLotteryType].name})
                      </h4>
                      <span className="text-[10px] text-[#5F6C7B]">
                        Comparação direta · Toque nas dezenas para fixar ou excluir
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const recentList = (
                      lotteryStats.recentContests || [lotteryStats.latestContest]
                    ).slice(0, 3);

                    return (
                      <div className="p-3 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0] divide-y divide-[#E2E8F0] space-y-2.5">
                        {recentList.map((contest, idx) => (
                          <div
                            key={contest.contestNumber}
                            className={idx > 0 ? 'pt-2.5 space-y-2' : 'space-y-2'}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-[#1E293B] font-mono-tabular">
                                  {idx === 0 ? 'Último Sorteio' : `${idx + 1}º Anterior`} ·
                                  Conc. {contest.contestNumber}
                                </span>
                                <span className="text-[10px] text-[#5F6C7B] font-mono-tabular">
                                  ({contest.drawDate})
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const cfg = LOTTERY_CONFIGS[genLotteryType];
                                  const maxExcludable =
                                    cfg.totalPoolNumbers - genDozensCount - 2;
                                  setGenExcludedNumbers((prev) => {
                                    const combined = Array.from(
                                      new Set([...prev, ...contest.drawnNumbers])
                                    ).slice(0, maxExcludable);
                                    return combined.sort((a, b) => a - b);
                                  });
                                  setGenFixedNumbers((prev) =>
                                    prev.filter((n) => !contest.drawnNumbers.includes(n))
                                  );
                                  onNotify?.(
                                    `Dezenas do Concurso ${contest.contestNumber} marcadas para exclusão no gerador.`
                                  );
                                }}
                                className="px-2 py-0.5 rounded-[3px] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold cursor-pointer"
                                title="Excluir todas as dezenas deste concurso"
                              >
                                Excluir sorteio
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {contest.drawnNumbers.map((num) => {
                                const isFixed = genFixedNumbers.includes(num);
                                const isExcluded = genExcludedNumbers.includes(num);
                                const isHot = lotteryStats.hotNumbers.some(
                                  (h) => h.number === num
                                );

                                let pillStyle =
                                  'bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6]';
                                if (isFixed) {
                                  pillStyle =
                                    'bg-[#008B47] text-white border border-[#006835]';
                                } else if (isExcluded) {
                                  pillStyle =
                                    'bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5] line-through';
                                } else if (isHot) {
                                  pillStyle =
                                    'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]';
                                }

                                return (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleToggleGeneratorBoardNumber(num)}
                                    className={`w-6 h-6 rounded-full font-mono-tabular font-bold text-[11px] flex items-center justify-center transition-colors cursor-pointer ${pillStyle}`}
                                    title="Toque para fixar ou excluir esta dezena"
                                  >
                                    {String(num).padStart(2, '0')}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Dezenas Mais Quentes e Mais Frias */}
                <section className="caixa-card p-4 space-y-3">
                  {/* Cabeçalho Recluído com Botão de Expansão para Quentes e Frias */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>Dezenas Mais Quentes e Mais Frias</span>
                      </h4>
                      <p className="text-[10px] text-[#5F6C7B]">
                        Ranking estatístico da {LOTTERY_CONFIGS[genLotteryType].name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleGeneratorBox('quentesFrias')}
                      className="px-2.5 h-7 rounded-[4px] bg-[#EBF4FC] hover:bg-[#DBEAFE] text-[#005CA9] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <span>{expandedGenBoxes.quentesFrias ? 'Recolher' : 'Expandir'}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          expandedGenBoxes.quentesFrias ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Hot vs Cold Top Ranking (Expandable) */}
                  {expandedGenBoxes.quentesFrias && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#EDF2F7]">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#D97706] mb-1.5">
                          <Flame className="w-3.5 h-3.5 text-[#D97706]" />
                          <span>Mais Quentes (Saíram +)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {lotteryStats.hotNumbers.slice(0, 8).map((item) => (
                            <div
                              key={item.number}
                              className="px-1.5 py-1 rounded-[4px] bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-mono-tabular text-[10px] font-bold flex items-center gap-1"
                              title={`Sorteada ${item.drawnCount} vezes (${item.frequencyPct}%)`}
                            >
                              <span>{String(item.number).padStart(2, '0')}</span>
                              <span className="text-[9px] font-normal text-[#92400E]">
                                ({item.drawnCount}x)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#005CA9] mb-1.5">
                          <Snowflake className="w-3.5 h-3.5 text-[#005CA9]" />
                          <span>Mais Frias (Atrasadas)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {lotteryStats.coldNumbers.slice(0, 8).map((item) => (
                            <div
                              key={item.number}
                              className="px-1.5 py-1 rounded-[4px] bg-[#EBF4FC] border border-[#BFDBFE] text-[#005CA9] font-mono-tabular text-[10px] font-bold flex items-center gap-1"
                              title={`Sorteada ${item.drawnCount} vezes · Atraso: ${item.delayConcursos} conc.`}
                            >
                              <span>{String(item.number).padStart(2, '0')}</span>
                              <span className="text-[9px] font-normal text-[#1E40AF]">
                                ({item.drawnCount}x)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                  {/* 2. Use Favorite Numbers Toggle */}
                  <section className="caixa-card p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                          <Heart className="w-4 h-4 text-[#005CA9]" />
                          <span>1. Usar Minhas Dezenas Favoritas</span>
                        </h3>
                        <p className="text-[11px] text-[#5F6C7B]">
                          Inclui seus números da sorte salvos ({genUseFavorites ? 'Ativado' : 'Desativado'})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGeneratorBox('favoritas')}
                        className="px-2.5 h-7 rounded-[4px] bg-[#EBF4FC] hover:bg-[#DBEAFE] text-[#005CA9] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        <span>{expandedGenBoxes.favoritas ? 'Recolher' : 'Expandir'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            expandedGenBoxes.favoritas ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {expandedGenBoxes.favoritas && (
                      <div className="pt-2 border-t border-[#EDF2F7] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#333E48]">
                            Usar números favoritos na geração:
                          </span>
                          <button
                            type="button"
                            onClick={() => setGenUseFavorites((prev) => !prev)}
                            className={`px-3 h-8 rounded-[4px] text-xs font-bold transition-colors cursor-pointer ${
                              genUseFavorites
                                ? 'bg-[#008B47] text-white'
                                : 'bg-[#E2E8F0] text-[#5F6C7B]'
                            }`}
                          >
                            {genUseFavorites ? 'ATIVADO' : 'DESATIVADO'}
                          </button>
                        </div>

                        {genUseFavorites && (
                          <div className="pt-1 flex items-center justify-between gap-2 border-t border-[#F1F5F9]">
                            <div className="flex flex-wrap gap-1">
                              {currentGenFavNumbers.map((n) => (
                                <span
                                  key={n}
                                  className="w-6 h-6 rounded-full bg-[#EBF4FC] text-[#005CA9] font-mono-tabular font-bold text-[11px] flex items-center justify-center"
                                >
                                  {String(n).padStart(2, '0')}
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveSection('DEZENAS_FAV')}
                              className="text-[11px] font-bold text-[#005CA9] underline shrink-0 cursor-pointer"
                            >
                              Editar favoritas
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* 3. Fixed Numbers ("Para ajudar o sistema") & Excluded Numbers ("Não deseja no palpite") */}
                  <section className="caixa-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-[#1E293B]">
                          2. Dezenas Fixas (Ajudar) e Excluídas (Bloquear)
                        </h3>
                        <p className="text-[11px] text-[#5F6C7B]">
                          Fixas: {genFixedNumbers.length} · Excluídas: {genExcludedNumbers.length}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGeneratorBox('fixasExcluidas')}
                        className="px-2.5 h-7 rounded-[4px] bg-[#EBF4FC] hover:bg-[#DBEAFE] text-[#005CA9] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        <span>{expandedGenBoxes.fixasExcluidas ? 'Recolher' : 'Expandir'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            expandedGenBoxes.fixasExcluidas ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {expandedGenBoxes.fixasExcluidas && (
                      <div className="pt-2 border-t border-[#EDF2F7] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#5F6C7B]">
                            Escolha o modo abaixo e toque nas dezenas do volante:
                          </span>
                          {(genFixedNumbers.length > 0 || genExcludedNumbers.length > 0) && (
                            <button
                              type="button"
                              onClick={() => {
                                setGenFixedNumbers([]);
                                setGenExcludedNumbers([]);
                              }}
                              className="text-[11px] font-bold text-[#DC2626] hover:underline shrink-0 cursor-pointer"
                            >
                              Limpar ({genFixedNumbers.length + genExcludedNumbers.length})
                            </button>
                          )}
                        </div>

                        {/* Mode Selector: Fix vs Exclude */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setGenBoardMode('FIX')}
                            className={`h-9 px-2 rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                              genBoardMode === 'FIX'
                                ? 'bg-[#008B47] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                            }`}
                          >
                            <Pin className="w-3.5 h-3.5" />
                            <span>Fixar p/ Ajudar ({genFixedNumbers.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setGenBoardMode('EXCLUDE')}
                            className={`h-9 px-2 rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                              genBoardMode === 'EXCLUDE'
                                ? 'bg-[#DC2626] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                            }`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Não Desejo ({genExcludedNumbers.length})</span>
                          </button>
                        </div>

                        {/* Interactive Volante Grid */}
                        <div className="grid grid-cols-10 gap-1.5 pt-1">
                          {Array.from(
                            { length: LOTTERY_CONFIGS[genLotteryType].totalPoolNumbers },
                            (_, i) => i + 1
                          ).map((num) => {
                            const isFixed = genFixedNumbers.includes(num);
                            const isExcluded = genExcludedNumbers.includes(num);
                            const isFav = genUseFavorites && currentGenFavNumbers.includes(num);
                            const isHot = lotteryStats.hotNumbers.some((h) => h.number === num);

                            let btnClass =
                              'bg-[#F1F5F9] text-[#333E48] hover:bg-[#E2E8F0] border border-transparent';
                            if (isFixed) {
                              btnClass = 'bg-[#008B47] text-white border-[#006835]';
                            } else if (isExcluded) {
                              btnClass =
                                'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5] line-through';
                            } else if (isFav) {
                              btnClass = 'bg-[#EBF4FC] text-[#005CA9] border-[#93C5FD]';
                            } else if (isHot) {
                              btnClass = 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
                            }

                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => handleToggleGeneratorBoardNumber(num)}
                                className={`h-7 rounded-[4px] font-mono-tabular text-[11px] font-bold transition-colors cursor-pointer ${btnClass}`}
                              >
                                {String(num).padStart(2, '0')}
                              </button>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-[#5F6C7B]">
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#008B47] inline-block" />
                            Fixa (Obrigatória)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#FEE2E2] border border-[#FCA5A5] inline-block" />
                            Excluída (Bloqueada)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#EBF4FC] border border-[#93C5FD] inline-block" />
                            Favorita
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#FFFBEB] border border-[#FDE68A] inline-block" />
                            Quente API
                          </span>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* 4. Hot & Cold Mixture Controls (All Options: Presets + Exact Slider) */}
                  <section className="caixa-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-[#1E293B]">
                          3. Mistura de Dezenas Mais Quentes e Mais Frias
                        </h3>
                        <p className="text-[11px] text-[#5F6C7B]">
                          {genMixPreset === 'PURE_RANDOM'
                            ? 'Modo: Aleatório Livre'
                            : `Proporção: ${genHotPercentage}% Quentes / ${100 - genHotPercentage}% Frias`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGeneratorBox('mistura')}
                        className="px-2.5 h-7 rounded-[4px] bg-[#EBF4FC] hover:bg-[#DBEAFE] text-[#005CA9] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        <span>{expandedGenBoxes.mistura ? 'Recolher' : 'Expandir'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            expandedGenBoxes.mistura ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {expandedGenBoxes.mistura && (
                      <div className="pt-2 border-t border-[#EDF2F7] space-y-3">
                        {/* Quick Mode Buttons */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setGenMixPreset('BALANCED');
                              setGenHotPercentage(50);
                            }}
                            className={`h-9 px-2 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                              genMixPreset === 'BALANCED'
                                ? 'bg-[#005CA9] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B]'
                            }`}
                          >
                            Equilibrado (50% / 50%)
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setGenMixPreset('HOT_FOCUS');
                              setGenHotPercentage(80);
                            }}
                            className={`h-9 px-2 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                              genMixPreset === 'HOT_FOCUS'
                                ? 'bg-[#D97706] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B]'
                            }`}
                          >
                            Foco Mais Quentes (80%)
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setGenMixPreset('COLD_FOCUS');
                              setGenHotPercentage(20);
                            }}
                            className={`h-9 px-2 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                              genMixPreset === 'COLD_FOCUS'
                                ? 'bg-[#005CA9] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B]'
                            }`}
                          >
                            Foco Mais Frias (80%)
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setGenMixPreset('PURE_RANDOM');
                            }}
                            className={`h-9 px-2 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                              genMixPreset === 'PURE_RANDOM'
                                ? 'bg-[#333E48] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B]'
                            }`}
                          >
                            Aleatório Livre
                          </button>
                        </div>

                        {/* Exact Proportion Slider */}
                        {genMixPreset !== 'PURE_RANDOM' && (
                          <div className="pt-2 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-[#D97706] flex items-center gap-1 font-mono-tabular">
                                <Flame className="w-3.5 h-3.5" />
                                {genHotPercentage}% Mais Quentes
                              </span>
                              <span className="text-[#005CA9] flex items-center gap-1 font-mono-tabular">
                                {100 - genHotPercentage}% Mais Frias
                                <Snowflake className="w-3.5 h-3.5" />
                              </span>
                            </div>

                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={10}
                              value={genHotPercentage}
                              onChange={(e) => {
                                setGenHotPercentage(Number(e.target.value));
                                setGenMixPreset('CUSTOM');
                              }}
                              className="w-full accent-[#005CA9] cursor-pointer"
                            />

                            <p className="text-[11px] text-[#5F6C7B]">
                              Ajuste o controle deslizante acima para definir a proporção exata entre dezenas quentes e frias.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* 5. Último Item: Quantidade de Dezenas por Jogo, Quantos Jogos Gerar e Botão Gerar */}
                  <section className="caixa-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-[#1E293B]">
                          4. Quantidade de Dezenas e Palpites ({LOTTERY_CONFIGS[genLotteryType].name})
                        </h3>
                        <p className="text-[11px] text-[#5F6C7B]">
                          {genDozensCount} dezenas por jogo · {genGamesCount}{' '}
                          {genGamesCount === 1 ? 'palpite' : 'palpites'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGeneratorBox('quantidade')}
                        className="px-2.5 h-7 rounded-[4px] bg-[#EBF4FC] hover:bg-[#DBEAFE] text-[#005CA9] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        <span>{expandedGenBoxes.quantidade ? 'Recolher' : 'Expandir'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            expandedGenBoxes.quantidade ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {expandedGenBoxes.quantidade && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#EDF2F7]">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                            Dezenas por Jogo:
                          </label>
                          <select
                            value={genDozensCount}
                            onChange={(e) => setGenDozensCount(Number(e.target.value))}
                            className="caixa-input font-mono-tabular font-bold"
                          >
                            {Object.keys(LOTTERY_CONFIGS[genLotteryType].priceTable).map(
                              (dStr) => {
                                const d = Number(dStr);
                                const pInfo = LOTTERY_CONFIGS[genLotteryType].priceTable[d];
                                return (
                                  <option key={d} value={d}>
                                    {d} dezenas ({formatCurrencyBRL(pInfo.price)})
                                  </option>
                                );
                              }
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                            Quantos Jogos Gerar:
                          </label>
                          <select
                            value={genGamesCount}
                            onChange={(e) => setGenGamesCount(Number(e.target.value))}
                            className="caixa-input font-mono-tabular font-bold"
                          >
                            {[1, 2, 3, 5, 8, 10].map((cnt) => (
                              <option key={cnt} value={cnt}>
                                {cnt} {cnt === 1 ? 'palpite' : 'palpites de uma vez'}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Generate CTA Button Integrado neste Section */}
                    <button
                      type="button"
                      onClick={handleExecuteGenerator}
                      className="w-full h-11 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>
                        GERAR {genGamesCount}{' '}
                        {genGamesCount === 1 ? 'PALPITE AGORA' : 'PALPITES AGORA'}
                      </span>
                    </button>
                  </section>
                </div>

              {/* =========================================================== */}
              {/* LISTA DE JOGOS GERADOS (EM BRANCO ATÉ A GERAÇÃO)            */}
              {/* =========================================================== */}
              <section className="caixa-card p-4 space-y-3 min-h-[80px]">
                {(() => {
                  const filteredPalpites = generatedPalpites.filter(
                    (p) => p.lotteryType === genLotteryType
                  );

                  if (filteredPalpites.length === 0) {
                    return null;
                  }

                  return (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b border-[#EDF2F7] pb-2.5">
                        <div>
                          <h3 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#005CA9]" />
                            <span>
                              Jogos Gerados ({LOTTERY_CONFIGS[genLotteryType].name})
                            </span>
                          </h3>
                          <p className="text-[10px] text-[#5F6C7B]">
                            Jogos recém-criados aparecem primeiro na lista · Envie para Favoritos para salvar
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-[3px] bg-[#EBF4FC] text-[#005CA9] font-mono-tabular text-[10px] font-bold shrink-0">
                          {filteredPalpites.length} jogo(s)
                        </span>
                      </div>

                      <div className="divide-y divide-[#E2E8F0]">
                        {filteredPalpites.map((item, idx) => {
                          const isSent = !!sentPalpiteIds[item.id];
                          const isSaved = !!savedPalpiteIds[item.id];
                          const isCopied = copiedId === item.id;
                        const isApprovedByMe = !!userApprovedComboIds[item.id];
                        const approvalsCount = approvedComboVotes[item.id] || idx + 2;

                        const dateObj = item.createdAt ? new Date(item.createdAt) : new Date();
                        const formattedDate = dateObj.toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        });
                        const formattedTime = dateObj.toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        });

                        return (
                          <div key={item.id} className="py-3 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-[#1E293B]">
                                    Jogo #{String(idx + 1).padStart(2, '0')} · {item.numbers.length} dezenas
                                  </span>
                                  {idx === 0 && (
                                    <span className="px-1.5 py-0.5 rounded-[3px] bg-[#DCFCE7] text-[#008B47] text-[9px] font-bold">
                                      RECÉM-CRIADO
                                    </span>
                                  )}
                                </div>
                                <span className="block font-mono-tabular text-[10px] font-semibold text-[#005CA9] mt-0.5">
                                  Gerado em {formattedDate} às {formattedTime}
                                </span>
                                <span className="font-mono-tabular text-[11px] text-[#5F6C7B]">
                                  Custo base: {formatCurrencyBRL(item.cost)} · 1 em{' '}
                                  {item.probabilityOneIn.toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-[3px] shrink-0 ${
                                  isSent
                                    ? 'bg-[#DCFCE7] text-[#008B47]'
                                    : 'bg-[#EBF4FC] text-[#005CA9]'
                                }`}
                              >
                                {isSent
                                  ? `NO BOLÃO · ${approvalsCount} APROV.`
                                  : `DISPONÍVEL · ${approvalsCount} APROV.`}
                              </span>
                            </div>

                            {/* Numbers row */}
                            <div className="flex flex-wrap gap-1.5">
                              {item.numbers.map((n) => {
                                const isFix = item.fromFixed.includes(n);
                                const isFav = item.fromFavorites.includes(n);
                                const isHot = item.fromHot.includes(n);
                                const isCold = item.fromCold.includes(n);

                                let badgeStyle = 'bg-[#EBF4FC] text-[#005CA9]';
                                if (isFix) {
                                  badgeStyle = 'bg-[#008B47] text-white';
                                } else if (isFav) {
                                  badgeStyle = 'bg-[#005CA9] text-white';
                                } else if (isHot) {
                                  badgeStyle =
                                    'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]';
                                } else if (isCold) {
                                  badgeStyle =
                                    'bg-[#F0F9FF] text-[#0369A1] border border-[#BAE6FD]';
                                }

                                return (
                                  <span
                                    key={n}
                                    className={`w-7 h-7 rounded-full font-mono-tabular font-bold text-xs flex items-center justify-center ${badgeStyle}`}
                                  >
                                    {String(n).padStart(2, '0')}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Breakdown summary */}
                            <div className="text-[10px] text-[#5F6C7B] flex flex-wrap gap-2">
                              {item.fromFixed.length > 0 && (
                                <span className="text-[#008B47] font-semibold">
                                  • {item.fromFixed.length} Fixa(s)
                                </span>
                              )}
                              {item.fromFavorites.length > 0 && (
                                <span className="text-[#005CA9] font-semibold">
                                  • {item.fromFavorites.length} Favorita(s)
                                </span>
                              )}
                              {item.fromHot.length > 0 && (
                                <span className="text-[#D97706] font-semibold">
                                  • {item.fromHot.length} Quente(s)
                                </span>
                              )}
                              {item.fromCold.length > 0 && (
                                <span className="text-[#0369A1] font-semibold">
                                  • {item.fromCold.length} Fria(s)
                                </span>
                              )}
                            </div>

                            {/* Action Buttons: Enviar para Favoritos, Compartilhar com Bolão, Aprovação e Copiar */}
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              <button
                                type="button"
                                disabled={isSaved}
                                onClick={() => handleSaveGeneratedToFavorites(item, idx)}
                                className={`h-8 px-2 rounded-[4px] text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                  isSaved
                                    ? 'bg-[#EBF4FC] text-[#005CA9]'
                                    : 'bg-[#005CA9] hover:bg-[#004A87] text-white'
                                }`}
                              >
                                {isSaved ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Salvo em Favoritos</span>
                                  </>
                                ) : (
                                  <>
                                    <BookmarkPlus className="w-3 h-3" />
                                    <span>Enviar p/ Favoritos</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isSent}
                                onClick={() => handleSendGeneratedToPool(item)}
                                className={`h-8 px-2 rounded-[4px] text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                  isSent
                                    ? 'bg-[#DCFCE7] text-[#008B47]'
                                    : 'bg-[#008B47] hover:bg-[#00743B] text-white'
                                }`}
                              >
                                {isSent ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Compartilhado no Bolão</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3" />
                                    <span>Compartilhar c/ Bolão</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isApprovedByMe}
                                onClick={() => {
                                  setApprovedComboVotes((prev) => ({
                                    ...prev,
                                    [item.id]: (prev[item.id] || idx + 2) + 1,
                                  }));
                                  setUserApprovedComboIds((prev) => ({
                                    ...prev,
                                    [item.id]: true,
                                  }));
                                  onNotify?.(
                                    `Jogo #${idx + 1} aprovado para o ranking do bolão!`
                                  );
                                }}
                                className={`h-8 px-2 rounded-[4px] text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                  isApprovedByMe
                                    ? 'bg-[#DCFCE7] text-[#008B47]'
                                    : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#005CA9]'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                <span>
                                  {isApprovedByMe
                                    ? `Aprovado (${approvalsCount})`
                                    : `Aprovar Jogo (${approvalsCount})`}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyOrSharePalpite(item, idx)}
                                className="h-8 px-2 rounded-[4px] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#333E48] text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#008B47]" />
                                    <span>Dezenas Copiadas</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar Dezenas</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </>
                  );
                })()}
              </section>
            </div>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO: MEU PERFIL (ACESSADA PELO MENU DO AVATAR)                */}
          {/* =============================================================== */}
          {activeSection === 'PERFIL' && (
            <section className="caixa-card p-4">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-4 gap-1 border-b border-[#E2E8F0] pb-2">
                  {[
                    { step: 1, label: '1. Usuário' },
                    { step: 2, label: '2. Contato' },
                    { step: 3, label: '3. Grupo de Bolão' },
                    { step: 4, label: '4. Pix/CPF' },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setProfileStep(s.step as 1 | 2 | 3 | 4)}
                      className={`py-2 text-[11px] font-bold rounded-[4px] transition-colors cursor-pointer ${
                        profileStep === s.step
                          ? 'bg-[#005CA9] text-white'
                          : 'bg-[#F1F5F9] text-[#5F6C7B]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {profileStep === 1 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="caixa-input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                        Nome de Usuário (Ex. Fulano@)
                      </label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="caixa-input"
                      />
                    </div>
                  </div>
                )}

                {profileStep === 2 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                        WhatsApp
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editWhatsapp}
                        onChange={(e) => setEditWhatsapp(maskPhoneInput(e.target.value))}
                        className="caixa-input font-mono-tabular"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                        E-mail Corporativo / Pessoal
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="caixa-input"
                        required
                      />
                    </div>
                  </div>
                )}

                {profileStep === 3 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                        Qual o seu Grupo de Bolão?
                      </label>
                      <input
                        type="text"
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        className="caixa-input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                        Qual sua função / setor?
                      </label>
                      <input
                        type="text"
                        value={editJobTitle}
                        onChange={(e) => setEditJobTitle(e.target.value)}
                        className="caixa-input"
                        required
                      />
                    </div>
                  </div>
                )}

                {profileStep === 4 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                        Qual seu CPF?
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editCpf}
                        onChange={(e) => setEditCpf(maskCpfInput(e.target.value))}
                        className="caixa-input font-mono-tabular"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                        Qual sua Chave Pix para recebimento de prêmios?
                      </label>
                      <input
                        type="text"
                        value={editPixKey}
                        onChange={(e) => setEditPixKey(maskSmartIdentifier(e.target.value))}
                        className="caixa-input font-mono-tabular"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSection(null)}
                    className="px-4 h-10 rounded-[4px] border border-[#CBD5E1] text-xs font-semibold text-[#5F6C7B] cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex-1 h-10 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {savingProfile ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO UNIFICADA: MEUS GRUPOS (ATIVOS E HISTÓRICO POR ANO)       */}
          {/* =============================================================== */}
          {activeSection === 'GRUPOS' &&
            (() => {
              const selectedItem = filteredYearPools.find(
                (i) => i.id === selectedGroupItemId
              );

              // =============================================================
              // SUB-SEÇÃO PRÓPRIA DO BOLÃO SELECIONADO (SEM BOX DENTRO DE BOX)
              // =============================================================
              if (selectedItem) {
                const item = selectedItem;
                const basePurchases = myPurchases.length > 0 ? myPurchases : purchases;
                const groupPurchases = basePurchases.filter(
                  (pur) =>
                    (item.poolId && pur.poolId === item.poolId) ||
                    (item.companyId && pur.companyId === item.companyId)
                );
                const quotasToDisplay =
                  item.year === '2026'
                    ? groupPurchases.length > 0
                      ? groupPurchases
                      : basePurchases.slice(0, 1)
                    : [];

                const itemPoolGames = games.filter(
                  (g) =>
                    (item.poolId && g.poolId === item.poolId) ||
                    (item.companyId && g.companyId === item.companyId)
                );
                const itemPoolSuggestions = suggestions.filter(
                  (s) =>
                    (item.poolId && s.poolId === item.poolId) ||
                    (item.companyId && s.companyId === item.companyId)
                );
                const groupMostBet = calculateCompanyMostPlayedNumbers(
                  itemPoolGames.length > 0 ? itemPoolGames : games,
                  itemPoolSuggestions.length > 0 ? itemPoolSuggestions : suggestions,
                  8
                );

                const itemLotteryStats = getDefaultLotteryStats(item.lotteryType);
                const itemAllTimeMostDrawn =
                  LOTTERY_CONFIGS[item.lotteryType].allTimeMostPlayed.slice(0, 8);
                const itemSpecialMostDrawn =
                  LOTTERY_CONFIGS[item.lotteryType].specialContestMostPlayed.slice(0, 8);
                const freqMap = new Map(
                  itemLotteryStats.allFrequencies.map((f) => [f.number, f])
                );

                const lotteryCfg = LOTTERY_CONFIGS[item.lotteryType];
                const getBetMetrics = (dozensLen: number) => {
                  const pInfo =
                    lotteryCfg.priceTable[dozensLen] ||
                    lotteryCfg.priceTable[lotteryCfg.minNumbers];
                  return {
                    cost: pInfo?.price ?? lotteryCfg.baseSimpleBetPrice,
                    probabilityOneIn: pInfo?.probabilityOneIn ?? 1000000,
                  };
                };

                const basePoolGames =
                  itemPoolGames.length > 0
                    ? itemPoolGames
                    : games
                        .filter((g) => g.lotteryType === item.lotteryType)
                        .slice(0, 2);

                // 1. Jogos Confirmados
                const confirmedPoolGames = basePoolGames.map((g, gIdx) => {
                  const metrics = getBetMetrics(g.numbers.length);
                  return {
                    ...g,
                    cost: g.cost || metrics.cost,
                    probabilityOneIn: metrics.probabilityOneIn,
                    baseLikes: 8 + gIdx * 3,
                  };
                });

                // 2. Jogos Não Confirmados
                const unconfirmedPoolGames = [
                  {
                    id: `unconf_1_${item.id}`,
                    numbers: itemAllTimeMostDrawn
                      .slice(0, lotteryCfg.minNumbers)
                      .map((x) => x.number)
                      .sort((a, b) => a - b),
                    ...getBetMetrics(lotteryCfg.minNumbers),
                    baseLikes: 6,
                  },
                  {
                    id: `unconf_2_${item.id}`,
                    numbers: itemSpecialMostDrawn
                      .slice(0, lotteryCfg.minNumbers)
                      .map((x) => x.number)
                      .sort((a, b) => a - b),
                    ...getBetMetrics(lotteryCfg.minNumbers),
                    baseLikes: 4,
                  },
                ];

                // 3. Jogos Propostos
                const poolSuggestionsForDisplay =
                  itemPoolSuggestions.length > 0
                    ? itemPoolSuggestions
                    : suggestions.filter((s) => s.lotteryType === item.lotteryType);

                const groupNumsWithStats = groupMostBet.map((gItem) => {
                  const st = freqMap.get(gItem.number);
                  return {
                    ...gItem,
                    drawnCount: st?.drawnCount ?? 0,
                    delayConcursos: st?.delayConcursos ?? 0,
                    temperature: st?.temperature ?? 'NEUTRAL',
                  };
                });

                const sortedByDelay = [...groupNumsWithStats].sort(
                  (a, b) => b.delayConcursos - a.delayConcursos
                );
                const mostDelayedNums = new Set([
                  ...itemLotteryStats.coldNumbers.slice(0, 4).map((c) => c.number),
                  ...sortedByDelay.slice(0, 2).map((d) => d.number),
                ]);

                const sortedByLeastDrawn = [...groupNumsWithStats]
                  .filter((x) => !mostDelayedNums.has(x.number))
                  .sort((a, b) => a.drawnCount - b.drawnCount);
                const leastDrawnNums = new Set([
                  ...itemLotteryStats.coldNumbers.map((c) => c.number),
                  ...sortedByLeastDrawn.slice(0, 2).map((l) => l.number),
                ]);

                const mostDrawnNums = new Set(
                  itemAllTimeMostDrawn.map((h) => h.number)
                );
                const specialDrawnNums = new Set(
                  itemSpecialMostDrawn.map((sp) => sp.number)
                );

                const activeGroupTab = groupTabByPoolId[item.id] || 'RESUMO';
                const totalJogosCount =
                  confirmedPoolGames.length +
                  unconfirmedPoolGames.length +
                  poolSuggestionsForDisplay.length;

                return (
                  <div className="space-y-3">
                    {/* Cabeçalho da Sub-seção do Bolão + Barra de Abas */}
                    <section className="caixa-card p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-[#EDF2F7] pb-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedGroupItemId(null)}
                          className="h-8 px-2.5 rounded-[4px] bg-[#EBF4FC] hover:bg-[#D5E8FA] text-[#005CA9] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Voltar aos Grupos</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#008B47]">
                            {item.statusLabel}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-[#005CA9] block">
                          Concurso {item.contestNumber} - {item.dateLabel}
                        </span>
                        <h3 className="text-sm font-extrabold text-[#1E293B]">
                          {item.title}
                        </h3>
                      </div>

                      <div className="grid grid-cols-4 gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setGroupTabByPoolId((prev) => ({
                              ...prev,
                              [item.id]: 'RESUMO',
                            }))
                          }
                          className={`h-8 px-1 rounded-[4px] text-[10px] font-bold transition-colors cursor-pointer ${
                            activeGroupTab === 'RESUMO'
                              ? 'bg-[#005CA9] text-white'
                              : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                          }`}
                        >
                          Resumo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setGroupTabByPoolId((prev) => ({
                              ...prev,
                              [item.id]: 'JOGOS',
                            }))
                          }
                          className={`h-8 px-1 rounded-[4px] text-[10px] font-bold transition-colors cursor-pointer ${
                            activeGroupTab === 'JOGOS'
                              ? 'bg-[#005CA9] text-white'
                              : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                          }`}
                        >
                          Jogos ({totalJogosCount})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setGroupTabByPoolId((prev) => ({
                              ...prev,
                              [item.id]: 'DEZENAS',
                            }))
                          }
                          className={`h-8 px-1 rounded-[4px] text-[10px] font-bold transition-colors cursor-pointer ${
                            activeGroupTab === 'DEZENAS'
                              ? 'bg-[#005CA9] text-white'
                              : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                          }`}
                        >
                          Estatísticas
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setGroupTabByPoolId((prev) => ({
                              ...prev,
                              [item.id]: 'COTAS',
                            }))
                          }
                          className={`h-8 px-1 rounded-[4px] text-[10px] font-bold transition-colors cursor-pointer ${
                            activeGroupTab === 'COTAS'
                              ? 'bg-[#005CA9] text-white'
                              : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                          }`}
                        >
                          Cotas ({quotasToDisplay.length || item.myQuotas})
                        </button>
                      </div>
                    </section>

                    {/* Conteúdo Direto da Aba Selecionada (Sem Box Dentro de Box) */}
                    <section className="caixa-card p-3.5">
                      {/* ABA 1: RESUMO DO GRUPO */}
                      {activeGroupTab === 'RESUMO' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                            <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0]">
                              <span className="text-[#5F6C7B] block">Minhas Cotas no Grupo</span>
                              <span className="font-mono-tabular font-bold text-[#1E293B]">
                                {item.myQuotas} cota(s) ({formatCurrencyBRL(item.myInvested)})
                              </span>
                            </div>
                            <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0]">
                              <span className="text-[#5F6C7B] block">Arrecadado / Teto</span>
                              <span className="font-mono-tabular font-bold text-[#008B47]">
                                {item.maxTargetAmount > 0 ? (
                                  <>
                                    {formatCurrencyBRL(item.poolTotalRaised)} /{' '}
                                    {formatCurrencyBRL(item.maxTargetAmount)}
                                  </>
                                ) : (
                                  <>{formatCurrencyBRL(item.poolTotalRaised)} (Sem teto)</>
                                )}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0]">
                              <span className="text-[#5F6C7B] block">Participantes do Grupo</span>
                              <span className="font-mono-tabular font-semibold text-[#005CA9]">
                                {item.participantsCount} integrantes
                              </span>
                            </div>
                            <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0]">
                              <span className="text-[#5F6C7B] block">Prêmio Rateado</span>
                              <span className="font-mono-tabular font-bold text-[#008B47]">
                                {item.prizeReceived > 0
                                  ? formatCurrencyBRL(item.prizeReceived)
                                  : 'Em apuração'}
                              </span>
                            </div>
                          </div>

                          {/* Ações Rápidas: Acessar e Compartilhar do mesmo tamanho */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.companyId) {
                                  onSelectCompany(item.companyId);
                                }
                              }}
                              className="h-9 px-3 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Acessar</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await shareOrCopyPoolLink({
                                  companyId: item.companyId || selectedCompanyId,
                                  poolId: item.poolId,
                                  title: item.title,
                                  companyName: item.companyName,
                                  useNativeShare: true,
                                });
                                onNotify?.('Link do bolão compartilhado!');
                              }}
                              className="h-9 px-3 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Compartilhar</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ABA 2: 3 LISTAS SIMPLES (1. CONFIRMADOS, 2. NÃO CONFIRMADOS, 3. PROPOSTOS) */}
                      {activeGroupTab === 'JOGOS' && (
                        <div className="space-y-3">
                          {/* 1ª Lista: Jogos Confirmados */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-[#008B47] block">
                              1. JOGOS CONFIRMADOS ({confirmedPoolGames.length})
                            </span>
                            <div className="divide-y divide-[#E2E8F0]">
                              {confirmedPoolGames.map((g, gIdx) => {
                                const isGameLiked = !!likedPoolGameIds[g.id];
                                const totalGameLikes =
                                  g.baseLikes + (poolGameLikesCount[g.id] || 0);

                                return (
                                  <div key={g.id} className="py-2 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-bold text-[#1E293B] font-mono-tabular">
                                        Jogo #{String(gIdx + 1).padStart(2, '0')} ·{' '}
                                        {formatCurrencyBRL(g.cost)} · 1 em{' '}
                                        {g.probabilityOneIn.toLocaleString('pt-BR')}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLikedPoolGameIds((prev) => ({
                                            ...prev,
                                            [g.id]: !prev[g.id],
                                          }));
                                          setPoolGameLikesCount((prev) => ({
                                            ...prev,
                                            [g.id]: isGameLiked
                                              ? Math.max(0, (prev[g.id] || 0) - 1)
                                              : (prev[g.id] || 0) + 1,
                                          }));
                                        }}
                                        className={`px-2 h-6 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                                          isGameLiked
                                            ? 'bg-[#DCFCE7] text-[#008B47]'
                                            : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#005CA9]'
                                        }`}
                                      >
                                        <ThumbsUp className="w-3 h-3" />
                                        <span>{totalGameLikes}</span>
                                      </button>
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                      {g.numbers.map((num) => (
                                        <span
                                          key={num}
                                          className="w-6 h-6 rounded-full bg-[#DCFCE7] text-[#008B47] font-mono-tabular font-bold text-[11px] flex items-center justify-center"
                                        >
                                          {String(num).padStart(2, '0')}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* 2ª Lista: Jogos Não Confirmados */}
                          <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
                            <span className="text-[10px] font-bold text-[#B45309] block">
                              2. JOGOS NÃO CONFIRMADOS ({unconfirmedPoolGames.length})
                            </span>
                            <div className="divide-y divide-[#E2E8F0]">
                              {unconfirmedPoolGames.map((g, gIdx) => {
                                const isGameLiked = !!likedPoolGameIds[g.id];
                                const totalGameLikes =
                                  g.baseLikes + (poolGameLikesCount[g.id] || 0);

                                return (
                                  <div key={g.id} className="py-2 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-bold text-[#1E293B] font-mono-tabular">
                                        Jogo #{String(gIdx + 1).padStart(2, '0')} ·{' '}
                                        {formatCurrencyBRL(g.cost)} · 1 em{' '}
                                        {g.probabilityOneIn.toLocaleString('pt-BR')}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLikedPoolGameIds((prev) => ({
                                            ...prev,
                                            [g.id]: !prev[g.id],
                                          }));
                                          setPoolGameLikesCount((prev) => ({
                                            ...prev,
                                            [g.id]: isGameLiked
                                              ? Math.max(0, (prev[g.id] || 0) - 1)
                                              : (prev[g.id] || 0) + 1,
                                          }));
                                        }}
                                        className={`px-2 h-6 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                                          isGameLiked
                                            ? 'bg-[#DCFCE7] text-[#008B47]'
                                            : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#005CA9]'
                                        }`}
                                      >
                                        <ThumbsUp className="w-3 h-3" />
                                        <span>{totalGameLikes}</span>
                                      </button>
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                      {g.numbers.map((num) => (
                                        <span
                                          key={num}
                                          className="w-6 h-6 rounded-full bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] font-mono-tabular font-bold text-[11px] flex items-center justify-center"
                                        >
                                          {String(num).padStart(2, '0')}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* 3ª Lista: Jogos Propostos */}
                          <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[#005CA9]">
                                3. JOGOS PROPOSTOS ({poolSuggestionsForDisplay.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setGenLotteryType(item.lotteryType);
                                  setActiveSection('PALPITES');
                                  setPalpitesActiveTab('GERADOR');
                                }}
                                className="px-2 h-6 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Propor</span>
                              </button>
                            </div>

                            <div className="divide-y divide-[#E2E8F0]">
                              {poolSuggestionsForDisplay.map((sug, sIdx) => {
                                const extraLikes = approvedComboVotes[sug.id] || 0;
                                const isSugLiked = !!userApprovedComboIds[sug.id];
                                const totalVotes = sug.votes + extraLikes;
                                const sugMetrics = getBetMetrics(sug.numbers.length);

                                return (
                                  <div key={sug.id} className="py-2 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-bold text-[#1E293B] font-mono-tabular">
                                        Proposto #{String(sIdx + 1).padStart(2, '0')} ·{' '}
                                        {formatCurrencyBRL(sugMetrics.cost)} · 1 em{' '}
                                        {sugMetrics.probabilityOneIn.toLocaleString('pt-BR')}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setUserApprovedComboIds((prev) => ({
                                            ...prev,
                                            [sug.id]: !prev[sug.id],
                                          }));
                                          setApprovedComboVotes((prev) => ({
                                            ...prev,
                                            [sug.id]: isSugLiked
                                              ? Math.max(0, (prev[sug.id] || 0) - 1)
                                              : (prev[sug.id] || 0) + 1,
                                          }));
                                        }}
                                        className={`px-2 h-6 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                                          isSugLiked
                                            ? 'bg-[#DCFCE7] text-[#008B47]'
                                            : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#005CA9]'
                                        }`}
                                      >
                                        <ThumbsUp className="w-3 h-3" />
                                        <span>{totalVotes}</span>
                                      </button>
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                      {sug.numbers.map((num) => (
                                        <span
                                          key={num}
                                          className="w-6 h-6 rounded-full bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6] font-mono-tabular font-bold text-[11px] flex items-center justify-center"
                                        >
                                          {String(num).padStart(2, '0')}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ABA 3: ESTATÍSTICAS DO BOLÃO (PROPOSTAS NO BOLÃO VS. HISTÓRIA VS. CONCURSOS ESPECIAIS) */}
                      {activeGroupTab === 'DEZENAS' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                            <span className="text-[10px] font-bold text-[#005CA9]">
                              ESTATÍSTICAS DO BOLÃO ({totalJogosCount} jogos)
                            </span>
                            <span className="text-[10px] text-[#5F6C7B] font-semibold">
                              {LOTTERY_CONFIGS[item.lotteryType].name}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {/* Coluna 1: Mais Propostas no Bolão */}
                            <div>
                              <div className="flex items-center gap-1 text-[10px] font-bold text-[#005CA9] mb-2">
                                <TrendingUp className="w-3 h-3 shrink-0" />
                                <span className="leading-tight">Mais Propostas no Bolão</span>
                              </div>
                              <div className="divide-y divide-[#F1F5F9] text-[10px]">
                                {groupNumsWithStats.map((gNum) => {
                                  const isMostDelayed = mostDelayedNums.has(gNum.number);
                                  const isMostDrawn =
                                    !isMostDelayed && mostDrawnNums.has(gNum.number);
                                  const isLeastDrawn =
                                    !isMostDelayed &&
                                    !isMostDrawn &&
                                    leastDrawnNums.has(gNum.number);
                                  const isSpecialTop = specialDrawnNums.has(gNum.number);

                                  let ballStyle =
                                    'bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6]';
                                  let statusHint = 'Dezena proposta no bolão';

                                  if (isMostDelayed) {
                                    ballStyle =
                                      'bg-[#DC2626] text-white border border-[#991B1B] shadow-2xs';
                                    statusHint = `Mais atrasada (${gNum.delayConcursos} conc. sem sair)`;
                                  } else if (isMostDrawn) {
                                    ballStyle =
                                      'bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B]';
                                    statusHint = `Mais saiu na história (${gNum.drawnCount}x)`;
                                  } else if (isLeastDrawn) {
                                    ballStyle =
                                      'bg-[#E0F2FE] text-[#0369A1] border border-[#38BDF8]';
                                    statusHint = `Menos saiu (${gNum.drawnCount}x)`;
                                  }

                                  return (
                                    <div
                                      key={gNum.number}
                                      className="py-1.5 flex items-center justify-between gap-1"
                                      title={statusHint}
                                    >
                                      <span
                                        className={`w-6 h-6 rounded-full font-mono-tabular font-bold flex items-center justify-center shrink-0 ${ballStyle}`}
                                      >
                                        {String(gNum.number).padStart(2, '0')}
                                      </span>
                                      <span className="font-mono-tabular text-[#5F6C7B] text-right">
                                        {gNum.count}x ({gNum.percentage}%)
                                        {isSpecialTop ? ' ★' : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Coluna 2: Mais Saíram na História */}
                            <div>
                              <div className="flex items-center gap-1 text-[10px] font-bold text-[#008B47] mb-2">
                                <Award className="w-3 h-3 shrink-0" />
                                <span className="leading-tight">Mais Saíram na História</span>
                              </div>
                              <div className="divide-y divide-[#F1F5F9] text-[10px]">
                                {itemAllTimeMostDrawn.map((hItem) => (
                                  <div
                                    key={hItem.number}
                                    className="py-1.5 flex items-center justify-between gap-1"
                                  >
                                    <span className="w-6 h-6 rounded-full bg-[#F0FDF4] text-[#008B47] border border-[#BBF7D0] font-mono-tabular font-bold flex items-center justify-center shrink-0">
                                      {String(hItem.number).padStart(2, '0')}
                                    </span>
                                    <span className="font-mono-tabular text-[#5F6C7B] text-right">
                                      {hItem.drawnCount}x ({hItem.frequencyPct}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Coluna 3: Mais Saíram nos Concursos Especiais */}
                            <div>
                              <div className="flex items-center gap-1 text-[10px] font-bold text-[#B45309] mb-2">
                                <Star className="w-3 h-3 shrink-0 text-[#D97706]" />
                                <span
                                  className="leading-tight"
                                  title={LOTTERY_CONFIGS[item.lotteryType].specialContestName}
                                >
                                  {LOTTERY_CONFIGS[item.lotteryType].specialContestName}
                                </span>
                              </div>
                              <div className="divide-y divide-[#F1F5F9] text-[10px]">
                                {itemSpecialMostDrawn.map((spItem) => (
                                  <div
                                    key={spItem.number}
                                    className="py-1.5 flex items-center justify-between gap-1"
                                  >
                                    <span className="w-6 h-6 rounded-full bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] font-mono-tabular font-bold flex items-center justify-center shrink-0">
                                      {String(spItem.number).padStart(2, '0')}
                                    </span>
                                    <span className="font-mono-tabular text-[#5F6C7B] text-right">
                                      {spItem.drawnCount}x ({spItem.frequencyPct}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Legenda das Cores das Bolas em "Mais Propostas no Bolão" */}
                          <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-[#5F6C7B]">
                            <span className="flex items-center gap-1 font-semibold text-[#B45309]">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FFFBEB] border border-[#F59E0B] inline-block" />
                              Mais saíram
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-[#0369A1]">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#E0F2FE] border border-[#38BDF8] inline-block" />
                              Menos saíram
                            </span>
                            <span className="flex items-center gap-1 font-bold text-[#DC2626]">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block" />
                              Mais atrasadas
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-[#B45309]">
                              ★ Top {LOTTERY_CONFIGS[item.lotteryType].specialContestName}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* ABA 4: MINHAS COTAS E COMPROVANTES INTEGRADOS AO GRUPO */}
                      {activeGroupTab === 'COTAS' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                            <span className="text-[10px] font-bold text-[#005CA9] flex items-center gap-1">
                              <Ticket className="w-3.5 h-3.5 text-[#005CA9]" />
                              <span>MINHAS COTAS E COMPROVANTES NESTE GRUPO</span>
                            </span>
                            <span className="text-[10px] font-mono-tabular font-semibold text-[#5F6C7B]">
                              Split Pix Conciliado
                            </span>
                          </div>

                          {quotasToDisplay.length > 0 ? (
                            <div className="divide-y divide-[#E2E8F0]">
                              {quotasToDisplay.map((pur) => (
                                <div key={pur.id} className="py-2.5 space-y-1.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className="text-[10px] font-mono-tabular font-bold text-[#005CA9] block">
                                        Recibo: {pur.couponHash}
                                      </span>
                                      <span className="text-[11px] text-[#5F6C7B]">
                                        Titular: {pur.participantName}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-[10px] font-bold ${
                                        pur.paymentStatus === 'CONFIRMED'
                                          ? 'text-[#008B47]'
                                          : 'text-[#D97706]'
                                      }`}
                                    >
                                      {pur.paymentStatus === 'CONFIRMED'
                                        ? 'PIX CONFIRMADO'
                                        : 'AGUARDANDO PIX'}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between pt-1">
                                    <div className="text-[11px]">
                                      <span className="text-[#5F6C7B]">Quantidade: </span>
                                      <span className="font-mono-tabular font-bold text-[#1E293B]">
                                        {pur.quotasCount} cota(s) —{' '}
                                        {formatCurrencyBRL(pur.totalAmount)}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => onOpenCoupon(pur)}
                                      className="px-2.5 py-1 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>Abrir Cupom</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-2.5 flex items-center justify-between">
                              <div className="text-[11px]">
                                <span className="text-[10px] font-mono-tabular font-bold text-[#005CA9] block">
                                  Recibo Histórico #{item.year}-{item.contestNumber}
                                </span>
                                <span className="font-mono-tabular font-bold text-[#1E293B]">
                                  {item.myQuotas} cota(s) — {formatCurrencyBRL(item.myInvested)}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-[#008B47]">
                                ARQUIVADO
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                );
              }

              // =============================================================
              // LISTA DE CARDS DE BOLÕES (CLIQUE NO CARD ABRE A SUB-SEÇÃO)
              // =============================================================
              return (
                <div className="space-y-3">
                  <div className="caixa-card p-2">
                    <div className="flex items-center gap-1.5">
                      {(['2026', '2025', '2024'] as const).map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setSelectedYear(yr);
                            setSelectedGroupItemId(null);
                          }}
                          className={`flex-1 h-9 rounded-[4px] text-xs font-bold transition-colors cursor-pointer ${
                            selectedYear === yr
                              ? 'bg-[#005CA9] text-white'
                              : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                          }`}
                        >
                          {yr === '2026' ? '2026 (Ativos)' : `Ano ${yr}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredYearPools.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.companyId && item.year === '2026') {
                            onSelectCompany(item.companyId);
                          } else {
                            setSelectedGroupItemId(item.id);
                          }
                        }}
                        className="caixa-card p-3.5 rounded-[6px] bg-white border border-[#DCE5F0] hover:border-[#005CA9] transition-colors cursor-pointer space-y-3"
                      >
                        {/* Linha 1: Concurso + Data à esquerda | Status + Excluir à direita */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-bold text-[#005CA9] truncate">
                              Concurso {item.contestNumber} - {item.dateLabel}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-[3px] bg-[#EBF4FC] text-[#005CA9] text-[9px] font-bold shrink-0">
                              {LOTTERY_CONFIGS[item.lotteryType].name}
                            </span>
                          </div>

                          <div
                            className="flex items-center gap-1.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] font-bold text-[#008B47]">
                              {item.statusLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setRemovedGroupIds((prev) => [...prev, item.id]);
                                onNotify?.(`Grupo "${item.title}" removido da sua lista.`);
                              }}
                              className="p-1 rounded-[4px] text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                              title="Excluir grupo da lista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Linha 2: Título ocupando 100% da largura do card */}
                        <div>
                          <h4 className="text-sm font-bold text-[#1E293B] leading-snug">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-[#5F6C7B] mt-0.5 truncate">
                            {item.companyName} · Resp.: {item.managerName}
                          </p>
                        </div>

                        {/* Linha 3: Métricas bem distribuídas em 3 colunas ocupando todo o espaço */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EDF2F7] text-[11px]">
                          <div className="p-2 rounded-[4px] bg-[#F7F9FC]">
                            <span className="text-[10px] text-[#5F6C7B] block">
                              Minhas Cotas
                            </span>
                            <span className="font-mono-tabular font-bold text-[#1E293B]">
                              {item.myQuotas} ({formatCurrencyBRL(item.myInvested)})
                            </span>
                          </div>
                          <div className="p-2 rounded-[4px] bg-[#F7F9FC]">
                            <span className="text-[10px] text-[#5F6C7B] block">
                              Arrecadado
                            </span>
                            <span className="font-mono-tabular font-bold text-[#008B47]">
                              {formatCurrencyBRL(item.poolTotalRaised)}
                            </span>
                          </div>
                          <div className="p-2 rounded-[4px] bg-[#F7F9FC]">
                            <span className="text-[10px] text-[#5F6C7B] block">
                              Participantes
                            </span>
                            <span className="font-mono-tabular font-bold text-[#005CA9]">
                              {item.participantsCount} integrantes
                            </span>
                          </div>
                        </div>

                        {/* Linha 4: Botões Acessar (esquerda) e Compartilhar (direita) do mesmo tamanho */}
                        <div
                          className="grid grid-cols-2 gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (item.companyId && item.year === '2026') {
                                onSelectCompany(item.companyId);
                              } else {
                                setSelectedGroupItemId(item.id);
                              }
                            }}
                            className="h-9 px-3 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>Acessar</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await shareOrCopyPoolLink({
                                companyId: item.companyId || selectedCompanyId,
                                poolId: item.poolId,
                                title: item.title,
                                companyName: item.companyName,
                                useNativeShare: true,
                              });
                              onNotify?.(
                                `Link do bolão "${item.title}" compartilhado!`
                              );
                            }}
                            className="h-9 px-3 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Compartilhar</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          {/* =============================================================== */}
          {/* SEÇÃO: FAVORITOS (CARDS DE JOGOS FAVORITOS E DEZENAS FAVORITAS) */}
          {/* =============================================================== */}
          {activeSection === 'FAVORITOS' && (
            <section>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveSection('JOGOS_FAV')}
                  className="caixa-tile p-3 flex flex-col items-center justify-center text-center min-h-[96px] relative cursor-pointer"
                >
                  <div className="caixa-icon-halo mb-2">
                    <Star className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#1E293B] leading-tight">
                    Jogos Favoritos
                  </span>
                  <span className="text-[10px] text-[#5F6C7B] mt-0.5 leading-tight">
                    {userFavoriteGames.length} combinações
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('DEZENAS_FAV')}
                  className="caixa-tile p-3 flex flex-col items-center justify-center text-center min-h-[96px] relative cursor-pointer"
                >
                  <div className="caixa-icon-halo mb-2">
                    <Heart className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#1E293B] leading-tight">
                    Dezenas Favoritas
                  </span>
                  <span className="text-[10px] text-[#5F6C7B] mt-0.5 leading-tight">
                    {tempFavNumbers.length} números
                  </span>
                </button>
              </div>
            </section>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO: MINHAS DEZENAS FAVORITAS                                 */}
          {/* =============================================================== */}
          {activeSection === 'DEZENAS_FAV' && (
            <section className="caixa-card p-4 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2">
                {(['MEGA_SENA', 'LOTOFACIL', 'QUINA'] as LotteryType[]).map((lt) => (
                  <button
                    key={lt}
                    type="button"
                    onClick={() => {
                      setFavLotteryType(lt);
                      setTempFavNumbers(
                        currentUser.favoriteNumbers?.[lt] ||
                          LOTTERY_CONFIGS[lt].allTimeMostPlayed
                            .slice(0, 6)
                            .map((x) => x.number)
                      );
                    }}
                    className={`flex-1 h-8 rounded-[4px] text-[11px] font-bold cursor-pointer ${
                      favLotteryType === lt
                        ? 'bg-[#005CA9] text-white'
                        : 'bg-[#F1F5F9] text-[#5F6C7B]'
                    }`}
                  >
                    {LOTTERY_CONFIGS[lt].name}
                  </button>
                ))}
              </div>

              <p className="text-xs text-[#5F6C7B]">
                Toque nas dezenas abaixo para salvar seus números da sorte favoritos na{' '}
                <strong>{LOTTERY_CONFIGS[favLotteryType].name}</strong> (eles poderão ser usados automaticamente no Gerador de Palpites):
              </p>

              <div className="grid grid-cols-10 gap-1.5">
                {Array.from(
                  { length: LOTTERY_CONFIGS[favLotteryType].totalPoolNumbers },
                  (_, i) => i + 1
                ).map((num) => {
                  const isSelected = tempFavNumbers.includes(num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleToggleFavNumber(num)}
                      className={`h-7 rounded-[4px] font-mono-tabular text-[11px] font-bold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#005CA9] text-white'
                          : 'bg-[#F1F5F9] text-[#333E48] hover:bg-[#E2E8F0]'
                      }`}
                    >
                      {String(num).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#333E48]">
                  Selecionadas: {tempFavNumbers.length} dezenas
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSaveFavNumbers}
                    className="px-3.5 h-9 rounded-[4px] bg-[#005CA9] text-white text-xs font-bold cursor-pointer"
                  >
                    Salvar Favoritas
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSaveFavNumbers();
                      setGenLotteryType(favLotteryType);
                      setActiveSection('PALPITES');
                    }}
                    className="px-3 h-9 rounded-[4px] bg-[#008B47] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Usar no Gerador</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO: MEUS JOGOS FAVORITOS                                     */}
          {/* =============================================================== */}
          {activeSection === 'JOGOS_FAV' && (
            <section className="caixa-card p-4 space-y-4">
              {userFavoriteGames.length > 0 ? (
                <div className="p-3 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E2E8F0] pb-2">
                    {userFavoriteGames.map((fg, idx) => {
                      const safeFavIdx =
                        favGameTabIdx < userFavoriteGames.length ? favGameTabIdx : 0;
                      return (
                        <button
                          key={fg.id}
                          type="button"
                          onClick={() => setFavGameTabIdx(idx)}
                          className={`px-2.5 h-8 rounded-[4px] text-[10px] font-bold shrink-0 transition-colors cursor-pointer ${
                            safeFavIdx === idx
                              ? 'bg-[#005CA9] text-white'
                              : 'bg-white text-[#5F6C7B] border border-[#E2E8F0] hover:text-[#1E293B]'
                          }`}
                        >
                          Jogo {idx + 1} · {LOTTERY_CONFIGS[fg.lotteryType].name}
                        </button>
                      );
                    })}
                  </div>

                  {(() => {
                    const safeFavIdx =
                      favGameTabIdx < userFavoriteGames.length ? favGameTabIdx : 0;
                    const fg = userFavoriteGames[safeFavIdx];
                    if (!fg) return null;
                    return (
                      <div key={fg.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-[#005CA9]">
                              {LOTTERY_CONFIGS[fg.lotteryType].name} · {fg.numbers.length}{' '}
                              dezenas
                            </span>
                            <h4 className="text-xs font-bold text-[#1E293B]">
                              {fg.label}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await onCreateSuggestion({
                                  numbers: fg.numbers,
                                  rationale: `Jogo Favorito aplicado: ${fg.label}`,
                                });
                              }}
                              className="px-2.5 py-1 rounded-[4px] bg-[#008B47] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              Enviar ao Bolão
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFavoriteGame(fg.id)}
                              className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-[4px] cursor-pointer"
                              title="Remover jogo favorito"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {fg.numbers.map((n) => (
                            <span
                              key={n}
                              className="w-6 h-6 rounded-full bg-[#EBF4FC] text-[#005CA9] font-mono-tabular font-bold text-[11px] flex items-center justify-center"
                            >
                              {String(n).padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="py-6 text-center space-y-2.5">
                  <p className="text-xs text-[#5F6C7B]">
                    Nenhum jogo favorito salvo no momento. Gere e salve suas combinações pelo Gerador de Palpites.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('PALPITES');
                      setPalpitesActiveTab('GERADOR');
                    }}
                    className="px-4 h-9 rounded-[4px] bg-[#005CA9] text-white text-xs font-bold cursor-pointer"
                  >
                    Ir para o Gerador de Palpites
                  </button>
                </div>
              )}
            </section>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO: MEUS INVESTIMENTOS & JOGO RESPONSÁVEL                    */}
          {/* =============================================================== */}
          {activeSection === 'INVESTIMENTOS' && (
            <section className="caixa-card p-4 space-y-4">
              {isNearLimit ? (
                <div
                  className={`p-3 rounded-[4px] border text-xs ${
                    isOverLimit
                      ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                      : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {isOverLimit
                        ? 'Limite Mensal Atingido (100%)'
                        : `Alerta de Jogo Responsável: ${limitUsagePct}% do limite`}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Você investiu{' '}
                    <strong>{formatCurrencyBRL(currentMonthInvested)}</strong> neste
                    mês para um teto configurado de{' '}
                    <strong>{formatCurrencyBRL(monthlyLimit)}</strong>. Mantenha seus
                    aportes dentro do orçamento planejado.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-[4px] bg-[#F0FDF4] border border-[#BBF7D0] text-[#008B47] text-xs">
                  <div className="flex items-center gap-2 font-bold mb-0.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Consumo Consciente Dentro do Limite ({limitUsagePct}%)</span>
                  </div>
                  <p className="text-[11px]">
                    Seus investimentos estão abaixo do limiar de alerta de 80% do seu
                    teto mensal.
                  </p>
                </div>
              )}

              <div className="space-y-2 pb-3 border-b border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#1E293B]">
                  Definir Meu Teto Mensal de Gastos (R$)
                </label>
                <p className="text-[11px] text-[#5F6C7B]">
                  O aplicativo emitirá um alerta visual sempre que seus aportes no mês
                  ultrapassarem 80% deste valor.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={limitInput}
                    onChange={(e) => setLimitInput(maskCurrencyBRL(e.target.value))}
                    className="caixa-input font-mono-tabular font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleSaveMonthlyLimit}
                    className="px-4 h-10 rounded-[4px] bg-[#005CA9] text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  {[150, 250, 300, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLimitInput(numberToCurrencyMask(preset))}
                      className="flex-1 py-1 rounded-[4px] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[11px] font-mono-tabular font-semibold text-[#333E48] cursor-pointer"
                    >
                      {formatCurrencyBRL(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#1E293B]">
                    Extrato Anual de Investimentos
                  </h4>
                  <div className="flex items-center gap-1">
                    {(['2026', '2025', '2024'] as const).map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setSelectedYear(yr)}
                        className={`px-2 py-1 rounded-[3px] text-[11px] font-bold cursor-pointer ${
                          selectedYear === yr
                            ? 'bg-[#005CA9] text-white'
                            : 'bg-[#F1F5F9] text-[#5F6C7B]'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-[#F1F5F9] text-xs">
                  {filteredYearPools.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-[#1E293B] block">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-[#5F6C7B]">
                          {item.dateLabel} · {item.myQuotas} cota(s)
                        </span>
                      </div>
                      <div className="text-right font-mono-tabular">
                        <span className="font-bold text-[#1E293B] block">
                          {formatCurrencyBRL(item.myInvested)}
                        </span>
                        {item.prizeReceived > 0 && (
                          <span className="text-[10px] font-bold text-[#008B47]">
                            + {formatCurrencyBRL(item.prizeReceived)} prêmio
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="pt-3 flex items-center justify-between font-bold text-xs">
                    <span className="text-[#333E48]">
                      Total Investido em {selectedYear}
                    </span>
                    <span className="font-mono-tabular text-[#005CA9]">
                      {formatCurrencyBRL(
                        filteredYearPools.reduce((acc, i) => acc + i.myInvested, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO: ESTATÍSTICAS COMPLETAS (TODOS OS DADOS ESTATÍSTICOS)     */}
          {/* =============================================================== */}
          {activeSection === 'ESTATISTICAS' && currentStatsPool && (
            <section className="caixa-card p-4 space-y-3">
              {/* DIV ESPECÍFICA UNIFICADA DE ESTATÍSTICAS SEPARADA EM ABAS */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1.5 border-b border-[#E2E8F0] pb-2.5">
                  <button
                    type="button"
                    onClick={() => setStatsActiveTab('TERMOMETRO')}
                    className={`h-9 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                      statsActiveTab === 'TERMOMETRO'
                        ? 'bg-[#005CA9] text-white'
                        : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                    }`}
                  >
                    Quentes & Frias
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsActiveTab('SORTEIOS')}
                    className={`h-9 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                      statsActiveTab === 'SORTEIOS'
                        ? 'bg-[#005CA9] text-white'
                        : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                    }`}
                  >
                    Últimos 3 Sorteios
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsActiveTab('CHANCES')}
                    className={`h-9 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                      statsActiveTab === 'CHANCES'
                        ? 'bg-[#005CA9] text-white'
                        : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                    }`}
                  >
                    Chances & Probabilidades
                  </button>
                </div>

                {/* ABA 1: TERMÔMETRO DE DEZENAS QUENTES E FRIAS */}
                {statsActiveTab === 'TERMOMETRO' && (
                  <div className="p-3 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-[10px] font-bold text-[#005CA9] block">
                        TERMÔMETRO DE DEZENAS —{' '}
                        {LOTTERY_CONFIGS[currentStatsPool.lotteryType].name.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#D97706] mb-1.5">
                          <Flame className="w-3.5 h-3.5 text-[#D97706]" />
                          <span>Mais Quentes (Saíram +)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {lotteryStats.hotNumbers.slice(0, 8).map((item) => (
                            <div
                              key={item.number}
                              className="px-1.5 py-1 rounded-[4px] bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-mono-tabular text-[10px] font-bold flex items-center gap-1"
                            >
                              <span>{String(item.number).padStart(2, '0')}</span>
                              <span className="text-[9px] font-normal text-[#92400E]">
                                ({item.drawnCount}x)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#005CA9] mb-1.5">
                          <Snowflake className="w-3.5 h-3.5 text-[#005CA9]" />
                          <span>Mais Frias (Atrasadas)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {lotteryStats.coldNumbers.slice(0, 8).map((item) => (
                            <div
                              key={item.number}
                              className="px-1.5 py-1 rounded-[4px] bg-[#EBF4FC] border border-[#BFDBFE] text-[#005CA9] font-mono-tabular text-[10px] font-bold flex items-center gap-1"
                            >
                              <span>{String(item.number).padStart(2, '0')}</span>
                              <span className="text-[9px] font-normal text-[#1E40AF]">
                                ({item.drawnCount}x)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA 2: ÚLTIMOS 3 RESULTADOS SORTEADOS (COM SUB-ABAS POR CONCURSO) */}
                {statsActiveTab === 'SORTEIOS' && (
                  <div className="p-3 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <h4 className="text-xs font-bold text-[#1E293B]">
                        Últimos 3 Resultados Sorteados
                      </h4>
                      <span className="text-[10px] font-semibold text-[#005CA9]">
                        {LOTTERY_CONFIGS[currentStatsPool.lotteryType].name}
                      </span>
                    </div>

                    {(() => {
                      const contestsList = (
                        lotteryStats.recentContests || [lotteryStats.latestContest]
                      ).slice(0, 3);
                      const safeContestIdx =
                        recentContestTabIdx < contestsList.length
                          ? recentContestTabIdx
                          : 0;
                      const selectedContest =
                        contestsList[safeContestIdx] || lotteryStats.latestContest;

                      return (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-3 gap-1">
                            {contestsList.map((contest, idx) => (
                              <button
                                key={contest.contestNumber}
                                type="button"
                                onClick={() => setRecentContestTabIdx(idx)}
                                className={`h-8 rounded-[4px] text-[10px] font-bold font-mono-tabular transition-colors cursor-pointer ${
                                  safeContestIdx === idx
                                    ? 'bg-[#005CA9] text-white'
                                    : 'bg-white text-[#5F6C7B] border border-[#E2E8F0] hover:text-[#1E293B]'
                                }`}
                              >
                                Conc. #{contest.contestNumber}
                              </button>
                            ))}
                          </div>

                          <div className="p-2.5 rounded-[4px] bg-white border border-[#E2E8F0] space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-[#1E293B] font-mono-tabular">
                                {safeContestIdx === 0
                                  ? 'Último Sorteio'
                                  : `${safeContestIdx + 1}º Sorteio Anterior`}{' '}
                                · Conc. {selectedContest.contestNumber}
                              </span>
                              <span className="text-[10px] text-[#5F6C7B] font-mono-tabular">
                                {selectedContest.drawDate}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedContest.drawnNumbers.map((num) => (
                                <span
                                  key={num}
                                  className="w-7 h-7 rounded-full bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6] font-mono-tabular font-bold text-[11px] flex items-center justify-center"
                                >
                                  {String(num).padStart(2, '0')}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ABA 3: TABELA OFICIAL DE CHANCES MATEMÁTICAS */}
                {statsActiveTab === 'CHANCES' && (
                  <div className="p-3 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0] space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <h4 className="text-xs font-bold text-[#1E293B]">
                        Tabela de Chances Matemáticas —{' '}
                        {LOTTERY_CONFIGS[currentStatsPool.lotteryType].name}
                      </h4>
                      <span className="text-[10px] text-[#5F6C7B]">Referência Oficial</span>
                    </div>

                    <div className="divide-y divide-[#E2E8F0]">
                      {Object.entries(
                        LOTTERY_CONFIGS[currentStatsPool.lotteryType].priceTable
                      ).map(([dez, info]) => (
                        <div
                          key={dez}
                          className="py-2 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#333E48] block">
                              {dez} dezenas ({info.betsEquivalent}x apostas simples)
                            </span>
                            <span className="text-[11px] text-[#5F6C7B] font-mono-tabular">
                              Probabilidade: 1 em{' '}
                              {info.probabilityOneIn.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <span className="font-mono-tabular font-bold text-[#005CA9]">
                            {formatCurrencyBRL(info.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO: NOVO (BOLÕES RECÉM-CRIADOS / NOVIDADES DE BOLÕES)        */}
          {/* =============================================================== */}
          {activeSection === 'NOVO' && (
            <section className="caixa-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-[#008B47] block">
                    LANÇAMENTOS RECENTES · CAPTAÇÃO ABERTA
                  </span>
                  <h3 className="text-xs font-bold text-[#1E293B]">
                    Bolões Novos Recém-Criados
                  </h3>
                  <p className="text-[11px] text-[#5F6C7B]">
                    Acompanhe as novidades de grupos e bolões criados recentemente na plataforma:
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#E2E8F0]">
                {[
                  ...activeCompaniesPools.map((pool, idx) => {
                    const comp = companies.find((c) => c.id === pool.companyId);
                    const poolPurchases = purchases.filter(
                      (pur) => pur.poolId === pool.id && pur.paymentStatus === 'CONFIRMED'
                    );
                    const totalRaised = poolPurchases.reduce(
                      (acc, pur) => acc + pur.totalAmount,
                      0
                    );
                    const quotasSold = poolPurchases.reduce(
                      (acc, pur) => acc + pur.quotasCount,
                      0
                    );
                    const totalQuotas = Math.max(
                      1,
                      Math.round(pool.maxTargetAmount / Math.max(1, pool.quotaValue))
                    );
                    return {
                      id: pool.id,
                      poolId: pool.id,
                      companyId: comp?.id,
                      title: pool.title,
                      companyName: comp?.name || currentUser.companyName,
                      managerName: comp?.managerName || 'Gestor do Grupo',
                      lotteryType: pool.lotteryType,
                      contestNumber: pool.contestNumber,
                      quotaValue: pool.quotaValue,
                      totalRaised,
                      maxTargetAmount: pool.maxTargetAmount,
                      availableQuotas: Math.max(2, totalQuotas - quotasSold),
                      createdLabel: idx === 0 ? 'Criado hoje · Há 2 horas' : 'Criado ontem',
                    };
                  }),
                  {
                    id: 'novo_especial_virada',
                    poolId: activeCompaniesPools[0]?.id,
                    companyId: companies[0]?.id,
                    title: 'Bolão Especial Mega-Sena Acumulada — Fechamento 10 Dezenas',
                    companyName: companies[0]?.name || currentUser.companyName,
                    managerName: companies[0]?.managerName || 'Gestor Corporativo',
                    lotteryType: 'MEGA_SENA' as LotteryType,
                    contestNumber: '2805',
                    quotaValue: 150.0,
                    totalRaised: 1800.0,
                    maxTargetAmount: 6000.0,
                    availableQuotas: 28,
                    createdLabel: 'Recém-criado · Há 35 min',
                  },
                ].map((novoPool) => {
                  const progressPct = Math.min(
                    100,
                    Math.round(
                      (novoPool.totalRaised / Math.max(1, novoPool.maxTargetAmount)) * 100
                    )
                  );
                  return (
                    <div key={novoPool.id} className="py-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-1.5 py-0.5 rounded-[3px] bg-[#DCFCE7] text-[#008B47] text-[9px] font-extrabold">
                              NOVO
                            </span>
                            <span className="text-[10px] font-bold text-[#005CA9]">
                              {LOTTERY_CONFIGS[novoPool.lotteryType].name} · Conc.{' '}
                              {novoPool.contestNumber}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-[#1E293B]">
                            {novoPool.title}
                          </h4>
                          <p className="text-[11px] text-[#5F6C7B]">
                            {novoPool.companyName} · Resp.: {novoPool.managerName}
                          </p>
                        </div>

                        <span className="text-[10px] font-semibold text-[#008B47] shrink-0">
                          {novoPool.createdLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] border-t border-[#F1F5F9]">
                        <div>
                          <span className="text-[#5F6C7B] block">Valor da Cota</span>
                          <span className="font-mono-tabular font-bold text-[#1E293B]">
                            {formatCurrencyBRL(novoPool.quotaValue)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5F6C7B] block">Cotas Livres</span>
                          <span className="font-mono-tabular font-bold text-[#005CA9]">
                            {novoPool.availableQuotas} disponíveis
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5F6C7B] block">Captação</span>
                          <span className="font-mono-tabular font-bold text-[#008B47]">
                            {progressPct}% ({formatCurrencyBRL(novoPool.totalRaised)})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setGenLotteryType(novoPool.lotteryType);
                            setActiveSection('PALPITES');
                          }}
                          className="flex-1 h-8 rounded-[4px] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#333E48] text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Wand2 className="w-3.5 h-3.5 text-[#008B47]" />
                          <span>Gerar Palpite</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (novoPool.companyId) {
                              onSelectCompany(novoPool.companyId);
                            }
                          }}
                          className="flex-1 h-8 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>Acessar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN MEU ESPAÇO DASHBOARD (WHEN NO FULL-SCREEN SECTION IS ACTIVE)
  // =========================================================================
  return (
    <div className="px-4 py-4 space-y-4">
      {/* 3x3 GRID OF SERVICE CARDS (OPENS FULL-SCREEN SECTIONS) */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-[#333E48] tracking-tight">
            MEU ESPAÇO BV-MEGA DA VIRADA
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {serviceGridItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`caixa-tile p-3 flex flex-col items-center justify-center text-center min-h-[96px] relative cursor-pointer ${
                item.highlight ? 'border-[#008B47]/40 bg-[#F0FDF4]/40' : ''
              }`}
            >
              {item.badgeAlert && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] bg-[#FEF3C7] text-[#B45309]">
                  80%+
                </span>
              )}
              <div
                className={`caixa-icon-halo mb-2 ${
                  item.highlight ? 'bg-[#DCFCE7] text-[#008B47]' : ''
                }`}
              >
                {item.icon}
              </div>
              <span className="text-[11px] font-bold text-[#1E293B] leading-tight">
                {item.title}
              </span>
              <span className="text-[10px] text-[#5F6C7B] mt-0.5 leading-tight">
                {item.subtitle}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
