import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { HrCandidate, HrCandidateCallLog, HrJobOpening } from '@petdate/shared';
import {
  HR_CALL_CONNECTED,
  HR_CALL_OUTCOMES,
  HR_CANDIDATE_STAGES,
  HR_JOB_BOARDS,
  isHrCallNoContact,
} from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import {
  JalaliDateSelect,
  currentJalaliParts,
  formatAdminFaDate,
  formatAdminFaDateTime,
  gregorianIsoToJalaliParts,
  jalaliPartsAndTimeToIso,
  jalaliPartsToGregorianIso,
  type JalaliDateValue,
} from '../../JalaliDateSelect';

type AtsMeta = {
  jobTitles: string[];
  openings: HrJobOpening[];
  interviewers: Array<{ id: number; name: string; jobTitle: string; department: string }>;
};

type Tab = 'list' | 'followup' | 'interview';

function stagePillClass(stage: string): string {
  if (stage.includes('استخدام')) return 'admin-pill admin-pill--mint';
  if (stage.startsWith('رد')) return 'admin-pill admin-pill--error';
  if (stage.includes('مصاحبه') || stage.includes('پیشنهاد')) return 'admin-pill admin-pill--warn';
  return 'admin-pill';
}

function callForRound(
  calls: HrCandidateCallLog[] | undefined,
  round: 1 | 2 | 3
): HrCandidateCallLog | undefined {
  return (calls || []).find((c) => c.round === round);
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
  const [editingOpeningId, setEditingOpeningId] = useState<number | null>(null);
  const [candidateModal, setCandidateModal] = useState(false);
  const [openingForm, setOpeningForm] = useState({
    title: '',
    department: '',
    jobBoard: '',
    postingCost: '',
  });
  const [openingPostedAt, setOpeningPostedAt] = useState<JalaliDateValue>(null);
  const [openingReceiptFile, setOpeningReceiptFile] = useState<File | null>(null);
  const [openingReceiptUrl, setOpeningReceiptUrl] = useState('');
  const [candidateForm, setCandidateForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    jobOpeningId: '',
    jobBoard: '',
    jobTitle: '',
  });
  const [draftOutcome, setDraftOutcome] = useState<string>(HR_CALL_OUTCOMES[0]);
  const [draftNote, setDraftNote] = useState('');
  const [draftCallDate, setDraftCallDate] = useState<JalaliDateValue>(null);
  const [interviewDate, setInterviewDate] = useState<JalaliDateValue>(null);
  const [interviewTime, setInterviewTime] = useState('10:00');
  const [interviewerId, setInterviewerId] = useState('');
  const [interviewNote, setInterviewNote] = useState('');
  const [startDate, setStartDate] = useState<JalaliDateValue>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraftOutcome(HR_CALL_OUTCOMES[0]);
    setDraftNote('');
    setDraftCallDate(null);
    if (selected?.followup.interviewNote) {
      setInterviewNote(selected.followup.interviewNote);
    } else {
      setInterviewNote('');
    }
    if (selected?.followup.interviewerEmployeeId) {
      setInterviewerId(String(selected.followup.interviewerEmployeeId));
    } else {
      setInterviewerId('');
    }
  }, [selectedId, selected?.followup.callRound]);

  const openNewOpening = () => {
    setEditingOpeningId(null);
    setOpeningForm({ title: '', department: '', jobBoard: '', postingCost: '' });
    setOpeningPostedAt(currentJalaliParts());
    setOpeningReceiptFile(null);
    setOpeningReceiptUrl('');
    setOpeningModal(true);
  };

  const openEditOpening = (o: HrJobOpening) => {
    setEditingOpeningId(o.id);
    setOpeningForm({
      title: o.title,
      department: o.department || '',
      jobBoard: o.jobBoard || '',
      postingCost: o.postingCost > 0 ? String(o.postingCost) : '',
    });
    setOpeningPostedAt(gregorianIsoToJalaliParts(o.postedAt || o.createdAt));
    setOpeningReceiptFile(null);
    setOpeningReceiptUrl(o.paymentReceiptUrl || '');
    setOpeningModal(true);
  };

  const saveOpening = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !openingForm.title.trim()) return;
    const postedAt = jalaliPartsToGregorianIso(openingPostedAt);
    if (!postedAt) {
      setError('تاریخ درج آگهی الزامی است');
      return;
    }
    if (!openingForm.jobBoard) {
      setError('انتخاب جاب برد الزامی است');
      return;
    }
    setBusy(true);
    try {
      const costRaw = openingForm.postingCost.replace(/[^\d]/g, '');
      const postingCost = costRaw ? Number(costRaw) : 0;
      const body = {
        title: openingForm.title.trim(),
        department: openingForm.department.trim(),
        jobBoard: openingForm.jobBoard,
        postedAt,
        postingCost: Number.isFinite(postingCost) ? postingCost : 0,
        paymentReceiptUrl: openingReceiptUrl || undefined,
      };
      let openingId = editingOpeningId;
      if (editingOpeningId != null) {
        await adminFetch(`/api/admin/hr/ats/openings/${editingOpeningId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        const created = await adminFetch<{ opening: HrJobOpening }>('/api/admin/hr/ats/openings', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        openingId = created.opening.id;
      }
      if (openingReceiptFile && openingId != null) {
        const fd = new FormData();
        fd.append('file', openingReceiptFile);
        await adminFetch(`/api/admin/hr/ats/openings/${openingId}/receipt`, {
          method: 'POST',
          body: fd,
        });
      }
      setOpeningModal(false);
      setEditingOpeningId(null);
      setOpeningForm({ title: '', department: '', jobBoard: '', postingCost: '' });
      setOpeningPostedAt(null);
      setOpeningReceiptFile(null);
      setOpeningReceiptUrl('');
      setError(null);
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
    const round = selected.followup.callRound;
    if (round >= 2 && !jalaliPartsToGregorianIso(draftCallDate)) {
      setError(`تاریخ شمسی تماس ${formatNumFa(round)} الزامی است`);
      return;
    }
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const atIso = round >= 2 ? jalaliPartsToGregorianIso(draftCallDate) : null;
      const res = await adminFetch<{ candidate: HrCandidate }>(
        `/api/admin/hr/ats/candidates/${selected.id}/calls`,
        {
          method: 'POST',
          body: JSON.stringify({
            outcome: draftOutcome,
            note: draftNote.trim(),
            ...(atIso ? { at: atIso } : {}),
          }),
        }
      );
      const calls = res.candidate.followup.calls;
      const recordedRound = calls[calls.length - 1]?.round ?? round;
      const wasConnected = draftOutcome === HR_CALL_CONNECTED;
      setMsg(`نتیجه تماس ${formatNumFa(recordedRound)} ثبت شد`);
      setDraftOutcome(HR_CALL_OUTCOMES[0]);
      setDraftNote('');
      setDraftCallDate(null);
      await load();
      if (wasConnected) {
        setTab('interview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const scheduleInterview = async () => {
    if (!canWrite || !selected) return;
    const interviewAt = jalaliPartsAndTimeToIso(interviewDate, interviewTime);
    if (!interviewAt) {
      setError('تاریخ و ساعت مصاحبه الزامی است');
      return;
    }
    if (!interviewerId) {
      setError('انتخاب مصاحبه‌گر از اطلاعات پرسنلی الزامی است');
      return;
    }
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      await adminFetch<{ candidate: HrCandidate; notify?: unknown }>(
        `/api/admin/hr/ats/candidates/${selected.id}/interview`,
        {
          method: 'POST',
          body: JSON.stringify({
            interviewAt,
            interviewerEmployeeId: Number(interviewerId),
            interviewNote: interviewNote.trim(),
          }),
        }
      );
      setMsg('مصاحبه زمان‌بندی شد · تسک برای مصاحبه‌گر در کارتابل · پیامک/ایمیل در صف');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'approve' | 'reject') => {
    if (!canWrite || !selected) return;
    const startIso = jalaliPartsToGregorianIso(startDate);
    if (decision === 'approve' && !startIso) {
      setError('تاریخ شروع برای تایید الزامی است');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await adminFetch(`/api/admin/hr/ats/candidates/${selected.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, startDate: startIso || '' }),
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

  const call1 = callForRound(selected?.followup.calls, 1);
  const call2 = callForRound(selected?.followup.calls, 2);
  const call3 = callForRound(selected?.followup.calls, 3);
  const currentRound = selected?.followup.callRound ?? 1;
  const rejected = selected?.stage.startsWith('رد شده') ?? false;

  // Three no-contact cases on call 1 → open call 2 (+ Jalali date)
  const showCall2 =
    !!call2 ||
    !!call3 ||
    currentRound >= 2 ||
    (call1 ? isHrCallNoContact(call1.outcome) : currentRound === 1 && isHrCallNoContact(draftOutcome));

  // Second call also no-contact → open call 3 (+ Jalali date)
  const showCall3 =
    !!call3 ||
    currentRound >= 3 ||
    (call2
      ? isHrCallNoContact(call2.outcome)
      : showCall2 && currentRound === 2 && !call2 && isHrCallNoContact(draftOutcome));

  const renderCallHistory = (c: HrCandidateCallLog) => (
    <div className="hr-ats-call-done" key={`${c.round}-${c.at}`}>
      <p>
        تماس {formatNumFa(c.round)} · <b>{c.outcome}</b> · {formatAdminFaDateTime(c.at)}
      </p>
      {c.note ? <p className="admin-muted">توضیحات: {c.note}</p> : null}
    </div>
  );

  const renderActiveCallForm = (round: 1 | 2 | 3) => {
    if (currentRound !== round || rejected || callForRound(selected?.followup.calls, round)) {
      return null;
    }
    return (
      <div className="hr-ats-call-form">
        {round >= 2 ? (
          <JalaliDateSelect
            label={`تاریخ تماس ${formatNumFa(round)} (شمسی)`}
            value={draftCallDate}
            onChange={setDraftCallDate}
            allowEmpty
            yearsBack={1}
            yearsForward={0}
          />
        ) : null}
        <label>
          <span className="form-label">نتیجه تماس {formatNumFa(round)}</span>
          <select
            className="admin-select"
            value={draftOutcome}
            onChange={(e) => setDraftOutcome(e.target.value)}
          >
            {HR_CALL_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="hr-ats-call-note">
          <span className="form-label">توضیحات</span>
          <textarea
            className="form-input"
            rows={3}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="یادداشت تماس…"
          />
        </label>
        <div className="admin-toolbar">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={busy || !canWrite}
            onClick={() => void recordCall()}
          >
            ثبت نتیجه تماس {formatNumFa(round)}
            {round === 1 ? ' (خودکار تاریخ)' : ''}
          </button>
          {draftOutcome === HR_CALL_CONNECTED ? (
            <span className="admin-muted">پس از ثبت → تب هماهنگی مصاحبه</span>
          ) : null}
        </div>
      </div>
    );
  };

  const applicantPicker = (
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
  );

  const selectedHead = selected ? (
    <>
      <div className="admin-card-head">
        <h2>
          {selected.firstName} {selected.lastName}
        </h2>
        <span className={stagePillClass(selected.stage)}>{selected.stage}</span>
      </div>
      <p className="admin-muted">
        تماس فعلی: {formatNumFa(selected.followup.callRound)} از ۳ ·{' '}
        {selected.jobTitle || openingTitle(selected.jobOpeningId)} · {selected.jobBoard || '—'}
      </p>
    </>
  ) : null;

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
            <button type="button" className="admin-btn" onClick={openNewOpening}>
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
        <button
          type="button"
          className={`admin-tab${tab === 'interview' ? ' is-on' : ''}`}
          onClick={() => setTab('interview')}
        >
          هماهنگی مصاحبه
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
                    <th>جاب برد</th>
                    <th>تاریخ درج</th>
                    <th>هزینه درج</th>
                    <th>رسید</th>
                    <th>وضعیت</th>
                    <th>ظرفیت</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {openings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="admin-empty">
                        آگهی‌ای نیست
                      </td>
                    </tr>
                  ) : (
                    openings.map((o) => (
                      <tr key={o.id}>
                        <td>{o.title}</td>
                        <td>{o.department || '—'}</td>
                        <td>{o.jobBoard || '—'}</td>
                        <td>{formatAdminFaDate(o.postedAt || o.createdAt) || '—'}</td>
                        <td>{o.postingCost > 0 ? formatTomanFa(o.postingCost) : '—'}</td>
                        <td>
                          {o.paymentReceiptUrl ? (
                            <a
                              className="admin-link"
                              href={o.paymentReceiptUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(o.paymentReceiptUrl) ? (
                                <img
                                  src={o.paymentReceiptUrl}
                                  alt="رسید پرداخت"
                                  style={{
                                    width: 40,
                                    height: 40,
                                    objectFit: 'cover',
                                    borderRadius: 6,
                                    display: 'block',
                                  }}
                                />
                              ) : (
                                'مشاهده رسید'
                              )}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className={stagePillClass(o.status)}>{o.status}</span>
                        </td>
                        <td>{formatNumFa(o.openings)}</td>
                        <td>
                          {canWrite ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              onClick={() => openEditOpening(o)}
                            >
                              ویرایش
                            </button>
                          ) : null}
                        </td>
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
                  <th>جاب برد</th>
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
      ) : null}

      {tab === 'followup' ? (
        <section className="admin-card" style={{ padding: 16 }}>
          {applicantPicker}
          {!selected ? (
            <p className="admin-muted">یک متقاضی را انتخاب کنید یا از «متقاضی جدید» شروع کنید.</p>
          ) : (
            <div className="hr-ats-followup">
              {selectedHead}

              <div className="hr-ats-call-stage">
                <h3 style={{ fontSize: '0.95rem' }}>تماس ۱</h3>
                {call1 ? renderCallHistory(call1) : renderActiveCallForm(1)}
                {!call1 && currentRound === 1 && isHrCallNoContact(draftOutcome) ? (
                  <p className="admin-muted">
                    با انتخاب یکی از سه حالت عدم ارتباط (نبود / عدم دسترسی / موکول به آینده) پس از ثبت،
                    تماس ۲ و تاریخ شمسی باز می‌شود.
                  </p>
                ) : null}
              </div>

              {showCall2 ? (
                <div className="hr-ats-call-stage">
                  <h3 style={{ fontSize: '0.95rem' }}>تماس ۲</h3>
                  {call2 ? renderCallHistory(call2) : null}
                  {currentRound === 2 && !call2 ? renderActiveCallForm(2) : null}
                  {!call2 && currentRound === 1 && isHrCallNoContact(draftOutcome) ? (
                    <div className="hr-ats-call-preview">
                      <JalaliDateSelect
                        label="تاریخ تماس ۲ (شمسی)"
                        value={draftCallDate}
                        onChange={setDraftCallDate}
                        allowEmpty
                        yearsBack={1}
                        yearsForward={0}
                        disabled
                      />
                      <p className="admin-muted">
                        پس از ثبت تماس ۱ با یکی از سه حالت عدم ارتباط، این فیلدها فعال می‌شوند.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showCall3 ? (
                <div className="hr-ats-call-stage">
                  <h3 style={{ fontSize: '0.95rem' }}>تماس ۳</h3>
                  {call3 ? renderCallHistory(call3) : null}
                  {currentRound === 3 && !call3 ? renderActiveCallForm(3) : null}
                  {!call3 && currentRound === 2 && isHrCallNoContact(draftOutcome) ? (
                    <div className="hr-ats-call-preview">
                      <JalaliDateSelect
                        label="تاریخ تماس ۳ (شمسی)"
                        value={null}
                        onChange={() => undefined}
                        allowEmpty
                        yearsBack={1}
                        yearsForward={0}
                        disabled
                      />
                      <p className="admin-muted">
                        پس از ثبت تماس ۲ با عدم ارتباط، فرم تماس ۳ فعال می‌شود.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!call1 && !selected.followup.calls?.length ? (
                <p className="admin-muted" style={{ marginTop: 8 }}>
                  هنوز تماسی ثبت نشده
                </p>
              ) : null}

              {selected.followup.calls.some((c) => c.outcome === HR_CALL_CONNECTED) ? (
                <p className="admin-success" style={{ marginTop: 12 }}>
                  متقاضی پاسخگو بود —{' '}
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() => setTab('interview')}
                  >
                    برو به هماهنگی مصاحبه
                  </button>
                </p>
              ) : null}

              <h3 style={{ fontSize: '0.95rem' }}>تصمیم نهایی</h3>
              <div className="admin-toolbar">
                <JalaliDateSelect
                  label="تاریخ شروع"
                  value={startDate}
                  onChange={setStartDate}
                  allowEmpty
                  yearsBack={1}
                  yearsForward={2}
                />
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
      ) : null}

      {tab === 'interview' ? (
        <section className="admin-card" style={{ padding: 16 }}>
          {applicantPicker}
          {!selected ? (
            <p className="admin-muted">یک متقاضی را انتخاب کنید.</p>
          ) : (
            <div className="hr-ats-followup">
              {selectedHead}

              {!selected.followup.calls.some((c) => c.outcome === HR_CALL_CONNECTED) ? (
                <p className="admin-muted">
                  هماهنگی مصاحبه پس از ثبت نتیجه «پاسخگو بود» در پیگیری تماس فعال می‌شود.
                </p>
              ) : (
                <>
                  <h3 style={{ fontSize: '0.95rem' }}>زمان‌بندی و تخصیص مصاحبه</h3>
                  <div className="admin-toolbar admin-ats-interview" style={{ flexWrap: 'wrap' }}>
                    <JalaliDateSelect
                      label="تاریخ مصاحبه"
                      value={interviewDate}
                      onChange={setInterviewDate}
                      yearsBack={1}
                      yearsForward={1}
                    />
                    <label>
                      <span className="form-label">ساعت</span>
                      <input
                        type="time"
                        className="admin-select"
                        value={interviewTime}
                        onChange={(e) => setInterviewTime(e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="form-label">مصاحبه‌گر (اطلاعات پرسنلی)</span>
                      <select
                        className="admin-select"
                        value={interviewerId}
                        onChange={(e) => setInterviewerId(e.target.value)}
                      >
                        <option value="">انتخاب پرسنل</option>
                        {(meta?.interviewers || []).map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name}
                            {p.jobTitle ? ` — ${p.jobTitle}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="hr-ats-call-note" style={{ display: 'block', marginTop: 12 }}>
                    <span className="form-label">توضیحات مصاحبه‌گر</span>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={interviewNote}
                      onChange={(e) => setInterviewNote(e.target.value)}
                      placeholder="نکات هماهنگی، موضوع مصاحبه، محل…"
                    />
                  </label>
                  <div className="admin-toolbar" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      disabled={
                        busy || !canWrite || !interviewDate || !interviewTime || !interviewerId
                      }
                      onClick={() => void scheduleInterview()}
                    >
                      ثبت مصاحبه + تسک پرسنل + پیامک/ایمیل
                    </button>
                  </div>
                  {selected.followup.interviewAt ? (
                    <div className="hr-ats-call-done" style={{ marginTop: 12 }}>
                      <p>
                        مصاحبه ثبت‌شده:{' '}
                        <b>{formatAdminFaDateTime(selected.followup.interviewAt)}</b>
                        {selected.followup.interviewerName
                          ? ` · ${selected.followup.interviewerName}`
                          : ''}
                      </p>
                      {selected.followup.interviewNote ? (
                        <p className="admin-muted">توضیحات: {selected.followup.interviewNote}</p>
                      ) : null}
                      <p className="admin-muted">
                        تسک در کارتابل فعالیت منابع انسانی برای مصاحبه‌گر ایجاد می‌شود.
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </section>
      ) : null}

      <AdminModal
        open={openingModal}
        title={editingOpeningId != null ? 'ویرایش آگهی' : 'آگهی جدید'}
        onClose={() => {
          setOpeningModal(false);
          setEditingOpeningId(null);
        }}
        as="form"
        onSubmit={(e) => void saveOpening(e)}
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
              onClick={() => {
                setOpeningModal(false);
                setEditingOpeningId(null);
              }}
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
            placeholder="مثلاً فروش — نه جاب‌بورد"
          />
        </label>
        <label>
          <span className="form-label">جاب برد</span>
          <select
            className="form-input"
            required
            value={openingForm.jobBoard}
            onChange={(e) => setOpeningForm({ ...openingForm, jobBoard: e.target.value })}
          >
            <option value="">انتخاب جاب برد</option>
            {HR_JOB_BOARDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <JalaliDateSelect
          label="تاریخ درج آگهی"
          value={openingPostedAt}
          onChange={setOpeningPostedAt}
          allowEmpty={false}
          yearsBack={5}
          yearsForward={1}
        />
        <label>
          <span className="form-label">هزینه درج آگهی (تومان)</span>
          <input
            className="form-input"
            type="text"
            inputMode="numeric"
            dir="ltr"
            placeholder="مثلاً 2500000"
            value={openingForm.postingCost}
            onChange={(e) =>
              setOpeningForm({
                ...openingForm,
                postingCost: e.target.value.replace(/[^\d]/g, ''),
              })
            }
          />
          {openingForm.postingCost ? (
            <span className="admin-muted" style={{ display: 'block', marginTop: 4 }}>
              {formatTomanFa(Number(openingForm.postingCost) || 0)}
            </span>
          ) : null}
        </label>
        <label>
          <span className="form-label">محل درج رسید پرداخت آگهی</span>
          <input
            className="form-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={(e) => setOpeningReceiptFile(e.target.files?.[0] ?? null)}
          />
          {openingReceiptFile ? (
            <span className="admin-muted" style={{ display: 'block', marginTop: 4 }}>
              {openingReceiptFile.name}
            </span>
          ) : openingReceiptUrl ? (
            <a
              className="admin-link"
              href={openingReceiptUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', marginTop: 6 }}
            >
              رسید فعلی
            </a>
          ) : null}
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
          <span className="form-label">جاب برد</span>
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
