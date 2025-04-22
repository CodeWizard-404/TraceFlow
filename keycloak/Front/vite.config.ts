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
<<<<<<< Updated upstream
        target: 'http://192.168.0.101:5000',
=======
        target: process.env.VITE_API_URL || 'http://localhost:5000',
>>>>>>> Stashed changes
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
<<<<<<< Updated upstream
        target: 'http://192.168.0.101:5000',
=======
        target: process.env.VITE_API_URL || 'http://localhost:5000',
>>>>>>> Stashed changes
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
});