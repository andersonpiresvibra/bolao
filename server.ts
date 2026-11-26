import express from 'express';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { handleApiRequest } from './server/apiHandler.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Read raw body for /api/* up to 5MB and forward to shared Web-standard API handler
  app.use('/api', express.raw({ type: '*/*', limit: '5mb' }), async (req, res) => {
    try {
      const safePath = req.originalUrl.startsWith('/') ? req.originalUrl : `/${req.originalUrl}`;
      const fullUrl = new URL(safePath, `http://127.0.0.1:${PORT}`).toString();
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }

      const method = req.method.toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const rawBody =
        hasBody && Buffer.isBuffer(req.body) && req.body.length > 0
          ? new Uint8Array(req.body)
          : undefined;

      const webRequest = new Request(fullUrl, {
        method,
        headers,
        body: rawBody,
      });

      const webResponse = await handleApiRequest(webRequest);
      res.status(webResponse.status);
      webResponse.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });
      const buf = Buffer.from(await webResponse.arrayBuffer());
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Erro interno no servidor.' });
    }
  });

  app.use('/api', (err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({ error: 'Payload excede o limite de 5 MB.' });
    }
    return next(err);
  });

  const distPath = path.join(process.cwd(), 'dist');
  const distStatic = express.static(distPath);

  if (process.env.NODE_ENV !== 'production') {
    let viteInstance: any = null;
    const vitePromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          plugins: [
            {
              name: 'disable-hmr-client-ws',
              enforce: 'post',
              transform(code, id) {
                if (id.includes('vite/dist/client/client.mjs')) {
                  return code.replace(
                    /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
                    'const transport = normalizeModuleRunnerTransport({ async connect() {}, async disconnect() {}, send() {} });'
                  );
                }
                return null;
              },
            },
          ],
          server: { middlewareMode: true, hmr: false, ws: false },
          appType: 'spa',
        })
      )
      .then((v) => {
        viteInstance = v;
        return v;
      });

    app.use(async (req, res, next) => {
      try {
        if (viteInstance) {
          return viteInstance.middlewares(req, res, next);
        }
        const vite = await Promise.race([
          vitePromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (vite) {
          return vite.middlewares(req, res, next);
        }
        if (fs.existsSync(path.join(distPath, 'index.html'))) {
          return distStatic(req, res, () => {
            res.sendFile(path.join(distPath, 'index.html'));
          });
        }
        const fullVite = await vitePromise;
        return fullVite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(distStatic);
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
  });
}

startServer();
