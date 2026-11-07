/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the client connects to /ws on the Vite server, which proxies to the
// Go server. In production, Caddy serves the build and proxies /ws the same way.
// MUD_PROXY_TARGET points the proxy at another server (the end-to-end tests use one
// on its own port, so they do not collide with a dev server on 8080).
const proxy = {
  '/api': { target: process.env.MUD_API_TARGET ?? 'http://127.0.0.1:8080' },
  '/ws': {
    target: process.env.MUD_PROXY_TARGET ?? 'ws://127.0.0.1:8080',
    ws: true,
  },
};

export default defineConfig({
  plugins: [react()],
  // The leaderboard is its own small page (leaderboard.html), served at /leaderboard.html.
  build: { rollupOptions: { input: { main: 'index.html', leaderboard: 'leaderboard.html' } } },
  server: {
    port: 3000,
    proxy,
  },
  preview: { proxy },
  test: {
    exclude: ['**/node_modules/**', 'e2e/**', 'smoke/**'], // Playwright runs those
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
