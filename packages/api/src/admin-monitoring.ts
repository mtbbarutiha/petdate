/**
 * Live service-check helpers for admin monitoring.
 * Status tones: up (ok) | warn (degraded) | down (error) | not_configured.
 */
import fs from 'fs';
import path from 'path';

export type CheckStatus = 'up' | 'down' | 'warn' | 'not_configured';

export type ServiceCheck = {
  ok: boolean;
  status: CheckStatus;
  detail: string;
  freeGb?: number;
  totalGb?: number;
  latencyMs?: number;
};

export function checkUp(detail: string, extra: Partial<ServiceCheck> = {}): ServiceCheck {
  return { ok: true, status: 'up', detail, ...extra };
}

export function checkDown(detail: string, extra: Partial<ServiceCheck> = {}): ServiceCheck {
  return { ok: false, status: 'down', detail, ...extra };
}

/** Degraded but not a hard outage — does not fail overall `ok` by itself. */
export function checkWarn(detail: string, extra: Partial<ServiceCheck> = {}): ServiceCheck {
  return { ok: true, status: 'warn', detail, ...extra };
}

export function checkNotConfigured(detail = 'پیکربندی نشده'): ServiceCheck {
  return { ok: true, status: 'not_configured', detail };
}

const GB = 1024 ** 3;
const MB = 1024 ** 2;

/** Disk thresholds: warn below 5 GB free or ≥85% used; down below 512 MB or ≥95% used. */
export function classifyDisk(freeBytes: number, totalBytes: number): ServiceCheck {
  const freeGb = Math.round((freeBytes / GB) * 100) / 100;
  const totalGb = Math.round((totalBytes / GB) * 100) / 100;
  const usedPct = totalBytes > 0 ? Math.round((1 - freeBytes / totalBytes) * 1000) / 10 : 0;
  const detail = `${freeGb} / ${totalGb} GB آزاد · ${usedPct}% پر`;
  const extra = { freeGb, totalGb };

  if (freeBytes < 512 * MB || usedPct >= 95) {
    return checkDown(detail, extra);
  }
  if (freeBytes < 5 * GB || usedPct >= 85) {
    return checkWarn(detail, extra);
  }
  return checkUp(detail, extra);
}

export function diskCheck(dir: string): ServiceCheck {
  try {
    const st = fs.statfsSync(dir);
    const total = Number(st.blocks) * Number(st.bsize);
    const free = Number(st.bavail) * Number(st.bsize);
    return classifyDisk(free, total);
  } catch (err) {
    return checkDown((err as Error).message);
  }
}

/** Live SQLite file probe — readable + non-empty when present. */
export function sqliteFileCheck(filePath: string, roleFa: string): ServiceCheck {
  if (!filePath) return checkNotConfigured('مسیر SQLite مشخص نیست');
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    const st = fs.statSync(filePath);
    const sizeMb = Math.round((st.size / MB) * 100) / 100;
    if (st.size <= 0) {
      return checkWarn(`${roleFa} · فایل خالی (${path.basename(filePath)})`);
    }
    return checkUp(`${roleFa} · ${sizeMb} MB`);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return checkDown(`${roleFa} · فایل نیست`);
    }
    return checkDown(`${roleFa} · ${(err as Error).message}`);
  }
}

/** Map Elasticsearch `_cluster/health` status → check. */
export function classifyElasticsearchHealth(
  clusterStatus: string,
  endpoint: string,
): ServiceCheck {
  const s = clusterStatus.toLowerCase();
  if (s === 'green') return checkUp(`${endpoint} · cluster green`);
  if (s === 'yellow') return checkWarn(`${endpoint} · cluster yellow`);
  if (s === 'red') return checkDown(`${endpoint} · cluster red`);
  return checkWarn(`${endpoint} · status ${clusterStatus || '?'}`);
}

/** Slow public HTTP (≥1.5s) is a warning even when status is 2xx. */
export function classifyHttpResult(
  label: string,
  httpStatus: number,
  latencyMs: number,
  slowMs = 1500,
): ServiceCheck {
  if (httpStatus >= 200 && httpStatus < 400) {
    const detail = `${label} · HTTP ${httpStatus}${latencyMs >= slowMs ? ` · ${latencyMs}ms` : ''}`;
    if (latencyMs >= slowMs) return checkWarn(detail, { latencyMs });
    return checkUp(detail, { latencyMs });
  }
  return checkDown(`${label} · HTTP ${httpStatus}`, { latencyMs });
}

/** Keys that never fail overall monitoring when down. */
export function isNonCriticalCheck(
  key: string,
  postgresIsSourceOfTruth: boolean,
): boolean {
  if (key === 'elasticsearch' || key === 'smtp' || key === 'sms') return true;
  if (key === 'postgres' && !postgresIsSourceOfTruth) return true;
  return false;
}
