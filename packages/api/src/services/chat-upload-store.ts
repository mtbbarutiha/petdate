import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Telegram sendVoice expects OGG/Opus; keep bitrate close to native voice notes. */
const VOICE_OPUS_BITRATE = '48k';

/** Local chat media lives next to the SQLite database. */
export function chatUploadsRoot(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  // Match db.ts: absolute DATABASE_PATH wins; else packages/api/data (this file is in services/).
  const dbFile =
    raw && path.isAbsolute(raw)
      ? raw
      : path.join(__dirname, '..', '..', 'data', 'petdate.db');
  return path.join(path.dirname(dbFile), 'chat-uploads');
}

export function ensureChatUploadsRoot(): string {
  const root = chatUploadsRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Safe relative key: `{folderId}/{uuid}{ext}` — never absolute or with `..`. */
export function buildStorageKey(folderId: string | number, originalName: string): string {
  const folder = String(folderId).replace(/[^\w.~-]/gi, '');
  if (!folder) throw new Error('INVALID_FOLDER_ID');
  const ext = path.extname(originalName || '').slice(0, 16).replace(/[^\w.~-]/gi, '');
  return `${folder}/${randomUUID()}${ext}`;
}

export function resolveStoragePath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) return null;
  const root = ensureChatUploadsRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return null;
  }
  return abs;
}

export function saveChatUpload(opts: {
  /** Playdate numeric id, or string like `vet-{consultId}`. */
  folderId: string | number;
  /** @deprecated use folderId — kept for call-site clarity in playdate routes */
  playdateId?: number;
  originalName: string;
  buffer: Buffer;
}): { storageKey: string; absolutePath: string } {
  if (opts.buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  const folderId = opts.folderId ?? opts.playdateId;
  if (folderId == null) throw new Error('INVALID_FOLDER_ID');
  const storageKey = buildStorageKey(folderId, opts.originalName);
  const abs = resolveStoragePath(storageKey);
  if (!abs) throw new Error('INVALID_STORAGE_KEY');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, opts.buffer);
  return { storageKey, absolutePath: abs };
}

export function deleteChatUpload(storageKey: string | null | undefined): void {
  if (!storageKey) return;
  const abs = resolveStoragePath(storageKey);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
}

/** Remove an entire chat-upload folder (e.g. playdate id or `vet-{consultId}`). */
export function purgeChatUploadFolder(folderId: string | number): void {
  const folder = String(folderId).replace(/[^\w.~-]/gi, '');
  if (!folder || folder.includes('..')) return;
  const root = ensureChatUploadsRoot();
  const abs = path.resolve(root, folder);
  if (!abs.startsWith(path.resolve(root) + path.sep)) return;
  try {
    if (fs.existsSync(abs)) fs.rmSync(abs, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function sniffImageKind(
  buffer: Buffer,
  mimeType: string | undefined,
  fileName: string | undefined
): boolean {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(name)) return true;
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (brand.startsWith('heic') || brand.startsWith('heif') || brand.startsWith('mif1')) return true;
  }
  return false;
}

export function inferMediaKind(
  mimeType: string | undefined,
  fileName: string | undefined
): 'photo' | 'video' | 'voice' | 'audio' | 'document' {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  const base = path.basename(name);
  if (
    mime.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(name)
  ) {
    return 'photo';
  }
  // Voice before video: MediaRecorder often uses .webm for both audio and video.
  if (
    mime === 'audio/ogg' ||
    mime === 'audio/opus' ||
    name.endsWith('.ogg') ||
    name.endsWith('.opus') ||
    (mime.startsWith('audio/') && /^voice[-_]/i.test(base)) ||
    (/^voice[-_]/i.test(base) && (name.endsWith('.webm') || name.endsWith('.m4a')))
  ) {
    return 'voice';
  }
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)$/i.test(name)) {
    return 'video';
  }
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

/** True when buffer already looks like an Ogg container (OggS magic). */
export function sniffOggContainer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS';
}

/**
 * Voice-like uploads that should become Telegram-native voice notes (OGG/Opus).
 * Matches inferMediaKind voice rules without treating arbitrary mp3 songs as voice.
 */
export function isVoiceUploadCandidate(
  mimeType: string | undefined,
  fileName: string | undefined
): boolean {
  return inferMediaKind(mimeType, fileName) === 'voice';
}

export function isOggOpusVoice(
  mimeType: string | undefined,
  fileName: string | undefined,
  buffer?: Buffer
): boolean {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (mime === 'audio/ogg' || mime === 'audio/opus' || name.endsWith('.ogg') || name.endsWith('.opus')) {
    return true;
  }
  if (buffer && sniffOggContainer(buffer)) return true;
  return false;
}

