/**
 * Support-agent ops tools: create ticket, schedule follow-up, SMS customer,
 * escalate to Mohammad (operator) when the agent does not know what to do.
 */
import type { User } from '@petdate/shared';
import {
  createFollowup,
  createUserSupportTicket,
  findOrCreateCustomerForPlatformUser,
  portalTicketActor,
} from '../crm-service';
import { candooSendWithSrcFallback, isCandooConfigured } from './candoo';

export type SupportToolAction =
  | 'none'
  | 'create_ticket'
  | 'follow_up'
  | 'send_sms'
  | 'ask_mohammad';

export type SupportToolResult = {
  action: SupportToolAction;
  ok: boolean;
  summaryFa: string;
  ticketPublicId?: string;
  followupId?: number;
  smsSent?: boolean;
};

const ACTOR = portalTicketActor('یلدا شعبانی · پشتیبانی هوشمند');

/** Detect which ops tool the user is asking for (Persian + light EN). */
export function detectSupportToolIntent(text: string): SupportToolAction {
  const q = String(text || '').trim();
  if (!q) return 'none';

  if (
    /محمد|اپراتور|اپریتور|نیروی\s*انسانی|نمی‌دونم\s*چیکار|نمی\s*دونم\s*چیکار|از\s*مسئول|بپرس\s*از\s*محمد|ask\s*mohammad|escalate/i.test(
      q
    )
  ) {
    return 'ask_mohammad';
  }
  if (/پیامک|اس\s*ام\s*اس|\bsms\b|متن\s*پیامک/i.test(q)) {
    return 'send_sms';
  }
  if (/پیگیری|فالو[\s‌-]?آپ|follow[\s-]?up|یادآوری|تماس\s*بعدی/i.test(q)) {
    return 'follow_up';
  }
  if (/تیکت|ticket|ثبت\s*درخواست|شکایت|پیگیری\s*انسانی|به\s*تیم\s*انسانی/i.test(q)) {
    return 'create_ticket';
  }
  return 'none';
}

function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9, 0, 0, 0);
  return d.toISOString();
}

function extractSmsBody(text: string): string {
  const m =
    text.match(/پیامک[:：]\s*(.+)$/i) ||
    text.match(/متن[:：]\s*(.+)$/i) ||
    text.match(/sms[:：]\s*(.+)$/i);
  const body = (m?.[1] || text).trim();
  return body.slice(0, 300);
}

export async function runSupportAgentTools(opts: {
  user: User;
  userMessage: string;
  /** When the model is unsure, force Mohammad escalation */
  forceAskMohammad?: boolean;
}): Promise<SupportToolResult | null> {
  const action = opts.forceAskMohammad
    ? 'ask_mohammad'
    : detectSupportToolIntent(opts.userMessage);
  if (action === 'none') return null;

  try {
    if (action === 'create_ticket') {
      const ticket = createUserSupportTicket(opts.user, {
        title: opts.userMessage.trim().slice(0, 120) || 'درخواست پشتیبانی',
        description: opts.userMessage.trim(),
        category: 'پلتفرم',
        channel: 'ai_support',
      });
      return {
        action,
        ok: true,
        ticketPublicId: ticket.publicId,
        summaryFa: `تیکت ${ticket.publicId} ثبت شد. تیم پشتیبانی پیگیری می‌کند.`,
      };
    }

    if (action === 'ask_mohammad') {
      const ticket = createUserSupportTicket(opts.user, {
        title: `ارجاع به محمد — ${opts.userMessage.trim().slice(0, 80)}`,
        description: [
          'ایجنت پشتیبانی (یلدا شعبانی) مطمئن نبود و به محمد (اپراتور) ارجاع داد.',
          '',
          `پیام کاربر: ${opts.userMessage.trim()}`,
        ].join('\n'),
        category: 'ارجاع اپراتور',
        channel: 'ai_support_escalate',
      });
      return {
        action,
        ok: true,
        ticketPublicId: ticket.publicId,
        summaryFa: `موضوع را برای محمد (اپراتور) ثبت کردم — پیگیری با کد ${ticket.publicId}.`,
      };
    }

    if (action === 'follow_up') {
      const customer = findOrCreateCustomerForPlatformUser(opts.user, ACTOR);
      const fu = createFollowup(
        {
          customerId: customer.id,
          kind: 'تماس پشتیبانی',
          dueAt: tomorrowIso(),
          priority: 'متوسط',
          description: opts.userMessage.trim().slice(0, 500),
          ownerId: 'mohammad',
          ownerName: 'محمد',
        },
        ACTOR
      );
      return {
        action,
        ok: true,
        followupId: fu.id,
        summaryFa: `پیگیری برای فردا ثبت شد (شناسه ${fu.id}) — محمد/پشتیبانی تماس می‌گیرند.`,
      };
    }

    if (action === 'send_sms') {
      const phone = String(opts.user.phone || '').trim();
      if (!phone) {
        return {
          action,
          ok: false,
          summaryFa:
            'شماره موبایل روی حسابت ثبت نیست — اول از پروفایل موبایل را اضافه کن تا پیامک بفرستم.',
        };
      }
      if (!isCandooConfigured()) {
        return {
          action,
          ok: false,
          summaryFa:
            'سامانه پیامک الان پیکربندی نشده. تیکت می‌سازم تا محمد دستی پیگیری کند.',
        };
      }
      const body = extractSmsBody(opts.userMessage);
      const sent = await candooSendWithSrcFallback({
        recipient: phone.replace(/^\+/, ''),
        body: body.slice(0, 268),
      });
      return {
        action,
        ok: Boolean(sent.ok),
        smsSent: Boolean(sent.ok),
        summaryFa: sent.ok
          ? `پیامک به ${phone} ارسال شد.`
          : `ارسال پیامک ناموفق بود${sent.error ? `: ${sent.error}` : ''}. اگر بخوای تیکت می‌زنم.`,
      };
    }
  } catch (err) {
    return {
      action,
      ok: false,
      summaryFa: `ابزار پشتیبانی خطا داد: ${err instanceof Error ? err.message : 'نامشخص'}`,
    };
  }

  return null;
}

/** Append tool outcome to the assistant reply so the user sees what happened. */
export function mergeSupportToolIntoReply(reply: string, tool: SupportToolResult | null): string {
  if (!tool) return reply;
  const base = reply.trim();
  if (!base) return tool.summaryFa;
  if (base.includes(tool.summaryFa)) return base;
  return `${base}\n\n—\n${tool.summaryFa}`;
}
