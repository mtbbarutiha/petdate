import { Link } from 'react-router-dom';
import { ArrowRight, Bot, LifeBuoy, Ticket } from 'lucide-react';
import { AI_ASSISTANT_DISPLAY_NAME } from './supportAgent';

/**
 * پشتیبانی entry — two clear CTAs:
 * 1) ثبت تیکت (CRM ticketing)
 * 2) صحبت با بات پشتیبانی (لیلا کیانی / kind: support)
 */
export function SupportHubPage() {
  return (
    <div className="pepito-support-hub" dir="rtl">
      <header className="pepito-support-head">
        <Link to="/home" className="tg-icon-btn" aria-label="بازگشت">
          <ArrowRight size={18} />
        </Link>
        <div>
          <h1>
            <LifeBuoy size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            پشتیبانی
          </h1>
          <p>تیکت انسانی یا گفتگو با بات پشتیبانی — یکی را انتخاب کن</p>
        </div>
      </header>

      <div className="pepito-support-chooser" role="list">
        <Link to="/support/ticket" className="pepito-support-choice" role="listitem">
          <span className="pepito-support-choice-icon" aria-hidden>
            <Ticket size={28} />
          </span>
          <span className="pepito-support-choice-body">
            <strong>ثبت تیکت</strong>
            <span>درخواستت را برای تیم پشتیبانی ثبت کن تا پیگیری شود</span>
          </span>
        </Link>

        <Link to="/support/chat" className="pepito-support-choice" role="listitem">
          <span className="pepito-support-choice-icon" aria-hidden>
            <Bot size={28} />
          </span>
          <span className="pepito-support-choice-body">
            <strong>صحبت با بات پشتیبانی</strong>
            <span>
              گفتگو با {AI_ASSISTANT_DISPLAY_NAME} — راهنمای فوری ورود، پت، شاپ و سکه
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
