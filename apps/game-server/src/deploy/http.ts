import type { IncomingMessage, ServerResponse } from 'node:http';

import { pullImage, createContainer, startContainer } from './docker-socket.ts';

const IMAGE = 'hjmin0218/bhc';
const CONTAINER_NAME = 'bhc-game-server';
const PORT_BINDING = '9211';
const CONTAINER_PORT = '9900';

function sendJson(res: ServerResponse, status: number, body: object): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

export function createDeployRequestHandler(): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const secret = process.env['DEPLOY_SECRET'] ?? '';

  return async (req, res) => {
    if (req.method === 'GET' && req.url === '/deploy/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && req.url === '/deploy') {
      const auth = req.headers['authorization'] ?? '';
      if (!secret || auth !== `Bearer ${secret}`) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      const body = await readBody(req);
      let tag = 'latest';
      try {
        const parsed = JSON.parse(body || '{}') as { tag?: unknown };
        if (parsed.tag) tag = String(parsed.tag);
      } catch { /* use default */ }

      if (!/^[a-zA-Z0-9._-]+$/.test(tag)) {
        sendJson(res, 400, { error: 'Invalid tag format' });
        return;
      }

      const fullImage = `${IMAGE}:${tag}`;
      const replacerName = `bhc-replacer-${Date.now()}`;

      try {
        console.log(`[deploy] Pulling ${fullImage}`);
        await pullImage(IMAGE, tag);

        const deploySecret = process.env['DEPLOY_SECRET'] ?? '';
        const cmd = [
          'sh', '-c',
          `sleep 2 && docker stop ${CONTAINER_NAME} && docker rm ${CONTAINER_NAME} && docker run -d --name ${CONTAINER_NAME} -p ${PORT_BINDING}:${CONTAINER_PORT} -v /var/run/docker.sock:/var/run/docker.sock -e DEPLOY_SECRET=${deploySecret} --restart unless-stopped ${fullImage}`,
        ];

        console.log(`[deploy] Creating replacer container: ${replacerName}`);
        await createContainer(replacerName, {
          Image: fullImage,
          Cmd: cmd,
          HostConfig: {
            Binds: ['/var/run/docker.sock:/var/run/docker.sock'],
            AutoRemove: true,
          },
        });

        await startContainer(replacerName);
        console.log(`[deploy] Replacer started, game server will restart shortly`);

        sendJson(res, 200, { ok: true, message: 'deploying...', tag });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[deploy] Error: ${message}`);
        sendJson(res, 500, { ok: false, error: message });
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  };
}
