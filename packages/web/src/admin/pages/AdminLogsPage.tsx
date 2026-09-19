import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronLeft, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { adminFetch } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { groupConsecutiveLogs } from '../adminLogGroups';
import { adminLogSecondary, pickLogTitle, translateAppLogMessage } from '../adminLogMessageFa';
import { appConfirm } from '../../components/AppDialog';
import { tr, useI18n } from '../../i18n';
import { AdminBrandLoader } from '../AdminBrandLoader';

type LogRow = {
  id: number;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
};

type LogStats = {
  total: number;
  errors24h: number;
  warns24h: number;
  lastErrorAt: string | null;
};

const POLL_MS = 5000;

const LEVEL_KEYS: Record<string, string> = {
  error: 'common.error',
  warn: 'common.warning',
  info: 'common.info',
};

const SOURCE_FA: Record<string, string> = {
  api: 'API',
  bot: 'ربات',
  external: 'خارجی',
};

function levelLabel(level: string): string {
  const key = LEVEL_KEYS[level];
  return key ? tr(key) : level;
}

function sourceLabel(source: string): string {
  const mapped = SOURCE_FA[source] || source;
  return tr(mapped);
}

export function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFp, setExpandedFp] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [groupDupes, setGroupDupes] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const silentRef = useRef(false);
  const userCollapsedRef = useRef(false);
  const { lang } = useI18n();

  const load = useCallback(async () => {
    const silent = silentRef.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: '150' });
      if (level) qs.set('level', level);
      const data = await adminFetch<{ stats: LogStats; logs: LogRow[] }>(
        `/api/admin/logs?${qs}`
      );
      setStats(data.stats);
      setLogs(data.logs);
      setUpdatedAt(new Date().toLocaleTimeString('fa-IR'));
      setLive(true);
    } catch (err) {
      setLive(false);
      setError(err instanceof Error ? err.message : 'بارگذاری لاگ ناموفق بود');
    } finally {
      setLoading(false);
      silentRef.current = true;
    }
  }, [level]);

  useEffect(() => {
    silentRef.current = false;
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  async function clearOld() {
    if (!(await appConfirm(tr('لاگ‌های قدیمی‌تر از ۷ روز پاک شوند؟'), { danger: true, variant: 'admin' }))) return;
    try {
      await adminFetch('/api/admin/logs?olderThanDays=7', { method: 'DELETE' });
      silentRef.current = false;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'پاک‌سازی ناموفق بود');
    }
  }

  async function clearAll() {
    if (!(await appConfirm(tr('همهٔ لاگ‌های ثبت‌شده پاک شوند؟ این عمل برگشت‌ناپذیر است.'), { danger: true, variant: 'admin' }))) return;
    try {
      await adminFetch('/api/admin/logs', { method: 'DELETE' });
      silentRef.current = false;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'پاک‌سازی ناموفق بود');
    }
  }

  const rows = useMemo(() => {
    if (!groupDupes) {
      return logs.map((row) => ({
        key: `row-${row.id}`,
        fingerprint: `row-${row.id}`,
        count: 1,
        latest: row,
        oldest: row,
        items: [row],
      }));
    }
    return groupConsecutiveLogs(logs);
  }, [logs, groupDupes]);

  useEffect(() => {
    userCollapsedRef.current = false;
  }, [level, groupDupes]);

  // Keep panel open across polls; open the first row until the user collapses it.
  useEffect(() => {
    if (!rows.length) {
      setExpandedFp(null);
      return;
    }
    if (userCollapsedRef.current) return;
    setExpandedFp((cur) => {
      if (cur && rows.some((g) => g.fingerprint === cur)) return cur;
      return rows[0]!.fingerprint;
    });
  }, [rows]);

  async function copyRaw(row: LogRow) {
    try {
      await navigator.clipboard.writeText(row.message);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === row.id ? null : cur)), 1600);
    } catch {
      setError(tr('کپی ناموفق بود'));
    }
  }

  return (
    <div className="admin-page admin-page--logs">
      <header className="admin-header">
        <div>
          <h1>{tr('لاگ خطاها')}</h1>
          <p>
            {tr('خطاها و هشدارهای API و ربات — زنده')}
            {updatedAt ? `${tr(' · آخرین بروزرسانی ')}${updatedAt}` : ''}
            {live ? tr(' · متصل') : tr(' · قطع')}
          </p>
        </div>
        <div className="admin-header-actions">
          <label className="admin-log-toggle">
            <input
              type="checkbox"
              checked={groupDupes}
              onChange={(e) => setGroupDupes(e.target.checked)}
            />
            {tr('گروه‌بندی تکرارها')}
          </label>
          <select
            className="admin-select"
            value={level}
            onChange={(e) => {
              silentRef.current = false;
              setLevel(e.target.value);
            }}
            aria-label={tr('فیلتر سطح')}
          >
            <option value="">{tr('همه سطوح')}</option>
            <option value="error">{tr('common.error')}</option>
            <option value="warn">{tr('common.warning')}</option>
            <option value="info">{tr('common.info')}</option>
          </select>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              silentRef.current = false;
              void load();
            }}
          >
            <RefreshCw size={16} />
            {tr('بروزرسانی')}
          </button>
          <button type="button" className="admin-btn admin-btn--danger" onClick={() => void clearOld()}>
            <Trash2 size={16} />
            {tr('پاک‌سازی ۷روز')}
          </button>
          <button type="button" className="admin-btn admin-btn--danger" onClick={() => void clearAll()}>
            <Trash2 size={16} />
            {tr('پاک کردن همه')}
          </button>
        </div>
      </header>

      {stats ? (
        <div className="admin-stats" role="group" aria-label={tr('فیلتر سطح')}>
          <button
            type="button"
            className={`admin-stat admin-stat--slate admin-stat-btn${level === '' ? ' is-active' : ''}`}
            aria-pressed={level === ''}
            onClick={() => {
              silentRef.current = false;
              setLevel('');
            }}
          >
            <div className="admin-stat-icon">
              <Activity size={20} />
            </div>
            <div>
              <div className="admin-stat-value">{stats.total}</div>
              <div className="admin-stat-label">{tr('کل لاگ‌ها')}</div>
            </div>
          </button>
          <button
            type="button"
            className={`admin-stat admin-stat--orange admin-stat-btn${level === 'error' ? ' is-active' : ''}`}
            aria-pressed={level === 'error'}
            onClick={() => {
              silentRef.current = false;
              setLevel('error');
            }}
          >
            <div className="admin-stat-icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="admin-stat-value">{stats.errors24h}</div>
              <div className="admin-stat-label">{tr('خطا ۲۴س')}</div>
            </div>
          </button>
          <button
            type="button"
            className={`admin-stat admin-stat--blue admin-stat-btn${level === 'warn' ? ' is-active' : ''}`}
            aria-pressed={level === 'warn'}
            onClick={() => {
              silentRef.current = false;
              setLevel('warn');
            }}
          >
            <div className="admin-stat-icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="admin-stat-value">{stats.warns24h}</div>
              <div className="admin-stat-label">{tr('هشدار ۲۴س')}</div>
            </div>
          </button>
        </div>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}
      {loading && !logs.length ? <AdminBrandLoader size="page" /> : null}
      {!loading && logs.length === 0 ? (
        <div className="admin-card">
          <p className="admin-muted">
            {level
              ? tr('برای این فیلتر لاگی نیست. «کل لاگ‌ها» را بزن تا همهٔ ردیف‌ها بیاید.')
              : tr('لاگی ثبت نشده است.')}
          </p>
        </div>
      ) : null}

      {logs.length > 0 ? (
      <section className="admin-card admin-card--logs">
        <div className="admin-table-wrap admin-table-wrap--logs">
          <table className="admin-table admin-table--dense admin-table--logs">
            <thead>
              <tr>
                <th>{tr('زمان')}</th>
                <th>{tr('سطح')}</th>
                <th>{tr('منبع')}</th>
                <th>{tr('پیام')}</th>
                <th>{tr('مسیر')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((group) => {
                const row = group.latest;
                const mapped = translateAppLogMessage(row);
                const primary = pickLogTitle(mapped, lang);
                const secondary = adminLogSecondary(mapped, primary);
                const rawMessage = (row.message || '').trim();
                const isOpen = expandedFp === group.fingerprint;
                const pathText = `${row.method ? `${row.method} ` : ''}${row.path || '—'}${
                  row.statusCode ? ` · ${row.statusCode}` : ''
                }`;
                return (
                  <Fragment key={group.key}>
                    <tr
                      className={`admin-log-row admin-log-row--${row.level}${isOpen ? ' is-open' : ''}`}
                      onClick={() => {
                        if (isOpen) {
                          userCollapsedRef.current = true;
                          setExpandedFp(null);
                        } else {
                          userCollapsedRef.current = false;
                          setExpandedFp(group.fingerprint);
                        }
                      }}
                      aria-expanded={isOpen}
                    >
                      <td className="admin-log-when">
                        <span className="admin-log-expand-toggle" aria-hidden>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
                        </span>
                        <span className="admin-cell-nowrap">{formatAdminFaDateTime(row.createdAt)}</span>
                        {group.count > 1 ? (
                          <span className="admin-log-count">{tr('{n} مورد مشابه', { n: group.count })}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`admin-badge admin-badge--level admin-badge--${row.level}`}>
                          {levelLabel(row.level)}
                        </span>
                      </td>
                      <td>
                        <span className="admin-log-source">{sourceLabel(row.source)}</span>
                      </td>
                      <td className="admin-log-msg">
                        <span className="admin-log-msg-fa" lang={lang === 'en' ? 'en' : 'fa'} dir={lang === 'en' ? 'ltr' : 'rtl'}>
                          {primary}
                          {group.count > 1 ? (
                            <span className="admin-log-count admin-log-count--inline">
                              {tr('{n} مورد مشابه', { n: group.count })}
                            </span>
                          ) : null}
                        </span>
                        {rawMessage ? (
                          <bdi className="admin-log-msg-detail admin-log-msg-raw" dir="ltr" lang="en">
                            {rawMessage}
                          </bdi>
                        ) : secondary ? (
                          <bdi className="admin-log-msg-detail" dir="ltr" lang="en">
                            {secondary}
                          </bdi>
                        ) : null}
                      </td>
                      <td className="admin-mono admin-log-path">
                        <bdi dir="ltr">{pathText}</bdi>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="admin-log-expand">
                        <td colSpan={5}>
                          <div className="admin-log-expand-inner">
                            {group.count > 1 ? (
                              <p className="admin-log-expand-meta">
                                {tr('از {from} تا {to}', {
                                  from: formatAdminFaDateTime(group.oldest.createdAt),
                                  to: formatAdminFaDateTime(group.latest.createdAt),
                                })}
                                {' · '}
                                {tr('{n} مورد مشابه', { n: group.count })}
                              </p>
                            ) : null}
                            <div className="admin-log-raw-head">
                              <span>{tr('متن خطا')}</span>
                              <button
                                type="button"
                                className="admin-btn admin-btn--ghost admin-log-copy"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyRaw(row);
                                }}
                              >
                                <Copy size={14} />
                                {copiedId === row.id ? tr('کپی شد') : tr('کپی متن اصلی')}
                              </button>
                            </div>
                            <pre className="admin-stack admin-log-raw" dir="ltr" lang="en">
                              <bdi dir="ltr">{rawMessage || '—'}</bdi>
                            </pre>
                            {row.stack ? (
                              <>
                                <div className="admin-log-raw-head">
                                  <span>{tr('Stack')}</span>
                                </div>
                                <pre className="admin-stack">{row.stack}</pre>
                              </>
                            ) : null}
                            {row.meta && Object.keys(row.meta).length ? (
                              <>
                                <div className="admin-log-raw-head">
                                  <span>{tr('جزئیات')}</span>
                                </div>
                                <pre className="admin-stack admin-log-raw" dir="ltr" lang="en">
                                  {JSON.stringify(row.meta, null, 2)}
                                </pre>
                              </>
                            ) : null}
                            {group.count > 1 ? (
                              <ul className="admin-log-dupes">
                                {group.items.map((item) => (
                                  <li key={item.id}>
                                    <span className="admin-cell-nowrap">
                                      {formatAdminFaDateTime(item.createdAt)}
                                    </span>
                                    <bdi dir="ltr" lang="en">
                                      #{item.id}
                                      {item.statusCode != null ? ` · ${item.statusCode}` : ''}
                                    </bdi>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            <div className="admin-log-expand-hint">
                              <ChevronDown size={14} />
                              {tr('برای بستن ردیف دوباره کلیک کنید')}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </div>
  );
}
