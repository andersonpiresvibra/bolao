import React, { useState } from 'react';
import {
  Company,
  Pool,
  QuotaPurchase,
  LotteryType,
  CollectionMode,
  SystemUser,
} from '../types';
import { LOTTERY_CONFIGS, formatCurrencyBRL } from '../utils/lotteryMath';
import { CountdownClock } from './CountdownClock';
import {
  Search,
  Plus,
  ChevronRight,
  Building2,
  Check,
  X,
  Upload,
  Lock,
  AlertCircle,
  Sparkles,
  Award,
  Layers,
} from 'lucide-react';

interface CompaniesTabProps {
  currentUser: SystemUser;
  companies: Company[];
  pools: Pool[];
  purchases: QuotaPurchase[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onCreateCompany: (payload: any) => Promise<{ ok: boolean; error?: string }>;
}

const PREDEFINED_SECTORS = [
  'Mecânica',
  'DOT',
  'Orange Cap',
  'Limpeza',
  'Operações & Logística',
  'Manutenção Industrial',
  'Administrativo & RH',
  'Outro Setor (Digitar)',
];

export const CompaniesTab: React.FC<CompaniesTabProps> = ({
  currentUser,
  companies,
  pools,
  purchases,
  selectedCompanyId,
  onSelectCompany,
  onCreateCompany,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLottery, setFilterLottery] = useState<'ALL' | LotteryType>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Company + Initial Pool Modal State
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [selectedSector, setSelectedSector] = useState('Mecânica');
  const [customSector, setCustomSector] = useState('');
  const [cityState, setCityState] = useState('São Paulo - SP');
  const [logoColor, setLogoColor] = useState('#005CA9');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [poolTitle, setPoolTitle] = useState('Bolão Corporativo Fim de Ano — Mega da Virada');
  const [lotteryType, setLotteryType] = useState<LotteryType>('MEGA_SENA');
  const [contestNumber, setContestNumber] = useState('2950');
  const [collectionMode] = useState<CollectionMode>('MAX_TARGET');
  const [quotaValue, setQuotaValue] = useState('100');
  const [maxTargetAmount, setMaxTargetAmount] = useState('5000');
  const [endDate, setEndDate] = useState('2026-12-31T16:00');

  const isDuplicateName =
    name.trim().length > 0 &&
    companies.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

  const filteredCompanies = companies.filter((company) => {
    const pool = pools.find((p) => p.companyId === company.id);
    const matchesSearch =
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.cnpj.includes(searchQuery) ||
      company.managerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.segment.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLottery =
      filterLottery === 'ALL' || (pool && pool.lotteryType === filterLottery);

    return matchesSearch && matchesLottery;
  });

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

  const handleSubmitNewCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Informe o nome da empresa.');
      return;
    }

    if (isDuplicateName) {
      setFormError(
        `A empresa "${name.trim()}" já existe no sistema. O nome da empresa não pode ser repetido.`
      );
      return;
    }

    const finalSector =
      selectedSector === 'Outro Setor (Digitar)'
        ? customSector.trim() || 'Operacional'
        : selectedSector;

