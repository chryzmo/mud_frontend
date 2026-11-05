import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the client connects to /ws on the Vite server, which proxies to the
// Go server. In production, Caddy serves the build and proxies /ws the same way.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
      },
    },
  },
});
