const USER_AGENT = 'NidoApp/1.0 (giulianadiroccodev@gmail.com)';

function offHeaders(proxyReq) {
  proxyReq.removeHeader('origin');
  proxyReq.removeHeader('referer');
  proxyReq.setHeader('User-Agent', USER_AGENT);
}

export default {
  '/backend': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/backend': '' },
  },
  '/off-world': {
    target: 'https://world.openfoodfacts.org',
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/off-world': '' },
    onProxyReq: offHeaders,
  },
  '/off-ar': {
    target: 'https://ar.openfoodfacts.org',
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/off-ar': '' },
    onProxyReq: offHeaders,
  },
  '/off-upc': {
    target: 'https://api.upcitemdb.com',
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/off-upc': '' },
  },
};
