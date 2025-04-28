import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'keycloak-js': 'keycloak-js/dist/keycloak',
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://192.168.1.14:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://192.168.1.14:5000',
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
            // Ensure cookies are forwarded correctly
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
              console.log('[Vite Proxy] Forwarding cookies in WebSocket request:', {
                cookies: req.headers.cookie,
                timestamp: new Date().toISOString(),
              });
            } else {
              console.warn('[Vite Proxy] No cookies found in WebSocket request', {
                path: proxyReq.path,
                timestamp: new Date().toISOString(),
              });
            }
            // Set origin header to match target
            proxyReq.setHeader('origin', process.env.VITE_API_URL || 'http://192.168.1.14:5000');
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
});