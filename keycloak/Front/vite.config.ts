import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'keycloak-js': 'keycloak-js/dist/keycloak',
      },
    },
    server: {
      port: parseInt(env.PORT || '5173'),
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: env.VITE_API_URL,
          ws: true,
          changeOrigin: true,
          secure: false,
          rewriteWsOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('[Vite Proxy] WebSocket error:', {
                error: err.message,
                timestamp: new Date().toISOString(),
              });
            });
            proxy.on('proxyReqWs', (proxyReq, req) => {
              if (req.headers.cookie) {
                proxyReq.setHeader('Cookie', req.headers.cookie);
              }
              proxyReq.setHeader('origin', env.VITE_API_URL || 'http://localhost:5000');
            });
            proxy.on('open', () => {
              console.log('[Vite Proxy] WebSocket connection opened:', {
                timestamp: new Date().toISOString(),
              });
            });
          },
        },
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
  };
});
