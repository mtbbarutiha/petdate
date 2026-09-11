import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AtSign, Mail, Send } from 'lucide-react';
import { BRAND, SITE } from '@petdate/shared';
import { subscribeNewsletter } from '../lib/api';
import { trackGenerateLead } from '../lib/siteAnalytics';

const CONTACT_PHONE_DISPLAY = '۰۲۱-۸۸۷۷۶۶۵۵';
const CONTACT_PHONE_TEL = '+982188776655';
const CONTACT_EMAIL = SITE.email;
const NEWSLETTER_FROM = SITE.newsletterEmail;
const TELEGRAM_BOT = SITE.telegramBot;

const BOTTOM_LINKS: { to: string; label: string }[] = [
  { to: '/', label: 'خانه' },
  { to: '/#about', label: 'درباره' },
  { to: '/#services', label: 'خدمات' },
  { to: '/#pets', label: 'پذیرش' },
  { to: '/shop', label: 'پت شاپ' },
  { to: '/chats', label: 'هم بازی' },
  { to: '/#news', label: 'اخبار' },
  { to: '/faq', label: 'سؤالات' },
  { to: '/vet-consult', label: 'دامپزشک' },
  { to: '/auth/login', label: 'ورود' },
];

const QUICK_LINKS: { to: string; label: string }[] = [
  { to: '/chats', label: 'هم بازی' },
  { to: '/shop', label: 'پت دیت شاپ' },
  { to: '/shop/c/dog-food', label: 'غذای سگ' },
  { to: '/shop/c/cat-food', label: 'غذای گربه' },
  { to: '/vet-consult', label: 'مشاوره دامپزشک' },
  { to: '/#pets', label: 'پذیرش پت' },
  { to: '/faq', label: 'سؤالات متداول' },
  { to: '/auth/login', label: 'ورود / ثبت‌نام' },
];

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
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();

  async function onSubscribe(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || !value.includes('@')) {
      setNote('یک ایمیل معتبر وارد کن.');
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await subscribeNewsletter(value, 'footer');
      trackGenerateLead({ formId: 'footer-newsletter', formName: 'newsletter', method: 'email' });
      setNote(res.message || `ثبت شد — خبرها از ${NEWSLETTER_FROM} می‌آید.`);
      setEmail('');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'عضویت خبرنامه ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="pepito-footer" dir="rtl">
      <div className="pepito-footer-top">
        <div className="pepito-footer-inner">
          <div className="pepito-footer-grid">
            <div className="pepito-footer-col pepito-footer-brand">
              <Link to="/" className="pepito-footer-logo" aria-label={BRAND.displayName}>
                <img src="/pepito/img/logo-light.png" alt={BRAND.displayName} />
              </Link>
              <p className="pepito-footer-lead">
                {BRAND.shortDescriptionFa} همبازی، شاپ، پذیرش و مشاوره دامپزشک — وب و ربات تلگرام روی یک
                داده مشترک.
              </p>
              <ul className="pepito-footer-social" aria-label="شبکه‌های اجتماعی">
                <li>
                  <a href={TELEGRAM_BOT} target="_blank" rel="noreferrer" aria-label="ربات تلگرام">
                    <Send size={16} strokeWidth={2} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="اینستاگرام"
                  >
                    <AtSign size={16} strokeWidth={2} />
                  </a>
                </li>
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} aria-label="ایمیل">
                    <Mail size={16} strokeWidth={2} />
                  </a>
                </li>
              </ul>
            </div>

            <div className="pepito-footer-col">
              <h3 className="pepito-footer-heading">تماس</h3>
              <p className="pepito-footer-meta">تهران، ایران</p>
              <p className="pepito-footer-meta">
                <a href={`tel:${CONTACT_PHONE_TEL}`} dir="ltr">
                  {CONTACT_PHONE_DISPLAY}
                </a>
              </p>
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
              <h3 className="pepito-footer-heading">دسترسی سریع</h3>
              <ul className="pepito-footer-quick-list">
                {QUICK_LINKS.map((item) => (
                  <li key={item.to}>
                    <FooterLink to={item.to}>{item.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pepito-footer-col">
              <h3 className="pepito-footer-heading">خبرنامه</h3>
              <p className="pepito-footer-lead pepito-footer-lead--tight">
                از آفرهای شاپ و خبرهای پت‌دیت باخبر شو — ایمیل‌ها از{' '}
                <span dir="ltr">{NEWSLETTER_FROM}</span> می‌آید.
              </p>
              <form className="pepito-footer-newsletter" onSubmit={(e) => void onSubscribe(e)}>
                <label className="pepito-footer-sr" htmlFor="pepito-footer-email">
                  ایمیل
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
                <button type="submit" aria-label="عضویت در خبرنامه" disabled={busy}>
                  <ArrowLeft size={18} strokeWidth={2.25} />
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
          <nav className="pepito-footer-bottom-links" aria-label="لینک‌های سایت">
            <ul>
              {BOTTOM_LINKS.map((item) => (
                <li key={`${item.to}-${item.label}`}>
                  <FooterLink to={item.to}>{item.label}</FooterLink>
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
