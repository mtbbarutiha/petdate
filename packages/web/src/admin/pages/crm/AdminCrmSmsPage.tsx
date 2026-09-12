import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CrmCustomer, CrmSmsPattern } from '@petdate/shared';
import { CRM_SMS_TRIGGERS, CRM_SMS_TRIGGER_LABELS } from '@petdate/shared';
import { adminCan } from '../../auth';
import { adminFetch, formatNumFa } from '../../api';
import { appConfirm } from '../../../components/AppDialog';
import { tr } from '../../../i18n';

type SmsPanel = {
  configured: boolean;
  balance?: number | null;
  currency?: 'rial' | string;
  error?: string;
};

type PatternForm = {
  id?: number;
  name: string;
  type: string;
  text: string;
  trigger: string;
  auto: boolean;
  active: boolean;
};

const EMPTY_FORM: PatternForm = {
  name: '',
  type: 'dynamic',
  text: '',
  trigger: 'manual',
  auto: false,
  active: true,
};

function triggerLabel(key: string): string {
  return (CRM_SMS_TRIGGER_LABELS as Record<string, string>)[key] || key;
}

function renderPreview(text: string, customer: CrmCustomer | undefined, agentName: string): string {
  const fullName = customer ? `${customer.first} ${customer.last}`.trim() : '';
  const name = fullName || customer?.first || 'مشتری';
  const product = customer?.product || 'Pet Date';
  const ticket = 'TK-۱۲۳۴';
  const agent = agentName || 'کارشناس';
  return text
    .replace(/\{name\}/gi, name)
    .replace(/\{product\}/gi, product)
    .replace(/\{ticket\}/gi, ticket)
    .replace(/\{agent\}/gi, agent)
    .replace(/\{نام\}/g, name)
    .replace(/\{محصول\}/g, product)
    .replace(/\{شناسه\}/g, ticket)
    .replace(/\{کارشناس\}/g, agent);
}

