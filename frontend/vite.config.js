import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon-32.png', 'favicon-192.png', 'pwa-192.png', 'pwa-512.png', 'icons.svg'],
      manifest: {
        name: 'AcademiAI — AI-powered academic assistance',
        short_name: 'AcademiAI',
        description:
          'Multi-tenant academic AI platform: grounded tutoring from your own course materials, auto-generated quizzes, cohort insight and progress tracking.',
        theme_color: '#1779e1',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Dashboard', short_name: 'Dashboard', url: '/dashboard', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'AI tutor',   short_name: 'Chat',      url: '/chat',      icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Resources',  short_name: 'Resources', url: '/resources', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Notes',      short_name: 'Notes',     url: '/notes',     icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,woff,woff2,webp}',
          '!design-variants/**',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Signed object-storage files (previews, images, PDFs, avatars).
            // CacheFirst: capped and expired to avoid bloat. Matches the
            // MinIO/S3 bucket path regardless of origin.
            urlPattern: ({ url }) => url.pathname.startsWith('/academiai-resources/'),
            method: 'GET',
            handler: 'CacheFirst',
            options: {
              cacheName: 'object-storage',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Public GETs (landing stats) only: caching authenticated /api/
            // responses in the service worker would serve one user's data to
            // the next person using a shared device. Auth traffic must stay
            // uncached — the browser HTTP cache already handles assets.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/public/'),
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 15 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/media': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    pool: 'forks',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
