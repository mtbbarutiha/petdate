import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useI18n } from '../i18n';
import { INLINE_SECTION_COUNT, type SiteHeaderLink } from './siteHeaderLinks';
import { SiteHeaderLinkView } from './SiteHeaderLinkView';

/**
 * Desktop overflow for secondary marketing/shop links.
 * First INLINE_SECTION_COUNT items stay in the inline row on wide screens;
 * this menu always holds the rest, and the duplicates at ≥1440 via CSS.
 */
export function SiteNavOverflow({ links }: { links: SiteHeaderLink[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [open]);

  if (links.length === 0) return null;

  return (
    <div
      className={`pepito-nav-overflow${links.length <= INLINE_SECTION_COUNT ? ' pepito-nav-overflow--wide-redundant' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="pepito-nav-overflow-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('nav.more')}
        title={t('nav.more')}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={18} strokeWidth={2.2} aria-hidden />
        <span className="pepito-nav-overflow-btn-label">{t('nav.more')}</span>
      </button>
      {open ? (
        <div id={menuId} className="pepito-nav-overflow-menu" role="menu" aria-label={t('nav.sections')}>
          {links.map((link, index) => (
            <SiteHeaderLinkView
              key={link.key}
              link={link}
              className={`pepito-nav-overflow-item${index < INLINE_SECTION_COUNT ? ' pepito-nav-overflow-item--inline-dup' : ''}`}
              onClick={() => setOpen(false)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
