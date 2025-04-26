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
          proxy.on('proxyReqWs', (proxyReq) => {
            console.debug('Proxying WebSocket request:', {
              path: proxyReq.path,
              headers: proxyReq.getHeaders(),
              timestamp: new Date().toISOString(),
            });
          });
          proxy.on('error', (err) => {
            console.error('WebSocket proxy error:', { error: err.message, timestamp: new Date().toISOString() });
          });
        },
      },
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
});