import { useCallback, useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(authToken: string | null) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [vapidPersistent, setVapidPersistent] = useState(true);
  const [backgroundSyncSupported, setBackgroundSyncSupported] = useState(false);
  const [periodicSyncSupported, setPeriodicSyncSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncSubscriptionState = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setSupported(false);
      return;
    }

    setSupported(true);
    setPermission(Notification.permission);

    try {
      const reg = await navigator.serviceWorker.ready;
      setBackgroundSyncSupported('sync' in reg);
      setPeriodicSyncSupported('periodicSync' in reg);
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void syncSubscriptionState();
  }, [syncSubscriptionState, authToken]);

  const registerBackgroundSyncs = async (reg: ServiceWorkerRegistration) => {
    try {
      const syncMgr = (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
      if (syncMgr) {
        await syncMgr.register('sync-lottery-results');
      }
    } catch {
      // Browser may restrict sync without install
    }

    try {
      const periodicMgr = (
        reg as unknown as {
          periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
        }
      ).periodicSync;
      if (periodicMgr) {
        await periodicMgr.register('periodic-lottery-sync', {
          minInterval: 12 * 60 * 60 * 1000,
        });
      }
    } catch {
      // Periodic sync requires installed PWA permission in Chromium
    }
  };

  const subscribe = async (): Promise<boolean> => {
    setError(null);
    if (!supported) {
      setError('Este navegador não suporta notificações Push.');
      return false;
    }
    if (!authToken) {
      setError('Faça login para ativar as notificações.');
      return false;
    }

    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Permissão de notificação negada no navegador.');
        return false;
      }

      const keyResp = await fetch('/api/push/vapid-public-key');
      const keyData = await keyResp.json();
      if (!keyResp.ok || !keyData.publicKey) {
        throw new Error(keyData.error || 'Chave Push não disponível no servidor.');
      }
      setVapidPersistent(Boolean(keyData.persistent));

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        });
      }

      const saveResp = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      const saveData = await saveResp.json().catch(() => ({}));
      if (!saveResp.ok) {
        throw new Error(saveData.error || 'Não foi possível salvar a assinatura Push.');
      }

      await registerBackgroundSyncs(reg);
      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Erro ao ativar notificações.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) {
        await sub.unsubscribe();
      }
      if (authToken) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ endpoint }),
        });
      }
      setIsSubscribed(false);
    } catch (err: any) {
      setError(err?.message || 'Erro ao desativar notificações.');
    } finally {
      setBusy(false);
    }
  };

  const sendTestPush = async (): Promise<{ ok: boolean; message: string }> => {
    setError(null);
    if (!authToken) {
      return { ok: false, message: 'Faça login para testar notificações.' };
    }
    setBusy(true);
    try {
      const resp = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = data.error || 'Não foi possível enviar a notificação de teste.';
        setError(msg);
        return { ok: false, message: msg };
      }
      return {
        ok: true,
        message: data.message || 'Notificação enviada! Verifique a barra do seu dispositivo.',
      };
    } catch {
      return { ok: false, message: 'Falha de rede ao enviar teste.' };
    } finally {
      setBusy(false);
    }
  };

  return {
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
  };
}
