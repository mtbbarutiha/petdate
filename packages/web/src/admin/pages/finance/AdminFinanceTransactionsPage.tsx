import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { FinanceOsTransaction, FinanceOsTransactionsBundle } from '@petdate/shared';
import { AlertTriangle, Download, Upload } from 'lucide-react';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import {
  FinanceEditToggle,
  FinanceTabs,
  formatMoney,
  formatSignedMoney,
  useFinanceEditMode,
} from './FinanceOsUi';

type Tab = 'import' | 'queue' | 'suspicious' | 'ledger';

export function AdminFinanceTransactionsPage() {
  const canWrite = adminCan('platform.write') || adminCan('admin.full');
  const { editMode, setEditMode } = useFinanceEditMode(canWrite);
  const [tab, setTab] = useState<Tab>('ledger');
  const [data, setData] = useState<FinanceOsTransactionsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [classifyTx, setClassifyTx] = useState<FinanceOsTransaction | null>(null);
  const [classifyForm, setClassifyForm] = useState({
    saleType: 'تیم فروش',
    expenseType: 'مستقیم',
    category: '',
    product: '',
    paymentStatus: 'پرداخت کامل',
    seller: '',
    line: '',
    note: '',
  });
  const [importForm, setImportForm] = useState({
    account: '',
    fileName: 'manual.csv',
    rowsText: '2026-08-20,2500000,واریز نمونه\n2026-08-21,-500000,برداشت نمونه',
  });

  const statusQuery = tab === 'queue' ? 'queued' : tab === 'suspicious' ? 'suspicious' : tab === 'ledger' ? 'classified' : 'all';

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (statusQuery !== 'all') qs.set('status', statusQuery);
      if (accountFilter) qs.set('account', accountFilter);
      if (direction !== 'all' && tab === 'ledger') qs.set('direction', direction);
      setData(await adminFetch<FinanceOsTransactionsBundle>(`/api/admin/finance-os/transactions?${qs}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [statusQuery, accountFilter, direction, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.transactions || [], [data]);

  const openClassify = (t: FinanceOsTransaction) => {
    setClassifyTx(t);
    setClassifyForm({
      saleType: t.saleType || 'تیم فروش',
      expenseType: t.expenseType || 'مستقیم',
      category: t.category || '',
      product: t.product || '',
      paymentStatus: t.paymentStatus || 'پرداخت کامل',
      seller: t.seller || '',
      line: t.line || '',
      note: t.note || '',
    });
  };

  const submitClassify = async (e: FormEvent) => {
    e.preventDefault();
    if (!classifyTx || !editMode) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/finance-os/transactions/${classifyTx.id}/classify`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'classified',
          ...classifyForm,
        }),
      });
      setClassifyTx(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const resolveSuspicious = async (id: number, action: 'keep' | 'merge' | 'discard') => {
    if (!editMode) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/finance-os/transactions/${id}/suspicious`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (e: FormEvent) => {
    e.preventDefault();
    if (!editMode) return;
    const rowsParsed = importForm.rowsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [date, amount, ...rest] = line.split(',');
        return { date: (date || '').trim(), amount: Number(amount), desc: rest.join(',').trim() || 'ورود دستی' };
      })
      .filter((r) => r.date && Number.isFinite(r.amount));
    setBusy(true);
    try {
      const res = await adminFetch<{ imported: number }>('/api/admin/finance-os/transactions/import', {
        method: 'POST',
        body: JSON.stringify({
          account: importForm.account,
          fileName: importForm.fileName,
          method: 'manual',
          rows: rowsParsed,
        }),
      });
      alert(`${formatNumFa(res.imported)} ردیف به صف دسته‌بندی اضافه شد`);
      setTab('queue');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>ورود، دسته‌بندی و دفتر تراکنش‌ها</h1>
          <p>ایمپورت · صف بررسی · مشکوک · دفتر (Ledger)</p>
        </div>
        <div className="admin-header-actions">
          <FinanceEditToggle editMode={editMode} onChange={setEditMode} />
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-stats admin-stats--dense">
        <div className="admin-stat admin-stat--orange">
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.queueCount || 0)}</div>
            <div className="admin-stat-label">صف دسته‌بندی</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--violet">
          <div className="admin-stat-icon"><AlertTriangle size={18} /></div>
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.suspiciousCount || 0)}</div>
            <div className="admin-stat-label">مشکوک</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--mint">
          <div>
            <div className="admin-stat-value">{formatMoney(data?.ledgerSummary.income || 0)}</div>
            <div className="admin-stat-label">کل درآمد</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--sky">
          <div>
            <div className="admin-stat-value">{formatMoney(data?.ledgerSummary.expense || 0)}</div>
            <div className="admin-stat-label">کل هزینه</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--slate">
          <div>
            <div className="admin-stat-value">{formatMoney(data?.ledgerSummary.net || 0)}</div>
            <div className="admin-stat-label">خالص</div>
          </div>
        </div>
      </div>

      <FinanceTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'import', label: 'ورود اطلاعات' },
          { id: 'queue', label: 'صف دسته‌بندی', badge: data?.queueCount },
          { id: 'suspicious', label: 'موارد مشکوک', badge: data?.suspiciousCount },
          { id: 'ledger', label: 'دفتر تراکنش‌ها' },
        ]}
      />

      {tab === 'import' ? (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.2fr 1fr' }}>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head">
              <h2><Upload size={16} style={{ verticalAlign: 'middle' }} /> ورود دستی / فایل</h2>
            </div>
            <form onSubmit={runImport} className="admin-form-grid">
              <label>
                <span className="form-label">حساب</span>
                <select
                  className="form-input"
                  required
                  value={importForm.account}
                  onChange={(e) => setImportForm({ ...importForm, account: e.target.value })}
                  disabled={!editMode}
                >
                  <option value="">انتخاب حساب</option>
                  {(data?.accounts || []).map((a) => (
                    <option key={a.code} value={a.code}>{a.code} — {a.provider}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="form-label">نام فایل</span>
                <input
                  className="form-input"
                  dir="ltr"
                  value={importForm.fileName}
                  disabled={!editMode}
                  onChange={(e) => setImportForm({ ...importForm, fileName: e.target.value })}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <span className="form-label">ردیف‌ها (تاریخ,مبلغ,شرح — هر خط یک تراکنش)</span>
                <textarea
                  className="form-input"
                  rows={8}
                  dir="ltr"
                  value={importForm.rowsText}
                  disabled={!editMode}
                  onChange={(e) => setImportForm({ ...importForm, rowsText: e.target.value })}
                />
              </label>
              <button type="submit" className="admin-btn admin-btn--primary" disabled={!editMode || busy}>
                ورود به صف بررسی
              </button>
            </form>
          </section>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head">
              <h2><Download size={16} style={{ verticalAlign: 'middle' }} /> تاریخچه ورود</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>زمان</th><th>حساب</th><th>فایل</th><th>ردیف</th><th>روش</th><th>وضعیت</th></tr></thead>
                <tbody>
                  {(data?.importLog || []).map((l) => (
                    <tr key={l.id}>
                      <td dir="ltr">{l.at.slice(0, 16).replace('T', ' ')}</td>
                      <td dir="ltr">{l.account}</td>
                      <td>{l.fileName}</td>
                      <td>{formatNumFa(l.rows)}</td>
                      <td>{l.method}</td>
                      <td>{l.status === 'success' ? 'موفق' : 'ناموفق'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'queue' || tab === 'ledger' || tab === 'suspicious' ? (
        <>
          {tab === 'ledger' ? (
            <div className="admin-header-actions" style={{ marginBottom: 12 }}>
              <select className="form-input" style={{ width: 160 }} value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="all">همه جهت‌ها</option>
                <option value="income">درآمد</option>
                <option value="expense">هزینه</option>
                <option value="transfer">انتقال</option>
                <option value="refund">عودت/بازگشت</option>
              </select>
              <select className="form-input" style={{ width: 200 }} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="">همه حساب‌ها</option>
                {(data?.accounts || []).map((a) => (
                  <option key={a.code} value={a.code}>{a.code}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="admin-table-wrap admin-card">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>حساب</th>
                  <th>شرح</th>
                  <th>مبلغ</th>
                  <th>بیزنس</th>
                  <th>نوع / دسته</th>
                  {tab === 'suspicious' ? <th>دلیل</th> : null}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td dir="ltr">{t.date}</td>
                    <td dir="ltr">{t.account}</td>
                    <td>{t.desc}</td>
                    <td style={{ color: t.amount >= 0 ? 'var(--admin-mint, #0f766e)' : 'var(--admin-orange, #c2410c)' }}>
                      {formatSignedMoney(t.amount)}
                    </td>
                    <td>{t.line || '—'}</td>
                    <td>{t.amount >= 0 ? (t.saleType || '—') : (t.category || t.expenseType || '—')}</td>
                    {tab === 'suspicious' ? <td>{t.suspiciousReason || '—'}</td> : null}
                    <td>
                      {tab === 'queue' && editMode ? (
                        <button type="button" className="admin-btn admin-btn--primary" onClick={() => openClassify(t)}>دسته‌بندی</button>
                      ) : null}
                      {tab === 'suspicious' && editMode ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" className="admin-btn" disabled={busy} onClick={() => void resolveSuspicious(t.id, 'keep')}>نگه دار</button>
                          <button type="button" className="admin-btn" disabled={busy} onClick={() => void resolveSuspicious(t.id, 'merge')}>ادغام</button>
                          <button type="button" className="admin-btn" disabled={busy} onClick={() => void resolveSuspicious(t.id, 'discard')}>حذف</button>
                        </div>
                      ) : null}
                      {tab === 'ledger' ? (
                        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => openClassify(t)}>جزئیات</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr><td colSpan={8} className="admin-muted">موردی نیست</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <AdminModal
        open={!!classifyTx}
        onClose={() => setClassifyTx(null)}
        title={tab === 'queue' ? 'دسته‌بندی تراکنش' : 'جزئیات تراکنش'}
      >
        {classifyTx ? (
          <form onSubmit={submitClassify} className="admin-form-grid">
            <ul className="admin-kv" style={{ gridColumn: '1 / -1' }}>
              <li><span>شرح</span><strong>{classifyTx.desc}</strong></li>
              <li><span>مبلغ</span><strong>{formatSignedMoney(classifyTx.amount)}</strong></li>
              <li><span>حساب</span><strong dir="ltr">{classifyTx.account}</strong></li>
            </ul>
            {classifyTx.amount >= 0 ? (
              <>
                <label><span className="form-label">نوع فروش</span>
                  <select className="form-input" disabled={!editMode || tab !== 'queue'} value={classifyForm.saleType} onChange={(e) => setClassifyForm({ ...classifyForm, saleType: e.target.value })}>
                    {['تیم فروش', 'مارکتینگ مستقیم', 'مارکتینگ رزرو', 'تیم آپگرید', 'انتقال-ورودی', 'نامشخص'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label><span className="form-label">محصول</span>
                  <input className="form-input" disabled={!editMode || tab !== 'queue'} value={classifyForm.product} onChange={(e) => setClassifyForm({ ...classifyForm, product: e.target.value })} />
                </label>
                <label><span className="form-label">وضعیت پرداخت</span>
                  <input className="form-input" disabled={!editMode || tab !== 'queue'} value={classifyForm.paymentStatus} onChange={(e) => setClassifyForm({ ...classifyForm, paymentStatus: e.target.value })} />
                </label>
                <label><span className="form-label">فروشنده</span>
                  <input className="form-input" disabled={!editMode || tab !== 'queue'} value={classifyForm.seller} onChange={(e) => setClassifyForm({ ...classifyForm, seller: e.target.value })} />
                </label>
              </>
            ) : (
              <>
                <label><span className="form-label">نوع هزینه</span>
                  <select className="form-input" disabled={!editMode || tab !== 'queue'} value={classifyForm.expenseType} onChange={(e) => setClassifyForm({ ...classifyForm, expenseType: e.target.value })}>
                    {['مستقیم', 'فاکتور هولدینگ', 'عودت', 'بازگشت مبلغ', 'انتقال-خروجی', 'نامشخص'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label><span className="form-label">دسته</span>
                  <input className="form-input" disabled={!editMode || tab !== 'queue'} value={classifyForm.category} onChange={(e) => setClassifyForm({ ...classifyForm, category: e.target.value })} placeholder="مثلاً MARKETING ← تبلیغات-PAID" />
                </label>
              </>
            )}
            <label><span className="form-label">بیزنس‌لاین</span>
              <input className="form-input" disabled={!editMode || tab !== 'queue'} value={classifyForm.line} onChange={(e) => setClassifyForm({ ...classifyForm, line: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}><span className="form-label">یادداشت</span>
              <input className="form-input" disabled={!editMode || tab !== 'queue'} value={classifyForm.note} onChange={(e) => setClassifyForm({ ...classifyForm, note: e.target.value })} />
            </label>
            {tab === 'queue' && editMode ? (
              <div className="admin-header-actions">
                <button type="button" className="admin-btn" onClick={() => setClassifyTx(null)}>انصراف</button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ثبت دسته‌بندی</button>
              </div>
            ) : null}
          </form>
        ) : null}
      </AdminModal>
    </div>
  );
}
