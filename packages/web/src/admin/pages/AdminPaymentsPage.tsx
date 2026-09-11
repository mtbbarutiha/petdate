import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  findCoinPackage,
  makeOrderPublicId,
  paymentPublicIdOf,
  userPublicIdOf,
  type PaymentOrder,
} from '@petdate/shared';
import {
  adminFetch,
  API_BASE,
  formatNumFa,
  formatTomanFa,
  getAdminPassword,
  getAdminUsername,
} from '../api';
import { resolvePublicMediaUrl } from '../../lib/api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';

/** Default: finance approval queue (pending + stuck receipt rows). */
const REVIEW_QUEUE = 'review_queue';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: REVIEW_QUEUE, label: 'صف تأیید مالی (کارت)' },
  { value: 'pending', label: 'در انتظار بررسی (کارت)' },
  { value: '', label: 'همه' },
  { value: 'awaiting_receipt', label: 'منتظر رسید' },
  { value: 'awaiting_stars', label: 'فاکتور Stars' },
  { value: 'paid', label: 'پرداخت‌شده' },
  { value: 'approved', label: 'تأییدشده (کارت)' },
  { value: 'rejected', label: 'ردشده' },
  { value: 'cancelled', label: 'لغو' },
];

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
}

function packageLabel(o: PaymentOrder): string {
  const pkg = o.packageId || '—';
  if (pkg === 'shopxtr') return 'پت شاپ · Stars تلگرام';
  if (pkg === 'shopwallet') return 'پت شاپ · ستاره پنل';
  if (pkg === 'shopcoins') return 'پت شاپ · سکه پنل';
  if (pkg === 'shoptoman') return 'پت شاپ · ریال پنل';
  if (pkg === 'shopcard') return 'پت شاپ · کارت‌به‌کارت';
  if (pkg.startsWith('wstars:')) return `کیف‌پول Stars · ${pkg}`;
  const coinPkg = findCoinPackage(pkg);
  if (coinPkg) return `${coinPkg.label} · ${formatNumFa(coinPkg.coins)} سکه`;
  if (o.coins > 0) return `${formatNumFa(o.coins)} سکه`;
  return pkg;
}

function amountLabel(o: PaymentOrder): string {
  const parts: string[] = [];
  if (o.amountToman != null) parts.push(formatTomanFa(o.amountToman));
  if (o.amountStars != null && o.method === 'stars') {
    parts.push(`${formatNumFa(o.amountStars)}⭐`);
  }
  return parts.length ? parts.join(' / ') : '—';
}

