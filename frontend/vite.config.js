import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const attachRootRedirect = (server) => {
  server.middlewares.use((req, res, next) => {
    const url = req.url || '/';
    const [pathname, query] = url.split('?');
    const qs = query ? `?${query}` : '';
    if (pathname === '/' || pathname === '') {
      res.statusCode = 302;
      res.setHeader('Location', `/crm/${qs}`);
      return res.end();
    }
    if (pathname === '/login' || pathname === '/login/') {
      res.statusCode = 302;
      res.setHeader('Location', `/crm/login${qs}`);
      return res.end();
    }
    next();
  });
};

const crmRootRedirectPlugin = () => ({
  name: 'crm-root-redirect',
  configureServer: attachRootRedirect,
  configurePreviewServer: attachRootRedirect,
});

export default defineConfig({
  plugins: [react(), crmRootRedirectPlugin()],
  base: '/crm/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
