interface AdminWordmarkProps {
  className?: string;
  size?: 'md' | 'lg';
}

/** Brand-first admin mark — matches Pet Date / Pepito shell. */
export function AdminWordmark({ className = '', size = 'md' }: AdminWordmarkProps) {
  return (
    <div className={`admin-wordmark admin-wordmark--${size} ${className}`.trim()}>
      <span className="admin-wordmark-mark" aria-hidden>PD</span>
      <div className="admin-wordmark-copy">
        <strong className="admin-wordmark-title">Pet Date</strong>
        <span className="admin-wordmark-sub">Admin Console</span>
      </div>
    </div>
  );
}
