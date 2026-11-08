import React, { useState, useEffect } from 'react';
import { Company, SystemUser } from '../types';
import {
  maskCpfInput,
  maskPhoneInput,
  maskSmartIdentifier,
} from '../utils/inputMasks';
import {
  Clock,
  LogIn,
  UserPlus,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  User,
  Phone,
  Building2,
  Landmark,
  X,
} from 'lucide-react';

interface ParticipantLoginFormProps {
  companies: Company[];
  existingUsers: SystemUser[];
  invitedCompanyId?: string | null;
  onLoginSuccess: (user: SystemUser) => void;
  onLoginPasswordApi: (payload: {
    identifier: string;
    password: string;
  }) => Promise<SystemUser>;
  onRegisterLoginApi: (payload: {
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
  }) => Promise<SystemUser>;
  onRecoverPasswordApi: (payload: {
    identifier: string;
    newPassword: string;
  }) => Promise<{ ok: boolean; message: string }>;
}

type RegisterStep = 1 | 2 | 3;

const REGISTER_STEPS: {
  step: RegisterStep;
  title: string;
  subtitle: string;
}[] = [
  {
    step: 1,
    title: 'CONTA',
    subtitle: 'Seus dados pessoais de acesso.',
  },
  {
    step: 2,
    title: 'CONTATO',
    subtitle: 'WhatsApp e e-mail para avisos.',
  },
  {
    step: 3,
    title: 'PIX',
    subtitle: 'CPF e chave Pix para cotas e prêmios.',
  },
];

