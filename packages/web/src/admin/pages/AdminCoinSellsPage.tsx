import { useCallback, useEffect, useState } from 'react';
import type { CoinSellRequestAdmin, CoinSellRequestStatus } from '@petdate/shared';
import {
  COIN_SELL_CHANNEL_LABELS_FA,
  COIN_SELL_STATUS_LABELS_FA,
  formatCardGrouped,
} from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { adminCan } from '../auth';
import { tr } from '../../i18n';

const STATUS_OPTIONS: { value: CoinSellRequestStatus | 'all'; label: string }[] = [
  { value: 'open', label: 'صف باز (در انتظار واریز)' },
  { value: 'all', label: 'همه' },
  { value: 'paid', label: 'پرداخت‌شده' },
  { value: 'rejected', label: 'ردشده' },
];

export function AdminCoinSellsPage() {
  const canWrite = adminCan('finance.write') || adminCan('platform.write') || adminCan('admin.full');
  const [status, setStatus] = useState<CoinSellRequestStatus | 'all'>('open');
  const [items, setItems] = useState<CoinSellRequestAdmin[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ requests: CoinSellRequestAdmin[]; openCount: number }>(
        `/api/admin/coin-sells?status=${encodeURIComponent(status)}`
      );
      setItems(data.requests);
      setOpenCount(data.openCount);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: number, action: 'paid' | 'reject') => {
    const note =
      action === 'reject'
        ? window.prompt(tr('دلیل رد (اختیاری)')) ?? ''
        : window.prompt(tr('یادداشت واریز (اختیاری)')) ?? '';
    if (action === 'reject' && note === null) return;
    setBusyId(id);
    try {
      await adminFetch(`/api/admin/coin-sells/${id}/${action}`, {
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
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div>
          <h1>{tr('صف فروش سکه')}</h1>
          <p>
            {tr('درخواست‌های برداشت از وب و ربات — سکه هنگام ثبت کسر شده؛ رد = بازگشت سکه')}
            {' · '}
            {formatNumFa(openCount)} {tr('باز')}
          </p>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-toolbar" style={{ marginBottom: 12 }}>
        <select
          className="admin-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as CoinSellRequestStatus | 'all')}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {tr(o.label)}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-table-wrap admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{tr('کاربر')}</th>
              <th>{tr('منبع')}</th>
              <th>{tr('سکه')}</th>
              <th>{tr('مبلغ تومان')}</th>
              <th>{tr('شماره کارت')}</th>
              <th>{tr('وضعیت')}</th>
              <th>{tr('زمان')}</th>
              <th>{tr('عملیات')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.userName || '—'}</strong>
                  <div className="admin-muted" dir="ltr">
                    {r.userPhone || r.userTelegramId || r.userPublicId || '—'}
                  </div>
                </td>
                <td>{tr(COIN_SELL_CHANNEL_LABELS_FA[r.channel] || r.channel || '—')}</td>
                <td>{formatNumFa(r.coins)}</td>
                <td>{formatTomanFa(r.amountToman)}</td>
                <td dir="ltr">{formatCardGrouped(r.cardNumber) || r.cardMasked}</td>
                <td>{tr(COIN_SELL_STATUS_LABELS_FA[r.status] || r.status)}</td>
                <td>{formatAdminFaDateTime(r.createdAt)}</td>
                <td>
                  {r.status === 'open' && canWrite ? (
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        disabled={busyId === r.id}
                        onClick={() => void decide(r.id, 'paid')}
                      >
                        {tr('واریز شد')}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        disabled={busyId === r.id}
                        onClick={() => void decide(r.id, 'reject')}
                      >
                        {tr('رد و بازگشت سکه')}
                      </button>
                    </div>
                  ) : (
                    r.adminNote || '—'
                  )}
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={8} className="admin-muted">
                  {tr('درخواستی نیست')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
