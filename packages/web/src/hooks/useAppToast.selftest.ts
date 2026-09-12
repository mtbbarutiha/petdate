/**
 * Shared AppToast card redesign — API + a11y + tokens + call-site compatibility.
 * Run: npx tsx packages/web/src/hooks/useAppToast.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitToastCopy } from '../lib/toastCopy.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const webSrc = join(dir, '..');
const hook = readFileSync(join(dir, 'useAppToast.tsx'), 'utf8');
const css = readFileSync(join(webSrc, 'styles/global.css'), 'utf8');
const pepito = readFileSync(join(webSrc, 'styles/pepito.css'), 'utf8');
const dark = readFileSync(join(webSrc, 'styles/theme-dark.css'), 'utf8');
const app = readFileSync(join(webSrc, 'App.tsx'), 'utf8');
const dock = readFileSync(join(webSrc, 'components/LandingMobileDock.tsx'), 'utf8');
const petDetail = readFileSync(join(webSrc, 'pages/PetDetailPage.tsx'), 'utf8');
const publicPet = readFileSync(join(webSrc, 'pages/PublicPetPage.tsx'), 'utf8');
const ci = readFileSync(join(webSrc, '../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(hook, /export type AppToastTone = 'info' \| 'success' \| 'error' \| 'warning'/, 'warning tone is first-class');
assert.match(hook, /toastSuccess:/, 'toastSuccess API');
assert.match(hook, /toastError:/, 'toastError API');
assert.match(hook, /toastInfo:/, 'toastInfo API');
assert.match(hook, /toastWarning:/, 'toastWarning API');
assert.match(hook, /dismissToast:/, 'dismissToast API');
assert.match(hook, /showToast:/, 'showToast API');
assert.match(hook, /durationMs\?:/, 'duration option kept');
assert.match(hook, /title\?:/, 'optional title');
assert.match(hook, /action\?:/, 'optional action');
assert.match(hook, /role=\{toast\.tone === 'error' \? 'alert' : 'status'\}/, 'error uses alert, others status');
assert.match(hook, /aria-live=\{toast\.tone === 'error' \? 'assertive' : 'polite'\}/, 'live region polarity');
assert.match(hook, /aria-atomic="true"/, 'atomic announcement');
assert.match(hook, /createPortal/, 'portals to body so layout transforms cannot clip');
assert.match(hook, /prefers-reduced-motion/, 'exit respects reduced motion');
assert.match(hook, /common\.close/, 'close label is i18n');
assert.match(hook, /from '\.\.\/lib\/toastCopy'/, 'copy helper is shared');
assert.match(hook, /className=\{`toast toast--\$\{toast\.tone\}/, 'shared toast BEM classes');
assert.match(hook, /toast__icon/, 'icon slot');
assert.match(hook, /toast__title/, 'title slot');
assert.match(hook, /toast__body/, 'body slot');
assert.match(hook, /toast__close/, 'dismiss control');
assert.match(hook, /toast__action/, 'optional action');
assert.match(app, /AppToastProvider/, 'app still mounts the shared provider');
assert.doesNotMatch(hook, /direction:\s*['"]rtl['"]/, 'does not force RTL on the card');

assert.deepEqual(splitToastCopy('خاطره ثبت شد'), { title: 'خاطره ثبت شد' });
assert.deepEqual(splitToastCopy('رسید ثبت شد — پس از تأیید ادمین سکه واریز می‌شود.'), {
  title: 'رسید ثبت شد',
  body: 'پس از تأیید ادمین سکه واریز می‌شود.',
});
assert.deepEqual(splitToastCopy('متن بدنه', 'عنوان'), { title: 'عنوان', body: 'متن بدنه' });
assert.deepEqual(splitToastCopy('line one\nline two'), { title: 'line one', body: 'line two' });

assert.match(css, /--toast-max:\s*420px/, 'max-width token');
assert.match(css, /--toast-success:/, 'success token');
assert.match(css, /--toast-error:/, 'error token');
assert.match(css, /--toast-warning:/, 'warning token');
assert.match(css, /--toast-info:/, 'info token');
assert.match(css, /\.toast-host\s*\{/, 'positioning host');
assert.match(css, /\.toast--success/, 'success variant');
assert.match(css, /\.toast--error/, 'error variant');
assert.match(css, /\.toast--warning/, 'warning variant');
assert.match(css, /\.toast--info/, 'info variant');
assert.match(css, /toast__icon[\s\S]{0,180}border-radius:\s*999px/, 'icon sits in a soft circle');
assert.match(css, /pepito-mobile-dock-clearance/, 'clears the mobile dock');
assert.match(css, /prefers-reduced-motion/, 'CSS reduced-motion');
assert.match(css, /@keyframes toastIn/, 'enter motion');
assert.match(css, /@keyframes toastOut/, 'exit motion');
assert.match(
  css,
  /@media \(min-width: 860px\)[\s\S]{0,280}\.toast-host[\s\S]{0,180}top:/,
  'desktop sits top-center'
);
assert.doesNotMatch(
  css,
  /\.toast\s*\{[\s\S]{0,400}background:\s*#0f3d2e/,
  'success is no longer a flat emerald pill'
);

assert.match(pepito, /--toast-success:\s*var\(--pepito-mint\)/, 'pepito mint success token');
assert.match(dark, /html\[data-theme='dark'\][\s\S]*--toast-bg:/, 'dark theme remaps toast surface');
assert.match(dark, /--toast-success:/, 'dark success token');
assert.match(dark, /--toast-error:/, 'dark error token');
assert.match(dark, /--toast-warning:/, 'dark warning token');

assert.match(petDetail, /toastSuccess\('خاطره ثبت شد'\)/, 'owner diary still uses shared success toast');
assert.match(publicPet, /toastSuccess\('خاطره ثبت شد'\)/, 'public diary still uses shared success toast');
assert.match(dock, /useAppToast/, 'mobile dock uses the shared toast bus');
assert.doesNotMatch(dock, /pepito-dock-role-toast/, 'dock no longer has a one-off pill toast');
assert.match(ci, /useAppToast\.selftest\.ts/, 'CI runs this selftest');

console.log('useAppToast.selftest: ok');
