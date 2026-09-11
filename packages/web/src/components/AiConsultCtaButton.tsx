import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: ReactNode;
  badge?: string;
  busyLabel?: ReactNode;
  busy?: boolean;
  testId?: string;
};

/** Primary AI consult CTA — icon + corner «Ai» badge. */
export function AiConsultCtaButton({
  label,
  badge = 'Ai',
  busy = false,
  busyLabel,
  testId,
  className = '',
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`pepito-btn button-1 pepito-ai-consult-cta ${className}`.trim()}
      disabled={disabled || busy}
      data-testid={testId}
      {...rest}
    >
      <span className="pepito-ai-consult-cta-badge" aria-hidden>
        {badge}
      </span>
      <span className="pepito-btn-icon" aria-hidden>
        <Sparkles size={16} strokeWidth={2.25} />
      </span>
      <span className="pepito-ai-consult-cta-label">
        {busy ? busyLabel ?? label : label}
      </span>
      {children}
    </button>
  );
}
