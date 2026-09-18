import { useState, type ReactNode } from 'react';
import { AdminModal } from '../../AdminModal';
import { tr } from '../../../i18n';
import {
  buildCommitmentBody,
  buildEquipmentBody,
  buildExpenseBody,
  buildInvoiceBody,
  buildOfficeCreateBody,
  buildPersonBody,
  type CommitmentForm,
  type EquipmentForm,
  type ExpenseForm,
  type InvoiceForm,
  type OfficeCreateForm,
  type PersonForm,
} from './financeAllocationPayload';

type Named = { id: number; name: string };

function newAreaId(): string {
  return `area-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}

function ModalActions({
  busy,
  disabled,
  onClose,
  submitLabel,
}: {
  busy: boolean;
  disabled?: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="admin-header-actions">
      <button type="button" className="admin-btn" disabled={busy} onClick={onClose}>
        {tr('انصراف')}
      </button>
      <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || disabled}>
        {submitLabel}
      </button>
    </div>
  );
}

export function OfficeCreateDialog({
  businesses,
  busy,
  onClose,
  onSubmit,
}: {
  businesses: Named[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: ReturnType<typeof buildOfficeCreateBody>) => void;
}) {
  const [form, setForm] = useState<OfficeCreateForm>({
    name: '',
    address: '',
    totalSqm: '',
    monthlyRent: '',
    areas: [],
  });

  return (
    <AdminModal open as="form" busy={busy} title={tr('دفتر جدید')} onClose={onClose} onSubmit={(e) => {
      e.preventDefault();
      onSubmit(buildOfficeCreateBody(form));
    }}>
      <div className="admin-form-grid">
        <Field label={tr('نام')}>
          <input className="form-input" value={form.name} required aria-label={tr('نام')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label={tr('شهر / منطقه')}>
          <input className="form-input" value={form.address} aria-label={tr('شهر / منطقه')} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label={tr('متراژ کل')}>
          <input className="form-input" dir="ltr" value={form.totalSqm} inputMode="decimal" aria-label={tr('متراژ کل')} onChange={(e) => setForm({ ...form, totalSqm: e.target.value })} />
        </Field>
        <Field label={tr('اجاره ماهانه')}>
          <input className="form-input" dir="ltr" value={form.monthlyRent} inputMode="numeric" aria-label={tr('اجاره ماهانه')} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} />
        </Field>
        <p className="admin-muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
          {tr('اگر فضایی اضافه نکنید، اجاره ماهانه برای کل دفتر ثبت می‌شود.')}
        </p>
        {form.areas.map((area, index) => (
          <div key={area.id} className="admin-card" style={{ gridColumn: '1 / -1', padding: 12, display: 'grid', gap: 8 }}>
            <Field label={tr('فضا')}>
              <input className="form-input" value={area.name} aria-label={tr('فضا')} onChange={(e) => {
                const areas = form.areas.slice();
                areas[index] = { ...area, name: e.target.value };
                setForm({ ...form, areas });
              }} />
            </Field>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="form-input" dir="ltr" style={{ width: 100 }} value={area.sqm} aria-label={tr('متراژ')} onChange={(e) => {
                const areas = form.areas.slice();
                areas[index] = { ...area, sqm: e.target.value };
                setForm({ ...form, areas });
              }} />
              <input className="form-input" dir="ltr" style={{ width: 140 }} value={area.monthlyRent} aria-label={tr('اجاره ماهانه')} onChange={(e) => {
                const areas = form.areas.slice();
                areas[index] = { ...area, monthlyRent: e.target.value };
                setForm({ ...form, areas });
              }} />
              <select className="form-input" style={{ flex: '1 1 140px' }} value={area.assignedBusiness} aria-label={tr('بیزنس')} onChange={(e) => {
                const areas = form.areas.slice();
                areas[index] = { ...area, assignedBusiness: e.target.value };
                setForm({ ...form, areas });
              }}>
                <option value="">{tr('مشترک')}</option>
                {businesses.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setForm({ ...form, areas: form.areas.filter((a) => a.id !== area.id) })}>
                {tr('حذف')}
              </button>
            </div>
          </div>
        ))}
        <div className="admin-header-actions" style={{ gridColumn: '1 / -1' }}>
          <button
            type="button"
            className="admin-btn"
            onClick={() => setForm({
              ...form,
              areas: [...form.areas, { id: newAreaId(), name: '', sqm: '', monthlyRent: '', assignedBusiness: '' }],
            })}
          >
            {tr('افزودن فضا')}
          </button>
        </div>
        <ModalActions busy={busy} disabled={!form.name.trim()} onClose={onClose} submitLabel={tr('ایجاد دفتر')} />
      </div>
    </AdminModal>
  );
}

export function PersonDialog({
  initial,
  offices,
  busy,
  onClose,
  onSubmit,
}: {
  initial: PersonForm;
  offices: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (id: number | null, body: ReturnType<typeof buildPersonBody>) => void;
}) {
  const [form, setForm] = useState(initial);
  const officeOptions = form.office && !offices.includes(form.office) ? [form.office, ...offices] : offices;
  return (
    <AdminModal
      open
      as="form"
      busy={busy}
      title={form.id ? tr('ویرایش فرد') : tr('فرد جدید')}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form.id, buildPersonBody(form));
      }}
    >
      <div className="admin-form-grid">
        <Field label={tr('نام')}>
          <input className="form-input" value={form.name} required aria-label={tr('نام')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label={tr('سمت')}>
          <input className="form-input" value={form.role} aria-label={tr('سمت')} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        </Field>
        <Field label={tr('دفتر')}>
          <select className="form-input" value={form.office} aria-label={tr('دفتر')} onChange={(e) => setForm({ ...form, office: e.target.value })}>
            <option value="">—</option>
            {officeOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label={tr('روش')}>
          <select className="form-input" value={form.allocationMethod} aria-label={tr('روش')} onChange={(e) => setForm({ ...form, allocationMethod: e.target.value === 'manual' ? 'manual' : 'auto' })}>
            <option value="auto">{tr('خودکار')}</option>
            <option value="manual">{tr('دستی')}</option>
          </select>
        </Field>
        <ModalActions busy={busy} disabled={!form.name.trim()} onClose={onClose} submitLabel={tr('ثبت')} />
      </div>
    </AdminModal>
  );
}

export function EquipmentDialog({
  initial,
  businesses,
  people,
  busy,
  onClose,
  onSubmit,
}: {
  initial: EquipmentForm;
  businesses: Named[];
  people: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (id: number | null, body: ReturnType<typeof buildEquipmentBody>) => void;
}) {
  const [form, setForm] = useState(initial);
  const bizOptions = form.assignedBusiness && !businesses.some((b) => b.name === form.assignedBusiness)
    ? [{ id: -1, name: form.assignedBusiness }, ...businesses]
    : businesses;
  const personOptions = form.assignedPerson && !people.includes(form.assignedPerson)
    ? [form.assignedPerson, ...people]
    : people;
  return (
    <AdminModal
      open
      as="form"
      busy={busy}
      title={form.id ? tr('ویرایش تجهیز') : tr('تجهیز جدید')}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form.id, buildEquipmentBody(form));
      }}
    >
      <div className="admin-form-grid">
        <Field label={tr('نام')}>
          <input className="form-input" value={form.name} required aria-label={tr('نام')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label={tr('دسته')}>
          <input className="form-input" value={form.category} aria-label={tr('دسته')} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <Field label={tr('خرید')}>
          <input className="form-input" dir="ltr" value={form.purchasePrice} inputMode="numeric" aria-label={tr('خرید')} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
        </Field>
        <Field label={tr('ارزش فعلی')}>
          <input className="form-input" dir="ltr" value={form.currentValue} inputMode="numeric" aria-label={tr('ارزش فعلی')} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} />
        </Field>
        <Field label={tr('نرخ ماهانه')}>
          <input className="form-input" dir="ltr" value={form.monthlyRate} inputMode="numeric" aria-label={tr('نرخ ماهانه')} onChange={(e) => setForm({ ...form, monthlyRate: e.target.value })} />
        </Field>
        <Field label={tr('بیزنس')}>
          <select className="form-input" value={form.assignedBusiness} aria-label={tr('بیزنس')} onChange={(e) => setForm({ ...form, assignedBusiness: e.target.value })}>
            <option value="">—</option>
            {bizOptions.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        </Field>
        <Field label={tr('فرد')}>
          <select className="form-input" value={form.assignedPerson} aria-label={tr('فرد')} onChange={(e) => setForm({ ...form, assignedPerson: e.target.value })}>
            <option value="">—</option>
            {personOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <ModalActions busy={busy} disabled={!form.name.trim()} onClose={onClose} submitLabel={tr('ثبت')} />
      </div>
    </AdminModal>
  );
}

export function ExpenseDialog({
  initial,
  offices,
  people,
  busy,
  onClose,
  onSubmit,
}: {
  initial: ExpenseForm;
  offices: string[];
  people: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (id: number | null, body: ReturnType<typeof buildExpenseBody>) => void;
}) {
  const [form, setForm] = useState(initial);
  return (
    <AdminModal
      open
      as="form"
      busy={busy}
      title={form.id ? tr('ویرایش هزینه') : tr('هزینه جدید')}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form.id, buildExpenseBody(form));
      }}
    >
      <div className="admin-form-grid">
        <Field label={tr('شرح')}>
          <input className="form-input" value={form.desc} required aria-label={tr('شرح')} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        </Field>
        <Field label={tr('دسته')}>
          <input className="form-input" value={form.category} aria-label={tr('دسته')} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <Field label={tr('مبلغ')}>
          <input className="form-input" dir="ltr" value={form.amount} inputMode="numeric" required aria-label={tr('مبلغ')} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label={tr('تاریخ')}>
          <input className="form-input" dir="ltr" type="date" value={form.date} aria-label={tr('تاریخ')} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label={tr('دفتر')}>
          <select className="form-input" value={form.office} aria-label={tr('دفتر')} onChange={(e) => setForm({ ...form, office: e.target.value })}>
            <option value="">—</option>
            {offices.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label={tr('فرد')}>
          <select className="form-input" value={form.relatedPerson} aria-label={tr('فرد')} onChange={(e) => setForm({ ...form, relatedPerson: e.target.value })}>
            <option value="">—</option>
            {people.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <ModalActions busy={busy} disabled={!form.desc.trim() || !(Number(form.amount) > 0)} onClose={onClose} submitLabel={form.id ? tr('ثبت') : tr('ایجاد تخصیص')} />
      </div>
    </AdminModal>
  );
}

export function InvoiceDialog({
  initial,
  businesses,
  busy,
  onClose,
  onSubmit,
}: {
  initial: InvoiceForm;
  businesses: Named[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (id: number | null, body: ReturnType<typeof buildInvoiceBody>) => void;
}) {
  const [form, setForm] = useState(initial);
  const patchLine = (index: number, patch: Partial<InvoiceForm['lines'][number]>) => {
    const lines = form.lines.slice();
    lines[index] = { ...lines[index], ...patch };
    setForm({ ...form, lines });
  };
  return (
    <AdminModal
      open
      as="form"
      busy={busy}
      size="lg"
      title={form.id ? tr('ویرایش فاکتور') : tr('فاکتور جدید')}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form.id, buildInvoiceBody(form));
      }}
    >
      <div className="admin-form-grid">
        <Field label={tr('بیزنس')}>
          <select className="form-input" value={form.business} aria-label={tr('بیزنس')} onChange={(e) => setForm({ ...form, business: e.target.value })}>
            {businesses.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        </Field>
        <Field label={tr('سال')}>
          <input className="form-input" dir="ltr" value={form.jy} aria-label={tr('سال')} onChange={(e) => setForm({ ...form, jy: e.target.value })} />
        </Field>
        <Field label={tr('ماه')}>
          <input className="form-input" dir="ltr" value={form.jm} aria-label={tr('ماه')} onChange={(e) => setForm({ ...form, jm: e.target.value })} />
        </Field>
        <Field label={tr('وضعیت')}>
          <select className="form-input" value={form.status} aria-label={tr('وضعیت')} onChange={(e) => setForm({ ...form, status: e.target.value === 'paid' || e.target.value === 'issued' ? e.target.value : 'draft' })}>
            <option value="draft">{tr('پیش‌نویس')}</option>
            <option value="issued">{tr('صادر شده')}</option>
            <option value="paid">{tr('پرداخت‌شده')}</option>
          </select>
        </Field>
        {form.lines.map((line, index) => (
          <div key={index} style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="form-input" style={{ flex: '1 1 180px' }} value={line.desc} aria-label={tr('شرح')} placeholder={tr('شرح')} onChange={(e) => patchLine(index, { desc: e.target.value })} />
            <input className="form-input" style={{ flex: '1 1 140px' }} value={line.category} aria-label={tr('دسته')} placeholder={tr('دسته')} onChange={(e) => patchLine(index, { category: e.target.value })} />
            <input className="form-input" dir="ltr" style={{ width: 140 }} value={line.amount} aria-label={tr('مبلغ')} placeholder={tr('مبلغ')} onChange={(e) => patchLine(index, { amount: e.target.value })} />
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}>
              {tr('حذف خط')}
            </button>
          </div>
        ))}
        <div className="admin-header-actions" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="admin-btn" onClick={() => setForm({ ...form, lines: [...form.lines, { desc: '', category: '', amount: '' }] })}>
            {tr('افزودن خط')}
          </button>
        </div>
        <ModalActions busy={busy} disabled={!form.business.trim()} onClose={onClose} submitLabel={tr('ثبت')} />
      </div>
    </AdminModal>
  );
}

export function CommitmentDialog({
  initial,
  busy,
  onClose,
  onSubmit,
}: {
  initial: CommitmentForm;
  busy: boolean;
  onClose: () => void;
  onSubmit: (id: number | null, body: ReturnType<typeof buildCommitmentBody>) => void;
}) {
  const [form, setForm] = useState(initial);
  return (
    <AdminModal
      open
      as="form"
      busy={busy}
      title={form.id ? tr('ویرایش تعهد') : tr('تعهد جدید')}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form.id, buildCommitmentBody(form));
      }}
    >
      <div className="admin-form-grid">
        <Field label={tr('شرح')}>
          <input className="form-input" value={form.desc} required aria-label={tr('شرح')} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        </Field>
        <Field label={tr('دسته')}>
          <input className="form-input" value={form.category} aria-label={tr('دسته')} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <Field label={tr('مبلغ')}>
          <input className="form-input" dir="ltr" value={form.amount} inputMode="numeric" required aria-label={tr('مبلغ')} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label={tr('سررسید')}>
          <input className="form-input" dir="ltr" type="date" value={form.dueDate} aria-label={tr('سررسید')} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </Field>
        <Field label={tr('وضعیت')}>
          <select className="form-input" value={form.status} aria-label={tr('وضعیت')} onChange={(e) => setForm({ ...form, status: e.target.value === 'done' ? 'done' : 'pending' })}>
            <option value="pending">{tr('در انتظار')}</option>
            <option value="done">{tr('انجام‌شده')}</option>
          </select>
        </Field>
        <ModalActions busy={busy} disabled={!form.desc.trim() || !(Number(form.amount) > 0)} onClose={onClose} submitLabel={form.id ? tr('ثبت') : tr('ایجاد تعهد')} />
      </div>
    </AdminModal>
  );
}
