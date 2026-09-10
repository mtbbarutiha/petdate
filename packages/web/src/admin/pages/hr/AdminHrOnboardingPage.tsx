import { Fragment, useCallback, useEffect, useState } from 'react';
import type {
  HrOnboardingAccessItem,
  HrOnboardingEquipmentItem,
  HrOnboardingRecord,
  HrOnboardingTask,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

function progressPct(rec: HrOnboardingRecord): number {
  const items = [
    ...rec.tasks,
    ...(rec.accessItems || []),
    ...(rec.equipmentItems || []).map((e) => ({ done: e.done })),
  ];
  if (!items.length) return 0;
  const done = items.filter((t) => t.done).length;
  return Math.round((done / items.length) * 100);
}

export function AdminHrOnboardingPage() {
  const [records, setRecords] = useState<HrOnboardingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
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

  const persist = async (
    rec: HrOnboardingRecord,
    patch: {
      tasks?: HrOnboardingTask[];
      accessItems?: HrOnboardingAccessItem[];
      equipmentItems?: HrOnboardingEquipmentItem[];
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

  const setAssetNo = (rec: HrOnboardingRecord, itemId: string, assetNo: string) => {
    const equipmentItems = (rec.equipmentItems || []).map((t) =>
      t.id === itemId ? { ...t, assetNo } : t
    );
    setRecords((list) =>
      list.map((r) => (r.id === rec.id ? { ...r, equipmentItems } : r))
    );
  };

  const saveAssetNo = (rec: HrOnboardingRecord) => {
    void persist(rec, { equipmentItems: rec.equipmentItems });
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>شروع به کار (Onboarding)</h1>
          <p>چک‌لیست ورود — دسترسی‌ها و تجهیزات — با استخدام از ATS هم ساخته می‌شود</p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>نام</th>
              <th>شغل</th>
              <th>شروع</th>
              <th>پیشرفت</th>
              <th>وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  هنوز فرآیندی نیست — از ATS متقاضی را استخدام‌شده کنید
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const pct = progressPct(r);
                const open = expandedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          style={{ padding: '2px 8px' }}
                          aria-expanded={open}
                          onClick={() => setExpandedId(open ? null : r.id)}
                        >
                          {open ? '▾' : '▸'}
                        </button>
                      </td>
                      <td>{r.name}</td>
                      <td>{r.jobTitle || '—'}</td>
                      <td>{r.startDate || '—'}</td>
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
                          <span className="admin-mono">{formatNumFa(pct)}٪</span>
                        </div>
                      </td>
                      <td>
                        {r.approvedHire || r.candidateId != null ? (
                          <span className="admin-topbar-chip">فرد تایید شده</span>
                        ) : (
                          <span className="admin-muted">شروع به کار</span>
                        )}
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={6} style={{ background: 'rgba(0,0,0,.02)', padding: 16 }}>
                          <div
                            style={{
                              display: 'grid',
                              gap: 16,
                              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            }}
                          >
                            <section>
                              <h3 className="admin-subsection-title" style={{ marginTop: 0 }}>
                                وظایف
                              </h3>
                              <ul className="admin-log-list">
                                {r.tasks.map((t) => (
                                  <li key={t.id}>
                                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={t.done}
                                        disabled={!canWrite}
                                        onChange={() => toggleTask(r, t.id)}
                                      />
                                      <span>{t.label}</span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </section>
                            <section>
                              <h3 className="admin-subsection-title" style={{ marginTop: 0 }}>
                                چک‌لیست دسترسی
                              </h3>
                              <ul className="admin-log-list">
                                {(r.accessItems || []).map((t) => (
                                  <li key={t.id}>
                                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={t.done}
                                        disabled={!canWrite}
                                        onChange={() => toggleAccess(r, t.id)}
                                      />
                                      <span>{t.label}</span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </section>
                            <section>
                              <h3 className="admin-subsection-title" style={{ marginTop: 0 }}>
                                چک‌لیست تجهیزات
                              </h3>
                              <ul className="admin-log-list">
                                {(r.equipmentItems || []).map((t) => (
                                  <li key={t.id} style={{ marginBottom: 8 }}>
                                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={t.done}
                                        disabled={!canWrite}
                                        onChange={() => toggleEquipment(r, t.id)}
                                      />
                                      <span style={{ minWidth: 100 }}>{t.label}</span>
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
                                        شماره اموال
                                      </span>
                                      <input
                                        className="form-input"
                                        dir="ltr"
                                        disabled={!canWrite}
                                        value={t.assetNo || ''}
                                        onChange={(e) => setAssetNo(r, t.id, e.target.value)}
                                        onBlur={() => saveAssetNo(r)}
                                        placeholder="—"
                                        style={{ maxWidth: 160 }}
                                      />
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          </div>
                          <p className="admin-muted" style={{ marginBottom: 0 }}>
                            مدت برنامه‌ریزی‌شده: {formatNumFa(r.durationDays)} روز
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
