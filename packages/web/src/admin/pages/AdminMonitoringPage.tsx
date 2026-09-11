import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  MinusCircle,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { adminFetch } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { checkTone, type CheckTone } from '../monitoringTone';

type CheckStatus = 'up' | 'down' | 'warn' | 'not_configured';
type Check = {
  ok: boolean;
  status?: CheckStatus;
  detail?: string;
  freeGb?: number;
  totalGb?: number;
  latencyMs?: number;
};

type Monitoring = {
  ok: boolean;
  degraded?: boolean;
  generatedAt: string;
  publicDomain?: string;
  publicWebUrl?: string;
  publicPdfUrl?: string;
  uptimeSec: number;
  node: string;
  platform: string;
  hostname: string;
  loadAvg: number[];
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
    systemFreeMb: number;
    systemTotalMb: number;
  };
  counts: {
    users: number;
    pets: number;
    playdates: number;
    playdatesAccepted: number;
    chatMessages: number;
    openGames: number;
  };
  logs: {
    total: number;
    errors24h: number;
    warns24h: number;
    lastErrorAt: string | null;
  };
  checks: Record<string, Check>;
  unhealthy: string[];
  warnings?: string[];
};

const CHECK_LABELS: Record<string, string> = {
  site: 'سایت اصلی',
  www: 'www',
  api: 'API عمومی',
  pdf: 'PDF',
  websocket: 'WebSocket',
  telegramBot: 'ربات تلگرام',
  sqlite: 'SQLite',
  postgres: 'Postgres',
  redis: 'Redis',
  s3: 'S3 / MinIO',
  elasticsearch: 'Elasticsearch',
  smtp: 'SMTP',
  sms: 'پیامک (Candoo)',
  disk: 'دیسک',
};

const CHECK_ORDER = [
  'site',
  'www',
  'api',
  'pdf',
  'websocket',
  'telegramBot',
  'sqlite',
  'postgres',
  'redis',
  's3',
  'elasticsearch',
  'smtp',
  'sms',
  'disk',
] as const;

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}ر ${h}س ${m}د`;
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د ${sec % 60}ث`;
}

function formatGeneratedAt(iso: string): string {
  return formatAdminFaDateTime(iso);
}

function orderedChecks(checks: Record<string, Check>): Array<[string, Check]> {
  const seen = new Set<string>();
  const out: Array<[string, Check]> = [];
  for (const key of CHECK_ORDER) {
    if (checks[key]) {
      out.push([key, checks[key]!]);
      seen.add(key);
    }
  }
  for (const [key, check] of Object.entries(checks)) {
    if (!seen.has(key)) out.push([key, check]);
  }
  return out;
}

function CheckIcon({ tone }: { tone: CheckTone }) {
  if (tone === 'ok') return <CheckCircle2 size={18} aria-hidden />;
  if (tone === 'warn') return <AlertTriangle size={18} aria-hidden />;
  if (tone === 'idle') return <MinusCircle size={18} aria-hidden />;
  return <XCircle size={18} aria-hidden />;
}

function bannerClass(data: Monitoring): string {
  if (!data.ok) return 'is-bad';
  if (data.degraded || (data.warnings && data.warnings.length > 0)) return 'is-warn';
  return 'is-ok';
}

