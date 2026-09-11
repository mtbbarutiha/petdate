/**
 * Shared motion chart primitives for all admin dashboards.
 * SVG kit + Recharts helpers — Pepito mint/teal first, soft multi-hue gradients.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { formatNumFa } from './api';
import {
  MOTION_DUR_MS,
  MOTION_PALETTE,
  clampPct,
  hexToRgba,
  smoothAreaPath,
  smoothLinePath,
} from './motionChartMath';

export {
  MOTION_DUR_MS,
  MOTION_PALETTE,
  clampPct,
  hexToRgba,
  smoothAreaPath,
  smoothLinePath,
} from './motionChartMath';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return reduced;
}

/** Count-up number for ring/gauge centers. */
export function useCountUp(target: number, durationMs: number, enabled: boolean): number {
  const [val, setVal] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setVal(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, enabled]);
  return val;
}

export function usePathDraw(enabled: boolean, pathKey = ''): {
  pathRef: React.RefObject<SVGPathElement | null>;
  style: CSSProperties;
} {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (!enabled || !pathRef.current) {
      setLen(0);
      return;
    }
    try {
      setLen(Math.ceil(pathRef.current.getTotalLength()));
    } catch {
      setLen(0);
    }
  }, [enabled, pathKey]);
  const style: CSSProperties =
    enabled && len > 0
      ? ({
          strokeDasharray: len,
          strokeDashoffset: len,
          animation: `admin-motion-line-draw ${MOTION_DUR_MS.line}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
        } as CSSProperties)
      : {};
  return { pathRef, style };
}

/** Floating callout tooltip for Recharts. */
export function MotionChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string; color?: string; dataKey?: string }>;
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="admin-motion-callout" role="tooltip">
      {label ? <div className="admin-motion-callout-label">{label}</div> : null}
      {payload.map((p, i) => {
        const n = Number(p.value ?? 0);
        const text = money
          ? `${formatNumFa(Math.round(n))} ریال`
          : formatNumFa(Number.isFinite(n) ? n : 0);
        return (
          <div key={i} className="admin-motion-callout-row" style={{ color: p.color || 'var(--admin-ink)' }}>
            {p.name ? <span className="admin-motion-callout-name">{p.name}</span> : null}
            <strong>{text}</strong>
          </div>
        );
      })}
    </div>
  );
}

/** Recharts animation props — respects reduced motion. */
export function useRechartsMotion() {
  const reduced = usePrefersReducedMotion();
  return {
    isAnimationActive: !reduced,
    animationDuration: reduced ? 0 : MOTION_DUR_MS.bar,
    animationEasing: 'ease-out' as const,
  };
}

/** Gradient stop defs for vertical bar fills (mint ↔ blue / coral). */
export function MotionBarGradientDefs({
  id,
  from = MOTION_PALETTE.mint,
  to = MOTION_PALETTE.blue,
}: {
  id: string;
  from?: string;
  to?: string;
}) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={from} stopOpacity={0.95} />
        <stop offset="100%" stopColor={to} stopOpacity={0.75} />
      </linearGradient>
      <linearGradient id={`${id}-h`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={from} stopOpacity={0.95} />
        <stop offset="100%" stopColor={to} stopOpacity={0.75} />
      </linearGradient>
    </defs>
  );
}

export function MotionAreaGradientDefs({
  id,
  color = MOTION_PALETTE.mint,
  mid,
}: {
  id: string;
  color?: string;
  mid?: string;
}) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={mid || color} stopOpacity={0.42} />
        <stop offset="55%" stopColor={color} stopOpacity={0.14} />
        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

/** Single progress ring (screenshot-style donut meter). */
export function AdminProgressRing({
  value,
  max = 100,
  size = 88,
  color = MOTION_PALETTE.mint,
  label,
  showPct = true,
}: {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  label?: string;
  showPct?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const pct = max > 0 ? clampPct((value / max) * 100) : 0;
  const display = useCountUp(showPct ? pct : value, MOTION_DUR_MS.ring, !reduced);
  const r = 34;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const uid = useId().replace(/:/g, '');
  return (
    <div className="admin-motion-ring" style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 88 88" className="admin-motion-ring-svg" role="img">
        <defs>
          <linearGradient id={`ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={hexToRgba(color, 0.65)} />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={r} fill="none" stroke={MOTION_PALETTE.track} strokeWidth="9" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={`url(#ring-${uid})`}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          transform="rotate(-90 44 44)"
          className={reduced ? undefined : 'admin-motion-ring-arc'}
          style={
            reduced
              ? undefined
              : ({
                  ['--ring-target' as string]: String(filled),
                  ['--ring-circ' as string]: String(circ),
                } as CSSProperties)
          }
        />
        <text x="44" y="42" textAnchor="middle" className="admin-motion-ring-num">
          {formatNumFa(Math.round(display))}
          {showPct ? '٪' : ''}
        </text>
        {label ? (
          <text x="44" y="56" textAnchor="middle" className="admin-motion-ring-sub">
            {label.length > 12 ? `${label.slice(0, 11)}…` : label}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

/** Mini sparkline with gradient fill. */
export function AdminSparkline({
  values,
  color = MOTION_PALETTE.mint,
  width = 120,
  height = 36,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, '');
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const padY = 4;
  const coords = values.map((v, i) => ({
    x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    y: padY + (height - padY * 2) * (1 - (v - min) / span),
  }));
  const line = smoothLinePath(coords);
  const area = smoothAreaPath(coords, height);
  const { pathRef, style } = usePathDraw(!reduced, line);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="admin-motion-spark"
      aria-hidden
    >
      <defs>
        <linearGradient id={`spk-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spk-${uid})`} className={reduced ? undefined : 'admin-motion-area-fade'} />
      <path
        ref={pathRef}
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={style}
      />
    </svg>
  );
}

/** Soft glowing circular gauge (blob energy, Pepito mint/blue). */
export function AdminMotionGauge({
  value,
  label,
  size = 140,
  color = MOTION_PALETTE.mint,
}: {
  value: number;
  label?: string;
  size?: number;
  color?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const display = useCountUp(value, MOTION_DUR_MS.gauge, !reduced);
  const uid = useId().replace(/:/g, '');
  return (
    <div className="admin-motion-gauge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" width={size} height={size} role="img">
        <defs>
          <radialGradient id={`gg-${uid}`} cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={hexToRgba(color, 0.35)} />
            <stop offset="70%" stopColor={hexToRgba(MOTION_PALETTE.blue, 0.18)} />
            <stop offset="100%" stopColor={hexToRgba(MOTION_PALETTE.purple, 0.08)} />
          </radialGradient>
          <linearGradient id={`gr-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={MOTION_PALETTE.blue} />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={MOTION_PALETTE.purple} />
          </linearGradient>
        </defs>
        <circle
          cx="80"
          cy="80"
          r="68"
          fill={`url(#gg-${uid})`}
          className={reduced ? undefined : 'admin-motion-gauge-pulse'}
        />
        <circle
          cx="80"
          cy="80"
          r="58"
          fill="none"
          stroke={`url(#gr-${uid})`}
          strokeWidth="6"
          strokeDasharray="12 8"
          opacity={0.85}
          className={reduced ? undefined : 'admin-motion-gauge-spin'}
        />
        <circle cx="80" cy="80" r="46" fill="#fff" opacity={0.92} />
        <text x="80" y="78" textAnchor="middle" className="admin-motion-gauge-num">
          {formatNumFa(Math.round(display))}
        </text>
        {label ? (
          <text x="80" y="96" textAnchor="middle" className="admin-motion-gauge-sub">
            {label}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

/** Horizontal gradient progress meter. */
export function AdminHProgress({
  value,
  max = 100,
  label,
  color = MOTION_PALETTE.mint,
  toColor = MOTION_PALETTE.blue,
}: {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  toColor?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const pct = max > 0 ? clampPct((value / max) * 100) : 0;
  return (
    <div className="admin-motion-hprog">
      <div className="admin-motion-hprog-meta">
        {label ? <span>{label}</span> : null}
        <strong>{formatNumFa(value)}</strong>
      </div>
      <div className="admin-motion-hprog-track">
        <div
          className={reduced ? 'admin-motion-hprog-fill' : 'admin-motion-hprog-fill admin-motion-hprog-fill--anim'}
          style={
            {
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${color}, ${toColor})`,
            } as CSSProperties
          }
        />
      </div>
    </div>
  );
}

export function MotionChartShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`admin-motion-shell${className ? ` ${className}` : ''}`}>{children}</div>;
}
