import React, { useEffect, useState, useRef } from 'react';
import { SystemUser, UserRole } from '../types';
import {
  ShieldCheck,
  UserCheck,
  EyeOff,
  LogOut,
  ChevronDown,
  User,
} from 'lucide-react';
import { ModalTopic } from './UserAreaTab';

interface MobileHeaderProps {
  currentUser: SystemUser;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  onLogout: () => void;
  selectedCompanyName?: string;
  onOpenUserSection?: (topic: ModalTopic) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentUser,
  userRole,
  onChangeRole,
  onLogout,
  onOpenUserSection,
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
      {/* Blue-to-Turquoise Gradient Banner */}
      <div className="caixa-header-gradient text-white px-4 pt-4 pb-5 relative">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Clickable Avatar + Greeting "Olá, ANDERSON" opening Menu do Avatar */}
          <div className="relative min-w-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer rounded-[4px] p-1 -m-1 hover:bg-white/10 transition-colors"
              title="Abrir Menu do Usuário"
            >
              <div className="w-10 h-10 bg-white/20 backdrop-blur-xs border border-white/40 text-white font-display font-extrabold text-xs flex items-center justify-center shrink-0 rounded-[4px] group-hover:bg-white/30 transition-colors">
                {currentUser.avatarInitials || 'US'}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-white/90 font-normal leading-tight flex items-center gap-1">
                  <span>Olá,</span>
                  <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded-[3px] font-semibold">
                    Menu
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-display font-extrabold text-base text-white tracking-wide truncate">
                    {firstName}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-white/90 shrink-0 transition-transform ${
                      avatarMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>
            </button>

            {/* Dropdown Menu do Usuário */}
            {avatarMenuOpen && (
              <div className="absolute left-0 mt-2 w-60 bg-white rounded-[4px] shadow-xl border border-[#D5E0EC] text-[#1E293B] z-50 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-[#F7F9FC] border-b border-[#E2E8F0]">
                  <p className="text-xs font-bold text-[#1E293B] truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-[#5F6C7B] truncate">
                    {currentUser.jobTitle || 'Usuário'}
                    {currentUser.companyName ? ` · ${currentUser.companyName}` : ''}
                  </p>
                </div>

                <div className="divide-y divide-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('PERFIL')}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-[#1E293B] hover:bg-[#EBF4FC] hover:text-[#005CA9] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-[#005CA9] shrink-0" />
                    <div>
                      <span className="block font-bold">Perfil</span>
                      <span className="block text-[10px] text-[#5F6C7B] font-normal">
                        Dados e Pix
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleFromMenu('COLLABORATOR')}
                    className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      userRole === 'COLLABORATOR'
                        ? 'bg-[#EBF4FC] text-[#005CA9]'
                        : 'text-[#1E293B] hover:bg-[#F7F9FC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <EyeOff className="w-4 h-4 text-[#005CA9] shrink-0" />
                      <div>
                        <span className="block font-bold">Usuário</span>
                        <span className="block text-[10px] text-[#5F6C7B] font-normal">
                          Jogos e bolões
                        </span>
                      </div>
                    </div>
                    {userRole === 'COLLABORATOR' && (
                      <span className="text-[9px] font-extrabold bg-[#005CA9] text-white px-1.5 py-0.5 rounded-[3px] shrink-0">
                        ATIVO
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleFromMenu('MANAGER')}
                    className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      userRole === 'MANAGER'
                        ? 'bg-[#F0FDF4] text-[#008B47]'
                        : 'text-[#1E293B] hover:bg-[#F7F9FC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserCheck className="w-4 h-4 text-[#008B47] shrink-0" />
                      <div>
                        <span className="block font-bold">Promotor</span>
                        <span className="block text-[10px] text-[#5F6C7B] font-normal">
                          Criar bolão
                        </span>
                      </div>
                    </div>
                    {userRole === 'MANAGER' && (
                      <span className="text-[9px] font-extrabold bg-[#008B47] text-white px-1.5 py-0.5 rounded-[3px] shrink-0">
                        ATIVO
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleFromMenu('SUPER_ADMIN')}
                    className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      userRole === 'SUPER_ADMIN'
                        ? 'bg-[#F1F5F9] text-[#333E48]'
                        : 'text-[#1E293B] hover:bg-[#F7F9FC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-[#333E48] shrink-0" />
                      <div>
                        <span className="block font-bold">Split</span>
                        <span className="block text-[10px] text-[#5F6C7B] font-normal">
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

          {/* Right: Sair */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onLogout}
              title="Sair"
              className="h-9 px-3 bg-white/15 hover:bg-white/25 border border-white/30 text-white rounded-[4px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-bold">Sair</span>
            </button>
          </div>
        </div>
      </div>

      <div className="-mt-2 bg-[#F7F9FC] rounded-t-[4px] h-2 border-b border-[#EDF2F7]" />
    </header>
  );
};
