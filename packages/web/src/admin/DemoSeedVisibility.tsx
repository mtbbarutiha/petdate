import { useCallback, useState } from 'react';
import { filterDemoSeedRows, isDemoSeedRecord } from '@petdate/shared';
import { tr } from '../i18n';

const STORAGE_KEY = 'petdate.admin.showDemoSeeds';

function defaultShowDemoSeeds(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    /* ignore */
  }
  return !import.meta.env.PROD;
}

export function useShowDemoSeeds(): {
  showDemoSeeds: boolean;
  setShowDemoSeeds: (next: boolean) => void;
} {
  const [showDemoSeeds, setShow] = useState(defaultShowDemoSeeds);
  const setShowDemoSeeds = useCallback((next: boolean) => {
    setShow(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);
  return { showDemoSeeds, setShowDemoSeeds };
}

export function DemoSeedToggle({
  showDemoSeeds,
  onChange,
  hiddenCount = 0,
}: {
  showDemoSeeds: boolean;
  onChange: (next: boolean) => void;
  hiddenCount?: number;
}) {
  return (
    <label className="admin-check-inline admin-demo-seed-toggle">
      <input
        type="checkbox"
        checked={showDemoSeeds}
        onChange={(e) => onChange(e.target.checked)}
      />
      {tr('نمایش داده تست')}
      {!showDemoSeeds && hiddenCount > 0 ? (
        <span className="admin-muted">
          {' '}
          ({tr('{n} ردیف تست مخفی است').replace('{n}', String(hiddenCount))})
        </span>
      ) : null}
    </label>
  );
}

export function DemoSeedBadge({ row }: { row: unknown }) {
  if (!isDemoSeedRecord(row)) return null;
  return <span className="admin-pill admin-pill--seed">{tr('داده تست')}</span>;
}

export { filterDemoSeedRows, isDemoSeedRecord };
