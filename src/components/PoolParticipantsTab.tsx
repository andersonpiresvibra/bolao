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
  maskCpfInput,
  maskPhoneInput,
  shareOrCopyPoolLink,
} from '../utils/inputMasks';
import {
  Users,
  CheckCircle2,
  Clock,
  Link2,
  FileText,
  Share2,
  UserPlus,
  X,
  Check,
  BarChart3,
} from 'lucide-react';

interface PoolParticipantsTabProps {
  currentUser: SystemUser;
  company: Company;
  pool: Pool;
  participants: Participant[];
  purchases: QuotaPurchase[];
  userRole: UserRole;
  onConciliatePixNow: (purchaseId: string) => Promise<QuotaPurchase>;
  onRegisterParticipant: (payload: any) => Promise<void>;
  onOpenCoupon: (purchase: QuotaPurchase) => void;
}

type ParticipantCategoryTab = 'CONFIRMED' | 'PENDING' | 'INVITED';

export const PoolParticipantsTab: React.FC<PoolParticipantsTabProps> = ({
  currentUser,
  company,
  pool,
  participants,
  purchases,
  userRole,
  onConciliatePixNow,
  onRegisterParticipant,
  onOpenCoupon,
}) => {
  const [activeCategory, setActiveCategory] =
    useState<ParticipantCategoryTab>('CONFIRMED');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [sharedFeedback, setSharedFeedback] = useState(false);

  // Modal para registrar convidado que recebeu o link
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteWhatsapp, setInviteWhatsapp] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('');
  const [inviteCpf, setInviteCpf] = useState('');
  const [submittingInvite, setSubmittingInvite] = useState(false);

  // 1. Filtrar compras deste bolão
  const poolPurchases = purchases.filter((p) => p.poolId === pool.id);
  const confirmedPurchases = poolPurchases.filter(
    (p) => p.paymentStatus === 'CONFIRMED'
  );
  const pendingPurchases = poolPurchases.filter(
    (p) => p.paymentStatus === 'PENDING'
  );

  // 2. Identificar quem recebeu o link mas ainda NÃO se comprometeu (não está em confirmed nem em pending)
  const committedCpfs = new Set(
    poolPurchases.map((p) => p.participantCpf.replace(/\D/g, ''))
  );
  const committedNames = new Set(
    poolPurchases.map((p) => p.participantName.trim().toLowerCase())
  );

  const invitedOnlyParticipants = participants.filter((part) => {
    const belongsToPool =
      part.poolId === pool.id || part.companyId === company.id;
    if (!belongsToPool) return false;
    const cleanCpf = part.cpf.replace(/\D/g, '');
    const cleanName = part.name.trim().toLowerCase();
    return !committedCpfs.has(cleanCpf) && !committedNames.has(cleanName);
  });

  // 3. Métricas para o Gráfico de Barras das 3 Categorias
  const countConfirmed = confirmedPurchases.length;
  const countPending = pendingPurchases.length;
  const countInvited = invitedOnlyParticipants.length;
  const totalPeople = Math.max(1, countConfirmed + countPending + countInvited);

  const pctConfirmed = Math.round((countConfirmed / totalPeople) * 100);
  const pctPending = Math.round((countPending / totalPeople) * 100);
  const pctInvited = Math.round((countInvited / totalPeople) * 100);

  const maxCategoryCount = Math.max(1, countConfirmed, countPending, countInvited);

  const totalConfirmedAmount = confirmedPurchases.reduce(
    (acc, p) => acc + p.totalAmount,
    0
  );
  const totalPendingAmount = pendingPurchases.reduce(
    (acc, p) => acc + p.totalAmount,
    0
  );

  const cleanUserCpf = currentUser.cpf.replace(/\D/g, '');
  const isOrganizer =
    userRole === 'MANAGER' ||
    userRole === 'SUPER_ADMIN' ||
    company.managerId === currentUser.id ||
    company.managerEmail.toLowerCase() === currentUser.email.toLowerCase() ||
    company.managerCpf.replace(/\D/g, '') === cleanUserCpf ||
    company.managerName.toLowerCase() === currentUser.name.toLowerCase();

  const handleConfirmPayment = async (purchaseId: string) => {
    setProcessingId(purchaseId);
    try {
      await onConciliatePixNow(purchaseId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleShareLink = async () => {
    await shareOrCopyPoolLink({
      companyId: company.id,
      poolId: pool.id,
      title: pool.title,
      companyName: company.name,
      useNativeShare: true,
    });
    setSharedFeedback(true);
    setTimeout(() => setSharedFeedback(false), 2500);
  };

  const handleAddInvitedPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim()) return;
    setSubmittingInvite(true);
    try {
      await onRegisterParticipant({
        companyId: company.id,
        poolId: pool.id,
        name: inviteName.trim(),
        cpf: inviteCpf.trim() || '000.000.000-00',
        email: `${inviteName.trim().split(' ')[0].toLowerCase()}@convidado.com.br`,
        whatsapp: inviteWhatsapp.trim() || '(11) 99999-0000',
        department: inviteDepartment.trim() || 'Convidado via Link',
        pixKey: inviteWhatsapp.trim() || inviteCpf.trim() || 'Chave pendente',
        registeredBy: isOrganizer ? 'MANAGER' : 'SELF',
      });
      setInviteName('');
      setInviteWhatsapp('');
      setInviteDepartment('');
      setInviteCpf('');
      setShowInviteModal(false);
      setActiveCategory('INVITED');
    } finally {
      setSubmittingInvite(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* ===================================================================== */}
      {/* 1. CABEÇALHO DO BOLÃO + AÇÕES DE CONVITE E COMPARTILHAMENTO           */}
      {/* ===================================================================== */}
      <div className="caixa-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-[#005CA9] uppercase block">
              Participantes do Bolão · {company.name}
            </span>
            <h1 className="font-display font-bold text-base text-[#1E293B] truncate mt-0.5">
              {pool.title}
            </h1>
            <p className="text-xs text-[#5F6C7B] mt-0.5">
              Acompanhe os efetivados, pendentes e quem recebeu o link
            </p>
          </div>
          <span className="px-2 py-1 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-mono-tabular font-bold text-xs shrink-0">
            {countConfirmed + countPending + countInvited} pessoas
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="h-9 px-3 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Convidado</span>
          </button>

          <button
            type="button"
            onClick={handleShareLink}
            className="h-9 px-3 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {sharedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartilhar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. DIV COM GRÁFICO DE BARRAS PARA CADA CATEGORIA                      */}
      {/* ===================================================================== */}
      <div className="caixa-card p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-[#005CA9]" />
            <h2 className="font-display font-bold text-sm text-[#1E293B]">
              Gráfico de Participantes por Categoria
            </h2>
          </div>
          <span className="text-[11px] text-[#5F6C7B] font-mono-tabular">
            Total: {countConfirmed + countPending + countInvited}
          </span>
        </div>

        {/* Gráfico de Colunas Verticais Comparativo + Barras de Progresso */}
        <div className="grid grid-cols-3 gap-2.5 pt-2 pb-1 px-2 bg-[#F7F9FC] rounded-[4px] border border-[#EDF2F7]">
          {/* Coluna 1: Efetivados */}
          <button
            type="button"
            onClick={() => setActiveCategory('CONFIRMED')}
            className="flex flex-col items-center text-center cursor-pointer group"
          >
            <span className="font-mono-tabular font-extrabold text-xs text-[#008B47]">
              {countConfirmed} ({pctConfirmed}%)
            </span>
            <div className="w-full h-20 flex items-end justify-center my-1.5 px-3">
              <div
                className="w-full bg-[#008B47] rounded-t-[4px] transition-all group-hover:opacity-90"
                style={{
                  height: `${Math.max(
                    14,
                    Math.round((countConfirmed / maxCategoryCount) * 100)
                  )}%`,
                }}
              />
            </div>
            <span className="text-[11px] font-bold text-[#1E293B]">
              Efetivados
            </span>
            <span className="text-[10px] text-[#008B47] font-mono-tabular font-semibold">
              {formatCurrencyBRL(totalConfirmedAmount)}
            </span>
          </button>

          {/* Coluna 2: Pendentes */}
          <button
            type="button"
            onClick={() => setActiveCategory('PENDING')}
            className="flex flex-col items-center text-center cursor-pointer group"
          >
            <span className="font-mono-tabular font-extrabold text-xs text-[#D97706]">
              {countPending} ({pctPending}%)
            </span>
            <div className="w-full h-20 flex items-end justify-center my-1.5 px-3">
              <div
                className="w-full bg-[#D97706] rounded-t-[4px] transition-all group-hover:opacity-90"
                style={{
                  height: `${Math.max(
                    14,
                    Math.round((countPending / maxCategoryCount) * 100)
                  )}%`,
                }}
              />
            </div>
            <span className="text-[11px] font-bold text-[#1E293B]">
              Pendentes
            </span>
            <span className="text-[10px] text-[#D97706] font-mono-tabular font-semibold">
              {formatCurrencyBRL(totalPendingAmount)}
            </span>
          </button>

          {/* Coluna 3: Receberam o Link */}
          <button
            type="button"
            onClick={() => setActiveCategory('INVITED')}
            className="flex flex-col items-center text-center cursor-pointer group"
          >
            <span className="font-mono-tabular font-extrabold text-xs text-[#005CA9]">
              {countInvited} ({pctInvited}%)
            </span>
            <div className="w-full h-20 flex items-end justify-center my-1.5 px-3">
              <div
                className="w-full bg-[#005CA9] rounded-t-[4px] transition-all group-hover:opacity-90"
                style={{
                  height: `${Math.max(
                    14,
                    Math.round((countInvited / maxCategoryCount) * 100)
                  )}%`,
                }}
              />
            </div>
            <span className="text-[11px] font-bold text-[#1E293B]">
              No Link
            </span>
            <span className="text-[10px] text-[#5F6C7B]">
              Sem compromisso
            </span>
          </button>
        </div>

        {/* Barras Horizontais Individuais por Categoria */}
        <div className="space-y-2.5 pt-1 text-xs">
          {/* Barra 1: Efetivados (Pagaram) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#008B47] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>1. Efetivados (Pagaram)</span>
              </span>
              <span className="font-mono-tabular font-bold text-[#1E293B]">
                {countConfirmed} pessoa(s) · {pctConfirmed}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#EDF2F7] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-[#008B47] transition-all"
                style={{ width: `${Math.max(4, pctConfirmed)}%` }}
              />
            </div>
          </div>

          {/* Barra 2: Pendentes (Aceitaram participar, pagamento pendente) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#D97706] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>2. Pendentes (Aceitaram participar)</span>
              </span>
              <span className="font-mono-tabular font-bold text-[#1E293B]">
                {countPending} pessoa(s) · {pctPending}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#EDF2F7] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-[#D97706] transition-all"
                style={{ width: `${Math.max(4, pctPending)}%` }}
              />
            </div>
          </div>

          {/* Barra 3: Receberam o Link (Ainda não se comprometeram) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#005CA9] flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" />
                <span>3. Receberam o Link (Sem compromisso)</span>
              </span>
              <span className="font-mono-tabular font-bold text-[#1E293B]">
                {countInvited} pessoa(s) · {pctInvited}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#EDF2F7] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-[#005CA9] transition-all"
                style={{ width: `${Math.max(4, pctInvited)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. ABAS E LISTAS POR CATEGORIA                                        */}
      {/* ===================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[#005CA9]" />
          <h2 className="font-display font-bold text-sm text-[#1E293B]">
            Lista por Categoria
          </h2>
        </div>

        {/* Uma aba para cada categoria */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#E6EEF6] rounded-[4px]">
          <button
            type="button"
            onClick={() => setActiveCategory('CONFIRMED')}
            className={`h-9 px-1.5 rounded-[3px] text-[11px] font-bold transition-colors cursor-pointer ${
              activeCategory === 'CONFIRMED'
                ? 'bg-white text-[#008B47] shadow-2xs'
                : 'text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            Efetivados ({countConfirmed})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('PENDING')}
            className={`h-9 px-1.5 rounded-[3px] text-[11px] font-bold transition-colors cursor-pointer ${
              activeCategory === 'PENDING'
                ? 'bg-white text-[#D97706] shadow-2xs'
                : 'text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            Pendentes ({countPending})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('INVITED')}
            className={`h-9 px-1.5 rounded-[3px] text-[11px] font-bold transition-colors cursor-pointer ${
              activeCategory === 'INVITED'
                ? 'bg-white text-[#005CA9] shadow-2xs'
                : 'text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            No Link ({countInvited})
          </button>
        </div>

        {/* CONTEÚDO DA ABA 1: EFETIVADOS (PAGARAM) */}
        {activeCategory === 'CONFIRMED' && (
          <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
            {confirmedPurchases.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5F6C7B]">
                Nenhum participante efetivado (pago) neste bolão até o momento.
              </div>
            ) : (
              confirmedPurchases.map((pur) => {
                const initials = getInitialsFromName(pur.participantName);
                return (
                  <div
                    key={pur.id}
                    className="py-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-[4px] bg-[#F0FDF4] text-[#008B47] border border-emerald-200 font-display font-extrabold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1E293B] truncate">
                          {pur.participantName}
                        </div>
                        <div className="text-[11px] text-[#5F6C7B] mt-0.5">
                          {pur.participantRole || 'Participante'} ·{' '}
                          {pur.quotasCount}{' '}
                          {pur.quotasCount === 1 ? 'cota' : 'cotas'} (
                          <strong className="font-mono-tabular text-[#333E48]">
                            {formatCurrencyBRL(pur.totalAmount)}
                          </strong>
                          )
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#008B47]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Efetivado</span>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => onOpenCoupon(pur)}
                          className="text-[11px] font-bold text-[#005CA9] hover:underline flex items-center justify-end gap-1 ml-auto cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Recibo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA 2: PENDENTES (ACEITARAM PARTICIPAR, PAGAMENTO PENDENTE) */}
        {activeCategory === 'PENDING' && (
          <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
            {pendingPurchases.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5F6C7B]">
                Nenhum participante com pagamento pendente no momento.
              </div>
            ) : (
              pendingPurchases.map((pur) => {
                const initials = getInitialsFromName(pur.participantName);
                return (
                  <div
                    key={pur.id}
                    className="py-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-[4px] bg-amber-50 text-amber-800 border border-amber-200 font-display font-extrabold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1E293B] truncate">
                          {pur.participantName}
                        </div>
                        <div className="text-[11px] text-[#5F6C7B] mt-0.5">
                          Aceitou participar · {pur.quotasCount}{' '}
                          {pur.quotasCount === 1 ? 'cota' : 'cotas'} (
                          <strong className="font-mono-tabular text-[#D97706]">
                            {formatCurrencyBRL(pur.totalAmount)}
                          </strong>
                          )
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pendente</span>
                      </div>
                      {isOrganizer && (
                        <div>
                          <button
                            type="button"
                            disabled={processingId === pur.id}
                            onClick={() => handleConfirmPayment(pur.id)}
                            className="px-2 py-0.5 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white text-[10px] font-bold cursor-pointer"
                          >
                            {processingId === pur.id
                              ? 'Confirmando...'
                              : 'Confirmar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA 3: RECEBERAM O LINK (SEM COMPROMISSO AINDA) */}
        {activeCategory === 'INVITED' && (
          <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
            {invitedOnlyParticipants.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5F6C7B] space-y-2">
                <p>
                  Todos os convidados que receberam o link já se comprometeram!
                </p>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="px-3 py-1.5 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-bold text-xs cursor-pointer"
                >
                  + Registrar novo convidado
                </button>
              </div>
            ) : (
              invitedOnlyParticipants.map((guest) => {
                const initials = getInitialsFromName(guest.name);
                return (
                  <div
                    key={guest.id}
                    className="py-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] border border-[#CBE2F6] font-display font-extrabold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1E293B] truncate">
                          {guest.name}
                        </div>
                        <div className="text-[11px] text-[#5F6C7B] mt-0.5 truncate">
                          {guest.department || 'Convidado'} · Recebeu o link
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#005CA9] bg-[#EBF4FC] px-2 py-0.5 rounded-[3px]">
                        <Link2 className="w-3 h-3" />
                        <span>Sem compromisso</span>
                      </span>
                      <div>
                        <button
                          type="button"
                          onClick={handleShareLink}
                          className="text-[11px] font-bold text-[#008B47] hover:underline flex items-center justify-end gap-1 ml-auto cursor-pointer"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Compartilhar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MODAL PARA REGISTRAR CONVIDADO QUE RECEBEU O LINK                     */}
      {/* ===================================================================== */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-[390px] caixa-card overflow-hidden my-auto">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/85">
                  Lista de Convidados
                </div>
                <h3 className="font-display font-bold text-sm">
                  Registrar Quem Recebeu o Link
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleAddInvitedPerson}
              className="p-4 space-y-3 text-xs bg-white"
            >
              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  Nome do convidado *
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Ex.: Carlos Eduardo Silva"
                  className="caixa-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={inviteWhatsapp}
                    onChange={(e) =>
                      setInviteWhatsapp(maskPhoneInput(e.target.value))
                    }
                    placeholder="(11) 99999-0000"
                    className="caixa-input font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    CPF (opcional)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={inviteCpf}
                    onChange={(e) => setInviteCpf(maskCpfInput(e.target.value))}
                    placeholder="000.000.000-00"
                    className="caixa-input font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  Setor / Grupo (opcional)
                </label>
                <input
                  type="text"
                  value={inviteDepartment}
                  onChange={(e) => setInviteDepartment(e.target.value)}
                  placeholder="Ex.: Comercial / Amigo Convidado"
                  className="caixa-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="h-10 rounded-[4px] bg-[#F7F9FC] border border-[#D5E0EC] text-[#333E48] font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingInvite}
                  className="h-10 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs cursor-pointer"
                >
                  {submittingInvite ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
