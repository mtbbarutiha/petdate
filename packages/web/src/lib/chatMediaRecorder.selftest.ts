import assert from 'assert';
import {
  extensionForMime,
  formatCaptureDuration,
  mediaPermissionErrorMessage,
} from './chatMediaRecorder';

assert.equal(formatCaptureDuration(0), '0:00');
assert.equal(formatCaptureDuration(65), '1:05');
assert.equal(extensionForMime('audio/webm;codecs=opus', 'audio'), 'webm');
assert.equal(extensionForMime('video/mp4', 'video'), 'mp4');
assert.equal(extensionForMime('audio/mp4', 'audio'), 'm4a');

const denied = mediaPermissionErrorMessage({ name: 'NotAllowedError' }, 'audio');
assert.match(denied, /میکروفون/);

const https = mediaPermissionErrorMessage({ name: 'SecurityError' }, 'video');
assert.match(https, /HTTPS|امن/);

console.log('chatMediaRecorder selftest ok');
