import React, { useEffect, useState } from 'react';
import {
  DatabaseState,
  UserRole,
  QuotaPurchase,
  SystemUser,
} from './types';
import { INITIAL_DATABASE_STATE } from './seedData';
import { ParticipantLoginForm } from './components/ParticipantLoginForm';
import { MobileHeader } from './components/MobileHeader';
import { CompaniesTab } from './components/CompaniesTab';
import { PoolActionTab } from './components/PoolActionTab';
import { GamesAuditTab } from './components/GamesAuditTab';
import { AdminDashboardTab } from './components/AdminDashboardTab';
import { UserAreaTab, ModalTopic } from './components/UserAreaTab';
import { DigitalCouponModal } from './components/DigitalCouponModal';
import {
  Building2,
  Ticket,
  Grid,
  BarChart3,
  Home,
  User,
  Users,
} from 'lucide-react';

type ActiveTab = 'COMPANIES' | 'POOL' | 'GAMES' | 'ADMIN';

const SESSION_USER_KEY = 'lotocorp_logged_user_v2';

export default function App() {
  const [dbState, setDbState] = useState<DatabaseState>(INITIAL_DATABASE_STATE);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_USER_KEY);
      return saved ? (JSON.parse(saved) as SystemUser) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('COMPANIES');
  const [userModalTopic, setUserModalTopic] = useState<ModalTopic>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('comp_b');
  const [userRole, setUserRole] = useState<UserRole>('COLLABORATOR');
  const [selectedCouponPurchase, setSelectedCouponPurchase] =
    useState<QuotaPurchase | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    fetch('/api/state')
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

  const handleLoginPasswordApi = async (payload: {
    identifier: string;
    password: string;
  }): Promise<SystemUser> => {
    const resp = await fetch('/api/auth/login', {
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
    const resp = await fetch('/api/auth/register-login', {
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
    const resp = await fetch('/api/auth/recover-password', {
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
    if (user.companyId) {
      setSelectedCompanyId(user.companyId);
    }
    showToast(`Bem-vindo(a), ${user.name}! Ambiente da sua empresa carregado.`);
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

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setActiveTab('POOL');
  };

  const handleCreateCompany = async (
    payload: any
  ): Promise<{ ok: boolean; error?: string }> => {
    const resp = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data.error || 'Erro ao cadastrar empresa.' };
    }
    setDbState(data.state);
    setSelectedCompanyId(data.company.id);
    setActiveTab('POOL');
    showToast(`Tenant "${data.company.name}" criado tendo você como responsável!`);
    return { ok: true };
  };

  const handleCreatePixPurchase = async (payload: any): Promise<QuotaPurchase> => {
    const resp = await fetch('/api/payments/pix', {
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
        ? 'Pix conciliado com Split automático Asaas! Cupom digital gerado.'
        : 'Cobrança Pix gerada com Split Asaas configurado.'
    );
    return data.purchase;
  };

  const handleConciliatePixNow = async (purchaseId: string): Promise<QuotaPurchase> => {
    const resp = await fetch('/api/webhooks/asaas-conciliate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseId }),
    });
    const data = await resp.json();
    if (data.state) {
      setDbState(data.state);
    }
    showToast('Pagamento Pix conciliado! Repasse enviado ao organizador e taxa retida.');
    return data.purchase;
  };

  const handleRegisterParticipant = async (payload: any) => {
    const resp = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast(`Colaborador "${data.participant.name}" cadastrado na empresa!`);
    }
  };

  const handleUpdatePoolConfig = async (poolId: string, payload: any) => {
    const resp = await fetch(`/api/pools/${poolId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast('Regras do bolão da empresa atualizadas!');
    }
  };

  const handleAddGames = async (gamesList: any[]) => {
    const resp = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolId: selectedPool.id,
        companyId: selectedCompany.id,
        lotteryType: selectedPool.lotteryType,
        games: gamesList,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast(`${gamesList.length} volante(s) registrado(s) com sucesso!`);
    }
  };

  const handleCreateSuggestion = async (payload: {
    numbers: number[];
    rationale: string;
  }) => {
    const resp = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: selectedCompany.id,
        poolId: selectedPool.id,
        lotteryType: selectedPool.lotteryType,
        userId: currentUser.id,
        userName: currentUser.name,
        userJobTitle: currentUser.jobTitle,
        numbers: payload.numbers,
        rationale: payload.rationale,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast(
        `Palpite de ${payload.numbers.length} dezenas registrado na sala da ${selectedCompany.name}!`
      );
    }
  };

  const handleSuggestionAction = async (
    suggestionId: string,
    action: 'VOTE' | 'APPROVE_GAME',
    cost?: number,
    equivalentSimpleBets?: number
  ) => {
    const resp = await fetch(`/api/suggestions/${suggestionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, cost, equivalentSimpleBets }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setDbState(data.state);
      showToast(
        action === 'VOTE'
          ? 'Voto computado no palpite do colaborador!'
          : 'Palpite aprovado e registrado como volante oficial do bolão!'
      );
    }
  };

  const handleUpdateDrawnNumbers = async (
    poolId: string,
    drawnNumbers: number[],
    prizeTotalAmount: number
  ) => {
    await handleUpdatePoolConfig(poolId, { drawnNumbers, prizeTotalAmount });
    showToast('Conferência de dezenas e auditoria de rateio atualizadas!');
  };

  const handleUpdateSettings = async (payload: any) => {
    const resp = await fetch('/api/settings', {
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
      const resp = await fetch(`/api/users/${currentUser.id}`, {
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
    <div className="min-h-screen w-full bg-[#E6EEF6] flex justify-center">
      {/* Strict Mobile Viewport Shell (430px max width, Habitação CAIXA calm surface) */}
      <div className="w-full max-w-[430px] min-h-screen bg-[#F7F9FC] flex flex-col relative pb-16 shadow-lg">
        <MobileHeader
          currentUser={currentUser}
          userRole={userRole}
          onLogout={handleLogout}
          onOpenUserSection={(topic) => setUserModalTopic(topic)}
          onChangeRole={(role) => {
            setUserRole(role);
            if (role === 'SUPER_ADMIN') {
              setActiveTab('ADMIN');
              showToast('Frente 2 (Admin Split): gestão global de todas as empresas e taxas.');
            } else if (role === 'MANAGER') {
              setActiveTab('COMPANIES');
              showToast(
                `Frente 2 (Lado Empresa — ${selectedCompany.name}): gestão de bolões, volantes e pagamentos.`
              );
            } else {
              setUserModalTopic(null);
              showToast(
                'Frente 1 (Lado Usuário): exibindo exclusivamente o Meu Espaço do participante.'
              );
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
          {userRole === 'COLLABORATOR' ? (
            /* FRENTE 1: LADO USUÁRIO PARTICIPANTE (Exibe somente os itens criados para o usuário) */
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
              onSelectCompany={(compId) => setSelectedCompanyId(compId)}
              onUpdateUser={handleUpdateUser}
              onCreateSuggestion={handleCreateSuggestion}
              onOpenCoupon={(purchase) => setSelectedCouponPurchase(purchase)}
              activeModalTopic={userModalTopic}
              onChangeModalTopic={setUserModalTopic}
              onLogout={handleLogout}
              onNotify={showToast}
            />
          ) : (
            /* FRENTE 2: LADO EMPRESA / GESTOR & ADMIN GLOBAL */
            <>
              {activeTab === 'COMPANIES' && (
                <CompaniesTab
                  currentUser={currentUser}
                  companies={dbState.companies}
                  pools={dbState.pools}
                  purchases={dbState.purchases}
                  selectedCompanyId={selectedCompany.id}
                  onSelectCompany={handleSelectCompany}
                  onCreateCompany={handleCreateCompany}
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
                />
              )}

              {activeTab === 'ADMIN' && (
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
              )}
            </>
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

        {/* Fixed Mobile Footer — Separado por Frente (Lado Usuário vs Lado Empresa) */}
        {userRole === 'COLLABORATOR' ? (
          <footer className="fixed bottom-0 w-full max-w-[430px] z-30 caixa-footer-shadow grid grid-cols-3">
            <button
              type="button"
              onClick={() => setUserModalTopic('INICIO')}
              className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                userModalTopic === 'INICIO'
                  ? 'text-[#005CA9] font-bold'
                  : 'text-[#5F6C7B] hover:text-[#005CA9] font-medium'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] leading-none whitespace-nowrap">Início</span>
            </button>

            <button
              type="button"
              onClick={() => setUserModalTopic(null)}
              className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                userModalTopic === null
                  ? 'text-[#005CA9] font-bold'
                  : 'text-[#5F6C7B] hover:text-[#005CA9] font-medium'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[10px] leading-none whitespace-nowrap">Meu Espaço</span>
            </button>

            <button
              type="button"
              onClick={() => setUserModalTopic('GRUPOS')}
              className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                userModalTopic === 'GRUPOS'
                  ? 'text-[#005CA9] font-bold'
                  : 'text-[#5F6C7B] hover:text-[#005CA9] font-medium'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] leading-none whitespace-nowrap">Meus Grupos</span>
            </button>
          </footer>
        ) : (
          <footer className="fixed bottom-0 w-full max-w-[430px] z-30 caixa-footer-shadow grid grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveTab('COMPANIES')}
              className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeTab === 'COMPANIES'
                  ? 'text-[#005CA9] font-bold'
                  : 'text-[#5F6C7B] hover:text-[#005CA9] font-medium'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="text-[11px] leading-none whitespace-nowrap">Empresas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('POOL')}
              className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeTab === 'POOL'
                  ? 'text-[#005CA9] font-bold'
                  : 'text-[#5F6C7B] hover:text-[#005CA9] font-medium'
              }`}
            >
              <Ticket className="w-5 h-5" />
              <span className="text-[11px] leading-none whitespace-nowrap">Pagamentos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('GAMES')}
              className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeTab === 'GAMES'
                  ? 'text-[#005CA9] font-bold'
                  : 'text-[#5F6C7B] hover:text-[#005CA9] font-medium'
              }`}
            >
              <Grid className="w-5 h-5" />
              <span className="text-[11px] leading-none whitespace-nowrap">Volantes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ADMIN')}
              className={`h-15 rounded-none flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeTab === 'ADMIN'
                  ? 'text-[#005CA9] font-bold'
                  : 'text-[#5F6C7B] hover:text-[#005CA9] font-medium'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-[11px] leading-none whitespace-nowrap">Admin</span>
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
