import { handleApiRequest } from './server/apiHandler.ts';
import { setRuntimeEnv, type AllowedRuntimeEnvKey } from './server/runtimeEnv.ts';

interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export type CloudflareWorkerEnv = Partial<Record<AllowedRuntimeEnvKey, string>> & {
  ASSETS?: StaticAssetsBinding;
};

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
    setRuntimeEnv(env as Record<string, unknown>);

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApiRequest(request);
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            error: error?.message || 'Erro interno ao processar requisição na API.',
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          }
        );
      }
    }

    if (env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Static assets binding (ASSETS) não configurado.', { status: 404 });
  },
};
