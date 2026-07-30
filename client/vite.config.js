import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Dev server proxies API + WebSocket to the backend so cookies are same-origin.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  server: {
    // host:true binds to 0.0.0.0 so a phone/tablet on the same Wi-Fi can open
    // the app (and scan table QR codes) via the machine's LAN IP.
    host: true,
    port: 5173,
    proxy: {
      // Same-origin proxy → the phone hits <LAN-IP>:5173/api which forwards to
      // the API on this machine; no CORS/cookie issues.
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          query: ['@tanstack/react-query', 'axios'],
        },
      },
    },
  },
});
