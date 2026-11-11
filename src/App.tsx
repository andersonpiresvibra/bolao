import React, { useEffect, useState } from 'react';
import {
  DatabaseState,
  UserRole,
  QuotaPurchase,
  SystemUser,
  LotteryType,
  LotteryGame,
  Company,
  Pool,
} from './types';
import { INITIAL_DATABASE_STATE } from './seedData';
import {
  apiFetch,
  loadBrowserCachedState,
} from './utils/cloudflareApi';
import { ParticipantLoginForm } from './components/ParticipantLoginForm';
import { MobileHeader, BrandThemeId } from './components/MobileHeader';
import { CompaniesTab } from './components/CompaniesTab';
import { PoolParticipantsTab } from './components/PoolParticipantsTab';
import { PoolActionTab } from './components/PoolActionTab';
import { GamesAuditTab } from './components/GamesAuditTab';
import { PoolPrintTab } from './components/PoolPrintTab';
import { PoolStatsTab } from './components/PoolStatsTab';
import { AdminDashboardTab } from './components/AdminDashboardTab';
import { UserAreaTab, ModalTopic } from './components/UserAreaTab';
import { DigitalCouponModal } from './components/DigitalCouponModal';
import {
  Ticket,
  Grid,
  BarChart2,
  ArrowLeft,
  Home,
  Users,
  UserCheck,
} from 'lucide-react';

type ActiveTab =
  | 'COMPANIES'
  | 'PARTICIPANTS'
  | 'POOL'
  | 'GAMES'
  | 'PRINT'
  | 'STATS'
  | 'ADMIN';

const SESSION_USER_KEY = 'lotocorp_logged_user_vibra_v4';
const PENDING_INVITE_KEY = 'lotocorp_pending_invite_company';

