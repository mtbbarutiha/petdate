import assert from 'assert';
import { inferMediaKind } from './chat-upload-store';

function run() {
  assert.equal(inferMediaKind('image/jpeg', 'a.jpg'), 'photo');
  assert.equal(inferMediaKind('video/webm', 'video-1.webm'), 'video');
  assert.equal(inferMediaKind('audio/ogg', 'note.ogg'), 'voice');
  assert.equal(inferMediaKind('audio/webm', 'voice-1710000000.webm'), 'voice');
  assert.equal(inferMediaKind('audio/mp4', 'voice-1710000000.m4a'), 'voice');
  assert.equal(inferMediaKind('audio/mpeg', 'song.mp3'), 'audio');
  assert.equal(inferMediaKind('application/pdf', 'rx.pdf'), 'document');
  console.log('chat-upload-store inferMediaKind selftest ok');
}

run();