    setSubmitting(true);
    try {
      const result = await onCreateCompany({
        userId: currentUser.id,
        name: name.trim(),
        cnpj: cnpj.trim() || '00.000.000/0001-00',
        segment: finalSector,
        cityState,
        logoColor,
        logoUrl: logoUrl || undefined,
        // Automatic System-Populated Manager Fields from Logged-In User
        managerName: currentUser.name,
        managerRole: currentUser.jobTitle,
        managerPixKey: currentUser.pixKey,
        managerCpf: currentUser.cpf,
        managerWhatsapp: currentUser.whatsapp,
        managerEmail: currentUser.email,
        poolTitle,
        lotteryType,
        contestNumber,
        collectionMode,
        quotaValue: Number(quotaValue) || 100,
        maxTargetAmount: Number(maxTargetAmount) || 5000,
        endDate: new Date(endDate).toISOString(),
      });

      if (!result.ok) {
        setFormError(result.error || 'Não foi possível cadastrar a empresa.');
        return;
      }

      setShowCreateModal(false);
      setName('');
      setCnpj('');
      setLogoUrl('');
      setCustomSector('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Search Bar Floating Card */}
      <div className="caixa-card p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#005CA9] absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar empresa, setor (Mecânica, DOT...) ou responsável"
            className="caixa-input pl-9"
          />
        </div>
      </div>

      {/* Section 1: Empresas Cadastradas (Estilo "Meus contratos") */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-base text-[#333E48]">
            Meus grupos e empresas ({filteredCompanies.length})
          </h1>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setShowCreateModal(true);
            }}
            className="text-xs font-bold text-[#005CA9] hover:underline flex items-center gap-0.5"
          >
            <span>Cadastrar empresa</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Floating White Company Cards */}
        {filteredCompanies.length === 0 ? (
          <div className="caixa-card p-6 text-center space-y-2.5">
            <div className="caixa-icon-halo mx-auto">
              <Building2 className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="text-xs font-semibold text-[#333E48]">
              Nenhuma empresa encontrada para a busca selecionada.
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterLottery('ALL');
              }}
              className="px-3.5 py-2 bg-[#005CA9] text-white text-xs font-bold rounded-[4px]"
            >
              Mostrar todas as empresas
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredCompanies.map((company) => {
              const pool = pools.find((p) => p.companyId === company.id);
              const companyPurchases = purchases.filter(
                (pur) => pur.companyId === company.id && pur.paymentStatus === 'CONFIRMED'
              );
              const confirmedAmount = companyPurchases.reduce(
                (acc, p) => acc + p.totalAmount,
                0
              );
              const confirmedQuotas = companyPurchases.reduce(
                (acc, p) => acc + p.quotasCount,
                0
              );
              const isSelected = company.id === selectedCompanyId;
              const lotteryConfig = pool
                ? LOTTERY_CONFIGS[pool.lotteryType]
                : LOTTERY_CONFIGS.MEGA_SENA;

              return (
                <div
                  key={company.id}
                  onClick={() => onSelectCompany(company.id)}
                  className={`caixa-card p-4 cursor-pointer transition-all ${
                    isSelected ? 'ring-1 ring-[#005CA9]' : ''
                  }`}
                >
                  {/* Top Line: Company Name & Logo */}
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
                        <h2 className="font-display font-bold text-sm text-[#333E48] leading-snug">
                          {company.name}
                        </h2>
                        <p className="text-xs text-[#5F6C7B] mt-0.5">
                          Setor {company.segment} · {company.cityState}
                        </p>
                        <p className="text-xs text-[#5F6C7B]">
                          Responsável: <strong className="text-[#333E48]">{company.managerName}</strong>
                          {company.managerRole ? ` (${company.managerRole})` : ''}
                        </p>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 bg-[#EBF4FC] text-[#005CA9] font-bold text-[10px] rounded-[4px] shrink-0">
                      {lotteryConfig.name}
                    </span>
                  </div>

                  {/* Clean Key-Value Financial Rows (Like Image 2 "Resumo") */}
                  {pool && (
                    <div className="mt-3.5 pt-3 border-t border-[#EDF2F7] space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#5F6C7B]">Valor da cota individual</span>
                        <span className="font-mono-tabular font-bold text-[#333E48]">
                          {formatCurrencyBRL(pool.quotaValue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#5F6C7B]">Total arrecadado ({confirmedQuotas} cotas)</span>
                        <span className="font-mono-tabular font-bold text-[#008B47]">
                          {formatCurrencyBRL(confirmedAmount)} / {formatCurrencyBRL(pool.maxTargetAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5">
                        <CountdownClock
                          startDate={pool.startDate}
                          endDate={pool.endDate}
                          compact={true}
                        />

                        <span className="inline-flex items-center gap-1 font-display font-bold text-xs text-[#005CA9]">
                          <span>Mais informações</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: 2x2 Grid "Contratação / Filtros Online" (Exact Image 1 Layout) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-[#333E48]">
            Modalidades e cadastro
          </h2>
          {filterLottery !== 'ALL' && (
            <button
              type="button"
              onClick={() => setFilterLottery('ALL')}
              className="text-xs font-bold text-[#005CA9]"
            >
              Mostrar todos &gt;
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setShowCreateModal(true);
            }}
            className="caixa-tile p-4 flex flex-col items-center justify-center text-center gap-2.5"
          >
            <div className="caixa-icon-halo">
              <Plus className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="font-display font-bold text-xs text-[#005CA9] leading-snug">
              Cadastrar empresa
              <span className="block font-normal text-[11px] text-[#5F6C7B] mt-0.5">
                Novo grupo corporativo
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilterLottery(filterLottery === 'MEGA_SENA' ? 'ALL' : 'MEGA_SENA')
            }
            className={`caixa-tile p-4 flex flex-col items-center justify-center text-center gap-2.5 ${
              filterLottery === 'MEGA_SENA' ? 'ring-1 ring-[#005CA9]' : ''
            }`}
          >
            <div className="caixa-icon-halo">
              <Sparkles className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="font-display font-bold text-xs text-[#005CA9] leading-snug">
              Mega da Virada
              <span className="block font-normal text-[11px] text-[#5F6C7B] mt-0.5">
                Filtrar bolões Mega
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilterLottery(filterLottery === 'LOTOFACIL' ? 'ALL' : 'LOTOFACIL')
            }
            className={`caixa-tile p-4 flex flex-col items-center justify-center text-center gap-2.5 ${
              filterLottery === 'LOTOFACIL' ? 'ring-1 ring-[#005CA9]' : ''
            }`}
          >
            <div className="caixa-icon-halo">
              <Layers className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="font-display font-bold text-xs text-[#005CA9] leading-snug">
              Lotofácil Especial
              <span className="block font-normal text-[11px] text-[#5F6C7B] mt-0.5">
                15 a 20 dezenas
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilterLottery(filterLottery === 'QUINA' ? 'ALL' : 'QUINA')}
            className={`caixa-tile p-4 flex flex-col items-center justify-center text-center gap-2.5 ${
              filterLottery === 'QUINA' ? 'ring-1 ring-[#005CA9]' : ''
            }`}
          >
            <div className="caixa-icon-halo">
              <Award className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="font-display font-bold text-xs text-[#005CA9] leading-snug">
              Quina de São João
              <span className="block font-normal text-[11px] text-[#5F6C7B] mt-0.5">
                5 a 15 dezenas
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* TELA MODAL DE CADASTRO DE NOVA EMPRESA (EXCLUSIVO USUÁRIO LOGADO)     */}
      {/* ===================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-[406px] caixa-card overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/85">
                  Novo Grupo Corporativo (Multitenant)
                </div>
                <h2 className="font-display font-bold text-sm">
                  Cadastrar Empresa e Bolão
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px]"
                aria-label="Fechar modal de empresa"
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
              onSubmit={handleSubmitNewCompany}
              className="p-4 space-y-3 text-xs bg-white max-h-[80vh] overflow-y-auto"
            >
              {/* 1. Nome da Empresa (Não pode ser repetido) */}
              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  1. Nome da empresa (não pode ser repetido) *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Ex: Empresa E — Manutenção Sul"
                  className={`caixa-input ${
                    isDuplicateName ? 'border-red-500 bg-red-50' : ''
                  }`}
                />
                {isDuplicateName && (
                  <p className="text-[11px] font-semibold text-red-700 mt-1">
                    Este nome de empresa já está cadastrado. Informe um nome exclusivo.
                  </p>
                )}
              </div>

              {/* 2. Setor (Mecânica, DOT, Orange Cap, Limpeza e etc.) */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-[#333E48]">
                  2. Setor (Mecânica, DOT, Orange Cap, Limpeza e etc.) *
                </label>
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="caixa-input"
                >
                  {PREDEFINED_SECTORS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>

                {selectedSector === 'Outro Setor (Digitar)' && (
                  <input
                    type="text"
                    required
                    value={customSector}
                    onChange={(e) => setCustomSector(e.target.value)}
                    placeholder="Digite o nome do setor"
                    className="caixa-input"
                  />
                )}
              </div>

              {/* 3. Logotipo da Empresa */}
              <div className="space-y-2 pt-1">
                <label className="block font-semibold text-[#333E48]">
                  3. Logotipo da empresa
                </label>

                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logotipo Preview"
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 object-cover border border-[#D5E0EC] rounded-[4px] bg-white shrink-0"
                    />
                  ) : (
                    <div
                      className="w-11 h-11 text-white font-display font-extrabold text-sm flex items-center justify-center shrink-0 rounded-[4px]"
                      style={{ backgroundColor: logoColor }}
                    >
                      {name.trim().slice(0, 2).toUpperCase() || 'LG'}
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <label className="h-9 px-3 bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Selecionar imagem do logotipo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="Ou cole a URL da imagem (opcional)"
                      className="caixa-input h-8 text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Dados do Responsável (PREENCHIMENTO AUTOMÁTICO PELO SISTEMA) */}
              <div className="pt-2 border-t border-[#EDF2F7] space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#005CA9]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Responsável (Preenchimento Automático pelo Sistema)</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#5F6C7B]">Nome do responsável</span>
                    <span className="font-bold text-[#333E48]">{currentUser.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#5F6C7B]">Função</span>
                    <span className="font-semibold text-[#333E48]">{currentUser.jobTitle}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#5F6C7B]">Chave Pix recebimento</span>
                    <span className="font-mono-tabular font-bold text-[#008B47]">
                      {currentUser.pixKey}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#5F6C7B]">WhatsApp</span>
                    <span className="font-mono-tabular text-[#333E48]">
                      {currentUser.whatsapp}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#5F6C7B]">E-mail</span>
                    <span className="text-[#333E48]">{currentUser.email}</span>
                  </div>
                </div>
              </div>

              {/* 5. Configuração Inicial do Bolão da Empresa */}
              <div className="pt-2 border-t border-[#EDF2F7] space-y-2.5">
                <div className="font-bold text-[#333E48] text-xs">
                  Parâmetros iniciais do bolão
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-[#333E48] mb-1">
                      Modalidade CAIXA
                    </label>
                    <select
                      value={lotteryType}
                      onChange={(e) => setLotteryType(e.target.value as LotteryType)}
                      className="caixa-input"
                    >
                      <option value="MEGA_SENA">Mega da Virada / Mega-Sena</option>
                      <option value="LOTOFACIL">Lotofácil Especial</option>
                      <option value="QUINA">Quina de São João</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#333E48] mb-1">
                      Valor da cota (R$)
                    </label>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={quotaValue}
                      onChange={(e) => setQuotaValue(e.target.value)}
                      className="caixa-input font-mono-tabular font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-[#333E48] mb-1">
                      Teto arrecadação (R$)
                    </label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={maxTargetAmount}
                      onChange={(e) => setMaxTargetAmount(e.target.value)}
                      className="caixa-input font-mono-tabular font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#333E48] mb-1">
                      Encerramento
                    </label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="caixa-input font-mono-tabular text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || isDuplicateName}
                  className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] disabled:bg-slate-400 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{submitting ? 'Salvando...' : 'Salvar Empresa'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
