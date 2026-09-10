import { Fragment, useCallback, useEffect, useState } from 'react';
import { makeOrderPublicId, paymentPublicIdOf, userPublicIdOf, type PaymentOrder } from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'همه' },
  { value: 'pending', label: 'در انتظار بررسی (کارت)' },
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
  if (o.coins > 0) return `${pkg} · ${formatNumFa(o.coins)} سکه`;
  return pkg;
}

function amountLabel(o: PaymentOrder): string {
  const parts: string[] = [];
  if (o.amountToman != null) parts.push(formatTomanFa(o.amountToman));
  if (o.amountStars != null) parts.push(`${formatNumFa(o.amountStars)}⭐`);
  return parts.length ? parts.join(' / ') : '—';
}

function parseShopMeta(note?: string): { shopOrderId?: number; titleHint?: string } | null {
  if (!note?.trim().startsWith('{')) return null;
  try {
    const j = JSON.parse(note) as { kind?: string; shopOrderId?: number; titleHint?: string };
    if (j?.kind === 'shopxtr' || j?.kind === 'shopwallet' || j?.kind === 'shopcoins' || j?.kind === 'shopcard' || j?.kind === 'shoptoman') {
      return { shopOrderId: j.shopOrderId, titleHint: j.titleHint };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AdminPaymentsPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

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
    try {
      await adminFetch(`/api/admin/payments/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const reject = async (id: number) => {
    const note = prompt('دلیل رد (اختیاری)') || undefined;
    try {
      await adminFetch(`/api/admin/payments/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>پرداخت‌ها</h1>
          <p>
            {formatNumFa(orders.length)} مورد — کارت‌به‌کارت، سکه، Stars و شاپ
          </p>
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value || 'all'} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
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
              return (
                <Fragment key={o.id}>
                  <tr>
                    <td>
                      <AdminIdChip publicId={paymentPublicIdOf(o)} />
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
                              <span className="admin-muted" dir="ltr">@{o.userUsername}</span>
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
                        {o.status === 'pending' && o.method === 'card' ? (
                          <>
                            <button
                              type="button"
                              className="admin-btn admin-btn--primary"
                              onClick={() => void approve(o.id)}
                            >
                              تأیید
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--danger"
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
                        <div className="admin-muted" style={{ whiteSpace: 'pre-wrap', padding: '0.5rem 0' }}>
                          {o.telegramPaymentChargeId
                            ? `charge: ${o.telegramPaymentChargeId}\n`
                            : ''}
                          {o.receiptFileId ? `receipt: ${o.receiptFileId}\n` : ''}
                          {o.reviewedAt
                            ? `reviewed: ${formatAdminFaDateTime(o.reviewedAt)}\n`
                            : ''}
                          {o.adminNote || 'بدون یادداشت'}
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
                  {status
                    ? `موردی با وضعیت «${statusLabel(status)}» نیست — فیلتر را روی «همه» بگذارید.`
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
