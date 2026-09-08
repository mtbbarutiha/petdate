import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, PawPrint } from 'lucide-react';
import { LandingChrome } from '../components/LandingChrome';
import { REFERRAL_BONUS_COINS, SITE, formatFaInt } from '@petdate/shared';

/** پرسش‌های پرتکرار — منطبق با قابلیت‌های واقعی پت‌دیت */
export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'پت‌دیت چیست و برای چه کسانی است؟',
    a: 'پت‌دیت پلتفرم فارسی برای پیدا کردن همبازی پت، خرید از پت‌شاپ، پذیرش پت، و مشاوره دامپزشک است. صاحبان سگ و گربه می‌توانند روی یک حساب مشترک وب و ربات تلگرام همهٔ این خدمات را مدیریت کنند.',
  },
  {
    q: 'آیا دیدن صفحه اصلی و شاپ نیاز به ورود دارد؟',
    a: 'خیر. لندینگ و پت‌شاپ برای همه باز است. برای پنل همبازی، ثبت پت، چت، دامپزشک و نهایی‌کردن سفارش شاپ باید با پیامک OTP وارد شوید.',
  },
  {
    q: 'حساب وب و ربات تلگرام یکی است؟',
    a: 'بله. با همان شماره موبایل وارد می‌شوید؛ پت‌ها، درخواست‌های همبازی، گفتگوها و سفارش‌ها روی دیتابیس مشترک وب و تلگرام می‌مانند و بین دو محیط همگام می‌شوند.',
  },
  {
    q: 'همبازی پت چطور کار می‌کند؟',
    a: 'از «پنل همبازی» پت خود را ثبت کنید، پروفایل دیگران را ببینید و درخواست بفرستید. بعد از پذیرش می‌توانید چت کنید و برای قرار ملاقات هماهنگ شوید.',
  },
  {
    q: 'چطور پت جدید به حسابم اضافه کنم؟',
    a: 'پس از ورود، از منوی اپ یا ربات «افزودن پت» را بزنید و عکس، نوع، نام و مشخصات را پر کنید. پت در پروفایل شما و در پیشنهادهای همبازی نمایش داده می‌شود.',
  },
  {
    q: 'خرید از پت‌دیت شاپ چگونه است؟',
    a: 'دسته و فیلتر برند/قیمت را انتخاب کنید، کالا را به سبد ببرید و با ورود سفارش را ثبت کنید. قیمت‌ها به تومان است و کیف پول چندارزی سایت برای پرداخت پشتیبانی می‌شود.',
  },
  {
    q: 'مشاوره دامپزشک آنلاین دارید؟',
    a: 'بله. از بخش دامپزشک می‌توانید درخواست مشاوره یا نوبت بدهید. دامپزشکان تأییدشده روی همان حساب وب و تلگرام پاسخ می‌دهند تا پیگیری درمان یکجا بماند.',
  },
  {
    q: 'بخش پذیرش پت چه کاربردی دارد؟',
    a: 'پذیرش، پت‌های نیازمند خانه را نشان می‌دهد. جزئیات هر پت را ببینید و در صورت تمایل برای پذیرش اقدام کنید؛ ارتباط بعدی از طریق حساب پت‌دیت انجام می‌شود.',
  },
  {
    q: 'اگر کد OTP نیامد یا ورود مشکل داشت چه کنم؟',
    a: 'شماره را با پیش‌شماره صحیح وارد کنید، چند دقیقه صبر کنید و دوباره درخواست کد بدهید. اگر مشکل ادامه داشت از فوتر سایت یا ربات تلگرام پت‌دیت پشتیبانی بگیرید.',
  },
  {
    q: 'دعوت دوستان چه جایزه‌ای دارد؟',
    a: `از ربات یا وب لینک دعوت خودت را بگیر و برای دوستات بفرست. با هر ثبت‌نام جدید از لینک تو، ${formatFaInt(REFERRAL_BONUS_COINS)} سکه به موجودی‌ات اضافه می‌شود.`,
  },
  {
    q: 'اطلاعات و پیام‌های من چقدر امن است؟',
    a: 'ورود با OTP انجام می‌شود و داده‌های پت، چت و سفارش روی سرور پروژه نگه داشته می‌شوند. کاربران عادی رمز ثابت ندارند؛ پنل ادمین دسترسی جداگانه دارد.',
  },
];

const FAQ_JSON_LD_ID = 'petdate-faq-jsonld';

export function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
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
  }, []);

  return (
    <LandingChrome bannerTitle="سؤالات متداول" bannerLead="پاسخ‌های کوتاه درباره پت‌دیت، همبازی، شاپ و دامپزشک">
      <div className="pepito-container pepito-faq-page">
        <header className="pepito-faq-page-head">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <PawPrint size={18} />
            </span>
            پشتیبانی
          </p>
          <h1>سؤالات متداول</h1>
          <p>پرسش‌های پرتکرار درباره پت‌دیت، همبازی، شاپ، پذیرش، دامپزشک و دعوت دوستان.</p>
          <Link to="/chats" className="pepito-btn button-1">
            رفتن به پنل همبازی
          </Link>
        </header>

        <div className="pepito-faq-page-list" role="list">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={`pepito-faq-item${isOpen ? ' is-open' : ''}`} role="listitem">
                <button
                  type="button"
                  className="pepito-faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
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

        <p className="pepito-faq-page-more">
          هنوز جواب نگرفتید؟ از{' '}
          <Link to="/#faq">سؤالات صفحه اصلی</Link> ببینید یا در{' '}
          <a href={SITE.telegramBot} target="_blank" rel="noreferrer">
            ربات تلگرام
          </a>{' '}
          پیام بگذارید.
        </p>
      </div>
    </LandingChrome>
  );
}
