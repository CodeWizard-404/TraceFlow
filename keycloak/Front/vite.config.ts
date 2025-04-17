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
    proxy: {
      '/api': {
        target: 'http://192.168.0.100:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});