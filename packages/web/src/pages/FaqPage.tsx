import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, CircleHelp, PawPrint } from 'lucide-react';
import {
  HELP_STRUCTURE,
  SITE,
  siteFaqItems,
  siteHelpSections,
  siteRoleGuides,
} from '@petdate/shared';
import { LandingChrome } from '../components/LandingChrome';
import { useI18n } from '../i18n';

/** Back-compat export — FA FAQ used by older tests / JSON-LD fallbacks. */
export const FAQ_ITEMS = siteFaqItems('fa').map((item) => ({ q: item.q, a: item.a }));

const FAQ_JSON_LD_ID = 'petdate-faq-jsonld';

function scrollToHelpHash(hash: string) {
  const id = hash.replace(/^#/, '');
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function FaqPage() {
  const { lang, t } = useI18n();
  const locale = lang === 'en' ? 'en' : 'fa';
  const location = useLocation();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const faqs = useMemo(() => siteFaqItems(locale), [locale]);
  const roles = useMemo(() => siteRoleGuides(locale), [locale]);
  const sections = useMemo(() => siteHelpSections(locale), [locale]);
  const what = HELP_STRUCTURE.what[locale];
  const how = HELP_STRUCTURE.how[locale];
  const tips = HELP_STRUCTURE.tips[locale];

  useEffect(() => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    };
    let el = document.getElementById(FAQ_JSON_LD_ID) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = FAQ_JSON_LD_ID;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      document.getElementById(FAQ_JSON_LD_ID)?.remove();
    };
  }, [faqs]);

  useEffect(() => {
    const tmr = window.setTimeout(() => scrollToHelpHash(location.hash), 40);
    return () => window.clearTimeout(tmr);
  }, [location.hash, locale]);

  return (
    <LandingChrome bannerTitle={t('help.bannerTitle')} bannerLead={t('help.bannerLead')}>
      <div className="pepito-container pepito-faq-page pepito-help-page">
        <header className="pepito-faq-page-head">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <PawPrint size={18} />
            </span>
            {t('help.eyebrow')}
          </p>
          <p className="pepito-faq-page-lead">{t('help.lead')}</p>
          <nav className="pepito-help-toc" aria-label={t('help.toc')}>
            <a href="#roles">{t('help.rolesTitle')}</a>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
            <a href="#faq-list">{t('help.faqTitle')}</a>
          </nav>
          <div className="pepito-faq-page-links">
            <Link to="/shop" className="pepito-btn button-3">
              {t('nav.petShop')}
            </Link>
            <Link to="/vet-consult" className="pepito-btn button-3">
              {t('nav.vet')}
            </Link>
            <Link to="/adoption" className="pepito-btn button-3">
              {t('nav.adoption')}
            </Link>
            <Link to="/games" className="pepito-btn button-3">
              {t('nav.games')}
            </Link>
            <Link to="/chats" className="pepito-btn button-1">
              {t('nav.playmate')}
            </Link>
          </div>
        </header>

        <section id="roles" className="pepito-help-block">
          <h2>{t('help.rolesTitle')}</h2>
          <p className="pepito-help-block-lead">{t('help.rolesLead')}</p>
          <div className="pepito-help-role-grid">
            {roles.map((role) => (
              <article key={role.id} className="pepito-help-card" id={`role-${role.id}`}>
                <h3>{role.title}</h3>
                <dl className="pepito-help-dl">
                  <div>
                    <dt>{what}</dt>
                    <dd>{role.what}</dd>
                  </div>
                  <div>
                    <dt>{how}</dt>
                    <dd>{role.how}</dd>
                  </div>
                  <div>
                    <dt>{tips}</dt>
                    <dd>{role.tips}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="pepito-help-block">
          <h2>{t('help.sectionsTitle')}</h2>
          <p className="pepito-help-block-lead">{t('help.sectionsLead')}</p>
          {sections.map((section) => (
            <div key={section.id} id={section.id} className="pepito-help-section">
              <h3>{section.title}</h3>
              <div className="pepito-help-topic-list">
                {section.topics.map((topic) => {
                  const isOpen = openTopic === topic.id;
                  return (
                    <article
                      key={topic.id}
                      className={`pepito-help-topic${isOpen ? ' is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="pepito-help-topic-q"
                        aria-expanded={isOpen}
                        onClick={() => setOpenTopic(isOpen ? null : topic.id)}
                      >
                        <span>{topic.title}</span>
                        <ChevronDown size={18} aria-hidden />
                      </button>
                      {isOpen ? (
                        <dl className="pepito-help-dl pepito-help-topic-body">
                          <div>
                            <dt>{what}</dt>
                            <dd>{topic.what}</dd>
                          </div>
                          <div>
                            <dt>{how}</dt>
                            <dd>{topic.how}</dd>
                          </div>
                          {topic.tips ? (
                            <div>
                              <dt>{tips}</dt>
                              <dd>{topic.tips}</dd>
                            </div>
                          ) : null}
                          {topic.sitePath ? (
                            <div>
                              <dt>{t('help.openPage')}</dt>
                              <dd>
                                <Link to={topic.sitePath}>{topic.sitePath}</Link>
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section id="faq-list" className="pepito-help-block">
          <h2>{t('help.faqTitle')}</h2>
          <div className="pepito-faq-page-list" role="list">
            {faqs.map((item, i) => {
              const isOpen = openFaq === item.id;
              return (
                <div
                  key={item.id}
                  className={`pepito-faq-item${isOpen ? ' is-open' : ''}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className="pepito-faq-q"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : item.id)}
                  >
                    <span>
                      {String(i + 1).padStart(2, '0')} {item.q}
                    </span>
                    <ChevronDown size={18} aria-hidden />
                  </button>
                  {isOpen ? <div className="pepito-faq-a">{item.a}</div> : null}
                </div>
              );
            })}
          </div>
        </section>

        <p className="pepito-faq-page-more">
          <CircleHelp size={16} aria-hidden /> {t('help.moreBefore')}{' '}
          <Link to="/#faq">{t('help.moreLanding')}</Link> {t('help.moreOr')}{' '}
          <a href={SITE.telegramBot} target="_blank" rel="noreferrer">
            {t('footer.telegramBot')}
          </a>
          {' · '}
          <Link to="/support">{t('nav.support')}</Link>
        </p>
      </div>
    </LandingChrome>
  );
}
