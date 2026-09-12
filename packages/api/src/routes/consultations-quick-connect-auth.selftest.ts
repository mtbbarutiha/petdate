/**
 * Unauthenticated POST /quick-connect must not debit arbitrary patientUserId.
 * Run: npx tsx src/routes/consultations-quick-connect-auth.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/routes/consultations.ts'), 'utf8');

assert.match(src, /isInternalBot/, 'consultations uses bot-token helper');
const start = src.indexOf("consultationsRouter.post('/quick-connect'");
assert.ok(start >= 0, 'quick-connect route exists');
const slice = src.slice(start, start + 1800);
assert.match(slice, /status\(401\)/, 'quick-connect rejects guests');
assert.match(slice, /session\?\.user\?\.id \?\? \(bot \? bodyPatientId/, 'body patient id only for bot');

console.log('consultations-quick-connect-auth.selftest: ok');
