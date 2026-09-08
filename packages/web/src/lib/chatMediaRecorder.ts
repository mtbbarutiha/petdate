/** Browser MediaRecorder helpers for in-chat voice / video (playmate + vet). */

export const MAX_VOICE_SECONDS = 5 * 60;
export const MAX_VIDEO_SECONDS = 60;

const VOICE_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

export function pickRecorderMime(kind: 'audio' | 'video'): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  const list = kind === 'audio' ? VOICE_MIME_CANDIDATES : VIDEO_MIME_CANDIDATES;
  return list.find((m) => MediaRecorder.isTypeSupported(m));
}

export function extensionForMime(mime: string, kind: 'audio' | 'video'): string {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) {
    return kind === 'audio' ? 'm4a' : 'mp4';
  }
  if (m.includes('opus')) return 'ogg';
  return kind === 'audio' ? 'webm' : 'webm';
}

export function formatCaptureDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export function mediaPermissionErrorMessage(err: unknown, kind: 'audio' | 'video'): string {
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name?: string }).name)
      : '';
  const msg =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  if (name === 'NotAllowedError' || /permission|denied|اجازه/i.test(msg)) {
    return kind === 'audio'
      ? 'دسترسی به میکروفون رد شد. از تنظیمات مرورگر اجازه بده و دوباره امتحان کن.'
      : 'دسترسی به دوربین یا میکروفون رد شد. از تنظیمات مرورگر اجازه بده و دوباره امتحان کن.';
  }
  if (name === 'NotFoundError' || /not found|no device|device/i.test(msg)) {
    return kind === 'audio'
      ? 'میکروفونی پیدا نشد. دستگاه صوتی را وصل کن و دوباره امتحان کن.'
      : 'دوربین یا میکروفونی پیدا نشد. دستگاه را وصل کن و دوباره امتحان کن.';
  }
  if (name === 'NotReadableError' || /in use|busy|track/i.test(msg)) {
    return kind === 'audio'
      ? 'میکروفون در دسترس نیست (شاید برنامه دیگری از آن استفاده می‌کند).'
      : 'دوربین در دسترس نیست (شاید برنامه دیگری از آن استفاده می‌کند).';
  }
  if (
    name === 'SecurityError' ||
    /secure|https|getUserMedia/i.test(msg) ||
    (typeof window !== 'undefined' && !window.isSecureContext)
  ) {
    return 'ضبط رسانه فقط روی اتصال امن (HTTPS) ممکن است.';
  }
  if (typeof MediaRecorder === 'undefined') {
    return 'مرورگر شما از ضبط رسانه پشتیبانی نمی‌کند.';
  }
  return kind === 'audio'
    ? 'شروع ضبط صدا ناموفق بود. دوباره امتحان کن.'
    : 'شروع ضبط ویدیو ناموفق بود. دوباره امتحان کن.';
}

export function buildCaptureFile(
  blob: Blob,
  kind: 'voice' | 'video',
  mimeHint?: string,
): File {
  const mime = (blob.type || mimeHint || (kind === 'voice' ? 'audio/webm' : 'video/webm')).split(
    ';',
  )[0];
  const ext = extensionForMime(mime, kind === 'voice' ? 'audio' : 'video');
  const prefix = kind === 'voice' ? 'voice' : 'video';
  const name = `${prefix}-${Date.now()}.${ext}`;
  return new File([blob], name, { type: mime, lastModified: Date.now() });
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
}
