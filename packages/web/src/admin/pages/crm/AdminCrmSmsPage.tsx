import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CrmCustomer, CrmSmsPattern } from '@petdate/shared';
import { CRM_SMS_TRIGGERS, CRM_SMS_TRIGGER_LABELS } from '@petdate/shared';
import { adminCan } from '../../auth';
import { adminFetch, formatNumFa } from '../../api';

type SmsPanel = { configured: boolean; balance?: number | null; error?: string };

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
    if (!window.confirm(`پترن «${p.name}» حذف شود؟`)) return;
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
      setNotice(`ارسال انجام شد: ${formatNumFa(res.ok)} موفق · ${formatNumFa(res.failed)} ناموفق`);
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
          <h1>پیامک و پترن‌ها</h1>
          <p>پترن‌های ثابت و پویا — ارسال دستی یا خودکار روی مشتریان Pet Date</p>
          {panel ? (
            <p className="crm-sms-panel-status">
              {panel.configured ? (
                <>
                  پنل پیامک متصل
                  {panel.balance != null ? <> · موجودی {formatNumFa(panel.balance)}</> : null}
                  {panel.error ? <> · {panel.error}</> : null}
                </>
              ) : (
                'پنل پیامک پیکربندی نشده'
              )}
            </p>
          ) : null}
        </div>
        {canAdmin ? (
          <button type="button" className="admin-btn admin-btn--primary" onClick={openNew} disabled={busy}>
            پترن جدید
          </button>
        ) : null}
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {notice ? <p className="crm-sms-notice">{notice}</p> : null}

      <div className="crm-sms-layout">
        <section className="admin-card crm-sms-patterns" aria-label="فهرست پترن‌ها">
          <div className="admin-card-head">
            <h2>پترن‌ها</h2>
            <span className="admin-muted">{formatNumFa(patterns.length)} قالب</span>
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
                        {p.type === 'static' ? 'ثابت' : 'پویا'}
                      </span>
                      <span className={`crm-sms-badge ${p.auto ? 'is-auto' : 'is-manual'}`}>
                        {p.auto ? 'ارسال خودکار' : 'ارسال دستی'}
                      </span>
                      {!p.active ? <span className="crm-sms-badge is-off">غیرفعال</span> : null}
                    </div>
                  </div>
                  <p className="crm-sms-trigger">{triggerLabel(p.trigger)}</p>
                  <p className="crm-sms-template">{p.text}</p>
                  {canAdmin ? (
                    <div className="crm-sms-pattern-actions" onClick={(ev) => ev.stopPropagation()}>
                      <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => openEdit(p)}>
                        ویرایش
                      </button>
                      <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => void toggleActive(p)}>
                        {p.active ? 'غیرفعال' : 'فعال'}
                      </button>
                      <button type="button" className="admin-btn admin-btn--danger" disabled={busy} onClick={() => void removePattern(p)}>
                        حذف
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!patterns.length ? <p className="admin-muted">هنوز پترنی ثبت نشده است.</p> : null}
          </div>
        </section>

        <section className="admin-card crm-sms-send" aria-label="ارسال گروهی">
          <div className="admin-card-head">
            <h2>ارسال گروهی</h2>
            <span className="admin-muted">Pet Date</span>
          </div>

          <label className="crm-sms-field">
            <span>پترن</span>
            <select
              className="form-input"
              value={selectedPatternId ?? ''}
              onChange={(e) => setSelectedPatternId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">انتخاب پترن</option>
              {patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {!p.active ? ' (غیرفعال)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="crm-sms-filters">
            <input className="form-input" placeholder="نام یا موبایل" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="form-input" value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">همه محصولات</option>
              {productOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">همه مشتریان</option>
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
                پیش‌نمایش برای {previewCustomer.first} {previewCustomer.last}
              </strong>
              <p>{previewText}</p>
            </div>
          ) : (
            <div className="crm-sms-preview is-empty">
              <p className="admin-muted">برای پیش‌نمایش یک پترن و مشتری انتخاب کنید.</p>
            </div>
          )}

          <div className="crm-sms-send-bar">
            <button type="button" className="admin-btn admin-btn--ghost" onClick={selectAllFiltered}>
              انتخاب همه · {formatNumFa(selectedInView)} از {formatNumFa(filteredCustomers.length)}
            </button>
            {canWrite ? (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={busy || !selectedPatternId || !selectedIds.length || !panel?.configured}
                onClick={() => void sendSelected()}
                title={!panel?.configured ? 'پنل پیامک پیکربندی نشده' : undefined}
              >
                ارسال به انتخاب‌شده‌ها
              </button>
            ) : null}
          </div>

          <div className="admin-table-wrap crm-sms-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>مشتری</th>
                  <th>موبایل</th>
                  <th>محصول</th>
                  <th>سفارش</th>
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
                        aria-label={`انتخاب ${c.first} ${c.last}`}
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
                      مشتری‌ای با این فیلتر پیدا نشد.
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
              <h2>{form.id ? 'ویرایش پترن' : 'پترن جدید'}</h2>
            </div>
            <label className="crm-sms-field">
              <span>نام</span>
              <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="crm-sms-field">
              <span>متن پیامک</span>
              <textarea
                className="form-input"
                rows={4}
                required
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="{name} عزیز، از خرید {product} سپاسگزاریم. تیکت {ticket} — کارشناس {agent}"
              />
            </label>
            <p className="admin-muted crm-sms-vars">
              متغیرها: {'{name}'} · {'{product}'} · {'{ticket}'} · {'{agent}'}
            </p>
            <div className="crm-sms-form-row">
              <label className="crm-sms-field">
                <span>نوع</span>
                <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="dynamic">پویا</option>
                  <option value="static">ثابت</option>
                </select>
              </label>
              <label className="crm-sms-field">
                <span>تریگر</span>
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
                      {CRM_SMS_TRIGGER_LABELS[t]}
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
              ارسال خودکار هنگام تریگر
            </label>
            <label className="crm-sms-check">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              فعال
            </label>
            <div className="crm-sms-modal-actions">
              <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
                ذخیره
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setEditorOpen(false)}>
                انصراف
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
