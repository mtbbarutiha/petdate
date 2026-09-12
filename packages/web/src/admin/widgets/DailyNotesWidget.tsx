/**
 * Per-day admin notes for the platform dashboard — follows calendar selection.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { adminFetch } from '../api';
import {
  formatJalaliSlash,
  gregorianIsoToJalaliParts,
  localDateToIso,
} from '../jalaliDate';
import { usePrefersReducedMotion } from '../motionCharts';
import { tr } from '../../i18n';
import { useDashboardSelectedDate } from './DashboardSelectedDate';
import type { WidgetRenderContext } from './types';

export const DAILY_NOTE_MAX_LEN = 500;

type DailyNote = {
  id: number;
  date: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

function formatNoteDay(iso: string): string {
  const j = formatJalaliSlash(gregorianIsoToJalaliParts(iso));
  return j || iso;
}

export function DailyNotesWidget({ ctx }: { ctx?: WidgetRenderContext }) {
  const reduced = usePrefersReducedMotion();
  const { selectedIso } = useDashboardSelectedDate();
  const todayIso = useMemo(() => localDateToIso(), []);
  const date = selectedIso || todayIso;
  const isToday = date === todayIso;
  const compact = ctx ? ctx.w <= 1 || ctx.h <= 1 : false;

  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const res = await adminFetch<{ date: string; notes: DailyNote[] }>(
        `/api/admin/daily-notes?date=${encodeURIComponent(day)}`
      );
      setNotes(res.notes || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا در بارگذاری یادداشت‌ها'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
    setEditingId(null);
    setDraft('');
  }, [date, load]);

  const addNote = async () => {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      const res = await adminFetch<{ note: DailyNote }>('/api/admin/daily-notes', {
        method: 'POST',
        body: JSON.stringify({ date, body }),
      });
      setNotes((prev) => [...prev, res.note]);
      setDraft('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا در ذخیره'));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: number) => {
    const body = editBody.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      const res = await adminFetch<{ note: DailyNote }>(`/api/admin/daily-notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      });
      setNotes((prev) => prev.map((n) => (n.id === id ? res.note : n)));
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا در ذخیره'));
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (id: number) => {
    if (saving) return;
    if (typeof window !== 'undefined' && !window.confirm(tr('حذف این یادداشت؟'))) return;
    setSaving(true);
    try {
      await adminFetch<{ ok: boolean }>(`/api/admin/daily-notes/${id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا در حذف'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`wdg-notes${compact ? ' wdg-notes--compact' : ''}${
        reduced ? ' wdg-notes--reduced' : ''
      }`}
    >
      <div className="wdg-notes-date">
        <StickyNote size={14} aria-hidden />
        <div className="wdg-notes-date-text">
          <strong>{formatNoteDay(date)}</strong>
          <span dir="ltr">{date}</span>
        </div>
        <span className={`wdg-notes-chip${isToday ? ' is-today' : ''}`}>
          {isToday ? tr('امروز') : tr('انتخاب‌شده از تقویم')}
        </span>
      </div>

      {error ? <p className="wdg-notes-error">{error}</p> : null}

      <ul className="wdg-notes-list" aria-label={tr('یادداشت‌های روزانه')}>
        {loading ? (
          <li className="wdg-notes-empty">{tr('در حال بارگذاری…')}</li>
        ) : notes.length === 0 ? (
          <li className="wdg-notes-empty">{tr('یادداشتی برای این روز نیست')}</li>
        ) : (
          notes.map((n) => (
            <li key={n.id} className="wdg-notes-item">
              {editingId === n.id ? (
                <>
                  <textarea
                    className="wdg-notes-input"
                    rows={compact ? 2 : 3}
                    maxLength={DAILY_NOTE_MAX_LEN}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    aria-label={tr('ویرایش یادداشت')}
                  />
                  <div className="wdg-notes-item-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary admin-btn--sm"
                      disabled={saving || !editBody.trim()}
                      onClick={() => void saveEdit(n.id)}
                    >
                      {tr('ذخیره')}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost admin-btn--sm"
                      onClick={() => setEditingId(null)}
                    >
                      {tr('لغو')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="wdg-notes-body">{n.body}</p>
                  {n.createdBy ? <span className="wdg-notes-meta">{n.createdBy}</span> : null}
                  <div className="wdg-notes-item-actions">
                    <button
                      type="button"
                      className="wdg-icon-btn"
                      aria-label={tr('ویرایش یادداشت')}
                      title={tr('ویرایش')}
                      onClick={() => {
                        setEditingId(n.id);
                        setEditBody(n.body);
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="wdg-icon-btn"
                      aria-label={tr('حذف یادداشت')}
                      title={tr('حذف')}
                      onClick={() => void removeNote(n.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))
        )}
      </ul>

      <form
        className="wdg-notes-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void addNote();
        }}
      >
        <textarea
          className="wdg-notes-input"
          rows={compact ? 2 : 3}
          maxLength={DAILY_NOTE_MAX_LEN}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={tr('یادداشت جدید…')}
          aria-label={tr('یادداشت جدید…')}
        />
        <div className="wdg-notes-composer-row">
          <span className="wdg-notes-count" dir="ltr">
            {draft.trim().length}/{DAILY_NOTE_MAX_LEN}
          </span>
          <button
            type="submit"
            className="admin-btn admin-btn--primary admin-btn--sm"
            disabled={saving || !draft.trim()}
          >
            <Plus size={13} aria-hidden /> {tr('افزودن یادداشت')}
          </button>
        </div>
      </form>
    </div>
  );
}
