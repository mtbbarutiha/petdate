import { Link } from 'react-router-dom';
import { ArrowRight, Bot, LifeBuoy, Ticket } from 'lucide-react';
import { PageHelpLink } from '../components/PageHelpLink';
import { useI18n } from '../i18n';
import { AI_ASSISTANT_DISPLAY_NAME } from './supportAgent';

/**
 * Support entry — two clear CTAs:
 * 1) ticket (CRM ticketing)
 * 2) support-bot chat (Leila / kind: support)
 */
export function SupportHubPage() {
  const { t, dir } = useI18n();
  return (
    <div className="pepito-support-hub" dir={dir}>
      <header className="pepito-support-head">
        <Link to="/home" className="tg-icon-btn" aria-label={t('support.back')}>
          <ArrowRight size={18} />
        </Link>
        <div>
          <h1>
            <LifeBuoy size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            {t('support.title')}
          </h1>
          <p>{t('support.lead')}</p>
          <PageHelpLink section="support" />
        </div>
      </header>

      <div className="pepito-support-chooser" role="list">
        <Link to="/support/ticket" className="pepito-support-choice" role="listitem">
          <span className="pepito-support-choice-icon" aria-hidden>
            <Ticket size={28} />
          </span>
          <span className="pepito-support-choice-body">
            <strong>{t('support.ticketCta')}</strong>
            <span>{t('support.ticketLead')}</span>
          </span>
        </Link>

        <Link to="/support/chat" className="pepito-support-choice" role="listitem">
          <span className="pepito-support-choice-icon" aria-hidden>
            <Bot size={28} />
          </span>
          <span className="pepito-support-choice-body">
            <strong>{t('support.chatCta')}</strong>
            <span>{t('support.chatLead', { name: AI_ASSISTANT_DISPLAY_NAME })}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
