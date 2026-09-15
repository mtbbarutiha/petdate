import { BRAND, SITE, orderPublicIdOf } from '@petdate/shared';
import { SiteLogo } from '../SiteLogo';
import { formatToman } from '../../data/shopCatalog';

export type ShopInvoiceItem = {
  title?: string;
  productId?: string;
  qty?: number;
  unitPriceToman?: number;
  lineTotalToman?: number;
  priceToman?: number;
};

export type ShopInvoiceOrder = {
  id: number;
  publicId?: string | null;
  status: string;
  totalToman: number;
  paymentCurrency?: string;
  paymentAmount?: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  items: unknown[];
  createdAt: string;
};

const STATUS_FA: Record<string, string> = {
  pending: 'در انتظار پرداخت / تأیید',
  paid: 'پرداخت‌شده',
  shipped: 'ارسال‌شده',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};

function payLabel(currency: string | undefined, amount: number, totalToman: number): string {
  const cur = currency || 'toman';
  const amt = Number.isFinite(amount) ? amount : totalToman;
  if (cur === 'stars_xtr') return `${amt.toLocaleString('fa-IR')} Stars تلگرام`;
  if (cur === 'stars') return `${amt.toLocaleString('fa-IR')} ستاره پنل`;
  if (cur === 'coins') return `${amt.toLocaleString('fa-IR')} سکه`;
  return formatToman(totalToman);
}

function parseAddressFromNote(note?: string): { address?: string; extraNote?: string } {
  const raw = String(note || '').trim();
  if (!raw) return {};
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const addrLine = lines.find((l) => l.startsWith('آدرس ارسال:'));
  if (!addrLine) return { extraNote: raw };
  const address = addrLine.replace(/^آدرس ارسال:\s*/, '').trim();
  const extraNote = lines.filter((l) => l !== addrLine).join('\n').trim();
  return { address: address || undefined, extraNote: extraNote || undefined };
}

function normalizeItems(items: unknown[]) {
  return items.map((raw) => {
    const it = (raw && typeof raw === 'object' ? raw : {}) as ShopInvoiceItem & {
      name?: string;
      quantity?: number;
      unitPrice?: number;
      lineTotal?: number;
    };
    const qty = Math.max(1, Math.floor(Number(it.qty ?? it.quantity) || 1));
    const unitPriceToman = Math.max(
      0,
      Math.floor(Number(it.unitPriceToman ?? it.priceToman ?? it.unitPrice) || 0)
    );
    const lineTotalToman = Math.max(
      0,
      Math.floor(Number(it.lineTotalToman ?? it.lineTotal) || unitPriceToman * qty)
    );
    return {
      title: String(it.title || it.name || it.productId || 'کالا').trim() || 'کالا',
      productId: it.productId,
      qty,
      unitPriceToman,
      lineTotalToman,
    };
  });
}

function formatFaDate(iso: string): string {
  const raw = String(iso || '').trim();
  if (!raw) return '—';
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return raw;
  }
}

type Props = {
  order: ShopInvoiceOrder;
  paidLabelOverride?: string | null;
  className?: string;
  compact?: boolean;
};

/**
 * فاکتور فروشگاه پت‌دیت — شناسه عمومی PD-O#####، لوگو، اقلام، جمع و مشخصات گیرنده.
 * جدا از فاکتور پرداخت (PD-R#####) که برای کارت/Stars است.
 */
export function ShopInvoice({ order, paidLabelOverride, className = '', compact = false }: Props) {
  const publicId = orderPublicIdOf(order);
  const items = normalizeItems(Array.isArray(order.items) ? order.items : []);
  const { address, extraNote } = parseAddressFromNote(order.note);
  const statusFa = STATUS_FA[order.status] || order.status;
  const payFa =
    paidLabelOverride?.trim() ||
    payLabel(order.paymentCurrency, Number(order.paymentAmount ?? order.totalToman), order.totalToman);

  return (
    <article
      className={`pd-shop-invoice${compact ? ' pd-shop-invoice--compact' : ''} ${className}`.trim()}
      aria-label={`فاکتور سفارش ${publicId}`}
    >
      <header className="pd-shop-invoice-head">
        <div className="pd-shop-invoice-brand">
          <SiteLogo height={compact ? 36 : 48} className="pd-shop-invoice-logo" />
          <div>
            <p className="pd-shop-invoice-brand-name">{BRAND.displayNameFa}</p>
            <p className="pd-shop-invoice-brand-tag">{BRAND.taglineFa}</p>
          </div>
        </div>
        <div className="pd-shop-invoice-meta">
          <p className="pd-shop-invoice-kind">فاکتور فروشگاه</p>
          <p className="pd-shop-invoice-id" dir="ltr">
            {publicId}
          </p>
          <p className="pd-shop-invoice-date">{formatFaDate(order.createdAt)}</p>
          <span className={`pd-shop-invoice-status pd-shop-order-status--${order.status}`}>
            {statusFa}
          </span>
        </div>
      </header>

      <section className="pd-shop-invoice-parties">
        <div>
          <h3>فروشنده</h3>
          <p>{BRAND.displayNameFa} — پت‌شاپ</p>
          <p dir="ltr">{SITE.domain}</p>
          <p dir="ltr">{SITE.email}</p>
        </div>
        <div>
          <h3>خریدار / گیرنده</h3>
          <p>{order.customerName?.trim() || '—'}</p>
          {order.customerPhone ? <p dir="ltr">{order.customerPhone}</p> : null}
          {address ? <p>{address}</p> : null}
          {extraNote ? <p className="pd-shop-invoice-note">یادداشت: {extraNote}</p> : null}
        </div>
      </section>

      <div className="pd-shop-invoice-table-wrap">
        <table className="pd-shop-invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>کالا</th>
              <th>تعداد</th>
              <th>فی (تومان)</th>
              <th>جمع</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((it, i) => (
                <tr key={`${it.productId || it.title}-${i}`}>
                  <td>{(i + 1).toLocaleString('fa-IR')}</td>
                  <td>{it.title}</td>
                  <td>{it.qty.toLocaleString('fa-IR')}</td>
                  <td>{formatToman(it.unitPriceToman)}</td>
                  <td>{formatToman(it.lineTotalToman)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="pd-shop-muted">
                  اقلام سفارش ثبت نشده
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="pd-shop-invoice-foot">
        <div className="pd-shop-invoice-totals">
          <p>
            <span>جمع کل (تومان)</span>
            <strong>{formatToman(order.totalToman)}</strong>
          </p>
          <p>
            <span>پرداخت</span>
            <strong>{payFa}</strong>
          </p>
        </div>
        <p className="pd-shop-invoice-hint">
          شماره سفارش فروشگاه با پیشوند <span dir="ltr">PD-O</span> است. فاکتور پرداخت کارت/Stars
          جداگانه با پیشوند <span dir="ltr">PD-R</span> صادر می‌شود.
        </p>
      </footer>
    </article>
  );
}
