import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  EffectiveGame,
  EffectiveGameStatus,
} from '../types';
import {
  ALL_LOTTERY_TYPES,
  LOTTERY_CONFIGS,
  formatCurrencyBRL,
  maskCpf,
  maskName,
  calculateCompanyMostPlayedNumbers,
  getDefaultLotteryStats,
  generateCustomUserPalpites,
  evaluatePrizeTier,
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
  ChevronUp,
  Ban,
  Pin,
  ThumbsUp,
  Link2,
  Printer,
  UserCheck,
  Clover,
  MessageSquare,
  X,
} from 'lucide-react';

export type ModalTopic =
  | 'INICIO'
  | 'PERFIL'
  | 'GRUPOS'
  | 'FAVORITOS'
  | 'NOVO'
  | 'PALPITES'
  | 'MEUS_JOGOS'
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
  onOpenPromoter?: (preset?: {
    lotteryType: LotteryType;
    contestMode: 'REGULAR' | 'SPECIAL';
  }) => void;
  onOpenPersonalPrint?: (payload: {
    lotteryType: LotteryType;
    title: string;
    games: LotteryGame[];
  }) => void;
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
  isParticipating?: boolean;
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
  onOpenPromoter,
  onOpenPersonalPrint,
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
  const initialCachedLottery: LotteryType = (() => {
    try {
      const saved = localStorage.getItem('bvmega_last_gen_lottery');
      if (
        saved &&
        (saved === 'MEGA_SENA' ||
          saved === 'LOTOFACIL' ||
          saved === 'QUINA' ||
          saved === 'LOTOMANIA' ||
          saved === 'TIMEMANIA' ||
          saved === 'DUPLA_SENA' ||
          saved === 'DIA_DE_SORTE' ||
          saved === 'MAIS_MILIONARIA')
      ) {
        return saved as LotteryType;
      }
    } catch {}
    return 'MEGA_SENA';
  })();

  const initialGenCache = (() => {
    try {
      const raw = localStorage.getItem(`bvmega_gen_cache_${initialCachedLottery}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  })();

  const [genLotteryType, setGenLotteryType] = useState<LotteryType>(initialCachedLottery);
  const [isLotteryMenuOpen, setIsLotteryMenuOpen] = useState<boolean>(false);
  const [jogosMainCard, setJogosMainCard] = useState<'MEUS_JOGOS' | 'CRIAR_JOGOS'>('MEUS_JOGOS');
  const [meusJogosSelectedLottery, setMeusJogosSelectedLottery] = useState<LotteryType | null>(
    null
  );
  const [meusJogosContestMode, setMeusJogosContestMode] = useState<
    'REGULAR' | 'SPECIAL' | null
  >(null);
  const [isGeneratorToolOpen, setIsGeneratorToolOpen] = useState<boolean>(false);
  const [isAddFavLotteryOpen, setIsAddFavLotteryOpen] = useState<boolean>(false);
  const [jogosSubTab, setJogosSubTab] = useState<'CRIAR' | 'REALIZADOS' | 'CONFERIDOR'>(
    'REALIZADOS'
  );
  const [realizadosFilter, setRealizadosFilter] = useState<'A_FAZER' | 'FEITO'>('A_FAZER');
  const [conferidorMode, setConferidorMode] = useState<'AUTOMATICA' | 'MANUAL'>('AUTOMATICA');
  const [manualDrawnByLottery, setManualDrawnByLottery] = useState<
    Partial<Record<LotteryType, number[]>>
  >({});
  const [effectivePalpiteIds, setEffectivePalpiteIds] = useState<Record<string, boolean>>({});
  const [genContestMode, setGenContestMode] = useState<'REGULAR' | 'SPECIAL'>('REGULAR');
  const [boloesFilter, setBoloesFilter] = useState<'PARTICIPO' | 'ANTERIORES'>('PARTICIPO');
  const [genDozensCount, setGenDozensCount] = useState<number>(
    initialGenCache?.dozensCount ?? LOTTERY_CONFIGS[initialCachedLottery].minNumbers
  );
  const [genGamesCount, setGenGamesCount] = useState<number>(
    initialGenCache?.gamesCount ?? 3
  );
  const [genSelectedFavNumbers, setGenSelectedFavNumbers] = useState<number[]>(
    initialGenCache?.selectedFavNumbers ?? []
  );
  const [genStep1Fixed, setGenStep1Fixed] = useState<number[]>(
    initialGenCache?.step1Fixed ?? []
  );
  const [genStep1Excluded, setGenStep1Excluded] = useState<number[]>(
    initialGenCache?.step1Excluded ?? []
  );
  const [genStep1Pending, setGenStep1Pending] = useState<number[]>([]);
  const [genFixedNumbers, setGenFixedNumbers] = useState<number[]>(
    initialGenCache?.fixedNumbers ?? []
  );
  const [genExcludedNumbers, setGenExcludedNumbers] = useState<number[]>(
    initialGenCache?.excludedNumbers ?? []
  );
  const [genStep3Pending, setGenStep3Pending] = useState<number[]>([]);
  const [genBalanceParity, setGenBalanceParity] = useState<boolean>(
    initialGenCache?.balanceParity ?? true
  );
  const [genSwipeStep, setGenSwipeStep] = useState<number>(
    initialGenCache?.swipeStep ?? 0
  );
  const swipeContainerRef = useRef<HTMLDivElement | null>(null);
  const generatedResultsRef = useRef<HTMLDivElement | null>(null);
  const [genMixPreset, setGenMixPreset] = useState<
    'BALANCED' | 'HOT_FOCUS' | 'COLD_FOCUS' | 'PURE_RANDOM' | 'CUSTOM'
  >(initialGenCache?.mixPreset ?? 'BALANCED');
  const [genHotPercentage, setGenHotPercentage] = useState<number>(
    initialGenCache?.hotPercentage ?? 50
  );
  const [lotteryStats, setLotteryStats] = useState<LotteryStatsResponse>(() =>
    getDefaultLotteryStats(initialCachedLottery)
  );
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [generatedPalpites, setGeneratedPalpites] = useState<GeneratedPalpiteItem[]>(() => {
    try {
      const saved = localStorage.getItem('bvmega_generated_palpites');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sentPalpiteIds, setSentPalpiteIds] = useState<Record<string, boolean>>({});
  const [savedPalpiteIds, setSavedPalpiteIds] = useState<Record<string, boolean>>({});
  const [shareGameModal, setShareGameModal] = useState<{
    game: EffectiveGame;
    index: number;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const poolFriends = useMemo(() => {
    return participants
      .filter((p) => (p.cpf && p.cpf !== currentUser.cpf) || (p.name && p.name.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()))
      .slice(0, 10);
  }, [participants, currentUser.cpf, currentUser.name]);

  const scrollToSwipeStep = (stepIdx: number) => {
    const clamped = Math.max(0, Math.min(4, stepIdx));
    setGenSwipeStep(clamped);
    const container = swipeContainerRef.current;
    if (container) {
      const cardEl = container.children[clamped] as HTMLElement | undefined;
      if (cardEl) {
        container.scrollTo({
          left: cardEl.offsetLeft - container.offsetLeft,
          behavior: 'smooth',
        });
      }
    }
  };

  const handlePrintPersonalGames = (
    itemsToPrint: { id: string; numbers: number[]; cost?: number }[],
    lt: LotteryType,
    title: string
  ) => {
    if (!onOpenPersonalPrint || itemsToPrint.length === 0) return;
    const cfg = LOTTERY_CONFIGS[lt];
    const mappedGames: LotteryGame[] = itemsToPrint.map((g, idx) => {
      const pInfo = cfg.priceTable[g.numbers.length] || cfg.priceTable[cfg.minNumbers];
      return {
        id: g.id || `pers_${idx}`,
        poolId: 'personal_pool',
        companyId: 'personal_comp',
        lotteryType: lt,
        gameMode: g.numbers.length > cfg.minNumbers ? 'DESDOBRAMENTO' : 'SIMPLES',
        numbers: g.numbers,
        dozensCount: g.numbers.length,
        cost: g.cost ?? pInfo?.price ?? cfg.baseSimpleBetPrice,
        equivalentSimpleBets: pInfo?.betsEquivalent ?? 1,
        lotericaReceiptCode: `PERS-${idx + 1}`,
        registeredAt: new Date().toISOString(),
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatarInitials,
      };
    });
    onOpenPersonalPrint({
      lotteryType: lt,
      games: mappedGames,
      title,
    });
  };

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

  const prevLotteryRef = useRef<LotteryType>(initialCachedLottery);

  useEffect(() => {
    const isSwitching = prevLotteryRef.current !== genLotteryType;
    prevLotteryRef.current = genLotteryType;

    const nextStats = getDefaultLotteryStats(genLotteryType);
    setLotteryStats(nextStats);
    fetchLotteryStatsFromApi(genLotteryType);
    setGenStep1Pending([]);
    setGenStep3Pending([]);
    setRecentContestTabIdx(0);

    if (isSwitching) {
      const cfg = LOTTERY_CONFIGS[genLotteryType];
      try {
        const raw = localStorage.getItem(`bvmega_gen_cache_${genLotteryType}`);
        if (raw) {
          const cached = JSON.parse(raw);
          setGenDozensCount(typeof cached.dozensCount === 'number' ? cached.dozensCount : cfg.minNumbers);
          if (typeof cached.gamesCount === 'number') setGenGamesCount(cached.gamesCount);
          setGenStep1Fixed(Array.isArray(cached.step1Fixed) ? cached.step1Fixed : []);
          setGenStep1Excluded(Array.isArray(cached.step1Excluded) ? cached.step1Excluded : []);
          setGenSelectedFavNumbers(Array.isArray(cached.selectedFavNumbers) ? cached.selectedFavNumbers : []);
          setGenFixedNumbers(Array.isArray(cached.fixedNumbers) ? cached.fixedNumbers : []);
          setGenExcludedNumbers(Array.isArray(cached.excludedNumbers) ? cached.excludedNumbers : []);
          if (cached.mixPreset) setGenMixPreset(cached.mixPreset);
          if (typeof cached.hotPercentage === 'number') setGenHotPercentage(cached.hotPercentage);
          if (typeof cached.balanceParity === 'boolean') setGenBalanceParity(cached.balanceParity);
          if (typeof cached.swipeStep === 'number') setGenSwipeStep(cached.swipeStep);
        } else {
          setGenDozensCount(cfg.minNumbers);
          setGenStep1Fixed([]);
          setGenStep1Excluded([]);
          setGenSelectedFavNumbers([]);
          setGenFixedNumbers([]);
          setGenExcludedNumbers([]);
          setGenSwipeStep(0);
        }
      } catch {
        setGenDozensCount(cfg.minNumbers);
        setGenStep1Fixed([]);
        setGenStep1Excluded([]);
        setGenSelectedFavNumbers([]);
        setGenFixedNumbers([]);
        setGenExcludedNumbers([]);
        setGenSwipeStep(0);
      }
    }
  }, [genLotteryType]);

  // Persistência automática das decisões do gerador no cache local (offline resilience)
  useEffect(() => {
    try {
      const cacheData = {
        dozensCount: genDozensCount,
        gamesCount: genGamesCount,
        step1Fixed: genStep1Fixed,
        step1Excluded: genStep1Excluded,
        selectedFavNumbers: genSelectedFavNumbers,
        fixedNumbers: genFixedNumbers,
        excludedNumbers: genExcludedNumbers,
        mixPreset: genMixPreset,
        hotPercentage: genHotPercentage,
        balanceParity: genBalanceParity,
        swipeStep: genSwipeStep,
      };
      localStorage.setItem(`bvmega_gen_cache_${genLotteryType}`, JSON.stringify(cacheData));
      localStorage.setItem('bvmega_last_gen_lottery', genLotteryType);
    } catch {}
  }, [
    genLotteryType,
    genDozensCount,
    genGamesCount,
    genStep1Fixed,
    genStep1Excluded,
    genSelectedFavNumbers,
    genFixedNumbers,
    genExcludedNumbers,
    genMixPreset,
    genHotPercentage,
    genBalanceParity,
    genSwipeStep,
  ]);

  // Persistência automática dos jogos gerados confeccionados
  useEffect(() => {
    try {
      localStorage.setItem('bvmega_generated_palpites', JSON.stringify(generatedPalpites));
    } catch {}
  }, [generatedPalpites]);

  // Saved Favorite Numbers for the currently selected generator lottery
  const currentGenFavNumbers = useMemo(() => {
    const saved = currentUser.favoriteNumbers?.[genLotteryType];
    if (saved && saved.length > 0) return saved;
    if (genLotteryType === favLotteryType && tempFavNumbers.length > 0) return tempFavNumbers;
    const sourceList =
      genContestMode === 'SPECIAL'
        ? LOTTERY_CONFIGS[genLotteryType].specialContestMostPlayed
        : LOTTERY_CONFIGS[genLotteryType].allTimeMostPlayed;
    return sourceList.slice(0, 4).map((x) => x.number);
  }, [currentUser.favoriteNumbers, genLotteryType, genContestMode, favLotteryType, tempFavNumbers]);

  useEffect(() => {
    setGenSelectedFavNumbers((prev) =>
      prev.filter((n) => !genStep1Excluded.includes(n))
    );
  }, [genStep1Excluded]);

  const handleToggleStep1Number = (num: number) => {
    if (genStep1Fixed.includes(num)) {
      setGenStep1Fixed((prev) => prev.filter((n) => n !== num));
      return;
    }
    if (genStep1Excluded.includes(num)) {
      setGenStep1Excluded((prev) => prev.filter((n) => n !== num));
      return;
    }
    setGenStep1Pending((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b)
    );
  };

  const handleApplyStep1Action = (action: 'FIX' | 'EXCLUDE') => {
    if (genStep1Pending.length === 0) return;
    const cfg = LOTTERY_CONFIGS[genLotteryType];
    if (action === 'FIX') {
      setGenStep1Excluded((prev) => prev.filter((n) => !genStep1Pending.includes(n)));
      setGenStep1Fixed((prev) => {
        const combined = Array.from(new Set([...prev, ...genStep1Pending]));
        if (combined.length > genDozensCount) {
          onNotify?.(
            `Você pode reaproveitar até ${genDozensCount} dezenas para um jogo de ${genDozensCount} dezenas.`
          );
          return combined.slice(0, genDozensCount).sort((a, b) => a - b);
        }
        return combined.sort((a, b) => a - b);
      });
    } else {
      setGenStep1Fixed((prev) => prev.filter((n) => !genStep1Pending.includes(n)));
      const maxExcludable = cfg.totalPoolNumbers - genDozensCount - 2;
      setGenStep1Excluded((prev) => {
        const combined = Array.from(new Set([...prev, ...genStep1Pending]));
        return combined.slice(0, maxExcludable).sort((a, b) => a - b);
      });
    }
    setGenStep1Pending([]);
  };

  const handleToggleStep3Number = (num: number) => {
    if (genFixedNumbers.includes(num)) {
      setGenFixedNumbers((prev) => prev.filter((n) => n !== num));
      return;
    }
    if (genStep1Fixed.includes(num)) {
      setGenStep1Fixed((prev) => prev.filter((n) => n !== num));
      return;
    }
    if (genSelectedFavNumbers.includes(num)) {
      setGenSelectedFavNumbers((prev) => prev.filter((n) => n !== num));
      return;
    }
    if (genExcludedNumbers.includes(num)) {
      setGenExcludedNumbers((prev) => prev.filter((n) => n !== num));
      return;
    }
    if (genStep1Excluded.includes(num)) {
      setGenStep1Excluded((prev) => prev.filter((n) => n !== num));
      return;
    }
    setGenStep3Pending((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b)
    );
  };

  const handleApplyStep3Action = (action: 'FIX' | 'EXCLUDE') => {
    if (genStep3Pending.length === 0) return;
    const cfg = LOTTERY_CONFIGS[genLotteryType];
    if (action === 'FIX') {
      setGenExcludedNumbers((prev) => prev.filter((n) => !genStep3Pending.includes(n)));
      setGenStep1Excluded((prev) => prev.filter((n) => !genStep3Pending.includes(n)));
      setGenFixedNumbers((prev) => {
        const combined = Array.from(new Set([...prev, ...genStep3Pending]));
        const totalFixedCount = new Set([...genStep1Fixed, ...combined, ...genSelectedFavNumbers]).size;
        if (totalFixedCount > genDozensCount) {
          onNotify?.(
            `Você já selecionou ${genDozensCount} dezenas para um jogo de ${genDozensCount} dezenas.`
          );
          return combined.slice(0, genDozensCount).sort((a, b) => a - b);
        }
        return combined.sort((a, b) => a - b);
      });
    } else {
      setGenFixedNumbers((prev) => prev.filter((n) => !genStep3Pending.includes(n)));
      setGenStep1Fixed((prev) => prev.filter((n) => !genStep3Pending.includes(n)));
      setGenSelectedFavNumbers((prev) => prev.filter((n) => !genStep3Pending.includes(n)));
      const maxExcludable = cfg.totalPoolNumbers - genDozensCount - 2;
      setGenExcludedNumbers((prev) => {
        const combined = Array.from(new Set([...prev, ...genStep3Pending]));
        return combined.slice(0, maxExcludable).sort((a, b) => a - b);
      });
    }
    setGenStep3Pending([]);
  };

  const handleExecuteGenerator = () => {
    const combinedFixed = Array.from(new Set([...genStep1Fixed, ...genFixedNumbers]))
      .slice(0, genDozensCount)
      .sort((a, b) => a - b);
    const combinedExcluded = Array.from(
      new Set([...genStep1Excluded, ...genExcludedNumbers])
    ).filter((n) => !combinedFixed.includes(n));
    const activeFavs = genSelectedFavNumbers.filter(
      (n) => !combinedExcluded.includes(n) && !combinedFixed.includes(n)
    );

    const rawItems = generateCustomUserPalpites({
      lotteryType: genLotteryType,
      dozensCount: genDozensCount,
      gamesCount: genGamesCount,
      useFavorites: activeFavs.length > 0,
      favoriteNumbers: activeFavs,
      fixedNumbers: combinedFixed,
      excludedNumbers: combinedExcluded,
      hotPercentage: genHotPercentage,
      isPureRandom: genMixPreset === 'PURE_RANDOM',
      stats: lotteryStats,
    });

    // If parity balance is enabled, refine extreme all-even/all-odd combinations using available remaining pool
    const cfg = LOTTERY_CONFIGS[genLotteryType];
    const lockedSet = new Set([...combinedFixed, ...activeFavs]);
    const availablePool = Array.from({ length: cfg.totalPoolNumbers }, (_, i) => i + 1).filter(
      (n) => !combinedExcluded.includes(n) && !lockedSet.has(n)
    );

    const items = genBalanceParity
      ? rawItems.map((item) => {
          const nums = [...item.numbers];
          const evens = nums.filter((n) => n % 2 === 0).length;
          const targetEvenMin = Math.max(1, Math.floor(genDozensCount * 0.33));
          const targetEvenMax = Math.min(genDozensCount - 1, Math.ceil(genDozensCount * 0.67));
          if (evens < targetEvenMin || evens > targetEvenMax) {
            const needEven = evens < targetEvenMin;
            const replaceableIdx = nums.findIndex(
              (n) => !lockedSet.has(n) && (needEven ? n % 2 !== 0 : n % 2 === 0)
            );
            const candidate = availablePool.find(
              (n) => !nums.includes(n) && (needEven ? n % 2 === 0 : n % 2 !== 0)
            );
            if (replaceableIdx !== -1 && candidate !== undefined) {
              nums[replaceableIdx] = candidate;
              nums.sort((a, b) => a - b);
            }
          }
          return { ...item, numbers: nums };
        })
      : rawItems;

    setGeneratedPalpites((prev) => [...items, ...prev]);
    onNotify?.(
      `${items.length} novo(s) jogo(s) gerado(s) para a ${LOTTERY_CONFIGS[genLotteryType].name}! Escolha abaixo onde deseja salvá-los.`
    );
    setTimeout(() => {
      generatedResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
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

  const handleSaveEffectiveToFavorites = async (game: EffectiveGame, idx?: number) => {
    const isAlready = userFavoriteGames.some(
      (f) =>
        f.lotteryType === game.lotteryType &&
        f.numbers.length === game.numbers.length &&
        f.numbers.every((n, i) => n === game.numbers[i])
    );
    if (isAlready) {
      onNotify?.('Este jogo já está salvo nos seus Favoritos!');
      return;
    }
    const newEntry: FavoriteGame = {
      id: `fav_eff_${Date.now().toString(36)}_${game.id}`,
      label: game.label || `Jogo ${LOTTERY_CONFIGS[game.lotteryType].name}${idx !== undefined ? ` #${idx + 1}` : ''}`,
      lotteryType: game.lotteryType,
      numbers: game.numbers,
      createdAt: new Date().toISOString(),
    };
    await onUpdateUser({ favoriteGames: [newEntry, ...userFavoriteGames] });
    onNotify?.('Jogo salvo em Meus Jogos Favoritos!');
  };

  const handleSendEffectiveToPool = async (game: EffectiveGame) => {
    await onCreateSuggestion({
      numbers: game.numbers,
      rationale: `Jogo Realizado (${game.label || LOTTERY_CONFIGS[game.lotteryType].name})`,
    });
    setSentPalpiteIds((prev) => ({ ...prev, [game.id]: true }));
    onNotify?.('Jogo enviado para o Bolão com sucesso!');
  };

  const handleShareGameToPool = async (game: EffectiveGame) => {
    await handleSendEffectiveToPool(game);
    setShareGameModal(null);
  };

  const handleShareGameWhatsApp = (game: EffectiveGame) => {
    const lotName = LOTTERY_CONFIGS[game.lotteryType].name;
    const numStr = game.numbers.map((n) => String(n).padStart(2, '0')).join(' - ');
    const text = `🍀 *Jogo BV-Mega da Virada* · ${lotName}\nConcurso: ${game.contestNumber}\nDezenas: [ ${numStr} ]\nValor: ${formatCurrencyBRL(game.cost)}\nBoa sorte para nós!`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {}
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    onNotify?.('Abrindo WhatsApp e mensagem copiada!');
    setShareGameModal(null);
  };

  const handleShareGameToFriend = async (game: EffectiveGame, friendName: string) => {
    const lotName = LOTTERY_CONFIGS[game.lotteryType].name;
    const numStr = game.numbers.map((n) => String(n).padStart(2, '0')).join(' - ');
    const text = `Olá ${friendName}! Segue meu jogo da ${lotName} (Conc. ${game.contestNumber}): [ ${numStr} ]`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {}
    onNotify?.(`Jogo compartilhado com ${friendName}! Mensagem copiada.`);
    setShareGameModal(null);
  };

  const handleCopyEffectiveGame = async (game: EffectiveGame, idx?: number) => {
    const formattedNums = game.numbers.map((n) => String(n).padStart(2, '0')).join(' - ');
    const text = `BV-Mega da Virada · ${game.label || `Jogo ${LOTTERY_CONFIGS[game.lotteryType].name}`}${
      idx !== undefined ? ` #${idx + 1}` : ''
    }: [ ${formattedNums} ]`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(game.id);
      setTimeout(() => setCopiedId((prev) => (prev === game.id ? null : prev)), 2500);
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

  const [removedGroupIds, setRemovedGroupIds] = useState<string[]>([]);

  // Multi-year groups/pools history (2026 live + 2025/2024 historical corporate records)
  const allYearPools: HistoricalPoolSummary[] = useMemo(() => {
    const poolsToInclude =
      activeCompaniesPools.length > 0 ? activeCompaniesPools : pools;

    const live2026: HistoricalPoolSummary[] = poolsToInclude.map((pool) => {
      const comp = companies.find((c) => c.id === pool.companyId) || companies[0];
      const poolPurchases = purchases.filter(
        (pur) => pur.poolId === pool.id && pur.paymentStatus === 'CONFIRMED'
      );
      const totalRaised = poolPurchases.reduce((acc, pur) => acc + pur.totalAmount, 0);
      const userPur = myPurchases.filter((pur) => pur.poolId === pool.id);
      const compParts = participants.filter((part) => part.companyId === pool.companyId);
      const isParticipantRecord = compParts.some(
        (pt) =>
          pt.cpf.replace(/\D/g, '') === cleanUserCpf ||
          pt.email.toLowerCase() === currentUser.email.toLowerCase() ||
          pt.name.toLowerCase() === currentUser.name.toLowerCase()
      );
      const isManagerRecord =
        comp?.managerName?.toLowerCase() === currentUser.name.toLowerCase();
      const isCompanyMember = Boolean(
        currentUser.companyId && comp?.id === currentUser.companyId
      );
      const isParticipating =
        userPur.length > 0 || isParticipantRecord || isManagerRecord || isCompanyMember;

      const userQuotas = userPur.reduce((acc, pur) => acc + pur.quotasCount, 0);
      const userSpent = userPur.reduce((acc, pur) => acc + pur.totalAmount, 0);
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
            ? 'Aberto'
            : 'Sorteado',
        myQuotas: userQuotas,
        myInvested: userSpent,
        poolTotalRaised: totalRaised,
        maxTargetAmount: pool.maxTargetAmount,
        participantsCount: compParts.length || 10,
        prizeReceived: 0,
        dateLabel: '31/12/26',
        isParticipating,
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

  const userFavoriteLotteries: LotteryType[] = useMemo(() => {
    if (currentUser.favoriteLotteries && currentUser.favoriteLotteries.length > 0) {
      return currentUser.favoriteLotteries;
    }
    return ['MEGA_SENA'];
  }, [currentUser.favoriteLotteries]);

  const handleAddFavoriteLottery = async (lt: LotteryType) => {
    if (userFavoriteLotteries.includes(lt)) {
      setIsAddFavLotteryOpen(false);
      return;
    }
    const nextLotteries = [...userFavoriteLotteries, lt];
    await onUpdateUser({ favoriteLotteries: nextLotteries });
    setIsAddFavLotteryOpen(false);
    onNotify?.(`${LOTTERY_CONFIGS[lt].name} adicionada aos seus cards em Meus Jogos!`);
  };

  const handleRemoveFavoriteLottery = async (lt: LotteryType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userFavoriteLotteries.length <= 1) {
      onNotify?.('Mantenha pelo menos uma loteria favorita em Meus Jogos.');
      return;
    }
    const nextLotteries = userFavoriteLotteries.filter((item) => item !== lt);
    await onUpdateUser({ favoriteLotteries: nextLotteries });
    onNotify?.(`${LOTTERY_CONFIGS[lt].name} removida de Meus Jogos.`);
  };

  const getModalityDisplayName = (lt: LotteryType, mode: 'REGULAR' | 'SPECIAL') => {
    if (lt === 'MEGA_SENA') {
      return mode === 'SPECIAL' ? 'Mega-Sena da Virada' : 'Mega-Sena Comum';
    }
    return mode === 'SPECIAL'
      ? LOTTERY_CONFIGS[lt].specialContestName
      : `${LOTTERY_CONFIGS[lt].name} Comum`;
  };

  const userEffectiveGames: EffectiveGame[] = useMemo(() => {
    if (currentUser.effectiveGames !== undefined) {
      return currentUser.effectiveGames;
    }
    return [
      {
        id: 'eff_default_1',
        label: 'Jogo #01 — Mega-Sena Comum',
        lotteryType: 'MEGA_SENA',
        contestMode: 'REGULAR',
        numbers: [4, 10, 23, 34, 38, 53],
        cost: 5.0,
        status: 'FEITO',
        contestNumber: '2949',
        createdAt: '2026-11-08T14:20:00Z',
      },
      {
        id: 'eff_default_2',
        label: 'Jogo #02 — Mega-Sena da Virada',
        lotteryType: 'MEGA_SENA',
        contestMode: 'SPECIAL',
        numbers: [5, 10, 17, 29, 37, 58],
        cost: 5.0,
        status: 'A_FAZER',
        contestNumber: '2955',
        createdAt: '2026-11-08T16:10:00Z',
      },
      {
        id: 'eff_default_3',
        label: 'Jogo #01 — Lotofácil Comum',
        lotteryType: 'LOTOFACIL',
        contestMode: 'REGULAR',
        numbers: [1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 25],
        cost: 3.0,
        status: 'FEITO',
        contestNumber: '3348',
        createdAt: '2026-11-08T17:00:00Z',
      },
    ];
  }, [currentUser.effectiveGames]);

  const handleEfetivarPalpite = async (item: GeneratedPalpiteItem, idx: number) => {
    const cfg = LOTTERY_CONFIGS[item.lotteryType];
    const pInfo = cfg.priceTable[item.numbers.length] || cfg.priceTable[cfg.minNumbers];
    const cost = item.cost || pInfo?.price || cfg.baseSimpleBetPrice;
    const contestNum = lotteryStats.latestContest?.contestNumber || '2949';
    const modName = getModalityDisplayName(item.lotteryType, genContestMode);

    const newEff: EffectiveGame = {
      id: `eff_${Date.now().toString(36)}_${idx}`,
      label: `Jogo ${modName} (${item.numbers.length} DZ)`,
      lotteryType: item.lotteryType,
      contestMode: genContestMode,
      numbers: item.numbers,
      cost,
      status: 'A_FAZER',
      contestNumber: contestNum,
      createdAt: new Date().toISOString(),
    };

    const nextList = [newEff, ...userEffectiveGames];
    if (!userFavoriteLotteries.includes(item.lotteryType)) {
      await onUpdateUser({
        effectiveGames: nextList,
        favoriteLotteries: [...userFavoriteLotteries, item.lotteryType],
      });
    } else {
      await onUpdateUser({ effectiveGames: nextList });
    }
    setEffectivePalpiteIds((prev) => ({ ...prev, [item.id]: true }));
    // Remove o jogo da lista de Jogos Confeccionados assim que adicionado a Meus Jogos
    setGeneratedPalpites((prev) => prev.filter((p) => p.id !== item.id));
    setRealizadosFilter('A_FAZER');
    onNotify?.(`Jogo adicionado a Meus Jogos (${modName})!`);
  };

  const handleEfetivarAllPalpites = async (items: GeneratedPalpiteItem[]) => {
    const toAdd: EffectiveGame[] = [];
    const nextIds: Record<string, boolean> = { ...effectivePalpiteIds };
    const contestNum = lotteryStats.latestContest?.contestNumber || '2949';
    const modName = getModalityDisplayName(genLotteryType, genContestMode);

    items.forEach((item, idx) => {
      if (!nextIds[item.id]) {
        const cfg = LOTTERY_CONFIGS[item.lotteryType];
        const pInfo = cfg.priceTable[item.numbers.length] || cfg.priceTable[cfg.minNumbers];
        const cost = item.cost || pInfo?.price || cfg.baseSimpleBetPrice;
        toAdd.push({
          id: `eff_${Date.now().toString(36)}_b_${idx}`,
          label: `Jogo ${modName} (${item.numbers.length} DZ)`,
          lotteryType: item.lotteryType,
          contestMode: genContestMode,
          numbers: item.numbers,
          cost,
          status: 'A_FAZER',
          contestNumber: contestNum,
          createdAt: new Date().toISOString(),
        });
        nextIds[item.id] = true;
      }
    });

    if (toAdd.length === 0) {
      setRealizadosFilter('A_FAZER');
      setJogosSubTab('REALIZADOS');
      setActiveSection('MEUS_JOGOS');
      return;
    }

    const updatedFavs = userFavoriteLotteries.includes(genLotteryType)
      ? userFavoriteLotteries
      : [...userFavoriteLotteries, genLotteryType];

    await onUpdateUser({
      effectiveGames: [...toAdd, ...userEffectiveGames],
      favoriteLotteries: updatedFavs,
    });
    setEffectivePalpiteIds(nextIds);
    setGeneratedPalpites((prev) => prev.filter((p) => !items.some((it) => it.id === p.id)));
    onNotify?.(`${toAdd.length} jogo(s) confirmado(s) em ${modName}!`);
    setRealizadosFilter('A_FAZER');
    setJogosSubTab('REALIZADOS');
    setActiveSection('MEUS_JOGOS');
  };

  const handleToggleEffectiveStatus = async (gameId: string) => {
    const nextList: EffectiveGame[] = userEffectiveGames.map((g) => {
      if (g.id !== gameId) return g;
      const nextStatus: EffectiveGameStatus = g.status === 'FEITO' ? 'A_FAZER' : 'FEITO';
      return { ...g, status: nextStatus };
    });
    await onUpdateUser({ effectiveGames: nextList });
    const target = nextList.find((g) => g.id === gameId);
    if (target) {
      onNotify?.(
        target.status === 'FEITO'
          ? 'Marcado como Registrado!'
          : 'Marcado como Confirmado.'
      );
    }
  };

  const handleDeleteEffectiveGame = async (gameId: string) => {
    const nextList = userEffectiveGames.filter((g) => g.id !== gameId);
    await onUpdateUser({ effectiveGames: nextList });
    onNotify?.('Jogo removido de Jogos Realizados.');
  };

  const handleToggleManualDrawnBall = (num: number) => {
    const current = manualDrawnByLottery[genLotteryType] || [];
    const evalInfo = evaluatePrizeTier(genLotteryType, 0);
    const maxBalls = evalInfo.requiredDrawnCount;

    if (current.includes(num)) {
      setManualDrawnByLottery((prev) => ({
        ...prev,
        [genLotteryType]: current.filter((n) => n !== num),
      }));
      return;
    }

    if (current.length >= maxBalls) {
      onNotify?.(
        `O sorteio da ${LOTTERY_CONFIGS[genLotteryType].name} possui ${maxBalls} bolas sorteadas.`
      );
      return;
    }

    setManualDrawnByLottery((prev) => ({
      ...prev,
      [genLotteryType]: [...current, num].sort((a, b) => a - b),
    }));
  };

  const handleClearManualDrawnBalls = () => {
    setManualDrawnByLottery((prev) => ({
      ...prev,
      [genLotteryType]: [],
    }));
  };

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

  // Grid Cards Definition (Simple 1-word titles)
  const serviceGridItems: {
    id: ModalTopic;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badgeAlert?: boolean;
    highlight?: boolean;
  }[] = [
    {
      id: 'PALPITES',
      title: 'Loterias',
      subtitle: 'Criar jogos e bolões',
      icon: <Clover className="w-5 h-5" />,
      highlight: true,
    },
    {
      id: 'MEUS_JOGOS',
      title: 'Meus Jogos',
      subtitle: 'Realizados e conferidos',
      icon: <Ticket className="w-5 h-5" />,
    },
    {
      id: 'GRUPOS',
      title: 'Bolões',
      subtitle: 'Cotas e grupos',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'FAVORITOS',
      title: 'Favoritos',
      subtitle: 'Salvos',
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: 'ESTATISTICAS',
      title: 'Estatísticas',
      subtitle: 'Sorteios e DZ',
      icon: <BarChart2 className="w-5 h-5" />,
    },
    {
      id: 'INVESTIMENTOS',
      title: 'Limite',
      subtitle: isNearLimit ? 'Alerta 80%' : 'Teto mensal',
      icon: <ShieldAlert className="w-5 h-5" />,
      badgeAlert: isNearLimit,
    },
  ];

  const renderModals = () => (
    <>
      {/* Modal Simples de Confirmação com resposta Sim / Não */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-[10px] bg-white p-5 shadow-2xl border border-[#EDF2F7] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-2 border-b border-[#F1F5F9] pb-2.5">
              <h3 className="text-sm font-extrabold text-[#1E293B]">
                {confirmModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="text-[#64748B] hover:text-[#1E293B] cursor-pointer p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="h-9 px-3 rounded-[5px] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] text-xs font-bold transition-colors cursor-pointer"
              >
                {confirmModal.cancelText || 'Não'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await action();
                }}
                className={`h-9 px-3 rounded-[5px] text-xs font-bold transition-colors cursor-pointer text-white shadow-2xs ${
                  confirmModal.isDestructive
                    ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                    : 'bg-[#008B47] hover:bg-[#00743B]'
                }`}
              >
                {confirmModal.confirmText || 'Sim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Compartilhamento (Bolão em que participa, Contato amigo ou WhatsApp) */}
      {shareGameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[10px] bg-white p-5 shadow-2xl border border-[#EDF2F7] space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 border-b border-[#EDF2F7] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-[#EBF4FC] text-[#005CA9] flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1E293B]">
                    Compartilhar Jogo
                  </h3>
                  <span className="text-[11px] text-[#5F6C7B]">
                    {LOTTERY_CONFIGS[shareGameModal.game.lotteryType].name} · Concurso {shareGameModal.game.contestNumber}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShareGameModal(null)}
                className="text-[#64748B] hover:text-[#1E293B] cursor-pointer p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Visualização rápida das dezenas */}
            <div className="p-3 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                Dezenas do Jogo #{shareGameModal.index + 1}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {shareGameModal.game.numbers.map((n) => (
                  <span
                    key={n}
                    className="w-6 h-6 rounded-full bg-[#008B47] text-white font-mono-tabular font-bold text-[11px] flex items-center justify-center"
                  >
                    {String(n).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>

            {/* 3 Opções de Compartilhamento solicitadas pelo usuário */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider block">
                Onde deseja compartilhar?
              </span>

              {/* 1. Bolão em que participa */}
              <button
                type="button"
                onClick={() => handleShareGameToPool(shareGameModal.game)}
                className="w-full p-3 rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7] transition-all flex items-center justify-between gap-3 text-left cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#008B47] text-white flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#15803D] block">
                      Bolão em que participa
                    </span>
                    <span className="text-[11px] text-[#475569]">
                      Enviar este jogo como sugestão para o bolão ativo
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#008B47] group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 2. Contato amigo do bolão */}
              <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#005CA9]" />
                  <span className="text-xs font-bold text-[#1E293B]">
                    Contato amigo do bolão
                  </span>
                </div>

                {poolFriends.length === 0 ? (
                  <p className="text-[11px] text-[#64748B]">
                    Nenhum outro participante no bolão no momento.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {poolFriends.map((friend) => (
                      <button
                        key={friend.id}
                        type="button"
                        onClick={() => handleShareGameToFriend(shareGameModal.game, friend.name)}
                        className="px-2.5 py-1.5 rounded-[4px] bg-[#EBF4FC] hover:bg-[#D5E8FA] text-[#005CA9] text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={`Compartilhar com ${friend.name}`}
                      >
                        <User className="w-3 h-3 text-[#005CA9]" />
                        <span>{friend.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. WhatsApp */}
              <button
                type="button"
                onClick={() => handleShareGameWhatsApp(shareGameModal.game)}
                className="w-full p-3 rounded-[8px] border border-[#86EFAC] bg-[#F0FDF4] hover:bg-[#DCFCE7] transition-all flex items-center justify-between gap-3 text-left cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#15803D] block">
                      WhatsApp
                    </span>
                    <span className="text-[11px] text-[#475569]">
                      Compartilhar jogo formatado via WhatsApp
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#25D366] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="pt-2 border-t border-[#EDF2F7] flex justify-end">
              <button
                type="button"
                onClick={() => setShareGameModal(null)}
                className="h-8 px-4 rounded-[4px] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

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
        title: 'Perfil',
        subtitle: 'Dados e Pix',
      },
      GRUPOS: {
        title: 'Bolões',
        subtitle: 'Meus bolões e cotas',
      },
      FAVORITOS: {
        title: 'Favoritos',
        subtitle: 'Jogos e dezenas salvas',
      },
      NOVO: {
        title: 'Promotor',
        subtitle: 'Criar bolão ou ver abertos',
      },
      PALPITES: {
        title: 'Loterias',
        subtitle: 'Todas as loterias da Caixa, criar jogos e bolões',
      },
      MEUS_JOGOS: {
        title: 'Meus Jogos',
        subtitle: 'Jogos realizados e conferidos',
      },
      DEZENAS_FAV: {
        title: 'Dezenas',
        subtitle: 'Números favoritos',
      },
      JOGOS_FAV: {
        title: 'Salvos',
        subtitle: 'Jogos favoritos',
      },
      INVESTIMENTOS: {
        title: 'Limite',
        subtitle: 'Teto mensal e extrato',
      },
      ESTATISTICAS: {
        title: 'Estatísticas',
        subtitle: 'Sorteios, dezenas e chances',
      },
    };

    const currentHeader = sectionTitles[activeSection];

    return (
      <div className="min-h-full bg-[#F7F9FC] pb-8">
        {/* Full-Screen Section Navigation Bar (Cabeçalho da Seção) */}
        {(() => {
          const isLotteryHeaderActive =
            activeSection === 'PALPITES' && meusJogosSelectedLottery !== null;

          const headerBgByLottery: Record<LotteryType, string> = {
            MEGA_SENA: '#009640',
            LOTOFACIL: '#951b81',
            QUINA: '#312783',
            LOTOMANIA: '#f39200',
            TIMEMANIA: '#ffed00',
            DUPLA_SENA: '#a52336',
            DIA_DE_SORTE: '#d9b71d',
            SUPER_SETE: '#c7d300',
            MAIS_MILIONARIA: '#1b365d',
            LOTECA: '#e30613',
          };

          const headerDiagonalByLottery: Record<LotteryType, string> = {
            MEGA_SENA: '#007932',
            LOTOFACIL: '#751465',
            QUINA: '#241c63',
            LOTOMANIA: '#d47d00',
            TIMEMANIA: '#009640',
            DUPLA_SENA: '#851b2b',
            DIA_DE_SORTE: '#b89914',
            SUPER_SETE: '#a4ae00',
            MAIS_MILIONARIA: '#122440',
            LOTECA: '#005ca9',
          };

          const selectedLt = meusJogosSelectedLottery;

          return (
            <div
              style={
                isLotteryHeaderActive && selectedLt
                  ? { backgroundColor: headerBgByLottery[selectedLt] }
                  : undefined
              }
              className={`sticky top-[70px] z-20 transition-colors overflow-hidden ${
                isLotteryHeaderActive
                  ? 'border-b border-black/10 shadow-xs'
                  : 'bg-white border-b border-[#DCE5F0]'
              }`}
            >
              <div className="relative px-4 py-2.5 flex items-center justify-between gap-3">
                {/* Arte de fundo temática do cabeçalho quando uma loteria está aberta */}
                {isLotteryHeaderActive && selectedLt && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 430 56"
                    preserveAspectRatio="none"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Recorte diagonal inspirado no padrão Loterias Caixa */}
                    <polygon
                      points="0,0 135,0 95,56 0,56"
                      fill={headerDiagonalByLottery[selectedLt]}
                      fillOpacity={selectedLt === 'TIMEMANIA' ? '0.95' : '0.65'}
                    />
                    <polygon
                      points="135,0 165,0 125,56 95,56"
                      fill="#FFFFFF"
                      fillOpacity={selectedLt === 'TIMEMANIA' ? '0.25' : '0.08'}
                    />
                    {/* Esferas sutis decorativas ao centro */}
                    <circle
                      cx="195"
                      cy="12"
                      r="22"
                      fill="#FFFFFF"
                      fillOpacity={selectedLt === 'TIMEMANIA' ? '0.35' : '0.07'}
                    />
                    <circle
                      cx="225"
                      cy="48"
                      r="16"
                      fill="#FFFFFF"
                      fillOpacity={selectedLt === 'TIMEMANIA' ? '0.35' : '0.06'}
                    />
                  </svg>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (activeSection === 'PALPITES') {
                      if (isGeneratorToolOpen) {
                        setIsGeneratorToolOpen(false);
                        return;
                      }
                      if (meusJogosContestMode !== null) {
                        setMeusJogosContestMode(null);
                        return;
                      }
                      if (meusJogosSelectedLottery !== null) {
                        setMeusJogosSelectedLottery(null);
                        return;
                      }
                    }
                    setActiveSection(null);
                  }}
                  className={`relative z-10 h-9 px-3 rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    isLotteryHeaderActive
                      ? 'bg-white/20 hover:bg-white/30 text-white border border-white/35 backdrop-blur-xs shadow-2xs'
                      : 'bg-[#EBF4FC] hover:bg-[#D5E8FA] text-[#005CA9]'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <div className="relative z-10 flex items-center justify-end min-w-0 flex-1">
                  {activeSection === 'PALPITES' ? (
                    meusJogosSelectedLottery !== null ? (
                      <img
                        src={LOTTERY_CONFIGS[meusJogosSelectedLottery].logoUrl}
                        alt={LOTTERY_CONFIGS[meusJogosSelectedLottery].name}
                        className="h-9 w-auto max-w-[215px] object-contain rounded-[4px]"
                      />
                    ) : (
                      <img
                        src="/assets/loterias/loterias-caixa.svg"
                        alt="Loterias Caixa"
                        className="h-6 w-auto max-w-[190px] object-contain"
                      />
                    )
                  ) : (
                    <h2 className="text-sm font-extrabold text-[#1E293B] leading-snug text-right">
                      {currentHeader.title}
                    </h2>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Full-Screen Section Body */}
        <div
          className={`px-4 pb-6 space-y-4 ${
            activeSection === 'PALPITES' && isGeneratorToolOpen ? 'pt-0' : 'pt-3.5'
          }`}
        >
          {/* =============================================================== */}
          {/* SEÇÃO EM BRANCO: INÍCIO                                         */}
          {/* =============================================================== */}
          {activeSection === 'INICIO' && <section className="min-h-[320px]" />}

          {/* =============================================================== */}
          {/* SEÇÃO LOTERIAS: TODAS AS LOTERIAS DA CAIXA EM CARDS COM LOGOS   */}
          {/* E "CRIAR JOGOS" COMO FILHO DE CADA LOTERIA ABERTA               */}
          {/* =============================================================== */}
          {activeSection === 'PALPITES' && (
            <div className="space-y-3.5">
              {/* NÍVEL 1: TODAS AS LOTERIAS DA CAIXA EM CARDS COM LOGOTIPO OFICIAL */}
              {meusJogosSelectedLottery === null && (
                <div className="grid grid-cols-2 gap-3">
                  {ALL_LOTTERY_TYPES.map((lt) => {
                    const cfg = LOTTERY_CONFIGS[lt];
                    const exactLogoBgByLottery: Record<LotteryType, string> = {
                      MEGA_SENA: '#009640',
                      LOTOFACIL: '#951b81',
                      QUINA: '#312783',
                      LOTOMANIA: '#f39200',
                      TIMEMANIA: '#ffed00',
                      DUPLA_SENA: '#a52336',
                      DIA_DE_SORTE: '#d9b71d',
                      SUPER_SETE: '#c7d300',
                      MAIS_MILIONARIA: '#1b365d',
                      LOTECA: '#e30613',
                    };

                    return (
                      <div
                        key={lt}
                        onClick={() => {
                          setMeusJogosSelectedLottery(lt);
                          setMeusJogosContestMode(null);
                          setGenLotteryType(lt);
                        }}
                        style={{ backgroundColor: exactLogoBgByLottery[lt] }}
                        className="w-full h-20 px-4 cursor-pointer overflow-hidden rounded-[8px] shadow-sm hover:shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center"
                      >
                        <img
                          src={cfg.logoUrl.replace('.svg', '-nome.svg')}
                          alt={cfg.name}
                          className="w-full h-full object-contain block"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* NÍVEL 2: DENTRO DA LOTERIA ABERTA -> 2 CARDS COM ARTE DE FUNDO INCONFUNDÍVEL (REGULAR E ESPECIAL) */}
              {meusJogosSelectedLottery !== null && meusJogosContestMode === null && (
                <div className="space-y-3">
                  {/* CARD 1: LOTERIA REGULAR */}
                  {(() => {
                    const lt = meusJogosSelectedLottery;
                    const cfg = LOTTERY_CONFIGS[lt];

                    const regularBgByLottery: Record<LotteryType, string> = {
                      MEGA_SENA: 'bg-gradient-to-br from-[#F0FDF4] via-[#DCFCE7] to-[#BBF7D0] border-[#86EFAC]',
                      LOTOFACIL: 'bg-gradient-to-br from-[#FAF5FF] via-[#F3E8FF] to-[#E9D5FF] border-[#D8B4FE]',
                      QUINA: 'bg-gradient-to-br from-[#EEF2FF] via-[#E0E7FF] to-[#C7D2FE] border-[#A5B4FC]',
                      LOTOMANIA: 'bg-gradient-to-br from-[#FFF7ED] via-[#FFEDD5] to-[#FED7AA] border-[#FDBA74]',
                      TIMEMANIA: 'bg-gradient-to-br from-[#F0FDF4] via-[#DCFCE7] to-[#FEF9C3] border-[#86EFAC]',
                      DUPLA_SENA: 'bg-gradient-to-br from-[#FFF1F2] via-[#FFE4E6] to-[#FECDD3] border-[#FDA4AF]',
                      DIA_DE_SORTE: 'bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] border-[#FCD34D]',
                      SUPER_SETE: 'bg-gradient-to-br from-[#F7FEE7] via-[#ECFCCB] to-[#D9F99D] border-[#BEF264]',
                      MAIS_MILIONARIA: 'bg-gradient-to-br from-[#EFF6FF] via-[#DBEAFE] to-[#BFDBFE] border-[#93C5FD]',
                      LOTECA: 'bg-gradient-to-br from-[#F0F9FF] via-[#E0F2FE] to-[#BAE6FD] border-[#7DD3FC]',
                    };

                    return (
                      <div
                        onClick={() => {
                          setGenLotteryType(lt);
                          setGenContestMode('REGULAR');
                          setMeusJogosContestMode('REGULAR');
                          setIsGeneratorToolOpen(false);
                          setJogosSubTab('CRIAR');
                        }}
                        className={`relative overflow-hidden rounded-[8px] border p-4 cursor-pointer shadow-sm hover:shadow-md transition-all ${regularBgByLottery[lt]}`}
                      >
                        {/* Arte de Fundo SVG: Esferas de Sorteio */}
                        <svg
                          className="absolute right-0 top-0 h-full w-48 pointer-events-none opacity-20"
                          viewBox="0 0 200 120"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="165" cy="25" r="42" stroke={cfg.accentColor} strokeWidth="8" />
                          <circle cx="140" cy="95" r="32" fill={cfg.accentColor} fillOpacity="0.25" />
                          <circle cx="185" cy="85" r="18" fill={cfg.accentColor} fillOpacity="0.4" />
                        </svg>

                        <div className="relative z-10">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-display font-extrabold text-base text-[#0F172A]">
                                Regular
                              </h4>
                              <p className="text-xs font-medium text-[#334155]">
                                Concursos regulares da {cfg.name}
                              </p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-2xs shrink-0">
                              <ChevronRight className="w-5 h-5 text-[#0F172A]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* CARD 2: LOTERIA ESPECIAL (Mega da Virada, Lotofácil da Independência, Quina de São João, etc.) */}
                  {(() => {
                    const lt = meusJogosSelectedLottery;
                    const cfg = LOTTERY_CONFIGS[lt];
                    const specialTitle = getModalityDisplayName(lt, 'SPECIAL');

                    const specialGradientByLottery: Record<LotteryType, string> = {
                      MEGA_SENA:
                        'bg-gradient-to-br from-[#023E1E] via-[#007A37] to-[#0D9F4F] border-[#F59E0B]',
                      LOTOFACIL:
                        'bg-gradient-to-br from-[#4A0E4E] via-[#7E1970] to-[#0F6E38] border-[#FACC15]',
                      QUINA:
                        'bg-gradient-to-br from-[#16004B] via-[#260085] to-[#581C87] border-[#F97316]',
                      LOTOMANIA:
                        'bg-gradient-to-br from-[#9A3412] via-[#EA580C] to-[#D97706] border-[#FDE047]',
                      DUPLA_SENA:
                        'bg-gradient-to-br from-[#7F1D1D] via-[#A61324] to-[#B45309] border-[#FDE047]',
                      TIMEMANIA:
                        'bg-gradient-to-br from-[#064E3B] via-[#12923D] to-[#CA8A04] border-[#FDE047]',
                      DIA_DE_SORTE:
                        'bg-gradient-to-br from-[#78350F] via-[#B45309] to-[#D97706] border-[#FDE68A]',
                      SUPER_SETE:
                        'bg-gradient-to-br from-[#365314] via-[#4D7C0F] to-[#CA8A04] border-[#FDE047]',
                      MAIS_MILIONARIA:
                        'bg-gradient-to-br from-[#0F172A] via-[#1B365D] to-[#854D0E] border-[#FACC15]',
                      LOTECA:
                        'bg-gradient-to-br from-[#0C4A6E] via-[#005CA9] to-[#B45309] border-[#FACC15]',
                    };

                    return (
                      <div
                        onClick={() => {
                          setGenLotteryType(lt);
                          setGenContestMode('SPECIAL');
                          setMeusJogosContestMode('SPECIAL');
                          setIsGeneratorToolOpen(false);
                          setJogosSubTab('CRIAR');
                        }}
                        className={`relative overflow-hidden rounded-[8px] border-2 p-4 cursor-pointer shadow-md hover:shadow-lg transition-all text-white ${specialGradientByLottery[lt]}`}
                      >
                        {/* Arte de Fundo Temática Inconfundível para cada Concurso Especial */}
                        {lt === 'MEGA_SENA' && (
                          /* Mega da Virada: Fogos de Artifício Dourados, Brilhos de Réveillon e Trevo de Ouro */
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 360 130"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <circle cx="310" cy="32" r="46" fill="#FACC15" fillOpacity="0.14" />
                            <circle cx="310" cy="32" r="26" stroke="#FDE047" strokeWidth="1.5" strokeDasharray="3 4" strokeOpacity="0.7" />
                            {/* Raios de fogos da Virada */}
                            <g stroke="#FDE047" strokeWidth="2" strokeLinecap="round" opacity="0.65">
                              <line x1="310" y1="2" x2="310" y2="14" />
                              <line x1="310" y1="50" x2="310" y2="62" />
                              <line x1="280" y1="32" x2="292" y2="32" />
                              <line x1="328" y1="32" x2="340" y2="32" />
                              <line x1="289" y1="11" x2="297" y2="19" />
                              <line x1="323" y1="45" x2="331" y2="53" />
                              <line x1="331" y1="11" x2="323" y2="19" />
                              <line x1="297" y1="45" x2="289" y2="53" />
                            </g>
                            {/* Segundo fogo dourado */}
                            <g stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" opacity="0.55">
                              <line x1="245" y1="78" x2="245" y2="88" />
                              <line x1="245" y1="104" x2="245" y2="114" />
                              <line x1="227" y1="96" x2="237" y2="96" />
                              <line x1="253" y1="96" x2="263" y2="96" />
                            </g>
                          </svg>
                        )}

                        {lt === 'LOTOFACIL' && (
                          /* Lotofácil da Independência: Fitas Verde-Amarelo-Azul e Estrelas da Independência */
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 360 130"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M210 -10 L370 55 L370 95 L180 10 Z"
                              fill="#FACC15"
                              fillOpacity="0.22"
                            />
                            <path
                              d="M235 -15 L370 35 L370 65 L215 -5 Z"
                              fill="#22C55E"
                              fillOpacity="0.28"
                            />
                            <polygon
                              points="315,18 320,30 333,31 323,40 326,52 315,45 304,52 307,40 297,31 310,30"
                              fill="#FDE047"
                              fillOpacity="0.55"
                            />
                            <polygon
                              points="265,72 268,80 277,81 270,87 272,95 265,90 258,95 260,87 253,81 262,80"
                              fill="#FDE047"
                              fillOpacity="0.4"
                            />
                          </svg>
                        )}

                        {lt === 'QUINA' && (
                          /* Quina de São João: Bandeirolas Juninas Coloridas, Fogueira e Estrelas */
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 360 130"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            {/* Cordão de bandeirolas de São João */}
                            <path
                              d="M170 6 Q265 28 360 4"
                              stroke="#FDE047"
                              strokeWidth="1.5"
                              strokeOpacity="0.6"
                              fill="none"
                            />
                            <polygon points="195,11 215,14 215,34 205,26 195,34" fill="#F97316" fillOpacity="0.7" />
                            <polygon points="230,15 250,17 250,37 240,29 230,37" fill="#FACC15" fillOpacity="0.75" />
                            <polygon points="265,17 285,16 285,36 275,28 265,36" fill="#22C55E" fillOpacity="0.7" />
                            <polygon points="300,15 320,12 320,32 310,24 300,32" fill="#EC4899" fillOpacity="0.7" />
                            <polygon points="335,10 352,6 352,26 343,18 335,26" fill="#38BDF8" fillOpacity="0.7" />
                            {/* Brilho da Fogueira Junina */}
                            <circle cx="315" cy="105" r="38" fill="#F97316" fillOpacity="0.28" />
                            <path
                              d="M315 62 C328 80 332 98 315 115 C298 98 302 80 315 62 Z"
                              fill="#FACC15"
                              fillOpacity="0.4"
                            />
                          </svg>
                        )}

                        {lt !== 'MEGA_SENA' && lt !== 'LOTOFACIL' && lt !== 'QUINA' && (
                          /* Demais Loterias Especiais: Raios Dourados e Estrelas de Prêmio Especial */
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 360 130"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <circle cx="310" cy="45" r="50" fill="#FACC15" fillOpacity="0.18" />
                            <circle cx="310" cy="45" r="32" stroke="#FDE047" strokeWidth="1.5" strokeDasharray="4 4" strokeOpacity="0.6" />
                            <polygon
                              points="310,18 316,33 332,35 320,45 323,61 310,52 297,61 300,45 288,35 304,33"
                              fill="#FDE047"
                              fillOpacity="0.45"
                            />
                          </svg>
                        )}

                        <div className="relative z-10">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-display font-extrabold text-base text-white drop-shadow-2xs">
                                {specialTitle}
                              </h4>
                              <p className="text-xs font-medium text-white/90">
                                Criar jogos, jogos realizados, conferidor e bolão especial
                              </p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                              <ChevronRight className="w-5 h-5 text-[#FDE047]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* NÍVEL 3: LOTERIA ABERTA -> APENAS OS 2 BOTÕES QUADRADOS NO CENTRO ("CRIAR JOGO" E "CRIAR BOLÃO") */}
              {meusJogosSelectedLottery !== null &&
                meusJogosContestMode !== null &&
                (() => {
                  const activeLt = meusJogosSelectedLottery;
                  const activeMode = meusJogosContestMode;
                  const modalityTitle = getModalityDisplayName(activeLt, activeMode);
                  const cfg = LOTTERY_CONFIGS[activeLt];

                  if (!isGeneratorToolOpen) {
                    const createGameCardColorByLottery: Record<LotteryType, string> = {
                      MEGA_SENA:
                        'bg-gradient-to-br from-[#006B2D] via-[#009640] to-[#00B04B] border-[#86EFAC]/50',
                      LOTOFACIL:
                        'bg-gradient-to-br from-[#6B125C] via-[#951b81] to-[#B5239D] border-[#F0ABFC]/50',
                      QUINA:
                        'bg-gradient-to-br from-[#1F1859] via-[#312783] to-[#4638B5] border-[#A5B4FC]/50',
                      LOTOMANIA:
                        'bg-gradient-to-br from-[#C27200] via-[#f39200] to-[#FFA726] border-[#FDE047]/60',
                      TIMEMANIA:
                        'bg-gradient-to-br from-[#007A33] via-[#009640] to-[#C4B600] border-[#FFED00]/70',
                      DUPLA_SENA:
                        'bg-gradient-to-br from-[#7A1826] via-[#a52336] to-[#C92C43] border-[#FDA4AF]/50',
                      DIA_DE_SORTE:
                        'bg-gradient-to-br from-[#A68912] via-[#d9b71d] to-[#E6C735] border-[#FEF08A]/60',
                      SUPER_SETE:
                        'bg-gradient-to-br from-[#859000] via-[#A4B000] to-[#c7d300] border-[#ECFCCB]/60',
                      MAIS_MILIONARIA:
                        'bg-gradient-to-br from-[#0F213C] via-[#1b365d] to-[#274D85] border-[#93C5FD]/50',
                      LOTECA:
                        'bg-gradient-to-br from-[#A8040E] via-[#e30613] to-[#FF1F2D] border-[#FCA5A5]/50',
                    };

                    return (
                      <section className="caixa-card p-6 flex flex-col items-center justify-center space-y-6 bg-gradient-to-b from-white to-[#F8FAFC]">
                        {/* 1. Card Quadrado: Criar jogo + Div Instrutiva */}
                        <div className="w-full max-w-[300px] flex flex-col items-center text-center space-y-3">
                          <button
                            type="button"
                            onClick={() => {
                              setGenStep1Fixed([]);
                              setGenStep1Excluded([]);
                              setGenStep1Pending([]);
                              setGenSelectedFavNumbers([]);
                              setGenFixedNumbers([]);
                              setGenExcludedNumbers([]);
                              setGenStep3Pending([]);
                              setGenSwipeStep(0);
                              setIsGeneratorToolOpen(true);
                              setJogosSubTab('CRIAR');
                            }}
                            className={`group relative w-48 h-48 rounded-[12px] overflow-hidden border-2 text-white shadow-md hover:shadow-xl active:scale-[0.98] transition-all flex flex-col items-center justify-between p-4 cursor-pointer ${createGameCardColorByLottery[activeLt]}`}
                          >
                            {/* Arte de Fundo SVG: Volante, Esferas Numeradas e Gráfico de Estatísticas */}
                            <svg
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              viewBox="0 0 200 200"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              {/* Brilho superior direito */}
                              <circle cx="170" cy="28" r="62" fill="#FFFFFF" fillOpacity="0.14" />
                              <circle cx="24" cy="175" r="54" fill="#FACC15" fillOpacity="0.12" />

                              {/* Grade sutil de volante ao fundo */}
                              <g stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="1">
                                <rect x="128" y="18" width="14" height="14" rx="3" />
                                <rect x="146" y="18" width="14" height="14" rx="3" fill="#FFFFFF" fillOpacity="0.18" />
                                <rect x="164" y="18" width="14" height="14" rx="3" />
                                <rect x="128" y="36" width="14" height="14" rx="3" fill="#FFFFFF" fillOpacity="0.22" />
                                <rect x="146" y="36" width="14" height="14" rx="3" />
                                <rect x="164" y="36" width="14" height="14" rx="3" fill="#FFFFFF" fillOpacity="0.18" />
                              </g>

                              {/* Esferas de sorteio decorativas */}
                              <circle cx="32" cy="40" r="16" fill="#FFFFFF" fillOpacity="0.14" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.5" />
                              <text x="32" y="44" textAnchor="middle" fill="#FFFFFF" fillOpacity="0.4" fontSize="10" fontWeight="800" fontFamily="monospace">07</text>

                              <circle cx="168" cy="145" r="20" fill="#FFFFFF" fillOpacity="0.14" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="1.5" />
                              <text x="168" y="150" textAnchor="middle" fill="#FFFFFF" fillOpacity="0.4" fontSize="12" fontWeight="800" fontFamily="monospace">23</text>

                              {/* Curva de análise estatística na base */}
                              <path
                                d="M10 165 Q55 135 95 152 T190 122"
                                stroke="#FFFFFF"
                                strokeOpacity="0.3"
                                strokeWidth="2"
                                strokeDasharray="3 3"
                              />
                            </svg>

                            {/* Topo: Indicador discreto */}
                            <span className="relative z-10 text-[10px] font-semibold tracking-wider text-white/90">
                              Aposta Individual
                            </span>

                            {/* Centro: Ícone padrão de Jogo (Ticket) em destaque + Título */}
                            <div className="relative z-10 flex flex-col items-center gap-2">
                              <Ticket className="w-12 h-12 text-white drop-shadow-sm group-hover:scale-105 transition-transform" />
                              <span className="font-display font-extrabold text-lg tracking-tight text-white drop-shadow-2xs">
                                Criar jogo
                              </span>
                            </div>

                            {/* Base: Ação */}
                            <div className="relative z-10 flex items-center gap-1 text-[11px] font-bold text-white/90 group-hover:text-white transition-colors">
                              <span>Abrir gerador</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </button>

                          <div className="w-full text-[11px] text-[#334155] leading-relaxed">
                            Monte jogos individuais para a <strong style={{ color: cfg.accentColor }} className="font-bold">{modalityTitle}</strong> usando estatísticas, dezenas fixas ou favoritas para confirmar e registrar na lotérica.
                          </div>
                        </div>

                        <div className="w-full max-w-[300px] border-t border-[#E2E8F0]" />

                        {/* 2. Card Quadrado: Criar bolão + Texto Instrutivo */}
                        <div className="w-full max-w-[300px] flex flex-col items-center text-center space-y-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenPromoter) {
                                onOpenPromoter({
                                  lotteryType: activeLt,
                                  contestMode: activeMode,
                                });
                              } else {
                                setActiveSection('NOVO');
                              }
                            }}
                            className="group relative w-48 h-48 rounded-[12px] overflow-hidden bg-gradient-to-br from-[#023E1E] via-[#007A37] to-[#0D9F4F] border-2 border-[#FACC15]/45 text-white shadow-md hover:shadow-xl active:scale-[0.98] transition-all flex flex-col items-center justify-between p-4 cursor-pointer"
                          >
                            {/* Arte de Fundo SVG: Cotas Conectadas, Bilhetes Compartilhados e Estrela de Prêmio */}
                            <svg
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              viewBox="0 0 200 200"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              {/* Brilho dourado superior */}
                              <circle cx="168" cy="32" r="58" fill="#FACC15" fillOpacity="0.16" />
                              <circle cx="30" cy="170" r="50" fill="#4ADE80" fillOpacity="0.14" />

                              {/* Anéis de cotas em grupo */}
                              <circle cx="158" cy="40" r="22" stroke="#FDE047" strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="4 3" />
                              <circle cx="158" cy="40" r="12" fill="#FDE047" fillOpacity="0.15" />

                              {/* Bilhetes de cota sobrepostos na esquerda */}
                              <g stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1.2">
                                <rect x="16" y="26" width="28" height="18" rx="3" transform="rotate(-12 16 26)" fill="#FFFFFF" fillOpacity="0.08" />
                                <rect x="22" y="32" width="28" height="18" rx="3" transform="rotate(6 22 32)" fill="#FACC15" fillOpacity="0.14" />
                              </g>

                              {/* Rede de conexões entre participantes na base */}
                              <g stroke="#86EFAC" strokeOpacity="0.3" strokeWidth="1.5">
                                <line x1="28" y1="152" x2="68" y2="136" />
                                <line x1="68" y1="136" x2="135" y2="156" />
                                <line x1="135" y1="156" x2="174" y2="134" />
                              </g>
                              <circle cx="28" cy="152" r="4.5" fill="#FDE047" fillOpacity="0.45" />
                              <circle cx="68" cy="136" r="5.5" fill="#FFFFFF" fillOpacity="0.4" />
                              <circle cx="135" cy="156" r="4.5" fill="#FDE047" fillOpacity="0.45" />
                              <circle cx="174" cy="134" r="6" fill="#FFFFFF" fillOpacity="0.4" />
                            </svg>

                            {/* Topo: Indicador discreto */}
                            <span className="relative z-10 text-[10px] font-semibold tracking-wider text-[#FDE68A]">
                              Aposta Coletiva
                            </span>

                            {/* Centro: Ícone em destaque + Título */}
                            <div className="relative z-10 flex flex-col items-center gap-2">
                              <Users className="w-12 h-12 text-[#FDE047] drop-shadow-sm group-hover:scale-105 transition-transform" />
                              <span className="font-display font-extrabold text-lg tracking-tight text-white drop-shadow-2xs">
                                Criar bolão
                              </span>
                            </div>

                            {/* Base: Ação */}
                            <div className="relative z-10 flex items-center gap-1 text-[11px] font-bold text-[#FEF08A] group-hover:text-white transition-colors">
                              <span>Organizar cotas</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </button>

                          <div className="w-full text-[11px] text-[#334155] leading-relaxed">
                            Organize um bolão em grupo para a <strong className="text-[#007A37] font-bold">{modalityTitle}</strong>, defina o valor das cotas, convide participantes e gerencie as apostas coletivas.
                          </div>
                        </div>
                      </section>
                    );
                  }

                  return (
                    <div className="space-y-3.5">
                      {/* FERRAMENTA DE CRIAÇÃO DE JOGOS EM FUNIL SWIPE HORIZONTAL (5 PASSOS CONECTADOS) */}
                      {(() => {
                        const recentList = (
                          lotteryStats.recentContests || [lotteryStats.latestContest]
                        ).slice(0, 3);
                        const allRecentDrawn = Array.from(
                          new Set(recentList.flatMap((c) => c.drawnNumbers))
                        );

                        // Dezenas favoritas elegíveis no Passo 2 (exclui as que foram eliminadas no Passo 1)
                        const availableFavNumbers = currentGenFavNumbers.filter(
                          (n) => !genStep1Excluded.includes(n)
                        );
                        const effectiveFavSelected = genSelectedFavNumbers.filter(
                          (n) => !genStep1Excluded.includes(n)
                        );

                        // Consolidação em tempo real do Funil
                        const allEliminatedNumbers = Array.from(
                          new Set([
                            ...genStep1Excluded,
                            ...genExcludedNumbers,
                          ])
                        ).sort((a, b) => a - b);
                        const allEliminatedSet = new Set(allEliminatedNumbers);

                        const allChosenNumbers = Array.from(
                          new Set([
                            ...genStep1Fixed,
                            ...effectiveFavSelected,
                            ...genFixedNumbers,
                          ])
                        )
                          .filter((n) => !allEliminatedSet.has(n))
                          .sort((a, b) => a - b);
                        const allChosenSet = new Set(allChosenNumbers);

                        // Grade do Passo 3: NÃO deve mostrar bolas excluídas!
                        // Mostra as dezenas disponíveis e destaca de cara as bolas já incluídas
                        const step3GridNumbers = Array.from(
                          { length: cfg.totalPoolNumbers },
                          (_, i) => i + 1
                        ).filter((n) => !allEliminatedSet.has(n));

                        const stepInstructions = [
                          'Toque nas dezenas sorteadas recentemente para reaproveitá-las ou excluí-las.',
                          'Toque nas suas dezenas favoritas cadastradas para incluí-las nesta aposta.',
                          'Escolha dezenas avulsas na grade para o jogo ou deixe o gerador completar.',
                          'Defina a proporção de dezenas quentes/frias e o equilíbrio de pares/ímpares.',
                          'Selecione quantas dezenas por volante e a quantidade de palpites a gerar.',
                        ];
                        const currentStepInstruction =
                          stepInstructions[genSwipeStep] || stepInstructions[0];

                        return (
                          <div className="space-y-3.5">
                            {/* Cabeçalho de Instrução da Ferramenta (Sticky & Fullwidth) */}
                            <div className="sticky top-[126px] z-10 -mx-4 px-4 py-2.5 bg-white border-b border-[#E2E8F0] shadow-xs">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div
                                    className="w-7 h-7 rounded-[5px] flex items-center justify-center shrink-0"
                                    style={{
                                      backgroundColor: `${cfg.accentColor}18`,
                                      color: cfg.accentColor,
                                    }}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-[#1E293B] leading-snug">
                                      {currentStepInstruction}
                                    </p>
                                  </div>
                                </div>

                                {(genStep1Fixed.length > 0 ||
                                  genStep1Excluded.length > 0 ||
                                  genSelectedFavNumbers.length > 0 ||
                                  genFixedNumbers.length > 0 ||
                                  genExcludedNumbers.length > 0) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGenStep1Fixed([]);
                                      setGenStep1Excluded([]);
                                      setGenStep1Pending([]);
                                      setGenSelectedFavNumbers([]);
                                      setGenFixedNumbers([]);
                                      setGenExcludedNumbers([]);
                                      setGenStep3Pending([]);
                                      try {
                                        localStorage.removeItem('bvmega_gen_cache_' + genLotteryType);
                                      } catch {}
                                    }}
                                    className="text-[10px] font-bold text-[#DC2626] hover:underline shrink-0 cursor-pointer"
                                  >
                                    Zerar
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* CARROSSEL SWIPE HORIZONTAL (5 CARDS DE PERGUNTAS PASSO A PASSO) */}
                            <div
                              ref={swipeContainerRef}
                              onScroll={(e) => {
                                const el = e.currentTarget;
                                if (!el.clientWidth) return;
                                const idx = Math.round(el.scrollLeft / el.clientWidth);
                                if (idx >= 0 && idx <= 4 && idx !== genSwipeStep) {
                                  setGenSwipeStep(idx);
                                }
                              }}
                              className="flex items-start overflow-x-auto snap-x snap-mandatory gap-3 pb-1 scroll-smooth"
                            >
                              {/* ============================================================= */}
                              {/* PASSO 1: ÚLTIMOS 3 SORTEIOS (REAPROVEITAR OU EXCLUIR)         */}
                              {/* ============================================================= */}
                              <section className="w-full shrink-0 snap-center caixa-card p-3 flex flex-col space-y-2">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h4 className="text-xs font-extrabold text-[#1E293B]">
                                        Últimos 3 sorteios
                                      </h4>
                                      <span className="block text-[10px] text-[#5F6C7B]">
                                        Toque nas dezenas para Reaproveitar ou Excluir
                                      </span>
                                    </div>
                                    {(genStep1Fixed.length > 0 ||
                                      genStep1Excluded.length > 0 ||
                                      genStep1Pending.length > 0) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGenStep1Fixed([]);
                                          setGenStep1Excluded([]);
                                          setGenStep1Pending([]);
                                        }}
                                        className="text-[10px] font-bold text-[#DC2626] underline shrink-0 cursor-pointer"
                                      >
                                        Limpar
                                      </button>
                                    )}
                                  </div>

                                  {/* Aparece SOMENTE se alguma bola for selecionada (2 botões: Reaproveitar ou Excluir) */}
                                  {genStep1Pending.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleApplyStep1Action('FIX')}
                                        className="h-7 px-2 rounded-[5px] bg-[#008B47] hover:bg-[#00743B] text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <Pin className="w-3 h-3" />
                                        <span>Reaproveitar ({genStep1Pending.length})</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleApplyStep1Action('EXCLUDE')}
                                        className="h-7 px-2 rounded-[5px] bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <Ban className="w-3 h-3" />
                                        <span>Excluir ({genStep1Pending.length})</span>
                                      </button>
                                    </div>
                                  )}

                                  <div className="divide-y divide-[#E2E8F0] space-y-1.5">
                                    {recentList.map((contest, idx) => (
                                      <div
                                        key={contest.contestNumber}
                                        className={`flex items-center gap-2.5 ${
                                          idx > 0 ? 'pt-1.5' : ''
                                        }`}
                                      >
                                        <div className="shrink-0 flex flex-col justify-center leading-none">
                                          <span className="text-[10px] font-extrabold text-[#1E293B] font-mono-tabular whitespace-nowrap">
                                            Conc. {contest.contestNumber}
                                          </span>
                                          <span className="text-[9px] text-[#5F6C7B] font-mono-tabular whitespace-nowrap mt-0.5">
                                            {String(contest.drawDate || '').replace(
                                              /\/(\d{2})(\d{2})$/,
                                              '/$2'
                                            )}
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap gap-1 px-0 ml-0 py-0.5">
                                          {contest.drawnNumbers.map((num) => {
                                            const isPending = genStep1Pending.includes(num);
                                            const isFixed = genStep1Fixed.includes(num);
                                            const isExcluded = genStep1Excluded.includes(num);
                                            const isHot = lotteryStats.hotNumbers.some(
                                              (h) => h.number === num
                                            );

                                            let pillStyle =
                                              'bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6]';
                                            if (isPending) {
                                              pillStyle =
                                                'bg-[#1E293B] text-white border border-[#0F172A] ring-2 ring-[#94A3B8] scale-105';
                                            } else if (isFixed) {
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
                                                onClick={() => handleToggleStep1Number(num)}
                                                className={`w-5.5 h-5.5 rounded-full font-mono-tabular font-bold text-[10px] flex items-center justify-center transition-all cursor-pointer ${pillStyle}`}
                                                title="Toque para selecionar esta dezena"
                                              >
                                                {String(num).padStart(2, '0')}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => scrollToSwipeStep(1)}
                                    style={{ backgroundColor: cfg.accentColor }}
                                    className="h-7.5 px-3 rounded-[5px] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Avançar</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </section>

                              {/* ============================================================= */}
                              {/* PASSO 2: DEZENAS FAVORITAS                                    */}
                              {/* ============================================================= */}
                              <section className="w-full shrink-0 snap-center caixa-card p-4 flex flex-col justify-between space-y-3">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h3 className="text-xs font-extrabold text-[#1E293B] flex items-center gap-1.5 mt-0.5">
                                        <Heart className="w-4 h-4 text-[#005CA9]" />
                                        <span>Deseja usar alguma das suas Dezenas Favoritas?</span>
                                      </h3>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setActiveSection('DEZENAS_FAV')}
                                      className="text-[11px] font-bold text-[#005CA9] underline shrink-0 cursor-pointer"
                                    >
                                      Editar favoritas
                                    </button>
                                  </div>

                                  <div className="pt-2 border-t border-[#EDF2F7] space-y-2.5">
                                    {availableFavNumbers.length === 0 ? (
                                      <p className="text-xs text-[#64748B]">
                                        Suas dezenas favoritas foram excluídas no passo anterior ou ainda não foram cadastradas.
                                      </p>
                                    ) : (
                                      <div className="flex flex-wrap gap-2 py-2">
                                        {availableFavNumbers.map((n) => {
                                          const isSelected =
                                            effectiveFavSelected.includes(n) ||
                                            genStep1Fixed.includes(n);
                                          return (
                                            <button
                                              key={n}
                                              type="button"
                                              onClick={() => {
                                                if (genStep1Fixed.includes(n)) return;
                                                setGenSelectedFavNumbers((prev) =>
                                                  prev.includes(n)
                                                    ? prev.filter((item) => item !== n)
                                                    : [...prev, n].sort((a, b) => a - b)
                                                );
                                              }}
                                              className={`w-9 h-9 rounded-full font-mono-tabular font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                                                isSelected
                                                  ? 'bg-[#008B47] text-white border border-[#006835] shadow-xs scale-105'
                                                  : 'bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6] opacity-75 hover:opacity-100'
                                              }`}
                                              title={
                                                isSelected
                                                  ? 'Dezena selecionada para participar do jogo (toque para desmarcar)'
                                                  : 'Toque para incluir esta dezena favorita no jogo'
                                              }
                                            >
                                              {String(n).padStart(2, '0')}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                                      <span>
                                        Selecionadas:{' '}
                                        <strong className="text-[#008B47]">
                                          {effectiveFavSelected.length} favorita(s)
                                        </strong>
                                      </span>
                                      {availableFavNumbers.length > 0 && (
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setGenSelectedFavNumbers(availableFavNumbers)
                                            }
                                            className="text-[10px] font-bold text-[#008B47] underline cursor-pointer"
                                          >
                                            Marcar todas
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setGenSelectedFavNumbers([])}
                                            className="text-[10px] font-bold text-[#64748B] underline cursor-pointer"
                                          >
                                            Nenhuma
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => scrollToSwipeStep(0)}
                                    className="h-8 px-3 rounded-[5px] bg-[#F1F5F9] text-[#334155] text-[11px] font-bold cursor-pointer"
                                  >
                                    ← Anterior
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => scrollToSwipeStep(2)}
                                    style={{ backgroundColor: cfg.accentColor }}
                                    className="h-8 px-3.5 rounded-[5px] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Próximo: Grade ({step3GridNumbers.length} DZ)</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </section>

                              {/* ============================================================= */}
                              {/* PASSO 3: GRADE DE DEZENAS (COM BOLAS JÁ INCLUÍDAS E SEM EXCLUÍDAS) */}
                              {/* ============================================================= */}
                              <section className="w-full shrink-0 snap-center caixa-card p-4 flex flex-col justify-between space-y-3">
                                <div className="space-y-2.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h3 className="text-xs font-extrabold text-[#1E293B] mt-0.5">
                                        Deseja incluir ou excluir dezenas? ({step3GridNumbers.length} disponíveis)
                                      </h3>
                                    </div>
                                    {(genFixedNumbers.length > 0 ||
                                      genExcludedNumbers.length > 0 ||
                                      genStep3Pending.length > 0) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGenFixedNumbers([]);
                                          setGenExcludedNumbers([]);
                                          setGenStep3Pending([]);
                                        }}
                                        className="text-[10px] font-bold text-[#DC2626] underline shrink-0 cursor-pointer"
                                      >
                                        Limpar
                                      </button>
                                    )}
                                  </div>

                                  {/* Bolas já incluídas anteriormente (mostradas de cara) */}
                                  {allChosenNumbers.length > 0 && (
                                    <div className="bg-[#EBF7F0] border border-[#A7E3C0] rounded-[6px] p-2 space-y-1.5">
                                      <div className="flex items-center justify-between text-[11px] font-bold text-[#006835]">
                                        <span className="flex items-center gap-1.5">
                                          <Pin className="w-3.5 h-3.5 shrink-0" />
                                          <span>Bolas já incluídas no jogo ({allChosenNumbers.length}/{genDozensCount}):</span>
                                        </span>
                                        <span className="text-[10px] text-[#15803D] font-normal">
                                          Toque para desmarcar
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {allChosenNumbers.map((num) => (
                                          <button
                                            key={num}
                                            type="button"
                                            onClick={() => handleToggleStep3Number(num)}
                                            title="Toque para desmarcar esta dezena"
                                            className="w-7 h-7 rounded-full bg-[#008B47] hover:bg-[#DC2626] text-white font-mono-tabular text-xs font-bold flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                          >
                                            {String(num).padStart(2, '0')}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Bolas já excluídas (duplicada da caixa acima, referindo-se às dezenas excluídas) */}
                                  {allEliminatedNumbers.length > 0 && (
                                    <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] p-2 space-y-1.5">
                                      <div className="flex items-center justify-between text-[11px] font-bold text-[#DC2626]">
                                        <span className="flex items-center gap-1.5">
                                          <Ban className="w-3.5 h-3.5 shrink-0" />
                                          <span>Bolas já excluídas ({allEliminatedNumbers.length}):</span>
                                        </span>
                                        <span className="text-[10px] text-[#B91C1C] font-normal">
                                          Toque para reintegrar
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {allEliminatedNumbers.map((num) => (
                                          <button
                                            key={num}
                                            type="button"
                                            onClick={() => handleToggleStep3Number(num)}
                                            title="Toque para reintegrar esta dezena à grade"
                                            className="w-7 h-7 rounded-full bg-[#DC2626] hover:bg-[#008B47] text-white font-mono-tabular text-xs font-bold flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                          >
                                            {String(num).padStart(2, '0')}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {allChosenNumbers.length === 0 && allEliminatedNumbers.length === 0 && (
                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] px-2.5 py-1.5 text-[11px] text-[#64748B] flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-[#94A3B8] shrink-0" />
                                      <span>Nenhuma dezena incluída ou excluída até o momento. Selecione na grade abaixo para incluir ou excluir.</span>
                                    </div>
                                  )}

                                  {/* Aparece SOMENTE se alguma dezena for selecionada (2 botões: Incluir ou Excluir) */}
                                  {genStep3Pending.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleApplyStep3Action('FIX')}
                                        className="h-8 px-2 rounded-[5px] bg-[#008B47] hover:bg-[#00743B] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                      >
                                        <Pin className="w-3.5 h-3.5" />
                                        <span>Incluir ({genStep3Pending.length})</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleApplyStep3Action('EXCLUDE')}
                                        className="h-8 px-2 rounded-[5px] bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                      >
                                        <Ban className="w-3.5 h-3.5" />
                                        <span>Excluir ({genStep3Pending.length})</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* Grade de Dezenas: NÃO MOSTRA bolas excluídas */}
                                  <div className="grid grid-cols-10 gap-1.5 pt-1">
                                    {step3GridNumbers.map((num) => {
                                      const isPending = genStep3Pending.includes(num);
                                      const isFixed = allChosenSet.has(num);
                                      const isHot = lotteryStats.hotNumbers.some(
                                        (h) => h.number === num
                                      );

                                      let btnClass =
                                        'bg-[#F1F5F9] text-[#333E48] hover:bg-[#E2E8F0] border border-transparent';
                                      if (isPending) {
                                        btnClass =
                                          'bg-[#1E293B] text-white border border-[#0F172A] ring-2 ring-[#94A3B8] scale-105';
                                      } else if (isFixed) {
                                        btnClass = 'bg-[#008B47] text-white border-[#006835]';
                                      } else if (isHot) {
                                        btnClass = 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
                                      }

                                      return (
                                        <button
                                          key={num}
                                          type="button"
                                          onClick={() => handleToggleStep3Number(num)}
                                          className={`h-7 rounded-[4px] font-mono-tabular text-[11px] font-bold transition-colors cursor-pointer ${btnClass}`}
                                        >
                                          {String(num).padStart(2, '0')}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => scrollToSwipeStep(1)}
                                    className="h-8 px-3 rounded-[5px] bg-[#F1F5F9] text-[#334155] text-[11px] font-bold cursor-pointer"
                                  >
                                    ← Anterior
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => scrollToSwipeStep(3)}
                                    style={{ backgroundColor: cfg.accentColor }}
                                    className="h-8 px-3.5 rounded-[5px] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Próximo: Quentes / Frias</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </section>

                              {/* ============================================================= */}
                              {/* PASSO 4: PROPOSTA MAIS QUENTE OU MAIS FRIA + PAR/ÍMPAR        */}
                              {/* ============================================================= */}
                              <section className="w-full shrink-0 snap-center caixa-card p-4 flex flex-col justify-between space-y-3">
                                <div className="space-y-3">
                                  <div>
                                    <h3 className="text-xs font-extrabold text-[#1E293B] mt-0.5">
                                      Deseja uma proposta mais Quente, mais Fria ou Equilibrada?
                                    </h3>
                                  </div>

                                  {/* Destaques de Quentes e Frias disponíveis no universo restante */}
                                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                                    <div className="p-2 rounded-[6px] bg-[#FFFBEB]/60 border border-[#FDE68A]">
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-[#D97706] mb-1">
                                        <Flame className="w-3 h-3 text-[#D97706]" />
                                        <span>Mais Quentes Restantes</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {lotteryStats.hotNumbers
                                          .filter(
                                            (item) =>
                                              !allEliminatedNumbers.includes(item.number)
                                          )
                                          .slice(0, 6)
                                          .map((item) => (
                                            <span
                                              key={item.number}
                                              className="px-1.5 py-0.5 rounded-[4px] bg-white border border-[#FDE68A] text-[#B45309] font-mono-tabular text-[10px] font-bold"
                                            >
                                              {String(item.number).padStart(2, '0')}{' '}
                                              <span className="text-[9px] font-normal">
                                                ({item.drawnCount}x)
                                              </span>
                                            </span>
                                          ))}
                                      </div>
                                    </div>

                                    <div className="p-2 rounded-[6px] bg-[#EBF4FC]/60 border border-[#BFDBFE]">
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-[#005CA9] mb-1">
                                        <Snowflake className="w-3 h-3 text-[#005CA9]" />
                                        <span>Mais Frias Restantes</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {lotteryStats.coldNumbers
                                          .filter(
                                            (item) =>
                                              !allEliminatedNumbers.includes(item.number)
                                          )
                                          .slice(0, 6)
                                          .map((item) => (
                                            <span
                                              key={item.number}
                                              className="px-1.5 py-0.5 rounded-[4px] bg-white border border-[#BFDBFE] text-[#005CA9] font-mono-tabular text-[10px] font-bold"
                                            >
                                              {String(item.number).padStart(2, '0')}{' '}
                                              <span className="text-[9px] font-normal">
                                                ({item.drawnCount}x)
                                              </span>
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGenMixPreset('BALANCED');
                                        setGenHotPercentage(50);
                                      }}
                                      className={`h-8 px-2 rounded-[5px] text-[11px] font-bold transition-colors cursor-pointer ${
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
                                      className={`h-8 px-2 rounded-[5px] text-[11px] font-bold transition-colors cursor-pointer ${
                                        genMixPreset === 'HOT_FOCUS'
                                          ? 'bg-[#D97706] text-white'
                                          : 'bg-[#F1F5F9] text-[#5F6C7B]'
                                      }`}
                                    >
                                      Mais Quentes (80%)
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGenMixPreset('COLD_FOCUS');
                                        setGenHotPercentage(20);
                                      }}
                                      className={`h-8 px-2 rounded-[5px] text-[11px] font-bold transition-colors cursor-pointer ${
                                        genMixPreset === 'COLD_FOCUS'
                                          ? 'bg-[#005CA9] text-white'
                                          : 'bg-[#F1F5F9] text-[#5F6C7B]'
                                      }`}
                                    >
                                      Mais Frias (80%)
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGenMixPreset('PURE_RANDOM');
                                      }}
                                      className={`h-8 px-2 rounded-[5px] text-[11px] font-bold transition-colors cursor-pointer ${
                                        genMixPreset === 'PURE_RANDOM'
                                          ? 'bg-[#333E48] text-white'
                                          : 'bg-[#F1F5F9] text-[#5F6C7B]'
                                      }`}
                                    >
                                      Aleatório Livre
                                    </button>
                                  </div>

                                  {genMixPreset !== 'PURE_RANDOM' && (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-[#D97706] flex items-center gap-1 font-mono-tabular">
                                          <Flame className="w-3.5 h-3.5" />
                                          {genHotPercentage}% Quentes
                                        </span>
                                        <span className="text-[#005CA9] flex items-center gap-1 font-mono-tabular">
                                          {100 - genHotPercentage}% Frias
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
                                    </div>
                                  )}

                                  {/* Equilíbrio Pares / Ímpares */}
                                  <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-[#334155]">
                                      Equilibrar Pares e Ímpares automaticamente
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setGenBalanceParity((prev) => !prev)}
                                      className={`h-7 px-2.5 rounded-[5px] text-[10px] font-bold transition-colors cursor-pointer shrink-0 ${
                                        genBalanceParity
                                          ? 'bg-[#008B47] text-white'
                                          : 'bg-[#E2E8F0] text-[#64748B]'
                                      }`}
                                    >
                                      {genBalanceParity ? 'Sim (Equilibrado)' : 'Livre'}
                                    </button>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => scrollToSwipeStep(2)}
                                    className="h-8 px-3 rounded-[5px] bg-[#F1F5F9] text-[#334155] text-[11px] font-bold cursor-pointer"
                                  >
                                    ← Anterior
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => scrollToSwipeStep(4)}
                                    style={{ backgroundColor: cfg.accentColor }}
                                    className="h-8 px-3.5 rounded-[5px] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Próximo: Confeccionar</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </section>

                              {/* ============================================================= */}
                              {/* PASSO 5: QUANTIDADE E BOTÃO GERAR JOGOS                       */}
                              {/* ============================================================= */}
                              <section className="w-full shrink-0 snap-center caixa-card p-4 flex flex-col justify-between space-y-3">
                                <div className="space-y-3">
                                  <div>
                                    <h3 className="text-xs font-extrabold text-[#1E293B] mt-0.5">
                                      Quantas dezenas e quantos jogos deseja confeccionar?
                                    </h3>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div>
                                      <label className="block text-[11px] font-semibold text-[#333E48] mb-1">
                                        Dezenas por Jogo:
                                      </label>
                                      <select
                                        value={genDozensCount}
                                        onChange={(e) => setGenDozensCount(Number(e.target.value))}
                                        className="caixa-input font-mono-tabular font-bold"
                                      >
                                        {Object.keys(cfg.priceTable).map((dStr) => {
                                          const d = Number(dStr);
                                          const pInfo = cfg.priceTable[d];
                                          return (
                                            <option key={d} value={d}>
                                              {d} dezenas ({formatCurrencyBRL(pInfo.price)})
                                            </option>
                                          );
                                        })}
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
                                            {cnt} {cnt === 1 ? 'jogo' : 'jogos de uma vez'}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Resumo das Escolhas do Funil */}
                                  <div className="p-2.5 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#334155] space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span>Dezenas já escolhidas/favoritas:</span>
                                      <strong className="font-mono-tabular text-[#008B47]">
                                        {allChosenNumbers.length} de {genDozensCount} DZ
                                      </strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>Dezenas descartadas no funil:</span>
                                      <strong className="font-mono-tabular text-[#DC2626]">
                                        {allEliminatedNumbers.length} excluídas
                                      </strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>Preenchimento das restantes:</span>
                                      <strong className="text-[#005CA9]">
                                        {genMixPreset === 'PURE_RANDOM'
                                          ? 'Aleatório Livre'
                                          : `${genHotPercentage}% Quentes / ${
                                              100 - genHotPercentage
                                            }% Frias`}
                                      </strong>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleExecuteGenerator}
                                    style={{ backgroundColor: cfg.accentColor }}
                                    className="w-full h-11 rounded-[6px] text-white font-display font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                                  >
                                    <Wand2 className="w-4 h-4" />
                                    <span>
                                      Gerar {genGamesCount}{' '}
                                      {genGamesCount === 1 ? 'Jogo' : 'Jogos'} — {modalityTitle}
                                    </span>
                                  </button>
                                </div>

                                <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-start">
                                  <button
                                    type="button"
                                    onClick={() => scrollToSwipeStep(3)}
                                    className="h-8 px-3 rounded-[5px] bg-[#F1F5F9] text-[#334155] text-[11px] font-bold cursor-pointer"
                                  >
                                    ← Voltar para Quentes / Frias
                                  </button>
                                </div>
                              </section>
                            </div>
                          </div>
                        );
                      })()}

                      {/* =============================================================== */}
                      {/* PAINEL PÓS-GERAÇÃO: DESTINO DOS JOGOS GERADOS                   */}
                      {/* (Meus Jogos | Favoritos | Bolão | Imprimir | Copiar)            */}
                      {/* =============================================================== */}
                      <div ref={generatedResultsRef}>
                        {(() => {
                          const filteredPalpites = generatedPalpites.filter(
                            (p) => p.lotteryType === activeLt
                          );

                          if (filteredPalpites.length === 0) {
                            return null;
                          }

                          const latestDrawn = lotteryStats.latestContest?.drawnNumbers || [];

                          return (
                            <section className="caixa-card p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2 border-b border-[#EDF2F7] pb-2.5">
                                <h3 className="text-xs font-extrabold text-[#1E293B] flex items-center gap-1.5">
                                  <Ticket className="w-4 h-4 text-[#008B47]" />
                                  <span>Jogos Confeccionados ({filteredPalpites.length})</span>
                                </h3>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setGeneratedPalpites((prev) =>
                                      prev.filter((p) => p.lotteryType !== activeLt)
                                    )
                                  }
                                  className="text-[10px] font-bold text-[#DC2626] hover:underline shrink-0 cursor-pointer"
                                >
                                  Limpar lista
                                </button>
                              </div>

                              <div className="divide-y divide-[#E2E8F0]">
                                {filteredPalpites.map((item, idx) => {
                                  const isSent = !!sentPalpiteIds[item.id];
                                  const isEffective = !!effectivePalpiteIds[item.id];
                                  const isSavedFav = !!savedPalpiteIds[item.id];
                                  const isCopied = copiedId === item.id;
                                  return (
                                    <div key={item.id} className="py-3 space-y-2.5">
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-extrabold text-[#1E293B] bg-[#F1F5F9] px-2 py-0.5 rounded-[4px]">
                                            Jogo #{String(idx + 1).padStart(2, '0')}
                                          </span>
                                          <span className="font-mono-tabular text-xs font-semibold text-[#5F6C7B]">
                                            {item.numbers.length} Dezenas
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2.5">
                                          <span className="font-mono-tabular text-[10px] text-[#64748B]">
                                            Chance: 1 em {item.probabilityOneIn.toLocaleString('pt-BR')}
                                          </span>
                                          <span className="font-mono-tabular text-xs font-extrabold text-[#008B47] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-[4px]">
                                            {formatCurrencyBRL(item.cost)}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-1.5">
                                        {item.numbers.map((n) => {
                                          const isHit = latestDrawn.includes(n);
                                          const isFix = item.fromFixed.includes(n);
                                          const isFav = item.fromFavorites.includes(n);

                                          let badgeStyle = 'bg-[#EBF4FC] text-[#005CA9]';
                                          if (isHit) {
                                            badgeStyle =
                                              'bg-[#008B47] text-white ring-2 ring-[#86EFAC]';
                                          } else if (isFix) {
                                            badgeStyle = 'bg-[#008B47] text-white';
                                          } else if (isFav) {
                                            badgeStyle = 'bg-[#005CA9] text-white';
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

                                      {/* Ação direta: Adicionar a Meus Jogos */}
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleEfetivarPalpite(item, idx)}
                                          className="w-full h-8 px-3 rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-[#008B47] hover:bg-[#00743B] text-white shadow-2xs"
                                          title="Adicionar à seção Meus Jogos para registrar na lotérica e conferir"
                                        >
                                          <Ticket className="w-3.5 h-3.5" />
                                          <span>+ Adicionar em Meus Jogos</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}

          {/* =============================================================== */}
          {/* NOVA SEÇÃO "MEUS JOGOS": ABAS "REALIZADOS" E "CONFERIDOS"       */}
          {/* =============================================================== */}
          {activeSection === 'MEUS_JOGOS' &&
            (() => {
              const activeLt = genLotteryType;
              const cfg = LOTTERY_CONFIGS[activeLt];

              const filteredByLottery = userEffectiveGames.filter(
                (g) => g.lotteryType === activeLt
              );
              const aFazerGames = filteredByLottery.filter((g) => g.status === 'A_FAZER');
              const feitosGames = filteredByLottery.filter((g) => g.status === 'FEITO');
              const displayedEffectiveGames =
                realizadosFilter === 'FEITO' ? feitosGames : aFazerGames;

              const totalAFazerCost = aFazerGames.reduce((acc, g) => acc + g.cost, 0);
              const totalFeitoCost = feitosGames.reduce((acc, g) => acc + g.cost, 0);

              const officialDrawn = lotteryStats.latestContest?.drawnNumbers || [];
              const manualDrawn = manualDrawnByLottery[activeLt] || [];
              const activeDrawnBalls =
                conferidorMode === 'AUTOMATICA' ? officialDrawn : manualDrawn;
              const requiredBalls = evaluatePrizeTier(activeLt, 0).requiredDrawnCount;

              const evaluatedGames = filteredByLottery.map((g, idx) => {
                const hits = g.numbers.filter((n) => activeDrawnBalls.includes(n));
                const evaluation = evaluatePrizeTier(activeLt, hits.length);
                return {
                  game: g,
                  index: idx,
                  hits,
                  hitsCount: hits.length,
                  evaluation,
                };
              });

              const awardedCount = evaluatedGames.filter(
                (e) => e.evaluation.isAwarded
              ).length;

              return (
                <div className="space-y-3.5">
                  {/* Cabeçalho de Meus Jogos: Seletor de Loteria com Logo + Abas Realizados e Conferidos */}
                  <section className="caixa-card p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-[#EDF2F7] pb-2.5">
                      <img
                        src={cfg.logoUrl}
                        alt={cfg.name}
                        className="h-6 w-auto max-w-[155px] object-contain rounded-[3px]"
                      />

                      <button
                        type="button"
                        onClick={() => setIsLotteryMenuOpen((prev) => !prev)}
                        className="h-8 px-2.5 rounded-[4px] bg-[#EBF4FC] hover:bg-[#D5E8FA] text-[#005CA9] text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>Trocar Loteria</span>
                        {isLotteryMenuOpen ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {isLotteryMenuOpen && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1 pb-2 border-b border-[#EDF2F7]">
                        {ALL_LOTTERY_TYPES.map((lt) => {
                          const isSelected = activeLt === lt;
                          const count = userEffectiveGames.filter(
                            (g) => g.lotteryType === lt
                          ).length;
                          return (
                            <button
                              key={lt}
                              type="button"
                              onClick={() => {
                                setGenLotteryType(lt);
                                setIsLotteryMenuOpen(false);
                              }}
                              className={`h-9 px-2.5 rounded-[4px] text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#005CA9] text-white'
                                  : 'bg-[#F1F5F9] text-[#1E293B] hover:bg-[#E2E8F0]'
                              }`}
                            >
                              <span className="truncate">{LOTTERY_CONFIGS[lt].name}</span>
                              <span
                                className={`text-[10px] font-mono-tabular shrink-0 ml-1 ${
                                  isSelected ? 'text-white/85' : 'text-[#5F6C7B]'
                                }`}
                              >
                                ({count})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Abas de Meus Jogos: 1. Realizados | 2. Conferidos */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setJogosSubTab('REALIZADOS')}
                        className={`h-9 px-3 rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          jogosSubTab !== 'CONFERIDOR'
                            ? 'bg-[#005CA9] text-white'
                            : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                        }`}
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>Realizados ({filteredByLottery.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setJogosSubTab('CONFERIDOR')}
                        className={`h-9 px-3 rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          jogosSubTab === 'CONFERIDOR'
                            ? 'bg-[#008B47] text-white'
                            : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Conferidos</span>
                      </button>
                    </div>
                  </section>

                  {/* ABA 1: REALIZADOS (CONFIRMADO E REGISTRADO) */}
                  {jogosSubTab !== 'CONFERIDOR' && (
                    <div className="space-y-3">
                      <section className="caixa-card p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-extrabold text-[#1E293B]">
                              Jogos Realizados · {cfg.name}
                            </h4>
                            <p className="text-[11px] text-[#5F6C7B]">
                              Controle de jogos confirmados e registrados na casa lotérica
                            </p>
                          </div>

                          {displayedEffectiveGames.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handlePrintPersonalGames(
                                  displayedEffectiveGames,
                                  activeLt,
                                  `Jogos Lotérica (${cfg.name}) — ${currentUser.name}`
                                )
                              }
                              className="h-8 px-2.5 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Imprimir</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 rounded-[4px] bg-[#FFFBEB] border border-[#FDE68A]">
                            <span className="text-[10px] font-semibold text-[#B45309] block">
                              Confirmado ({aFazerGames.length})
                            </span>
                            <span className="font-mono-tabular text-xs font-extrabold text-[#B45309]">
                              {formatCurrencyBRL(totalAFazerCost)}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-[4px] bg-[#F0FDF4] border border-[#BBF7D0]">
                            <span className="text-[10px] font-semibold text-[#008B47] block">
                              Registrado ({feitosGames.length})
                            </span>
                            <span className="font-mono-tabular text-xs font-extrabold text-[#008B47]">
                              {formatCurrencyBRL(totalFeitoCost)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setRealizadosFilter('A_FAZER')}
                            className={`h-8 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                              realizadosFilter === 'A_FAZER'
                                ? 'bg-[#D97706] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                            }`}
                          >
                            Confirmado ({aFazerGames.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRealizadosFilter('FEITO')}
                            className={`h-8 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                              realizadosFilter === 'FEITO'
                                ? 'bg-[#008B47] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                            }`}
                          >
                            Registrado ({feitosGames.length})
                          </button>
                        </div>
                      </section>

                      {displayedEffectiveGames.length === 0 ? (
                        <section className="caixa-card p-6 text-center space-y-3">
                          <div className="w-10 h-10 rounded-full bg-[#EBF4FC] text-[#005CA9] flex items-center justify-center mx-auto">
                            <Ticket className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-[#1E293B]">
                              Nenhum jogo realizado em {cfg.name}
                            </h4>
                            <p className="text-xs text-[#5F6C7B]">
                              Abra a loteria em Loterias, crie seu jogo e toque em Efetivar.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMeusJogosSelectedLottery(activeLt);
                              setMeusJogosContestMode('REGULAR');
                              setGenContestMode('REGULAR');
                              setActiveSection('PALPITES');
                            }}
                            className="h-9 px-4 rounded-[4px] bg-[#008B47] text-white text-xs font-bold cursor-pointer"
                          >
                            Criar Jogo em {cfg.name}
                          </button>
                        </section>
                      ) : (
                        <div className="space-y-2.5">
                          {displayedEffectiveGames.map((eff, idx) => {
                            const isFeito = eff.status === 'FEITO';
                            const effModality = getModalityDisplayName(
                              eff.lotteryType,
                              eff.contestMode || 'REGULAR'
                            );

                            return (
                              <section
                                key={eff.id}
                                className="caixa-card p-3.5 space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold text-[#1E293B]">
                                      Jogo #{String(idx + 1).padStart(2, '0')} · {effModality}
                                    </span>
                                    <span className="text-[11px] text-[#5F6C7B] ml-1.5">
                                      (Conc. {eff.contestNumber})
                                    </span>
                                  </div>
                                  <span className="font-mono-tabular text-xs font-extrabold text-[#008B47] shrink-0">
                                    {eff.numbers.length} DZ - {formatCurrencyBRL(eff.cost)}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  {eff.numbers.map((num) => (
                                    <span
                                      key={num}
                                      className={`w-7 h-7 rounded-full font-mono-tabular font-bold text-xs flex items-center justify-center ${
                                        isFeito
                                          ? 'bg-[#DCFCE7] text-[#008B47]'
                                          : 'bg-[#EBF4FC] text-[#005CA9]'
                                      }`}
                                    >
                                      {String(num).padStart(2, '0')}
                                    </span>
                                  ))}
                                </div>

                                {(() => {
                                  const isEffFav = userFavoriteGames.some(
                                    (f) =>
                                      f.lotteryType === eff.lotteryType &&
                                      f.numbers.length === eff.numbers.length &&
                                      f.numbers.every((n, i) => n === eff.numbers[i])
                                  );
                                  const isEffSent = !!sentPalpiteIds[eff.id];

                                  return (
                                    <div className="flex items-center justify-between gap-1.5 pt-2.5 border-t border-[#EDF2F7] flex-nowrap w-full">
                                      {/* Lado esquerdo: Registrado + Compartilhar com largura uniforme e responsiva */}
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setConfirmModal({
                                              isOpen: true,
                                              title: isFeito ? 'Desmarcar Registro' : 'Marcar como Registrado',
                                              description: isFeito
                                                ? `Deseja alterar o status do Jogo #${idx + 1} de volta para "Confirmado"?`
                                                : `Confirma que o Jogo #${idx + 1} foi registrado na casa lotérica?`,
                                              confirmText: 'Sim',
                                              cancelText: 'Não',
                                              onConfirm: () => handleToggleEffectiveStatus(eff.id),
                                            });
                                          }}
                                          className={`flex-1 h-8 px-2 rounded-[4px] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                            isFeito
                                              ? 'bg-[#008B47] text-white shadow-2xs'
                                              : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] border border-[#CBD5E1]'
                                          }`}
                                          title={
                                            isFeito
                                              ? 'Jogo registrado na lotérica (toque para desmarcar)'
                                              : 'Toque para marcar como Registrado'
                                          }
                                        >
                                          <CheckCircle2
                                            className={`w-3.5 h-3.5 shrink-0 ${
                                              isFeito ? 'text-white' : 'text-[#94A3B8]'
                                            }`}
                                          />
                                          <span className="truncate">Registrado</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setShareGameModal({ game: eff, index: idx })}
                                          className="flex-1 h-8 px-2 rounded-[4px] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-[#005CA9] hover:bg-[#004A87] text-white shrink-0 shadow-2xs whitespace-nowrap"
                                          title="Compartilhar este jogo"
                                        >
                                          <Share2 className="w-3.5 h-3.5 shrink-0" />
                                          <span className="truncate">Compartilhar</span>
                                        </button>
                                      </div>

                                      {/* Lado direito: Favoritos e Excluir uniformes em ícones na mesma linha */}
                                      <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
                                        <button
                                          type="button"
                                          disabled={isEffFav}
                                          onClick={() => {
                                            if (isEffFav) {
                                              onNotify?.('Este jogo já está nos seus Favoritos!');
                                              return;
                                            }
                                            setConfirmModal({
                                              isOpen: true,
                                              title: 'Salvar nos Favoritos',
                                              description: `Deseja adicionar o Jogo #${idx + 1} (${eff.numbers.length} dezenas) aos seus Jogos Favoritos?`,
                                              confirmText: 'Sim',
                                              cancelText: 'Não',
                                              onConfirm: () => handleSaveEffectiveToFavorites(eff, idx),
                                            });
                                          }}
                                          className={`h-8 w-8 rounded-[4px] flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                            isEffFav
                                              ? 'bg-[#FCE7F3] text-[#BE185D]'
                                              : 'bg-[#EBF4FC] hover:bg-[#DBEAFE] text-[#005CA9]'
                                          }`}
                                          title={isEffFav ? 'Salvo em Meus Favoritos' : 'Salvar em Favoritos'}
                                        >
                                          <Heart className="w-3.5 h-3.5 shrink-0" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setConfirmModal({
                                              isOpen: true,
                                              title: 'Excluir Jogo',
                                              description: `Deseja realmente excluir o Jogo #${idx + 1} da sua lista de jogos realizados?`,
                                              confirmText: 'Sim',
                                              cancelText: 'Não',
                                              isDestructive: true,
                                              onConfirm: () => handleDeleteEffectiveGame(eff.id),
                                            });
                                          }}
                                          className="h-8 w-8 rounded-[4px] text-[#DC2626] hover:bg-[#FEF2F2] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                          title="Excluir"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA 2: CONFERIDOS (CONFERÊNCIA AUTOMÁTICA OU MANUAL) */}
                  {jogosSubTab === 'CONFERIDOR' && (
                    <div className="space-y-3">
                      <section className="caixa-card p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-extrabold text-[#1E293B]">
                              Jogos Conferidos · {cfg.name}
                            </h4>
                            <p className="text-[11px] text-[#5F6C7B]">
                              {conferidorMode === 'AUTOMATICA'
                                ? `Resultado automático · Conc. ${lotteryStats.latestContest?.contestNumber} (${lotteryStats.latestContest?.drawDate})`
                                : `Selecione manualmente as ${requiredBalls} bolas sorteadas`}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConferidorMode('AUTOMATICA')}
                            className={`h-9 rounded-[4px] text-xs font-bold transition-colors cursor-pointer ${
                              conferidorMode === 'AUTOMATICA'
                                ? 'bg-[#005CA9] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                            }`}
                          >
                            Automática
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConferidorMode('MANUAL');
                              if (
                                (!manualDrawnByLottery[activeLt] ||
                                  manualDrawnByLottery[activeLt]?.length === 0) &&
                                officialDrawn.length > 0
                              ) {
                                setManualDrawnByLottery((prev) => ({
                                  ...prev,
                                  [activeLt]: [...officialDrawn],
                                }));
                              }
                            }}
                            className={`h-9 rounded-[4px] text-xs font-bold transition-colors cursor-pointer ${
                              conferidorMode === 'MANUAL'
                                ? 'bg-[#005CA9] text-white'
                                : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                            }`}
                          >
                            Manual
                          </button>
                        </div>

                        {conferidorMode === 'AUTOMATICA' ? (
                          <div className="pt-2 border-t border-[#EDF2F7] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#1E293B]">
                                Bolas Sorteadas (Conc. {lotteryStats.latestContest?.contestNumber}):
                              </span>
                              <button
                                type="button"
                                onClick={() => fetchLotteryStatsFromApi(activeLt)}
                                className="text-[11px] font-bold text-[#005CA9] flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Atualizar</span>
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {officialDrawn.map((num) => (
                                <span
                                  key={num}
                                  className="w-8 h-8 rounded-full bg-[#008B47] text-white font-mono-tabular font-bold text-xs flex items-center justify-center"
                                >
                                  {String(num).padStart(2, '0')}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-[#EDF2F7] space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-[#1E293B] font-mono-tabular">
                                Bolas Sorteadas: {manualDrawn.length}/{requiredBalls}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setManualDrawnByLottery((prev) => ({
                                      ...prev,
                                      [activeLt]: [...officialDrawn],
                                    }))
                                  }
                                  className="h-7 px-2.5 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] text-[10px] font-bold cursor-pointer"
                                >
                                  Puxar Sorteio
                                </button>
                                <button
                                  type="button"
                                  onClick={handleClearManualDrawnBalls}
                                  className="h-7 px-2.5 rounded-[4px] bg-[#FEF2F2] text-[#DC2626] text-[10px] font-bold cursor-pointer"
                                >
                                  Limpar
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-10 gap-1">
                              {Array.from(
                                { length: cfg.totalPoolNumbers },
                                (_, i) => i + 1
                              ).map((num) => {
                                const isPicked = manualDrawn.includes(num);
                                return (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleToggleManualDrawnBall(num)}
                                    className={`h-7 rounded-[4px] font-mono-tabular text-[11px] font-bold transition-colors cursor-pointer ${
                                      isPicked
                                        ? 'bg-[#008B47] text-white'
                                        : 'bg-[#F1F5F9] text-[#333E48] hover:bg-[#E2E8F0]'
                                    }`}
                                  >
                                    {String(num).padStart(2, '0')}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </section>

                      {/* Resumo de Premiação */}
                      <section className="caixa-card p-3.5">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2.5 rounded-[4px] bg-[#F0FDF4] border border-[#BBF7D0]">
                            <span className="text-[10px] font-bold text-[#008B47] block">
                              Jogos Premiados
                            </span>
                            <span className="font-mono-tabular text-base font-extrabold text-[#008B47]">
                              {awardedCount}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0]">
                            <span className="text-[10px] font-bold text-[#5F6C7B] block">
                              Não Premiados
                            </span>
                            <span className="font-mono-tabular text-base font-extrabold text-[#1E293B]">
                              {Math.max(0, evaluatedGames.length - awardedCount)}
                            </span>
                          </div>
                        </div>
                      </section>

                      {/* Lista de Jogos Conferidos */}
                      {evaluatedGames.length === 0 ? (
                        <section className="caixa-card p-6 text-center space-y-2">
                          <p className="text-xs font-bold text-[#1E293B]">
                            Nenhum jogo efetivado para conferir em {cfg.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setMeusJogosSelectedLottery(activeLt);
                              setMeusJogosContestMode('REGULAR');
                              setGenContestMode('REGULAR');
                              setActiveSection('PALPITES');
                            }}
                            className="h-9 px-4 rounded-[4px] bg-[#008B47] text-white text-xs font-bold cursor-pointer"
                          >
                            Criar Jogo em {cfg.name}
                          </button>
                        </section>
                      ) : (
                        <div className="space-y-2.5">
                          {evaluatedGames.map(({ game, index, hitsCount, evaluation }) => {
                            const gameModality = getModalityDisplayName(
                              game.lotteryType,
                              game.contestMode || 'REGULAR'
                            );
                            return (
                              <section
                                key={game.id}
                                className={`caixa-card p-3.5 space-y-2.5 border ${
                                  evaluation.isAwarded
                                    ? 'border-[#008B47] bg-[#F0FDF4]/40'
                                    : 'border-[#DCE5F0]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-xs font-bold text-[#1E293B]">
                                      Jogo #{String(index + 1).padStart(2, '0')} · {gameModality}
                                    </span>
                                    <span className="font-mono-tabular text-[11px] font-bold text-[#5F6C7B] ml-1.5">
                                      · {game.numbers.length} DZ - {formatCurrencyBRL(game.cost)}
                                    </span>
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded-[4px] text-[10px] font-extrabold shrink-0 ${
                                      evaluation.isAwarded
                                        ? 'bg-[#008B47] text-white'
                                        : 'bg-[#F1F5F9] text-[#5F6C7B]'
                                    }`}
                                  >
                                    {evaluation.isAwarded
                                      ? `PREMIADO · ${evaluation.tierLabel}`
                                      : `Não premiado (${hitsCount} ${
                                          hitsCount === 1 ? 'acerto' : 'acertos'
                                        })`}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  {game.numbers.map((num) => {
                                    const isHit = activeDrawnBalls.includes(num);
                                    return (
                                      <span
                                        key={num}
                                        className={`w-7 h-7 rounded-full font-mono-tabular font-bold text-xs flex items-center justify-center ${
                                          isHit
                                            ? 'bg-[#008B47] text-white ring-2 ring-[#86EFAC]'
                                            : 'bg-[#F1F5F9] text-[#5F6C7B]'
                                        }`}
                                      >
                                        {String(num).padStart(2, '0')}
                                      </span>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-[#5F6C7B] pt-1 border-t border-[#EDF2F7]">
                                  <span>
                                    Status:{' '}
                                    <strong
                                      className={
                                        game.status === 'FEITO'
                                          ? 'text-[#008B47]'
                                          : 'text-[#B45309]'
                                      }
                                    >
                                      {game.status === 'FEITO'
                                        ? 'Registrado'
                                        : 'Confirmado'}
                                    </strong>
                                  </span>
                                  <span className="font-mono-tabular font-bold text-[#1E293B]">
                                    {hitsCount} de {game.numbers.length} dezenas acertadas
                                  </span>
                                </div>
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

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
              const selectedItem = allYearPools.find(
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

                          {/* Ações Rápidas apenas para bolões ativos (2026) */}
                          {item.year === '2026' && (
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
                          )}
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

                          {/* 3ª Lista: Jogos Propostos (apenas em bolões ativos) */}
                          {item.year === '2026' && (
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
                        )}
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
              // LISTA DE CARDS DE BOLÕES (2 COLUNAS: BOLÃO QUE PARTICIPO | BOLÕES ANTERIORES)
              // =============================================================
              const currentPools = allYearPools.filter((p) => p.year === '2026');
              const previousPools = allYearPools.filter((p) => p.year !== '2026');
              const displayedYearPools =
                boloesFilter === 'PARTICIPO' ? currentPools : previousPools;

              return (
                <div className="space-y-3">
                  <div className="caixa-card p-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setBoloesFilter('PARTICIPO');
                          setSelectedGroupItemId(null);
                        }}
                        className={`h-10 px-2 rounded-[4px] text-xs font-bold transition-colors cursor-pointer ${
                          boloesFilter === 'PARTICIPO'
                            ? 'bg-[#005CA9] text-white'
                            : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                        }`}
                      >
                        Bolão que Participo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBoloesFilter('ANTERIORES');
                          setSelectedGroupItemId(null);
                        }}
                        className={`h-10 px-2 rounded-[4px] text-xs font-bold transition-colors cursor-pointer ${
                          boloesFilter === 'ANTERIORES'
                            ? 'bg-[#005CA9] text-white'
                            : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B]'
                        }`}
                      >
                        Bolões Anteriores
                      </button>
                    </div>
                  </div>

                  {displayedYearPools.length === 0 ? (
                    <div className="caixa-card p-6 text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-[#EBF4FC] text-[#005CA9] flex items-center justify-center mx-auto">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-[#1E293B]">
                          {boloesFilter === 'PARTICIPO'
                            ? 'Você ainda não participa de um bolão'
                            : 'Nenhum bolão anterior registrado'}
                        </h4>
                        <p className="text-xs text-[#5F6C7B]">
                          {boloesFilter === 'PARTICIPO'
                            ? 'Crie seus próprios jogos ou torne-se promotor para lançar um bolão.'
                            : 'Seus bolões de anos anteriores aparecerão aqui.'}
                        </p>
                      </div>
                      {boloesFilter === 'PARTICIPO' && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenPromoter) {
                                onOpenPromoter();
                              } else {
                                setActiveSection('NOVO');
                              }
                            }}
                            className="h-9 px-5 rounded-[4px] bg-[#008B47] text-white text-xs font-bold cursor-pointer"
                          >
                            Criar Bolão
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayedYearPools.map((item) => {
                        const isCurrentPool = item.year === '2026';

                        return (
                          <div
                            key={item.id}
                            onClick={
                              isCurrentPool
                                ? () => {
                                    if (item.companyId) {
                                      onSelectCompany(item.companyId);
                                    } else {
                                      setSelectedGroupItemId(item.id);
                                    }
                                  }
                                : undefined
                            }
                            className={`caixa-card p-3.5 rounded-[6px] bg-white border border-[#DCE5F0] space-y-3 ${
                              isCurrentPool
                                ? 'hover:border-[#005CA9] transition-colors cursor-pointer'
                                : ''
                            }`}
                          >
                            {/* Linha 1 */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-bold text-[#005CA9] truncate">
                                  Conc. {item.contestNumber} · {item.dateLabel}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-[3px] bg-[#EBF4FC] text-[#005CA9] text-[9px] font-bold shrink-0">
                                  {LOTTERY_CONFIGS[item.lotteryType].name}
                                </span>
                              </div>

                              <span className="text-[10px] font-bold text-[#008B47] shrink-0">
                                {item.statusLabel}
                              </span>
                            </div>

                            {/* Linha 2 */}
                            <div>
                              <h4 className="text-sm font-bold text-[#1E293B] leading-snug">
                                {item.title}
                              </h4>
                              <p className="text-[11px] text-[#5F6C7B] mt-0.5 truncate">
                                {item.companyName} · Promotor: {item.managerName}
                              </p>
                            </div>

                            {/* Linha 3 */}
                            <div
                              className={`grid ${
                                isCurrentPool ? 'grid-cols-3' : 'grid-cols-2'
                              } gap-2 pt-2 border-t border-[#EDF2F7] text-[11px]`}
                            >
                              <div className="p-2 rounded-[4px] bg-[#F7F9FC]">
                                <span className="text-[10px] text-[#5F6C7B] block">
                                  Cotas
                                </span>
                                <span className="font-mono-tabular font-bold text-[#1E293B]">
                                  {item.myQuotas} ({formatCurrencyBRL(item.myInvested)})
                                </span>
                              </div>
                              <div className="p-2 rounded-[4px] bg-[#F7F9FC]">
                                <span className="text-[10px] text-[#5F6C7B] block">
                                  Caixa
                                </span>
                                <span className="font-mono-tabular font-bold text-[#008B47]">
                                  {formatCurrencyBRL(item.poolTotalRaised)}
                                </span>
                              </div>
                              <div className="p-2 rounded-[4px] bg-[#F7F9FC]">
                                <span className="text-[10px] text-[#5F6C7B] block">
                                  Membros
                                </span>
                                <span className="font-mono-tabular font-bold text-[#005CA9]">
                                  {item.participantsCount}
                                </span>
                              </div>
                              {!isCurrentPool && (
                                <div className="p-2 rounded-[4px] bg-[#F7F9FC]">
                                  <span className="text-[10px] text-[#5F6C7B] block">
                                    Prêmio Rateado
                                  </span>
                                  <span className="font-mono-tabular font-bold text-[#008B47]">
                                    {item.prizeReceived > 0
                                      ? formatCurrencyBRL(item.prizeReceived)
                                      : 'Sem prêmio'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Linha 4: Abrir e Convite apenas para bolão ativo */}
                            {isCurrentPool && (
                              <div
                                className="grid grid-cols-2 gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.companyId) {
                                      onSelectCompany(item.companyId);
                                    } else {
                                      setSelectedGroupItemId(item.id);
                                    }
                                  }}
                                  className="h-9 px-3 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <span>Abrir</span>
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
                                    onNotify?.(`Link de "${item.title}" copiado!`);
                                  }}
                                  className="h-9 px-3 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Share2 className="w-3 h-3" />
                                  <span>Convite</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
              <div className="space-y-2 border-b border-[#E2E8F0] pb-2.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsLotteryMenuOpen((prev) => !prev)}
                    className="h-9 rounded-[4px] bg-[#005CA9] text-white text-xs font-bold flex items-center justify-center cursor-pointer"
                  >
                    {LOTTERY_CONFIGS[favLotteryType].name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLotteryMenuOpen((prev) => !prev)}
                    className={`h-9 rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      isLotteryMenuOpen
                        ? 'bg-[#1E293B] text-white'
                        : 'bg-[#D5DEE8] text-[#1E293B]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Loterias</span>
                    {isLotteryMenuOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {isLotteryMenuOpen && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {ALL_LOTTERY_TYPES.map((lt) => {
                      const isSelected = favLotteryType === lt;
                      return (
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
                            setIsLotteryMenuOpen(false);
                          }}
                          className={`h-8 px-2.5 rounded-[4px] text-[11px] font-bold flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-[#005CA9] text-white'
                              : 'bg-[#F1F5F9] text-[#1E293B]'
                          }`}
                        >
                          <span>{LOTTERY_CONFIGS[lt].name}</span>
                          <span
                            className={`text-[10px] font-mono-tabular ${
                              isSelected ? 'text-white/80' : 'text-[#5F6C7B]'
                            }`}
                          >
                            {LOTTERY_CONFIGS[lt].totalPoolNumbers} DZ
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
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
                      setMeusJogosSelectedLottery(favLotteryType);
                      setMeusJogosContestMode('REGULAR');
                      setJogosSubTab('CRIAR');
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
                    const favStats = getDefaultLotteryStats(fg.lotteryType);
                    const latestDrawnFav = favStats.latestContest?.drawnNumbers || [];
                    const hitsFav = fg.numbers.filter((n) => latestDrawnFav.includes(n)).length;

                    return (
                      <div key={fg.id} className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-[#005CA9]">
                              {LOTTERY_CONFIGS[fg.lotteryType].name} · {fg.numbers.length}{' '}
                              dezenas · {hitsFav} {hitsFav === 1 ? 'acerto' : 'acertos'}
                            </span>
                            <h4 className="text-xs font-bold text-[#1E293B]">
                              {fg.label}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handlePrintPersonalGames(
                                  [fg],
                                  fg.lotteryType,
                                  `${fg.label} — ${currentUser.name}`
                                )
                              }
                              className="px-2.5 py-1 rounded-[4px] bg-[#005CA9] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              Imprimir
                            </button>
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
                              Bolão
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFavoriteGame(fg.id)}
                              className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-[4px] cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {fg.numbers.map((n) => {
                            const isHit = latestDrawnFav.includes(n);
                            return (
                              <span
                                key={n}
                                className={`w-6 h-6 rounded-full font-mono-tabular font-bold text-[11px] flex items-center justify-center ${
                                  isHit
                                    ? 'bg-[#008B47] text-white'
                                    : 'bg-[#EBF4FC] text-[#005CA9]'
                                }`}
                              >
                                {String(n).padStart(2, '0')}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="py-6 text-center space-y-2.5">
                  <p className="text-xs text-[#5F6C7B]">
                    Nenhum jogo salvo. Gere e salve suas combinações em Loterias.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMeusJogosSelectedLottery(null);
                      setMeusJogosContestMode(null);
                      setActiveSection('PALPITES');
                    }}
                    className="px-4 h-9 rounded-[4px] bg-[#005CA9] text-white text-xs font-bold cursor-pointer"
                  >
                    Abrir Loterias
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
                            setMeusJogosSelectedLottery(novoPool.lotteryType);
                            setMeusJogosContestMode('REGULAR');
                            setJogosSubTab('CRIAR');
                            setActiveSection('PALPITES');
                          }}
                          className="flex-1 h-8 rounded-[4px] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#333E48] text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Ticket className="w-3.5 h-3.5 text-[#008B47]" />
                          <span>Criar Jogos</span>
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

        {/* Modais de Confirmação Sim/Não e Compartilhamento */}
        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // MAIN MEU ESPAÇO DASHBOARD (WHEN NO FULL-SCREEN SECTION IS ACTIVE)
  // =========================================================================
  return (
    <div className="px-4 py-4 space-y-4">
      {/* 3x2 GRID OF SERVICE CARDS (OPENS FULL-SCREEN SECTIONS) */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-[#333E48] tracking-tight">
            PAINEL DO USUÁRIO
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {serviceGridItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'NOVO' && onOpenPromoter) {
                  onOpenPromoter();
                  return;
                }
                setActiveSection(item.id);
              }}
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

      {/* Modais de Confirmação Sim/Não e Compartilhamento */}
      {renderModals()}
    </div>
  );
};
