/**
 * Face-verify media store accepts short selfie videos (and still images).
 * Run: npx tsx packages/api/src/services/face-verify-media-store.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-face-verify-media-${process.pid}.db`;

async function main() {
  const assert = await import('node:assert/strict');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const {
    isFaceVerifyVideoMime,
    isAllowedFaceVerifyMime,
    saveFaceVerifyMedia,
    mimeFromFaceVerifyKey,
  } = await import('./face-verify-media-store');

  assert.equal(isFaceVerifyVideoMime('video/webm', 'clip.webm'), true);
  assert.equal(isFaceVerifyVideoMime('video/mp4', 'selfie.mp4'), true);
  assert.equal(isFaceVerifyVideoMime('image/jpeg', 'selfie.jpg'), false);
  assert.equal(isAllowedFaceVerifyMime('image/jpeg', 'selfie.jpg'), true);
  assert.equal(isAllowedFaceVerifyMime('application/pdf', 'x.pdf'), false);

  assert.equal(mimeFromFaceVerifyKey('9/abc.webm'), 'video/webm');
  assert.equal(mimeFromFaceVerifyKey('9/abc.mp4'), 'video/mp4');
  assert.equal(mimeFromFaceVerifyKey('9/abc.jpg'), 'image/jpeg');

  const webm = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f,
    0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04,
    0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42,
    0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02, 0x18, 0x53, 0x80, 0x67, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x15, 0x49, 0xa9, 0x66, 0x00,
  ]);

  const saved = await saveFaceVerifyMedia({
    userId: 42,
    originalName: 'selfie.webm',
    mimeType: 'video/webm',
    buffer: webm,
  });
  assert.equal(saved.kind, 'video');
  assert.match(saved.urlPath, /\/api\/auth\/avatar\/42\/.+\.webm$/);
  assert.ok(fs.existsSync(saved.absolutePath), 'video file written');
  assert.equal(fs.readFileSync(saved.absolutePath).length, webm.length);

  let rejected = false;
  try {
    await saveFaceVerifyMedia({
      userId: 42,
      originalName: 'x.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
  } catch (err) {
    rejected = (err as Error).message === 'INVALID_MIME';
  }
  assert.ok(rejected, 'rejects non image/video');

  const authRoutes = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes/auth.ts'),
    'utf8'
  );
  assert.match(authRoutes, /saveFaceVerifyMedia/, 'auth verification uses face-verify store');
  assert.match(authRoutes, /requireVideo:\s*true/, 'web requires video upload');
  assert.match(authRoutes, /no_profile_photo/, 'web surfaces missing profile photo');
  assert.match(authRoutes, /faceVerifyUpload/, 'uses larger multer limit for video');

  console.log('face-verify-media-store.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
