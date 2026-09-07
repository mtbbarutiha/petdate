/**
 * Phone identity merge: +989… / 09… / 989… must resolve to the same users row.
 * Run: npx tsx packages/api/src/services/phone-identity.selftest.ts
 */
import { normalizeIranMobile } from '@petdate/shared';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const want = '989933464480';
assert(normalizeIranMobile('+989933464480') === want, '+98 form');
assert(normalizeIranMobile('09933464480') === want, '09 form');
assert(normalizeIranMobile('989933464480') === want, '98 form');
assert(normalizeIranMobile('9933464480') === want, '9 form');

/** Candidates used by getUserByPhone — must include legacy + prefix rows. */
function phoneLookupCandidates(raw: string): string[] {
  const normalized = normalizeIranMobile(raw);
  const out = new Set<string>([raw.trim()]);
  if (normalized) {
    out.add(normalized);
    out.add(`+${normalized}`);
    if (normalized.startsWith('98') && normalized.length === 12) {
      out.add(`0${normalized.slice(2)}`);
    }
  }
  return [...out];
}

const c = phoneLookupCandidates('989933464480');
assert(c.includes('989933464480'), 'canonical');
assert(c.includes('+989933464480'), 'plus variant');
assert(c.includes('09933464480'), 'local 09');

console.log('phone-identity.selftest: ok');