export const ParticipantLoginForm: React.FC<ParticipantLoginFormProps> = ({
  companies,
  invitedCompanyId,
  onLoginSuccess,
  onLoginPasswordApi,
  onRegisterLoginApi,
  onRecoverPasswordApi,
}) => {
  // Modal Visibility States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showRecoverModal, setShowRecoverModal] = useState(false);

  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState('alex.torres@vibraenergia.com.br');
  const [loginPassword, setLoginPassword] = useState('123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [loadingLogin, setLoadingLogin] = useState(false);

  // 3-Step User-First Registration Modal State
  const [currentStep, setCurrentStep] = useState<RegisterStep>(1);

  // Step 1: CONTA
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: CONTATO
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappConfirm, setWhatsappConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');

  const invitedCompany = invitedCompanyId
    ? companies.find((c) => c.id === invitedCompanyId)
    : undefined;

  // Step 3: PIX
  const [cpf, setCpf] = useState('');
  const [pixKey, setPixKey] = useState('');

  const [registerError, setRegisterError] = useState<string | null>(null);
  const [loadingRegister, setLoadingRegister] = useState(false);

  // Recover Password Modal State
  const [recoverIdentifier, setRecoverIdentifier] = useState('');
  const [recoverNewPassword, setRecoverNewPassword] = useState('');
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [loadingRecover, setLoadingRecover] = useState(false);

  const openRegisterModalFresh = () => {
    setRegisterError(null);
    setCurrentStep(1);
    setShowRegisterModal(true);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginError('Informe seu login e sua senha.');
      return;
    }

    setLoadingLogin(true);
    try {
      const loggedUser = await onLoginPasswordApi({
        identifier: loginIdentifier.trim(),
        password: loginPassword.trim(),
      });
      onLoginSuccess(loggedUser);
    } catch (err: any) {
      setLoginError(err.message || 'Falha ao autenticar.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const validateCurrentStep = (): boolean => {
    setRegisterError(null);

    if (currentStep === 1) {
      if (!name.trim() || !username.trim() || !password.trim()) {
        setRegisterError('Preencha nome, usuário e senha.');
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      if (
        !whatsapp.trim() ||
        !whatsappConfirm.trim() ||
        !email.trim() ||
        !emailConfirm.trim()
      ) {
        setRegisterError('Preencha e confirme seu WhatsApp e e-mail.');
        return false;
      }
      const cleanW1 = whatsapp.replace(/\D/g, '');
      const cleanW2 = whatsappConfirm.replace(/\D/g, '');
      if (cleanW1 !== cleanW2 || cleanW1.length < 8) {
        setRegisterError('Os números de WhatsApp não conferem.');
        return false;
      }
      if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
        setRegisterError('Os e-mails informados não conferem.');
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      if (!cpf.trim() || !pixKey.trim()) {
        setRegisterError('Informe seu CPF e sua chave Pix.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNextStep = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as RegisterStep);
    }
  };

  const handlePrevStep = () => {
    setRegisterError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as RegisterStep);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCurrentStep()) return;

    if (currentStep < 3) {
      handleNextStep();
      return;
    }

    setLoadingRegister(true);
    try {
      const registeredUser = await onRegisterLoginApi({
        name: name.trim(),
        username: username.trim(),
        whatsapp: whatsapp.trim(),
        cpf: cpf.trim(),
        email: email.trim(),
        password: password.trim(),
        companyName: invitedCompany?.name || '',
        companyId: invitedCompany?.id,
        jobTitle: 'Usuário',
        pixKey: pixKey.trim(),
      });
      setShowRegisterModal(false);
      onLoginSuccess(registeredUser);
    } catch (err: any) {
      setRegisterError(err.message || 'Falha ao cadastrar usuário.');
    } finally {
      setLoadingRegister(false);
    }
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverError(null);

    if (!recoverIdentifier.trim() || !recoverNewPassword.trim()) {
      setRecoverError('Informe seu login e digite a nova senha.');
      return;
    }

    setLoadingRecover(true);
    try {
      const result = await onRecoverPasswordApi({
        identifier: recoverIdentifier.trim(),
        newPassword: recoverNewPassword.trim(),
      });
      setLoginIdentifier(recoverIdentifier.trim());
      setLoginPassword(recoverNewPassword.trim());
      setLoginSuccess(result.message);
      setShowRecoverModal(false);
    } catch (err: any) {
      setRecoverError(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoadingRecover(false);
    }
  };

  const activeStepMeta = REGISTER_STEPS.find((s) => s.step === currentStep)!;

  return (
    <div className="min-h-screen w-full bg-[#E6EEF6] flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-[#F7F9FC] flex flex-col relative pb-8 shadow-lg">
        {/* Gradient Header */}
        <header className="caixa-header-gradient text-white px-4 pt-5 pb-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="font-display font-extrabold text-xl text-white tracking-wide">
                BOLÃO & LOTERIAS
              </h1>
              <p className="text-xs text-white/85 mt-0.5">
                Jogos pessoais, dezenas e bolões
              </p>
            </div>
          </div>
        </header>

        {/* Main Content Sheet */}
        <main className="flex-1 px-4 pt-5 space-y-6">
          {invitedCompany && (
            <div className="caixa-card p-3.5 bg-[#EBF4FC] border border-[#93C5FD] text-xs space-y-1">
              <span className="text-[10px] font-bold text-[#005CA9] uppercase block">
                Convite
              </span>
              <p className="font-bold text-[#1E293B]">
                Bolão: {invitedCompany.name}
              </p>
              <p className="text-[11px] text-[#5F6C7B]">
                Entre ou cadastre-se para abrir este bolão.
              </p>
            </div>
          )}

          {/* Independent Section for System Access (Login Form) */}
          <section className="space-y-2.5">
            <form onSubmit={handleLoginSubmit} className="caixa-card p-4 space-y-3.5 text-xs">
              <div className="pb-2 border-b border-[#EDF2F7]">
                <h2 className="font-display font-bold text-sm text-[#333E48]">
                  Acesso
                </h2>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 px-3 py-2 rounded-[4px] text-xs font-semibold text-red-800">
                  {loginError}
                </div>
              )}

              {loginSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-[4px] text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{loginSuccess}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  CPF, E-mail ou Usuário
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(maskSmartIdentifier(e.target.value))}
                  placeholder="Ex: Fulano@ ou 000.000.000-00"
                  className="caixa-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#333E48] mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="caixa-input"
                />
              </div>

              <button
                type="submit"
                disabled={loadingLogin}
                className="w-full min-h-[44px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span>{loadingLogin ? 'Entrando...' : 'Entrar'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={openRegisterModalFresh}
                  className="min-h-[38px] bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#E6EDF5] text-[#005CA9] font-display font-semibold text-xs rounded-[4px] transition-colors cursor-pointer"
                >
                  Cadastrar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRecoverError(null);
                    setRecoverIdentifier(loginIdentifier);
                    setShowRecoverModal(true);
                  }}
                  className="min-h-[38px] bg-[#F7F9FC] hover:bg-[#EBF4FC] border border-[#E6EDF5] text-[#5F6C7B] hover:text-[#005CA9] font-display font-semibold text-xs rounded-[4px] transition-colors cursor-pointer"
                >
                  Senha
                </button>
              </div>
            </form>
          </section>
        </main>

        {/* ===================================================================== */}
        {/* MODAL 1: FLUXO DE CADASTRO DE USUÁRIO EM 3 ETAPAS PESSOAIS            */}
        {/* ===================================================================== */}
        {showRegisterModal && (
          <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
            <div className="w-full max-w-[406px] caixa-card overflow-hidden my-auto">
              {/* Modal Header */}
              <div className="caixa-header-gradient text-white px-4 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/85">
                    Etapa {currentStep} de 3 · {activeStepMeta.title}
                  </div>
                  <h3 className="font-display font-bold text-sm">
                    Novo Usuário
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px]"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 3-Step Visual Progress Bar */}
              <div className="bg-[#F7F9FC] px-4 py-3 border-b border-[#EDF2F7] space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {REGISTER_STEPS.map((item) => {
                    const isActive = item.step === currentStep;
                    const isCompleted = item.step < currentStep;
                    return (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => {
                          if (item.step < currentStep) {
                            setRegisterError(null);
                            setCurrentStep(item.step);
                          }
                        }}
                        className={`py-1.5 px-1 rounded-[4px] text-center transition-colors ${
                          isActive
                            ? 'bg-[#005CA9] text-white font-bold'
                            : isCompleted
                            ? 'bg-[#EBF4FC] text-[#005CA9] font-semibold cursor-pointer'
                            : 'bg-white text-[#5F6C7B] border border-[#E6EDF5]'
                        }`}
                      >
                        <div className="text-[10px] leading-tight">
                          {item.step}. {item.title}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Step Banner Title */}
                <div className="pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-display font-bold text-[#005CA9]">
                    {currentStep === 1 && <User className="w-4 h-4 shrink-0" />}
                    {currentStep === 2 && <Phone className="w-4 h-4 shrink-0" />}
                    {currentStep === 3 && <Landmark className="w-4 h-4 shrink-0" />}
                    <span>{activeStepMeta.title}</span>
                  </div>
                  <p className="text-[11px] text-[#5F6C7B] leading-relaxed mt-0.5">
                    {activeStepMeta.subtitle}
                  </p>
                </div>
              </div>

              {registerError && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-xs font-semibold text-red-900">
                  {registerError}
                </div>
              )}

              {/* Progressive Form Content */}
              <form onSubmit={handleRegisterSubmit} className="p-4 space-y-3.5 text-xs bg-white">
                {/* ETAPA 1: CONTA */}
                {currentStep === 1 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold text-[#333E48] mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (!username && e.target.value.trim()) {
                            const firstWord = e.target.value.trim().split(/\s+/)[0];
                            setUsername(`${firstWord}@`);
                          }
                        }}
                        placeholder="Seu nome completo"
                        className="caixa-input"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#333E48] mb-1">
                        Usuário *
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ex. Fulano@"
                        className="caixa-input font-mono-tabular"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#333E48] mb-1">
                        Senha *
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Crie sua senha"
                        className="caixa-input"
                      />
                    </div>
                  </div>
                )}

                {/* ETAPA 2: CONTATO */}
                {currentStep === 2 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-[#333E48] mb-1">
                          WhatsApp *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(maskPhoneInput(e.target.value))}
                          placeholder="(11) 91234-5678"
                          className="caixa-input font-mono-tabular"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#333E48] mb-1">
                          Repetir WhatsApp *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={whatsappConfirm}
                          onChange={(e) => setWhatsappConfirm(maskPhoneInput(e.target.value))}
                          placeholder="(11) 91234-5678"
                          className="caixa-input font-mono-tabular"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-[#333E48] mb-1">
                          E-mail *
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nome@email.com"
                          className="caixa-input"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#333E48] mb-1">
                          Repetir E-mail *
                        </label>
                        <input
                          type="email"
                          required
                          value={emailConfirm}
                          onChange={(e) => setEmailConfirm(e.target.value)}
                          placeholder="nome@email.com"
                          className="caixa-input"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ETAPA 3: PIX */}
                {currentStep === 3 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold text-[#333E48] mb-1">
                        CPF *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={cpf}
                        onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                        placeholder="000.000.000-00"
                        className="caixa-input font-mono-tabular"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#333E48] mb-1">
                        Chave Pix *
                      </label>
                      <input
                        type="text"
                        required
                        value={pixKey}
                        onChange={(e) => setPixKey(maskSmartIdentifier(e.target.value))}
                        placeholder="CPF, celular ou e-mail"
                        className="caixa-input font-mono-tabular"
                      />
                    </div>
                  </div>
                )}

                {/* Step Navigation Controls */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#EDF2F7]">
                  {currentStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => setShowRegisterModal(false)}
                      className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px]"
                    >
                      Cancelar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px] flex items-center justify-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                  )}

                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1"
                    >
                      <span>Avançar</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loadingRegister}
                      className="min-h-[42px] bg-[#008B47] hover:bg-emerald-800 text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{loadingRegister ? 'Salvando...' : 'Concluir'}</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* MODAL 2: TELA MODAL DE RECUPERAÇÃO DE SENHA                           */}
        {/* ===================================================================== */}
        {showRecoverModal && (
          <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
            <div className="w-full max-w-[406px] caixa-card overflow-hidden my-auto">
              <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase text-white/85">
                    Acesso
                  </div>
                  <h3 className="font-display font-bold text-sm">
                    Nova Senha
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecoverModal(false)}
                  className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px]"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {recoverError && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs font-semibold text-red-900">
                  {recoverError}
                </div>
              )}

              <form onSubmit={handleRecoverSubmit} className="p-4 space-y-3.5 text-xs bg-white">
                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    CPF, E-mail ou Usuário *
                  </label>
                  <input
                    type="text"
                    required
                    value={recoverIdentifier}
                    onChange={(e) => setRecoverIdentifier(maskSmartIdentifier(e.target.value))}
                    placeholder="Ex: Fulano@ ou 000.000.000-00"
                    className="caixa-input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#333E48] mb-1">
                    Nova Senha *
                  </label>
                  <input
                    type="password"
                    required
                    value={recoverNewPassword}
                    onChange={(e) => setRecoverNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="caixa-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRecoverModal(false)}
                    className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs rounded-[4px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loadingRecover}
                    className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{loadingRecover ? 'Salvando...' : 'Salvar'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
