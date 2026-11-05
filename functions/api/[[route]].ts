import { processApiRequest } from '../../src/utils/cloudflareApi';

export const onRequest = async (context: { request: Request }) => {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(request.url);
  let body: any = {};

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const result = await processApiRequest(request.method, url.pathname, body);

  return new Response(JSON.stringify(result.data), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
