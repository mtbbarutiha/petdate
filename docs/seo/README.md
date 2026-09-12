# SEO — پت‌دیت

| فایل | محتوا |
|------|--------|
| `keyword-plan.md` | خوشه‌ها و کلمات دم‌بلند فارسی |
| `search-console.md` | ارسال sitemap و وضعیت GSC |

## در کد

- `packages/web/src/lib/pageSeo.ts` — title / description / canonical / JSON-LD / noscript per route
- `scripts/prerender-seo-html.ts` — writes `dist/{route}/index.html` so crawlers see distinct initial HTML
- `packages/web/public/sitemap.xml` — تولید با `scripts/generate-sitemap.ts`
- `packages/web/public/robots.txt`
- `packages/web/src/components/RouteSeo.tsx` — client navigation keeps the same helpers
- `packages/web/index.html` — homepage markers + Organization / WebSite (apex `sameAs` only)