function ffmpegBinary(): string {
  const fromEnv = (process.env.FFMPEG_PATH || '').trim();
  return fromEnv || 'ffmpeg';
}

/**
 * Convert browser MediaRecorder audio (webm/opus, m4a/aac, …) to OGG/Opus
 * so Telegram `sendVoice` shows an in-chat voice bubble.
 */
export async function convertVoiceBufferToOggOpus(opts: {
  buffer: Buffer;
  originalName?: string;
}): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
  const originalName = opts.originalName || 'voice.webm';
  const base = path.basename(originalName).replace(/\.[^.]+$/, '') || 'voice';
  const inExt = path.extname(originalName).replace(/[^\w.~-]/gi, '') || '.webm';
  const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'petdate-voice-'));
  const inPath = path.join(tmpRoot, `in${inExt.startsWith('.') ? inExt : `.${inExt}`}`);
  const outPath = path.join(tmpRoot, 'out.ogg');

  try {
    await fs.promises.writeFile(inPath, opts.buffer);
    await execFileAsync(
      ffmpegBinary(),
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inPath,
        '-vn',
        '-ac',
        '1',
        '-c:a',
        'libopus',
        '-b:a',
        VOICE_OPUS_BITRATE,
        outPath,
      ],
      { timeout: 90_000, maxBuffer: 2 * 1024 * 1024 }
    );
    const out = await fs.promises.readFile(outPath);
    if (!out.length) throw new Error('EMPTY_OGG');
    if (out.length > MAX_UPLOAD_BYTES) throw new Error('FILE_TOO_LARGE');
    if (!sniffOggContainer(out)) throw new Error('NOT_OGG');
    return {
      buffer: out,
      mimeType: 'audio/ogg',
      originalName: `${base}.ogg`,
    };
  } finally {
    try {
      await fs.promises.rm(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Normalize chat photos to browser-safe JPEG (fixes iOS 16-bit PNG / HEIC that
 * upload fine but fail to render in <img> on Safari/Chrome).
 * Also normalize voice uploads to OGG/Opus for Telegram sendVoice + inline web play.
 */
export async function normalizeChatUploadFile(opts: {
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
}): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
  const mime = (opts.mimeType || '').toLowerCase() || 'application/octet-stream';
  const originalName = opts.originalName || 'file';
  const nameLower = originalName.toLowerCase();

  if (sniffImageKind(opts.buffer, mime, originalName)) {
    // Preserve animated GIF.
    if (mime === 'image/gif' || nameLower.endsWith('.gif')) {
      return {
        buffer: opts.buffer,
        mimeType: 'image/gif',
        originalName: nameLower.endsWith('.gif') ? originalName : `${originalName}.gif`,
      };
    }

    try {
      const out = await sharp(opts.buffer, { failOn: 'none', animated: false })
        .rotate()
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      if (!out.length) throw new Error('EMPTY_JPEG');
      if (out.length > MAX_UPLOAD_BYTES) throw new Error('FILE_TOO_LARGE');
      const base = originalName.replace(/\.[^.]+$/, '') || 'photo';
      return {
        buffer: out,
        mimeType: 'image/jpeg',
        originalName: `${base}.jpg`,
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') throw err;
      // Fall back to original bytes (document/other may have been mis-sniffed).
      console.warn('chat image normalize failed:', (err as Error).message);
      return {
        buffer: opts.buffer,
        mimeType: mime.startsWith('image/') ? mime : 'application/octet-stream',
        originalName,
      };
    }
  }

  if (isVoiceUploadCandidate(mime, originalName)) {
    if (isOggOpusVoice(mime, originalName, opts.buffer)) {
      const base = originalName.replace(/\.[^.]+$/, '') || 'voice';
      return {
        buffer: opts.buffer,
        mimeType: 'audio/ogg',
        originalName: nameLower.endsWith('.ogg') || nameLower.endsWith('.opus')
          ? originalName
          : `${base}.ogg`,
      };
    }
    try {
      return await convertVoiceBufferToOggOpus({
        buffer: opts.buffer,
        originalName,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') throw err;
      // Keep original so upload still works; Telegram notify may fall back to sendAudio.
      console.warn('chat voice → ogg/opus convert failed:', (err as Error).message);
      return { buffer: opts.buffer, mimeType: mime, originalName };
    }
  }

  return { buffer: opts.buffer, mimeType: mime, originalName };
}

export { MAX_UPLOAD_BYTES };
