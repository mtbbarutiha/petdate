/**
 * Five team-chat personas: committed avatars, routes, support face.
 * Run: npx tsx packages/web/src/pages/teamChatPersonas.selftest.ts
 */
import assert from 'node:assert/strict';
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

assert.match(bust, /team-chat-personas-v1/, 'cache-bust marker present');
assert.match(startPage, /agent\.avatarUrl/, 'team chat start shows persona photo');
assert.match(startPage, /agent\.name/, 'team chat start shows persona name');
assert.match(startPage, /teamAgentChatPath\(canonicalSlug\)/, 'legacy slugs redirect to canonical path');
assert.match(supportPage, /AI_SUPPORT_AVATAR_URL/, 'support chat shows Yalda photo');
assert.match(supportPage, /AI_ASSISTANT_DISPLAY_NAME/, 'support chat shows Yalda name');
assert.match(supportAgent, /yalda-shabani\.jpg/, 'support agent avatar path');
assert.match(supportAgent, /یلدا شعبانی/, 'support agent display name');
assert.match(welcome, /TEAM_AGENTS\.map/, 'landing team cards come from TEAM_AGENTS');
assert.match(shared, /teamAgentChatPath/, 'shared exports chat paths');
assert.match(shared, /'faranak-ahmadi'/, 'faranak slug');
assert.match(shared, /'leila-kiani'/, 'leila slug');
assert.match(shared, /'sanaz-ghaffari'/, 'sanaz slug');
assert.match(shared, /'sara-noori'/, 'sara slug');
assert.match(shared, /'yalda-shabani'/, 'yalda slug');
assert.match(shared, /kind === 'support'\) return '\/support\/chat'/, 'yalda route is support chat');

const slugs = ['faranak-ahmadi', 'leila-kiani', 'sanaz-ghaffari', 'sara-noori', 'yalda-shabani'];
for (const slug of slugs) {
  const abs = join(webRoot, 'public/agents', `${slug}.jpg`);
  assert.ok(existsSync(abs), `missing avatar public/agents/${slug}.jpg`);
  const bytes = readFileSync(abs);
  assert.ok(bytes.length > 1000, `${slug}.jpg is not an empty placeholder file`);
}

const yaldaReadme = readFileSync(join(webRoot, 'public/agents/README.md'), 'utf8');
assert.match(yaldaReadme, /yalda-shabani\.jpg/, 'Yalda placeholder path documented');
assert.match(yaldaReadme, /Placeholder/, 'Yalda still marked as placeholder until real photo');

console.log('teamChatPersonas.selftest: ok');
