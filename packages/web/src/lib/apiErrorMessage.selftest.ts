/**
 * www WCDN HTML error bodies must never become raw JSON.parse exceptions in UI.
 * Run: npx tsx packages/web/src/lib/apiErrorMessage.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  apiErrorMessageFromBody,
  apiStatusFallbackMessage,
  looksLikeHtmlBody,
  parseApiJsonBody,
} from './apiErrorMessage';

const wcdn403 = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head><title>Upstream Error - Forbidden</title></head>
<body><h1>Upstream Error</h1></body></html>`;

assert.equal(looksLikeHtmlBody(wcdn403), true);
assert.equal(looksLikeHtmlBody('{"error":"دسترسی به پرونده نداری"}'), false);

assert.equal(apiStatusFallbackMessage(403), 'دسترسی به این بخش را نداری.');
assert.equal(
  apiErrorMessageFromBody(403, wcdn403),
  'دسترسی به این بخش را نداری.'
);
assert.equal(
  apiErrorMessageFromBody(403, '{"error":"دسترسی به پرونده نداری"}'),
  'دسترسی به پرونده نداری'
);
assert.equal(
  apiErrorMessageFromBody(401, '{"error":"viewerId الزامی است"}'),
  'viewerId الزامی است'
);

const htmlParsed = parseApiJsonBody(403, wcdn403);
assert.equal(htmlParsed.ok, false);
if (!htmlParsed.ok) {
  assert.equal(htmlParsed.message, 'دسترسی به این بخش را نداری.');
  assert.doesNotMatch(htmlParsed.message, /Unexpected token|DOCTYPE|valid JSON/i);
}

const okParsed = parseApiJsonBody<{ record: { petId: number } }>(
  200,
  '{"record":{"petId":38},"entries":[],"prescriptions":[]}'
);
assert.equal(okParsed.ok, true);
if (okParsed.ok) assert.equal(okParsed.data.record.petId, 38);

const jsonErr = parseApiJsonBody(404, '{"error":"پت پیدا نشد"}');
assert.equal(jsonErr.ok, false);
if (!jsonErr.ok) assert.equal(jsonErr.message, 'پت پیدا نشد');

// Success-looking HTML (CDN mishap) must not throw raw SyntaxError message
const html200 = parseApiJsonBody(200, '<!DOCTYPE html><html></html>');
assert.equal(html200.ok, false);
if (!html200.ok) {
  assert.doesNotMatch(html200.message, /Unexpected token|is not valid JSON/i);
}

console.log('apiErrorMessage.selftest: ok');
