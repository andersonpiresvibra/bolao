import worker, { type CloudflareWorkerEnv } from '../../worker.ts';

export async function onRequest(context: {
  request: Request;
  env: CloudflareWorkerEnv;
}): Promise<Response> {
  return worker.fetch(context.request, context.env);
}