export default function App() {
  const [dbState, setDbState] = useState<DatabaseState>(() =>
    loadBrowserCachedState() || INITIAL_DATABASE_STATE
  );
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_USER_KEY);
      if (saved) return JSON.parse(saved) as SystemUser;
    } catch {
      // ignore
    }
    return INITIAL_DATABASE_STATE.users?.[0] || null;
  });
  const [invitedCompanyId, setInvitedCompanyId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('bolao');
      if (fromUrl) {
        sessionStorage.setItem(PENDING_INVITE_KEY, fromUrl);
        return fromUrl;
      }
      return sessionStorage.getItem(PENDING_INVITE_KEY);
    } catch {
      return null;
    }
  });
  const [directOpenCompanyId, setDirectOpenCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('COMPANIES');
  const [userModalTopic, setUserModalTopic] = useState<ModalTopic>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('comp_a');
  const [userRole, setUserRole] = useState<UserRole>('COLLABORATOR');
  const [selectedCouponPurchase, setSelectedCouponPurchase] =
    useState<QuotaPurchase | null>(null);
  const [personalPrintPayload, setPersonalPrintPayload] = useState<{
    lotteryType: LotteryType;
    games: LotteryGame[];
    title: string;
  } | null>(null);
  const [promoterCreatePreset, setPromoterCreatePreset] = useState<{
    lotteryType: LotteryType;
    contestMode: 'REGULAR' | 'SPECIAL';
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [brandTheme, setBrandTheme] = useState<BrandThemeId>('GRAFITE_PRATA');

  useEffect(() => {
    document.documentElement.setAttribute('data-brand-theme', brandTheme);
    try {
      localStorage.setItem('appbolao_brand_theme', brandTheme);
    } catch {
      // ignore
    }
  }, [brandTheme]);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    apiFetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.companies)) {
          setDbState(data);
        }
      })
      .catch((err) => {
        console.warn('Using local fallback seed state:', err);
      });
  }, []);

  // Route directly to the invited bolão when logged in and an invite link is present
  useEffect(() => {
    if (!currentUser || !invitedCompanyId) return;
    const matchedCompany = dbState.companies.find((c) => c.id === invitedCompanyId);
    if (matchedCompany) {
      setSelectedCompanyId(matchedCompany.id);
      setDirectOpenCompanyId(matchedCompany.id);
      setActiveTab('POOL');
      setInvitedCompanyId(null);
      try {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
      } catch {
        // ignore
      }
      showToast(`Você entrou diretamente no bolão "${matchedCompany.name}" pelo link de convite!`);
    }
  }, [currentUser, invitedCompanyId, dbState.companies]);

  const handleLoginPasswordApi = async (payload: {
    identifier: string;
    password: string;
  }): Promise<SystemUser> => {
    const resp = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Falha ao entrar.');
    }
    if (data.state) {
      setDbState(data.state);
    }
    return data.user as SystemUser;
  };

  const handleRegisterLoginApi = async (payload: {
    name: string;
    username?: string;
    whatsapp: string;
    cpf: string;
    email: string;
    password: string;
    companyName: string;
    companyId?: string;
    jobTitle: string;
    pixKey: string;
  }): Promise<SystemUser> => {
    const resp = await apiFetch('/api/auth/register-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Erro ao realizar cadastro.');
    }
    if (data.state) {
      setDbState(data.state);
    }
    return data.user as SystemUser;
  };

  const handleRecoverPasswordApi = async (payload: {
    identifier: string;
    newPassword: string;
  }): Promise<{ ok: boolean; message: string }> => {
    const resp = await apiFetch('/api/auth/recover-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Erro ao recuperar senha.');
    }
    return { ok: true, message: data.message };
  };

  const handleLoginSuccess = (user: SystemUser) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
    if (invitedCompanyId) {
      setSelectedCompanyId(invitedCompanyId);
      setDirectOpenCompanyId(invitedCompanyId);
      setActiveTab('POOL');
      setInvitedCompanyId(null);
      try {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
      } catch {
        // ignore
      }
      const invComp = dbState.companies.find((c) => c.id === invitedCompanyId);
      showToast(
        `Bem-vindo(a), ${user.name}! Direcionado ao bolão "${invComp?.name || 'Convidado'}".`
      );
      return;
    }
    if (user.companyId) {
      setSelectedCompanyId(user.companyId);
    }
    showToast(`Bem-vindo(a), ${user.name}! Ambiente do seu Grupo de Bolão carregado.`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem(SESSION_USER_KEY);
    } catch {
      // ignore
    }
  };

  if (!currentUser) {
    return (
      <ParticipantLoginForm
        companies={dbState.companies}
        existingUsers={dbState.users || []}
        invitedCompanyId={invitedCompanyId}
        onLoginSuccess={handleLoginSuccess}
        onLoginPasswordApi={handleLoginPasswordApi}
        onRegisterLoginApi={handleRegisterLoginApi}
        onRecoverPasswordApi={handleRecoverPasswordApi}
      />
    );
  }

  const selectedCompany =
    dbState.companies.find((c) => c.id === selectedCompanyId) ||
    dbState.companies[0];

  const selectedPool =
    dbState.pools.find((p) => p.companyId === selectedCompany.id) ||
    dbState.pools[0];

  const isInsideBolaoSection =
    activeTab === 'PARTICIPANTS' ||
    activeTab === 'POOL' ||
    activeTab === 'GAMES' ||
    activeTab === 'PRINT' ||
    activeTab === 'STATS';

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setActiveTab('POOL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateCompany = async (
    payload: any
  ): Promise<{ ok: boolean; error?: string }> => {
    const resp = await apiFetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data.error || 'Erro ao criar Grupo de Bolão.' };
    }
    setDbState(data.state);
    setSelectedCompanyId(data.company.id);
    setActiveTab('COMPANIES');
    showToast(`Grupo de Bolão "${data.company.name}" criado com sucesso!`);
    return { ok: true };
  };

  const handleCreatePixPurchase = async (payload: any): Promise<QuotaPurchase> => {
    const resp = await apiFetch('/api/payments/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (data.state) {
      setDbState(data.state);
    }
    showToast(
      payload.autoConfirmNow
        ? 'Pix conciliado com Split automático! Cupom digital gerado.'
        : 'Cobrança Pix gerada com Split configurado.'
    );
    return data.purchase;
  };

  const handleConciliatePixNow = async (purchaseId: string): Promise<QuotaPurchase> => {
    const resp = await apiFetch('/api/webhooks/asaas-conciliate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseId }),
    });
    const data = await resp.json();
    if (data.state) {
      setDbState(data.state);
    }
    showToast('Pagamento Pix conciliado! Repasse enviado ao titular e taxa retida.');
    return data.purchase;
  };

  const handleRegisterParticipant = async (payload: any) => {
    const resp = await apiFetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast(`Participante "${data.participant.name}" cadastrado no Grupo de Bolão!`);
    }
  };

  const handleUpdatePoolConfig = async (poolId: string, payload: any) => {
    const resp = await apiFetch(`/api/pools/${poolId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast('Regras do Grupo de Bolão atualizadas!');
    }
  };

  const handleAddGames = async (gamesList: any[]) => {
    const resp = await apiFetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolId: selectedPool.id,
        companyId: selectedCompany.id,
        lotteryType: selectedPool.lotteryType,
        games: gamesList,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatarInitials,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast(`${gamesList.length} volante(s) aprovado(s) e travado(s) com sucesso!`);
    }
  };

  const handleCreateSuggestion = async (payload: {
    numbers: number[];
    rationale: string;
  }) => {
    const resp = await apiFetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: selectedCompany.id,
        poolId: selectedPool.id,
        lotteryType: selectedPool.lotteryType,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatarInitials,
        userJobTitle: currentUser.jobTitle,
        numbers: payload.numbers,
        rationale: payload.rationale,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast(
        `Jogo de ${payload.numbers.length} dezenas divulgado em Volantes!`
      );
    }
  };

  const handleSuggestionAction = async (
    suggestionId: string,
    action: 'VOTE' | 'APPROVE_GAME' | 'EDIT_NUMBERS',
    cost?: number,
    equivalentSimpleBets?: number,
    numbers?: number[],
    rationale?: string
  ) => {
    const resp = await apiFetch(`/api/suggestions/${suggestionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        cost,
        equivalentSimpleBets,
        numbers,
        rationale,
        actorId: currentUser.id,
        actorName: currentUser.name,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      if (action === 'VOTE') {
        showToast('Curtida registrada no jogo do participante!');
      } else if (action === 'EDIT_NUMBERS') {
        showToast('Dezenas do seu jogo atualizadas com sucesso!');
      } else {
        showToast('Jogo aprovado como volante oficial! Dezenas travadas.');
      }
    } else {
      const errData = await resp.json().catch(() => ({}));
      if (errData.error) showToast(errData.error);
    }
  };

  const handleUpdateDrawnNumbers = async (
    poolId: string,
    drawnNumbers: number[],
    prizeTotalAmount: number
  ) => {
    await handleUpdatePoolConfig(poolId, { drawnNumbers, prizeTotalAmount });
    showToast('Simulação do sorteio atualizada nas Estatísticas!');
  };

  const handleUpdateSettings = async (payload: any) => {
    const resp = await apiFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast(
        `Taxa administrativa global (${data.settings.defaultPlatformFeePercent}%) salva no Split Asaas!`
      );
    }
  };

  const handleUpdateUser = async (updatedFields: Partial<SystemUser>) => {
    if (!currentUser) return;
    const optimisticUser: SystemUser = {
      ...currentUser,
      ...updatedFields,
    };
    setCurrentUser(optimisticUser);
    try {
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(optimisticUser));
    } catch {
      // ignore
    }

    try {
      const resp = await apiFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.user) {
          setCurrentUser(data.user);
          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(data.user));
        }
        if (data.state) {
          setDbState(data.state);
        }
      }
    } catch {
      // keep optimistic update
    }
    showToast('Preferências do Meu Espaço atualizadas com sucesso!');
  };

  return (
    <div
      data-brand-theme={brandTheme}
      style={{ backgroundColor: 'var(--brand-outer-bg)' }}
      className="min-h-screen w-full flex justify-center transition-colors"
    >
      {/* Strict Mobile Viewport Shell (430px max width) */}
      <div
        style={{ backgroundColor: 'var(--brand-canvas)' }}
        className="w-full max-w-[430px] min-h-screen flex flex-col relative pb-16 shadow-lg transition-colors"
      >
        <MobileHeader
          currentUser={currentUser}
          userRole={userRole}
          onLogout={handleLogout}
          brandTheme={brandTheme}
          onChangeBrandTheme={setBrandTheme}
          onOpenUserSection={(topic) => {
            setActiveTab('COMPANIES');
            setUserModalTopic(topic);
          }}
          onChangeRole={(role) => {
            setUserRole(role);
            setUserModalTopic(null);
            if (role === 'SUPER_ADMIN') {
              setActiveTab('ADMIN');
              showToast('Configuração de Split da plataforma.');
            } else {
              setActiveTab('COMPANIES');
            }
          }}
          selectedCompanyName={selectedCompany?.name}
        />

        {statusMessage && (
          <div className="mx-4 mt-2 bg-[#EBF4FC] border border-[#CBE2F6] text-[#005CA9] px-3.5 py-2.5 rounded-[4px] text-xs font-semibold flex items-center justify-between shadow-xs">
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[11px] font-bold text-[#005CA9] underline ml-2"
            >
              OK
            </button>
          </div>
        )}

        <main className="flex-1">
          {/* 0. IMPRESSÃO PESSOAL DE JOGOS VIRTUAIS (FORA DO BOLÃO) */}
          {personalPrintPayload ? (
            <PoolPrintTab
              company={
                {
                  id: 'personal_comp',
                  name: currentUser.name,
                  cnpj: '00.000.000/0001-00',
                  segment: 'Jogos Pessoais',
                  logoInitials: currentUser.avatarInitials || 'US',
                  logoColor: '#005CA9',
                  managerName: currentUser.name,
                  managerPixKey: currentUser.pixKey || currentUser.cpf,
                  managerCpf: currentUser.cpf,
                  managerEmail: currentUser.email,
                  managerWhatsapp: currentUser.whatsapp,
                  asaasWalletId: 'wal_personal',
                  cityState: 'Brasil',
                  createdAt: new Date().toISOString(),
                } as Company
              }
              pool={
                {
                  id: 'personal_pool',
                  companyId: 'personal_comp',
                  title: personalPrintPayload.title,
                  lotteryType: personalPrintPayload.lotteryType,
                  contestNumber: 'Atual',
                  collectionMode: 'FIXED_QUOTA',
                  quotaValue: 0,
                  maxTargetAmount: 0,
                  maxQuotas: 1,
                  platformFeePercent: 0,
                  startDate: new Date().toISOString().slice(0, 10),
                  endDate: new Date().toISOString().slice(0, 10),
                  status: 'OPEN',
                  officialReceiptCode: 'VIRTUAL',
                  drawnNumbers: [],
                  prizeTotalAmount: 0,
                  createdAt: new Date().toISOString(),
                } as Pool
              }
              games={personalPrintPayload.games}
              onOpenGamesTab={() => {
                setPersonalPrintPayload(null);
                setUserModalTopic('PALPITES');
              }}
            />
          ) : isInsideBolaoSection ? (
            /* 1. SEÇÃO EXCLUSIVA DO BOLÃO */
            <>
              {activeTab === 'PARTICIPANTS' && selectedCompany && selectedPool && (
                <PoolParticipantsTab
                  currentUser={currentUser}
                  company={selectedCompany}
                  pool={selectedPool}
                  participants={dbState.participants}
                  purchases={dbState.purchases}
                  userRole={userRole}
                  onConciliatePixNow={handleConciliatePixNow}
                  onRegisterParticipant={handleRegisterParticipant}
                  onOpenCoupon={(purchase) => setSelectedCouponPurchase(purchase)}
                />
              )}

              {activeTab === 'POOL' && selectedCompany && selectedPool && (
                <PoolActionTab
                  currentUser={currentUser}
                  company={selectedCompany}
                  pool={selectedPool}
                  participants={dbState.participants}
                  purchases={dbState.purchases}
                  userRole={userRole}
                  onCreatePixPurchase={handleCreatePixPurchase}
                  onConciliatePixNow={handleConciliatePixNow}
                  onRegisterParticipant={handleRegisterParticipant}
                  onUpdatePoolConfig={handleUpdatePoolConfig}
                  onOpenCoupon={(purchase) => setSelectedCouponPurchase(purchase)}
                />
              )}

              {activeTab === 'GAMES' && selectedCompany && selectedPool && (
                <GamesAuditTab
                  currentUser={currentUser}
                  companies={dbState.companies}
                  company={selectedCompany}
                  pool={selectedPool}
                  games={dbState.games}
                  suggestions={dbState.suggestions || []}
                  purchases={dbState.purchases}
                  auditLogs={dbState.auditLogs}
                  userRole={userRole}
                  onSelectCompanyTenant={(compId) => setSelectedCompanyId(compId)}
                  onAddGames={handleAddGames}
                  onCreateSuggestion={handleCreateSuggestion}
                  onSuggestionAction={handleSuggestionAction}
                  onUpdateDrawnNumbers={handleUpdateDrawnNumbers}
                  onOpenStatsTab={() => setActiveTab('STATS')}
                  onOpenPrintTab={() => {
                    setActiveTab('PRINT');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              )}

              {activeTab === 'PRINT' && selectedCompany && selectedPool && (
                <PoolPrintTab
                  company={selectedCompany}
                  pool={selectedPool}
                  games={dbState.games}
                  onOpenGamesTab={() => setActiveTab('GAMES')}
                />
              )}

              {activeTab === 'STATS' && selectedCompany && selectedPool && (
                <PoolStatsTab
                  company={selectedCompany}
                  pool={selectedPool}
                  participants={dbState.participants}
                  games={dbState.games}
                  suggestions={dbState.suggestions || []}
                  purchases={dbState.purchases}
                  onUpdateDrawnNumbers={handleUpdateDrawnNumbers}
                />
              )}
            </>
          ) : userRole === 'COLLABORATOR' || userModalTopic === 'PERFIL' ? (
            /* 2. LADO USUÁRIO */
            <UserAreaTab
              currentUser={currentUser}
              userRole={userRole}
              companies={dbState.companies}
              pools={dbState.pools}
              participants={dbState.participants}
              purchases={dbState.purchases}
              games={dbState.games}
              suggestions={dbState.suggestions || []}
              selectedCompanyId={selectedCompany.id}
              directOpenCompanyId={directOpenCompanyId}
              onClearDirectOpenCompany={() => setDirectOpenCompanyId(null)}
              onSelectCompany={handleSelectCompany}
              onUpdateUser={handleUpdateUser}
              onCreateSuggestion={handleCreateSuggestion}
              onOpenCoupon={(purchase) => setSelectedCouponPurchase(purchase)}
              activeModalTopic={userModalTopic}
              onChangeModalTopic={setUserModalTopic}
              onLogout={handleLogout}
              onNotify={showToast}
              onOpenPromoter={(preset) => {
                if (preset) {
                  setPromoterCreatePreset(preset);
                }
                setUserModalTopic(null);
                setUserRole('MANAGER');
                setActiveTab('COMPANIES');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenPersonalPrint={(payload) => {
                setPersonalPrintPayload(payload);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : activeTab === 'ADMIN' ? (
            /* 3. CONFIGURAÇÃO DE SPLIT / ADMIN */
            <AdminDashboardTab
              companies={dbState.companies}
              pools={dbState.pools}
              participants={dbState.participants}
              purchases={dbState.purchases}
              settings={dbState.settings}
              onUpdateSettings={handleUpdateSettings}
              onConciliatePixNow={handleConciliatePixNow}
              onSelectCompanyPool={handleSelectCompany}
              onOpenCoupon={(purchase) => setSelectedCouponPurchase(purchase)}
            />
          ) : (
            /* 4. PAINEL PROMOTOR (Criação e Gestão de Bolões) */
            <CompaniesTab
              currentUser={currentUser}
              companies={dbState.companies}
              pools={dbState.pools}
              purchases={dbState.purchases}
              selectedCompanyId={selectedCompany.id}
              onSelectCompany={handleSelectCompany}
              onCreateCompany={handleCreateCompany}
              onUpdatePoolConfig={handleUpdatePoolConfig}
              initialCreatePreset={promoterCreatePreset}
              onClearCreatePreset={() => setPromoterCreatePreset(null)}
              onPromoteToOrganizer={async () => {
                await handleUpdateUser({ jobTitle: 'Promotor' });
                setUserRole('MANAGER');
                showToast('Perfil Promotor ativado com sucesso!');
              }}
            />
          )}
        </main>

        {selectedCouponPurchase && (
          <DigitalCouponModal
            purchase={selectedCouponPurchase}
            company={
              dbState.companies.find((c) => c.id === selectedCouponPurchase.companyId) ||
              selectedCompany
            }
            pool={
              dbState.pools.find((p) => p.id === selectedCouponPurchase.poolId) ||
              selectedPool
            }
            games={dbState.games.filter(
              (g) => g.poolId === selectedCouponPurchase.poolId
            )}
            onClose={() => setSelectedCouponPurchase(null)}
          />
        )}

        {/* Fixed Mobile Footer */}
        <footer
          className={`print:hidden fixed bottom-0 w-full max-w-[430px] z-30 caixa-footer-shadow grid ${
            isInsideBolaoSection ? 'grid-cols-5' : 'grid-cols-4'
          }`}
        >
          {isInsideBolaoSection ? (
            /* MENU EXCLUSIVO DO BOLÃO: Voltar | Participantes | Pagamentos | Jogos | Estatísticas */
            <>
              <button
                type="button"
                onClick={() => {
                  setUserRole('COLLABORATOR');
                  setUserModalTopic('GRUPOS');
                  setActiveTab('COMPANIES');
                }}
                style={{ color: 'var(--brand-primary)' }}
                className="h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer font-bold"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-[10px] leading-none whitespace-nowrap">
                  Voltar
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserModalTopic(null);
                  setActiveTab('PARTICIPANTS');
                }}
                style={
                  activeTab === 'PARTICIPANTS'
                    ? { color: 'var(--brand-primary)' }
                    : undefined
                }
                className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'PARTICIPANTS'
                    ? 'font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] leading-none whitespace-nowrap">
                  Participantes
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserModalTopic(null);
                  setActiveTab('POOL');
                }}
                style={
                  activeTab === 'POOL'
                    ? { color: 'var(--brand-primary)' }
                    : undefined
                }
                className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'POOL'
                    ? 'font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                <Ticket className="w-5 h-5" />
                <span className="text-[10px] leading-none whitespace-nowrap">
                  Pagamentos
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserModalTopic(null);
                  setActiveTab('GAMES');
                }}
                style={
                  activeTab === 'GAMES' || activeTab === 'PRINT'
                    ? { color: 'var(--brand-primary)' }
                    : undefined
                }
                className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'GAMES' || activeTab === 'PRINT'
                    ? 'font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                <Grid className="w-5 h-5" />
                <span className="text-[10px] leading-none whitespace-nowrap">
                  Jogos
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserModalTopic(null);
                  setActiveTab('STATS');
                }}
                style={
                  activeTab === 'STATS'
                    ? { color: 'var(--brand-primary)' }
                    : undefined
                }
                className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'STATS'
                    ? 'font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                <BarChart2 className="w-5 h-5" />
                <span className="text-[10px] leading-none whitespace-nowrap">
                  Estatísticas
                </span>
              </button>
            </>
          ) : (
            /* MENU DO LADO USUÁRIO (4 COLUNAS): Início | Loterias | Meus Jogos | Bolões */
            <>
              <button
                type="button"
                onClick={() => {
                  setPersonalPrintPayload(null);
                  setUserRole('COLLABORATOR');
                  setUserModalTopic(null);
                  setActiveTab('COMPANIES');
                }}
                style={
                  !personalPrintPayload &&
                  userRole === 'COLLABORATOR' &&
                  (userModalTopic === null || userModalTopic === 'INICIO')
                    ? { color: 'var(--brand-primary)' }
                    : undefined
                }
                className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  !personalPrintPayload &&
                  userRole === 'COLLABORATOR' &&
                  (userModalTopic === null || userModalTopic === 'INICIO')
                    ? 'font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                <Home className="w-5 h-5" />
                <span className="text-[11px] leading-none whitespace-nowrap">Início</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPersonalPrintPayload(null);
                  setUserRole('COLLABORATOR');
                  setUserModalTopic('PALPITES');
                  setActiveTab('COMPANIES');
                }}
                style={
                  !personalPrintPayload &&
                  userRole === 'COLLABORATOR' &&
                  userModalTopic === 'PALPITES'
                    ? { color: 'var(--brand-primary)' }
                    : undefined
                }
                className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  !personalPrintPayload &&
                  userRole === 'COLLABORATOR' &&
                  userModalTopic === 'PALPITES'
                    ? 'font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                <Ticket className="w-5 h-5" />
                <span className="text-[11px] leading-none whitespace-nowrap">Loterias</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPersonalPrintPayload(null);
                  setUserRole('COLLABORATOR');
                  setUserModalTopic('MEUS_JOGOS');
                  setActiveTab('COMPANIES');
                }}
                style={
                  personalPrintPayload ||
                  (userRole === 'COLLABORATOR' && userModalTopic === 'MEUS_JOGOS')
                    ? { color: 'var(--brand-primary)' }
                    : undefined
                }
                className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  personalPrintPayload ||
                  (userRole === 'COLLABORATOR' && userModalTopic === 'MEUS_JOGOS')
                    ? 'font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                <Grid className="w-5 h-5" />
                <span className="text-[11px] leading-none whitespace-nowrap">Meus Jogos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPersonalPrintPayload(null);
                  setUserRole('COLLABORATOR');
                  setUserModalTopic('GRUPOS');
                  setActiveTab('COMPANIES');
                }}
                style={
                  !personalPrintPayload &&
                  (userModalTopic === 'GRUPOS' || userRole !== 'COLLABORATOR')
                    ? { color: 'var(--brand-primary)' }
                    : undefined
                }
                className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  !personalPrintPayload &&
                  (userModalTopic === 'GRUPOS' || userRole !== 'COLLABORATOR')
                    ? 'font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] font-medium'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[11px] leading-none whitespace-nowrap">Bolões</span>
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
