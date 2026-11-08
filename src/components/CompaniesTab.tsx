import React, { useState } from 'react';
import {
  Company,
  Pool,
  QuotaPurchase,
  LotteryType,
  SystemUser,
} from '../types';
import { LOTTERY_CONFIGS, formatCurrencyBRL } from '../utils/lotteryMath';
import {
  maskCurrencyBRL,
  numberToCurrencyMask,
  parseCurrencyBRL,
  shareOrCopyPoolLink,
} from '../utils/inputMasks';
import { CountdownClock } from './CountdownClock';
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  Users,
  Check,
  X,
  Upload,
  AlertCircle,
  Settings,
  Share2,
} from 'lucide-react';

interface CompaniesTabProps {
  currentUser: SystemUser;
  companies: Company[];
  pools: Pool[];
  purchases: QuotaPurchase[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onCreateCompany: (payload: any) => Promise<{ ok: boolean; error?: string }>;
  onUpdatePoolConfig?: (poolId: string, payload: any) => Promise<void>;
  onPromoteToOrganizer?: () => Promise<void>;
}

export const CompaniesTab: React.FC<CompaniesTabProps> = ({
  currentUser,
  companies,
  pools,
  purchases,
  selectedCompanyId,
  onSelectCompany,
  onCreateCompany,
  onUpdatePoolConfig,
  onPromoteToOrganizer,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedCompanyId, setCopiedCompanyId] = useState<string | null>(null);

  // Fase 1: Identificação do Bolão
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [customSector, setCustomSector] = useState(
    currentUser.companyName || 'Colaboradores da Vibra'
  );
  const [cityState] = useState('São Paulo - SP');
  const [logoColor] = useState('#005CA9');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [poolTitle, setPoolTitle] = useState('');

  // Fase 2: Regras do Bolão (Regular ou Especial)
  const [contestMode, setContestMode] = useState<'REGULAR' | 'SPECIAL'>('REGULAR');
  const [lotteryType, setLotteryType] = useState<LotteryType>('MEGA_SENA');
  const [contestNumber, setContestNumber] = useState('2950');
  const [quotaValueMasked, setQuotaValueMasked] = useState<string>(
    numberToCurrencyMask(100)
  );
  const [maxTargetMasked, setMaxTargetMasked] = useState<string>(
    numberToCurrencyMask(0)
  );
  const [endDateDate, setEndDateDate] = useState('2026-12-31');
  const [endDateTime, setEndDateTime] = useState('16:00');

  // Filter ONLY bolões created/managed by the logged-in user
  const cleanUserCpf = currentUser.cpf.replace(/\D/g, '');
  const myCreatedGroups = companies.filter(
    (company) =>
      company.managerId === currentUser.id ||
      company.managerEmail.toLowerCase() === currentUser.email.toLowerCase() ||
      company.managerCpf.replace(/\D/g, '') === cleanUserCpf ||
      company.managerName.toLowerCase() === currentUser.name.toLowerCase()
  );

  const isAlreadyPromoter =
    myCreatedGroups.length > 0 ||
    /promot|organiz|gestor|coorden|admin|lider/i.test(currentUser.jobTitle || '');

  const [promoterActivatedLocal, setPromoterActivatedLocal] = useState(false);
  const hasPromoterAccess = isAlreadyPromoter || promoterActivatedLocal;

  const handleActivatePromoter = async () => {
    setPromoterActivatedLocal(true);
    if (onPromoteToOrganizer) {
      await onPromoteToOrganizer();
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAdvanceToParamsScreen = () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Informe o nome do bolão.');
      return;
    }
    if (!poolTitle.trim()) {
      setPoolTitle(name.trim());
    }
    setCreateStep(2);
  };

  const handleOpenEditParamsModal = (pool: Pool, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormError(null);
    setEditingPool(pool);
    setPoolTitle(pool.title);
    setLotteryType(pool.lotteryType);
    setContestNumber(pool.contestNumber);
    setQuotaValueMasked(numberToCurrencyMask(pool.quotaValue));
    setMaxTargetMasked(numberToCurrencyMask(pool.maxTargetAmount || 0));
    const iso = pool.endDate || '2026-12-31T16:00';
    const [dPart, tPartRaw] = iso.split('T');
    setEndDateDate(dPart || '2026-12-31');
    setEndDateTime((tPartRaw || '16:00').slice(0, 5));
  };

  const buildCombinedEndDateIso = () => {
    const safeDate = endDateDate || '2026-12-31';
    const safeTime = endDateTime || '16:00';
    const parsed = new Date(`${safeDate}T${safeTime}`);
    return Number.isNaN(parsed.getTime())
      ? new Date('2026-12-31T16:00:00').toISOString()
      : parsed.toISOString();
  };

  const handleSaveEditedPoolParams = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPool || !onUpdatePoolConfig) return;
    const numericQuota = Math.max(1, parseCurrencyBRL(quotaValueMasked) || editingPool.quotaValue);
    const numericTarget = Math.max(0, parseCurrencyBRL(maxTargetMasked));

