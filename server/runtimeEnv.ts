export const ALLOWED_RUNTIME_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'ASAAS_API_URL',
  'ASAAS_API_KEY',
  'ASAAS_PLATFORM_WALLET_ID',
  'ASAAS_WEBHOOK_TOKEN',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
] as const;

export type AllowedRuntimeEnvKey = (typeof ALLOWED_RUNTIME_ENV_KEYS)[number];

let activeWorkerEnv: Partial<Record<AllowedRuntimeEnvKey, string>> | null = null;

/**
 * Stores allowlisted environment variables from Cloudflare Workers / Pages `env`
 * directly in JS module state so server code never depends on a global `process.env`.
 */
export function setRuntimeEnv(env?: Record<string, unknown> | null): void {
  if (!env || typeof env !== 'object') return;
  const next: Partial<Record<AllowedRuntimeEnvKey, string>> = {};
  for (const key of ALLOWED_RUNTIME_ENV_KEYS) {
    const raw = env[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      next[key] = raw.trim();
    }
  }
  activeWorkerEnv = next;

  // Also mirror into process.env when available & writable (best-effort for Node libs)
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    if (proc && proc.env) {
      for (const key of ALLOWED_RUNTIME_ENV_KEYS) {
        if (next[key]) {
          proc.env[key] = next[key];
        }
      }
    }
  } catch {
    // process.env may be frozen/read-only in edge runtimes — activeWorkerEnv is primary
  }
}

export function clearRuntimeEnv(): void {
  activeWorkerEnv = null;
}

export function getRuntimeKind(): 'cloudflare-worker' | 'node' {
  return activeWorkerEnv !== null ? 'cloudflare-worker' : 'node';
}

export function getEnv(key: AllowedRuntimeEnvKey): string {
  const fromWorker = activeWorkerEnv?.[key];
  if (fromWorker && fromWorker.length > 0) {
    return fromWorker;
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    const fromProcess = proc?.env?.[key];
    if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
      return fromProcess.trim();
    }
  } catch {
    // Ignore if global process is unavailable
  }
  return '';
}
