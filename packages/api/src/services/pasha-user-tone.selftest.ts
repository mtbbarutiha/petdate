/**
 * Run: cd packages/api && npx tsx src/services/pasha-user-tone.selftest.ts
 */
import {
  applyOfflineToneStyle,
  formatToneSystemInstruction,
  inferUserToneFromMessages,
  mergeUserTone,
  parseStoredTone,
  scoreUserMessageTone,
} from './pasha-user-tone';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const casual = inferUserToneFromMessages([
  'سلام داداش سگم خیلی پارس میکنه آخه 😂',
  'چیکار کنم تو خونه؟',
  'باشه مرسی',
]);
assert(casual.formality < 0.45, `casual formality got ${casual.formality}`);
assert(casual.colloquial > 0.3, `casual colloquial got ${casual.colloquial}`);
assert(casual.emoji > 0.2, `casual emoji got ${casual.emoji}`);

// Peak emoji must survive short follow-ups (no dilution)
const emojiPeak = inferUserToneFromMessages(['عالیه 😂🐕🎉', 'باشه', 'اوکی']);
assert(emojiPeak.emoji >= 0.65, `emoji peak preserved, got ${emojiPeak.emoji}`);

const formal = inferUserToneFromMessages([
  'با سلام، سگ بنده هنگام پیاده‌روی قلاده را می‌کشد. لطفاً راهنمایی بفرمایید.',
  'بسیار متشکرم از شما',
]);
assert(formal.formality > casual.formality, 'formal > casual');
assert(formal.formality >= 0.66, `formal band for offline rewrite, got ${formal.formality}`);

const merged = mergeUserTone(casual, formal, 0.5);
assert(merged.samples === casual.samples + formal.samples, 'samples accumulate');

const styled = applyOfflineToneStyle('ببین، تو باید آروم باشی.', formal);
assert(/شما/.test(styled), `formal rewrite uses شما, got: ${styled}`);
assert(!/\bتو\b|(?<![\u0600-\u06FF])تو(?![\u0600-\u06FF])/.test(styled), 'تو replaced');

const casualStyled = applyOfflineToneStyle('سلام شما خیلی خوبید', casual);
assert(/تو/.test(casualStyled), 'casual rewrite can use تو');

const instr = formatToneSystemInstruction(formal);
assert(/راهنمای لحن|رسمیت|شما|مودب/.test(instr), 'system instruction mentions formality');

const parsed = parseStoredTone(JSON.stringify(casual));
assert(parsed && parsed.formality === casual.formality, 'roundtrip');
assert(parseStoredTone('not-json') === null, 'bad json null');
assert(parseStoredTone('') === null, 'empty null');

const scored = scoreUserMessageTone('لطفاً شما بفرمایید');
assert(scored.formality > 0.6, `single formal score, got ${scored.formality}`);

console.log('pasha-user-tone.selftest: ok');
