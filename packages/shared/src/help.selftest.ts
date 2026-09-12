/**
 * Shared help catalog — all live roles + major site sections, FA/EN, no invented features.
 * Run: npx tsx packages/shared/src/help.selftest.ts
 */
import assert from 'node:assert/strict';
import { USER_ROLES } from './petdate.ts';
import {
  HELP_AUDIENCES,
  HELP_FAQ,
  HELP_ROLE_INTROS,
  HELP_SECTION_LABELS,
  HELP_STRUCTURE,
  HELP_TOPICS,
  TELEGRAM_HELP_LIMIT,
  botHelpTopicButtons,
  formatBotHelpOverview,
  formatBotHelpTopic,
  formatHelpArticle,
  helpAudienceForUser,
  helpTopicById,
  siteFaqItems,
  siteHelpSections,
  siteRoleGuides,
  topicsForAudience,
} from './help.ts';

const PERSIAN = /[\u0600-\u06FF]/;

assert.deepEqual(
  HELP_AUDIENCES.slice().sort(),
  (['guest', ...USER_ROLES] as const).slice().sort(),
  'audiences are guest + live USER_ROLES'
);

for (const role of USER_ROLES) {
  assert.ok(HELP_ROLE_INTROS[role], `role intro exists for ${role}`);
  const botTopics = topicsForAudience(role, 'bot');
  assert.ok(botTopics.length >= 4, `${role} has bot help topics`);
  const overview = formatBotHelpOverview(role);
  assert.ok(overview.length > 80, `${role} overview is not a stub`);
  assert.ok(overview.length < TELEGRAM_HELP_LIMIT, `${role} overview fits Telegram`);
  assert.match(overview, /<b>چیست<\/b>/, `${role} overview has what`);
  assert.match(overview, /<b>چطور استفاده کن<\/b>/, `${role} overview has how`);
  assert.match(overview, /<b>نکته<\/b>/, `${role} overview has tips`);
  assert.match(overview, /\/help/, `${role} lists /help`);
  assert.doesNotMatch(overview, /\*\*/, `${role} overview is HTML not Markdown **`);
}

const guestOverview = formatBotHelpOverview('guest');
assert.match(guestOverview, /مهمان/, 'guest overview is labeled');
assert.ok(guestOverview.length < TELEGRAM_HELP_LIMIT, 'guest overview fits Telegram');

assert.ok(
  topicsForAudience('trainer', 'bot').some((t) => t.id === 'tronline'),
  'trainer bot help includes online toggle'
);
assert.ok(
  topicsForAudience('no_pet', 'bot').some((t) => t.id === 'owneradv'),
  'no_pet bot help includes owner advice (not the old buy-consult label)'
);
assert.ok(
  !topicsForAudience('pet_owner', 'bot').some((t) => /پرستار/.test(t.title.fa)),
  'owner help does not advertise removed sitter role'
);

const requiredSections = [
  'account',
  'roles',
  'playmates',
  'chats',
  'pets',
  'diary',
  'wallet',
  'shop',
  'invite',
  'verify',
  'consults',
  'games',
  'adoption',
  'magazine',
  'support',
  'profile',
] as const;
for (const id of requiredSections) {
  assert.ok(HELP_SECTION_LABELS[id], `section ${id} labeled`);
  assert.ok(
    HELP_TOPICS.some((t) => t.section === id),
    `section ${id} has at least one topic`
  );
}

for (const topic of HELP_TOPICS) {
  assert.ok(PERSIAN.test(topic.title.fa), `${topic.id} FA title`);
  assert.ok(topic.title.en.trim().length > 2, `${topic.id} EN title`);
  assert.ok(topic.what.fa.length > 20 && topic.what.en.length > 20, `${topic.id} what`);
  assert.ok(topic.how.fa.length > 20 && topic.how.en.length > 20, `${topic.id} how`);
  assert.ok(!PERSIAN.test(topic.title.en), `${topic.id} EN title has no Persian`);
  assert.ok(!PERSIAN.test(topic.what.en), `${topic.id} EN what has no Persian`);
  const article = formatHelpArticle(topic, 'fa');
  assert.ok(article.length < TELEGRAM_HELP_LIMIT, `${topic.id} article fits Telegram`);
  assert.ok(formatBotHelpTopic(topic.id), `${topic.id} bot topic formatter`);
}

assert.equal(formatBotHelpTopic('not-a-topic'), null);

assert.ok(HELP_FAQ.length >= 12, 'FAQ covers major questions');
for (const item of HELP_FAQ) {
  assert.ok(PERSIAN.test(item.q.fa) && PERSIAN.test(item.a.fa), `${item.id} FA faq`);
  assert.ok(!PERSIAN.test(item.q.en) && !PERSIAN.test(item.a.en), `${item.id} EN faq`);
}

const faFaq = siteFaqItems('fa');
const enFaq = siteFaqItems('en');
assert.equal(faFaq.length, enFaq.length);
assert.ok(faFaq.some((x) => x.id === 'wallet-q'), 'FAQ includes wallet');
assert.ok(faFaq.some((x) => x.id === 'games-q'), 'FAQ includes games');
assert.ok(faFaq.some((x) => x.id === 'diary-q'), 'FAQ includes diary');
assert.ok(faFaq.some((x) => x.id === 'trainer-q'), 'FAQ includes trainer');

const sectionsFa = siteHelpSections('fa');
const sectionsEn = siteHelpSections('en');
assert.equal(sectionsFa.length, sectionsEn.length);
assert.ok(sectionsFa.length >= 12, 'site help has major sections');

const roles = siteRoleGuides('fa');
assert.equal(roles.length, HELP_AUDIENCES.length);

assert.equal(helpAudienceForUser(null), 'guest');
assert.equal(helpAudienceForUser({ role: 'trainer', roles: ['trainer'] }), 'trainer');
assert.equal(helpAudienceForUser({ roles: ['vet'] }), 'vet');

const ownerBtns = botHelpTopicButtons('pet_owner');
assert.ok(ownerBtns.some((b) => b.id === 'playmate'), 'owner keyboard has playmate');
assert.ok(ownerBtns.every((b) => b.label.length <= 32), 'bot button labels stay short');

assert.ok(helpTopicById('games')?.surfaces.includes('web'), 'games is site-only');
assert.ok(!helpTopicById('games')?.surfaces.includes('bot'), 'games not claimed on bot');
assert.ok(helpTopicById('diary')?.surfaces.includes('web'), 'diary is site');
assert.ok(!helpTopicById('diary')?.surfaces.includes('bot'), 'diary not claimed on bot');

assert.equal(HELP_STRUCTURE.what.fa, 'چیست');
assert.doesNotMatch(JSON.stringify(HELP_TOPICS), /به‌زودی/, 'no coming-soon stubs in topics');

console.log('help.selftest: ok', {
  topics: HELP_TOPICS.length,
  faq: HELP_FAQ.length,
  sections: sectionsFa.length,
});
