import sharp from 'sharp';

/** Shared image sniff + JPEG normalize for profile/pet uploads. */

export const IMAGE_NORMALIZE_MAX_EDGE = 1280;
export const IMAGE_NORMALIZE_JPEG_QUALITY = 82;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
  'image/x-ms-bmp',
  'application/octet-stream',
]);

export function sniffImageBuffer(
  buffer: Buffer,
  mimeType?: string,
  fileName?: string
): boolean {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (ALLOWED_MIME.has(mime) && mime !== 'application/octet-stream') return true;
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(name)) return true;
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return true;
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (brand.startsWith('heic') || brand.startsWith('heif') || brand.startsWith('mif1') || brand.startsWith('msf1')) {
      return true;
    }
  }
  return false;
}

export function isAllowedUploadImageMime(mimeType: string | undefined, fileName?: string, buffer?: Buffer): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || ALLOWED_MIME.has(mime)) {
    if (buffer) return sniffImageBuffer(buffer, mimeType, fileName);
    return true;
  }
  if (buffer) return sniffImageBuffer(buffer, mimeType, fileName);
  if (fileName && /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(fileName)) return true;
  return false;
}

/**
 * Normalize uploads to browser-safe JPEG (fixes HEIC / odd PNG / huge camera files).
 * Animated GIF is preserved as-is.
 */
export async function normalizeProfileImage(opts: {
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
  maxBytes: number;
  maxEdge?: number;
}): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
  const mime = (opts.mimeType || '').toLowerCase();
  const originalName = opts.originalName || 'photo.jpg';
  const nameLower = originalName.toLowerCase();

  if (!isAllowedUploadImageMime(opts.mimeType, originalName, opts.buffer)) {
    throw new Error('INVALID_MIME');
  }
  if (opts.buffer.length > opts.maxBytes) {
    throw new Error('FILE_TOO_LARGE');
  }

  // Preserve animated GIF.
  if (mime === 'image/gif' || nameLower.endsWith('.gif')) {
    if (opts.buffer.length > opts.maxBytes) throw new Error('FILE_TOO_LARGE');
    return {
      buffer: opts.buffer,
      mimeType: 'image/gif',
      originalName: nameLower.endsWith('.gif') ? originalName : `${originalName}.gif`,
    };
  }

  try {
    const maxEdge = opts.maxEdge ?? IMAGE_NORMALIZE_MAX_EDGE;
    const out = await sharp(opts.buffer, { failOn: 'none', animated: false })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: IMAGE_NORMALIZE_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    if (!out.length) throw new Error('EMPTY_JPEG');
    if (out.length > opts.maxBytes) throw new Error('FILE_TOO_LARGE');
    const base = originalName.replace(/\.[^.]+$/, '') || 'photo';
    return {
      buffer: out,
      mimeType: 'image/jpeg',
      originalName: `${base}.jpg`,
    };
  } catch (err) {
    if (err instanceof Error && (err.message === 'FILE_TOO_LARGE' || err.message === 'INVALID_MIME')) {
      throw err;
    }
    throw new Error('INVALID_IMAGE');
  }
}

export function persianUploadError(code: string): string {
  switch (code) {
    case 'FILE_TOO_LARGE':
      return 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)';
    case 'INVALID_MIME':
      return 'فقط عکس مجاز است (JPG، PNG، WebP، HEIC، GIF)';
    case 'INVALID_IMAGE':
      return 'فایل عکس قابل پردازش نیست. یک عکس دیگر انتخاب کن';
    case 'INVALID_STORAGE_KEY':
      return 'ذخیره عکس ناموفق بود';
    default:
      return 'ذخیره عکس ناموفق بود';
  }
}
