import React, { useState } from 'react';
import {
  Company,
  Pool,
  Participant,
  QuotaPurchase,
  UserRole,
  SystemUser,
} from '../types';
import { formatCurrencyBRL } from '../utils/lotteryMath';
import { getInitialsFromName } from '../utils/historicalDraws';
import {
  Copy,
  Check,
  QrCode,
  FileText,
  Wallet,
  CheckCircle2,
  Clock,
  CreditCard,
  ListChecks,
  PieChart,
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

type PaymentSectionTab = 'RESUMO' | 'PAGAR' | 'EXTRATO';

export const PoolActionTab: React.FC<PoolActionTabProps> = ({
  currentUser,
  company,
  pool,
  purchases,
  userRole,
  onCreatePixPurchase,
  onConciliatePixNow,
  onOpenCoupon,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PaymentSectionTab>('RESUMO');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING'>('ALL');
  const [quotasCount, setQuotasCount] = useState<number>(1);
  const [activePixPurchase, setActivePixPurchase] = useState<QuotaPurchase | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedHolderPix, setCopiedHolderPix] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const poolPurchases = purchases.filter((p) => p.poolId === pool.id);
  const confirmedPurchases = poolPurchases.filter((p) => p.paymentStatus === 'CONFIRMED');
  const pendingPurchases = poolPurchases.filter((p) => p.paymentStatus === 'PENDING');

  const totalConfirmedAmount = confirmedPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalPendingAmount = pendingPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalQuotasSold = confirmedPurchases.reduce((acc, p) => acc + p.quotasCount, 0);

  const hasTargetCeiling = pool.maxTargetAmount > 0;
  const progressPercent = hasTargetCeiling
    ? Math.min(100, Math.round((totalConfirmedAmount / pool.maxTargetAmount) * 100))
    : 0;

  const cleanUserCpf = currentUser.cpf.replace(/\D/g, '');
  const isOrganizer =
    userRole === 'MANAGER' ||
    userRole === 'SUPER_ADMIN' ||
    company.managerId === currentUser.id ||
    company.managerEmail.toLowerCase() === currentUser.email.toLowerCase() ||
    company.managerCpf.replace(/\D/g, '') === cleanUserCpf ||
    company.managerName.toLowerCase() === currentUser.name.toLowerCase();

  const myPoolPurchases = poolPurchases.filter(
    (p) =>
      p.participantCpf.replace(/\D/g, '') === cleanUserCpf ||
      p.participantEmail.toLowerCase() === currentUser.email.toLowerCase() ||
      p.participantName.toLowerCase() === currentUser.name.toLowerCase()
  );

  const holderPixKey = company.managerPixKey || company.managerCpf;

  const handleCopyHolderPix = () => {
    navigator.clipboard?.writeText(holderPixKey);
    setCopiedHolderPix(true);
    setTimeout(() => setCopiedHolderPix(false), 2000);
  };

  const handleGeneratePix = async (autoConfirmNow: boolean) => {
    setProcessingPayment(true);
    try {
      const created = await onCreatePixPurchase({
        poolId: pool.id,
        companyId: company.id,
        participantName: currentUser.name,
        participantCpf: currentUser.cpf,
        participantEmail: currentUser.email,
        participantWhatsapp: currentUser.whatsapp,
        participantDepartment: currentUser.jobTitle || 'Participante',
        participantPixKey: currentUser.pixKey,
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

  const handleConfirmPendingPayment = async (purchaseId: string) => {
    setProcessingPayment(true);
    try {
      const updated = await onConciliatePixNow(purchaseId);
      if (activePixPurchase?.id === purchaseId) {
        setActivePixPurchase(updated);
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const filteredPurchases = poolPurchases.filter((p) =>
    paymentFilter === 'ALL' ? true : p.paymentStatus === paymentFilter
  );

  return (
    <div className="px-4 py-4 space-y-3.5">
      {/* CABEÇALHO COMPACTO + NAVEGAÇÃO EM 3 ABAS SEPARADAS */}
      <div className="caixa-card overflow-hidden">
        <div className="p-4 pb-3">
          <span className="text-[10px] font-bold text-[#005CA9] uppercase tracking-wide block truncate">
            {company.name} · Conc. {pool.contestNumber}
          </span>
          <h1 className="font-display font-bold text-sm text-[#1E293B] truncate mt-0.5">
            {pool.title}
          </h1>
        </div>

        <div className="grid grid-cols-3 border-t border-[#E2E8F0] bg-[#F7F9FC]">
          <button
            type="button"
            onClick={() => setActiveSubTab('RESUMO')}
            className={`h-10 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'RESUMO'
                ? 'border-[#005CA9] text-[#005CA9] bg-white'
                : 'border-transparent text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Resumo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('PAGAR')}
            className={`h-10 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'PAGAR'
                ? 'border-[#008B47] text-[#008B47] bg-white'
                : 'border-transparent text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pagar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('EXTRATO')}
            className={`h-10 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'EXTRATO'
                ? 'border-[#005CA9] text-[#005CA9] bg-white'
                : 'border-transparent text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Extrato ({poolPurchases.length})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ABA 1: RESUMO FINANCEIRO E CHAVE PIX (SEM BOX DENTRO DE BOX)          */}
      {/* ===================================================================== */}
      {activeSubTab === 'RESUMO' && (
        <div className="space-y-3.5">
          {/* Card 1: Balanço do Bolão em linhas limpas sem vazamento */}
          <div className="caixa-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-2">
              <span className="text-xs font-bold text-[#1E293B]">
                Balanço do Bolão
              </span>
              <span className="text-[11px] font-mono-tabular font-bold text-[#008B47]">
                {totalQuotasSold} cotas pagas
              </span>
            </div>

            <div className="divide-y divide-[#EDF2F7] text-xs">
              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#5F6C7B]">Valor da Cota</span>
                <span className="font-mono-tabular font-extrabold text-sm text-[#1E293B]">
                  {formatCurrencyBRL(pool.quotaValue)}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#008B47] font-semibold">
                  Arrecadado ({confirmedPurchases.length} pagos)
                </span>
                <span className="font-mono-tabular font-extrabold text-sm text-[#008B47]">
                  {formatCurrencyBRL(totalConfirmedAmount)}
                </span>
              </div>

              {totalPendingAmount > 0 && (
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[#D97706] font-semibold">
                    Pendente ({pendingPurchases.length} aguardando)
                  </span>
                  <span className="font-mono-tabular font-bold text-xs text-[#D97706]">
                    {formatCurrencyBRL(totalPendingAmount)}
                  </span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#5F6C7B]">Teto do Bolão</span>
                <span className="font-mono-tabular font-bold text-xs text-[#333E48]">
                  {hasTargetCeiling ? formatCurrencyBRL(pool.maxTargetAmount) : 'Livre'}
                </span>
              </div>
            </div>

            {hasTargetCeiling && (
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#5F6C7B]">Meta atingida</span>
                  <span className="font-mono-tabular font-bold text-[#008B47]">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[#EDF2F7] rounded-[4px] overflow-hidden">
                  <div
                    className="h-full bg-[#008B47] transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setActivePixPurchase(null);
                setActiveSubTab('PAGAR');
              }}
              className="w-full h-10 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Pagar Cota ({formatCurrencyBRL(pool.quotaValue)})</span>
            </button>
          </div>

          {/* Card 2: Conta Recebedora / Chave Pix separada e sem vazamento */}
          <div className="caixa-card p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Wallet className="w-4 h-4 text-[#005CA9] shrink-0" />
                <span className="text-xs font-bold text-[#1E293B] truncate">
                  Recebedor: {company.managerName}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyHolderPix}
                className="h-8 px-3 rounded-[4px] bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedHolderPix ? (
                  <Check className="w-3.5 h-3.5 text-[#008B47]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedHolderPix ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between gap-2 text-xs">
              <span className="text-[#5F6C7B] shrink-0">Chave Pix:</span>
              <span className="font-mono-tabular font-bold text-[#333E48] truncate">
                {holderPixKey}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 2: PAGAR COTA E MINHAS COTAS (DIRETO NA ABA, SEM MODAL)           */}
      {/* ===================================================================== */}
      {activeSubTab === 'PAGAR' && (
        <div className="space-y-3.5">
          <div className="caixa-card p-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-2.5">
              <div>
                <h2 className="font-display font-bold text-sm text-[#1E293B]">
                  Adquirir Cotas
                </h2>
                <p className="text-[11px] text-[#5F6C7B]">
                  Apostador: <strong className="text-[#333E48]">{currentUser.name}</strong>
                </p>
              </div>
              <span className="font-mono-tabular font-bold text-xs text-[#005CA9]">
                {formatCurrencyBRL(pool.quotaValue)} / cota
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#5F6C7B] mb-1.5">
                Quantidade de cotas:
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 5, 10].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => {
                      setQuotasCount(qty);
                      setActivePixPurchase(null);
                    }}
                    className={`h-9 font-mono-tabular font-bold text-xs rounded-[4px] transition-colors cursor-pointer ${
                      quotasCount === qty
                        ? 'bg-[#005CA9] text-white'
                        : 'bg-[#F7F9FC] text-[#333E48] hover:bg-[#EBF4FC]'
                    }`}
                  >
                    {qty}x
                  </button>
                ))}
              </div>
            </div>

            <div className="py-2.5 border-y border-[#EDF2F7] flex items-center justify-between">
              <span className="font-bold text-[#1E293B]">
                Total ({quotasCount} {quotasCount === 1 ? 'cota' : 'cotas'})
              </span>
              <span className="font-mono-tabular font-extrabold text-base text-[#008B47]">
                {formatCurrencyBRL(quotasCount * pool.quotaValue)}
              </span>
            </div>

            {activePixPurchase ? (
              <div className="space-y-2.5">
                <span className="block font-bold text-[#005CA9]">
                  Pix Copia e Cola gerado:
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={activePixPurchase.pixQrCodePayload}
                    className="caixa-input font-mono-tabular text-[11px] flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(activePixPurchase.pixQrCodePayload);
                      setCopiedPix(true);
                      setTimeout(() => setCopiedPix(false), 2000);
                    }}
                    className="h-10 px-3 bg-[#EBF4FC] text-[#005CA9] font-bold text-xs rounded-[4px] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedPix ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedPix ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('EXTRATO')}
                  className="w-full h-10 bg-[#005CA9] text-white font-bold text-xs rounded-[4px] cursor-pointer"
                >
                  Ver no Extrato
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={processingPayment}
                  onClick={() => handleGeneratePix(false)}
                  className="h-10 bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Gerar Pix</span>
                </button>
                <button
                  type="button"
                  disabled={processingPayment}
                  onClick={() => handleGeneratePix(true)}
                  className="h-10 bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar</span>
                </button>
              </div>
            )}
          </div>

          {/* Minhas Cotas neste Bolão */}
          {myPoolPurchases.length > 0 && (
            <div className="caixa-card p-4 space-y-2.5">
              <span className="text-xs font-bold text-[#1E293B] block border-b border-[#EDF2F7] pb-2">
                Minhas Cotas ({myPoolPurchases.length})
              </span>
              <div className="divide-y divide-[#EDF2F7] text-xs">
                {myPoolPurchases.map((pur) => {
                  const isPaid = pur.paymentStatus === 'CONFIRMED';
                  return (
                    <div
                      key={pur.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-mono-tabular font-bold text-[#1E293B] block">
                          {pur.quotasCount} {pur.quotasCount === 1 ? 'cota' : 'cotas'} ·{' '}
                          {formatCurrencyBRL(pur.totalAmount)}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            isPaid ? 'text-[#008B47]' : 'text-[#D97706]'
                          }`}
                        >
                          {isPaid ? 'Pagamento confirmado' : 'Aguardando Pix'}
                        </span>
                      </div>

                      {isPaid && (
                        <button
                          type="button"
                          onClick={() => onOpenCoupon(pur)}
                          className="h-8 px-2.5 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Recibo</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 3: EXTRATO DE PAGAMENTOS (NOMES DE PENDENTES SÓ PARA ADMINS)      */}
      {/* ===================================================================== */}
      {activeSubTab === 'EXTRATO' && (
        <div className="space-y-3">
          {/* Sub-filtro enxuto */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#E6EEF6] rounded-[4px]">
            <button
              type="button"
              onClick={() => setPaymentFilter('ALL')}
              className={`h-8 rounded-[3px] text-xs font-bold transition-colors cursor-pointer ${
                paymentFilter === 'ALL'
                  ? 'bg-white text-[#005CA9]'
                  : 'text-[#5F6C7B] hover:text-[#1E293B]'
              }`}
            >
              Todos ({poolPurchases.length})
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('CONFIRMED')}
              className={`h-8 rounded-[3px] text-xs font-bold transition-colors cursor-pointer ${
                paymentFilter === 'CONFIRMED'
                  ? 'bg-white text-[#008B47]'
                  : 'text-[#5F6C7B] hover:text-[#1E293B]'
              }`}
            >
              Pagos ({confirmedPurchases.length})
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('PENDING')}
              className={`h-8 rounded-[3px] text-xs font-bold transition-colors cursor-pointer ${
                paymentFilter === 'PENDING'
                  ? 'bg-white text-[#D97706]'
                  : 'text-[#5F6C7B] hover:text-[#1E293B]'
              }`}
            >
              Pendentes ({pendingPurchases.length})
            </button>
          </div>

          {!isOrganizer && paymentFilter === 'PENDING' ? (
            <div className="caixa-card p-5 text-center space-y-2 text-xs">
              <div className="font-bold text-[#1E293B]">
                {pendingPurchases.length}{' '}
                {pendingPurchases.length === 1
                  ? 'pagamento pendente'
                  : 'pagamentos pendentes'}{' '}
                ({formatCurrencyBRL(totalPendingAmount)})
              </div>
              <p className="text-[11px] text-[#5F6C7B] max-w-[280px] mx-auto leading-relaxed">
                Por privacidade, os nomes dos participantes com pagamento pendente são visíveis apenas para o organizador do bolão.
              </p>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="caixa-card p-6 text-center text-xs text-[#5F6C7B]">
              Nenhum lançamento encontrado neste filtro.
            </div>
          ) : (
            <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
              {filteredPurchases
                .filter((pur) => {
                  if (isOrganizer) return true;
                  if (pur.paymentStatus === 'CONFIRMED') return true;
                  return (
                    pur.participantCpf.replace(/\D/g, '') === cleanUserCpf ||
                    pur.participantEmail.toLowerCase() ===
                      currentUser.email.toLowerCase() ||
                    pur.participantName.toLowerCase() ===
                      currentUser.name.toLowerCase()
                  );
                })
                .map((pur) => {
                  const isPaid = pur.paymentStatus === 'CONFIRMED';
                  const initials = getInitialsFromName(pur.participantName);

                  return (
                    <div
                      key={pur.id}
                      className="py-3 flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-[4px] font-display font-extrabold text-[11px] flex items-center justify-center shrink-0 ${
                            isPaid
                              ? 'bg-[#DCFCE7] text-[#008B47]'
                              : 'bg-[#FEF3C7] text-[#B45309]'
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#1E293B] truncate">
                            {pur.participantName}
                          </div>
                          <div className="text-[11px] text-[#5F6C7B] font-mono-tabular">
                            {pur.quotasCount} {pur.quotasCount === 1 ? 'cota' : 'cotas'} ·{' '}
                            <strong className="text-[#333E48]">
                              {formatCurrencyBRL(pur.totalAmount)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={() => onOpenCoupon(pur)}
                            className="h-8 px-2.5 rounded-[4px] bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Recibo</span>
                          </button>
                        ) : isOrganizer ? (
                          <button
                            type="button"
                            disabled={processingPayment}
                            onClick={() => handleConfirmPendingPayment(pur.id)}
                            className="h-8 px-2.5 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Aprovar</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D97706]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Seu Pix</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
