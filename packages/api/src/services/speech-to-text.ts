/**
 * Speech-to-text for AI consult / support voice notes.
 * Uses OpenAI-compatible Whisper (`POST /audio/transcriptions`).
 *
 * Env (same keys as chat completions):
 *   AI_CONSULT_API_KEY / OPENAI_API_KEY
 *   AI_CONSULT_BASE_URL / OPENAI_BASE_URL
 *   AI_CONSULT_STT_MODEL / OPENAI_STT_MODEL  (default whisper-1)
 */

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'not_configured' | 'empty' | 'http_error' | 'network' };

function envKey(): string {
  return String(process.env.AI_CONSULT_API_KEY || process.env.OPENAI_API_KEY || '').trim();
}

function envBaseUrl(): string {
  const raw = String(
    process.env.AI_CONSULT_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  ).trim();
  return raw.replace(/\/$/, '');
}

function envSttModel(): string {
  return String(
    process.env.AI_CONSULT_STT_MODEL || process.env.OPENAI_STT_MODEL || 'whisper-1'
  ).trim();
}

export function isSpeechToTextConfigured(): boolean {
  return Boolean(envKey());
}

/** Polite Persian fallback when STT is unavailable. */
export const STT_UNAVAILABLE_FA =
  'ویس‌ات رسید، ولی الان نمی‌تونم صوت رو به متن تبدیل کنم. لطفاً سؤالت رو تایپ کن تا جواب بدم.';

export async function transcribeAudio(opts: {
  buffer: Buffer;
  filename?: string;
  mimeType?: string;
  /** BCP-47 / ISO-639-1 hint; default fa for PetDate. */
  language?: string;
}): Promise<TranscribeResult> {
  const key = envKey();
  if (!key) return { ok: false, reason: 'not_configured' };
  if (!opts.buffer?.length) return { ok: false, reason: 'empty' };

  const filename = (opts.filename || 'voice.ogg').replace(/[^\w.~-]+/g, '_') || 'voice.ogg';
  const mimeType = opts.mimeType || guessMime(filename);
  const language = (opts.language || 'fa').trim() || 'fa';

  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(opts.buffer)], { type: mimeType }),
    filename
  );
  form.append('model', envSttModel());
  form.append('language', language);
  form.append('response_format', 'json');

  try {
    const res = await fetch(`${envBaseUrl()}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`speech-to-text HTTP ${res.status}: ${body.slice(0, 300)}`);
      return { ok: false, reason: 'http_error' };
    }
    const data = (await res.json()) as { text?: string };
    const text = String(data.text || '').trim();
    if (!text) return { ok: false, reason: 'empty' };
    return { ok: true, text: text.slice(0, 4000) };
  } catch (err) {
    console.warn('speech-to-text failed:', (err as Error).message);
    return { ok: false, reason: 'network' };
  }
}

function guessMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
}
