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

export type BrandThemeId =
  | 'PRATA_CLARA'
  | 'ACO_TITANIO'
  | 'GRAFITE_PRATA'
  | 'OBSIDIAN_OURO'
  | 'FLORESTA_OURO'
  | 'CARBONO_CORAL';

interface MobileHeaderProps {
  currentUser: SystemUser;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  onLogout: () => void;
  selectedCompanyName?: string;
  onOpenUserSection?: (topic: ModalTopic) => void;
  brandTheme?: BrandThemeId;
  onChangeBrandTheme?: (theme: BrandThemeId) => void;
  showThemeSwitcher?: boolean;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentUser,
  userRole,
  onChangeRole,
  onLogout,
  onOpenUserSection,
  brandTheme = 'GRAFITE_PRATA',
  onChangeBrandTheme,
  showThemeSwitcher = false,
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

  const isLightHeader = brandTheme === 'PRATA_CLARA';

  const themeMeta: Record<
    BrandThemeId,
    {
      avatarRing: string;
      menuBadge: string;
      accentHex: string;
      secondaryHex: string;
    }
  > = {
    PRATA_CLARA: {
      avatarRing: 'bg-white/80 border-[#94A3B8] text-[#0F172A]',
      menuBadge: 'bg-[#334155]/15 text-[#0F172A] border border-[#64748B]/40',
      accentHex: '#64748B',
      secondaryHex: '#94A3B8',
    },
    ACO_TITANIO: {
      avatarRing: 'bg-white/15 border-[#CBD5E1]/60 text-[#F8FAFC]',
      menuBadge: 'bg-white/15 text-[#F1F5F9] border border-[#CBD5E1]/40',
      accentHex: '#CBD5E1',
      secondaryHex: '#94A3B8',
    },
    GRAFITE_PRATA: {
      avatarRing: 'bg-[#94A3B8]/20 border-[#E2E8F0]/55 text-[#F8FAFC]',
      menuBadge: 'bg-[#94A3B8]/25 text-[#F1F5F9] border border-[#CBD5E1]/40',
      accentHex: '#94A3B8',
      secondaryHex: '#64748B',
    },
    OBSIDIAN_OURO: {
      avatarRing: 'bg-[#F59E0B]/20 border-[#F59E0B]/60 text-[#FDE68A]',
      menuBadge: 'bg-[#F59E0B]/25 text-[#FDE68A] border border-[#F59E0B]/40',
      accentHex: '#F59E0B',
      secondaryHex: '#38BDF8',
    },
    FLORESTA_OURO: {
      avatarRing: 'bg-[#FACC15]/20 border-[#FACC15]/60 text-[#FEF08A]',
      menuBadge: 'bg-[#FACC15]/25 text-[#FEF08A] border border-[#FACC15]/40',
      accentHex: '#FACC15',
      secondaryHex: '#34D399',
    },
    CARBONO_CORAL: {
      avatarRing: 'bg-[#F97316]/25 border-[#F97316]/65 text-[#FFEDD5]',
      menuBadge: 'bg-[#F97316]/25 text-[#FFEDD5] border border-[#F97316]/45',
      accentHex: '#F97316',
      secondaryHex: '#FB923C',
    },
  };

  const activeMeta = themeMeta[brandTheme] || themeMeta.GRAFITE_PRATA;

