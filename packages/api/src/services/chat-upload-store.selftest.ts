import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  convertVoiceBufferToOggOpus,
  inferMediaKind,
  isOggOpusVoice,
  isVoiceUploadCandidate,
  normalizeChatUploadFile,
  sniffOggContainer,
} from './chat-upload-store';

function runInfer() {
  assert.equal(inferMediaKind('image/jpeg', 'a.jpg'), 'photo');
  assert.equal(inferMediaKind('video/webm', 'video-1.webm'), 'video');
  assert.equal(inferMediaKind('audio/ogg', 'note.ogg'), 'voice');
  assert.equal(inferMediaKind('audio/webm', 'voice-1710000000.webm'), 'voice');
  assert.equal(inferMediaKind('audio/mp4', 'voice-1710000000.m4a'), 'voice');
  assert.equal(inferMediaKind('audio/mpeg', 'song.mp3'), 'audio');
  assert.equal(inferMediaKind('application/pdf', 'rx.pdf'), 'document');

  assert.equal(isVoiceUploadCandidate('audio/webm', 'voice-1.webm'), true);
  assert.equal(isVoiceUploadCandidate('audio/mpeg', 'song.mp3'), false);
  assert.equal(isOggOpusVoice('audio/ogg', 'a.ogg'), true);
  assert.equal(isOggOpusVoice('audio/webm', 'voice-1.webm'), false);
  assert.equal(sniffOggContainer(Buffer.from('OggS....')), true);
  assert.equal(sniffOggContainer(Buffer.from('RIFF')), false);

  console.log('chat-upload-store inferMediaKind selftest ok');
}

async function runFfmpegVoiceConvertIfAvailable() {
  let ffmpegOk = false;
  try {
    execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], {
      stdio: 'ignore',
      timeout: 5000,
    });
    ffmpegOk = true;
  } catch {
    console.log('chat-upload-store voice convert selftest skipped (no ffmpeg)');
    return;
  }
  assert.ok(ffmpegOk);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-voice-st-'));
  const webmPath = path.join(tmp, 'voice-sample.webm');
  try {
    execFileSync(
      process.env.FFMPEG_PATH || 'ffmpeg',
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=48000:cl=mono',
        '-t',
        '0.4',
        '-c:a',
        'libopus',
        webmPath,
      ],
      { timeout: 30_000 }
    );
    const webm = fs.readFileSync(webmPath);
    assert.ok(webm.length > 0);

    const converted = await convertVoiceBufferToOggOpus({
      buffer: webm,
      originalName: 'voice-sample.webm',
    });
    assert.equal(converted.mimeType, 'audio/ogg');
    assert.match(converted.originalName, /\.ogg$/i);
    assert.ok(sniffOggContainer(converted.buffer));
    assert.equal(inferMediaKind(converted.mimeType, converted.originalName), 'voice');

    const normalized = await normalizeChatUploadFile({
      buffer: webm,
      mimeType: 'audio/webm',
      originalName: 'voice-1710000000.webm',
    });
    assert.equal(normalized.mimeType, 'audio/ogg');
    assert.match(normalized.originalName, /^voice-1710000000\.ogg$/i);
    assert.ok(sniffOggContainer(normalized.buffer));

    const passthrough = await normalizeChatUploadFile({
      buffer: converted.buffer,
      mimeType: 'audio/ogg',
      originalName: 'voice-ready.ogg',
    });
    assert.equal(passthrough.mimeType, 'audio/ogg');
    assert.equal(passthrough.originalName, 'voice-ready.ogg');

    console.log('chat-upload-store voice→ogg convert selftest ok');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  runInfer();
  await runFfmpegVoiceConvertIfAvailable();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
