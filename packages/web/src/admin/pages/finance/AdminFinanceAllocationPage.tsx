import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FinanceOsAllocationBundle, FinanceOsSbgExpense } from '@petdate/shared';
import { Building2, Cpu, FileText, Users } from 'lucide-react';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { FinanceEditToggle, FinanceTabs, formatMoney, useFinanceEditMode } from './FinanceOsUi';

type Tab = 'offices' | 'people' | 'equipment' | 'allocation' | 'invoices' | 'bank';

/** Holding / shared lines excluded from per-business cost splits (legacy SBG name kept for old DBs). */
const NON_ALLOCATABLE_BUSINESSES = new Set(['هلدینگ', 'SBG', 'مشترک هلدینگ']);

export function AdminFinanceAllocationPage() {
  const canWrite = adminCan('platform.write') || adminCan('admin.full');
  const { editMode, setEditMode } = useFinanceEditMode(canWrite);
  const [tab, setTab] = useState<Tab>('allocation');
  const [data, setData] = useState<FinanceOsAllocationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allocTarget, setAllocTarget] = useState<FinanceOsSbgExpense | null>(null);
  const [splitText, setSplitText] = useState('');
  const [bankDraft, setBankDraft] = useState('');
  const [invoiceBiz, setInvoiceBiz] = useState('هایپاد');

  const load = useCallback(async () => {
    try {
      const bundle = await adminFetch<FinanceOsAllocationBundle>('/api/admin/finance-os/allocation');
      setData(bundle);
      setBankDraft(String(bundle.bankBalance));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => (data?.expenses || []).filter((e) => !e.allocated), [data]);
  const allocated = useMemo(() => (data?.expenses || []).filter((e) => e.allocated), [data]);

  const openAlloc = (e: FinanceOsSbgExpense) => {
    setAllocTarget(e);
    const abs = Math.abs(e.amount);
    const biz = (data?.businesses || []).filter((b) => !NON_ALLOCATABLE_BUSINESSES.has(b.name));
    if (!biz.length) {
      setSplitText('');
      return;
    }
    const each = Math.floor(abs / biz.length);
    const lines = biz.map((b, i) => {
      const amount = i === biz.length - 1 ? abs - each * (biz.length - 1) : each;
      return `${b.name}:${amount}`;
    });
    setSplitText(lines.join('\n'));
  };

  const submitAlloc = async () => {
    if (!allocTarget || !editMode) return;
    const splits = splitText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [business, amount] = l.split(':');
        return { business: (business || '').trim(), amount: Number(amount), basis: 'دستی' };
      })
      .filter((s) => s.business && Number.isFinite(s.amount));
    setBusy(true);
    try {
      await adminFetch(`/api/admin/finance-os/allocation/expenses/${allocTarget.id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ splits }),
      });
      setAllocTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const issueInvoice = async () => {
    if (!editMode || !data) return;
    const lines = allocated
      .flatMap((e) => e.splits.filter((s) => s.business === invoiceBiz).map((s) => ({
        desc: e.desc,
        category: e.category,
        amount: s.amount,
      })));
    if (!lines.length) {
      alert('برای این بیزنس خط تخصیص‌یافته‌ای نیست');
      return;
    }
    setBusy(true);
    try {
      await adminFetch('/api/admin/finance-os/allocation/invoices', {
        method: 'POST',
        body: JSON.stringify({ business: invoiceBiz, jy: 1405, jm: 5, lines }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const saveBank = async () => {
    if (!editMode) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/finance-os/allocation/bank-balance', {
        method: 'PATCH',
        body: JSON.stringify({ bankBalance: Number(bankDraft) || 0 }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const markDone = async (id: number) => {
    if (!editMode) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/finance-os/allocation/commitments/${id}/done`, { method: 'POST', body: '{}' });
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
          <h1>تخصیص هزینه</h1>
          <p>دفاتر · افراد · تجهیزات · تخصیص · فاکتورها · بانک</p>
        </div>
        <div className="admin-header-actions">
          <FinanceEditToggle editMode={editMode} onChange={setEditMode} />
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-stats admin-stats--dense">
        <div className="admin-stat admin-stat--sky">
          <div className="admin-stat-icon"><Building2 size={18} /></div>
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.offices.length || 0)}</div>
            <div className="admin-stat-label">دفاتر</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--violet">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.sbgPeople.length || 0)}</div>
            <div className="admin-stat-label">افراد ستاد</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--orange">
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.pendingAllocationCount || 0)}</div>
            <div className="admin-stat-label">در انتظار تخصیص</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--mint">
          <div>
            <div className="admin-stat-value">{formatMoney(data?.bankBalance || 0)}</div>
            <div className="admin-stat-label">موجودی بانک هلدینگ</div>
          </div>
        </div>
      </div>

      <FinanceTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'offices', label: 'دفاتر' },
          { id: 'people', label: 'افراد' },
          { id: 'equipment', label: 'تجهیزات' },
          { id: 'allocation', label: 'تخصیص', badge: data?.pendingAllocationCount },
          { id: 'invoices', label: 'فاکتورها' },
          { id: 'bank', label: 'بانک هلدینگ' },
        ]}
      />

      {!data ? <p className="admin-muted">در حال بارگذاری…</p> : null}

      {data && tab === 'offices' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {data.offices.map((o) => (
            <section key={o.id} className="admin-card" style={{ padding: 16 }}>
              <div className="admin-card-head">
                <h2>{o.name}</h2>
                <span className="admin-muted">{o.address} · {formatNumFa(o.totalSqm)} م²</span>
              </div>
              {o.areas.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--dense">
                    <thead><tr><th>فضا</th><th>متراژ</th><th>اجاره ماهانه</th><th>بیزنس</th></tr></thead>
                    <tbody>
                      {o.areas.map((a) => (
                        <tr key={a.id}>
                          <td>{a.name}</td>
                          <td>{formatNumFa(a.sqm)}</td>
                          <td>{formatMoney(a.monthlyRent)}</td>
                          <td>{a.assignedBusiness || 'مشترک'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="admin-muted">فضایی تعریف نشده</p>}
              {o.spaceAllocations[0] ? (
                <p className="admin-muted" style={{ marginTop: 8 }}>
                  تخصیص متراژ {formatNumFa(o.spaceAllocations[0].jm)}/{formatNumFa(o.spaceAllocations[0].jy)}:{' '}
                  {o.spaceAllocations[0].allocations.map((a) => `${a.business} ${formatNumFa(a.sqm)}م²`).join(' · ')}
                </p>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      {data && tab === 'people' ? (
        <div className="admin-table-wrap admin-card">
          <table className="admin-table admin-table--dense">
            <thead><tr><th>نام</th><th>سمت</th><th>دفتر</th><th>روش</th><th>تخصیص زمان (آخرین)</th></tr></thead>
            <tbody>
              {data.sbgPeople.map((p) => {
                const last = p.timeAllocations[p.timeAllocations.length - 1];
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.role}</td>
                    <td>{p.office}</td>
                    <td>{p.allocationMethod === 'auto' ? 'خودکار' : 'دستی'}</td>
                    <td>
                      {last
                        ? last.allocations.map((a) => `${a.business} ${formatNumFa(a.percent)}٪`).join(' · ')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {data && tab === 'equipment' ? (
        <div className="admin-table-wrap admin-card">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>کد</th><th>نام</th><th>دسته</th><th>خرید</th><th>ارزش فعلی</th>
                <th>نرخ ماهانه</th><th>بیزنس</th><th>فرد</th>
              </tr>
            </thead>
            <tbody>
              {data.equipment.map((eq) => (
                <tr key={eq.id}>
                  <td dir="ltr">{eq.code}</td>
                  <td>{eq.name}</td>
                  <td>{eq.category}</td>
                  <td>{formatMoney(eq.purchasePrice)}</td>
                  <td>{formatMoney(eq.currentValue)}</td>
                  <td>{formatMoney(eq.monthlyRate)}</td>
                  <td>{eq.assignedBusiness}</td>
                  <td>{eq.assignedPerson || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="admin-muted" style={{ padding: 12 }}>
            <Cpu size={14} style={{ verticalAlign: 'middle' }} /> جمع ارزش فعلی:{' '}
            {formatMoney(data.equipment.reduce((s, e) => s + e.currentValue, 0))}
          </p>
        </div>
      ) : null}

      {data && tab === 'allocation' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>در انتظار تخصیص</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>تاریخ</th><th>شرح</th><th>دسته</th><th>مبلغ</th><th>فرد</th><th></th></tr></thead>
                <tbody>
                  {pending.map((e) => (
                    <tr key={e.id}>
                      <td dir="ltr">{e.date}</td>
                      <td>{e.desc}</td>
                      <td>{e.category}</td>
                      <td>{formatMoney(Math.abs(e.amount))}</td>
                      <td>{e.relatedPerson || '—'}</td>
                      <td>
                        {editMode ? (
                          <button type="button" className="admin-btn admin-btn--primary" onClick={() => openAlloc(e)}>تخصیص</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!pending.length ? <tr><td colSpan={6} className="admin-muted">همه تخصیص شده‌اند</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>تخصیص‌یافته</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>شرح</th><th>مبلغ</th><th>تقسیم</th></tr></thead>
                <tbody>
                  {allocated.map((e) => (
                    <tr key={e.id}>
                      <td>{e.desc}</td>
                      <td>{formatMoney(Math.abs(e.amount))}</td>
                      <td>{e.splits.map((s) => `${s.business} ${formatMoney(s.amount)}`).join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-header-actions" style={{ marginTop: 12 }}>
              <select className="form-input" style={{ width: 180 }} value={invoiceBiz} onChange={(e) => setInvoiceBiz(e.target.value)}>
                {(data.businesses || []).filter((b) => !NON_ALLOCATABLE_BUSINESSES.has(b.name)).map((b) => (
                  <option key={b.id}>{b.name}</option>
                ))}
              </select>
              {editMode ? (
                <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void issueInvoice()}>
                  <FileText size={16} /> صدور فاکتور برای {invoiceBiz}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {data && tab === 'invoices' ? (
        <div className="admin-table-wrap admin-card">
          <table className="admin-table admin-table--dense">
            <thead><tr><th>شماره</th><th>بیزنس</th><th>دوره</th><th>جمع</th><th>وضعیت</th><th>خطوط</th></tr></thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td dir="ltr">{inv.number}</td>
                  <td>{inv.business}</td>
                  <td>{formatNumFa(inv.jm)}/{formatNumFa(inv.jy)}</td>
                  <td>{formatMoney(inv.total)}</td>
                  <td>{inv.status === 'issued' ? 'صادر شده' : inv.status === 'paid' ? 'پرداخت‌شده' : 'پیش‌نویس'}</td>
                  <td>{formatNumFa(inv.lines.length)}</td>
                </tr>
              ))}
              {!data.invoices.length ? <tr><td colSpan={6} className="admin-muted">فاکتوری نیست</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {data && tab === 'bank' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>موجودی بانک / صندوق هلدینگ</h2></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="form-input"
                dir="ltr"
                style={{ width: 220 }}
                value={bankDraft}
                disabled={!editMode}
                onChange={(e) => setBankDraft(e.target.value)}
              />
              {editMode ? (
                <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void saveBank()}>
                  ذخیره موجودی
                </button>
              ) : null}
              <span className="admin-muted">نمایش: {formatMoney(data.bankBalance)}</span>
            </div>
          </section>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>تعهدات</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>شرح</th><th>دسته</th><th>مبلغ</th><th>سررسید</th><th>وضعیت</th><th></th></tr></thead>
                <tbody>
                  {data.commitments.map((c) => (
                    <tr key={c.id}>
                      <td>{c.desc}</td>
                      <td>{c.category}</td>
                      <td>{formatMoney(c.amount)}</td>
                      <td dir="ltr">{c.dueDate}</td>
                      <td>{c.status === 'done' ? 'انجام‌شده' : 'در انتظار'}</td>
                      <td>
                        {editMode && c.status === 'pending' ? (
                          <button type="button" className="admin-btn" disabled={busy} onClick={() => void markDone(c.id)}>
                            تسویه از موجودی
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      <AdminModal open={!!allocTarget} onClose={() => setAllocTarget(null)} title="تخصیص هزینه به بیزنس‌لاین‌ها">
        {allocTarget ? (
          <div className="admin-form-grid">
            <ul className="admin-kv" style={{ gridColumn: '1 / -1' }}>
              <li><span>شرح</span><strong>{allocTarget.desc}</strong></li>
              <li><span>مبلغ</span><strong>{formatMoney(Math.abs(allocTarget.amount))}</strong></li>
              <li><span>دسته</span><strong>{allocTarget.category}</strong></li>
            </ul>
            <label style={{ gridColumn: '1 / -1' }}>
              <span className="form-label">تقسیم (هر خط: بیزنس:مبلغ)</span>
              <textarea className="form-input" rows={6} dir="rtl" value={splitText} onChange={(e) => setSplitText(e.target.value)} />
            </label>
            <div className="admin-header-actions">
              <button type="button" className="admin-btn" onClick={() => setAllocTarget(null)}>انصراف</button>
              <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void submitAlloc()}>ثبت تخصیص</button>
            </div>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
