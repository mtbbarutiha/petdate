import { Link } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { HELP_SECTION_LABELS, type HelpSectionId } from '@petdate/shared';
import { useI18n } from '../i18n';

/** In-app jump to the shared help section on /faq — not a second docs site. */
export function PageHelpLink({
  section,
  className = '',
}: {
  section: HelpSectionId;
  className?: string;
}) {
  const { lang, t } = useI18n();
  const locale = lang === 'en' ? 'en' : 'fa';
  return (
    <Link
      to={`/faq#${section}`}
      className={`pepito-page-help-link${className ? ` ${className}` : ''}`}
    >
      <CircleHelp size={16} strokeWidth={2.25} aria-hidden />
      <span>
        {t('nav.faq')} · {HELP_SECTION_LABELS[section][locale]}
      </span>
    </Link>
  );
}
