import React, { useState } from 'react';
import { Download, Share, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'darkHeader';
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        onInstalled?.();
      }
      return;
    }
    setShowGuideModal(true);
  };

  const buttonClasses =
    variant === 'darkHeader'
      ? 'h-8 px-2.5 rounded-[6px] bg-white/15 hover:bg-white/25 border border-white/25 text-white font-display font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0'
      : variant === 'banner'
      ? 'w-full min-h-[40px] px-3 rounded-[6px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer'
      : 'h-9 px-2.5 rounded-[8px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-[#EBF4FC] hover:bg-[#DCEBFA] border border-[#BFDBFE] text-[#005CA9] shrink-0';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Instalar aplicativo na Tela de Início"
        className={buttonClasses}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-bold">
          {variant === 'banner' ? 'Instalar App (PWA)' : 'Instalar'}
        </span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-[380px] bg-white rounded-[10px] shadow-2xl border border-[#E2E8F0] overflow-hidden text-xs">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <h3 className="font-display font-bold text-sm">
                  Instalar Aplicativo (PWA)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-7 h-7 rounded-[4px] bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-[#334155] leading-relaxed">
              {isInIframe && (
                <div className="p-2.5 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                  <strong>Importante:</strong> navegadores não exibem o botão nativo de instalação dentro de uma janela embutida (preview). Abra o link direto do app no Chrome ou Safari do celular para instalar com 1 toque.
                </div>
              )}

              {isIOS ? (
                <div className="space-y-2">
                  <p className="font-bold text-[#0F172A]">
                    No iPhone / iPad (Safari):
                  </p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px]">
                    <li>
                      Toque no botão{' '}
                      <strong className="inline-flex items-center gap-0.5 text-[#005CA9]">
                        <Share className="w-3 h-3" /> Compartilhar
                      </strong>{' '}
                      na barra do Safari.
                    </li>
                    <li>
                      Role para baixo e toque em{' '}
                      <strong>Adicionar à Tela de Início</strong>.
                    </li>
                    <li>
                      Abra o app pelo ícone instalado para habilitar também as{' '}
                      <strong>notificações Push</strong> no iOS.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-bold text-[#0F172A]">
                    No Android (Chrome / Edge) ou Desktop:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px]">
                    <li>
                      Abra o aplicativo diretamente na aba principal do navegador (fora de iframe).
                    </li>
                    <li>
                      Toque no menu <strong>⋮</strong> do navegador e escolha{' '}
                      <strong>Instalar aplicativo</strong> ou{' '}
                      <strong>Adicionar à tela inicial</strong>.
                    </li>
                  </ol>
                </div>
              )}

              <div className="p-2.5 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-[#008B47]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Benefícios do App Instalado</span>
                </div>
                <p className="text-[#475569]">
                  Abertura em tela cheia sem barra do navegador, cache offline de resultados da Caixa e recebimento de notificações Push em segundo plano.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full h-10 rounded-[6px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
