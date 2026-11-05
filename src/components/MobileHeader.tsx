import React, { useEffect, useState, useRef } from 'react';
import { SystemUser, UserRole } from '../types';
import {
  Clock,
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
  const [now, setNow] = useState<Date>(new Date());
  const [avatarMenuOpen, setAvatarMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const formattedDate = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedTime = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

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

  return (
    <header className="sticky top-0 z-30">
      {/* CAIXA Official Blue-to-Turquoise Gradient Banner */}
      <div className="caixa-header-gradient text-white px-4 pt-4 pb-5 relative">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Clickable Avatar + Greeting "Olá, ANDERSON" opening Menu do Avatar */}
          <div className="relative min-w-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer rounded-[4px] p-1 -m-1 hover:bg-white/10 transition-colors"
              title="Abrir Menu do Usuário (Meu Perfil e Gerador de Palpites)"
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

            {/* Dropdown Menu do Avatar */}
            {avatarMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white rounded-[4px] shadow-xl border border-[#D5E0EC] text-[#1E293B] z-50 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-[#F7F9FC] border-b border-[#E2E8F0]">
                  <p className="text-xs font-bold text-[#1E293B] truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-[#5F6C7B] truncate">
                    {currentUser.jobTitle} · {currentUser.companyName}
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
                      <span className="block font-bold">Meu Perfil</span>
                      <span className="block text-[10px] text-[#5F6C7B] font-normal">
                        Dados cadastrais, CPF e Chave Pix
                      </span>
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
                    <span>Sair / Trocar Usuário</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Date/Time Clock + Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right bg-white/15 backdrop-blur-xs border border-white/25 px-2.5 py-1 rounded-[4px]">
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-white/90">
                <Clock className="w-3 h-3 text-white" />
                <span className="font-mono-tabular">{formattedDate}</span>
              </div>
              <div className="font-mono-tabular font-bold text-xs text-white tracking-tight">
                {formattedTime}
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              title="Trocar Usuário / Sair"
              className="h-10 px-2.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white rounded-[4px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-white" />
              <span className="text-[9px] font-bold">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Gentle Rounded Transition Sheet Top + Two Fronts Switcher (Lado Usuário vs Lado Empresa) */}
      <div className="-mt-2 bg-[#F7F9FC] rounded-t-[4px] px-4 pt-2.5 pb-2 border-b border-[#EDF2F7]">
        <div className="grid grid-cols-3 gap-1.5 w-full">
          <button
            type="button"
            onClick={() => onChangeRole('COLLABORATOR')}
            className={`min-h-[30px] px-2 py-1 text-[10px] font-bold rounded-[4px] flex items-center justify-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
              userRole === 'COLLABORATOR'
                ? 'bg-[#005CA9] text-white shadow-xs'
                : 'bg-white text-[#5F6C7B] border border-[#E2E8F0] hover:text-[#005CA9]'
            }`}
          >
            <UserCheck className="w-3 h-3 shrink-0" />
            <span>Lado Usuário</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeRole('MANAGER')}
            className={`min-h-[30px] px-2 py-1 text-[10px] font-bold rounded-[4px] flex items-center justify-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
              userRole === 'MANAGER'
                ? 'bg-[#008B47] text-white shadow-xs'
                : 'bg-white text-[#5F6C7B] border border-[#E2E8F0] hover:text-[#008B47]'
            }`}
          >
            <EyeOff className="w-3 h-3 shrink-0" />
            <span>Lado Empresa</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeRole('SUPER_ADMIN')}
            className={`min-h-[30px] px-2 py-1 text-[10px] font-bold rounded-[4px] flex items-center justify-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
              userRole === 'SUPER_ADMIN'
                ? 'bg-[#333E48] text-white shadow-xs'
                : 'bg-white text-[#5F6C7B] border border-[#E2E8F0] hover:text-[#333E48]'
            }`}
          >
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>Admin Split</span>
          </button>
        </div>
      </div>
    </header>
  );
};
