import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  FinanceOsAllocationBundle,
  FinanceOsEquipment,
  FinanceOsOffice,
  FinanceOsSbgExpense,
  FinanceOsSbgPerson,
} from '@petdate/shared';
import { Building2, Cpu, FileText, Plus, Users } from 'lucide-react';
import { adminFetch, formatNumFa, formatYearFa } from '../../api';
import { formatAdminFaDate } from '../../JalaliDateSelect';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { FinanceEditToggle, FinanceTabs, formatMoney, useFinanceEditMode } from './FinanceOsUi';
import {
  CommitmentDialog,
  EquipmentDialog,
  ExpenseDialog,
  InvoiceDialog,
  OfficeCreateDialog,
  PersonDialog,
} from './FinanceAllocationDialogs';
import type {
  CommitmentForm,
  EquipmentForm,
  ExpenseForm,
  InvoiceForm,
  OfficeCreateBody,
  PersonForm,
} from './financeAllocationPayload';
import { appAlert, appConfirm } from '../../../components/AppDialog';
import { tr } from '../../../i18n';

type Tab = 'offices' | 'people' | 'equipment' | 'allocation' | 'invoices' | 'bank';

/** Holding / shared lines excluded from per-business cost splits (legacy SBG name kept for old DBs). */
const NON_ALLOCATABLE_BUSINESSES = new Set(['هلدینگ', 'SBG', 'مشترک هلدینگ']);

type AreaDraft = {
  id: string;
  name: string;
  sqm: string;
  monthlyRent: string;
  assignedBusiness: string;
};

type OfficeDraft = {
  id: number;
  name: string;
  address: string;
  totalSqm: string;
  areas: AreaDraft[];
};

type PersonDraft = {
  id: number;
  name: string;
  role: string;
  office: string;
  allocationMethod: 'auto' | 'manual';
};

type EquipmentDraft = {
  id: number;
  name: string;
  category: string;
  purchasePrice: string;
  currentValue: string;
  monthlyRate: string;
  assignedBusiness: string;
  assignedPerson: string;
};

function officesToDraft(offices: FinanceOsOffice[]): OfficeDraft[] {
  return offices.map((o) => ({
    id: o.id,
    name: o.name,
    address: o.address,
    totalSqm: String(o.totalSqm),
    areas: o.areas.map((a) => ({
      id: a.id,
      name: a.name,
      sqm: String(a.sqm),
      monthlyRent: String(a.monthlyRent),
      assignedBusiness: a.assignedBusiness || '',
    })),
  }));
}

function peopleToDraft(people: FinanceOsSbgPerson[]): PersonDraft[] {
  return people.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    office: p.office,
    allocationMethod: p.allocationMethod,
  }));
}

function equipmentToDraft(equipment: FinanceOsEquipment[]): EquipmentDraft[] {
  return equipment.map((eq) => ({
    id: eq.id,
    name: eq.name,
    category: eq.category,
    purchasePrice: String(eq.purchasePrice),
    currentValue: String(eq.currentValue),
    monthlyRate: String(eq.monthlyRate),
    assignedBusiness: eq.assignedBusiness,
    assignedPerson: eq.assignedPerson || '',
  }));
}

