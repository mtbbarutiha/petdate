/**
 * Automatic messages — catalog defaults, channel flags, send routing.
 * Run: cd packages/api && npx tsx src/auto-messages.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-auto-msg-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.CANDOO_API_KEY = '';
process.env.CANDOO_SRC_NUMBERS = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor } = await import('./hr-service');
  const crm = await import('./crm-service');
  const {
    AUTO_MESSAGE_CATALOG,
    AUTO_MESSAGE_CHANNEL_UNREADY,
  } = await import('@petdate/shared');
  const { listAutoMessageChannelStatus, deliverSelectedChannels, registerAutoMessageChannel, unregisterAutoMessageChannel } =
    await import('./services/auto-message-channels');

  ensureHrSchema();
  crm.ensureCrmSchema();
  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin');

  const patterns = crm.listSmsPatterns();
  for (const entry of AUTO_MESSAGE_CATALOG) {
    const row = patterns.find((p) => p.catalogKey === entry.key || p.trigger === entry.trigger);
    assert(row, `catalog ${entry.key} listed`);
    assert(row!.system || row!.catalogKey === entry.key, `${entry.key} marked system`);
    assert(row!.channels.includes('sms'), `${entry.key} has sms`);
    assert(row!.channels.includes('telegram'), `${entry.key} has telegram`);
    assert(!row!.channels.includes('whatsapp'), `${entry.key} whatsapp off by default`);
  }

  let deleteBlocked = false;
  const systemRow = patterns.find((p) => p.catalogKey === 'after_purchase')!;
  try {
    crm.deleteSmsPattern(systemRow.id);
  } catch (e) {
    deleteBlocked = (e as Error & { status?: number }).status === 400;
  }
  assert(deleteBlocked, 'system catalog cannot be deleted');

  const edited = crm.upsertSmsPattern({
    id: systemRow.id,
    name: 'خوش‌آمد سفارشی',
    text: '{نام} خرید {محصول} را انجام داد.',
    trigger: 'after_purchase',
    auto: true,
    active: true,
    channels: ['telegram', 'whatsapp'],
  });
  assert(edited.name === 'خوش‌آمد سفارشی', 'edit persists name');
  assert(edited.text.includes('{نام}'), 'edit persists body');
  assert(edited.channels.includes('telegram') && edited.channels.includes('whatsapp'), 'channel flags persist');
  assert(!edited.channels.includes('sms'), 'sms can be turned off');

  const reset = crm.resetSmsPatternToCatalog(systemRow.id);
  assert(reset.name === 'خوش‌آمدگویی پس از خرید', 'reset restores catalog title');
  assert(reset.channels.includes('sms') && reset.channels.includes('telegram'), 'reset restores channels');

  const custom = crm.upsertSmsPattern({
    name: 'یادآوری دستی',
    text: 'سلام {نام}',
    trigger: 'manual',
    auto: false,
    active: true,
    channels: ['sms'],
  });
  crm.deleteSmsPattern(custom.id);
  assert(!crm.listSmsPatterns().some((p) => p.id === custom.id), 'custom can delete');

  const statuses = listAutoMessageChannelStatus();
  assert(statuses.some((s) => s.id === 'sms' && s.ready === false), 'sms not ready without Candoo');
  assert(statuses.some((s) => s.id === 'telegram' && s.ready === false), 'telegram not ready without bot');
  const wa = statuses.find((s) => s.id === 'whatsapp');
  assert(wa && wa.ready === false, 'whatsapp not ready');
  assert(wa!.reason === AUTO_MESSAGE_CHANNEL_UNREADY.whatsapp?.reason, 'whatsapp honest reason');

  const { customer } = crm.simulateInboundCall(
    { mobile: '09120001122', first: 'سارا', last: 'خرید' },
    admin!
  );

  const routed = await crm.sendSmsPattern(systemRow.id, customer.id, admin!, { ticketPublicId: 'TK-AUTO' });
  assert(routed.channels.length >= 2, 'send hits selected channels');
  assert(routed.channels.every((c) => c.sent === false), 'no fake send without providers');
  assert(routed.channels.some((c) => c.channel === 'sms' && /پیامک|پیکربندی/.test(c.reason || '')), 'sms skip reason');
  assert(routed.channels.some((c) => c.channel === 'telegram' && /تلگرام/.test(c.reason || '')), 'telegram skip reason');
  assert(routed.delivery.sent === false && routed.delivery.skipped, 'legacy delivery is skip not success');

  registerAutoMessageChannel({
    id: 'test_push',
    label: 'پوش آزمایشی',
    status: () => ({ ready: true }),
    send: async () => ({ channel: 'test_push', sent: true }),
  });
  const extra = await deliverSelectedChannels(['test_push', 'whatsapp'], {
    text: 'hi',
    customer: { mobile: '09120001122' },
  });
  assert(extra.find((c) => c.channel === 'test_push')?.sent === true, 'extension channel can send');
  assert(extra.find((c) => c.channel === 'whatsapp')?.sent === false, 'whatsapp still does not fake-send');
  unregisterAutoMessageChannel('test_push');

  crm.notifyPurchaseAutoMessage({
    customerPhone: customer.mobile,
    customerName: 'سارا خرید',
    product: 'بسته همبازی',
    amount: 120000,
  });
  const after = crm.listSmsPatterns().find((p) => p.trigger === 'after_purchase');
  assert(after?.auto && after.active, 'after_purchase is live');

  const ticket = crm.createTicket(
    {
      customerId: customer.id,
      title: 'تست پیام خودکار',
      description: 'ایجاد',
      channel: 'manual',
    },
    admin!
  );
  assert(ticket.id, 'ticket created (ticket_created dispatch)');

  console.log('auto-messages.selftest: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
