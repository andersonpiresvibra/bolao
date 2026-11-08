import React, { useState } from 'react';
import {
  Company,
  Pool,
  Participant,
  QuotaPurchase,
  UserRole,
  SystemUser,
} from '../types';
import { getInitialsFromName } from '../utils/historicalDraws';
import {
  maskCpfInput,
  maskPhoneInput,
  shareOrCopyPoolLink,
} from '../utils/inputMasks';
import {
  CheckCircle2,
  Clock,
  Link2,
  Share2,
  UserPlus,
  X,
  Check,
  Lock,
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
  onRegisterParticipant,
}) => {
  const [activeCategory, setActiveCategory] =
    useState<ParticipantCategoryTab>('CONFIRMED');
  const [sharedFeedback, setSharedFeedback] = useState(false);

  // Modal para registrar convidado que recebeu o link
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteWhatsapp, setInviteWhatsapp] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('');
  const [inviteCpf, setInviteCpf] = useState('');
  const [submittingInvite, setSubmittingInvite] = useState(false);

  // 1. Filtrar participantes deste bolão (sem expor valores financeiros nesta aba)
  const poolPurchases = purchases.filter((p) => p.poolId === pool.id);
  const confirmedPurchases = poolPurchases.filter(
    (p) => p.paymentStatus === 'CONFIRMED'
  );
  const pendingPurchases = poolPurchases.filter(
    (p) => p.paymentStatus === 'PENDING'
  );

  // 2. Identificar quem recebeu o link mas ainda NÃO se comprometeu
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

  // 3. Quantidades e Percentuais (Sem valores em R$)
  const countConfirmed = confirmedPurchases.length;
  const countPending = pendingPurchases.length;
  const countInvited = invitedOnlyParticipants.length;
  const totalPeople = Math.max(1, countConfirmed + countPending + countInvited);

  const pctConfirmed = Math.round((countConfirmed / totalPeople) * 100);
  const pctPending = Math.round((countPending / totalPeople) * 100);
  const pctInvited = Math.round((countInvited / totalPeople) * 100);

  const totalConfirmedQuotas = confirmedPurchases.reduce(
    (acc, p) => acc + p.quotasCount,
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

  const isMyRecord = (cpf?: string, email?: string, name?: string) => {
    if (cpf && cpf.replace(/\D/g, '') === cleanUserCpf) return true;
    if (email && email.toLowerCase() === currentUser.email.toLowerCase()) return true;
    if (name && name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      return true;
    return false;
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
        department: inviteDepartment.trim() || 'Convidado',
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
    <div className="px-4 py-4 space-y-3.5">
      {/* 1. CABEÇALHO COMPACTO + NAVEGAÇÃO EM 3 ABAS (EFETIVADOS | PENDENTES | NO LINK) */}
      <div className="caixa-card overflow-hidden">
        <div className="p-4 pb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-[#005CA9] uppercase tracking-wide block truncate">
              {company.name} · Participantes
            </span>
            <h1 className="font-display font-bold text-sm text-[#1E293B] truncate mt-0.5">
              {pool.title}
            </h1>
          </div>
          <span className="px-2 py-0.5 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-mono-tabular font-bold text-[11px] shrink-0">
            {countConfirmed + countPending + countInvited} pessoas
          </span>
        </div>

        {/* Botões Rápidos de Convite */}
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="h-9 px-3 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Convidado</span>
          </button>

          <button
            type="button"
            onClick={handleShareLink}
            className="h-9 px-3 rounded-[4px] bg-[#008B47] hover:bg-[#00743B] text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {sharedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Convite</span>
              </>
            )}
          </button>
        </div>

        {/* Abas das 3 Categorias */}
        <div className="grid grid-cols-3 border-t border-[#E2E8F0] bg-[#F7F9FC]">
          <button
            type="button"
            onClick={() => setActiveCategory('CONFIRMED')}
            className={`h-10 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-colors cursor-pointer ${
              activeCategory === 'CONFIRMED'
                ? 'border-[#008B47] text-[#008B47] bg-white'
                : 'border-transparent text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Efetivados ({countConfirmed})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('PENDING')}
            className={`h-10 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-colors cursor-pointer ${
              activeCategory === 'PENDING'
                ? 'border-[#D97706] text-[#D97706] bg-white'
                : 'border-transparent text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pendentes ({countPending})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('INVITED')}
            className={`h-10 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-colors cursor-pointer ${
              activeCategory === 'INVITED'
                ? 'border-[#005CA9] text-[#005CA9] bg-white'
                : 'border-transparent text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>No Link ({countInvited})</span>
          </button>
        </div>
      </div>

      {/* 2. PANORAMA DE ADESÃO POR CATEGORIA (APENAS QUANTIDADES E %, SEM VALORES R$) */}
      <div className="caixa-card p-4 space-y-2.5 text-xs">
        <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-2">
          <span className="font-bold text-[#1E293B]">
            Panorama de Adesão
          </span>
          <span className="font-mono-tabular font-bold text-[#008B47]">
            {totalConfirmedQuotas} cotas confirmadas
          </span>
        </div>

        <div className="space-y-2 pt-0.5">
          {/* Barra 1: Efetivados */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#008B47]">Efetivados</span>
              <span className="font-mono-tabular font-bold text-[#1E293B]">
                {countConfirmed} ({pctConfirmed}%)
              </span>
            </div>
            <div className="w-full h-2 bg-[#EDF2F7] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-[#008B47] transition-all"
                style={{ width: `${Math.max(4, pctConfirmed)}%` }}
              />
            </div>
          </div>

          {/* Barra 2: Pendentes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#D97706]">
                Pendentes (Comprometidos)
              </span>
              <span className="font-mono-tabular font-bold text-[#1E293B]">
                {countPending} ({pctPending}%)
              </span>
            </div>
            <div className="w-full h-2 bg-[#EDF2F7] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-[#D97706] transition-all"
                style={{ width: `${Math.max(4, pctPending)}%` }}
              />
            </div>
          </div>

          {/* Barra 3: Receberam o Link */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#005CA9]">
                Receberam o Link
              </span>
              <span className="font-mono-tabular font-bold text-[#1E293B]">
                {countInvited} ({pctInvited}%)
              </span>
            </div>
            <div className="w-full h-2 bg-[#EDF2F7] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-[#005CA9] transition-all"
                style={{ width: `${Math.max(4, pctInvited)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. LISTA DA CATEGORIA SELECIONADA (SEM VALORES FINANCEIROS E COM PRIVACIDADE PARA INADIMPLENTES) */}
      {activeCategory === 'CONFIRMED' && (
        <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
          {confirmedPurchases.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#5F6C7B]">
              Nenhum participante efetivado até o momento.
            </div>
          ) : (
            confirmedPurchases.map((pur) => {
              const initials = getInitialsFromName(pur.participantName);
              return (
                <div
                  key={pur.id}
                  className="py-3 flex items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-[4px] bg-[#DCFCE7] text-[#008B47] font-display font-extrabold text-[11px] flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#1E293B] truncate">
                        {pur.participantName}
                      </div>
                      <div className="text-[11px] text-[#5F6C7B] truncate">
                        {pur.participantRole || 'Participante'} ·{' '}
                        <strong className="font-mono-tabular text-[#333E48]">
                          {pur.quotasCount} {pur.quotasCount === 1 ? 'cota' : 'cotas'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#008B47] shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Efetivado</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ABA PENDENTES: NOMES VISÍVEIS APENAS PARA O ADMIN/ORGANIZADOR */}
      {activeCategory === 'PENDING' && (
        <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
          {pendingPurchases.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#5F6C7B]">
              Nenhum participante pendente no momento.
            </div>
          ) : isOrganizer ? (
            pendingPurchases.map((pur) => {
              const initials = getInitialsFromName(pur.participantName);
              return (
                <div
                  key={pur.id}
                  className="py-3 flex items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-[4px] bg-[#FEF3C7] text-[#B45309] font-display font-extrabold text-[11px] flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#1E293B] truncate">
                        {pur.participantName}
                      </div>
                      <div className="text-[11px] text-[#5F6C7B] truncate">
                        {pur.participantRole || 'Participante'} ·{' '}
                        <strong className="font-mono-tabular text-[#D97706]">
                          {pur.quotasCount} {pur.quotasCount === 1 ? 'cota' : 'cotas'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D97706] shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pendente</span>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-5 space-y-2 text-center text-xs">
              <div className="w-9 h-9 rounded-full bg-[#FEF3C7] text-[#B45309] flex items-center justify-center mx-auto">
                <Lock className="w-4 h-4" />
              </div>
              <div className="font-bold text-[#1E293B]">
                {countPending}{' '}
                {countPending === 1
                  ? 'participante compromissado'
                  : 'participantes compromissados'}{' '}
                ({pctPending}%)
              </div>
              <p className="text-[11px] text-[#5F6C7B] max-w-[280px] mx-auto leading-relaxed">
                Por privacidade, a identificação nominal de quem ainda está com confirmação pendente é visível apenas para o organizador do bolão.
              </p>
              {pendingPurchases
                .filter((p) =>
                  isMyRecord(p.participantCpf, p.participantEmail, p.participantName)
                )
                .map((myPur) => (
                  <div
                    key={myPur.id}
                    className="mt-2 pt-2 border-t border-[#EDF2F7] flex items-center justify-between text-left"
                  >
                    <span className="font-bold text-[#1E293B]">
                      Você ({myPur.quotasCount} {myPur.quotasCount === 1 ? 'cota' : 'cotas'})
                    </span>
                    <span className="text-[11px] font-bold text-[#D97706]">
                      Sua confirmação está pendente
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ABA NO LINK: NOMES VISÍVEIS APENAS PARA O ADMIN/ORGANIZADOR */}
      {activeCategory === 'INVITED' && (
        <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
          {invitedOnlyParticipants.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#5F6C7B] space-y-2">
              <p>Todos os convidados que receberam o link já se comprometeram.</p>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="px-3 py-1.5 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-bold text-xs cursor-pointer"
              >
                + Convidado
              </button>
            </div>
          ) : isOrganizer ? (
            invitedOnlyParticipants.map((guest) => {
              const initials = getInitialsFromName(guest.name);
              return (
                <div
                  key={guest.id}
                  className="py-3 flex items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-[4px] bg-[#EBF4FC] text-[#005CA9] font-display font-extrabold text-[11px] flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#1E293B] truncate">
                        {guest.name}
                      </div>
                      <div className="text-[11px] text-[#5F6C7B] truncate">
                        {guest.department || 'Convidado'} · Recebeu o link
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleShareLink}
                    className="h-8 px-2.5 rounded-[4px] bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Convite</span>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="py-5 space-y-2 text-center text-xs">
              <div className="w-9 h-9 rounded-full bg-[#EBF4FC] text-[#005CA9] flex items-center justify-center mx-auto">
                <Lock className="w-4 h-4" />
              </div>
              <div className="font-bold text-[#1E293B]">
                {countInvited}{' '}
                {countInvited === 1
                  ? 'pessoa recebeu o link'
                  : 'pessoas receberam o link'}{' '}
                ({pctInvited}%)
              </div>
              <p className="text-[11px] text-[#5F6C7B] max-w-[280px] mx-auto leading-relaxed">
                A lista nominal de convidados que ainda não aderiram ao bolão é visível apenas para o organizador.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA REGISTRAR CONVIDADO QUE RECEBEU O LINK */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-[390px] caixa-card overflow-hidden my-auto">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-white/85">
                  Participantes
                </div>
                <h3 className="font-display font-bold text-sm">
                  Novo Convidado
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
                  Nome *
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
                  placeholder="Ex.: Comercial"
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
