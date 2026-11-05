import React, { useState, useEffect } from 'react';
import {
  Company,
  Pool,
  Participant,
  QuotaPurchase,
  UserRole,
  CollectionMode,
  SystemUser,
} from '../types';
import {
  formatCurrencyBRL,
  maskCpf,
  maskName,
} from '../utils/lotteryMath';
import { CountdownClock } from './CountdownClock';
import {
  CheckSquare,
  Copy,
  Check,
  QrCode,
  ShieldAlert,
  UserPlus,
  Lock,
  Unlock,
  FileText,
  Zap,
  Settings,
  Send,
  ChevronRight,
  X,
} from 'lucide-react';

interface PoolActionTabProps {
  currentUser: SystemUser;
  company: Company;
  pool: Pool;
  participants: Participant[];
  purchases: QuotaPurchase[];
  userRole: UserRole;
  onCreatePixPurchase: (payload: any) => Promise<QuotaPurchase>;
  onConciliatePixNow: (purchaseId: string) => Promise<QuotaPurchase>;
  onRegisterParticipant: (payload: any) => Promise<void>;
  onUpdatePoolConfig: (poolId: string, payload: any) => Promise<void>;
  onOpenCoupon: (purchase: QuotaPurchase) => void;
}

export const PoolActionTab: React.FC<PoolActionTabProps> = ({
  currentUser,
  company,
  pool,
  participants,
  purchases,
  userRole,
  onCreatePixPurchase,
  onConciliatePixNow,
  onRegisterParticipant,
  onUpdatePoolConfig,
  onOpenCoupon,
}) => {
  // Quota Purchase Form State pre-filled from Logged-in User
  const [quotasCount, setQuotasCount] = useState<number>(2);
  const [buyerName, setBuyerName] = useState(currentUser.name);
  const [buyerCpf, setBuyerCpf] = useState(currentUser.cpf);
  const [buyerEmail, setBuyerEmail] = useState(currentUser.email);
  const [buyerWhatsapp, setBuyerWhatsapp] = useState(currentUser.whatsapp);
  const [buyerDepartment, setBuyerDepartment] = useState(currentUser.jobTitle);
  const [buyerPixKey, setBuyerPixKey] = useState(currentUser.pixKey);
  const [activePixPurchase, setActivePixPurchase] = useState<QuotaPurchase | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Sync if currentUser changes
  useEffect(() => {
    setBuyerName(currentUser.name);
    setBuyerCpf(currentUser.cpf);
    setBuyerEmail(currentUser.email);
    setBuyerWhatsapp(currentUser.whatsapp);
    setBuyerDepartment(currentUser.jobTitle);
    setBuyerPixKey(currentUser.pixKey);
  }, [currentUser]);

  // Manager Collaborator Registration State
  const [showAddCollab, setShowAddCollab] = useState(false);
  const [newCollabName, setNewCollabName] = useState('');
  const [newCollabCpf, setNewCollabCpf] = useState('');
  const [newCollabEmail, setNewCollabEmail] = useState('');
  const [newCollabWhatsapp, setNewCollabWhatsapp] = useState('');
  const [newCollabDept, setNewCollabDept] = useState('Mecânica');
  const [newCollabPixKey, setNewCollabPixKey] = useState('');

  // Manager Pool Config Edit State
  const [showConfigPool, setShowConfigPool] = useState(false);
  const [editQuotaValue, setEditQuotaValue] = useState(String(pool.quotaValue));
  const [editMaxTarget, setEditMaxTarget] = useState(String(pool.maxTargetAmount));
  const [editMode, setEditMode] = useState<CollectionMode>(pool.collectionMode);
  const [editEndDate, setEditEndDate] = useState(pool.endDate.slice(0, 16));
  const [remindedParticipantId, setRemindedParticipantId] = useState<string | null>(null);

  const poolPurchases = purchases.filter((p) => p.poolId === pool.id);
  const confirmedPurchases = poolPurchases.filter((p) => p.paymentStatus === 'CONFIRMED');
  const pendingPurchases = poolPurchases.filter((p) => p.paymentStatus === 'PENDING');

  const totalConfirmedAmount = confirmedPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalNetPoolAmount = confirmedPurchases.reduce((acc, p) => acc + p.netPoolAmount, 0);
  const totalQuotasSold = confirmedPurchases.reduce((acc, p) => acc + p.quotasCount, 0);

  const checkoutTotal = quotasCount * pool.quotaValue;
  const checkoutFee = Number(((checkoutTotal * pool.platformFeePercent) / 100).toFixed(2));
  const checkoutNetOrganizer = Number((checkoutTotal - checkoutFee).toFixed(2));

  const canSeeNominalList = userRole === 'MANAGER' || userRole === 'SUPER_ADMIN';

  const handleGeneratePix = async (autoConfirmNow: boolean) => {
    if (!buyerName.trim() || !buyerCpf.trim()) return;
    setProcessingPayment(true);
    try {
      const created = await onCreatePixPurchase({
        poolId: pool.id,
        companyId: company.id,
        participantName: buyerName,
        participantCpf: buyerCpf,
        participantEmail: buyerEmail,
        participantWhatsapp: buyerWhatsapp,
        participantDepartment: buyerDepartment,
        participantPixKey: buyerPixKey,
        quotasCount,
        autoConfirmNow,
      });
      setActivePixPurchase(created);
      if (autoConfirmNow) {
        onOpenCoupon(created);
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleConciliateActivePix = async (purchaseId: string) => {
    setProcessingPayment(true);
    try {
      const updated = await onConciliatePixNow(purchaseId);
      setActivePixPurchase(updated);
      onOpenCoupon(updated);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSaveCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollabName.trim() || !newCollabCpf.trim()) return;
    await onRegisterParticipant({
      companyId: company.id,
      poolId: pool.id,
      name: newCollabName,
      cpf: newCollabCpf,
      email: newCollabEmail,
      whatsapp: newCollabWhatsapp,
      department: newCollabDept,
      pixKey: newCollabPixKey,
      registeredBy: 'MANAGER',
    });
    setNewCollabName('');
    setNewCollabCpf('');
    setNewCollabEmail('');
    setNewCollabWhatsapp('');
    setNewCollabPixKey('');
    setShowAddCollab(false);
  };

  const handleSavePoolConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdatePoolConfig(pool.id, {
      quotaValue: Number(editQuotaValue) || pool.quotaValue,
      maxTargetAmount: Number(editMaxTarget) || pool.maxTargetAmount,
      collectionMode: editMode,
      endDate: new Date(editEndDate).toISOString(),
    });
    setShowConfigPool(false);
  };

  return (
    <div className="px-4 py-4 space-y-5">
      {/* 1. Top Key-Value Summary Card (Exact Image 2 "Resumo" Layout — Zero Nested Boxes) */}
      <div className="caixa-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#EDF2F7]">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm text-[#333E48]">
              {company.name} — {pool.title}
            </h1>
            <p className="text-xs text-[#5F6C7B] mt-0.5">
              Setor {company.segment} · Responsável: {company.managerName}
            </p>
          </div>
          {canSeeNominalList && (
            <button
              type="button"
              onClick={() => setShowConfigPool(true)}
              className="text-xs font-bold text-[#005CA9] flex items-center gap-0.5 shrink-0"
            >
              <span>Regras</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Clean Key-Value Financial Rows like Screenshot 2 */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Valor da cota unitária</span>
            <span className="font-mono-tabular font-bold text-[#333E48]">
              {formatCurrencyBRL(pool.quotaValue)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Total arrecadado no bolão</span>
            <span className="font-mono-tabular font-bold text-[#008B47]">
              {formatCurrencyBRL(totalConfirmedAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Cotas confirmadas</span>
            <span className="font-mono-tabular font-semibold text-[#333E48]">
              {totalQuotasSold} de {pool.maxQuotas} cotas
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Taxa administrativa Split</span>
            <span className="font-mono-tabular font-semibold text-[#333E48]">
              {pool.platformFeePercent}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. Live Countdown Clock Card */}
      <CountdownClock startDate={pool.startDate} endDate={pool.endDate} />

      {/* 3. Section "Pagamentos" — 3-Column Service Tiles + Quota Form */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-[#333E48]">
            Pagamentos e cotas
          </h2>
          <span className="text-xs font-bold text-[#005CA9]">
            Split Pix Automático
          </span>
        </div>

        {/* 3-Column Service Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={processingPayment}
            onClick={() => handleGeneratePix(false)}
            className="caixa-tile p-3 flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="caixa-icon-halo">
              <QrCode className="w-5 h-5 text-[#005CA9]" />
            </div>
            <span className="font-display font-bold text-xs text-[#005CA9] leading-tight">
              Gerar Pix QR Code
            </span>
          </button>

          <button
            type="button"
            disabled={processingPayment}
            onClick={() => handleGeneratePix(true)}
            className="caixa-tile p-3 flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="caixa-icon-halo">
              <Zap className="w-5 h-5 text-[#005CA9]" />
            </div>
            <span className="font-display font-bold text-xs text-[#005CA9] leading-tight">
              Pagar Pix + Cupom
            </span>
          </button>

          {canSeeNominalList ? (
            <button
              type="button"
              onClick={() => setShowAddCollab(true)}
              className="caixa-tile p-3 flex flex-col items-center justify-center text-center gap-2"
            >
              <div className="caixa-icon-halo">
                <UserPlus className="w-5 h-5 text-[#005CA9]" />
              </div>
              <span className="font-display font-bold text-xs text-[#005CA9] leading-tight">
                Cadastrar colaborador
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (confirmedPurchases[0]) onOpenCoupon(confirmedPurchases[0]);
              }}
              className="caixa-tile p-3 flex flex-col items-center justify-center text-center gap-2"
            >
              <div className="caixa-icon-halo">
                <FileText className="w-5 h-5 text-[#005CA9]" />
              </div>
              <span className="font-display font-bold text-xs text-[#005CA9] leading-tight">
                Último cupom digital
              </span>
            </button>
          )}
        </div>

        {/* Floating Quota Purchase Configuration Card */}
        <div className="caixa-card p-4 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-[#333E48] mb-1">
              Participante titular da compra
            </label>
            <select
              onChange={(e) => {
                if (e.target.value === 'CURRENT_USER') {
                  setBuyerName(currentUser.name);
                  setBuyerCpf(currentUser.cpf);
                  setBuyerEmail(currentUser.email);
                  setBuyerWhatsapp(currentUser.whatsapp);
                  setBuyerDepartment(currentUser.jobTitle);
                  setBuyerPixKey(currentUser.pixKey);
                  return;
                }
                const found = participants.find((p) => p.id === e.target.value);
                if (found) {
                  setBuyerName(found.name);
                  setBuyerCpf(found.cpf);
                  setBuyerEmail(found.email);
                  setBuyerWhatsapp(found.whatsapp);
                  setBuyerDepartment(found.department);
                  setBuyerPixKey(found.pixKey || currentUser.pixKey);
                }
              }}
              className="caixa-input"
            >
              <option value="CURRENT_USER">
                Meu cadastro: {currentUser.name} ({currentUser.jobTitle})
              </option>
              {participants
                .filter((p) => p.companyId === company.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.department})
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-[#333E48] mb-1">Nome completo</label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="caixa-input"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#333E48] mb-1">CPF</label>
              <input
                type="text"
                value={buyerCpf}
                onChange={(e) => setBuyerCpf(e.target.value)}
                className="caixa-input font-mono-tabular"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-[#333E48] mb-1">Função / Setor</label>
              <input
                type="text"
                value={buyerDepartment}
                onChange={(e) => setBuyerDepartment(e.target.value)}
                className="caixa-input"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#333E48] mb-1">Chave Pix</label>
              <input
                type="text"
                value={buyerPixKey}
                onChange={(e) => setBuyerPixKey(e.target.value)}
                className="caixa-input font-mono-tabular"
              />
            </div>
          </div>

          {/* Quotas Quantity Selector */}
          <div>
            <label className="block font-semibold text-[#333E48] mb-1.5">
              Quantidade de cotas desejada ({formatCurrencyBRL(pool.quotaValue)} cada)
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 5, 10].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setQuotasCount(qty)}
                  className={`h-10 font-mono-tabular font-bold text-xs rounded-[4px] transition-colors ${
                    quotasCount === qty
                      ? 'bg-[#005CA9] text-white'
                      : 'bg-[#F7F9FC] text-[#333E48] border border-[#D5E0EC] hover:bg-[#EBF4FC]'
                  }`}
                >
                  {qty}x
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={200}
                value={quotasCount}
                onChange={(e) => setQuotasCount(Math.max(1, Number(e.target.value) || 1))}
                className="caixa-input h-10 px-1.5 text-center font-mono-tabular font-bold"
                title="Digite qualquer quantidade de cotas"
              />
            </div>
          </div>

          {/* Clean Key-Value Split Preview (No Nested Box) */}
          <div className="pt-3 border-t border-[#EDF2F7] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#333E48]">
                Valor total ({quotasCount} cotas)
              </span>
              <span className="font-mono-tabular font-bold text-sm text-[#008B47]">
                {formatCurrencyBRL(checkoutTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#5F6C7B]">
              <span>Repasse automático organizador ({100 - pool.platformFeePercent}%)</span>
              <span className="font-mono-tabular font-semibold text-[#333E48]">
                {formatCurrencyBRL(checkoutNetOrganizer)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#5F6C7B]">
              <span>Taxa administrativa plataforma ({pool.platformFeePercent}%)</span>
              <span className="font-mono-tabular font-semibold text-[#333E48]">
                {formatCurrencyBRL(checkoutFee)}
              </span>
            </div>
          </div>
        </div>

        {/* Active Pix QR Code Floating Card */}
        {activePixPurchase && (
          <div className="caixa-card p-4 space-y-3 text-xs ring-1 ring-[#005CA9]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#005CA9] uppercase">
                  Cobrança Pix Asaas Split
                </span>
                <div className="font-bold text-sm text-[#333E48]">
                  {activePixPurchase.quotasCount} cota(s) —{' '}
                  {formatCurrencyBRL(activePixPurchase.totalAmount)}
                </div>
              </div>
              <span
                className={`px-2.5 py-1 text-[10px] font-bold rounded-[4px] ${
                  activePixPurchase.paymentStatus === 'CONFIRMED'
                    ? 'bg-emerald-50 text-[#008B47]'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {activePixPurchase.paymentStatus === 'CONFIRMED' ? 'CONCILIADO' : 'AGUARDANDO PIX'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={activePixPurchase.pixQrCodePayload}
                className="caixa-input font-mono-tabular text-[11px] flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(activePixPurchase.pixQrCodePayload);
                  setCopiedPix(true);
                  setTimeout(() => setCopiedPix(false), 2000);
                }}
                className="h-10 px-3 bg-[#EBF4FC] text-[#005CA9] font-bold text-xs rounded-[4px] flex items-center gap-1 shrink-0"
              >
                {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPix ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {activePixPurchase.paymentStatus === 'PENDING' ? (
              <button
                type="button"
                disabled={processingPayment}
                onClick={() => handleConciliateActivePix(activePixPurchase.id)}
                className="w-full min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Simular Pagamento Pix & Conciliação Imediata</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenCoupon(activePixPurchase)}
                className="w-full min-h-[42px] bg-[#008B47] hover:bg-emerald-800 text-white font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>Abrir Cupom Digital ({activePixPurchase.couponHash})</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* 4. Collaborators Participation Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {canSeeNominalList ? (
              <Unlock className="w-4 h-4 text-[#008B47]" />
            ) : (
              <Lock className="w-4 h-4 text-[#005CA9]" />
            )}
            <h2 className="font-display font-bold text-base text-[#333E48]">
              Participantes ({poolPurchases.length})
            </h2>
          </div>

          {canSeeNominalList ? (
            <button
              type="button"
              onClick={() => setShowAddCollab(true)}
              className="text-xs font-bold text-[#005CA9] flex items-center gap-0.5"
            >
              <span>+ Colaborador</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#5F6C7B]">
              Anonimato ativo
            </span>
          )}
        </div>

        {!canSeeNominalList && (
          <div className="caixa-card p-3.5 text-xs text-[#5F6C7B] flex items-center gap-2.5">
            <div className="caixa-icon-halo w-8 h-8">
              <ShieldAlert className="w-4 h-4 text-[#005CA9]" />
            </div>
            <span>
              Nomes dos colegas estão protegidos por anonimato. Apenas o gestor da empresa visualiza dados nominais.
            </span>
          </div>
        )}

        <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
          {poolPurchases.map((pur, idx) => {
            const displayName = canSeeNominalList
              ? pur.participantName
              : maskName(pur.participantName, idx);
            const displayCpf = canSeeNominalList ? pur.participantCpf : maskCpf(pur.participantCpf);

            return (
              <div key={pur.id} className="py-3.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-[#333E48] truncate">{displayName}</div>
                  <div className="text-[11px] text-[#5F6C7B] font-mono-tabular mt-0.5">
                    CPF {displayCpf}
                    {canSeeNominalList && pur.participantWhatsapp
                      ? ` · ${pur.participantWhatsapp}`
                      : ` · ${pur.couponHash}`}
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <div className="font-mono-tabular font-bold text-[#333E48]">
                    {pur.quotasCount} cota(s) · {formatCurrencyBRL(pur.totalAmount)}
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {pur.paymentStatus === 'CONFIRMED' ? (
                      <button
                        type="button"
                        onClick={() => onOpenCoupon(pur)}
                        className="text-[11px] font-bold text-[#005CA9] flex items-center gap-0.5"
                      >
                        <span>Ver cupom</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        {canSeeNominalList && (
                          <button
                            type="button"
                            onClick={() => setRemindedParticipantId(pur.id)}
                            className="px-2 py-0.5 bg-[#F7F9FC] text-[#5F6C7B] text-[10px] font-semibold rounded-[4px] flex items-center gap-0.5"
                          >
                            <Send className="w-2.5 h-2.5" />
                            <span>
                              {remindedParticipantId === pur.id ? 'Enviado' : 'Cobrar'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleConciliateActivePix(pur.id)}
                          className="text-[11px] font-bold text-amber-700 flex items-center gap-0.5"
                        >
                          <span>Conciliar Pix</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* MODAL 1: CONFIGURAÇÃO DE REGRAS DO BOLÃO                              */}
      {/* ===================================================================== */}
      {showConfigPool && canSeeNominalList && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-[406px] caixa-card overflow-hidden my-auto">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/85">
                  Gestão do Bolão · {company.name}
                </div>
                <h3 className="font-display font-bold text-sm">
                  Regras e Meta de Arrecadação
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigPool(false)}
                className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePoolConfig} className="p-4 space-y-3 text-xs bg-white">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Valor unitário cota (R$)
                  </label>
                  <input
                    type="number"
                    value={editQuotaValue}
                    onChange={(e) => setEditQuotaValue(e.target.value)}
                    className="caixa-input font-mono-tabular font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Teto máximo bolão (R$)
                  </label>
                  <input
                    type="number"
                    value={editMaxTarget}
                    onChange={(e) => setEditMaxTarget(e.target.value)}
                    className="caixa-input font-mono-tabular font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Modalidade de meta
                  </label>
                  <select
                    value={editMode}
                    onChange={(e) => setEditMode(e.target.value as CollectionMode)}
                    className="caixa-input"
                  >
                    <option value="MAX_TARGET">Teto Máximo Fixo</option>
                    <option value="FIXED_QUOTA">Valor por Cota Livre</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Encerramento
                  </label>
                  <input
                    type="datetime-local"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="caixa-input font-mono-tabular text-[11px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigPool(false)}
                  className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-bold text-xs rounded-[4px]"
                >
                  Salvar Regras
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CADASTRO DE COLABORADOR PELO GESTOR                          */}
      {/* ===================================================================== */}
      {showAddCollab && canSeeNominalList && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-[406px] caixa-card overflow-hidden my-auto">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/85">
                  Gestão de Participantes · {company.name}
                </div>
                <h3 className="font-display font-bold text-sm">
                  Cadastrar Colaborador no Bolão
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCollab(false)}
                className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCollaborator}
              className="p-4 space-y-3 text-xs bg-white"
            >
              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  1. Nome completo do colaborador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Digite o nome completo"
                  value={newCollabName}
                  onChange={(e) => setNewCollabName(e.target.value)}
                  className="caixa-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    2. WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="(00) 90000-0000"
                    value={newCollabWhatsapp}
                    onChange={(e) => setNewCollabWhatsapp(e.target.value)}
                    className="caixa-input font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    3. CPF *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={newCollabCpf}
                    onChange={(e) => setNewCollabCpf(e.target.value)}
                    className="caixa-input font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    4. E-mail corporativo *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="colaborador@empresa.com.br"
                    value={newCollabEmail}
                    onChange={(e) => setNewCollabEmail(e.target.value)}
                    className="caixa-input"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    5. Empresa
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={company.name}
                    className="caixa-input bg-[#F1F5F9] font-semibold text-[#5F6C7B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    6. Função / Setor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mecânica, DOT, Limpeza..."
                    value={newCollabDept}
                    onChange={(e) => setNewCollabDept(e.target.value)}
                    className="caixa-input"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    7. Chave Pix recebimento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CPF, Celular ou E-mail"
                    value={newCollabPixKey}
                    onChange={(e) => setNewCollabPixKey(e.target.value)}
                    className="caixa-input font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCollab(false)}
                  className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Salvar Cadastro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
