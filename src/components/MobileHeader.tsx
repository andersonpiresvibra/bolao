import React, { useEffect, useState, useRef } from 'react';
import { SystemUser, UserRole } from '../types';
import {
  ShieldCheck,
  UserCheck,
  LogOut,
  ChevronDown,
  User,
} from 'lucide-react';
import { ModalTopic } from './UserAreaTab';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationToggleButton } from './NotificationToggleButton';

interface MobileHeaderProps {
  currentUser: SystemUser;
  userRole: UserRole;
  authToken?: string | null;
  onChangeRole: (role: UserRole) => void;
  onLogout: () => void;
  onOpenUserSection?: (topic: ModalTopic) => void;
  onNotify?: (msg: string) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentUser,
  userRole,
  authToken = null,
  onChangeRole,
  onLogout,
  onOpenUserSection,
  onNotify,
}) => {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    if (avatarMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [avatarMenuOpen]);

  const firstName =
    currentUser.name.split(' ')[0]?.toUpperCase() || currentUser.name.toUpperCase();

  const handleNavigateSection = (topic: ModalTopic) => {
    setAvatarMenuOpen(false);
    if (userRole !== 'COLLABORATOR') {
      onChangeRole('COLLABORATOR');
    }
    if (onOpenUserSection) {
      onOpenUserSection(topic);
    }
  };

  const handleSelectRoleFromMenu = (role: UserRole) => {
    setAvatarMenuOpen(false);
    onChangeRole(role);
  };

  return (
    <header className="sticky top-0 z-30">
      {/* Main Brand Header Banner — Branco Neutro */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 pt-3.5 pb-4 relative overflow-hidden text-[#0F172A]">
        {/* Arte Geométrica Neutra Sutil sobre Fundo Branco */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 430 110"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="375" cy="18" r="78" fill="#F8FAFC" fillOpacity="0.9" />
          <circle cx="55" cy="98" r="64" fill="#F1F5F9" fillOpacity="0.65" />
          <path
            d="M250 -10 L340 120"
            stroke="#E2E8F0"
            strokeOpacity="0.55"
            strokeWidth="1.25"
          />
          <path
            d="M295 -10 L385 120"
            stroke="#F1F5F9"
            strokeOpacity="0.8"
            strokeWidth="1"
          />
        </svg>

        <div className="relative z-10 flex items-start justify-between gap-2">
          {/* Left: Clickable Avatar + Greeting */}
          <div className="relative min-w-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer rounded-[8px] p-1 -m-1 transition-colors hover:bg-[#F1F5F9]"
              title="Abrir Menu do Usuário"
            >
              <div className="w-10 h-10 bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-display font-extrabold text-xs flex items-center justify-center shrink-0 rounded-[10px] shadow-2xs transition-colors">
                {currentUser.avatarInitials || 'US'}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-normal leading-tight flex items-center gap-1.5 text-[#475569]">
                  <span>Olá,</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-[4px] font-semibold bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]">
                    Menu
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-display font-extrabold text-base tracking-wide truncate text-[#0F172A]">
                    {firstName}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform text-[#475569] ${
                      avatarMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>
            </button>

            {/* Dropdown Menu do Usuário */}
            {avatarMenuOpen && (
              <div className="absolute left-0 mt-2 w-60 bg-white rounded-[10px] shadow-xl border border-[#E2E8F0] text-[#1E293B] z-50 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <p className="text-xs font-bold text-[#0F172A] truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-[#64748B] truncate">
                    {currentUser.jobTitle || 'Usuário'}
                    {currentUser.companyName ? ` · ${currentUser.companyName}` : ''}
                  </p>
                </div>

                <div className="divide-y divide-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('PERFIL')}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <User
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--brand-primary)' }}
                    />
                    <div>
                      <span className="block font-bold">Perfil</span>
                      <span className="block text-[10px] text-[#64748B] font-normal">
                        Dados e Pix
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleFromMenu('COLLABORATOR')}
                    className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      userRole === 'COLLABORATOR'
                        ? 'bg-[#F8FAFC] text-[#0F172A]'
                        : 'text-[#1E293B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <User
                        className="w-4 h-4 shrink-0"
                        style={{ color: 'var(--brand-primary)' }}
                      />
                      <div>
                        <span className="block font-bold">Usuário</span>
                        <span className="block text-[10px] text-[#64748B] font-normal">
                          Jogos e bolões
                        </span>
                      </div>
                    </div>
                    {userRole === 'COLLABORATOR' && (
                      <span
                        style={{ backgroundColor: 'var(--brand-primary)' }}
                        className="text-[9px] font-extrabold text-white px-1.5 py-0.5 rounded-[4px] shrink-0"
                      >
                        ATIVO
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleFromMenu('MANAGER')}
                    className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      userRole === 'MANAGER'
                        ? 'bg-[#F0FDF4] text-[#047857]'
                        : 'text-[#1E293B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserCheck className="w-4 h-4 text-[#059669] shrink-0" />
                      <div>
                        <span className="block font-bold">Promotor</span>
                        <span className="block text-[10px] text-[#64748B] font-normal">
                          Criar bolão
                        </span>
                      </div>
                    </div>
                    {userRole === 'MANAGER' && (
                      <span className="text-[9px] font-extrabold bg-[#059669] text-white px-1.5 py-0.5 rounded-[4px] shrink-0">
                        ATIVO
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleFromMenu('SUPER_ADMIN')}
                    className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      userRole === 'SUPER_ADMIN'
                        ? 'bg-[#F1F5F9] text-[#334155]'
                        : 'text-[#1E293B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-[#334155] shrink-0" />
                      <div>
                        <span className="block font-bold">Split</span>
                        <span className="block text-[10px] text-[#64748B] font-normal">
                          Taxas
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-[#DC2626] shrink-0" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: PWA Install + Push Bell + Sair */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton
              variant="header"
              onInstalled={() =>
                onNotify?.('Aplicativo instalado na Tela de Início com sucesso!')
              }
            />
            <NotificationToggleButton
              authToken={authToken}
              onNotify={onNotify}
            />
            <button
              type="button"
              onClick={onLogout}
              title="Sair"
              className="h-9 px-2.5 rounded-[8px] flex items-center justify-center gap-1 transition-colors cursor-pointer bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A]"
            >
              <LogOut className="w-3.5 h-3.5 text-[#334155]" />
              <span className="text-xs font-bold">Sair</span>
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
