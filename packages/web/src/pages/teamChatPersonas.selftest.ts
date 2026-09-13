/**
 * Five team-chat personas: committed avatars, routes, support face.
 * Run: npx tsx packages/web/src/pages/teamChatPersonas.selftest.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const startPage = readFileSync(join(webRoot, 'src/pages/TeamChatStartPage.tsx'), 'utf8');
const supportPage = readFileSync(join(webRoot, 'src/pages/SupportChatPage.tsx'), 'utf8');
const supportAgent = readFileSync(join(webRoot, 'src/pages/supportAgent.ts'), 'utf8');
const welcome = readFileSync(join(webRoot, 'src/pages/WelcomeBelowFold.tsx'), 'utf8');
const shared = readFileSync(join(webRoot, '../shared/src/team-agents.ts'), 'utf8');
const bust = readFileSync(join(webRoot, '../../tmp/cache-bust-team-chat-personas-v1'), 'utf8');
const yaldaBust = readFileSync(join(webRoot, '../../tmp/cache-bust-yalda-avatar-v1'), 'utf8');

assert.match(bust, /team-chat-personas-v1/, 'cache-bust marker present');
assert.match(yaldaBust, /yalda-avatar-v1/, 'Yalda avatar cache-bust marker present');
assert.match(startPage, /agent\.avatarUrl/, 'team chat start shows persona photo');
assert.match(startPage, /agent\.name/, 'team chat start shows persona name');
assert.match(startPage, /teamAgentChatPath\(canonicalSlug\)/, 'legacy slugs redirect to canonical path');
assert.match(supportPage, /AI_SUPPORT_AVATAR_URL/, 'support chat shows Yalda photo');
assert.match(supportPage, /AI_ASSISTANT_DISPLAY_NAME/, 'support chat shows Yalda name');
assert.match(supportAgent, /yalda-shabani\.jpg\?v=yalda-v1/, 'support agent avatar path is cache-busted');
assert.match(supportAgent, /یلدا شعبانی/, 'support agent display name');
assert.match(welcome, /TEAM_AGENTS\.map/, 'landing team cards come from TEAM_AGENTS');
assert.match(shared, /teamAgentChatPath/, 'shared exports chat paths');
assert.match(shared, /'faranak-ahmadi'/, 'faranak slug');
assert.match(shared, /'leila-kiani'/, 'leila slug');
assert.match(shared, /'sanaz-ghaffari'/, 'sanaz slug');
assert.match(shared, /'sara-noori'/, 'sara slug');
assert.match(shared, /'yalda-shabani'/, 'yalda slug');
assert.match(shared, /yalda-shabani\.jpg\?v=yalda-v1/, 'Yalda TEAM_AGENTS URL is cache-busted');
assert.match(shared, /kind === 'support'\) return '\/support\/chat'/, 'yalda route is support chat');

const slugs = ['faranak-ahmadi', 'leila-kiani', 'sanaz-ghaffari', 'sara-noori', 'yalda-shabani'];
for (const slug of slugs) {
  const abs = join(webRoot, 'public/agents', `${slug}.jpg`);
  assert.ok(existsSync(abs), `missing avatar public/agents/${slug}.jpg`);
  const bytes = readFileSync(abs);
  assert.ok(bytes.length > 1000, `${slug}.jpg is not an empty placeholder file`);
}

const yaldaAbs = join(webRoot, 'public/agents/yalda-shabani.jpg');
const yaldaBytes = readFileSync(yaldaAbs);
assert.equal(yaldaBytes[0], 0xff, 'Yalda avatar is JPEG SOI');
assert.equal(yaldaBytes[1], 0xd8, 'Yalda avatar is JPEG SOI');
assert.ok(yaldaBytes.length === 252950, `Yalda avatar must be the committed 252950-byte photo, got ${yaldaBytes.length}`);
assert.equal(
  createHash('sha256').update(yaldaBytes).digest('hex'),
  'f7835c529fa2de6fad49b75235a0485e9773ee5ea5d3f06bdc2d4d851c4d181a',
  'Yalda avatar sha256 must match the beige-blazer headshot'
);
assert.ok(!/Yalda/i.test(yaldaBytes.toString('latin1')), 'Yalda avatar is not the YS initials placeholder');
assert.ok(!/made with ai/i.test(yaldaBytes.toString('latin1')), 'Yalda avatar has no Made with AI watermark');

const yaldaReadme = readFileSync(join(webRoot, 'public/agents/README.md'), 'utf8');
assert.match(yaldaReadme, /yalda-shabani\.jpg/, 'Yalda avatar path documented');
assert.doesNotMatch(yaldaReadme, /Placeholder/, 'Yalda is no longer marked as a placeholder');

console.log('teamChatPersonas.selftest: ok');
