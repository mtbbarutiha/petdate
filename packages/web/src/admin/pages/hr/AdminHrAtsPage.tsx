import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { HrCandidate, HrJobOpening } from '@petdate/shared';
import { HR_CANDIDATE_STAGES } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';

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

  const [openingModal, setOpeningModal] = useState(false);
  const [candidateModal, setCandidateModal] = useState(false);
  const [openingForm, setOpeningForm] = useState({ title: '', department: '' });
  const [candidateForm, setCandidateForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    jobOpeningId: '',
  });
  const [busy, setBusy] = useState(false);

  const addOpening = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !openingForm.title.trim()) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/hr/ats/openings', {
        method: 'POST',
        body: JSON.stringify({
          title: openingForm.title.trim(),
          department: openingForm.department.trim(),
        }),
      });
      setOpeningModal(false);
      setOpeningForm({ title: '', department: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const addCandidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !candidateForm.firstName.trim() || !candidateForm.lastName.trim()) return;
    setBusy(true);
    try {
      const jobOpeningId = candidateForm.jobOpeningId
        ? Number(candidateForm.jobOpeningId)
        : openings[0]?.id ?? null;
      const res = await adminFetch<{ candidate: HrCandidate; duplicateMobile: boolean }>(
        '/api/admin/hr/ats/candidates',
        {
          method: 'POST',
          body: JSON.stringify({
            firstName: candidateForm.firstName.trim(),
            lastName: candidateForm.lastName.trim(),
            mobile: candidateForm.mobile.trim(),
            jobOpeningId,
          }),
        }
      );
      setDupWarn(
        res.duplicateMobile ? 'هشدار: موبایل تکراری — رکورد قبلی حذف نشد' : null
      );
      setCandidateModal(false);
      setCandidateForm({ firstName: '', lastName: '', mobile: '', jobOpeningId: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
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
            <button type="button" className="admin-btn" onClick={() => setOpeningModal(true)}>
              آگهی جدید
            </button>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => {
              setCandidateForm((f) => ({ ...f, jobOpeningId: openings[0] ? String(openings[0].id) : '' }));
              setCandidateModal(true);
            }}>
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

      <AdminModal
        open={openingModal}
        title="آگهی جدید"
        onClose={() => setOpeningModal(false)}
        as="form"
        onSubmit={(e) => void addOpening(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpeningModal(false)}>انصراف</button>
          </>
        }
      >
        <label>
          <span className="form-label">عنوان موقعیت شغلی</span>
          <input className="form-input" required value={openingForm.title} onChange={(e) => setOpeningForm({ ...openingForm, title: e.target.value })} />
        </label>
        <label>
          <span className="form-label">دپارتمان</span>
          <input className="form-input" value={openingForm.department} onChange={(e) => setOpeningForm({ ...openingForm, department: e.target.value })} />
        </label>
      </AdminModal>

      <AdminModal
        open={candidateModal}
        title="متقاضی جدید"
        onClose={() => setCandidateModal(false)}
        as="form"
        onSubmit={(e) => void addCandidate(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setCandidateModal(false)}>انصراف</button>
          </>
        }
      >
        <label>
          <span className="form-label">نام</span>
          <input className="form-input" required value={candidateForm.firstName} onChange={(e) => setCandidateForm({ ...candidateForm, firstName: e.target.value })} />
        </label>
        <label>
          <span className="form-label">نام خانوادگی</span>
          <input className="form-input" required value={candidateForm.lastName} onChange={(e) => setCandidateForm({ ...candidateForm, lastName: e.target.value })} />
        </label>
        <label>
          <span className="form-label">موبایل</span>
          <input className="form-input" dir="ltr" value={candidateForm.mobile} onChange={(e) => setCandidateForm({ ...candidateForm, mobile: e.target.value })} />
        </label>
        <label>
          <span className="form-label">موقعیت شغلی</span>
          <select className="form-input" value={candidateForm.jobOpeningId} onChange={(e) => setCandidateForm({ ...candidateForm, jobOpeningId: e.target.value })}>
            <option value="">—</option>
            {openings.map((o) => <option key={o.id} value={String(o.id)}>{o.title}</option>)}
          </select>
        </label>
      </AdminModal>
    </div>
  );
}
