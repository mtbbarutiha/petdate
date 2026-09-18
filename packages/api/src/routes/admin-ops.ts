/**
 * /api/admin/security, calendar buckets, mail outbox flush.
 */
import { Router } from 'express';
import tls from 'tls';
import { actorHasPermission } from '../hr-service';
import {
  calendarBuckets,
  deleteIpBan,
  listOutbox,
  markOutbox,
  queueMail,
  securitySnapshot,
  upsertIpBan,
} from '../admin-ops-service';

export const adminOpsRouter = Router();

function superAdmin(req: { adminActor?: { role: string; permissions: string[] } }): boolean {
  const actor = req.adminActor;
  if (!actor) return false;
  return actor.role === 'admin' || actorHasPermission(actor as never, 'admin.full');
}

function probeSsl(host: string): Promise<{ status: string; detail: string; expiresAt: string | null }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: 2500, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const exp = cert?.valid_to ? new Date(cert.valid_to) : null;
        const expiresAt = exp && !Number.isNaN(exp.getTime()) ? exp.toISOString() : null;
        const days = exp ? Math.round((exp.getTime() - Date.now()) / 86400_000) : null;
        const authorized = socket.authorized;
        socket.end();
        if (!authorized) {
          resolve({
            status: 'warn',
            detail: `گواهی ${host} نامعتبر یا خودامضا${days != null ? ` · ${days} روز` : ''}`,
            expiresAt,
          });
          return;
        }
        if (days != null && days < 14) {
          resolve({ status: 'warn', detail: `SSL ${host} تا ${days} روز دیگر`, expiresAt });
          return;
        }
        resolve({ status: 'up', detail: `SSL ${host} معتبر${days != null ? ` · ${days} روز` : ''}`, expiresAt });
      }
    );
    socket.on('error', (err) => {
      resolve({ status: 'down', detail: `SSL ${host}: ${err.message}`, expiresAt: null });
    });
    socket.setTimeout(2500, () => {
      socket.destroy();
      resolve({ status: 'warn', detail: `SSL ${host}: timeout`, expiresAt: null });
    });
  });
}

adminOpsRouter.get('/security', async (req, res) => {
  const host = String(process.env.PUBLIC_HOST || 'petdate.ir').replace(/^https?:\/\//, '').split('/')[0]!;
  const ssl = await probeSsl(host);
  const snap = securitySnapshot({ userAgent: req.header('user-agent') || '' });
  res.json({
    ssl,
    frequentLogins: snap.frequent,
    bot: snap.bot,
    bans: snap.bans,
    note: 'شنود PBX زنده وصل نیست — پرچم شنود و URL ضبط در مرکز تماس ذخیره می‌شود.',
  });
});

adminOpsRouter.post('/security/bans', (req, res) => {
  if (!superAdmin(req)) {
    res.status(403).json({ error: 'فقط مدیر کامل می‌تواند IP را مسدود کند' });
    return;
  }
  try {
    const ban = upsertIpBan(String(req.body?.ip || ''), String(req.body?.reason || ''), req.adminActor?.username || '');
    res.status(201).json({ ban });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

adminOpsRouter.delete('/security/bans/:id', (req, res) => {
  if (!superAdmin(req)) {
    res.status(403).json({ error: 'فقط مدیر کامل می‌تواند رفع مسدودیت کند' });
    return;
  }
  res.json({ ok: deleteIpBan(Number(req.params.id)) });
});

adminOpsRouter.get('/calendar-events', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from.slice(0, 10) : '2000-01-01';
  const to = typeof req.query.to === 'string' ? req.query.to.slice(0, 10) : '2999-01-01';
  const map = calendarBuckets(from, to);
  res.json({
    days: Object.entries(map).map(([day, counts]) => ({ day, ...counts })),
  });
});

adminOpsRouter.get('/mail/outbox', (_req, res) => {
  res.json({ messages: listOutbox() });
});

adminOpsRouter.post('/mail/outbox/:id/send', async (req, res) => {
  if (!superAdmin(req)) {
    res.status(403).json({ error: 'ارسال صندوق فقط برای مدیر کامل است' });
    return;
  }
  const id = Number(req.params.id);
  const { isSmtpConfigured, sendMail } = await import('../services/mail');
  if (!isSmtpConfigured()) {
    res.status(202).json({ queued: true, detail: 'SMTP تنظیم نشده — پیام در صف ماند' });
    return;
  }
  const result = await flushOutboxRow(id, async (row) => sendMail({ to: row.to, subject: row.subject, text: row.body, purpose: 'admin_outbox' }));
  res.status(result.ok ? 200 : 502).json(result);
});

adminOpsRouter.post('/mail/outbox', (req, res) => {
  if (!superAdmin(req)) {
    res.status(403).json({ error: 'ارسال صندوق فقط برای مدیر کامل است' });
    return;
  }
  const to = String(req.body?.to || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!to || !subject || !body) {
    res.status(400).json({ error: 'گیرنده، موضوع و متن الزامی است' });
    return;
  }
  const row = queueMail({ to, subject, body, purpose: 'admin_compose', createdBy: req.adminActor?.username || '' });
  res.status(202).json({ queued: true, message: row, detail: 'SMTP در دسترس نیست — در صف ارسال ماند' });
});

export async function flushOutboxRow(
  id: number,
  send: (row: { to: string; subject: string; body: string }) => Promise<{ ok: boolean; error?: string }>
): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  const row = listOutbox(200).find((m) => m.id === id);
  if (!row) return { ok: false, error: 'پیام صف پیدا نشد' };
  const sent = await send(row);
  if (!sent.ok) {
    markOutbox(id, 'failed', sent.error || 'ارسال ناموفق');
    return { ok: false, error: sent.error || 'ارسال ناموفق' };
  }
  markOutbox(id, 'sent');
  return { ok: true };
}
