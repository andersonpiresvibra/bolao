import React, { useState } from 'react';
import { Bell, BellOff, BellRing, RefreshCw, Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface NotificationToggleButtonProps {
  authToken: string | null;
  onNotify?: (msg: string) => void;
}

export const NotificationToggleButton: React.FC<NotificationToggleButtonProps> = ({
  authToken,
  onNotify,
}) => {
  const [open, setOpen] = useState(false);
  const { isIOS, isInstalled } = usePWAInstall();
  const {
    supported,
    permission,
    isSubscribed,
    vapidPersistent,
    backgroundSyncSupported,
    periodicSyncSupported,
    busy,
    error,
    subscribe,
    unsubscribe,
    sendTestPush,
  } = usePushNotifications(authToken);

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      onNotify?.('Notificações Push desativadas neste dispositivo.');
    } else {
      const ok = await subscribe();
      if (ok) {
        onNotify?.('Notificações Push ativadas com sucesso!');
      }
    }
  };

  const handleTest = async () => {
    const res = await sendTestPush();
    onNotify?.(res.message);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={isSubscribed ? 'Notificações Push ativas' : 'Ativar notificações Push'}
        className={`relative h-9 w-9 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer border shrink-0 ${
          isSubscribed
            ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#008B47] hover:bg-[#DCFCE7]'
            : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9]'
        }`}
      >
        {isSubscribed ? (
          <BellRing className="w-4 h-4" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        {isSubscribed && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#008B47]" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-[390px] bg-white rounded-[10px] shadow-2xl border border-[#E2E8F0] overflow-hidden text-xs">
            <div className="caixa-header-gradient text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4" />
                <h3 className="font-display font-bold text-sm">
                  Notificações & Segundo Plano
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-[4px] bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-[#334155]">
              {isIOS && !isInstalled && (
                <div className="p-2.5 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    No iPhone/iPad (iOS 16.4+), instale primeiro o app pela opção{' '}
                    <strong>Compartilhar → Adicionar à Tela de Início</strong> e abra-o pelo ícone para habilitar Push.
                  </span>
                </div>
              )}

              {error && (
                <div className="p-2.5 rounded-[6px] bg-red-50 border border-red-200 text-red-900 font-semibold text-[11px]">
                  {error}
                </div>
              )}

              <div className="p-3 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F172A]">Alertas Push (Pix e Sorteios)</span>
                  <span
                    className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold ${
                      isSubscribed
                        ? 'bg-[#DCFCE7] text-[#008B47]'
                        : permission === 'denied'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-[#E2E8F0] text-[#475569]'
                    }`}
                  >
                    {isSubscribed
                      ? 'ATIVO'
                      : permission === 'denied'
                      ? 'BLOQUEADO'
                      : 'INATIVO'}
                  </span>
                </div>

                <p className="text-[11px] text-[#475569] leading-relaxed">
                  Receba avisos instantâneos mesmo com o app fechado quando seu pagamento Pix for confirmado ou houver atualização nos concursos.
                </p>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy || !supported || permission === 'denied'}
                    onClick={handleToggle}
                    className={`h-9 px-3 rounded-[6px] font-display font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                      isSubscribed
                        ? 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] border border-[#CBD5E1]'
                        : 'bg-[#008B47] hover:bg-[#00743B] text-white'
                    }`}
                  >
                    {isSubscribed ? (
                      <>
                        <BellOff className="w-3.5 h-3.5" />
                        <span>{busy ? 'Atualizando...' : 'Desativar Push'}</span>
                      </>
                    ) : (
                      <>
                        <BellRing className="w-3.5 h-3.5" />
                        <span>{busy ? 'Ativando...' : 'Ativar Notificações Push'}</span>
                      </>
                    )}
                  </button>

                  {isSubscribed && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleTest}
                      className="h-9 px-3 rounded-[6px] bg-[#EBF4FC] hover:bg-[#DCEBFA] text-[#005CA9] border border-[#BFDBFE] font-display font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar notificação de teste</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                  <RefreshCw className="w-3.5 h-3.5 text-[#005CA9]" />
                  <span>Execução em Segundo Plano & Offline</span>
                </div>
                <ul className="space-y-1 text-[#475569]">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#008B47] shrink-0" />
                    <span>Service Worker ativo para cache offline de resultados Caixa</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#008B47] shrink-0" />
                    <span>
                      Web Push em segundo plano: {supported ? 'Suportado' : 'Indisponível neste navegador'}
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#008B47] shrink-0" />
                    <span>
                      Background Sync:{' '}
                      {backgroundSyncSupported
                        ? periodicSyncSupported
                          ? 'Ativo (reconexão + periódico)'
                          : 'Ativo na reconexão'
                        : 'Sincronização automática ao reabrir o app'}
                    </span>
                  </li>
                </ul>
                {!vapidPersistent && isSubscribed && (
                  <p className="text-[10px] text-amber-800 pt-1">
                    Aviso: chaves VAPID temporárias em uso. Configure VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY nos Secrets para manter assinaturas após reinicializações.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full h-9 rounded-[6px] bg-[#005CA9] hover:bg-[#004A87] text-white font-display font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