function newAreaId(): string {
  return `area-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const draftInputStyle: CSSProperties = { width: '100%', minWidth: 72 };

export function AdminFinanceAllocationPage() {
  const canWrite = adminCan('finance.write') || adminCan('admin.full');
  const { editMode, setEditMode } = useFinanceEditMode(canWrite);
  const [tab, setTab] = useState<Tab>('allocation');
  const [data, setData] = useState<FinanceOsAllocationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allocTarget, setAllocTarget] = useState<FinanceOsSbgExpense | null>(null);
  const [splitText, setSplitText] = useState('');
  const [bankDraft, setBankDraft] = useState('');
  const [invoiceBiz, setInvoiceBiz] = useState('هایپاد');
  const [officeDrafts, setOfficeDrafts] = useState<OfficeDraft[]>([]);
  const [peopleDrafts, setPeopleDrafts] = useState<PersonDraft[]>([]);
  const [equipmentDrafts, setEquipmentDrafts] = useState<EquipmentDraft[]>([]);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [personForm, setPersonForm] = useState<PersonForm | null>(null);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentForm | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm | null>(null);
  const [commitmentForm, setCommitmentForm] = useState<CommitmentForm | null>(null);

  const load = useCallback(async (opts?: { syncDrafts?: boolean }) => {
    try {
      const bundle = await adminFetch<FinanceOsAllocationBundle>('/api/admin/finance-os/allocation');
      setData(bundle);
      setBankDraft(String(bundle.bankBalance));
      if (opts?.syncDrafts) {
        setOfficeDrafts(officesToDraft(bundle.offices));
        setPeopleDrafts(peopleToDraft(bundle.sbgPeople));
        setEquipmentDrafts(equipmentToDraft(bundle.equipment));
      }
      setError(null);
      return bundle;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => (data?.expenses || []).filter((e) => !e.allocated), [data]);
  const allocated = useMemo(() => (data?.expenses || []).filter((e) => e.allocated), [data]);
  const businesses = data?.businesses || [];

  const dirty = useMemo(() => {
    if (!editMode || !data) return false;
    return (
      JSON.stringify(officeDrafts) !== JSON.stringify(officesToDraft(data.offices)) ||
      JSON.stringify(peopleDrafts) !== JSON.stringify(peopleToDraft(data.sbgPeople)) ||
      JSON.stringify(equipmentDrafts) !== JSON.stringify(equipmentToDraft(data.equipment))
    );
  }, [data, editMode, equipmentDrafts, officeDrafts, peopleDrafts]);

  const applyDrafts = (bundle: FinanceOsAllocationBundle) => {
    setOfficeDrafts(officesToDraft(bundle.offices));
    setPeopleDrafts(peopleToDraft(bundle.sbgPeople));
    setEquipmentDrafts(equipmentToDraft(bundle.equipment));
  };

  const requestEditMode = async (next: boolean) => {
    if (next === editMode) return;
    if (!next && dirty) {
      const ok = await appConfirm(tr('تغییرات ذخیره‌نشده از بین می‌رود. ادامه؟'), { variant: 'admin' });
      if (!ok) return;
    }
    if (next && data) applyDrafts(data);
    setEditMode(next);
  };

  const cancelEdits = async () => {
    if (dirty) {
      const ok = await appConfirm(tr('تغییرات ذخیره‌نشده از بین می‌رود. ادامه؟'), { variant: 'admin' });
      if (!ok) return;
    }
    if (data) applyDrafts(data);
    setEditMode(false);
  };

  const persistOffice = async (office: OfficeDraft) => {
    await adminFetch(`/api/admin/finance-os/allocation/offices/${office.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: office.name.trim(),
        address: office.address.trim(),
        totalSqm: Number(office.totalSqm) || 0,
        areas: office.areas.map((a) => ({
          id: a.id,
          name: a.name.trim(),
          sqm: Number(a.sqm) || 0,
          monthlyRent: Number(a.monthlyRent) || 0,
          assignedBusiness: a.assignedBusiness.trim() || null,
        })),
      }),
    });
  };

  const saveSections = async () => {
    if (!editMode || !data) return;
    setBusy(true);
    try {
      const savedOffices = officesToDraft(data.offices);
      for (const office of officeDrafts) {
        if (JSON.stringify(office) === JSON.stringify(savedOffices.find((o) => o.id === office.id))) continue;
        await persistOffice(office);
      }
      const savedPeople = peopleToDraft(data.sbgPeople);
      for (const person of peopleDrafts) {
        if (JSON.stringify(person) === JSON.stringify(savedPeople.find((p) => p.id === person.id))) continue;
        await adminFetch(`/api/admin/finance-os/allocation/people/${person.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: person.name.trim(),
            role: person.role,
            office: person.office,
            allocationMethod: person.allocationMethod,
          }),
        });
      }
      const savedEq = equipmentToDraft(data.equipment);
      for (const eq of equipmentDrafts) {
        if (JSON.stringify(eq) === JSON.stringify(savedEq.find((e) => e.id === eq.id))) continue;
        await adminFetch(`/api/admin/finance-os/allocation/equipment/${eq.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: eq.name.trim(),
            category: eq.category,
            purchasePrice: Number(eq.purchasePrice) || 0,
            currentValue: Number(eq.currentValue) || 0,
            monthlyRate: Number(eq.monthlyRate) || 0,
            assignedBusiness: eq.assignedBusiness,
            assignedPerson: eq.assignedPerson,
          }),
        });
      }
      const bundle = await load({ syncDrafts: true });
      if (bundle) applyDrafts(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const deleteOfficeNow = async (officeId: number) => {
    if (!editMode) return;
    const ok = await appConfirm(tr('حذف دفتر؟ این کار قابل بازگشت نیست.'), { variant: 'admin' });
    if (!ok) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/finance-os/allocation/offices/${officeId}`, { method: 'DELETE' });
      setOfficeDrafts((rows) => rows.filter((o) => o.id !== officeId));
      const bundle = await load({ syncDrafts: true });
      if (bundle) applyDrafts(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const saveOfficeNow = async (officeId: number) => {
    if (!editMode) return;
    const office = officeDrafts.find((o) => o.id === officeId);
    if (!office) return;
    setBusy(true);
    try {
      await persistOffice(office);
      const bundle = await load({ syncDrafts: true });
      if (bundle) applyDrafts(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const savePersonNow = async (personId: number) => {
    if (!editMode) return;
    const person = peopleDrafts.find((p) => p.id === personId);
    if (!person) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/finance-os/allocation/people/${person.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: person.name.trim(),
          role: person.role,
          office: person.office,
          allocationMethod: person.allocationMethod,
        }),
      });
      const bundle = await load({ syncDrafts: true });
      if (bundle) applyDrafts(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const saveEquipmentNow = async (eqId: number) => {
    if (!editMode) return;
    const eq = equipmentDrafts.find((e) => e.id === eqId);
    if (!eq) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/finance-os/allocation/equipment/${eq.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: eq.name.trim(),
          category: eq.category,
          purchasePrice: Number(eq.purchasePrice) || 0,
          currentValue: Number(eq.currentValue) || 0,
          monthlyRate: Number(eq.monthlyRate) || 0,
          assignedBusiness: eq.assignedBusiness,
          assignedPerson: eq.assignedPerson,
        }),
      });
      const bundle = await load({ syncDrafts: true });
      if (bundle) applyDrafts(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const deleteAreaNow = async (officeId: number, areaId: string) => {
    if (!editMode) return;
    const office = officeDrafts.find((o) => o.id === officeId);
    if (!office) return;
    const ok = await appConfirm(tr('حذف این فضا؟'), { variant: 'admin' });
    if (!ok) return;
    const nextOffice: OfficeDraft = {
      ...office,
      areas: office.areas.filter((a) => a.id !== areaId),
    };
    setOfficeDrafts((rows) => rows.map((o) => (o.id === officeId ? nextOffice : o)));
    setBusy(true);
    try {
      await persistOffice(nextOffice);
      const bundle = await load({ syncDrafts: true });
      if (bundle) applyDrafts(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
      if (data) applyDrafts(data);
    } finally {
      setBusy(false);
    }
  };

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
    if (!allocTarget || !canWrite) return;
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
    if (!canWrite || !data) return;
    const lines = allocated
      .flatMap((e) => e.splits.filter((s) => s.business === invoiceBiz).map((s) => ({
        desc: e.desc,
        category: e.category,
        amount: s.amount,
      })));
    if (!lines.length) {
      await appAlert(tr('برای این بیزنس خط تخصیص‌یافته‌ای نیست'), { variant: 'admin' });
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
    if (!canWrite) return;
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
    if (!canWrite) return;
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

  const refresh = async () => {
    const bundle = await load({ syncDrafts: true });
    if (bundle) applyDrafts(bundle);
  };

  const writeJson = async (path: string, method: string, body?: unknown) => {
    setBusy(true);
    try {
      await adminFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (message: string, path: string) => {
    const ok = await appConfirm(message, { variant: 'admin' });
    if (!ok) return;
    await writeJson(path, 'DELETE');
  };

  const submitOffice = async (body: OfficeCreateBody) => {
    if (!canWrite) return;
    if (!body.name) {
      await appAlert(tr('نام دفتر الزامی است'), { variant: 'admin' });
      return;
    }
    if (await writeJson('/api/admin/finance-os/allocation/offices', 'POST', body)) setOfficeOpen(false);
  };

  const submitPerson = async (id: number | null, body: { name: string }) => {
    if (!body.name) {
      await appAlert(tr('نام الزامی است'), { variant: 'admin' });
      return;
    }
    const ok = id
      ? await writeJson(`/api/admin/finance-os/allocation/people/${id}`, 'PATCH', body)
      : await writeJson('/api/admin/finance-os/allocation/people', 'POST', body);
    if (ok) setPersonForm(null);
  };

  const submitEquipment = async (id: number | null, body: { name: string }) => {
    if (!body.name) {
      await appAlert(tr('نام الزامی است'), { variant: 'admin' });
      return;
    }
    const ok = id
      ? await writeJson(`/api/admin/finance-os/allocation/equipment/${id}`, 'PATCH', body)
      : await writeJson('/api/admin/finance-os/allocation/equipment', 'POST', body);
    if (ok) setEquipmentForm(null);
  };

  const submitExpense = async (id: number | null, body: { desc: string; amount: number }) => {
    if (!body.desc) {
      await appAlert(tr('شرح الزامی است'), { variant: 'admin' });
      return;
    }
    if (!body.amount) {
      await appAlert(tr('مبلغ الزامی است'), { variant: 'admin' });
      return;
    }
    const ok = id
      ? await writeJson(`/api/admin/finance-os/allocation/expenses/${id}`, 'PATCH', body)
      : await writeJson('/api/admin/finance-os/allocation/expenses', 'POST', body);
    if (ok) setExpenseForm(null);
  };

  const submitInvoice = async (id: number | null, body: { business: string }) => {
    if (!body.business) return;
    const ok = id
      ? await writeJson(`/api/admin/finance-os/allocation/invoices/${id}`, 'PATCH', body)
      : await writeJson('/api/admin/finance-os/allocation/invoices', 'POST', body);
    if (ok) setInvoiceForm(null);
  };

  const submitCommitment = async (id: number | null, body: { desc: string; amount: number }) => {
    if (!body.desc) {
      await appAlert(tr('شرح الزامی است'), { variant: 'admin' });
      return;
    }
    if (!body.amount) {
      await appAlert(tr('مبلغ الزامی است'), { variant: 'admin' });
      return;
    }
    const ok = id
      ? await writeJson(`/api/admin/finance-os/allocation/commitments/${id}`, 'PATCH', body)
      : await writeJson('/api/admin/finance-os/allocation/commitments', 'POST', body);
    if (ok) setCommitmentForm(null);
  };

  const openPersonCreate = () => {
    setPersonForm({ id: null, name: '', role: '', office: data?.offices[0]?.name || '', allocationMethod: 'auto' });
  };

  const openEquipmentCreate = () => {
    setEquipmentForm({
      id: null,
      name: '',
      category: '',
      purchasePrice: '',
      currentValue: '',
      monthlyRate: '',
      assignedBusiness: businesses.find((b) => !NON_ALLOCATABLE_BUSINESSES.has(b.name))?.name || '',
      assignedPerson: '',
    });
  };

  const openExpenseCreate = () => {
    setExpenseForm({
      id: null,
      date: new Date().toISOString().slice(0, 10),
      desc: '',
      category: '',
      amount: '',
      relatedPerson: '',
      office: data?.offices[0]?.name || '',
    });
  };

  const openExpenseEdit = (e: FinanceOsSbgExpense) => {
    setExpenseForm({
      id: e.id,
      date: String(e.date || '').slice(0, 10),
      desc: e.desc,
      category: e.category,
      amount: String(Math.abs(e.amount)),
      relatedPerson: e.relatedPerson,
      office: e.office || '',
    });
  };

  const openInvoiceCreate = () => {
    const biz = (data?.businesses || []).find((b) => !NON_ALLOCATABLE_BUSINESSES.has(b.name));
    setInvoiceForm({
      id: null,
      business: biz?.name || invoiceBiz,
      jy: '1405',
      jm: '7',
      status: 'draft',
      lines: [{ desc: '', category: '', amount: '' }],
    });
  };

  const openCommitmentCreate = () => {
    setCommitmentForm({
      id: null,
      desc: '',
      category: '',
      amount: '',
      dueDate: new Date().toISOString().slice(0, 10),
      status: 'pending',
    });
  };

  const patchOffice = (officeId: number, patch: Partial<OfficeDraft>) => {
    setOfficeDrafts((rows) => rows.map((o) => (o.id === officeId ? { ...o, ...patch } : o)));
  };

  const patchArea = (officeId: number, areaId: string, patch: Partial<AreaDraft>) => {
    setOfficeDrafts((rows) =>
      rows.map((o) =>
        o.id === officeId
          ? { ...o, areas: o.areas.map((a) => (a.id === areaId ? { ...a, ...patch } : a)) }
          : o
      )
    );
  };

  const officesView = editMode ? officeDrafts : officesToDraft(data?.offices || []);
  const peopleView = editMode ? peopleDrafts : peopleToDraft(data?.sbgPeople || []);
  const equipmentView = editMode ? equipmentDrafts : equipmentToDraft(data?.equipment || []);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('تخصیص هزینه')}</h1>
          <p>{tr('دفاتر · افراد · تجهیزات · تخصیص · فاکتورها · بانک')}</p>
        </div>
        <div className="admin-header-actions">
          {editMode ? (
            <>
              <button type="button" className="admin-btn" disabled={busy} onClick={() => void cancelEdits()}>
                {tr('انصراف')}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={busy || !dirty}
                onClick={() => void saveSections()}
              >
                {tr('ذخیره تغییرات')}
              </button>
            </>
          ) : null}
          <FinanceEditToggle editMode={editMode} onChange={(v) => void requestEditMode(v)} disabled={!canWrite} />
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-stats admin-stats--dense">
        <div className="admin-stat admin-stat--sky">
          <div className="admin-stat-icon"><Building2 size={18} /></div>
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.offices.length || 0)}</div>
            <div className="admin-stat-label">{tr('دفاتر')}</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--violet">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.sbgPeople.length || 0)}</div>
            <div className="admin-stat-label">{tr('افراد ستاد')}</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--orange">
          <div>
            <div className="admin-stat-value">{formatNumFa(data?.pendingAllocationCount || 0)}</div>
            <div className="admin-stat-label">{tr('در انتظار تخصیص')}</div>
          </div>
        </div>
        <div className="admin-stat admin-stat--mint">
          <div>
            <div className="admin-stat-value">{formatMoney(data?.bankBalance || 0)}</div>
            <div className="admin-stat-label">{tr('موجودی بانک هلدینگ')}</div>
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

      {!data ? <p className="admin-muted">{tr('در حال بارگذاری…')}</p> : null}

      {data && tab === 'offices' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn admin-btn--primary" data-testid="admin-office-create" disabled={!canWrite || busy} onClick={() => setOfficeOpen(true)}>
              <Plus size={16} /> {tr('ایجاد دفتر')}
            </button>
          </div>
          {!officesView.length ? (
            <section className="admin-card admin-empty">
              <p>{tr('دفتری ثبت نشده')}</p>
              <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={() => setOfficeOpen(true)}>
                {tr('ایجاد دفتر')}
              </button>
            </section>
          ) : null}
          {officesView.map((o) => {
            const live = data.offices.find((x) => x.id === o.id);
            return (
              <section key={o.id} className="admin-card" style={{ padding: 16 }}>
                <div className="admin-card-head">
                  {editMode ? (
                    <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 0 }}>
                      <input
                        className="form-input"
                        value={o.name}
                        aria-label={tr('نام')}
                        onChange={(e) => patchOffice(o.id, { name: e.target.value })}
                      />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          className="form-input"
                          style={{ flex: '1 1 200px' }}
                          value={o.address}
                          aria-label={tr('آدرس')}
                          onChange={(e) => patchOffice(o.id, { address: e.target.value })}
                        />
                        <input
                          className="form-input"
                          dir="ltr"
                          style={{ width: 120 }}
                          value={o.totalSqm}
                          aria-label={tr('متراژ کل')}
                          onChange={(e) => patchOffice(o.id, { totalSqm: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2>{o.name}</h2>
                      <span className="admin-muted">{o.address} · {formatNumFa(Number(o.totalSqm) || 0)} {tr('م²')}</span>
                    </>
                  )}
                </div>
                {o.areas.length || editMode ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table admin-table--dense">
                      <thead><tr><th>{tr('فضا')}</th><th>{tr('متراژ')}</th><th>{tr('اجاره ماهانه')}</th><th>{tr('بیزنس')}</th>{editMode ? <th></th> : null}</tr></thead>
                      <tbody>
                        {o.areas.map((a) => (
                          <tr key={a.id}>
                            <td>
                              {editMode ? (
                                <input
                                  className="form-input"
                                  style={draftInputStyle}
                                  value={a.name}
                                  aria-label={tr('فضا')}
                                  onChange={(e) => patchArea(o.id, a.id, { name: e.target.value })}
                                />
                              ) : a.name}
                            </td>
                            <td>
                              {editMode ? (
                                <input
                                  className="form-input"
                                  dir="ltr"
                                  style={draftInputStyle}
                                  value={a.sqm}
                                  aria-label={tr('متراژ')}
                                  onChange={(e) => patchArea(o.id, a.id, { sqm: e.target.value })}
                                />
                              ) : formatNumFa(Number(a.sqm) || 0)}
                            </td>
                            <td>
                              {editMode ? (
                                <input
                                  className="form-input"
                                  dir="ltr"
                                  style={draftInputStyle}
                                  value={a.monthlyRent}
                                  aria-label={tr('اجاره ماهانه')}
                                  onChange={(e) => patchArea(o.id, a.id, { monthlyRent: e.target.value })}
                                />
                              ) : formatMoney(Number(a.monthlyRent) || 0)}
                            </td>
                            <td>
                              {editMode ? (
                                <select
                                  className="form-input"
                                  style={draftInputStyle}
                                  value={a.assignedBusiness}
                                  aria-label={tr('بیزنس')}
                                  onChange={(e) => patchArea(o.id, a.id, { assignedBusiness: e.target.value })}
                                >
                                  <option value="">{tr('مشترک')}</option>
                                  {businesses.map((b) => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                  ))}
                                </select>
                              ) : (a.assignedBusiness || tr('مشترک'))}
                            </td>
                            {editMode ? (
                              <td>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--ghost"
                                  disabled={busy}
                                  onClick={() => void deleteAreaNow(o.id, a.id)}
                                >
                                  {tr('حذف')}
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="admin-muted">{tr('فضایی تعریف نشده')}</p>}
                {editMode ? (
                  <div className="admin-header-actions" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busy}
                      onClick={() =>
                        patchOffice(o.id, {
                          areas: [
                            ...o.areas,
                            { id: newAreaId(), name: 'فضای جدید', sqm: '0', monthlyRent: '0', assignedBusiness: '' },
                          ],
                        })
                      }
                    >
                      {tr('افزودن فضا')}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      disabled={busy}
                      onClick={() => void saveOfficeNow(o.id)}
                    >
                      {tr('ذخیره')}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      disabled={busy}
                      data-testid={`admin-office-delete-${o.id}`}
                      onClick={() => void deleteOfficeNow(o.id)}
                    >
                      {tr('حذف دفتر')}
                    </button>
                  </div>
                ) : null}
                {live?.spaceAllocations[0] ? (
                  <p className="admin-muted" style={{ marginTop: 8 }}>
                    {tr('تخصیص متراژ')} {formatNumFa(live.spaceAllocations[0].jm)}/{formatYearFa(live.spaceAllocations[0].jy)}:{' '}
                    {live.spaceAllocations[0].allocations.map((a) => `${a.business} ${formatNumFa(a.sqm)}${tr('م²')}`).join(' · ')}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}

      {data && tab === 'people' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={openPersonCreate}>
              <Plus size={16} /> {tr('افزودن فرد')}
            </button>
          </div>
          {!peopleView.length ? (
            <section className="admin-card admin-empty">
              <p>{tr('فردی ثبت نشده')}</p>
              <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={openPersonCreate}>{tr('افزودن فرد')}</button>
            </section>
          ) : (
        <div className="admin-table-wrap admin-card">
          <table className="admin-table admin-table--dense">
            <thead><tr><th>{tr('نام')}</th><th>{tr('سمت')}</th><th>{tr('دفتر')}</th><th>{tr('روش')}</th><th>{tr('تخصیص زمان (آخرین)')}</th><th>{tr('عملیات')}</th></tr></thead>
            <tbody>
              {peopleView.map((p) => {
                const live = data.sbgPeople.find((x) => x.id === p.id);
                const last = live?.timeAllocations[live.timeAllocations.length - 1];
                return (
                  <tr key={p.id}>
                    <td>
                      {editMode ? (
                        <input
                          className="form-input"
                          style={draftInputStyle}
                          value={p.name}
                          aria-label={tr('نام')}
                          onChange={(e) =>
                            setPeopleDrafts((rows) => rows.map((r) => (r.id === p.id ? { ...r, name: e.target.value } : r)))
                          }
                        />
                      ) : p.name}
                    </td>
                    <td>
                      {editMode ? (
                        <input
                          className="form-input"
                          style={draftInputStyle}
                          value={p.role}
                          aria-label={tr('سمت')}
                          onChange={(e) =>
                            setPeopleDrafts((rows) => rows.map((r) => (r.id === p.id ? { ...r, role: e.target.value } : r)))
                          }
                        />
                      ) : p.role}
                    </td>
                    <td>
                      {editMode ? (
                        <select
                          className="form-input"
                          style={draftInputStyle}
                          value={p.office}
                          aria-label={tr('دفتر')}
                          onChange={(e) =>
                            setPeopleDrafts((rows) => rows.map((r) => (r.id === p.id ? { ...r, office: e.target.value } : r)))
                          }
                        >
                          {p.office && !data.offices.some((o) => o.name === p.office) ? (
                            <option value={p.office}>{p.office}</option>
                          ) : null}
                          {data.offices.map((o) => (
                            <option key={o.id} value={o.name}>{o.name}</option>
                          ))}
                        </select>
                      ) : p.office}
                    </td>
                    <td>
                      {editMode ? (
                        <select
                          className="form-input"
                          style={draftInputStyle}
                          value={p.allocationMethod}
                          aria-label={tr('روش')}
                          onChange={(e) =>
                            setPeopleDrafts((rows) =>
                              rows.map((r) =>
                                r.id === p.id
                                  ? { ...r, allocationMethod: e.target.value === 'manual' ? 'manual' : 'auto' }
                                  : r
                              )
                            )
                          }
                        >
                          <option value="auto">{tr('خودکار')}</option>
                          <option value="manual">{tr('دستی')}</option>
                        </select>
                      ) : (p.allocationMethod === 'auto' ? tr('خودکار') : tr('دستی'))}
                    </td>
                    <td>
                      {last
                        ? last.allocations.map((a) => `${a.business} ${formatNumFa(a.percent)}${tr('٪')}`).join(' · ')
                        : '—'}
                    </td>
                    <td>
                      <div className="admin-header-actions">
                        {editMode ? (
                          <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void savePersonNow(p.id)}>{tr('ذخیره')}</button>
                        ) : null}
                        <button type="button" className="admin-btn" disabled={!canWrite || busy} onClick={() => setPersonForm({ id: p.id, name: p.name, role: p.role, office: p.office, allocationMethod: p.allocationMethod })}>{tr('ویرایش')}</button>
                        <button type="button" className="admin-btn admin-btn--danger" disabled={!canWrite || busy} onClick={() => void confirmDelete(tr('حذف این فرد؟ این کار قابل بازگشت نیست.'), `/api/admin/finance-os/allocation/people/${p.id}`)}>{tr('حذف')}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          )}
        </div>
      ) : null}

      {data && tab === 'equipment' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={openEquipmentCreate}>
              <Plus size={16} /> {tr('افزودن تجهیز')}
            </button>
          </div>
          {!equipmentView.length ? (
            <section className="admin-card admin-empty">
              <p>{tr('تجهیزی ثبت نشده')}</p>
              <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={openEquipmentCreate}>{tr('افزودن تجهیز')}</button>
            </section>
          ) : (
        <div className="admin-table-wrap admin-card">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>{tr('کد')}</th><th>{tr('نام')}</th><th>{tr('دسته')}</th><th>{tr('خرید')}</th><th>{tr('ارزش فعلی')}</th>
                <th>{tr('نرخ ماهانه')}</th><th>{tr('بیزنس')}</th><th>{tr('فرد')}</th><th>{tr('عملیات')}</th>
              </tr>
            </thead>
            <tbody>
              {equipmentView.map((eq) => {
                const live = data.equipment.find((x) => x.id === eq.id);
                return (
                  <tr key={eq.id}>
                    <td dir="ltr">{live?.code || ''}</td>
                    <td>
                      {editMode ? (
                        <input
                          className="form-input"
                          style={draftInputStyle}
                          value={eq.name}
                          aria-label={tr('نام')}
                          onChange={(e) =>
                            setEquipmentDrafts((rows) => rows.map((r) => (r.id === eq.id ? { ...r, name: e.target.value } : r)))
                          }
                        />
                      ) : eq.name}
                    </td>
                    <td>
                      {editMode ? (
                        <input
                          className="form-input"
                          style={draftInputStyle}
                          value={eq.category}
                          aria-label={tr('دسته')}
                          onChange={(e) =>
                            setEquipmentDrafts((rows) =>
                              rows.map((r) => (r.id === eq.id ? { ...r, category: e.target.value } : r))
                            )
                          }
                        />
                      ) : eq.category}
                    </td>
                    <td>
                      {editMode ? (
                        <input
                          className="form-input"
                          dir="ltr"
                          style={draftInputStyle}
                          value={eq.purchasePrice}
                          aria-label={tr('خرید')}
                          onChange={(e) =>
                            setEquipmentDrafts((rows) =>
                              rows.map((r) => (r.id === eq.id ? { ...r, purchasePrice: e.target.value } : r))
                            )
                          }
                        />
                      ) : formatMoney(Number(eq.purchasePrice) || 0)}
                    </td>
                    <td>
                      {editMode ? (
                        <input
                          className="form-input"
                          dir="ltr"
                          style={draftInputStyle}
                          value={eq.currentValue}
                          aria-label={tr('ارزش فعلی')}
                          onChange={(e) =>
                            setEquipmentDrafts((rows) =>
                              rows.map((r) => (r.id === eq.id ? { ...r, currentValue: e.target.value } : r))
                            )
                          }
                        />
                      ) : formatMoney(Number(eq.currentValue) || 0)}
                    </td>
                    <td>
                      {editMode ? (
                        <input
                          className="form-input"
                          dir="ltr"
                          style={draftInputStyle}
                          value={eq.monthlyRate}
                          aria-label={tr('نرخ ماهانه')}
                          onChange={(e) =>
                            setEquipmentDrafts((rows) =>
                              rows.map((r) => (r.id === eq.id ? { ...r, monthlyRate: e.target.value } : r))
                            )
                          }
                        />
                      ) : formatMoney(Number(eq.monthlyRate) || 0)}
                    </td>
                    <td>
                      {editMode ? (
                        <select
                          className="form-input"
                          style={draftInputStyle}
                          value={eq.assignedBusiness}
                          aria-label={tr('بیزنس')}
                          onChange={(e) =>
                            setEquipmentDrafts((rows) =>
                              rows.map((r) => (r.id === eq.id ? { ...r, assignedBusiness: e.target.value } : r))
                            )
                          }
                        >
                          {eq.assignedBusiness && !businesses.some((b) => b.name === eq.assignedBusiness) ? (
                            <option value={eq.assignedBusiness}>{eq.assignedBusiness}</option>
                          ) : null}
                          {businesses.map((b) => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      ) : eq.assignedBusiness}
                    </td>
                    <td>
                      {editMode ? (
                        <input
                          className="form-input"
                          style={draftInputStyle}
                          value={eq.assignedPerson}
                          aria-label={tr('فرد')}
                          onChange={(e) =>
                            setEquipmentDrafts((rows) =>
                              rows.map((r) => (r.id === eq.id ? { ...r, assignedPerson: e.target.value } : r))
                            )
                          }
                        />
                      ) : (eq.assignedPerson || '—')}
                    </td>
                    <td>
                      <div className="admin-header-actions">
                        {editMode ? (
                          <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void saveEquipmentNow(eq.id)}>{tr('ذخیره')}</button>
                        ) : null}
                        <button type="button" className="admin-btn" disabled={!canWrite || busy} onClick={() => setEquipmentForm({
                          id: eq.id, name: eq.name, category: eq.category, purchasePrice: eq.purchasePrice, currentValue: eq.currentValue, monthlyRate: eq.monthlyRate, assignedBusiness: eq.assignedBusiness, assignedPerson: eq.assignedPerson,
                        })}>{tr('ویرایش')}</button>
                        <button type="button" className="admin-btn admin-btn--danger" disabled={!canWrite || busy} onClick={() => void confirmDelete(tr('حذف این تجهیز؟ این کار قابل بازگشت نیست.'), `/api/admin/finance-os/allocation/equipment/${eq.id}`)}>{tr('حذف')}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="admin-muted" style={{ padding: 12 }}>
            <Cpu size={14} style={{ verticalAlign: 'middle' }} /> {tr('جمع ارزش فعلی:')}{' '}
            {formatMoney(data.equipment.reduce((s, e) => s + e.currentValue, 0))}
          </p>
        </div>
          )}
        </div>
      ) : null}

      {data && tab === 'allocation' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={openExpenseCreate}>
              <Plus size={16} /> {tr('ایجاد تخصیص')}
            </button>
          </div>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('در انتظار تخصیص')}</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>{tr('تاریخ')}</th><th>{tr('شرح')}</th><th>{tr('دسته')}</th><th>{tr('مبلغ')}</th><th>{tr('دفتر')}</th><th>{tr('فرد')}</th><th>{tr('عملیات')}</th></tr></thead>
                <tbody>
                  {pending.map((e) => (
                    <tr key={e.id}>
                      <td>{formatAdminFaDate(e.date)}</td>
                      <td>{e.desc}</td>
                      <td>{e.category}</td>
                      <td>{formatMoney(Math.abs(e.amount))}</td>
                      <td>{e.office || '—'}</td>
                      <td>{e.relatedPerson || '—'}</td>
                      <td>
                        <div className="admin-header-actions">
                          <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={() => openAlloc(e)}>{tr('تخصیص')}</button>
                          <button type="button" className="admin-btn" disabled={!canWrite || busy} onClick={() => openExpenseEdit(e)}>{tr('ویرایش')}</button>
                          <button type="button" className="admin-btn admin-btn--danger" disabled={!canWrite || busy} onClick={() => void confirmDelete(tr('حذف این هزینه؟ این کار قابل بازگشت نیست.'), `/api/admin/finance-os/allocation/expenses/${e.id}`)}>{tr('حذف')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!pending.length ? <tr><td colSpan={7} className="admin-muted">{tr('همه تخصیص شده‌اند')}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('تخصیص‌یافته')}</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>{tr('شرح')}</th><th>{tr('مبلغ')}</th><th>{tr('دفتر')}</th><th>{tr('فرد')}</th><th>{tr('تقسیم')}</th><th>{tr('عملیات')}</th></tr></thead>
                <tbody>
                  {allocated.map((e) => (
                    <tr key={e.id}>
                      <td>{e.desc}</td>
                      <td>{formatMoney(Math.abs(e.amount))}</td>
                      <td>{e.office || '—'}</td>
                      <td>{e.relatedPerson || '—'}</td>
                      <td>{e.splits.map((s) => `${s.business} ${formatMoney(s.amount)}`).join(' · ')}</td>
                      <td>
                        <div className="admin-header-actions">
                          <button type="button" className="admin-btn" disabled={!canWrite || busy} onClick={() => openExpenseEdit(e)}>{tr('ویرایش')}</button>
                          <button type="button" className="admin-btn admin-btn--danger" disabled={!canWrite || busy} onClick={() => void confirmDelete(tr('حذف این هزینه؟ این کار قابل بازگشت نیست.'), `/api/admin/finance-os/allocation/expenses/${e.id}`)}>{tr('حذف')}</button>
                        </div>
                      </td>
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
              {canWrite ? (
                <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void issueInvoice()}>
                  <FileText size={16} /> {tr('صدور فاکتور برای')} {invoiceBiz}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {data && tab === 'invoices' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={openInvoiceCreate}>
              <Plus size={16} /> {tr('ایجاد فاکتور')}
            </button>
          </div>
        <div className="admin-table-wrap admin-card">
          <table className="admin-table admin-table--dense">
            <thead><tr><th>{tr('شماره')}</th><th>{tr('بیزنس')}</th><th>{tr('دوره')}</th><th>{tr('جمع')}</th><th>{tr('وضعیت')}</th><th>{tr('خطوط')}</th><th>{tr('عملیات')}</th></tr></thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td dir="ltr">{inv.number}</td>
                  <td>{inv.business}</td>
                  <td>{formatNumFa(inv.jm)}/{formatYearFa(inv.jy)}</td>
                  <td>{formatMoney(inv.total)}</td>
                  <td>{inv.status === 'issued' ? tr('صادر شده') : inv.status === 'paid' ? tr('پرداخت‌شده') : tr('پیش‌نویس')}</td>
                  <td>{formatNumFa(inv.lines.length)}</td>
                  <td>
                    <div className="admin-header-actions">
                      <button type="button" className="admin-btn" disabled={!canWrite || busy} onClick={() => setInvoiceForm({
                        id: inv.id,
                        business: inv.business,
                        jy: String(inv.jy),
                        jm: String(inv.jm),
                        status: inv.status,
                        lines: inv.lines.length ? inv.lines.map((l) => ({ desc: l.desc, category: l.category, amount: String(l.amount) })) : [{ desc: '', category: '', amount: '' }],
                      })}>{tr('ویرایش')}</button>
                      <button type="button" className="admin-btn admin-btn--danger" disabled={!canWrite || busy} onClick={() => void confirmDelete(tr('حذف این فاکتور؟ این کار قابل بازگشت نیست.'), `/api/admin/finance-os/allocation/invoices/${inv.id}`)}>{tr('حذف')}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data.invoices.length ? <tr><td colSpan={7} className="admin-muted">{tr('فاکتوری نیست')}</td></tr> : null}
            </tbody>
          </table>
        </div>
        </div>
      ) : null}

      {data && tab === 'bank' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head"><h2>{tr('موجودی بانک / صندوق هلدینگ')}</h2></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="form-input"
                dir="ltr"
                style={{ width: 220 }}
                value={bankDraft}
                disabled={!canWrite}
                aria-label={tr('موجودی بانک / صندوق هلدینگ')}
                onChange={(e) => setBankDraft(e.target.value)}
              />
              {canWrite ? (
                <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void saveBank()}>
                  {tr('ذخیره موجودی')}
                </button>
              ) : null}
              <span className="admin-muted">{tr('نمایش:')} {formatMoney(data.bankBalance)}</span>
            </div>
          </section>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head">
              <h2>{tr('تعهدات')}</h2>
              <button type="button" className="admin-btn admin-btn--primary" disabled={!canWrite || busy} onClick={openCommitmentCreate}>
                <Plus size={16} /> {tr('ایجاد تعهد')}
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead><tr><th>{tr('شرح')}</th><th>{tr('دسته')}</th><th>{tr('مبلغ')}</th><th>{tr('سررسید')}</th><th>{tr('وضعیت')}</th><th>{tr('عملیات')}</th></tr></thead>
                <tbody>
                  {data.commitments.map((c) => (
                    <tr key={c.id}>
                      <td>{c.desc}</td>
                      <td>{c.category}</td>
                      <td>{formatMoney(c.amount)}</td>
                      <td dir="ltr">{c.dueDate}</td>
                      <td>{c.status === 'done' ? tr('انجام‌شده') : tr('در انتظار')}</td>
                      <td>
                        <div className="admin-header-actions">
                          {canWrite && c.status === 'pending' ? (
                            <button type="button" className="admin-btn" disabled={busy} onClick={() => void markDone(c.id)}>{tr('تسویه از موجودی')}</button>
                          ) : null}
                          <button type="button" className="admin-btn" disabled={!canWrite || busy} onClick={() => setCommitmentForm({
                            id: c.id, desc: c.desc, category: c.category, amount: String(c.amount), dueDate: c.dueDate, status: c.status,
                          })}>{tr('ویرایش')}</button>
                          <button type="button" className="admin-btn admin-btn--danger" disabled={!canWrite || busy} onClick={() => void confirmDelete(tr('حذف این تعهد؟ این کار قابل بازگشت نیست.'), `/api/admin/finance-os/allocation/commitments/${c.id}`)}>{tr('حذف')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.commitments.length ? <tr><td colSpan={6} className="admin-muted">{tr('تعهدی ثبت نشده')}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      <AdminModal open={!!allocTarget} onClose={() => setAllocTarget(null)} title={tr("تخصیص هزینه به بیزنس‌لاین‌ها")}>
        {allocTarget ? (
          <div className="admin-form-grid">
            <ul className="admin-kv" style={{ gridColumn: '1 / -1' }}>
              <li><span>{tr('شرح')}</span><strong>{allocTarget.desc}</strong></li>
              <li><span>{tr('مبلغ')}</span><strong>{formatMoney(Math.abs(allocTarget.amount))}</strong></li>
              <li><span>{tr('دسته')}</span><strong>{allocTarget.category}</strong></li>
            </ul>
            <label style={{ gridColumn: '1 / -1' }}>
              <span className="form-label">{tr('تقسیم (هر خط: بیزنس:مبلغ)')}</span>
              <textarea className="form-input" rows={6} dir="rtl" value={splitText} onChange={(e) => setSplitText(e.target.value)} />
            </label>
            <div className="admin-header-actions">
              <button type="button" className="admin-btn" onClick={() => setAllocTarget(null)}>{tr('انصراف')}</button>
              <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void submitAlloc()}>{tr('ثبت تخصیص')}</button>
            </div>
          </div>
        ) : null}
      </AdminModal>
      {officeOpen ? <OfficeCreateDialog businesses={businesses} busy={busy} onClose={() => setOfficeOpen(false)} onSubmit={(body) => void submitOffice(body)} /> : null}
      {personForm ? <PersonDialog initial={personForm} offices={(data?.offices || []).map((o) => o.name)} busy={busy} onClose={() => setPersonForm(null)} onSubmit={(id, body) => void submitPerson(id, body)} /> : null}
      {equipmentForm ? <EquipmentDialog initial={equipmentForm} businesses={businesses} people={(data?.sbgPeople || []).map((p) => p.name)} busy={busy} onClose={() => setEquipmentForm(null)} onSubmit={(id, body) => void submitEquipment(id, body)} /> : null}
      {expenseForm ? <ExpenseDialog initial={expenseForm} offices={(data?.offices || []).map((o) => o.name)} people={(data?.sbgPeople || []).map((p) => p.name)} busy={busy} onClose={() => setExpenseForm(null)} onSubmit={(id, body) => void submitExpense(id, body)} /> : null}
      {invoiceForm ? <InvoiceDialog initial={invoiceForm} businesses={(data?.businesses || []).filter((b) => !NON_ALLOCATABLE_BUSINESSES.has(b.name))} busy={busy} onClose={() => setInvoiceForm(null)} onSubmit={(id, body) => void submitInvoice(id, body)} /> : null}
      {commitmentForm ? <CommitmentDialog initial={commitmentForm} busy={busy} onClose={() => setCommitmentForm(null)} onSubmit={(id, body) => void submitCommitment(id, body)} /> : null}
    </div>
  );
}
