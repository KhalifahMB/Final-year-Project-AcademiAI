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
      includeAssets: [
        'favicon-32.png',
        'favicon-192.png',
        'pwa-192.png',
        'pwa-512.png',
        'icons.svg',
      ],
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
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            url: '/dashboard',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'AI tutor',
            short_name: 'Chat',
            url: '/chat',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'Resources',
            short_name: 'Resources',
            url: '/resources',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'Notes',
            short_name: 'Notes',
            url: '/notes',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,woff,woff2,webp}',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/academiai-resources/'),
            method: 'GET',
            handler: 'CacheFirst',
            options: {
              cacheName: 'object-storage',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
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
  optimizeDeps: {
    // omni-doc-viewer and @napi-rs/canvas are EXCLUDED: omni-doc-viewer ships
    // a ready ESM build and the canvas package is a native Skia binary that can
    // never be pre-bundled. But the engine's own sub-graph (pptx-preview ->
    // lodash/jszip/tslib/echarts/uuid) uses NAMED imports from CJS packages;
    // exclusion pulls those raw from node_modules, and the browser can't do
    // CJS->ESM named-export interop ("does not provide an export named 'get'").
    // Include just those CJS leaves so esbuild rewrites them to ESM.
    include: [
      'jszip',
      'lodash',
      'tslib',
      'echarts',
      'uuid',
    ],
    exclude: [
      'omni-doc-viewer',
      '@napi-rs/canvas',
      '@napi-rs/canvas-win32-x64-msvc',
    ],
  },
  build: {
    // ADDED: Tell the production bundler to ignore compiling these server-side binary files
    rollupOptions: {
      external: [
        'omni-doc-viewer',
        '@napi-rs/canvas',
        '@napi-rs/canvas-win32-x64-msvc',
      ],
    },
  },
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
