import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { FinanceOsAccountsBundle, FinanceOsAccount, FinanceOsPerson } from '@petdate/shared';
import { Landmark, Plus } from 'lucide-react';
import { adminFetch, formatNumFa, formatYearFa } from '../../api';
import { formatAdminFaDate } from '../../JalaliDateSelect';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { FinanceEditToggle, FinanceTabs, formatMoney, useFinanceEditMode } from './FinanceOsUi';
import { tr } from '../../../i18n';

type Tab = 'accounts' | 'snappay' | 'income' | 'expense' | 'people';

export function AdminFinanceAccountsPage() {
  const canWrite = adminCan('finance.write') || adminCan('admin.full');
  const { editMode, setEditMode } = useFinanceEditMode(canWrite);
  const [tab, setTab] = useState<Tab>('accounts');
  const [data, setData] = useState<FinanceOsAccountsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [selected, setSelected] = useState<FinanceOsAccount | null>(null);
  const [personDetail, setPersonDetail] = useState<FinanceOsPerson | null>(null);
  const [form, setForm] = useState({
    code: '',
    type: 'بانک رسمی',
    dedication: 'اختصاصی',
    provider: '',
    line: 'پت‌دیت',
    openingBalance: '0',
    accountNumber: '',
    iban: '',
  });
  const [personForm, setPersonForm] = useState({
    name: '',
    role: '',
    dept: '',
    line: 'پت‌دیت',
    sales: true,
    teamCode: '',
  });

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<FinanceOsAccountsBundle>('/api/admin/finance-os/accounts'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeAccounts = useMemo(
    () => (data?.accounts || []).filter((a) => a.status === 'active'),
    [data]
  );

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!editMode) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/finance-os/accounts', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          openingBalance: Number(form.openingBalance) || 0,
        }),
      });
      setAccountOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const createPerson = async (e: FormEvent) => {
    e.preventDefault();
    if (!editMode) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/finance-os/people', {
        method: 'POST',
        body: JSON.stringify({
          ...personForm,
          teamCode: personForm.teamCode || null,
        }),
      });
      setPersonOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const addDimItem = async (kind: 'income' | 'expense', key: string, item: string) => {
    if (!editMode || !item.trim() || !data) return;
    const groups = kind === 'income' ? data.incomeDims : data.expenseDims;
    const g = groups.find((x) => x.key === key);
    if (!g) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/finance-os/dims', {
        method: 'PUT',
        body: JSON.stringify({ kind, key, items: [...g.items, item.trim()] }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const renderCategoryTree = (nodes: FinanceOsAccountsBundle['categoryTree'], depth = 0) => (
    <ul style={{ listStyle: 'none', paddingInlineStart: depth ? 16 : 0, margin: 0 }}>
      {nodes.map((n) => (
        <li key={`${depth}-${n.name}`} style={{ marginBottom: 6 }}>
          <span className="admin-badge admin-badge--info">{n.name}</span>
          {n.children?.length ? renderCategoryTree(n.children, depth + 1) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('حساب‌ها و داده‌های پایه')}</h1>
          <p>{tr('بانک · اسنپ‌پی · طبقه‌بندی درآمد/هزینه · افراد و بخش‌ها')}</p>
        </div>
        <div className="admin-header-actions">
          <FinanceEditToggle editMode={editMode} onChange={setEditMode} />
          {editMode && tab === 'accounts' ? (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => {
                setForm({
                  code: '',
                  type: 'بانک رسمی',
                  dedication: 'اختصاصی',
                  provider: '',
                  line: data?.businesses[0]?.name || 'پت‌دیت',
                  openingBalance: '0',
                  accountNumber: '',
                  iban: '',
                });
                setAccountOpen(true);
              }}
            >
              <Plus size={16} /> {tr('حساب جدید')}
            </button>
          ) : null}
          {editMode && tab === 'people' ? (
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => setPersonOpen(true)}>
              <Plus size={16} /> {tr('فرد جدید')}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-stats admin-stats--dense">
        <div className="admin-stat admin-stat--mint">
          <div className="admin-stat-icon"><Landmark size={18} /></div>
          <div>
            <div className="admin-stat-value">{formatNumFa(activeAccounts.length)}</div>
            <div className="admin-stat-label">{tr('حساب فعال')}</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--sky">
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.people.length || 0)}</div>
            <div className="admin-stat-label">{tr('افراد')}</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--violet">
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.businesses.length || 0)}</div>
            <div className="admin-stat-label">{tr('بیزنس‌لاین')}</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--slate">
          <div>
            <div className="admin-stat-value">{formatMoney(activeAccounts.reduce((s, a) => s + a.currentBalance, 0))}</div>
            <div className="admin-stat-label">{tr('جمع موجودی')}</div>
          </div>
        </div>
      </div>

      <FinanceTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'accounts', label: 'حساب‌ها' },
          { id: 'snappay', label: 'اسنپ‌پی' },
          { id: 'income', label: 'طبقه‌بندی درآمد' },
          { id: 'expense', label: 'طبقه‌بندی هزینه' },
          { id: 'people', label: 'افراد و بخش‌ها' },
        ]}
      />

      {!data ? <p className="admin-muted">{tr('در حال بارگذاری…')}</p> : null}

      {data && tab === 'accounts' ? (
        <div className="admin-table-wrap admin-card">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>{tr('کد')}</th>
                <th>{tr('نوع')}</th>
                <th>{tr('ارائه‌دهنده')}</th>
                <th>{tr('بیزنس‌لاین')}</th>
                <th>{tr('اختصاص')}</th>
                <th>{tr('موجودی')}</th>
                <th>{tr('وضعیت')}</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(a)}>
                  <td dir="ltr">{a.code}</td>
                  <td>{a.type}</td>
                  <td>{a.provider}</td>
                  <td>{a.line}</td>
                  <td>{a.dedication}</td>
                  <td>{formatMoney(a.currentBalance)}</td>
                  <td>{a.status === 'active' ? tr('فعال') : tr('غیرفعال')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data && tab === 'snappay' ? (
        <section className="admin-card" style={{ padding: 16 }}>
          <div className="admin-card-head">
            <h2>{tr('اسنپ‌پی (BNPL مشترک)')}</h2>
            <span className="admin-muted">{tr('کارمزد ارائه‌دهنده + حاشیه پلتفرم')}</span>
          </div>
          <ul className="admin-kv">
            <li><span>{tr('کارمزد ارائه‌دهنده')}</span><strong>{formatNumFa(data.snappay.providerFeePercent)}{tr('٪')}</strong></li>
            <li><span>{tr('حاشیه پلتفرم')}</span><strong>{formatNumFa(data.snappay.sbgMarginPercent)}{tr('٪')}</strong></li>
            <li><span>{tr('جمع کارمزد')}</span><strong>{formatNumFa(data.snappay.providerFeePercent + data.snappay.sbgMarginPercent)}{tr('٪')}</strong></li>
          </ul>
          <h3 style={{ marginTop: 20, fontSize: '0.95rem' }}>{tr('تخصیص حجم ماهانه')}</h3>
          {(data.snappay.volumes || []).length === 0 ? (
            <p className="admin-muted">{tr('حجمی ثبت نشده')}</p>
          ) : (
            data.snappay.volumes.map((v) => (
              <div key={`${v.jy}-${v.jm}`} style={{ marginTop: 12 }}>
                <p className="admin-muted">{tr('ماه')} {formatNumFa(v.jm)} / {formatYearFa(v.jy)}</p>
                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--dense">
                    <thead><tr><th>{tr('بیزنس')}</th><th>{tr('حجم')}</th></tr></thead>
                    <tbody>
                      {v.allocations.map((al) => (
                        <tr key={al.business}><td>{al.business}</td><td>{formatMoney(al.amount)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
          {data.accounts.find((a) => a.code === 'L-SNAPAY')?.refunds?.length ? (
            <>
              <h3 style={{ marginTop: 20, fontSize: '0.95rem' }}>{tr('عودت‌ها')}</h3>
              <div className="admin-table-wrap">
                <table className="admin-table admin-table--dense">
                  <thead><tr><th>{tr('تاریخ')}</th><th>{tr('بیزنس')}</th><th>{tr('مبلغ')}</th><th>{tr('یادداشت')}</th></tr></thead>
                  <tbody>
                    {data.accounts.find((a) => a.code === 'L-SNAPAY')!.refunds.map((r, i) => (
                      <tr key={i}><td>{formatAdminFaDate(r.date)}</td><td>{r.business}</td><td>{formatMoney(r.amount)}</td><td>{r.note || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {data && tab === 'income' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {data.incomeDims.map((g) => (
            <section key={g.key} className="admin-card" style={{ padding: 16 }}>
              <div className="admin-card-head">
                <h2>{g.key} <span className="admin-muted">({formatNumFa(g.items.length)} {tr('مورد)')}</span></h2>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.items.map((item) => (
                  <span key={item} className="admin-badge">{item}</span>
                ))}
              </div>
              {editMode ? (
                <DimAddRow onAdd={(v) => void addDimItem('income', g.key, v)} disabled={busy} />
              ) : null}
            </section>
          ))}
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('فروشندگان')}</h2><span className="admin-muted">{tr('از افراد واجد فروش')}</span></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>{tr('نام')}</th><th>{tr('سمت')}</th><th>{tr('بخش')}</th><th>{tr('تیم')}</th></tr></thead>
                <tbody>
                  {data.people.filter((p) => p.sales).map((p) => (
                    <tr key={p.id}><td>{p.name}</td><td>{p.role}</td><td>{p.dept}</td><td dir="ltr">{p.teamCode || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {data && tab === 'expense' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {data.expenseDims.map((g) => (
            <section key={g.key} className="admin-card" style={{ padding: 16 }}>
              <div className="admin-card-head">
                <h2>{g.key} <span className="admin-muted">({formatNumFa(g.items.length)} {tr('مورد)')}</span></h2>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.items.map((item) => (
                  <span key={item} className="admin-badge">{item}</span>
                ))}
              </div>
              {editMode ? (
                <DimAddRow onAdd={(v) => void addDimItem('expense', g.key, v)} disabled={busy} />
              ) : null}
            </section>
          ))}
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('درخت دسته‌بندی هزینه')}</h2></div>
            {renderCategoryTree(data.categoryTree)}
          </section>
        </div>
      ) : null}

      {data && tab === 'people' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('افراد و بخش‌ها')}</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>{tr('نام')}</th><th>{tr('کسب‌وکار')}</th><th>{tr('سمت')}</th><th>{tr('بخش')}</th><th>{tr('تیم')}</th></tr></thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setPersonDetail(p)}>
                      <td>{p.name}</td><td>{p.line}</td><td>{p.role}</td><td>{p.dept}</td><td dir="ltr">{p.teamCode || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('تیم‌های فروش')}</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>{tr('کد')}</th><th>{tr('سرپرست')}</th></tr></thead>
                <tbody>
                  {data.salesTeams.map((t) => (
                    <tr key={t.id}><td dir="ltr">{t.code}</td><td>{t.supervisor}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('کسب‌وکارها')}</h2></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.businesses.map((b) => (
                <span key={b.id} className="admin-badge">{b.name} <span className="admin-muted" dir="ltr">({b.code})</span></span>
              ))}
            </div>
          </section>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('دفاتر')}</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>{tr('نام')}</th><th>{tr('آدرس')}</th><th>{tr('متراژ')}</th></tr></thead>
                <tbody>
                  {data.offices.map((o) => (
                    <tr key={o.id}><td>{o.name}</td><td>{o.address}</td><td>{formatNumFa(o.totalSqm)} {tr('م²')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      <AdminModal open={accountOpen} onClose={() => setAccountOpen(false)} title={tr("حساب جدید")}>
        <form onSubmit={createAccount} className="admin-form-grid">
          <label><span className="form-label">{tr('کد')}</span><input className="form-input" dir="ltr" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label><span className="form-label">{tr('نوع')}</span>
            <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {[tr('بانک رسمی'), tr('درگاه پرداخت'), 'BNPL', tr('کیف پول نقدی'), tr('چک / اسناد')].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label><span className="form-label">{tr('ارائه‌دهنده')}</span><input className="form-input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></label>
          <label><span className="form-label">{tr('بیزنس‌لاین')}</span>
            <select className="form-input" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })}>
              {(data?.businesses || []).map((b) => <option key={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label><span className="form-label">{tr('موجودی اولیه')}</span><input className="form-input" dir="ltr" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} /></label>
          <label><span className="form-label">{tr('شماره حساب')}</span><input className="form-input" dir="ltr" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></label>
          <label><span className="form-label">{tr('شبا')}</span><input className="form-input" dir="ltr" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></label>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn" onClick={() => setAccountOpen(false)}>{tr('انصراف')}</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ثبت')}</button>
          </div>
        </form>
      </AdminModal>

      <AdminModal open={personOpen} onClose={() => setPersonOpen(false)} title={tr("فرد جدید")}>
        <form onSubmit={createPerson} className="admin-form-grid">
          <label><span className="form-label">{tr('نام')}</span><input className="form-input" required value={personForm.name} onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })} /></label>
          <label><span className="form-label">{tr('سمت')}</span><input className="form-input" value={personForm.role} onChange={(e) => setPersonForm({ ...personForm, role: e.target.value })} /></label>
          <label><span className="form-label">{tr('بخش')}</span><input className="form-input" value={personForm.dept} onChange={(e) => setPersonForm({ ...personForm, dept: e.target.value })} /></label>
          <label><span className="form-label">{tr('بیزنس‌لاین')}</span>
            <select className="form-input" value={personForm.line} onChange={(e) => setPersonForm({ ...personForm, line: e.target.value })}>
              {(data?.businesses || []).map((b) => <option key={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label><span className="form-label">{tr('تیم فروش')}</span>
            <select className="form-input" value={personForm.teamCode} onChange={(e) => setPersonForm({ ...personForm, teamCode: e.target.value })}>
              <option value="">—</option>
              {(data?.salesTeams || []).map((t) => <option key={t.id} value={t.code}>{t.code} — {t.supervisor}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={personForm.sales} onChange={(e) => setPersonForm({ ...personForm, sales: e.target.checked })} />
            {tr('واجد فروش')}
          </label>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn" onClick={() => setPersonOpen(false)}>{tr('انصراف')}</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ثبت')}</button>
          </div>
        </form>
      </AdminModal>

      <AdminModal open={!!selected} onClose={() => setSelected(null)} title={selected?.code || tr('حساب')}>
        {selected ? (
          <ul className="admin-kv">
            <li><span>{tr('نوع')}</span><strong>{selected.type}</strong></li>
            <li><span>{tr('ارائه‌دهنده')}</span><strong>{selected.provider}</strong></li>
            <li><span>{tr('بیزنس‌لاین')}</span><strong>{selected.line}</strong></li>
            <li><span>{tr('اختصاص')}</span><strong>{selected.dedication}</strong></li>
            <li><span>{tr('موجودی')}</span><strong>{formatMoney(selected.currentBalance)}</strong></li>
            <li><span>{tr('شماره حساب')}</span><strong dir="ltr">{selected.accountNumber || '—'}</strong></li>
            <li><span>{tr('شبا')}</span><strong dir="ltr">{selected.iban || '—'}</strong></li>
            <li><span>{tr('کارت')}</span><strong dir="ltr">{selected.cardNumber || '—'}</strong></li>
            <li><span>{tr('اتصال')}</span><strong>{selected.connectionType}</strong></li>
            <li><span>{tr('یادداشت')}</span><strong>{selected.notes || '—'}</strong></li>
          </ul>
        ) : null}
      </AdminModal>

      <AdminModal open={!!personDetail} onClose={() => setPersonDetail(null)} title={personDetail?.name || tr('فرد')}>
        {personDetail ? (
          <>
            <ul className="admin-kv">
              <li><span>{tr('سمت')}</span><strong>{personDetail.role}</strong></li>
              <li><span>{tr('بخش')}</span><strong>{personDetail.dept}</strong></li>
              <li><span>{tr('بیزنس')}</span><strong>{personDetail.line}</strong></li>
              <li><span>{tr('تیم')}</span><strong dir="ltr">{personDetail.teamCode || '—'}</strong></li>
            </ul>
            <h3 style={{ fontSize: '0.95rem' }}>{tr('پرداخت‌ها')}</h3>
            {personDetail.payments.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table admin-table--dense">
                  <thead><tr><th>{tr('ماه')}</th><th>{tr('نوع')}</th><th>{tr('مبلغ')}</th><th>{tr('یادداشت')}</th></tr></thead>
                  <tbody>
                    {personDetail.payments.map((p, i) => (
                      <tr key={i}><td>{formatNumFa(p.jm)}/{formatYearFa(p.jy)}</td><td>{p.type}</td><td>{formatMoney(p.amount)}</td><td>{p.note || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="admin-muted">{tr('پرداختی ثبت نشده')}</p>}
          </>
        ) : null}
      </AdminModal>
    </div>
  );
}

function DimAddRow({ onAdd, disabled }: { onAdd: (v: string) => void; disabled?: boolean }) {
  const [v, setV] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <input className="form-input" placeholder={tr("مورد جدید")} value={v} onChange={(e) => setV(e.target.value)} />
      <button
        type="button"
        className="admin-btn"
        disabled={disabled || !v.trim()}
        onClick={() => {
          onAdd(v);
          setV('');
        }}
      >
        {tr('افزودن')}
      </button>
    </div>
  );
}
