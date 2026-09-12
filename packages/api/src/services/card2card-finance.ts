/**
 * اتصال تأیید کارت‌به‌کارت به Finance OS + اعلان تلگرام کاربر.
 * شکست این مسیر هرگز نباید تأیید پرداخت را fail کند.
 */
import { toPersianDigits } from '@petdate/shared';
import { getDb } from '../db';
import { ensureFinanceOsSchema, importFinanceOsTransactions } from '../finance-os-service';
import { infra } from '../config/infra';
import { telegramBotApiUrl, telegramFetch } from './telegram-http';
import { usableTelegramId } from './telegram-id';
import { pushAdminHeaderNotification } from '../admin-notifications';

function paymentCardLast4(): string {
  const n = String(process.env.PAYMENT_CARD_NUMBER || '').replace(/\D/g, '');
  return n.length >= 4 ? n.slice(-4) : '';
}

export function resolveCard2CardFinanceAccount(): string | null {
  const forced = String(process.env.FINANCE_OS_CARD2CARD_ACCOUNT || '').trim();
  if (forced) return forced;
  try {
    ensureFinanceOsSchema();
    const d = getDb();
    const last4 = paymentCardLast4();
    if (last4) {
      const byCard = d
        .prepare(
          `SELECT code FROM finance_os_accounts
           WHERE status = 'active' AND REPLACE(card_number, ' ', '') LIKE ?
           ORDER BY id ASC LIMIT 1`
        )
        .get(`%${last4}`) as { code: string } | undefined;
      if (byCard?.code) return byCard.code;
    }
    const petdateBank = d
      .prepare(
        `SELECT code FROM finance_os_accounts
         WHERE status = 'active' AND type = 'بانک رسمی' AND line LIKE '%پت%'
         ORDER BY id ASC LIMIT 1`
      )
      .get() as { code: string } | undefined;
    if (petdateBank?.code) return petdateBank.code;
    const anyBank = d
      .prepare(
        `SELECT code FROM finance_os_accounts
         WHERE status = 'active' AND type = 'بانک رسمی'
         ORDER BY id ASC LIMIT 1`
      )
      .get() as { code: string } | undefined;
    if (anyBank?.code) return anyBank.code;
    const cash = d
      .prepare(
        `SELECT code FROM finance_os_accounts
         WHERE status = 'active' AND code = 'W-CASH-HLD' LIMIT 1`
      )
      .get() as { code: string } | undefined;
    return cash?.code ?? null;
  } catch (err) {
    console.warn('resolveCard2CardFinanceAccount failed:', (err as Error).message);
    return null;
  }
}

export function enqueueCard2CardFinanceOs(input: {
  orderId: number;
  amountToman: number;
  userId: number;
  kind: 'coins' | 'shopcard' | string;
  packageId?: string;
}): { ok: boolean; account?: string; imported?: number } {
  const amount = Math.floor(Number(input.amountToman) || 0);
  if (amount <= 0) return { ok: false };
  const account = resolveCard2CardFinanceAccount();
  if (!account) return { ok: false };
  const today = new Date().toISOString().slice(0, 10);
  const kindFa =
    input.kind === 'shopcard'
      ? 'شاپ کارت‌به‌کارت'
      : input.kind === 'coins'
        ? 'خرید سکه کارت‌به‌کارت'
        : `کارت‌به‌کارت (${input.kind})`;
  try {
    const result = importFinanceOsTransactions({
      account,
      fileName: `card2card-po-${input.orderId}`,
      method: 'api',
      rows: [
        {
          date: today,
          amount,
          desc: `${kindFa} · سفارش #${input.orderId} · کاربر #${input.userId}`,
          note: input.packageId ? `package=${input.packageId}` : undefined,
        },
      ],
    });
    return { ok: result.imported > 0, account, imported: result.imported };
  } catch (err) {
    console.warn('enqueueCard2CardFinanceOs failed:', (err as Error).message);
    return { ok: false, account };
  }
}

/**
 * Notify Telegram admins that a card receipt is waiting in the finance panel.
 * Used for web (and shop) uploads — bot path already notifies via Grammy Context.
 */
