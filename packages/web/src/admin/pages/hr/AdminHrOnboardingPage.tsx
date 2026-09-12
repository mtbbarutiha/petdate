import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  HrOnboardingAccessItem,
  HrOnboardingDocumentItem,
  HrOnboardingEquipmentItem,
  HrOnboardingRecord,
  HrOnboardingTask,
  HrOnboardingTrainingItem,
} from '@petdate/shared';
import { onboardingProgressPct } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import {
  JalaliDateRange,
  JalaliDateSelect,
  formatAdminFaDate,
  gregorianIsoToJalaliParts,
  jalaliPartsToGregorianIso,
  type JalaliDateValue,
} from '../../JalaliDateSelect';
import { tr } from '../../../i18n';

type StatusFilter = '' | 'approved' | 'open';
type ProgressFilter = '' | 'zero' | 'partial' | 'complete';
type ChecklistFilter = '' | 'access' | 'training' | 'documents' | 'equipment';

function statusLabel(rec: HrOnboardingRecord): string {
  return rec.approvedHire || rec.candidateId != null ? 'فرد تایید شده' : 'شروع به کار';
}

function hasIncomplete(items: Array<{ done: boolean }> | undefined): boolean {
  return (items || []).some((i) => !i.done);
}

export function AdminHrOnboardingPage() {
  const [records, setRecords] = useState<HrOnboardingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [jobFilter, setJobFilter] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('');
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>('');
  const [dateFrom, setDateFrom] = useState<JalaliDateValue>(null);
  const [dateTo, setDateTo] = useState<JalaliDateValue>(null);
  const canWrite = adminCan('hr.write');

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ records: HrOnboardingRecord[] }>('/api/admin/hr/onboarding');
      setRecords(res.records);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId]
  );

  const jobOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.jobTitle?.trim()) set.add(r.jobTitle.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fa'));
  }, [records]);

  const filtered = useMemo(() => {
    const fromIso = jalaliPartsToGregorianIso(dateFrom);
    const toIso = jalaliPartsToGregorianIso(dateTo);
    const query = q.trim().toLowerCase();
    return records.filter((r) => {
      if (query) {
        const hay = `${r.name} ${r.jobTitle}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (statusFilter === 'approved' && !(r.approvedHire || r.candidateId != null)) return false;
      if (statusFilter === 'open' && (r.approvedHire || r.candidateId != null)) return false;
      if (jobFilter && r.jobTitle !== jobFilter) return false;
      if (fromIso && (!r.startDate || r.startDate < fromIso)) return false;
      if (toIso && (!r.startDate || r.startDate > toIso)) return false;
      const pct = onboardingProgressPct(r);
      if (progressFilter === 'zero' && pct !== 0) return false;
      if (progressFilter === 'partial' && (pct <= 0 || pct >= 100)) return false;
      if (progressFilter === 'complete' && pct < 100) return false;
      if (checklistFilter === 'access' && !hasIncomplete(r.accessItems)) return false;
      if (checklistFilter === 'training' && !hasIncomplete(r.trainingItems)) return false;
      if (checklistFilter === 'documents' && !hasIncomplete(r.documentItems)) return false;
      if (checklistFilter === 'equipment' && !hasIncomplete(r.equipmentItems)) return false;
      return true;
    });
  }, [records, q, statusFilter, jobFilter, progressFilter, checklistFilter, dateFrom, dateTo]);

  const hasFilters =
    Boolean(q.trim()) ||
    Boolean(statusFilter) ||
    Boolean(jobFilter) ||
    Boolean(progressFilter) ||
    Boolean(checklistFilter) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const clearFilters = () => {
    setQ('');
    setStatusFilter('');
    setJobFilter('');
    setProgressFilter('');
    setChecklistFilter('');
    setDateFrom(null);
    setDateTo(null);
  };

  const persist = async (
    rec: HrOnboardingRecord,
    patch: {
      tasks?: HrOnboardingTask[];
      accessItems?: HrOnboardingAccessItem[];
      equipmentItems?: HrOnboardingEquipmentItem[];
      trainingItems?: HrOnboardingTrainingItem[];
      documentItems?: HrOnboardingDocumentItem[];
    }
  ) => {
    if (!canWrite) return;
    try {
      await adminFetch(`/api/admin/hr/onboarding/${rec.id}/tasks`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const toggleTask = (rec: HrOnboardingRecord, taskId: string) => {
    const tasks = rec.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
    void persist(rec, { tasks });
  };

  const toggleAccess = (rec: HrOnboardingRecord, itemId: string) => {
    const accessItems = (rec.accessItems || []).map((t) =>
      t.id === itemId ? { ...t, done: !t.done } : t
    );
    void persist(rec, { accessItems });
  };

  const toggleEquipment = (rec: HrOnboardingRecord, itemId: string) => {
    const equipmentItems = (rec.equipmentItems || []).map((t) =>
      t.id === itemId ? { ...t, done: !t.done } : t
    );
    void persist(rec, { equipmentItems });
  };

  const toggleTraining = (rec: HrOnboardingRecord, itemId: string) => {
    const trainingItems = (rec.trainingItems || []).map((t) =>
      t.id === itemId ? { ...t, done: !t.done } : t
    );
    void persist(rec, { trainingItems });
  };

  const toggleDocument = (rec: HrOnboardingRecord, itemId: string) => {
    const documentItems = (rec.documentItems || []).map((t) =>
      t.id === itemId ? { ...t, done: !t.done } : t
    );
    void persist(rec, { documentItems });
  };

  const setAssetNo = (rec: HrOnboardingRecord, itemId: string, assetNo: string) => {
    const equipmentItems = (rec.equipmentItems || []).map((t) =>
      t.id === itemId ? { ...t, assetNo } : t
    );
    setRecords((list) => list.map((r) => (r.id === rec.id ? { ...r, equipmentItems } : r)));
  };

  const saveAssetNo = (rec: HrOnboardingRecord) => {
    void persist(rec, { equipmentItems: rec.equipmentItems });
  };

  const setTrainingDate = (rec: HrOnboardingRecord, itemId: string, parts: JalaliDateValue) => {
    const scheduledDate = jalaliPartsToGregorianIso(parts) || '';
    const trainingItems = (rec.trainingItems || []).map((t) =>
      t.id === itemId ? { ...t, scheduledDate } : t
    );
    setRecords((list) => list.map((r) => (r.id === rec.id ? { ...r, trainingItems } : r)));
    void persist({ ...rec, trainingItems }, { trainingItems });
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('شروع به کار (Onboarding)')}</h1>
          <p>
            {tr(`چک‌لیست ورود — تحویل دسترسی‌ها، تجهیزات، زمانبندی آموزش و مدارک — با استخدام از ATS هم ساخته
            می‌شود`)}
          </p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-table-wrap admin-card">
        <div
          className="admin-toolbar admin-toolbar--filters"
          role="search"
          aria-label={tr("فیلتر شروع به کار")}
          style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}
        >
          <div className="admin-search">
            <input
              placeholder={tr("جستجوی نام یا شغل...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={tr("جستجوی نام یا شغل")}
            />
          </div>
          <select
            className="admin-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label={tr("وضعیت")}
          >
            <option value="">{tr('وضعیت: همه')}</option>
            <option value="approved">{tr('فرد تایید شده')}</option>
            <option value="open">{tr('شروع به کار')}</option>
          </select>
          <select
            className="admin-select"
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            aria-label={tr("شغل")}
          >
            <option value="">{tr('شغل: همه')}</option>
            {jobOptions.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
          <select
            className="admin-select"
            value={progressFilter}
            onChange={(e) => setProgressFilter(e.target.value as ProgressFilter)}
            aria-label={tr("پیشرفت")}
          >
            <option value="">{tr('پیشرفت: همه')}</option>
            <option value="zero">{tr('۰٪')}</option>
            <option value="partial">{tr('در حال انجام')}</option>
            <option value="complete">{tr('تکمیل‌شده (۱۰۰٪)')}</option>
          </select>
          <select
            className="admin-select"
            value={checklistFilter}
            onChange={(e) => setChecklistFilter(e.target.value as ChecklistFilter)}
            aria-label={tr("آیتم شاخص فرم")}
          >
            <option value="">{tr('آیتم شاخص: همه')}</option>
            <option value="access">{tr('تحویل دسترسی‌ها ناقص')}</option>
            <option value="training">{tr('زمانبندی آموزش ناقص')}</option>
            <option value="documents">{tr('مدارک دریافت‌شده ناقص')}</option>
            <option value="equipment">{tr('تجهیزات ناقص')}</option>
          </select>
          <JalaliDateRange
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            fromLabel="شروع از"
            toLabel="شروع تا"
          />
          {hasFilters ? (
            <button type="button" className="admin-btn admin-btn--ghost" onClick={clearFilters}>
              {tr('پاک کردن فیلترها')}
            </button>
          ) : null}
        </div>

        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>{tr('نام')}</th>
              <th>{tr('شغل')}</th>
              <th>{tr('شروع')}</th>
              <th>{tr('پیشرفت')}</th>
              <th>{tr('وضعیت')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  {records.length === 0
                    ? tr('هنوز فرآیندی نیست — از ATS متقاضی را استخدام‌شده کنید')
                    : tr('موردی با این فیلترها پیدا نشد')}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const pct = onboardingProgressPct(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        style={{ padding: '2px 8px' }}
                        onClick={() => setSelectedId(r.id)}
                      >
                        {r.name} ▸
                      </button>
                    </td>
                    <td>{r.jobTitle || '—'}</td>
                    <td>{formatAdminFaDate(r.startDate)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 8,
                            borderRadius: 999,
                            background: 'rgba(0,0,0,.08)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: 'var(--admin-mint, #2dd4bf)',
                            }}
                          />
                        </div>
                        <span className="admin-mono">{formatNumFa(pct)}{tr('٪')}</span>
                      </div>
                    </td>
                    <td>
                      {r.approvedHire || r.candidateId != null ? (
                        <span className="admin-topbar-chip">{statusLabel(r)}</span>
                      ) : (
                        <span className="admin-muted">{statusLabel(r)}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={selected != null}
        title={selected ? selected.name : tr('جزئیات شروع به کار')}
        onClose={() => setSelectedId(null)}
        size="xl"
      >
        {selected ? (
          <div className="admin-onboarding-modal">
            <p className="admin-muted" style={{ marginTop: 0 }}>
              {selected.jobTitle || tr('بدون شغل')} {tr('· شروع:')}{' '}
              {formatAdminFaDate(selected.startDate)} {tr('· مدت:')}{' '}
              {formatNumFa(selected.durationDays)} {tr('روز · پیشرفت:')}{' '}
              {formatNumFa(onboardingProgressPct(selected))}{tr('٪ ·')} {statusLabel(selected)}
            </p>
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <section>
                <h3 className="admin-subsection-title" style={{ marginTop: 0 }}>
                  {tr('وظایف')}
                </h3>
                <ul className="admin-log-list">
                  {selected.tasks.map((t) => (
                    <li key={t.id}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={t.done}
                          disabled={!canWrite}
                          onChange={() => toggleTask(selected, t.id)}
                        />
                        <span>{tr(t.label)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="admin-subsection-title" style={{ marginTop: 0 }}>
                  {tr('تحویل دسترسی‌ها')}
                </h3>
                <ul className="admin-log-list">
                  {(selected.accessItems || []).map((t) => (
                    <li key={t.id}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={t.done}
                          disabled={!canWrite}
                          onChange={() => toggleAccess(selected, t.id)}
                        />
                        <span>{tr(t.label)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="admin-subsection-title" style={{ marginTop: 0 }}>
                  {tr('چک‌لیست تجهیزات')}
                </h3>
                <ul className="admin-log-list">
                  {(selected.equipmentItems || []).map((t) => (
                    <li key={t.id} style={{ marginBottom: 8 }}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={t.done}
                          disabled={!canWrite}
                          onChange={() => toggleEquipment(selected, t.id)}
                        />
                        <span style={{ minWidth: 100 }}>{tr(t.label)}</span>
                      </label>
                      <label
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          marginTop: 4,
                          marginInlineStart: 24,
                        }}
                      >
                        <span className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                          {tr('شماره اموال')}
                        </span>
                        <input
                          className="form-input"
                          dir="ltr"
                          disabled={!canWrite}
                          value={t.assetNo || ''}
                          onChange={(e) => setAssetNo(selected, t.id, e.target.value)}
                          onBlur={() => saveAssetNo(selected)}
                          placeholder="—"
                          style={{ maxWidth: 160 }}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="admin-subsection-title" style={{ marginTop: 0 }}>
                  {tr('زمانبندی آموزش')}
                </h3>
                <ul className="admin-log-list">
                  {(selected.trainingItems || []).map((t) => (
                    <li key={t.id} style={{ marginBottom: 10 }}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={t.done}
                          disabled={!canWrite}
                          onChange={() => toggleTraining(selected, t.id)}
                        />
                        <span>{tr(t.label)}</span>
                      </label>
                      <div style={{ marginTop: 6, marginInlineStart: 24 }}>
                        <JalaliDateSelect
                          label={tr("زمان آموزش")}
                          value={gregorianIsoToJalaliParts(t.scheduledDate || null)}
                          onChange={(parts) => setTrainingDate(selected, t.id, parts)}
                          disabled={!canWrite}
                          yearsBack={1}
                          yearsForward={2}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="admin-subsection-title" style={{ marginTop: 0 }}>
                  {tr('مدارک دریافت‌شده')}
                </h3>
                <ul className="admin-log-list">
                  {(selected.documentItems || []).map((t) => (
                    <li key={t.id}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={t.done}
                          disabled={!canWrite}
                          onChange={() => toggleDocument(selected, t.id)}
                        />
                        <span>{tr(t.label)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
