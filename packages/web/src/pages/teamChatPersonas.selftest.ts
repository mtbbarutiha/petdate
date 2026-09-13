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
const bust = readFileSync(join(webRoot, '../../tmp/cache-bust-persona-avatars-v2'), 'utf8');
const saraVetBust = readFileSync(join(webRoot, '../../tmp/cache-bust-sara-noori-vet-link-v1'), 'utf8');
const rolesBust = readFileSync(join(webRoot, '../../tmp/cache-bust-persona-roles-remap-v1'), 'utf8');

assert.match(bust, /persona-avatars-v2/, 'v2 persona avatar cache-bust marker present');
assert.match(saraVetBust, /sara-noori-vet-link-v1/, 'Sara vet-link cache-bust marker present');
assert.match(rolesBust, /persona-roles-remap-v1/, 'persona roles remap cache-bust marker present');
assert.match(shared, /petdate_ai_sara_noori/, 'Sara slug-shaped telegram id is aliased to vet');
assert.match(shared, /kind: 'vet'/, 'shared roster includes vet kind');
assert.match(shared, /kind: 'finance'/, 'shared roster includes finance kind');
assert.match(shared, /b6e496b5-0b15-4c9b-852d-644d3f5e411a/, 'Faranak grok id');
assert.match(shared, /2410554d-9496-4a60-9b15-4248dcc6e725/, 'Leila grok id');
assert.match(shared, /18a4d76a-1900-49dc-964c-27d23abb31e9/, 'Sanaz/Yalda support grok id');
assert.match(shared, /0140b645-f844-45c1-b6d8-3f06514529de/, 'Sara grok id');
assert.match(startPage, /agent\.avatarUrl/, 'team chat start shows persona photo');
assert.match(startPage, /agent\.name/, 'team chat start shows persona name');
assert.match(startPage, /teamAgentChatPath\(canonicalSlug\)/, 'legacy slugs redirect to canonical path');
assert.match(supportPage, /AI_SUPPORT_AVATAR_URL/, 'support chat shows Yalda photo');
assert.match(supportPage, /AI_ASSISTANT_DISPLAY_NAME/, 'support chat shows Yalda name');
assert.match(supportAgent, /yalda-shabani\.jpg\?v=persona-v2/, 'support agent avatar path is cache-busted');
assert.match(supportAgent, /یلدا شعبانی/, 'support agent display name');
assert.match(welcome, /LANDING_TEAM_AGENT_SLUGS\.map/, 'landing team cards come from LANDING_TEAM_AGENT_SLUGS');
assert.match(welcome, /TEAM_AGENTS\.find/, 'landing cards resolve each slug from TEAM_AGENTS');
assert.match(shared, /teamAgentChatPath/, 'shared exports chat paths');
assert.match(shared, /TEAM_AGENT_AVATAR_CACHE_BUST = 'persona-v2'/, 'shared cache-bust token is persona-v2');
assert.match(shared, /'faranak-ahmadi'/, 'faranak slug');
assert.match(shared, /'leila-kiani'/, 'leila slug');
assert.match(shared, /'sanaz-ghaffari'/, 'sanaz slug');
assert.match(shared, /'sara-noori'/, 'sara slug');
assert.match(shared, /'yalda-shabani'/, 'yalda slug');
assert.match(shared, /SUPPORT_TEAM_AGENT_SLUG/, 'yalda hub slug is named');
assert.match(startPage, /SUPPORT_TEAM_AGENT_SLUG/, 'team-chat only redirects Yalda to support hub');
assert.match(welcome, /LANDING_TEAM_AGENT_SLUGS/, 'landing cards use the four public faces');
assert.match(welcome, /roleFinance/, 'Leila landing card is finance');
assert.match(welcome, /'sanaz-ghaffari': \{ nameKey: 'landing.team3', roleKey: 'landing.roleSupport' \}/, 'Sanaz landing card is support');
assert.doesNotMatch(welcome, /'leila-kiani': \{ nameKey: 'landing.team2', roleKey: 'landing.roleTrainer' \}/);
assert.doesNotMatch(welcome, /'sanaz-ghaffari': \{ nameKey: 'landing.team3', roleKey: 'landing.roleVet' \}/);

/** Distinct v2 headshots — must not regress to pepito lookalikes or YS placeholder. */
const AVATAR_SHA256: Record<string, { bytes: number; sha: string }> = {
  'faranak-ahmadi': { bytes: 181223, sha: '558fe050a92294e78758e7932c9d55bd22ee971b9d103b941e76d2393a92da10' },
  'leila-kiani': { bytes: 213345, sha: '12968212115108e50334ff8a018fbd546d46a0e76ff2a695c3451e3c4b83a3ba' },
  'sanaz-ghaffari': { bytes: 144396, sha: 'd83a460e7d170588bf7000234e4f90d3a9eab4ff886fa7b3613d8f420a87984d' },
  'sara-noori': { bytes: 151799, sha: 'e11ff02fc89ed07797bac49627084e6fa61f6ad446e6e3e5af7ba68d8c922999' },
  'yalda-shabani': { bytes: 181825, sha: 'daf8d7090446c8a60b0d9aa9c6da70dfb8beaaaf69dcf6bbe3208a51e47aa1fc' },
};

for (const [slug, expect] of Object.entries(AVATAR_SHA256)) {
  const abs = join(webRoot, 'public/agents', `${slug}.jpg`);
  assert.ok(existsSync(abs), `missing avatar public/agents/${slug}.jpg`);
  const bytes = readFileSync(abs);
  assert.equal(bytes[0], 0xff, `${slug} is JPEG SOI`);
  assert.equal(bytes[1], 0xd8, `${slug} is JPEG SOI`);
  assert.equal(bytes.length, expect.bytes, `${slug}.jpg must be the committed v2 photo (${expect.bytes} bytes)`);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    expect.sha,
    `${slug} sha256 must match the v2 distinct headshot`
  );
  assert.ok(!/Yalda/i.test(bytes.toString('latin1')), `${slug} is not the YS initials placeholder`);
  assert.ok(!/made with ai/i.test(bytes.toString('latin1')), `${slug} has no Made with AI watermark`);
}

const yaldaReadme = readFileSync(join(webRoot, 'public/agents/README.md'), 'utf8');
assert.match(yaldaReadme, /yalda-shabani\.jpg/, 'Yalda avatar path documented');
assert.match(yaldaReadme, /persona-v2/, 'README documents v2 cache-bust');
assert.doesNotMatch(yaldaReadme, /Placeholder/, 'Yalda is no longer marked as a placeholder');
assert.doesNotMatch(yaldaReadme, /pepito\/uploads/, 'README no longer claims pepito lookalike portraits');

console.log('teamChatPersonas.selftest: ok');
