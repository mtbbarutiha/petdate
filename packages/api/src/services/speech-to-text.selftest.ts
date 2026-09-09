/**
 * Speech-to-text helpers — no network / no real API key.
 * Run: cd packages/api && npx tsx src/services/speech-to-text.selftest.ts
 */
export {};

delete process.env.AI_CONSULT_API_KEY;
delete process.env.OPENAI_API_KEY;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    isSpeechToTextConfigured,
    transcribeAudio,
    STT_UNAVAILABLE_FA,
  } = await import('./speech-to-text');

  assert(!isSpeechToTextConfigured(), 'STT off without key');
  assert(/تایپ/.test(STT_UNAVAILABLE_FA), 'fallback asks to type');

  const missing = await transcribeAudio({ buffer: Buffer.from('x') });
  assert(!missing.ok && missing.reason === 'not_configured', 'refuse without key');

  process.env.AI_CONSULT_API_KEY = 'test-key-not-used';
  assert(isSpeechToTextConfigured(), 'STT on with key');

  const empty = await transcribeAudio({ buffer: Buffer.alloc(0) });
  assert(!empty.ok && empty.reason === 'empty', 'empty buffer');

  // Invalid key → network/http failure, must not throw
  const bad = await transcribeAudio({
    buffer: Buffer.from('not-really-audio'),
    filename: 'voice.ogg',
    mimeType: 'audio/ogg',
  });
  assert(!bad.ok, 'bad key fails soft');
  assert(bad.reason === 'http_error' || bad.reason === 'network', 'soft fail reason');

  delete process.env.AI_CONSULT_API_KEY;
  console.log('speech-to-text.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
