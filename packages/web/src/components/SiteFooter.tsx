import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AtSign, Mail, Send } from 'lucide-react';
import { BRAND, SITE } from '@petdate/shared';
import { subscribeNewsletter } from '../lib/api';
import { trackGenerateLead } from '../lib/siteAnalytics';
import { useI18n } from '../i18n';
import { usePlatformConfig } from '../hooks/usePlatformConfig';

const CONTACT_EMAIL = SITE.email;
const NEWSLETTER_FROM = SITE.newsletterEmail;
const TELEGRAM_BOT = SITE.telegramBot;

function FooterLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  if (to.includes('#')) {
    const [path, hash] = to.split('#');
    return (
      <a href={`${path || '/'}#${hash}`} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

/**
 * Pepito-faithful site footer — dark top (brand / contact / quick links / newsletter),
 * divider, bottom nav strip + copyright. Shared across landing, shop, and app shell.
 */
export function SiteFooter() {
  const { t, dir } = useI18n();
  const platform = usePlatformConfig();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const bottomLinks: { to: string; label: string; className?: string }[] = [
    { to: '/', label: t('common.home') },
    { to: '/#about', label: t('nav.about') },
    { to: '/#services', label: t('nav.services') },
    { to: '/adoption', label: t('nav.adoption') },
    { to: '/games', label: t('nav.games') },
    { to: '/shop', label: t('nav.petShop') },
    { to: '/chats', label: t('footer.playmate') },
    { to: '/#news', label: t('nav.news') },
    { to: '/magazine', label: t('nav.magazine') },
    { to: '/faq', label: t('nav.faq'), className: 'pepito-nav-faq' },
    { to: '/vet-consult', label: t('nav.vet') },
    { to: '/auth/login', label: t('common.login') },
  ];

  const quickLinks: { to: string; label: string; className?: string }[] = [
    { to: '/chats', label: t('footer.playmate') },
    { to: '/games', label: t('nav.games') },
    { to: '/shop', label: t('footer.petdateShop') },
    { to: '/shop/c/dog-food', label: t('footer.dogFood') },
    { to: '/shop/c/cat-food', label: t('footer.catFood') },
    { to: '/vet-consult', label: t('footer.vetConsult') },
    { to: '/adoption', label: t('footer.adoptPet') },
    { to: '/faq', label: t('footer.faqFull'), className: 'pepito-nav-faq' },
    { to: '/auth/login', label: t('common.loginRegister') },
  ];

  const visible = (to: string) => {
    if ((to === '/shop' || to.startsWith('/shop/')) && !platform.shopEnabled) return false;
    if (to.startsWith('/vet-consult') && !platform.vetConsultEnabled) return false;
    if (to === '/chats' && !platform.playdatesEnabled) return false;
    return true;
  };
  const visibleBottom = bottomLinks.filter((item) => visible(item.to));
  const visibleQuick = quickLinks.filter((item) => visible(item.to));

  async function onSubscribe(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || !value.includes('@')) {
      setNote(t('footer.newsletterInvalid'));
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await subscribeNewsletter(value, 'footer');
      trackGenerateLead({ formId: 'footer-newsletter', formName: 'newsletter', method: 'email' });
      setNote(res.message || t('footer.newsletterOk', { from: NEWSLETTER_FROM }));
      setEmail('');
    } catch (err) {
      setNote(err instanceof Error ? err.message : t('footer.newsletterFail'));
    } finally {
      setBusy(false);
    }
  }

  const brandLead =
    dir === 'rtl'
      ? `${BRAND.shortDescriptionFa} ${t('footer.lead')}`
      : `${BRAND.displayName} — ${t('footer.lead')}`;

  return (
    <footer className="pepito-footer" dir={dir}>
      <div className="pepito-footer-top">
        <div className="pepito-footer-inner">
          <div className="pepito-footer-grid">
            <div className="pepito-footer-col pepito-footer-brand">
              <Link to="/" className="pepito-footer-logo" aria-label={BRAND.displayName}>
                <img src="/pepito/img/logo-light.png" alt={BRAND.displayName} />
              </Link>
              <p className="pepito-footer-lead">{brandLead}</p>
              <ul className="pepito-footer-social" aria-label={t('footer.social')}>
                <li>
                  <a href={TELEGRAM_BOT} target="_blank" rel="noreferrer" aria-label={t('footer.telegramBot')}>
                    <Send size={16} strokeWidth={2} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t('footer.instagram')}
                  >
                    <AtSign size={16} strokeWidth={2} />
                  </a>
                </li>
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} aria-label={t('footer.email')}>
                    <Mail size={16} strokeWidth={2} />
                  </a>
                </li>
              </ul>
            </div>

            <div className="pepito-footer-col">
              <h3 className="pepito-footer-heading">{t('footer.contact')}</h3>
              <p className="pepito-footer-meta">{t('footer.location')}</p>
              <p className="pepito-footer-meta">
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </p>
              <p className="pepito-footer-meta">
                <a href={TELEGRAM_BOT} target="_blank" rel="noreferrer" dir="ltr">
                  t.me/Petdatebot
                </a>
              </p>
            </div>

            <div className="pepito-footer-col">
              <h3 className="pepito-footer-heading">{t('footer.quickAccess')}</h3>
              <ul className="pepito-footer-quick-list">
                {visibleQuick.map((item) => (
                  <li key={item.to}>
                    <FooterLink to={item.to} className={item.className}>
                      {item.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pepito-footer-col">
              <h3 className="pepito-footer-heading">{t('footer.newsletter')}</h3>
              <p className="pepito-footer-lead pepito-footer-lead--tight">
                {t('footer.newsletterLead', { from: NEWSLETTER_FROM }).split(NEWSLETTER_FROM)[0]}
                <span dir="ltr">{NEWSLETTER_FROM}</span>
                {t('footer.newsletterLead', { from: NEWSLETTER_FROM }).split(NEWSLETTER_FROM)[1] ?? ''}
              </p>
              <form className="pepito-footer-newsletter" onSubmit={(e) => void onSubscribe(e)}>
                <label className="pepito-footer-sr" htmlFor="pepito-footer-email">
                  {t('footer.email')}
                </label>
                <input
                  id="pepito-footer-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Email Address"
                  value={email}
                  disabled={busy}
                  onChange={(e) => {
                    setNote(null);
                    setEmail(e.target.value);
                  }}
                />
                <button type="submit" aria-label={t('footer.newsletterAria')} disabled={busy}>
                  <Arrow size={18} strokeWidth={2.25} />
                </button>
              </form>
              {note ? <p className="pepito-footer-note">{note}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="pepito-footer-divider" aria-hidden />

      <div className="pepito-footer-bottom">
        <div className="pepito-footer-inner pepito-footer-bottom-row">
          <nav className="pepito-footer-bottom-links" aria-label={t('footer.siteLinks')}>
            <ul>
              {visibleBottom.map((item) => (
                <li key={`${item.to}-${item.label}`}>
                  <FooterLink to={item.to} className={item.className}>
                    {item.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </nav>
          <p className="pepito-footer-copy">
            Copyright © {year} | {BRAND.displayName} — {BRAND.taglineEn}
          </p>
        </div>
      </div>
    </footer>
  );
}