export async function notifyAdminsPendingCardReceipt(order: {
  id: number;
  userId: number;
  packageId: string;
  coins: number;
  amountToman?: number;
  userName?: string;
  userUsername?: string;
  userTelegramId?: string;
  receiptFileId?: string;
}): Promise<void> {
  const admins = (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    pushAdminHeaderNotification({
      title: `رسید کارت‌به‌کارت #${order.id}`,
      body: `${order.userName || 'کاربر'} · ${order.coins} سکه — صف تأیید مالی`,
      kind: 'warn',
      href: '/admin/payments',
      module: 'finance',
      permission: 'finance.read',
      sourceKey: `payment-receipt:${order.id}`,
    });
  } catch (err) {
    console.warn('header notif pending receipt skipped:', (err as Error).message);
  }

  if (!infra.telegram.botToken || !admins.length) {
    if (!admins.length) {
      console.warn('No TELEGRAM_ADMIN_IDS — pending payment #%s not notified', order.id);
    }
    return;
  }
  const last4 = paymentCardLast4();
  const text = [
    '💳 رسید کارت‌به‌کارت — بررسی در پنل مالی',
    '',
    `سفارش: #${order.id}`,
    `کاربر: ${order.userName || '—'} (#${order.userId})`,
    order.userUsername ? `یوزرنیم: @${order.userUsername}` : null,
    order.userTelegramId ? `تلگرام: ${order.userTelegramId}` : null,
    `بسته: ${order.packageId} · ${toPersianDigits(order.coins)} سکه`,
    `مبلغ: ${toPersianDigits(order.amountToman ?? 0)} تومان`,
    last4 ? `کارت مقصد: …${last4}` : null,
    '',
    'ادمین → مالی → صف تأیید واریز',
  ]
    .filter((l) => l !== null)
    .join('\n');

  for (const adminId of admins) {
    if (!usableTelegramId(adminId)) continue;
    try {
      const res = await telegramFetch(telegramBotApiUrl(infra.telegram.botToken, 'sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminId, text }),
      });
      const data = (await res.json()) as { ok?: boolean; description?: string };
      if (!data.ok) {
        console.warn('notify admin pending receipt failed:', adminId, data.description ?? res.status);
      }
    } catch (err) {
      console.warn('notify admin pending receipt error:', adminId, (err as Error).message);
    }
  }
}

export async function notifyCardPaymentApprovedTelegram(opts: {
  toTelegramId?: string | null;
  coins?: number;
  shopOrderId?: number;
  kind: 'coins' | 'shopcard';
}): Promise<boolean> {
  const tg = opts.toTelegramId ? String(opts.toTelegramId).trim() : '';
  if (!infra.telegram.botToken || !usableTelegramId(tg)) return false;
  const text =
    opts.kind === 'shopcard'
      ? [
          '✅ پرداخت کارت‌به‌کارت شاپ تأیید شد.',
          opts.shopOrderId ? `سفارش فروشگاه #${opts.shopOrderId} ثبت شد.` : 'سفارشت ثبت شد.',
          'از «سفارش‌های من» در شاپ پیگیری کن.',
        ].join('\n')
      : [
          '✅ پرداخت کارت‌به‌کارت تأیید شد.',
          `${toPersianDigits(opts.coins ?? 0)} سکه به موجودی‌ات اضافه شد.`,
          'موجودی در کیف پول وب و ربات یکی است.',
        ].join('\n');
  try {
    const res = await telegramFetch(telegramBotApiUrl(infra.telegram.botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tg, text }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn('card payment approve notify failed:', data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('card payment approve notify error:', (err as Error).message);
    return false;
  }
}

export async function notifyCardPaymentRejectedTelegram(opts: {
  toTelegramId?: string | null;
  note?: string;
}): Promise<boolean> {
  const tg = opts.toTelegramId ? String(opts.toTelegramId).trim() : '';
  if (!infra.telegram.botToken || !usableTelegramId(tg)) return false;
  const text = [
    '❌ رسید کارت‌به‌کارت رد شد.',
    opts.note?.trim() ? `دلیل: ${opts.note.trim()}` : 'در صورت نیاز دوباره از کیف پول یا شاپ اقدام کن.',
  ].join('\n');
  try {
    const res = await telegramFetch(telegramBotApiUrl(infra.telegram.botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tg, text }),
    });
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch (err) {
    console.warn('card payment reject notify error:', (err as Error).message);
    return false;
  }
}
