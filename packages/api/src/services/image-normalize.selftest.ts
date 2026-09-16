import assert from 'assert';
import sharp from 'sharp';
import {
  isAllowedUploadImageMime,
  normalizeProfileImage,
  persianUploadError,
  sniffImageBuffer,
} from './image-normalize';

async function main() {
  const jpeg = await sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 20, g: 120, b: 80 } },
  })
    .jpeg()
    .toBuffer();

  assert.equal(sniffImageBuffer(jpeg, 'image/jpeg', 'a.jpg'), true);
  assert.equal(sniffImageBuffer(jpeg, 'application/octet-stream', 'photo.bin'), true);
  assert.equal(isAllowedUploadImageMime('application/octet-stream', 'x.jpg', jpeg), true);
  assert.equal(isAllowedUploadImageMime('text/plain', 'x.txt', Buffer.from('hi')), false);

  const normalized = await normalizeProfileImage({
    buffer: jpeg,
    mimeType: 'application/octet-stream',
    originalName: 'camera-photo',
    maxBytes: 8 * 1024 * 1024,
    maxEdge: 256,
  });
  assert.equal(normalized.mimeType, 'image/webp');
  assert.match(normalized.originalName, /\.webp$/i);
  assert.ok(normalized.buffer.length > 0);
  assert.ok(
    normalized.buffer.toString('ascii', 0, 4) === 'RIFF' &&
      normalized.buffer.toString('ascii', 8, 12) === 'WEBP'
  );

  const asJpeg = await normalizeProfileImage({
    buffer: jpeg,
    mimeType: 'image/jpeg',
    originalName: 'legacy.jpg',
    maxBytes: 8 * 1024 * 1024,
    maxEdge: 256,
    format: 'jpeg',
  });
  assert.equal(asJpeg.mimeType, 'image/jpeg');
  assert.ok(asJpeg.buffer[0] === 0xff && asJpeg.buffer[1] === 0xd8);

  assert.equal(persianUploadError('INVALID_MIME').includes('عکس'), true);
  assert.equal(persianUploadError('FILE_TOO_LARGE').includes('۸'), true);

  let threw = false;
  try {
    await normalizeProfileImage({
      buffer: Buffer.from('not-an-image'),
      mimeType: 'text/plain',
      originalName: 'x.txt',
      maxBytes: 1000,
    });
  } catch (err) {
    threw = true;
    assert.equal((err as Error).message, 'INVALID_MIME');
  }
  assert.ok(threw);

  console.log('image-normalize selftest ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