function parseShopMeta(note?: string): { shopOrderId?: number; titleHint?: string } | null {
  if (!note?.trim().startsWith('{')) return null;
  try {
    const j = JSON.parse(note) as { kind?: string; shopOrderId?: number; titleHint?: string };
    if (
      j?.kind === 'shopxtr' ||
      j?.kind === 'shopwallet' ||
      j?.kind === 'shopcoins' ||
      j?.kind === 'shopcard' ||
      j?.kind === 'shoptoman'
    ) {
      return { shopOrderId: j.shopOrderId, titleHint: j.titleHint };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function receiptHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const pwd = getAdminPassword();
  if (pwd) headers['x-admin-password'] = pwd;
  const user = getAdminUsername();
  if (user) headers['x-admin-username'] = user;
  return headers;
}

function canDecide(o: PaymentOrder): boolean {
  return o.method === 'card' && o.status === 'pending';
}

function AdminPaymentReceiptImg({ order }: { order: PaymentOrder }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let revoked = '';
    let cancelled = false;
    const raw = String(order.receiptUrl || order.receiptFileId || '').trim();
    if (!raw) return;
    if (raw.startsWith('/api/payments/receipts/')) {
      void (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/admin/payments/${order.id}/receipt`, {
            headers: receiptHeaders(),
          });
          if (!res.ok) return;
          const blob = await res.blob();
          if (cancelled) return;
          revoked = URL.createObjectURL(blob);
          setSrc(revoked);
        } catch {
          /* ignore */
        }
      })();
    } else {
      setSrc(resolvePublicMediaUrl(raw));
    }
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [order.id, order.receiptFileId, order.receiptUrl]);

  if (!src) return null;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img
        src={src}
        alt="رسید"
        style={{
          width: 160,
          maxHeight: 200,
          objectFit: 'cover',
          borderRadius: 8,
          border: '1px solid var(--admin-border, #e5e7eb)',
        }}
      />
    </a>
  );
}

export function AdminPaymentsPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [status, setStatus] = useState(REVIEW_QUEUE);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await adminFetch<{ orders: PaymentOrder[] }>(`/api/admin/payments${qs}`);
      setOrders(data.orders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: number) => {
    setBusyId(id);
    try {
      await adminFetch(`/api/admin/payments/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: number) => {
    const note = prompt('دلیل رد (اختیاری)') || undefined;
    setBusyId(id);
    try {
      await adminFetch(`/api/admin/payments/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>صف تأیید واریز / کارت‌به‌کارت</h1>
          <p>
            {formatNumFa(orders.length)} مورد — تأیید رسید شارژ سکه و شاپ در پنل مالی (هم‌تراز کیف
            پول کاربر)
          </p>
        </div>
        <div
          className="admin-header-actions"
          style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Link to="/admin/finance" className="admin-btn ghost">
            داشبورد مالی
          </Link>
          <Link to="/admin/finance/wallet" className="admin-btn ghost">
            لجر کیف پول
          </Link>
          <Link to="/admin/finance/transactions" className="admin-btn ghost">
            Finance OS
          </Link>
          <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value || 'all'} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>آیدی</th>
              <th>کاربر</th>
              <th>بسته / منبع</th>
              <th>مبلغ</th>
              <th>روش</th>
              <th>وضعیت</th>
              <th>زمان</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const open = openId === o.id;
              const shopMeta = parseShopMeta(o.adminNote);
              const hasReceipt = Boolean(o.receiptUrl || o.receiptFileId);
              return (
                <Fragment key={o.id}>
                  <tr>
                    <td>
                      <div className="admin-cell-compact">
                        <AdminIdChip publicId={paymentPublicIdOf(o)} />
                        <span className="admin-muted" dir="ltr">
                          #{o.id}
                        </span>
                      </div>
                    </td>
                    <td>
                      <AdminEntityCell
                        thumb={
                          <AdminThumb
                            src={o.userAvatarUrl}
                            label={o.userName}
                            kind="user"
                            alt={o.userName || 'کاربر'}
                          />
                        }
                        title={o.userName || '—'}
                        subtitle={
                          <div className="admin-cell-compact">
                            <code className="admin-mono admin-id-public" dir="ltr">
                              {userPublicIdOf({ id: o.userId })}
                            </code>
                            {o.userUsername ? (
                              <span className="admin-muted" dir="ltr">
                                @{o.userUsername}
                              </span>
                            ) : null}
                          </div>
                        }
                      />
                    </td>
                    <td>
                      <div className="admin-cell-compact">
                        <span>{packageLabel(o)}</span>
                        {shopMeta?.titleHint ? (
                          <span className="admin-muted">{shopMeta.titleHint}</span>
                        ) : null}
                        {shopMeta?.shopOrderId != null ? (
                          <span className="admin-muted" dir="ltr">
                            سفارش شاپ {makeOrderPublicId(shopMeta.shopOrderId)}
                          </span>
                        ) : null}
                        {o.transferRef ? (
                          <span className="admin-muted" dir="ltr">
                            پیگیری: {o.transferRef}
                          </span>
                        ) : null}
                        {hasReceipt ? (
                          <span className="admin-muted">رسید دارد</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="admin-cell-nowrap">{amountLabel(o)}</td>
                    <td>
                      {o.method === 'stars'
                        ? '⭐ Stars'
                        : o.method === 'coins'
                          ? '🪙 سکه'
                          : o.method === 'toman'
                            ? '﷼ ریال'
                            : o.method === 'card'
                              ? 'کارت'
                              : o.method}
                    </td>
                    <td>
                      <span className="admin-badge">{statusLabel(o.status)}</span>
                    </td>
                    <td className="admin-cell-nowrap">{formatAdminFaDateTime(o.createdAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-btn ghost"
                          onClick={() => setOpenId(open ? null : o.id)}
                        >
                          {open ? 'بستن' : 'جزئیات'}
                        </button>
                        {canDecide(o) ? (
                          <>
                            <button
                              type="button"
                              className="admin-btn admin-btn--primary"
                              disabled={busyId === o.id}
                              onClick={() => void approve(o.id)}
                            >
                              تأیید
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--danger"
                              disabled={busyId === o.id}
                              onClick={() => void reject(o.id)}
                            >
                              رد
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={8}>
                        <div
                          className="admin-muted"
                          style={{
                            whiteSpace: 'pre-wrap',
                            padding: '0.5rem 0',
                            display: 'grid',
                            gap: 12,
                            gridTemplateColumns: hasReceipt ? '160px 1fr' : '1fr',
                          }}
                        >
                          {hasReceipt ? <AdminPaymentReceiptImg order={o} /> : null}
                          <div>
                            {o.telegramPaymentChargeId
                              ? `charge: ${o.telegramPaymentChargeId}\n`
                              : ''}
                            {o.transferRef ? `پیگیری واریز: ${o.transferRef}\n` : ''}
                            {o.reviewedAt
                              ? `reviewed: ${formatAdminFaDateTime(o.reviewedAt)}\n`
                              : ''}
                            {o.adminNote || 'بدون یادداشت'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!orders.length ? (
              <tr>
                <td colSpan={8} className="admin-muted">
                  {status === REVIEW_QUEUE
                    ? 'صف تأیید خالی است — واریز منتظر تأییدی نیست.'
                    : status
                      ? `موردی با وضعیت «${statusLabel(status)}» نیست — فیلتر را روی «صف تأیید مالی» یا «همه» بگذارید.`
                      : 'هنوز پرداختی ثبت نشده.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
