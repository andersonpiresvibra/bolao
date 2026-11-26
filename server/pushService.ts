import * as webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export interface StoredPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let cachedVapid: {
  publicKey: string;
  privateKey: string;
  subject: string;
  persistent: boolean;
} | null = null;
const memorySubscriptions = new Map<string, StoredPushSubscription[]>();

function getVapidConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
  persistent: boolean;
} {
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:contato@bolao.app';

  if (envPub && envPriv) {
    if (
      cachedVapid &&
      cachedVapid.persistent &&
      cachedVapid.publicKey === envPub &&
      cachedVapid.privateKey === envPriv &&
      cachedVapid.subject === subject
    ) {
      return cachedVapid;
    }
    webpush.setVapidDetails(subject, envPub, envPriv);
    cachedVapid = { publicKey: envPub, privateKey: envPriv, subject, persistent: true };
    return cachedVapid;
  }

  if (cachedVapid) return cachedVapid;

  // Generate ephemeral VAPID keys in memory so Push works immediately in preview
  const generated = webpush.generateVAPIDKeys();
  webpush.setVapidDetails(subject, generated.publicKey, generated.privateKey);
  cachedVapid = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
    persistent: false,
  };
  return cachedVapid;
}

export function getPublicVapidInfo(): { publicKey: string; persistent: boolean } {
  const cfg = getVapidConfig();
  return { publicKey: cfg.publicKey, persistent: cfg.persistent };
}

function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getSupabaseAdminOptional() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function savePushSubscription(
  userId: string,
  sub: StoredPushSubscription,
  userAgent?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: 'Inscrição Push incompleta.' };
  }
  if (!isValidPushEndpoint(sub.endpoint)) {
    return { ok: false, error: 'Endpoint de notificação inválido.' };
  }

  // Store in memory map immediately
  const existing = memorySubscriptions.get(userId) || [];
  const filtered = existing.filter((s) => s.endpoint !== sub.endpoint);
  filtered.push({
    endpoint: sub.endpoint,
    keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
  });
  memorySubscriptions.set(userId, filtered);

  // Also persist in Supabase push_subscriptions table if migrated
  const sb = getSupabaseAdminOptional();
  if (sb) {
    try {
      await sb.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: String(sub.keys.p256dh),
          auth_key: String(sub.keys.auth),
          user_agent: (userAgent || '').slice(0, 240),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );
    } catch {
      // Optional table not yet created; memory store still active
    }
  }

  return { ok: true };
}

export async function removePushSubscription(
  userId: string,
  endpoint?: string
): Promise<void> {
  if (endpoint) {
    const existing = memorySubscriptions.get(userId) || [];
    memorySubscriptions.set(
      userId,
      existing.filter((s) => s.endpoint !== endpoint)
    );
  } else {
    memorySubscriptions.delete(userId);
  }

  const sb = getSupabaseAdminOptional();
  if (sb) {
    try {
      if (endpoint) {
        await sb
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
      } else {
        await sb.from('push_subscriptions').delete().eq('user_id', userId);
      }
    } catch {
      // Ignore if optional table not migrated
    }
  }
}

async function listUserSubscriptions(userId: string): Promise<StoredPushSubscription[]> {
  const byEndpoint = new Map<string, StoredPushSubscription>();

  for (const s of memorySubscriptions.get(userId) || []) {
    byEndpoint.set(s.endpoint, s);
  }

  const sb = getSupabaseAdminOptional();
  if (sb) {
    try {
      const { data } = await sb
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth_key')
        .eq('user_id', userId);
      for (const row of data || []) {
        if (row.endpoint && row.p256dh && row.auth_key) {
          byEndpoint.set(row.endpoint, {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth_key },
          });
        }
      }
    } catch {
      // Optional table not migrated yet
    }
  }

  return Array.from(byEndpoint.values());
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const vapid = getVapidConfig();
  const subs = await listUserSubscriptions(userId);
  if (subs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const bodyStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    tag: payload.tag || 'bolao-alert',
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      if (!isValidPushEndpoint(sub.endpoint)) {
        failed += 1;
        await removePushSubscription(userId, sub.endpoint);
        return;
      }
      try {
        const details = webpush.generateRequestDetails(sub, bodyStr, {
          TTL: 3600,
          vapidDetails: {
            subject: vapid.subject,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
        });

        const headers = new Headers();
        for (const [k, v] of Object.entries(details.headers || {})) {
          if (k.toLowerCase() === 'content-length') continue;
          if (v !== undefined && v !== null) {
            headers.set(k, String(v));
          }
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const resp = await fetch(details.endpoint, {
            method: details.method || 'POST',
            headers,
            body: details.body ? new Uint8Array(details.body) : undefined,
            signal: controller.signal,
          });
          if (resp.ok || resp.status === 201 || resp.status === 202) {
            sent += 1;
          } else {
            failed += 1;
            if (resp.status === 404 || resp.status === 410) {
              await removePushSubscription(userId, sub.endpoint);
            }
          }
        } finally {
          clearTimeout(timer);
        }
      } catch {
        failed += 1;
      }
    })
  );

  return { sent, failed };
}
