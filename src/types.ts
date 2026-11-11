export type LotteryType =
  | 'MEGA_SENA'
  | 'LOTOFACIL'
  | 'QUINA'
  | 'LOTOMANIA'
  | 'TIMEMANIA'
  | 'DUPLA_SENA'
  | 'DIA_DE_SORTE'
  | 'SUPER_SETE'
  | 'MAIS_MILIONARIA'
  | 'LOTECA';

export type CollectionMode = 'FIXED_QUOTA' | 'MAX_TARGET';

export type PoolStatus = 'OPEN' | 'CLOSED' | 'DRAWN';

export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'OVERDUE';

export type UserRole = 'COLLABORATOR' | 'MANAGER' | 'SUPER_ADMIN';

export type EffectiveGameStatus = 'A_FAZER' | 'FEITO';

export interface EffectiveGame {
  id: string;
  label: string;
  lotteryType: LotteryType;
  contestMode?: 'REGULAR' | 'SPECIAL';
  numbers: number[];
  cost: number;
  status: EffectiveGameStatus;
  contestNumber: string;
  createdAt: string;
}

export interface FavoriteGame {
  id: string;
  label: string;
  lotteryType: LotteryType;
  numbers: number[];
  createdAt: string;
}

export interface SystemUser {
  id: string;
  name: string;
  username?: string; // Nome de usuário (Ex. Fulano@)
  whatsapp: string;
  cpf: string;
  email: string;
  password?: string; // Senha de acesso ao sistema
  companyName: string;
  companyId?: string;
  jobTitle: string; // Função
  pixKey: string; // Chave Pix para recebimento
  avatarInitials: string;
  monthlySpendingLimit?: number; // Teto mensal configurável (Jogo Responsável)
  favoriteLotteries?: LotteryType[]; // Loterias favoritas exibidas em Meus Jogos
  favoriteNumbers?: Partial<Record<LotteryType, number[]>>; // Dezenas favoritas por modalidade
  favoriteGames?: FavoriteGame[]; // Combinações favoritas salvas
  effectiveGames?: EffectiveGame[]; // Jogos efetivados (a fazer ou feitos na lotérica)
  createdAt: string;
}

export interface Company {
  id: string;
  tenantSlug?: string; // Identificador multitenant exclusivo da empresa
  name: string;
  cnpj: string;
  segment: string; // Setor (Mecânica, DOT, Orange Cap, Limpeza, etc.)
  logoInitials: string;
  logoColor: string;
  logoUrl?: string; // Logotipo (imagem base64 ou URL)
  managerId?: string;
  managerName: string;
  managerRole?: string; // Função do responsável
  managerPixKey?: string; // Chave Pix de recebimento do responsável
  managerCpf: string;
  managerEmail: string;
  managerWhatsapp: string;
  asaasWalletId: string;
  cityState: string;
  createdAt: string;
}

export interface Pool {
  id: string;
  companyId: string;
  title: string;
  lotteryType: LotteryType;
  contestNumber: string;
  collectionMode: CollectionMode;
  quotaValue: number;
  maxTargetAmount: number;
  maxQuotas: number;
  platformFeePercent: number;
  startDate: string;
  endDate: string;
  status: PoolStatus;
  officialReceiptCode: string;
  drawnNumbers: number[];
  prizeTotalAmount: number;
  createdAt: string;
}

export interface Participant {
  id: string;
  companyId: string;
  poolId: string;
  name: string;
  cpf: string;
  email: string;
  whatsapp: string;
  department: string; // Função / Setor
  pixKey?: string; // Chave Pix para recebimento
  registeredBy: 'SELF' | 'MANAGER';
  createdAt: string;
}

export interface QuotaPurchase {
  id: string;
  poolId: string;
  companyId: string;
  participantId: string;
  participantName: string;
  participantCpf: string;
  participantEmail: string;
  participantWhatsapp: string;
  participantRole?: string;
  participantPixKey?: string;
  quotasCount: number;
  unitQuotaValue: number;
  totalAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  netPoolAmount: number;
  organizerWalletId: string;
  asaasPaymentId: string;
  pixQrCodePayload: string;
  paymentStatus: PaymentStatus;
  couponHash: string;
  createdAt: string;
  paidAt?: string;
}

export interface LotteryGame {
  id: string;
  poolId: string;
  companyId: string;
  lotteryType: LotteryType;
  gameMode: 'SIMPLES' | 'DESDOBRAMENTO';
  numbers: number[];
  dozensCount: number;
  equivalentSimpleBets: number;
  cost: number;
  lotericaReceiptCode: string;
  registeredAt: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
}

export interface PlayerSuggestion {
  id: string;
  companyId: string;
  poolId: string;
  lotteryType: LotteryType;
  userId: string;
  userName: string;
  userAvatar?: string;
  userJobTitle: string;
  numbers: number[];
  rationale?: string;
  votes: number;
  approvedAsOfficialGame?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  companyId?: string;
  poolId?: string;
  actionType:
    | 'COMPANY_CREATED'
    | 'POOL_CREATED'
    | 'PARTICIPANT_REGISTERED'
    | 'PIX_GENERATED'
    | 'PIX_SPLIT_CONCILIATED'
    | 'GAME_REGISTERED'
    | 'SUGGESTION_CREATED'
    | 'RESULT_AUDITED'
    | 'SETTINGS_UPDATED';
  actorName: string;
  description: string;
  integrityHash: string;
  amount?: number;
}

export interface PlatformSettings {
  defaultPlatformFeePercent: number;
  platformAsaasWalletId: string;
  asaasEnvironment: 'SANDBOX' | 'PRODUCTION';
  asaasWebhookActive: boolean;
  supabaseSyncEnabled: boolean;
  supabaseProjectUrl: string;
  masterOrganizerName: string;
}

export interface DatabaseState {
  users?: SystemUser[];
  companies: Company[];
  pools: Pool[];
  participants: Participant[];
  purchases: QuotaPurchase[];
  games: LotteryGame[];
  suggestions?: PlayerSuggestion[];
  auditLogs: AuditLog[];
  settings: PlatformSettings;
}
