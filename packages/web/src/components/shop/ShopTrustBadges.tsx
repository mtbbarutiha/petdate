/** Digikala-style RTL trust / service strip for the shop PDP. */
import type { ReactNode } from 'react';

type TrustBadge = {
  id: string;
  label: string;
  icon: ReactNode;
};

function IconExpress({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden>
      <path
        d="M14 18.5h16.5l5.5 7.2V33H14V18.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M30.5 18.5V25.8H36" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M18 33.5a2.5 2.5 0 1 0 0.01 0ZM32 33.5a2.5 2.5 0 1 0 0.01 0Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 22h4.5M6.5 26.5H13M8 31h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSupport247({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden>
      <path
        d="M34.5 28.5c1.4-1.2 2.3-3 2.3-5 0-5.2-4.6-9.5-10.8-9.5S15.2 18.3 15.2 23.5c0 2 .9 3.8 2.3 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15.2 24.2v4.2c0 .9.7 1.6 1.6 1.6h1.4M34.8 24.2v4.2c0 .9-.7 1.6-1.6 1.6h-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M22.2 31.2h5.6v2.2a2.8 2.8 0 0 1-2.8 2.8h0a2.8 2.8 0 0 1-2.8-2.8v-2.2Z" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M37.2 18.2a14 14 0 1 0-1.6 16.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M35.2 12.8v5.4h5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text
        x="24"
        y="24.2"
        textAnchor="middle"
        fill="currentColor"
        fontSize="6.2"
        fontWeight="700"
        fontFamily="Tahoma, Arial, sans-serif"
      >
        24/7
      </text>
    </svg>
  );
}

function IconPayOnDelivery({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden>
      <path
        d="M12 30.5c2.2-3.2 5.4-5 9.2-5h4.2c1.8 0 3.3 1.4 3.3 3.2V34H15.5L12 30.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M17.5 29.5v-3.2c0-1.4 1.1-2.5 2.5-2.5h4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="24.5" y="14.5" width="13" height="9.2" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24.5 17.8h13" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="31" cy="12.2" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M31 13.7v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="18" y="34.5" width="14" height="4.2" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconReturn7({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden>
      <path
        d="M17 20.5h12l3.5 4.2V33H17V20.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M29 20.5v4.5h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M34.5 27.5a10 10 0 1 1-2.2-9.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M33.8 14.2v4.8h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text
        x="33.2"
        y="21.2"
        textAnchor="middle"
        fill="currentColor"
        fontSize="8"
        fontWeight="700"
        fontFamily="Tahoma, Arial, sans-serif"
      >
        7
      </text>
    </svg>
  );
}

function IconAuthenticity({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden>
      <path
        d="M24 10.5l2.1 2.4 3.1-.7 1.2 2.9 3-.9.3 3.1 3 .3-.8 3 2.4 2-2.4 2 .8 3-3 .3-.3 3.1-3-.9-1.2 2.9-3.1-.7L24 37.5l-2.1-2.4-3.1.7-1.2-2.9-3 .9-.3-3.1-3-.3.8-3-2.4-2 2.4-2-.8-3 3-.3.3-3.1 3 .9 1.2-2.9 3.1.7L24 10.5Z"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path d="M19.8 24.2 22.6 27l5.8-6.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const BADGES: TrustBadge[] = [
  {
    id: 'express',
    label: 'امکان تحویل اکسپرس',
    icon: <IconExpress className="pd-dk-trust-svg" />,
  },
  {
    id: 'support',
    label: '۲۴ ساعته، ۷ روز هفته',
    icon: <IconSupport247 className="pd-dk-trust-svg" />,
  },
  {
    id: 'cod',
    label: 'امکان پرداخت در محل',
    icon: <IconPayOnDelivery className="pd-dk-trust-svg" />,
  },
  {
    id: 'return',
    label: 'هفت روز ضمانت بازگشت کالا',
    icon: <IconReturn7 className="pd-dk-trust-svg" />,
  },
  {
    id: 'authenticity',
    label: 'ضمانت اصل بودن کالا',
    icon: <IconAuthenticity className="pd-dk-trust-svg" />,
  },
];

export function ShopTrustBadges() {
  return (
    <section className="pd-dk-trust" aria-label="خدمات و ضمانت‌های فروشگاه" data-testid="shop-trust-badges">
      <ul className="pd-dk-trust-list">
        {BADGES.map((badge) => (
          <li key={badge.id} className="pd-dk-trust-item">
            <span className="pd-dk-trust-icon">{badge.icon}</span>
            <span className="pd-dk-trust-label">{badge.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
