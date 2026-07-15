import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API base is injected at build time via VITE_API_BASE. In local dev we
// proxy /api to the local function server; on Catalyst the client and the
// function are served under the same project domain, so a relative /server
// path (API Gateway / function route) works without CORS.
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  build: { outDir: 'dist' },
});
