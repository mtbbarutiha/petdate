import { useCallback, useEffect, useState } from 'react';
import type { HrCandidate, HrJobOpening } from '@petdate/shared';
import { HR_CANDIDATE_STAGES } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

export function AdminHrAtsPage() {
  const [openings, setOpenings] = useState<HrJobOpening[]>([]);
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dupWarn, setDupWarn] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');

  const load = useCallback(async () => {
    try {
      const qs = stage ? `?stage=${encodeURIComponent(stage)}` : '';
      const [o, c] = await Promise.all([
        adminFetch<{ openings: HrJobOpening[] }>('/api/admin/hr/ats/openings'),
        adminFetch<{ candidates: HrCandidate[] }>(`/api/admin/hr/ats/candidates${qs}`),
      ]);
      setOpenings(o.openings);
      setCandidates(c.candidates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const addOpening = async () => {
    if (!canWrite) return;
    const title = window.prompt('عنوان موقعیت شغلی');
    if (!title?.trim()) return;
    const department = window.prompt('دپارتمان') || '';
    try {
      await adminFetch('/api/admin/hr/ats/openings', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), department }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const addCandidate = async () => {
    if (!canWrite) return;
    const firstName = window.prompt('نام متقاضی');
    if (!firstName?.trim()) return;
    const lastName = window.prompt('نام خانوادگی');
    if (!lastName?.trim()) return;
    const mobile = window.prompt('موبایل') || '';
    const jobOpeningId = openings[0]?.id;
    try {
      const res = await adminFetch<{ candidate: HrCandidate; duplicateMobile: boolean }>(
        '/api/admin/hr/ats/candidates',
        {
          method: 'POST',
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            mobile,
            jobOpeningId: jobOpeningId ?? null,
          }),
        }
      );
      setDupWarn(
        res.duplicateMobile ? 'هشدار: موبایل تکراری — رکورد قبلی حذف نشد' : null
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const setCandidateStage = async (id: number, next: string) => {
    if (!canWrite) return;
    try {
      await adminFetch(`/api/admin/hr/ats/candidates/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const openingTitle = (id?: number | null) =>
    openings.find((o) => o.id === id)?.title || '—';

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>استخدام و جذب (ATS)</h1>
          <p>
            {formatNumFa(openings.length)} آگهی · {formatNumFa(candidates.length)} متقاضی · بدون
            بیزنس‌لاین
          </p>
        </div>
        {canWrite ? (
          <div className="admin-toolbar" style={{ margin: 0 }}>
            <button type="button" className="admin-btn" onClick={() => void addOpening()}>
              آگهی جدید
            </button>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => void addCandidate()}>
              متقاضی جدید
            </button>
          </div>
        ) : (
          <span className="admin-topbar-chip">فقط خواندن</span>
        )}
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {dupWarn ? <p className="admin-success">{dupWarn}</p> : null}

      <section className="admin-card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>موقعیت‌های شغلی</h2>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>عنوان</th>
                <th>دپارتمان</th>
                <th>وضعیت</th>
                <th>ظرفیت</th>
              </tr>
            </thead>
            <tbody>
              {openings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    آگهی‌ای نیست
                  </td>
                </tr>
              ) : (
                openings.map((o) => (
                  <tr key={o.id}>
                    <td>{o.title}</td>
                    <td>{o.department || '—'}</td>
                    <td>
                      <span className="admin-pill">{o.status}</span>
                    </td>
                    <td>{formatNumFa(o.openings)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-toolbar">
        <select className="admin-select" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">همه مراحل</option>
          {HR_CANDIDATE_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          اعمال
        </button>
      </div>

      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>نام</th>
              <th>موبایل</th>
              <th>آگهی</th>
              <th>منبع</th>
              <th>مرحله</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  متقاضی‌ای نیست
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="admin-mono">{c.mobile || '—'}</td>
                  <td>{openingTitle(c.jobOpeningId)}</td>
                  <td>{c.source || c.jobBoard || '—'}</td>
                  <td>
                    {canWrite ? (
                      <select
                        className="admin-select"
                        value={c.stage}
                        onChange={(e) => void setCandidateStage(c.id, e.target.value)}
                      >
                        {HR_CANDIDATE_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="admin-pill">{c.stage}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