    setSubmitting(true);
    try {
      await onUpdatePoolConfig(editingPool.id, {
        title: poolTitle.trim() || editingPool.title,
        lotteryType,
        contestNumber: contestNumber.replace(/\D/g, '') || editingPool.contestNumber,
        collectionMode: numericTarget > 0 ? 'MAX_TARGET' : 'FIXED_QUOTA',
        quotaValue: numericQuota,
        maxTargetAmount: numericTarget,
        endDate: buildCombinedEndDateIso(),
      });
      setEditingPool(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitNewCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const resolvedName =
      name.trim() ||
      poolTitle.trim() ||
      `Bolão ${LOTTERY_CONFIGS[lotteryType].name} #${companies.length + 1}`;

    const finalSector = customSector.trim();
    const numericQuota = Math.max(1, parseCurrencyBRL(quotaValueMasked) || 100);
    const numericTarget = Math.max(0, parseCurrencyBRL(maxTargetMasked));

    setSubmitting(true);
    try {
      const result = await onCreateCompany({
        userId: currentUser.id,
        name: resolvedName,
        cnpj: cnpj.trim() || '00.000.000/0001-00',
        segment: finalSector,
        cityState,
        logoColor,
        logoUrl: logoUrl || undefined,
        managerName: currentUser.name,
        managerRole: 'Promotor',
        managerPixKey: currentUser.pixKey,
        managerCpf: currentUser.cpf,
        managerWhatsapp: currentUser.whatsapp,
        managerEmail: currentUser.email,
        poolTitle: poolTitle.trim() || resolvedName,
        lotteryType,
        contestNumber: contestNumber.replace(/\D/g, '') || '2950',
        collectionMode: numericTarget > 0 ? 'MAX_TARGET' : 'FIXED_QUOTA',
        quotaValue: numericQuota,
        maxTargetAmount: numericTarget,
        endDate: buildCombinedEndDateIso(),
      });

      if (!result.ok) {
        setFormError(result.error || 'Não foi possível criar o bolão.');
        return;
      }

      setShowCreateModal(false);
      setCreateStep(1);
      setName('');
      setPoolTitle('');
      setCnpj('');
      setLogoUrl('');
      setQuotaValueMasked(numberToCurrencyMask(100));
      setMaxTargetMasked(numberToCurrencyMask(0));
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareBolao = async (
    company: Company,
    pool: Pool | undefined,
    useNativeShare: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    await shareOrCopyPoolLink({
      companyId: company.id,
      poolId: pool?.id,
      title: pool?.title || company.name,
      companyName: company.name,
      useNativeShare,
    });
    setCopiedCompanyId(company.id);
    setTimeout(() => {
      setCopiedCompanyId((prev) => (prev === company.id ? null : prev));
    }, 2500);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {!hasPromoterAccess ? (
        /* Autopromoção para Promotor */
        <div className="caixa-card p-5 text-center space-y-3.5">
          <div className="caixa-icon-halo mx-auto bg-[#DCFCE7] text-[#008B47]">
            <Users className="w-5 h-5 text-[#008B47]" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#008B47] uppercase block">
              Upgrade de Conta
            </span>
            <h1 className="font-display font-bold text-base text-[#1E293B]">
              Promotor
            </h1>
            <p className="text-xs text-[#5F6C7B] leading-relaxed">
              Qualquer usuário pode se autopromover para criar bolões regulares ou especiais, convidar amigos e gerir cotas via Pix.
            </p>
          </div>
          <button
            type="button"
            onClick={handleActivatePromoter}
            className="w-full h-11 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Ativar</span>
          </button>
        </div>
      ) : (
        <>
          {/* Cabeçalho e Botão Principal de Criar Bolão */}
          <div className="caixa-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-[#008B47] uppercase block">
                  Promotor
                </span>
                <h1 className="font-display font-bold text-base text-[#1E293B]">
                  Meus Bolões
                </h1>
                <p className="text-xs text-[#5F6C7B] mt-0.5">
                  Crie bolões para sorteios regulares ou especiais.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setEditingPool(null);
                setCreateStep(1);
                setName('');
                setPoolTitle('');
                setQuotaValueMasked(numberToCurrencyMask(100));
                setMaxTargetMasked(numberToCurrencyMask(0));
                setEndDateDate('2026-12-31');
                setEndDateTime('16:00');
                setShowCreateModal(true);
              }}
              className="w-full h-11 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Bolão</span>
            </button>
          </div>

          {/* Lista de Bolões Criados pelo Usuário */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-[#333E48]">
                Criados ({myCreatedGroups.length})
              </h2>
            </div>

            {myCreatedGroups.length === 0 ? (
              <div className="caixa-card p-6 text-center space-y-2.5">
                <div className="caixa-icon-halo mx-auto">
                  <Users className="w-5 h-5 text-[#005CA9]" />
                </div>
                <p className="text-xs font-bold text-[#1E293B]">
                  Nenhum bolão criado ainda
                </p>
                <p className="text-[11px] text-[#5F6C7B]">
                  Toque em "Criar Bolão" acima para lançar seu primeiro bolão.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {myCreatedGroups.map((company) => {
                  const pool = pools.find((p) => p.companyId === company.id);
                  const companyPurchases = purchases.filter(
                    (pur) =>
                      pur.companyId === company.id && pur.paymentStatus === 'CONFIRMED'
                  );
                  const confirmedAmount = companyPurchases.reduce(
                    (acc, p) => acc + p.totalAmount,
                    0
                  );
                  const isSelected = company.id === selectedCompanyId;
                  const lotteryConfig = pool
                    ? LOTTERY_CONFIGS[pool.lotteryType]
                    : LOTTERY_CONFIGS.MEGA_SENA;
                  const isCopied = copiedCompanyId === company.id;
                  const hasTargetCeiling = pool && pool.maxTargetAmount > 0;
                  const isTargetReached =
                    hasTargetCeiling && confirmedAmount >= (pool?.maxTargetAmount || 0);

                  return (
                    <div
                      key={company.id}
                      onClick={() => onSelectCompany(company.id)}
                      className={`caixa-card p-4 cursor-pointer transition-all ${
                        isSelected ? 'ring-1 ring-[#005CA9]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {company.logoUrl ? (
                            <img
                              src={company.logoUrl}
                              alt={company.name}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 object-cover shrink-0 rounded-[4px] border border-[#EDF2F7] bg-white"
                            />
                          ) : (
                            <div
                              className="w-11 h-11 text-white font-display font-extrabold text-sm flex items-center justify-center shrink-0 rounded-[4px]"
                              style={{ backgroundColor: company.logoColor }}
                            >
                              {company.logoInitials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-[#005CA9] block">
                              Concurso {pool?.contestNumber || '2950'}
                            </span>
                            <h3 className="font-display font-bold text-sm text-[#1E293B] leading-snug">
                              {pool?.title || company.name}
                            </h3>
                            {company.segment && (
                              <p className="text-xs text-[#5F6C7B] mt-0.5">
                                {company.segment}
                              </p>
                            )}
                            {pool && (
                              <div className="mt-1">
                                <CountdownClock
                                  startDate={pool.startDate}
                                  endDate={pool.endDate}
                                  compact={true}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-[#005CA9]">
                            {lotteryConfig.name}
                          </span>
                          {pool && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditParamsModal(pool, e)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#D5E0EC] text-[#005CA9] font-display font-bold text-[10px] cursor-pointer"
                            >
                              <Settings className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {pool && (
                        <div className="mt-3.5 pt-3 border-t border-[#EDF2F7] space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#5F6C7B]">Cota</span>
                            <span className="font-mono-tabular font-bold text-[#333E48]">
                              {formatCurrencyBRL(pool.quotaValue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#5F6C7B]">Caixa</span>
                            <span className="font-mono-tabular font-bold text-[#008B47]">
                              {hasTargetCeiling ? (
                                <>
                                  {formatCurrencyBRL(confirmedAmount)} /{' '}
                                  {formatCurrencyBRL(pool.maxTargetAmount)}
                                  {isTargetReached ? ' (Fechado)' : ''}
                                </>
                              ) : (
                                <>{formatCurrencyBRL(confirmedAmount)} (Livre)</>
                              )}
                            </span>
                          </div>

                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="pt-1.5 grid grid-cols-2 gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectCompany(company.id)}
                              className="h-9 px-3 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Abrir</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleShareBolao(company, pool, true, e)}
                              className="h-9 px-3 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Share2 className="w-3.5 h-3.5" />
                              )}
                              <span>{isCopied ? 'Copiado' : 'Convite'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ===================================================================== */}
      {/* ETAPA 1: IDENTIFICAÇÃO DO BOLÃO                                       */}
      {/* ===================================================================== */}
      {showCreateModal && createStep === 1 && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-[406px] caixa-card overflow-hidden my-auto">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/85">
                  Etapa 1 de 2
                </div>
                <h2 className="font-display font-bold text-sm">
                  Novo Bolão
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px] cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs font-semibold text-red-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAdvanceToParamsScreen();
              }}
              className="p-4 space-y-3 text-xs bg-white max-h-[80vh] overflow-y-auto"
            >
              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  Nome do Bolão *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setPoolTitle(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Ex: Bolão Mega de Quarta — Vibra"
                  className="caixa-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#333E48]">
                  Turma ou Grupo (opcional)
                </label>
                <input
                  type="text"
                  value={customSector}
                  onChange={(e) => setCustomSector(e.target.value)}
                  placeholder="Ex: Colaboradores da Vibra"
                  className="caixa-input"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="block font-semibold text-[#333E48]">
                  Imagem
                </label>

                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 object-cover border border-[#D5E0EC] rounded-[4px] bg-white shrink-0"
                    />
                  ) : (
                    <div
                      className="w-11 h-11 text-white font-display font-extrabold text-sm flex items-center justify-center shrink-0 rounded-[4px]"
                      style={{ backgroundColor: logoColor }}
                    >
                      {name.trim().slice(0, 2).toUpperCase() || 'BL'}
                    </div>
                  )}

                  <div className="flex-1">
                    <label className="h-9 px-3 bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Escolher</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#EDF2F7]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Avançar</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ETAPA 2: REGRAS DO BOLÃO (REGULAR OU ESPECIAL)                        */}
      {/* ===================================================================== */}
      {((showCreateModal && createStep === 2) || editingPool) && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-[406px] caixa-card overflow-hidden my-auto">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/85">
                  {editingPool ? 'Editar' : 'Etapa 2 de 2'}
                </div>
                <h2 className="font-display font-bold text-sm">
                  Regras
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (editingPool) {
                    setEditingPool(null);
                  } else {
                    setShowCreateModal(false);
                    setCreateStep(1);
                  }
                }}
                className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px] cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs font-semibold text-red-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={editingPool ? handleSaveEditedPoolParams : handleSubmitNewCompany}
              className="p-4 space-y-3.5 text-xs bg-white max-h-[80vh] overflow-y-auto"
            >
              {/* Chave Simples: Regular vs Especial */}
              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  Tipo de Concurso
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setContestMode('REGULAR')}
                    className={`h-9 rounded-[4px] font-bold text-xs transition-colors cursor-pointer ${
                      contestMode === 'REGULAR'
                        ? 'bg-[#005CA9] text-white'
                        : 'bg-[#F1F5F9] text-[#5F6C7B]'
                    }`}
                  >
                    Regular
                  </button>
                  <button
                    type="button"
                    onClick={() => setContestMode('SPECIAL')}
                    className={`h-9 rounded-[4px] font-bold text-xs transition-colors cursor-pointer ${
                      contestMode === 'SPECIAL'
                        ? 'bg-[#008B47] text-white'
                        : 'bg-[#F1F5F9] text-[#5F6C7B]'
                    }`}
                  >
                    Especial
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={poolTitle}
                  onChange={(e) => setPoolTitle(e.target.value)}
                  placeholder="Nome do bolão"
                  className="caixa-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Loteria
                  </label>
                  <select
                    value={lotteryType}
                    onChange={(e) => setLotteryType(e.target.value as LotteryType)}
                    className="caixa-input"
                  >
                    <option value="MEGA_SENA">
                      {contestMode === 'SPECIAL' ? 'Mega da Virada' : 'Mega-Sena'}
                    </option>
                    <option value="LOTOFACIL">
                      {contestMode === 'SPECIAL' ? 'Lotofácil Especial' : 'Lotofácil'}
                    </option>
                    <option value="QUINA">
                      {contestMode === 'SPECIAL' ? 'Quina São João' : 'Quina'}
                    </option>
                    <option value="LOTOMANIA">
                      {contestMode === 'SPECIAL' ? 'Lotomania de Páscoa' : 'Lotomania'}
                    </option>
                    <option value="DUPLA_SENA">
                      {contestMode === 'SPECIAL' ? 'Dupla de Páscoa' : 'Dupla Sena'}
                    </option>
                    <option value="TIMEMANIA">
                      {contestMode === 'SPECIAL' ? 'Timemania Especial' : 'Timemania'}
                    </option>
                    <option value="DIA_DE_SORTE">
                      {contestMode === 'SPECIAL' ? 'Dia de Sorte Especial' : 'Dia de Sorte'}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Concurso
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={contestNumber}
                    onChange={(e) =>
                      setContestNumber(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="caixa-input font-mono-tabular font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Cota (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quotaValueMasked}
                    onChange={(e) => setQuotaValueMasked(maskCurrencyBRL(e.target.value))}
                    className="caixa-input font-mono-tabular font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Teto (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxTargetMasked}
                    onChange={(e) => setMaxTargetMasked(maskCurrencyBRL(e.target.value))}
                    placeholder="R$ 0,00"
                    className="caixa-input font-mono-tabular font-bold"
                  />
                </div>
              </div>
              <p className="text-[10px] text-[#5F6C7B] -mt-1.5 leading-snug">
                Teto em <strong>R$ 0,00</strong> deixa a captação livre até a data limite.
              </p>

              <div className="space-y-1">
                <label className="block font-semibold text-[#333E48]">
                  Prazo
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="block text-[10px] text-[#5F6C7B] mb-0.5">
                      Data
                    </span>
                    <input
                      type="date"
                      value={endDateDate}
                      onChange={(e) => setEndDateDate(e.target.value)}
                      className="caixa-input font-mono-tabular text-[11px]"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#5F6C7B] mb-0.5">
                      Hora
                    </span>
                    <input
                      type="time"
                      value={endDateTime}
                      onChange={(e) => setEndDateTime(e.target.value)}
                      className="caixa-input font-mono-tabular text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#EDF2F7]">
                {editingPool ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingPool(null)}
                      className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] disabled:bg-slate-400 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{submitting ? 'Salvando...' : 'Salvar'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setCreateStep(1);
                      }}
                      className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="min-h-[42px] bg-[#008B47] hover:bg-[#00743B] disabled:bg-slate-400 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{submitting ? 'Criando...' : 'Criar'}</span>
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
