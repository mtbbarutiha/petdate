/**
 * Origin nginx keeps Flexible SSL for www and only forces HTTPS on apex HTTP.
 * Run: npx tsx packages/web/src/lib/wcdnNginx.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const conf = readFileSync(join(root, 'infra/nginx/petdate.conf'), 'utf8');
const doc = readFileSync(join(root, 'docs/infra/wcdn.md'), 'utf8');

assert.match(conf, /\$apex_http_redirect/, 'apex HTTP→HTTPS flag exists');
assert.match(conf, /\$http_x_forwarded_proto = https/, 'skips Flexible pulls with proto https');
assert.match(conf, /\$http_wcdn_edge/, 'skips WCDN-Edge origin pulls');
assert.match(conf, /X-PetDate-API/, 'API responses marked for CDN passthrough');
assert.match(
  conf,
  /location = \/api\/auth\/avatar \{/,
  'exact /api/auth/avatar upload location (no trailing-slash 301)'
);
{
  const exactCount = (conf.match(/location = \/api\/auth\/avatar \{/g) || []).length;
  assert.equal(exactCount, 2, `exact avatar upload location once per server (got ${exactCount})`);
}

assert.match(
  conf,
  /location \^~ \/api\/auth\/avatar\//,
  'stored avatar files still served under /api/auth/avatar/'
);
assert.match(doc, /نمایش خطای سرور مقصد/, 'documents ParsPack origin-error passthrough');
assert.match(
  doc,
  /trailing-slash|\/api\/auth\/avatar/,
  'documents avatar upload trailing-slash trap'
);
assert.match(doc, /Flexible SSL/, 'documents Flexible SSL constraint');
assert.match(doc, /http:\/\/petdate\.ir/, 'documents apex HTTP check');
assert.match(doc, /apiErrorMessage/, 'documents SPA HTML→Persian error mapping');
assert.doesNotMatch(
  conf,
  /if \(\$host = www\.petdate\.ir\) \{\s*return 301 https/,
  'www is not origin-forced to HTTPS'
);

// /pets/:id SPA deep links (medical tab) must not hard-404 under the stock-photo prefix.
assert.match(conf, /location \^~ \/pets\//, '/pets/ location exists');
assert.match(
  conf,
  /location \^~ \/pets\/ \{[\s\S]*?try_files \$uri \/index\.html;/,
  '/pets/ falls back to index.html for SPA routes like /pets/35?tab=medical'
);
assert.doesNotMatch(
  conf,
  /location \^~ \/pets\/ \{\s*add_header[\s\S]*?try_files \$uri =404;/,
  '/pets/ must not try_files =404 alone (broke mobile medical deep links)'
);
assert.match(
  conf,
  /location \^~ \/pets\/ \{[\s\S]*?location ~\* \\\.\(\?:jpg\|jpeg\|png/,
  '/pets/*.jpg stock photos still served as static files'
);

console.log('wcdnNginx.selftest: ok');
