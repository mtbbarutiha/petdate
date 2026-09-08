import assert from 'assert';
import {
  buildCaptureFile,
  extensionForMime,
  formatCaptureDuration,
  isOggOpusMime,
  mediaPermissionErrorMessage,
} from './chatMediaRecorder';

assert.equal(formatCaptureDuration(0), '0:00');
assert.equal(formatCaptureDuration(65), '1:05');
assert.equal(extensionForMime('audio/webm;codecs=opus', 'audio'), 'webm');
assert.equal(extensionForMime('audio/ogg;codecs=opus', 'audio'), 'ogg');
assert.equal(extensionForMime('video/mp4', 'video'), 'mp4');
assert.equal(extensionForMime('audio/mp4', 'audio'), 'm4a');
assert.equal(isOggOpusMime('audio/ogg;codecs=opus'), true);
assert.equal(isOggOpusMime('audio/webm;codecs=opus'), false);

const oggFile = buildCaptureFile(
  new Blob([Uint8Array.from([1, 2, 3])], { type: 'audio/ogg;codecs=opus' }),
  'voice',
  'audio/ogg;codecs=opus',
);
assert.match(oggFile.name, /^voice-\d+\.ogg$/);
assert.equal(oggFile.type, 'audio/ogg');

const denied = mediaPermissionErrorMessage({ name: 'NotAllowedError' }, 'audio');
assert.match(denied, /میکروفون/);

const https = mediaPermissionErrorMessage({ name: 'SecurityError' }, 'video');
assert.match(https, /HTTPS|امن/);

console.log('chatMediaRecorder selftest ok');
