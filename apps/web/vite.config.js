import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.LEGACY_API_PROXY || 'http://localhost:4000';

export default defineConfig(({ command }) => ({
  plugins: [react()],

  // أثناء التطوير المحلي نستخدم Vite proxy حتى تبقى الواجهة على نفس الأصل.
  // هذا يمنع مشكلة تحويل http://localhost:4000 إلى http://localhost فقط.
  define: command === 'serve'
    ? {
        'import.meta.env.VITE_API_URL': JSON.stringify(''),
      }
    : {},

  server: {
    host: '0.0.0.0',
    proxy: {
      '/auth': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/activity': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/internal': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/health': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
}));
