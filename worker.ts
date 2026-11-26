import { handleApiRequest } from './server/apiHandler.ts';

interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareWorkerEnv {
  ASSETS?: StaticAssetsBinding;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ASAAS_API_URL?: string;
  ASAAS_API_KEY?: string;
  ASAAS_PLATFORM_WALLET_ID?: string;
  ASAAS_WEBHOOK_TOKEN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

const ENV_ALLOWLIST: Array<Exclude<keyof CloudflareWorkerEnv, 'ASSETS'>> = [
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
];

function syncCloudflareEnv(env: CloudflareWorkerEnv): void {
  if (typeof process === 'undefined' || !process.env) return;
  for (const key of ENV_ALLOWLIST) {
    const val = env[key];
    if (typeof val === 'string' && val.length > 0) {
      process.env[key] = val;
    }
  }
}

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
    syncCloudflareEnv(env);

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Static assets binding (ASSETS) não configurado.', { status: 404 });
  },
};
