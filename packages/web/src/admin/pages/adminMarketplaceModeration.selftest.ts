/**
 * Admin docs/photo moderation queue must use a full-width review card grid
 * (not a narrow RTL-stuck list). Run:
 *   npx tsx packages/web/src/admin/pages/adminMarketplaceModeration.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = fs.readFileSync(path.join(here, 'AdminMarketplaceModerationPage.tsx'), 'utf8');
const adminCss = fs.readFileSync(path.resolve(here, '../../styles/admin.css'), 'utf8');
const darkCss = fs.readFileSync(path.resolve(here, '../../styles/theme-dark.css'), 'utf8');

assert.match(page, /admin-mod-grid/, 'review items render in admin-mod-grid');
assert.match(page, /admin-mod-card/, 'each queue item is an admin-mod-card');
assert.match(page, /data-testid="admin-mod-photo-grid"/, 'pet photo grid marked for QA');
assert.match(page, /admin-tab/, 'mode/filter tabs use admin-tab');
assert.match(page, /آرشیو تأییدشده/, 'archive mode preserved');
assert.match(page, /photo-moderation/, 'pet photo approve/reject API preserved');
assert.match(page, /avatar-moderation/, 'user avatar approve/reject API preserved');
assert.match(page, /vet-credential/, 'vet credential approve/reject API preserved');
assert.match(page, /provider-credential/, 'trainer credential approve/reject API preserved');
assert.match(page, /admin-btn--primary/, 'approve uses admin-btn--primary (not broken primary)');
assert.match(page, /admin-btn--danger/, 'reject uses admin-btn--danger with larger tap target');
assert.match(page, /pet-photos\/pending\?limit=100/, 'pet photo queue is paginated');
assert.match(page, /user-avatars\/pending\?limit=100/, 'avatar queue is paginated');
assert.match(page, /includeArchive/, 'archive credentials load lazily (not on every queue refresh)');
assert.match(page, /vet-credentials\/pending\?limit=100/, 'vet pending queue is paginated');
assert.doesNotMatch(page, /admin-list/, 'must not use narrow admin-list stack');
assert.doesNotMatch(page, /className=\{[^}]*admin-btn primary/, 'must not use broken admin-btn primary');
assert.doesNotMatch(page, /className="admin-btn primary"/, 'must not use broken admin-btn primary literal');

assert.match(adminCss, /\.admin-app \.admin-mod-grid/, 'moderation grid CSS present');
assert.match(
  adminCss,
  /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*360px\),\s*1fr\)\)/,
  'grid uses full content width auto-fill cards'
);
assert.match(adminCss, /\.admin-app \.admin-mod-card__thumb/, 'fixed thumb size (not tall free-height imgs)');
assert.match(adminCss, /object-fit:\s*cover/, 'thumbs crop with object-fit cover');
assert.match(adminCss, /min-height:\s*44px/, 'approve/reject have 44px tap targets');

assert.match(
  darkCss,
  /admin-mod-card/,
  'dark theme polish for moderation cards'
);

console.log('adminMarketplaceModeration.selftest: ok');
