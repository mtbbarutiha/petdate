import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chatPage = fs.readFileSync(path.join(root, 'pages/ChatPage.tsx'), 'utf8');
const vetPage = fs.readFileSync(path.join(root, 'pages/VetChatPage.tsx'), 'utf8');
const supportPage = fs.readFileSync(path.join(root, 'pages/SupportChatPage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'lib/api.ts'), 'utf8');
const replyUi = fs.readFileSync(path.join(root, 'components/ChatReply.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/chat.css'), 'utf8');

assert.match(replyUi, /ChatReplyComposerBar/, 'shared reply composer bar');
assert.match(replyUi, /ChatReplyQuote/, 'shared reply quote');
assert.match(chatPage, /replyToId/, 'playmate UI tracks replyToId');
assert.match(chatPage, /ChatReplyComposerBar/, 'playmate composer shows reply preview');
assert.match(chatPage, /beginReplyTo/, 'playmate can start reply');
assert.match(vetPage, /replyToId/, 'vet UI tracks replyToId');
assert.match(vetPage, /ChatReplyComposerBar/, 'vet composer shows reply preview');
assert.match(supportPage, /replyToId/, 'support UI tracks replyToId');
assert.match(supportPage, /ChatReplyComposerBar/, 'support composer shows reply preview');
assert.match(api, /replyToId/, 'web API client sends replyToId');
assert.match(css, /\.tg-reply-quote/, 'reply quote styles');
assert.match(css, /\.tg-reply-composer/, 'reply composer styles');

console.log('chat-reply UI selftest ok');
