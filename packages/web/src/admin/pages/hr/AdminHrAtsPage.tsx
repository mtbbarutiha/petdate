import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { HrCandidate, HrJobOpening } from '@petdate/shared';
import {
  HR_CALL_CONNECTED,
  HR_CALL_OUTCOMES,
  HR_CANDIDATE_STAGES,
  HR_JOB_BOARDS,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';

type AtsMeta = {
  jobTitles: string[];
  openings: HrJobOpening[];
  interviewers: Array<{ id: number; name: string; jobTitle: string; department: string }>;
};

type Tab = 'list' | 'followup';

function stagePillClass(stage: string): string {
  if (stage.includes('استخدام')) return 'admin-pill admin-pill--mint';
  if (stage.startsWith('رد')) return 'admin-pill admin-pill--error';
  if (stage.includes('مصاحبه') || stage.includes('پیشنهاد')) return 'admin-pill admin-pill--warn';
  return 'admin-pill';
}

export function AdminHrAtsPage() {
  const [openings, setOpenings] = useState<HrJobOpening[]>([]);
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [meta, setMeta] = useState<AtsMeta | null>(null);
  const [stage, setStage] = useState('');
  const [tab, setTab] = useState<Tab>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dupWarn, setDupWarn] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');

  const load = useCallback(async () => {
    try {
      const qs = stage ? `?stage=${encodeURIComponent(stage)}` : '';
      const [o, c, m] = await Promise.all([
        adminFetch<{ openings: HrJobOpening[] }>('/api/admin/hr/ats/openings'),
        adminFetch<{ candidates: HrCandidate[] }>(`/api/admin/hr/ats/candidates${qs}`),
        adminFetch<AtsMeta>('/api/admin/hr/ats/meta'),
      ]);
      setOpenings(o.openings);
      setCandidates(c.candidates);
      setMeta(m);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => candidates.find((c) => c.id === selectedId) || null,
    [candidates, selectedId]
  );

  const [openingModal, setOpeningModal] = useState(false);
  const [candidateModal, setCandidateModal] = useState(false);
  const [openingForm, setOpeningForm] = useState({ title: '', department: '' });
  const [candidateForm, setCandidateForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    jobOpeningId: '',
    jobBoard: '',
    jobTitle: '',
  });
  const [callOutcome, setCallOutcome] = useState<string>(HR_CALL_OUTCOMES[0]);
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewerId, setInterviewerId] = useState('');
  const [startDate, setStartDate] = useState('');
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
            email: candidateForm.email.trim(),
            jobOpeningId,
            jobBoard: candidateForm.jobBoard,
            jobTitle: candidateForm.jobTitle,
            source: candidateForm.jobBoard,
          }),
        }
      );
      setDupWarn(res.duplicateMobile ? 'هشدار: موبایل تکراری — رکورد قبلی حذف نشد' : null);
      setCandidateModal(false);
      setCandidateForm({
        firstName: '',
        lastName: '',
        mobile: '',
        email: '',
        jobOpeningId: '',
        jobBoard: '',
        jobTitle: '',
      });
      setSelectedId(res.candidate.id);
      setTab('followup');
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

  const recordCall = async () => {
    if (!canWrite || !selected) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch<{ candidate: HrCandidate }>(
        `/api/admin/hr/ats/candidates/${selected.id}/calls`,
        { method: 'POST', body: JSON.stringify({ outcome: callOutcome }) }
      );
      setMsg(`نتیجه تماس ${formatNumFa(res.candidate.followup.callRound)} ثبت شد`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const scheduleInterview = async () => {
    if (!canWrite || !selected || !interviewAt) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch<{ candidate: HrCandidate; notify?: unknown }>(
        `/api/admin/hr/ats/candidates/${selected.id}/interview`,
        {
          method: 'POST',
          body: JSON.stringify({
            interviewAt,
            interviewerEmployeeId: interviewerId ? Number(interviewerId) : null,
          }),
        }
      );
      setMsg('مصاحبه زمان‌بندی شد · پیامک/ایمیل در صف ارسال');
      void res;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'approve' | 'reject') => {
    if (!canWrite || !selected) return;
    if (decision === 'approve' && !startDate) {
      setError('تاریخ شروع برای تایید الزامی است');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await adminFetch(`/api/admin/hr/ats/candidates/${selected.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, startDate }),
      });
      if (decision === 'approve') {
        await adminFetch(`/api/admin/hr/ats/candidates/${selected.id}/stage`, {
          method: 'PATCH',
          body: JSON.stringify({ stage: 'استخدام‌شده' }),
        });
      }
      setMsg(decision === 'approve' ? 'تایید شد · مدارک ایمیل می‌شود' : 'رد شد · ایمیل مودبانه ارسال شد');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const openingTitle = (id?: number | null) => openings.find((o) => o.id === id)?.title || '—';
  const jobTitles = meta?.jobTitles?.length
    ? meta.jobTitles
    : [...new Set(openings.map((o) => o.title).filter(Boolean))];

  const lastConnected = selected?.followup.calls.some((c) => c.outcome === HR_CALL_CONNECTED);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>استخدام و جذب (ATS)</h1>
          <p>
            {formatNumFa(openings.length)} آگهی · {formatNumFa(candidates.length)} متقاضی
          </p>
        </div>
        {canWrite ? (
          <div className="admin-toolbar" style={{ margin: 0 }}>
            <button type="button" className="admin-btn" onClick={() => setOpeningModal(true)}>
              آگهی جدید
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => {
                setCandidateForm((f) => ({
                  ...f,
                  jobOpeningId: openings[0] ? String(openings[0].id) : '',
                }));
                setCandidateModal(true);
              }}
            >
              متقاضی جدید
            </button>
          </div>
        ) : (
          <span className="admin-topbar-chip">فقط خواندن</span>
        )}
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {dupWarn ? <p className="admin-success">{dupWarn}</p> : null}
      {msg ? <p className="admin-success">{msg}</p> : null}

      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          className={`admin-tab${tab === 'list' ? ' is-on' : ''}`}
          onClick={() => setTab('list')}
        >
          فهرست متقاضیان
        </button>
        <button
          type="button"
          className={`admin-tab${tab === 'followup' ? ' is-on' : ''}`}
          onClick={() => setTab('followup')}
        >
          پیگیری تماس
        </button>
      </div>

      {tab === 'list' ? (
        <>
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
                          <span className={stagePillClass(o.status)}>{o.status}</span>
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
              <option value="">همه وضعیت‌ها</option>
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
                  <th>موقعیت</th>
                  <th>جاب‌بورد</th>
                  <th>وضعیت</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-empty">
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
                      <td>{c.jobTitle || openingTitle(c.jobOpeningId)}</td>
                      <td>{c.jobBoard || c.source || '—'}</td>
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
                          <span className={stagePillClass(c.stage)}>{c.stage}</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => {
                            setSelectedId(c.id);
                            setTab('followup');
                          }}
                        >
                          پیگیری
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <section className="admin-card" style={{ padding: 16 }}>
          <div className="admin-toolbar" style={{ marginTop: 0 }}>
            <label>
              <span className="form-label">انتخاب متقاضی</span>
              <select
                className="admin-select"
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">—</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} · {c.stage}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!selected ? (
            <p className="admin-muted">یک متقاضی را انتخاب کنید یا از «متقاضی جدید» شروع کنید.</p>
          ) : (
            <div className="hr-ats-followup">
              <div className="admin-card-head">
                <h2>
                  {selected.firstName} {selected.lastName}
                </h2>
                <span className={stagePillClass(selected.stage)}>{selected.stage}</span>
              </div>
              <p className="admin-muted">
                تماس فعلی: {formatNumFa(selected.followup.callRound)} از ۳ ·{' '}
                {selected.jobTitle || openingTitle(selected.jobOpeningId)} ·{' '}
                {selected.jobBoard || '—'}
              </p>

              <h3 style={{ fontSize: '0.95rem' }}>نتیجه تماس</h3>
              <div className="admin-toolbar">
                <select
                  className="admin-select"
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                >
                  {HR_CALL_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={busy || !canWrite || selected.stage.startsWith('رد شده')}
                  onClick={() => void recordCall()}
                >
                  ثبت نتیجه (خودکار تاریخ)
                </button>
              </div>

              <ul className="admin-log-list">
                {(selected.followup.calls || []).map((c, i) => (
                  <li key={`${c.at}-${i}`}>
                    تماس {formatNumFa(c.round)} · <b>{c.outcome}</b> ·{' '}
                    {new Date(c.at).toLocaleString('fa-IR')}
                  </li>
                ))}
                {!selected.followup.calls?.length ? (
                  <li className="admin-muted">هنوز تماسی ثبت نشده</li>
                ) : null}
              </ul>

              {lastConnected ? (
                <>
                  <h3 style={{ fontSize: '0.95rem' }}>زمان‌بندی مصاحبه</h3>
                  <div className="admin-toolbar">
                    <input
                      type="datetime-local"
                      className="admin-select"
                      value={interviewAt}
                      onChange={(e) => setInterviewAt(e.target.value)}
                    />
                    <select
                      className="admin-select"
                      value={interviewerId}
                      onChange={(e) => setInterviewerId(e.target.value)}
                    >
                      <option value="">مصاحبه‌گر (پرسنل)</option>
                      {(meta?.interviewers || []).map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name}
                          {p.jobTitle ? ` — ${p.jobTitle}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busy || !canWrite || !interviewAt}
                      onClick={() => void scheduleInterview()}
                    >
                      ثبت مصاحبه + پیامک/ایمیل
                    </button>
                  </div>
                  {selected.followup.interviewAt ? (
                    <p className="admin-muted">
                      مصاحبه: {selected.followup.interviewAt.replace('T', ' ').slice(0, 16)}
                      {selected.followup.interviewerName
                        ? ` · ${selected.followup.interviewerName}`
                        : ''}
                    </p>
                  ) : null}
                </>
              ) : null}

              <h3 style={{ fontSize: '0.95rem' }}>تصمیم نهایی</h3>
              <div className="admin-toolbar">
                <label>
                  <span className="form-label">تاریخ شروع</span>
                  <input
                    type="date"
                    className="admin-select"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={busy || !canWrite}
                  onClick={() => void decide('approve')}
                >
                  تایید استخدام
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={busy || !canWrite}
                  onClick={() => void decide('reject')}
                >
                  رد متقاضی
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <AdminModal
        open={openingModal}
        title="آگهی جدید"
        onClose={() => setOpeningModal(false)}
        as="form"
        onSubmit={(e) => void addOpening(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
              ذخیره
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={busy}
              onClick={() => setOpeningModal(false)}
            >
              انصراف
            </button>
          </>
        }
      >
        <label>
          <span className="form-label">عنوان موقعیت شغلی</span>
          <input
            className="form-input"
            required
            value={openingForm.title}
            onChange={(e) => setOpeningForm({ ...openingForm, title: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">دپارتمان</span>
          <input
            className="form-input"
            value={openingForm.department}
            onChange={(e) => setOpeningForm({ ...openingForm, department: e.target.value })}
          />
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
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
              ذخیره و پیگیری
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={busy}
              onClick={() => setCandidateModal(false)}
            >
              انصراف
            </button>
          </>
        }
      >
        <label>
          <span className="form-label">نام</span>
          <input
            className="form-input"
            required
            value={candidateForm.firstName}
            onChange={(e) => setCandidateForm({ ...candidateForm, firstName: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">نام خانوادگی</span>
          <input
            className="form-input"
            required
            value={candidateForm.lastName}
            onChange={(e) => setCandidateForm({ ...candidateForm, lastName: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">موبایل</span>
          <input
            className="form-input"
            dir="ltr"
            value={candidateForm.mobile}
            onChange={(e) => setCandidateForm({ ...candidateForm, mobile: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">ایمیل (Gmail)</span>
          <input
            className="form-input"
            dir="ltr"
            type="email"
            value={candidateForm.email}
            onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">جاب‌بورد</span>
          <select
            className="form-input"
            value={candidateForm.jobBoard}
            onChange={(e) => setCandidateForm({ ...candidateForm, jobBoard: e.target.value })}
          >
            <option value="">—</option>
            {HR_JOB_BOARDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="form-label">عنوان شغلی (پرسنلی)</span>
          <select
            className="form-input"
            value={candidateForm.jobTitle}
            onChange={(e) => setCandidateForm({ ...candidateForm, jobTitle: e.target.value })}
          >
            <option value="">—</option>
            {jobTitles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="form-label">آگهی مرتبط</span>
          <select
            className="form-input"
            value={candidateForm.jobOpeningId}
            onChange={(e) => setCandidateForm({ ...candidateForm, jobOpeningId: e.target.value })}
          >
            <option value="">—</option>
            {openings.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
      </AdminModal>
    </div>
  );
}
