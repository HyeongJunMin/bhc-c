import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const API_PREFIXES = ['/health', '/auth/', '/api/', '/v1/', '/simulate', '/djemals'];

function isApiRequest(url: string): boolean {
  return API_PREFIXES.some((prefix) => url === prefix.trimEnd() || url.startsWith(prefix));
}

export async function serveStatic(staticDir: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? '/';
  const urlPath = url.split('?')[0];

  if (isApiRequest(urlPath)) {
    return false;
  }

  const filePath = path.join(staticDir, urlPath === '/' ? 'index.html' : urlPath);

  const exists = await fileExists(filePath);
  if (exists) {
    return streamFile(filePath, res);
  }

  // SPA fallback: serve index.html
  const indexPath = path.join(staticDir, 'index.html');
  const indexExists = await fileExists(indexPath);
  if (indexExists) {
    return streamFile(indexPath, res);
  }

  return false;
}

function fileExists(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    fs.stat(filePath, (err, stat) => {
      resolve(!err && stat.isFile());
    });
  });
}

function streamFile(filePath: string, res: ServerResponse): Promise<boolean> {
  return new Promise((resolve) => {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    res.setHeader('content-type', contentType);
    res.statusCode = 200;

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
      resolve(false);
    });
    stream.on('end', () => resolve(true));
    stream.pipe(res);
  });
}
