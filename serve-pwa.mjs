/**
 * Servidor local para probar PWA / Service Worker / Push Notifications.
 *
 * Uso:
 *   1. npm run build                          (genera dist/nido-frontend/browser)
 *   2. node serve-pwa.mjs                     (sirve en http://localhost:4200)
 *
 * Requisitos: Node.js 18+. No necesita dependencias adicionales.
 *
 * - Sirve los archivos estáticos del build de producción (dist/nido-frontend/browser).
 * - Proxy transparente de /backend/* → http://localhost:8080/* (backend API).
 * - Fallback a index.html para rutas SPA (Angular routing).
 * - Cabeceras necesarias para Service Worker y CORS.
 */

import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, 'dist', 'nido-frontend', 'browser');
const PORT = 4200;
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

function proxyToBackend(req, res) {
  const targetPath = req.url.replace(/^\/backend/, '') || '/';

  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${BACKEND_HOST}:${BACKEND_PORT}`,
    },
  };

  const proxyReq = httpRequest(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy error]', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Backend unavailable');
  });

  req.pipe(proxyReq, { end: true });
}

async function serveStatic(req, res) {
  let urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = join(DIST_DIR, urlPath);
  let contentType;
  let fileContent;

  try {

    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');

    const ext = extname(filePath).toLowerCase();
    contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fileContent = await readFile(filePath);
  } catch {

    try {
      const indexPath = join(DIST_DIR, 'index.html');
      fileContent = await readFile(indexPath);
      contentType = 'text/html; charset=utf-8';
    } catch {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
  }


  const headers = { 'Content-Type': contentType };
  if (urlPath === '/ngsw-worker.js' || urlPath === '/ngsw.json') {
    headers['Cache-Control'] = 'no-cache';
    headers['Service-Worker-Allowed'] = '/';
  }

  res.writeHead(200, headers);
  res.end(fileContent);
}

const server = createServer((req, res) => {
  if (req.url.startsWith('/backend')) {
    proxyToBackend(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`\n  🏠 Nido PWA server running at http://localhost:${PORT}`);
  console.log(`  📦 Serving from: ${DIST_DIR}`);
  console.log(`  🔌 Backend proxy: /backend/* → http://${BACKEND_HOST}:${BACKEND_PORT}/*`);
  console.log(`  🔔 Service Worker / Push Notifications: ENABLED\n`);
});
