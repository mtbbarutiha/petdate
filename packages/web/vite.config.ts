import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { applySeoToHtml, normalizePath } from './src/lib/pageSeo';

/** Inject per-route meta into the SPA shell (dev/preview + the built home HTML). */
function petdateSeoHtml(): Plugin {
  return {
    name: 'petdate-seo-html',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const raw = (ctx.originalUrl || ctx.path || '/').split('?')[0];
        const route = raw.replace(/\/?index\.html$/, '') || '/';
        return applySeoToHtml(html, normalizePath(route));
      },
    },
  };
}

/** Serve local seed HTML in `vite` only — never copied into production dist. */
function serveDevSeedHtml(): Plugin {
  const seedsDir = path.resolve(__dirname, 'dev-seeds');
  const names = new Set(['/dev-seed.html', '/panels-seed.html', '/diary-book-preview.html']);
  return {
    name: 'petdate-dev-seeds',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!names.has(url)) {
          next();
          return;
        }
        const file = path.join(seedsDir, path.basename(url));
        if (!fs.existsSync(file)) {
          next();
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(fs.readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@petdate/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  plugins: [
    serveDevSeedHtml(),
    petdateSeoHtml(),
    react(),
    VitePWA({
      // prompt — autoUpdate+skipWaiting was full-reloading open tabs (e.g. /chats)
      // whenever a new deploy raced the service worker.
      // Registration is handled in src/lib/swRegister.ts so we can force-activate
      // a waiting worker once and clear stale precaches (phones stuck on 1.5s polls).
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        // One-shot migration: activate this SW immediately so tabs stuck on the
        // pre-prompt bundle (1.5s /chats polls) finally pick up the new assets.
        // Subsequent deploys can flip this back to false — swRegister already
        // marks a bust generation so we do not loop-reload.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // New cache namespace so stuck clients drop the old 1.5s-poll bundle.
        // Bump when guest marketing routes change — v14 left #213's shell unclaimed.
        cacheId: 'petdate-web-v18-lighthouse',
        // Precache only the app shell — not hundreds of prerendered SEO HTML files.
        globPatterns: ['index.html', 'offline.html', '**/*.{js,css,ico,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      includeAssets: [
        'favicon.ico',
        'favicon.png',
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192.png',
        'pwa-512.png',
        'pwa-512-maskable.png',
        'pepito/img/logo.png',
        'logo.svg',
        'logotype.svg',
        'robots.txt',
        'sitemap.xml',
        'llms.txt',
        'llms-full.txt',
        'offline.html',
        'registerSW.js',
        'manifest.json',
      ],
      manifest: {
        name: 'پت‌دیت | PetDate',
        // iOS/Android home-screen label — English; keep Persian in page UI titles only.
        short_name: 'petdate',
        description:
          'پت‌دیت (PetDate) پلتفرم فارسی پیدا کردن همبازی برای پت، پت‌شاپ، پذیرش پت و مشاوره دامپزشک.',
        theme_color: '#5c4d91',
        background_color: '#f4f4f7',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'fa',
        dir: 'rtl',
        start_url: '/',
        id: '/',
        scope: '/',
        categories: ['lifestyle', 'social'],
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5180,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    // Hidden source maps for large first-party bundles (Lighthouse Best Practices).
    // Files stay in dist as *.js.map; nginx already serves /assets/ with long cache.
    sourcemap: true,
    modulePreload: {
      resolveDependencies(filename, deps) {
        // vendor-lucide is in the landing graph, but Chrome + the SW treat the
        // modulepreload as a "cross-world" unused preload (console + wasted bytes).
        // The module still loads via its static import — we just skip the hint.
        void filename;
        return deps.filter((dep) => !dep.includes('vendor-lucide'));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
          }
          // Do not force /src/admin into a shared chunk — that made Vite
          // modulepreload ~400KB of admin on every landing-page visit.
        },
      },
    },
  },
});
