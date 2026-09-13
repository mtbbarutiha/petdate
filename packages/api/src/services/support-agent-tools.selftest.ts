/**
 * Support agent tools + domain backends selftest.
 * Run: cd packages/api && npx tsx src/services/support-agent-tools.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-support-tools-${process.pid}.db`;

import assert from 'node:assert/strict';

async function main() {
  const { dbService, getDb } = await import('../db');
  const {
    detectSupportToolIntent,
    mergeSupportToolIntoReply,
    runSupportAgentTools,
  } = await import('./support-agent-tools');
  const { guardAgentDomain } = await import('./agent-backends');
  const { knowledgeForPrompt } = await import('./agent-knowledge');
  const { generateAiConsultAdvice } = await import('./ai-consult');

  getDb();

  assert.equal(detectSupportToolIntent('لطفا تیکت ثبت کن'), 'create_ticket');
  assert.equal(detectSupportToolIntent('پیگیری بذار'), 'follow_up');
  assert.equal(detectSupportToolIntent('پیامک بفرست: سلام'), 'send_sms');
  assert.equal(detectSupportToolIntent('از محمد بپرس'), 'ask_mohammad');
  assert.equal(detectSupportToolIntent('OTP چطور کار می‌کنه؟'), 'none');

  const { user } = dbService.findOrCreateUser({
    telegramId: `support_tools_${Date.now()}`,
    name: 'SupportUser',
    username: 'support_user',
  });
  dbService.setUserRoles(user.id, ['pet_owner']);

  const ticket = await runSupportAgentTools({
    user,
    userMessage: 'تیکت بزن مشکل ورود دارم',
  });
  assert.ok(ticket);
  assert.equal(ticket!.action, 'create_ticket');
  assert.equal(ticket!.ok, true);
  assert.ok(ticket!.ticketPublicId);

  const mohammad = await runSupportAgentTools({
    user,
    userMessage: 'نمی‌دونم چیکار کنم از محمد بپرس',
  });
  assert.ok(mohammad);
  assert.equal(mohammad!.action, 'ask_mohammad');
  assert.ok(mohammad!.ticketPublicId);

  const follow = await runSupportAgentTools({
    user,
    userMessage: 'پیگیری برای فردا بذار',
  });
  assert.ok(follow);
  assert.equal(follow!.action, 'follow_up');
  assert.ok(follow!.followupId);

  const merged = mergeSupportToolIntoReply('راهنما اینه.', ticket!);
  assert.match(merged, /تیکت/);

  const out = guardAgentDomain('trainer', 'تب داره استفراغ می‌کنه');
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.replyFa, /دامپزشک/);

  assert.match(knowledgeForPrompt('support'), /OTP|تیکت|محمد/);

  const domainRefuse = await generateAiConsultAdvice({
    kind: 'vet',
    agentName: 'دکتر ساناز غفاری',
    backend: 'vet',
    userMessage: 'چطور بشین یاد بگیره؟',
    history: [{ role: 'user', content: 'سلام' }, { role: 'assistant', content: 'سلام' }],
  });
  assert.match(domainRefuse.text, /تخصص|مربی|آموزش/);

  console.log('support-agent-tools.selftest: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