export function AdminCrmSmsPage() {
  const [patterns, setPatterns] = useState<CrmSmsPattern[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [panel, setPanel] = useState<SmsPanel | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [q, setQ] = useState('');
  const [product, setProduct] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<PatternForm>(EMPTY_FORM);

  const canAdmin = adminCan('crm.admin');
  const canWrite = adminCan('crm.write');

  const load = useCallback(() => {
    void adminFetch<{ patterns: CrmSmsPattern[]; panel?: SmsPanel }>('/api/admin/crm/sms')
      .then((d) => {
        setPatterns(d.patterns);
        setPanel(d.panel || null);
        setError(null);
        setSelectedPatternId((prev) => {
          if (prev && d.patterns.some((p) => p.id === prev)) return prev;
          return d.patterns[0]?.id ?? null;
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا در بارگذاری پترن‌ها'));

    void adminFetch<{ customers: CrmCustomer[] }>('/api/admin/crm/customers?limit=200')
      .then((d) => setCustomers(d.customers))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPattern = patterns.find((p) => p.id === selectedPatternId) || null;

  const productOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      if (c.product?.trim()) set.add(c.product.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fa'));
  }, [customers]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      if (c.status?.trim()) set.add(c.status.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fa'));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (product && c.product !== product) return false;
      if (status && c.status !== status) return false;
      if (!needle) return true;
      return `${c.first} ${c.last} ${c.mobile}`.toLowerCase().includes(needle);
    });
  }, [customers, product, q, status]);

  const previewCustomer = useMemo(() => {
    if (!filteredCustomers.length) return undefined;
    return filteredCustomers.find((c) => selectedIds.includes(c.id)) || filteredCustomers[0];
  }, [filteredCustomers, selectedIds]);

  const previewText = selectedPattern
    ? renderPreview(selectedPattern.text, previewCustomer, 'کارشناس پشتیبانی')
    : '';

  function openNew() {
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  }

  function openEdit(p: CrmSmsPattern) {
    setForm({
      id: p.id,
      name: p.name,
      type: p.type === 'static' ? 'static' : 'dynamic',
      text: p.text,
      trigger: p.trigger || 'manual',
      auto: p.auto,
      active: p.active,
    });
    setEditorOpen(true);
  }

  async function savePattern(e: FormEvent) {
    e.preventDefault();
    if (!canAdmin) return;
    setBusy(true);
    setNotice(null);
    try {
      await adminFetch('/api/admin/crm/sms/patterns', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setEditorOpen(false);
      setForm(EMPTY_FORM);
      setNotice(form.id ? 'پترن ذخیره شد' : 'پترن جدید ساخته شد');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: CrmSmsPattern) {
    if (!canAdmin) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/crm/sms/patterns', {
        method: 'POST',
        body: JSON.stringify({
          id: p.id,
          name: p.name,
          type: p.type,
          text: p.text,
          trigger: p.trigger,
          auto: p.auto,
          active: !p.active,
        }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'به‌روزرسانی ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function removePattern(p: CrmSmsPattern) {
    if (!canAdmin) return;
    if (!(await appConfirm(`${tr('پترن «')}${p.name}${tr('» حذف شود؟')}`, { danger: true, variant: 'admin' }))) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/crm/sms/patterns/${p.id}`, { method: 'DELETE' });
      if (selectedPatternId === p.id) setSelectedPatternId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف ناموفق');
    } finally {
      setBusy(false);
    }
  }

  function toggleCustomer(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllFiltered() {
    const ids = filteredCustomers.map((c) => c.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(
      allSelected ? selectedIds.filter((id) => !ids.includes(id)) : [...new Set([...selectedIds, ...ids])]
    );
  }

  async function sendSelected() {
    if (!canWrite || !selectedPatternId || !selectedIds.length) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await adminFetch<{ ok: number; failed: number }>('/api/admin/crm/sms/send-bulk', {
        method: 'POST',
        body: JSON.stringify({ patternId: selectedPatternId, customerIds: selectedIds }),
      });
      setNotice(`${tr('ارسال انجام شد: ')}${formatNumFa(res.ok)}${tr(' موفق · ')}${formatNumFa(res.failed)}${tr(' ناموفق')}`);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال ناموفق');
    } finally {
      setBusy(false);
    }
  }

  const selectedInView = filteredCustomers.filter((c) => selectedIds.includes(c.id)).length;

  return (
    <div className="admin-page crm-sms-page">
      <header className="admin-header crm-sms-header">
        <div>
          <h1>{tr('پیامک و پترن‌ها')}</h1>
          <p>{tr('پترن‌های ثابت و پویا — ارسال دستی یا خودکار روی مشتریان Pet Date')}</p>
          {panel ? (
            panel.configured ? (
              <div className="crm-sms-panel-meta">
                <p className="crm-sms-panel-status">{tr('پنل پیامک متصل')}</p>
                {panel.balance != null ? (
                  <p className="crm-sms-balance" aria-live="polite">
                    <span className="crm-sms-balance-label">{tr('موجودی')}:</span>{' '}
                    <strong className="crm-sms-balance-value" dir="ltr">
                      {formatNumFa(panel.balance)}
                    </strong>{' '}
                    <span className="crm-sms-balance-unit">{tr('ریال')}</span>
                  </p>
                ) : panel.error ? (
                  <p className="crm-sms-panel-status crm-sms-panel-status--warn">{panel.error}</p>
                ) : (
                  <p className="crm-sms-panel-status">{tr('در حال خواندن موجودی…')}</p>
                )}
              </div>
            ) : (
              <p className="crm-sms-panel-status">{tr('پنل پیامک پیکربندی نشده')}</p>
            )
          ) : null}
        </div>
        {canAdmin ? (
          <button type="button" className="admin-btn admin-btn--primary" onClick={openNew} disabled={busy}>
            {tr('پترن جدید')}
          </button>
        ) : null}
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {notice ? <p className="crm-sms-notice">{notice}</p> : null}

      <div className="crm-sms-layout">
        <section className="admin-card crm-sms-patterns" aria-label={tr("فهرست پترن‌ها")}>
          <div className="admin-card-head">
            <h2>{tr('پترن‌ها')}</h2>
            <span className="admin-muted">{formatNumFa(patterns.length)} {tr('قالب')}</span>
          </div>
          <div className="crm-sms-pattern-list">
            {patterns.map((p) => {
              const active = selectedPatternId === p.id;
              return (
                <article
                  key={p.id}
                  className={`crm-sms-pattern-card${active ? ' is-active' : ''}${p.active ? '' : ' is-disabled'}`}
                  onClick={() => setSelectedPatternId(p.id)}
                >
                  <div className="crm-sms-pattern-top">
                    <h3>{p.name}</h3>
                    <div className="crm-sms-badges">
                      <span className={`crm-sms-badge ${p.type === 'static' ? 'is-static' : 'is-dynamic'}`}>
                        {p.type === 'static' ? tr('ثابت') : tr('پویا')}
                      </span>
                      <span className={`crm-sms-badge ${p.auto ? 'is-auto' : 'is-manual'}`}>
                        {p.auto ? tr('ارسال خودکار') : tr('ارسال دستی')}
                      </span>
                      {!p.active ? <span className="crm-sms-badge is-off">{tr('غیرفعال')}</span> : null}
                    </div>
                  </div>
                  <p className="crm-sms-trigger">{triggerLabel(p.trigger)}</p>
                  <p className="crm-sms-template">{tr(p.text)}</p>
                  {canAdmin ? (
                    <div className="crm-sms-pattern-actions" onClick={(ev) => ev.stopPropagation()}>
                      <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => openEdit(p)}>
                        {tr('ویرایش')}
                      </button>
                      <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => void toggleActive(p)}>
                        {p.active ? tr('غیرفعال') : tr('فعال')}
                      </button>
                      <button type="button" className="admin-btn admin-btn--danger" disabled={busy} onClick={() => void removePattern(p)}>
                        {tr('حذف')}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!patterns.length ? <p className="admin-muted">{tr('هنوز پترنی ثبت نشده است.')}</p> : null}
          </div>
        </section>

        <section className="admin-card crm-sms-send" aria-label={tr("ارسال گروهی")}>
          <div className="admin-card-head">
            <h2>{tr('ارسال گروهی')}</h2>
            <span className="admin-muted">Pet Date</span>
          </div>

          <label className="crm-sms-field">
            <span>{tr('پترن')}</span>
            <select
              className="form-input"
              value={selectedPatternId ?? ''}
              onChange={(e) => setSelectedPatternId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{tr('انتخاب پترن')}</option>
              {patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {!p.active ? tr(' (غیرفعال)') : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="crm-sms-filters">
            <input className="form-input" placeholder={tr("نام یا موبایل")} value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="form-input" value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">{tr('همه محصولات')}</option>
              {productOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{tr('همه مشتریان')}</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {selectedPattern && previewCustomer ? (
            <div className="crm-sms-preview">
              <strong>
                {tr('پیش‌نمایش برای')} {previewCustomer.first} {previewCustomer.last}
              </strong>
              <p>{previewText}</p>
            </div>
          ) : (
            <div className="crm-sms-preview is-empty">
              <p className="admin-muted">{tr('برای پیش‌نمایش یک پترن و مشتری انتخاب کنید.')}</p>
            </div>
          )}

          <div className="crm-sms-send-bar">
            <button type="button" className="admin-btn admin-btn--ghost" onClick={selectAllFiltered}>
              {tr('انتخاب همه ·')} {formatNumFa(selectedInView)} {tr('از')} {formatNumFa(filteredCustomers.length)}
            </button>
            {canWrite ? (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={busy || !selectedPatternId || !selectedIds.length || !panel?.configured}
                onClick={() => void sendSelected()}
                title={!panel?.configured ? tr('پنل پیامک پیکربندی نشده') : undefined}
              >
                {tr('ارسال به انتخاب‌شده‌ها')}
              </button>
            ) : null}
          </div>

          <div className="admin-table-wrap crm-sms-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>{tr('مشتری')}</th>
                  <th>{tr('موبایل')}</th>
                  <th>{tr('محصول')}</th>
                  <th>{tr('سفارش')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className={selectedIds.includes(c.id) ? 'is-selected' : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleCustomer(c.id)}
                        aria-label={`${tr('انتخاب ')}${c.first} ${c.last}`}
                      />
                    </td>
                    <td>
                      {c.first} {c.last}
                      <div className="admin-muted">{c.status}</div>
                    </td>
                    <td dir="ltr">{c.mobile}</td>
                    <td>
                      <span className="crm-sms-product-pill">{c.product || 'Pet Date'}</span>
                    </td>
                    <td>{formatNumFa(c.orderCount ?? 0)}</td>
                  </tr>
                ))}
                {!filteredCustomers.length ? (
                  <tr>
                    <td colSpan={5} className="admin-muted">
                      {tr('مشتری‌ای با این فیلتر پیدا نشد.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editorOpen ? (
        <div className="crm-sms-modal-backdrop" role="presentation" onClick={() => !busy && setEditorOpen(false)}>
          <form className="admin-card crm-sms-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void savePattern(e)}>
            <div className="admin-card-head">
              <h2>{form.id ? tr('ویرایش پترن') : tr('پترن جدید')}</h2>
            </div>
            <label className="crm-sms-field">
              <span>{tr('نام')}</span>
              <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="crm-sms-field">
              <span>{tr('متن پیامک')}</span>
              <textarea
                className="form-input"
                rows={4}
                required
                value={tr(form.text)}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder={tr("{name} عزیز، از خرید {product} سپاسگزاریم. تیکت {ticket} — کارشناس {agent}")}
              />
            </label>
            <p className="admin-muted crm-sms-vars">
              {tr('متغیرها:')} {'{name}'} · {'{product}'} · {'{ticket}'} · {'{agent}'}
            </p>
            <div className="crm-sms-form-row">
              <label className="crm-sms-field">
                <span>{tr('نوع')}</span>
                <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="dynamic">{tr('پویا')}</option>
                  <option value="static">{tr('ثابت')}</option>
                </select>
              </label>
              <label className="crm-sms-field">
                <span>{tr('تریگر')}</span>
                <select
                  className="form-input"
                  value={form.trigger}
                  onChange={(e) => {
                    const trigger = e.target.value;
                    setForm({ ...form, trigger, auto: trigger === 'manual' ? false : form.auto });
                  }}
                >
                  {CRM_SMS_TRIGGERS.map((t) => (
                    <option key={t} value={t}>
                      {tr(CRM_SMS_TRIGGER_LABELS[t])}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="crm-sms-check">
              <input
                type="checkbox"
                checked={form.auto}
                disabled={form.trigger === 'manual'}
                onChange={(e) => setForm({ ...form, auto: e.target.checked })}
              />
              {tr('ارسال خودکار هنگام تریگر')}
            </label>
            <label className="crm-sms-check">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {tr('فعال')}
            </label>
            <div className="crm-sms-modal-actions">
              <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
                {tr('ذخیره')}
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setEditorOpen(false)}>
                {tr('انصراف')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