export function AdminMonitoringPage() {
  const [data, setData] = useState<Monitoring | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<Monitoring>('/api/admin/monitoring'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری مانیتورینگ ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>مانیتورینگ</h1>
          <p>
            وضعیت زنده روی دامنه اصلی
            {data?.publicDomain ? ` (${data.publicDomain})` : ''} — هر ۱۰ ثانیه
          </p>
        </div>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          <RefreshCw size={16} />
          بروزرسانی
        </button>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {loading && !data ? <p className="admin-muted">در حال بارگذاری…</p> : null}

      {data ? (
        <>
          <div className={`admin-health-banner ${bannerClass(data)}`}>
            {!data.ok ? (
              <XCircle size={20} />
            ) : data.degraded || (data.warnings && data.warnings.length > 0) ? (
              <AlertTriangle size={20} />
            ) : (
              <CheckCircle2 size={20} />
            )}
            <div>
              <strong>
                {!data.ok
                  ? 'مشکل در سرویس‌های حیاتی'
                  : data.degraded || (data.warnings && data.warnings.length > 0)
                    ? 'سیستم با هشدار کار می‌کند'
                    : 'سیستم سالم است'}
              </strong>
              <span>
                {data.publicWebUrl || data.publicDomain || data.hostname}
                {' · '}
                uptime {formatUptime(data.uptimeSec)}
                {' · '}
                {data.node}
              </span>
            </div>
          </div>

          <div className="admin-stats">
            <div className="admin-stat admin-stat--slate">
              <div className="admin-stat-icon">
                <Server size={20} />
              </div>
              <div>
                <div className="admin-stat-value">{data.memory.rssMb} MB</div>
                <div className="admin-stat-label">RAM فرآیند API</div>
              </div>
            </div>
            <div className="admin-stat admin-stat--blue">
              <div className="admin-stat-icon">
                <Cpu size={20} />
              </div>
              <div>
                <div className="admin-stat-value">{data.loadAvg.join(' / ')}</div>
                <div className="admin-stat-label">Load average</div>
              </div>
            </div>
            <div className="admin-stat admin-stat--green">
              <div className="admin-stat-icon">
                <HardDrive size={20} />
              </div>
              <div>
                <div className="admin-stat-value">
                  {data.memory.systemFreeMb} / {data.memory.systemTotalMb} MB
                </div>
                <div className="admin-stat-label">RAM آزاد سیستم</div>
              </div>
            </div>
            <div className="admin-stat admin-stat--orange">
              <div className="admin-stat-icon">
                <Activity size={20} />
              </div>
              <div>
                <div className="admin-stat-value">{data.logs.errors24h}</div>
                <div className="admin-stat-label">خطای ۲۴ ساعت</div>
              </div>
            </div>
          </div>

          <section className="admin-card">
            <div className="admin-card-head">
              <h2>سرویس‌ها</h2>
              <span className="admin-muted">{formatGeneratedAt(data.generatedAt)}</span>
            </div>
            <div className="admin-checks">
              {orderedChecks(data.checks).map(([key, check]) => {
                const tone = checkTone(check);
                return (
                  <div key={key} className={`admin-check is-${tone}`} data-status={check.status || tone}>
                    <CheckIcon tone={tone} />
                    <div>
                      <strong>{CHECK_LABELS[key] || key}</strong>
                      <span>
                        {check.detail ||
                          (check.freeGb != null
                            ? `${check.freeGb} / ${check.totalGb} GB آزاد`
                            : tone === 'ok'
                              ? 'OK'
                              : tone === 'warn'
                                ? 'هشدار'
                                : tone === 'idle'
                                  ? 'پیکربندی نشده'
                                  : 'DOWN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-card-head">
              <h2>
                <Database size={18} /> آمار دیتابیس
              </h2>
            </div>
            <div className="admin-stats">
              <div className="admin-stat admin-stat--slate">
                <div>
                  <div className="admin-stat-value">{data.counts.users}</div>
                  <div className="admin-stat-label">کاربران</div>
                </div>
              </div>
              <div className="admin-stat admin-stat--blue">
                <div>
                  <div className="admin-stat-value">{data.counts.pets}</div>
                  <div className="admin-stat-label">پت‌ها</div>
                </div>
              </div>
              <div className="admin-stat admin-stat--green">
                <div>
                  <div className="admin-stat-value">{data.counts.playdatesAccepted}</div>
                  <div className="admin-stat-label">همبازی قبول‌شده</div>
                </div>
              </div>
              <div className="admin-stat admin-stat--orange">
                <div>
                  <div className="admin-stat-value">{data.counts.chatMessages}</div>
                  <div className="admin-stat-label">پیام چت</div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
