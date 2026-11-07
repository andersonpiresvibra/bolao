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
  X,
  Plus,
  Users,
  Wallet,
  CheckCircle2,
  Clock,
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
  purchases,
  userRole,
  onCreatePixPurchase,
  onConciliatePixNow,
  onOpenCoupon,
}) => {
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING'>('ALL');
  const [showBuyModal, setShowBuyModal] = useState(false);
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
        setShowBuyModal(false);
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
    <div className="px-4 py-4 space-y-4">
      {/* ===================================================================== */}
      {/* 1. PAINEL CLARO DO BOLÃO: COTA, TETO, ARRECADADO E TITULAR DA CONTA   */}
      {/* ===================================================================== */}
      <div className="caixa-card p-4 space-y-4">
        <div>
          <span className="text-[10px] font-bold text-[#005CA9] uppercase block">
            Grupo de Bolão · {company.name}
          </span>
          <h1 className="font-display font-bold text-base text-[#1E293B] mt-0.5">
            {pool.title}
          </h1>
        </div>

        {/* 3 Blocos Visuais Diretos: Valor da Cota | Arrecadado | Teto */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#EDF2F7]">
            <span className="text-[10px] text-[#5F6C7B] block">Valor da Cota</span>
            <span className="font-mono-tabular font-extrabold text-sm text-[#1E293B] mt-0.5 block">
              {formatCurrencyBRL(pool.quotaValue)}
            </span>
          </div>

          <div className="p-2.5 rounded-[4px] bg-[#F0FDF4] border border-emerald-200">
            <span className="text-[10px] text-[#008B47] font-semibold block">
              Arrecadado
            </span>
            <span className="font-mono-tabular font-extrabold text-sm text-[#008B47] mt-0.5 block">
              {formatCurrencyBRL(totalConfirmedAmount)}
            </span>
          </div>

          <div className="p-2.5 rounded-[4px] bg-[#F7F9FC] border border-[#EDF2F7]">
            <span className="text-[10px] text-[#5F6C7B] block">
              Teto do Bolão
            </span>
            <span className="font-mono-tabular font-bold text-xs text-[#333E48] mt-1 block">
              {hasTargetCeiling ? formatCurrencyBRL(pool.maxTargetAmount) : 'Sem limite'}
            </span>
          </div>
        </div>

        {/* Barra de Progresso Simples (se houver teto) */}
        {hasTargetCeiling && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#5F6C7B]">
                Progresso da meta ({totalQuotasSold} cotas pagas)
              </span>
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

        {/* Titular da Conta de Pagamento (Claro e Transparente para Todos) */}
        <div className="p-3 rounded-[4px] bg-[#F7F9FC] border border-[#E2E8F0] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[#5F6C7B] block">
                  Titular da Conta de Pagamento
                </span>
                <strong className="text-xs text-[#1E293B] block truncate">
                  {company.managerName}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyHolderPix}
              className="h-8 px-2.5 rounded-[4px] bg-white hover:bg-[#EBF4FC] border border-[#D5E0EC] text-[#005CA9] font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copiedHolderPix ? (
                <Check className="w-3.5 h-3.5 text-[#008B47]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedHolderPix ? 'Pix Copiado' : 'Copiar Pix'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#5F6C7B] pt-1 border-t border-[#E2E8F0]">
            <span>Chave Pix do Bolão:</span>
            <span className="font-mono-tabular font-bold text-[#333E48]">
              {holderPixKey}
            </span>
          </div>
        </div>

        {/* Botão Principal: Participar / Comprar Cota */}
        <button
          type="button"
          onClick={() => {
            setActivePixPurchase(null);
            setShowBuyModal(true);
          }}
          className="w-full h-11 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Comprar / Pagar Minha Cota ({formatCurrencyBRL(pool.quotaValue)})</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 2. LISTA PÚBLICA DE PAGANTES (PARTICIPANTES PAGOS E PENDENTES)        */}
      {/* ===================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#005CA9]" />
            <h2 className="font-display font-bold text-sm text-[#1E293B]">
              Participantes do Bolão ({poolPurchases.length})
            </h2>
          </div>

          {totalPendingAmount > 0 && (
            <span className="text-[11px] text-amber-800 font-semibold">
              Pendente: {formatCurrencyBRL(totalPendingAmount)}
            </span>
          )}
        </div>

        {/* Abas Simples: Todos | Pagos | Pendentes */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#E6EEF6] rounded-[4px]">
          <button
            type="button"
            onClick={() => setPaymentFilter('ALL')}
            className={`h-8 rounded-[3px] text-xs font-bold transition-colors cursor-pointer ${
              paymentFilter === 'ALL'
                ? 'bg-white text-[#005CA9] shadow-2xs'
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
                ? 'bg-white text-[#008B47] shadow-2xs'
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
                ? 'bg-white text-amber-800 shadow-2xs'
                : 'text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            Pendentes ({pendingPurchases.length})
          </button>
        </div>

        {/* Lista Limpa e Clara de Pagantes */}
        {filteredPurchases.length === 0 ? (
          <div className="caixa-card p-6 text-center text-xs text-[#5F6C7B]">
            Nenhum participante encontrado neste filtro.
          </div>
        ) : (
          <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
            {filteredPurchases.map((pur) => {
              const isPaid = pur.paymentStatus === 'CONFIRMED';
              const initials = getInitialsFromName(pur.participantName);

              return (
                <div
                  key={pur.id}
                  className="py-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  {/* Avatar + Nome + Quantidade de Cotas */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-[4px] font-display font-extrabold text-xs flex items-center justify-center shrink-0 ${
                        isPaid
                          ? 'bg-[#F0FDF4] text-[#008B47] border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#1E293B] truncate">
                        {pur.participantName}
                      </div>
                      <div className="text-[11px] text-[#5F6C7B] mt-0.5">
                        {pur.quotasCount}{' '}
                        {pur.quotasCount === 1 ? 'cota' : 'cotas'} ·{' '}
                        <strong className="font-mono-tabular text-[#333E48]">
                          {formatCurrencyBRL(pur.totalAmount)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Status Pago / Pendente + Ação Simples */}
                  <div className="text-right shrink-0 space-y-1">
                    {isPaid ? (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#008B47]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Pago</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pendente</span>
                      </div>
                    )}

                    <div>
                      {isPaid ? (
                        <button
                          type="button"
                          onClick={() => onOpenCoupon(pur)}
                          className="text-[11px] font-bold text-[#005CA9] hover:underline flex items-center justify-end gap-1 ml-auto cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Recibo</span>
                        </button>
                      ) : isOrganizer ? (
                        <button
                          type="button"
                          disabled={processingPayment}
                          onClick={() => handleConfirmPendingPayment(pur.id)}
                          className="px-2 py-0.5 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white text-[10px] font-bold cursor-pointer"
                        >
                          Confirmar
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MODAL SIMPLES PARA COMPRAR / PAGAR MINHA COTA                         */}
      {/* ===================================================================== */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-[390px] caixa-card overflow-hidden my-auto">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/85">
                  Participar do Bolão
                </div>
                <h3 className="font-display font-bold text-sm">
                  Pagar Minha Cota
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBuyModal(false)}
                className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs bg-white">
              <div className="p-3 rounded-[4px] bg-[#F7F9FC] border border-[#EDF2F7] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#5F6C7B]">Apostador</span>
                  <strong className="text-[#1E293B]">{currentUser.name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5F6C7B]">Titular recebedor</span>
                  <strong className="text-[#1E293B]">{company.managerName}</strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#333E48] mb-1.5">
                  Quantas cotas você deseja adquirir?
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 5, 10].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setQuotasCount(qty)}
                      className={`h-10 font-mono-tabular font-bold text-xs rounded-[4px] transition-colors cursor-pointer ${
                        quotasCount === qty
                          ? 'bg-[#005CA9] text-white'
                          : 'bg-[#F7F9FC] text-[#333E48] border border-[#D5E0EC] hover:bg-[#EBF4FC]'
                      }`}
                    >
                      {qty} {qty === 1 ? 'cota' : 'cotas'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-[4px] bg-[#F0FDF4] border border-emerald-200 flex items-center justify-between">
                <span className="font-bold text-[#1E293B]">
                  Total a pagar ({quotasCount}{' '}
                  {quotasCount === 1 ? 'cota' : 'cotas'})
                </span>
                <span className="font-mono-tabular font-extrabold text-base text-[#008B47]">
                  {formatCurrencyBRL(quotasCount * pool.quotaValue)}
                </span>
              </div>

              {activePixPurchase ? (
                <div className="space-y-2.5 pt-1 border-t border-[#EDF2F7]">
                  <span className="block font-bold text-[#005CA9]">
                    Código Pix Copia e Cola gerado:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={activePixPurchase.pixQrCodePayload}
                      className="caixa-input font-mono-tabular text-[11px] flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          activePixPurchase.pixQrCodePayload
                        );
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
                    onClick={() => setShowBuyModal(false)}
                    className="w-full h-10 bg-[#005CA9] text-white font-bold text-xs rounded-[4px] cursor-pointer"
                  >
                    Concluir (Já está na lista como Pendente)
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
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
                    <span>Pagar Agora</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