  return (
    <header className="sticky top-0 z-30">
      {/* Main Brand Header Banner */}
      <div
        className={`caixa-header-gradient px-4 pt-3.5 pb-4 relative overflow-hidden ${
          isLightHeader ? 'text-[#0F172A]' : 'text-white'
        }`}
      >
        {/* Arte Geométrica Prateada Exclusiva da Identidade Visual do App */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 430 110"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Brilho radial metálico */}
          <circle
            cx="375"
            cy="18"
            r="78"
            fill={isLightHeader ? '#FFFFFF' : activeMeta.accentHex}
            fillOpacity={isLightHeader ? '0.55' : '0.16'}
          />
          <circle
            cx="55"
            cy="98"
            r="64"
            fill={activeMeta.secondaryHex}
            fillOpacity={isLightHeader ? '0.18' : '0.12'}
          />
          {/* Linhas de aço escovado diagonais */}
          <path
            d="M250 -10 L340 120"
            stroke={isLightHeader ? '#64748B' : activeMeta.accentHex}
            strokeOpacity={isLightHeader ? '0.22' : '0.25'}
            strokeWidth="1.5"
          />
          <path
            d="M295 -10 L385 120"
            stroke="#FFFFFF"
            strokeOpacity={isLightHeader ? '0.65' : '0.12'}
            strokeWidth="1"
          />
          {/* Filete cromado na base do cabeçalho */}
          <line
            x1="0"
            y1="109"
            x2="430"
            y2="109"
            stroke={isLightHeader ? '#94A3B8' : activeMeta.accentHex}
            strokeOpacity="0.55"
            strokeWidth="2"
          />
        </svg>

        <div className="relative z-10 flex items-start justify-between gap-2">
          {/* Left: Clickable Avatar + Greeting */}
          <div className="relative min-w-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((prev) => !prev)}
              className={`flex items-center gap-2.5 min-w-0 text-left group cursor-pointer rounded-[8px] p-1 -m-1 transition-colors ${
                isLightHeader ? 'hover:bg-black/5' : 'hover:bg-white/10'
              }`}
              title="Abrir Menu do Usuário"
            >
              <div
                className={`w-10 h-10 backdrop-blur-xs border font-display font-extrabold text-xs flex items-center justify-center shrink-0 rounded-[10px] shadow-xs transition-colors ${activeMeta.avatarRing}`}
              >
                {currentUser.avatarInitials || 'US'}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-[11px] font-normal leading-tight flex items-center gap-1.5 ${
                    isLightHeader ? 'text-[#334155]' : 'text-white/90'
                  }`}
                >
                  <span>Olá,</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-[4px] font-semibold ${activeMeta.menuBadge}`}
                  >
                    Menu
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={`font-display font-extrabold text-base tracking-wide truncate ${
                      isLightHeader ? 'text-[#0F172A]' : 'text-white'
                    }`}
                  >
                    {firstName}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isLightHeader ? 'text-[#334155]' : 'text-white/90'
                    } ${avatarMenuOpen ? 'rotate-180' : ''}`}
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

          {/* Right: Sair */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onLogout}
              title="Sair"
              className={`h-9 px-3 rounded-[8px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isLightHeader
                  ? 'bg-white/75 hover:bg-white border border-[#94A3B8] text-[#0F172A]'
                  : 'bg-white/10 hover:bg-white/20 border border-white/25 text-white'
              }`}
            >
              <LogOut
                className={`w-3.5 h-3.5 ${
                  isLightHeader ? 'text-[#0F172A]' : 'text-white'
                }`}
              />
              <span className="text-xs font-bold">Sair</span>
            </button>
          </div>
        </div>

        {/* Barra Interativa de Teste de Temas (oculta por padrão, código preservado para uso futuro) */}
        {showThemeSwitcher && onChangeBrandTheme && (
          <div
            className={`relative z-10 mt-3 pt-2.5 border-t ${
              isLightHeader ? 'border-[#94A3B8]/40' : 'border-white/15'
            }`}
          >
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeBrandTheme('PRATA_CLARA')}
                className={`h-7 px-2 rounded-[6px] text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  brandTheme === 'PRATA_CLARA'
                    ? 'bg-white text-[#0F172A] shadow-xs ring-1 ring-[#64748B]'
                    : isLightHeader
                    ? 'bg-black/5 text-[#334155] hover:bg-black/10'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#F8FAFC] to-[#CBD5E1] border border-[#64748B] shrink-0" />
                <span>1. Prata Clara</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeBrandTheme('ACO_TITANIO')}
                className={`h-7 px-2 rounded-[6px] text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  brandTheme === 'ACO_TITANIO'
                    ? 'bg-[#E2E8F0] text-[#0F172A] shadow-xs ring-1 ring-white/60'
                    : isLightHeader
                    ? 'bg-black/5 text-[#334155] hover:bg-black/10'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#64748B] to-[#334155] border border-[#CBD5E1] shrink-0" />
                <span>2. Aço Titânio</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeBrandTheme('GRAFITE_PRATA')}
                className={`h-7 px-2 rounded-[6px] text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  brandTheme === 'GRAFITE_PRATA'
                    ? 'bg-[#CBD5E1] text-[#0F172A] shadow-xs ring-1 ring-white/60'
                    : isLightHeader
                    ? 'bg-black/5 text-[#334155] hover:bg-black/10'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#334155] to-[#1E293B] border border-[#94A3B8] shrink-0" />
                <span>3. Grafite Prata</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
