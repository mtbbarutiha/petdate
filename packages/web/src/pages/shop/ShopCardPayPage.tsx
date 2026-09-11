import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatToman } from '../../data/shopCatalog';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useShopCart } from '../../hooks/useShopCart';
import {
  fetchShopCardPaymentStatus,
  resolvePublicMediaUrl,
  uploadShopCardReceipt,
  type ShopCardPaymentStatus,
} from '../../lib/api';
import { loginPath } from '../../lib/authRedirect';
import { ShopChrome } from '../../components/shop/ShopChrome';

function groupCard(num: string): string {
  const d = String(num || '').replace(/\D/g, '');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function statusFa(status: string): string {
  if (status === 'pending') return 'در انتظار بررسی ادمین';
  if (status === 'awaiting_receipt') return 'منتظر رسید';
  if (status === 'approved' || status === 'paid') return 'تأیید شده';
  if (status === 'rejected') return 'رد شده';
  return status;
}

export function ShopCardPayPage() {
  const { paymentOrderId: rawId } = useParams();
  const [search] = useSearchParams();
  const receiptToken = search.get('t') || search.get('token') || '';
  const paymentOrderId = Number(rawId);
  const { isLoggedIn, token, refreshMe } = useAuthStore();
  const { rememberPaidOrder } = useShopCart();
  const [status, setStatus] = useState<ShopCardPaymentStatus | null>(null);
  const [error, setError] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const remembered = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canTrack = Boolean((isLoggedIn && token) || receiptToken);

  useEffect(() => {
    if (!canTrack) return;
    if (!Number.isFinite(paymentOrderId) || paymentOrderId <= 0) {
      setError('شناسه فاکتور نامعتبر است.');
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const next = await fetchShopCardPaymentStatus(token, paymentOrderId, receiptToken || undefined);
        if (cancelled) return;
        setStatus(next);
        setError('');
        if (next.paid) {
          if (!remembered.current && next.shopOrderId != null) {
            remembered.current = true;
            rememberPaidOrder({
              id: String(next.shopOrderId),
              createdAt: next.paidAt || new Date().toISOString(),
              name: '', phone: '', address: '', items: [],
              totalToman: next.totalToman, status: 'paid', paymentCurrency: 'toman',
            });
            try { await refreshMe(); } catch { /* ignore */ }
          }
          return;
        }
        timer = setTimeout(() => void tick(), 3000);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'خطا در پیگیری پرداخت');
        timer = setTimeout(() => void tick(), 5000);
      }
    };
    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [canTrack, token, paymentOrderId, receiptToken, rememberPaidOrder, refreshMe]);

  async function onUpload(file: File | null) {
    if (!file || !token) { setUploadMsg('برای آپلود رسید وارد حساب شوید.'); return; }
    setUploading(true); setUploadMsg('');
    try {
      await uploadShopCardReceipt(token, paymentOrderId, file, {
        transferRef: transferRef || undefined,
        receiptToken: receiptToken || undefined,
      });
      setUploadMsg('رسید ثبت شد — منتظر تأیید ادمین بمان.');
      setStatus(await fetchShopCardPaymentStatus(token, paymentOrderId, receiptToken || undefined));
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : 'آپلود ناموفق بود.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!canTrack) {
    return (
      <ShopChrome bannerTitle="پرداخت کارت‌به‌کارت" bannerLead="برای پیگیری وارد شوید">
        <div className="pepito-container pd-shop-cart">
          <div className="pd-shop-order-ok">
            <p>برای دیدن وضعیت پرداخت وارد حساب شوید.</p>
            <Link to={loginPath(`/shop/card-pay/${paymentOrderId}`)} className="pepito-btn button-1">ورود</Link>
          </div>
        </div>
      </ShopChrome>
    );
  }

  const paid = Boolean(status?.paid);
  const awaitingReceipt = status?.status === 'awaiting_receipt';
  const cardDisplay = status?.cardGrouped || groupCard(status?.cardNumber || '');

  return (
    <ShopChrome
      bannerTitle={paid ? 'تراکنش موفق' : 'واریز کارت‌به‌کارت'}
      bannerLead={paid ? 'رسید تأیید شد — سفارش ثبت شد' : 'مبلغ را واریز کن و عکس رسید را همین‌جا آپلود کن'}
    >
      <div className="pepito-container pd-shop-cart">
        <div className="pd-shop-order-ok">
          {error ? <p className="pd-shop-form-error">{error}</p> : null}
          {paid && status ? (
            <>
              <h2>✅ پرداخت تأیید شد — سفارش نهایی شد</h2>
              {status.shopOrderId != null ? <p>شماره سفارش: <strong dir="ltr">#{status.shopOrderId}</strong></p> : null}
              <p>مبلغ: <strong>{formatToman(status.totalToman)}</strong></p>
              <Link to="/shop/orders" className="pepito-btn button-1">سفارش‌های من</Link>
            </>
          ) : status ? (
            <>
              <h2>💳 واریز کارت‌به‌کارت</h2>
              <p>مبلغ واریز: <strong>{formatToman(status.totalToman)}</strong></p>
              <p dir="ltr">شماره کارت: <strong>{cardDisplay}</strong></p>
              <p>به‌نام: <strong>{status.cardHolder}</strong></p>
              <p className="pd-shop-soon">وضعیت: {statusFa(status.status)}{status.transferRef ? ` · پیگیری: ${status.transferRef}` : ''}</p>
              {awaitingReceipt ? (
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <label className="pd-shop-field">
                    <span>شماره پیگیری واریز (اختیاری)</span>
                    <input value={transferRef} onChange={(e) => setTransferRef(e.target.value)} placeholder="کد پیگیری بانک" dir="ltr" />
                  </label>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => void onUpload(e.target.files?.[0] ?? null)} />
                  <button type="button" className="pepito-btn button-1" disabled={uploading || !token} onClick={() => fileRef.current?.click()}>
                    {uploading ? 'در حال ارسال…' : 'آپلود عکس رسید'}
                  </button>
                  {uploadMsg ? <p className="pd-shop-soon">{uploadMsg}</p> : null}
                </div>
              ) : status.receiptUrl ? (
                <p className="pd-shop-soon" style={{ marginTop: 12 }}>
                  رسید دریافت شد و در صف بررسی ادمین است.<br />
                  <img src={resolvePublicMediaUrl(status.receiptUrl)} alt="رسید" style={{ maxWidth: 240, marginTop: 8, borderRadius: 8 }} />
                </p>
              ) : (
                <p className="pd-shop-soon" style={{ marginTop: 12 }}>رسید در صف بررسی ادمین است.</p>
              )}
              <a className="pepito-btn button-2" href={status.botDeepLink} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12, display: 'inline-block' }}>
                ارسال رسید از ربات (اختیاری)
              </a>
            </>
          ) : (<p>در حال بارگذاری…</p>)}
        </div>
      </div>
    </ShopChrome>
  );
}
