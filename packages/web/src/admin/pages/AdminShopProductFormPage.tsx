import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { SHOP_BRANDS, SHOP_CATEGORIES } from '../../data/shopCatalog';
import { adminFetch } from '../api';
import { AdminModal } from '../AdminModal';

type FormState = {
  id: string;
  slug: string;
  title: string;
  titleEn: string;
  brandId: string;
  categorySlug: string;
  petTypes: string;
  priceToman: string;
  compareAtToman: string;
  costToman: string;
  image: string;
  images: string;
  badge: string;
  inStock: boolean;
  stockQty: string;
  params: string;
  description: string;
  featured: boolean;
  sellerName: string;
  warranty: string;
  rating: string;
  reviewCount: string;
  highlights: string;
  sku: string;
  colors: string;
  sizes: string;
  shippingNote: string;
  returnPolicy: string;
  sellerScore: string;
  pros: string;
  cons: string;
};

const empty: FormState = {
  id: '',
  slug: '',
  title: '',
  titleEn: '',
  brandId: SHOP_BRANDS[0]?.id || 'petdate',
  categorySlug: SHOP_CATEGORIES[0]?.slug || 'dog-food',
  petTypes: 'dog',
  priceToman: '0',
  compareAtToman: '',
  costToman: '',
  image: '',
  images: '',
  badge: '',
  inStock: true,
  stockQty: '10',
  params: '{}',
  description: '',
  featured: false,
  sellerName: 'پت‌دیت شاپ',
  warranty: 'اصالت و سلامت فیزیکی کالا',
  rating: '4.6',
  reviewCount: '128',
  highlights: '',
  sku: '',
  colors: '',
  sizes: '',
  shippingNote: 'ارسال از انبار پت‌دیت — تحویل ۱ تا ۳ روز کاری',
  returnPolicy: '۷ روز ضمانت بازگشت کالا',
  sellerScore: '94',
  pros: '',
  cons: '',
};

function linesToList(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type ModalProps = {
  open: boolean;
  productId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function AdminShopProductFormModal({ open, productId, onClose, onSaved }: ModalProps) {
  const isNew = !productId || productId === 'new';
  const id = productId && productId !== 'new' ? productId : undefined;
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (isNew) {
      setForm(empty);
      return;
    }
    try {
      const prod = await adminFetch<Record<string, unknown>>(`/api/admin/shop/products/${id}`);
      const params =
        prod.params && typeof prod.params === 'object'
          ? (prod.params as Record<string, string>)
          : {};
      const images = Array.isArray(prod.images)
        ? (prod.images as string[]).join('\n')
        : typeof params.__images === 'string'
          ? params.__images.split('|').join('\n')
          : '';
      const highlights = Array.isArray(prod.highlights)
        ? (prod.highlights as string[]).join('\n')
        : typeof params.__highlights === 'string'
          ? params.__highlights.split('|').join('\n')
          : '';
      const colors = Array.isArray(prod.colors)
        ? (prod.colors as { labelFa: string; hex: string }[])
            .map((c) => `${c.labelFa}|${c.hex}`)
            .join('\n')
        : typeof params.__colors === 'string'
          ? params.__colors.split('||').join('\n')
          : '';
      const sizes = Array.isArray(prod.sizes)
        ? (prod.sizes as string[]).join('\n')
        : typeof params.__sizes === 'string'
          ? params.__sizes.split('|').join('\n')
          : '';
      const pros = Array.isArray(prod.pros)
        ? (prod.pros as string[]).join('\n')
        : typeof params.__pros === 'string'
          ? params.__pros.split('|').join('\n')
          : '';
      const cons = Array.isArray(prod.cons)
        ? (prod.cons as string[]).join('\n')
        : typeof params.__cons === 'string'
          ? params.__cons.split('|').join('\n')
          : '';
      setForm({
        id: String(prod.id),
        slug: String(prod.slug),
        title: String(prod.title),
        titleEn: String(prod.titleEn ?? params.__titleEn ?? ''),
        brandId: String(prod.brandId),
        categorySlug: String(prod.categorySlug),
        petTypes: Array.isArray(prod.petTypes) ? (prod.petTypes as string[]).join(',') : 'dog',
        priceToman: String(prod.priceToman ?? 0),
        compareAtToman: prod.compareAtToman != null ? String(prod.compareAtToman) : '',
        costToman: prod.costToman != null ? String(prod.costToman) : '',
        image: String(prod.image ?? ''),
        images,
        badge: String(prod.badge ?? ''),
        inStock: Boolean(prod.inStock),
        stockQty: String(prod.stockQty ?? 0),
        params: JSON.stringify(
          Object.fromEntries(Object.entries(params).filter(([k]) => !k.startsWith('__'))),
          null,
          2
        ),
        description: String(prod.description ?? ''),
        featured: Boolean(prod.featured),
        sellerName: String(prod.sellerName ?? params.__sellerName ?? 'پت‌دیت شاپ'),
        warranty: String(prod.warranty ?? params.__warranty ?? 'اصالت و سلامت فیزیکی کالا'),
        rating: String(prod.rating ?? params.__rating ?? '4.6'),
        reviewCount: String(prod.reviewCount ?? params.__reviewCount ?? '128'),
        highlights,
        sku: String(prod.sku ?? params.__sku ?? ''),
        colors,
        sizes,
        shippingNote: String(prod.shippingNote ?? params.__shippingNote ?? ''),
        returnPolicy: String(prod.returnPolicy ?? params.__returnPolicy ?? ''),
        sellerScore: String(prod.sellerScore ?? params.__sellerScore ?? '94'),
        pros,
        cons,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [id, isNew]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void load();
  }, [load, open]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let params: Record<string, string> = {};
    try {
      params = JSON.parse(form.params || '{}') as Record<string, string>;
    } catch {
      setError('params باید JSON باشد');
      setBusy(false);
      return;
    }
    const images = linesToList(form.images);
    const highlights = linesToList(form.highlights);
    const sizes = linesToList(form.sizes);
    const pros = linesToList(form.pros);
    const cons = linesToList(form.cons);
    const colors = linesToList(form.colors)
      .map((line) => {
        const [labelFa, hex] = line.split('|').map((s) => s.trim());
        if (!labelFa || !hex) return null;
        return { labelFa, hex };
      })
      .filter((c): c is { labelFa: string; hex: string } => Boolean(c));

    if (images.length) params.__images = images.join('|');
    else delete params.__images;
    if (highlights.length) params.__highlights = highlights.join('|');
    else delete params.__highlights;
    if (sizes.length) params.__sizes = sizes.join('|');
    else delete params.__sizes;
    if (pros.length) params.__pros = pros.join('|');
    else delete params.__pros;
    if (cons.length) params.__cons = cons.join('|');
    else delete params.__cons;
    if (colors.length) params.__colors = colors.map((c) => `${c.labelFa}|${c.hex}`).join('||');
    else delete params.__colors;
    if (form.sellerName.trim()) params.__sellerName = form.sellerName.trim();
    if (form.warranty.trim()) params.__warranty = form.warranty.trim();
    if (form.rating.trim()) params.__rating = form.rating.trim();
    if (form.reviewCount.trim()) params.__reviewCount = form.reviewCount.trim();
    if (form.titleEn.trim()) params.__titleEn = form.titleEn.trim();
    if (form.sku.trim()) params.__sku = form.sku.trim();
    if (form.shippingNote.trim()) params.__shippingNote = form.shippingNote.trim();
    if (form.returnPolicy.trim()) params.__returnPolicy = form.returnPolicy.trim();
    if (form.sellerScore.trim()) params.__sellerScore = form.sellerScore.trim();

    const payload = {
      id: form.id || undefined,
      slug: form.slug,
      title: form.title,
      titleEn: form.titleEn.trim() || undefined,
      brandId: form.brandId,
      categorySlug: form.categorySlug,
      petTypes: form.petTypes.split(',').map((s) => s.trim()).filter(Boolean),
      priceToman: Number(form.priceToman),
      compareAtToman: form.compareAtToman ? Number(form.compareAtToman) : undefined,
      costToman: form.costToman ? Number(form.costToman) : null,
      image: form.image || images[0] || undefined,
      images: images.length ? images : undefined,
      badge: form.badge || null,
      inStock: form.inStock,
      stockQty: Number(form.stockQty),
      params,
      description: form.description,
      featured: form.featured,
      sellerName: form.sellerName.trim() || undefined,
      warranty: form.warranty.trim() || undefined,
      rating: form.rating ? Number(form.rating) : undefined,
      reviewCount: form.reviewCount ? Number(form.reviewCount) : undefined,
      highlights: highlights.length ? highlights : undefined,
      sku: form.sku.trim() || undefined,
      colors: colors.length ? colors : undefined,
      sizes: sizes.length ? sizes : undefined,
      shippingNote: form.shippingNote.trim() || undefined,
      returnPolicy: form.returnPolicy.trim() || undefined,
      sellerScore: form.sellerScore ? Number(form.sellerScore) : undefined,
      pros: pros.length ? pros : undefined,
      cons: cons.length ? cons : undefined,
    };
    try {
      if (isNew) await adminFetch('/api/admin/shop/products', { method: 'POST', body: JSON.stringify(payload) });
      else await adminFetch(`/api/admin/shop/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title={isNew ? 'محصول جدید' : 'ویرایش محصول'}
      onClose={onClose}
      size="xl"
      as="form"
      onSubmit={(e) => void save(e)}
      busy={busy}
      footer={
        <>
          <label className="admin-check-inline">
            <input type="checkbox" checked={form.inStock} onChange={(e) => set({ inStock: e.target.checked })} /> موجود
          </label>
          <label className="admin-check-inline">
            <input type="checkbox" checked={form.featured} onChange={(e) => set({ featured: e.target.checked })} /> ویژه
          </label>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
            {busy ? '…' : 'ذخیره'}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={onClose}>
            انصراف
          </button>
        </>
      }
    >
      {error ? <p className="admin-error">{error}</p> : null}
      <p className="admin-muted" style={{ marginTop: 0 }}>فیلدهای صفحه محصول + کاتالوگ شاپ</p>
        <div className="admin-form-grid">
          <label>
            <span className="form-label">عنوان</span>
            <input className="form-input" required value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label>
            <span className="form-label">عنوان انگلیسی</span>
            <input
              className="form-input"
              dir="ltr"
              value={form.titleEn}
              onChange={(e) => set({ titleEn: e.target.value })}
              placeholder="Product English title"
            />
          </label>
          <label>
            <span className="form-label">اسلاگ</span>
            <input className="form-input" required value={form.slug} onChange={(e) => set({ slug: e.target.value })} />
          </label>
          <label>
            <span className="form-label">کد کالا (SKU)</span>
            <input
              className="form-input"
              dir="ltr"
              value={form.sku}
              onChange={(e) => set({ sku: e.target.value })}
              placeholder="PD-XXXX"
            />
          </label>
          <label>
            <span className="form-label">برند</span>
            <select className="admin-select" value={form.brandId} onChange={(e) => set({ brandId: e.target.value })}>
              {SHOP_BRANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.labelFa}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">دسته</span>
            <select
              className="admin-select"
              value={form.categorySlug}
              onChange={(e) => set({ categorySlug: e.target.value })}
            >
              {SHOP_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.labelFa}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">نوع پت</span>
            <input className="form-input" value={form.petTypes} onChange={(e) => set({ petTypes: e.target.value })} />
          </label>
          <label>
            <span className="form-label">قیمت تومان</span>
            <input
              className="form-input"
              type="number"
              value={form.priceToman}
              onChange={(e) => set({ priceToman: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">قیمت قبل تخفیف</span>
            <input
              className="form-input"
              type="number"
              value={form.compareAtToman}
              onChange={(e) => set({ compareAtToman: e.target.value })}
              placeholder="اختیاری"
            />
          </label>
          <label>
            <span className="form-label">بهای تمام‌شده (COGS)</span>
            <input
              className="form-input"
              type="number"
              value={form.costToman}
              onChange={(e) => set({ costToman: e.target.value })}
              placeholder="اختیاری"
            />
          </label>
          <label>
            <span className="form-label">موجودی</span>
            <input
              className="form-input"
              type="number"
              value={form.stockQty}
              onChange={(e) => set({ stockQty: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">نشان</span>
            <select className="admin-select" value={form.badge} onChange={(e) => set({ badge: e.target.value })}>
              <option value="">—</option>
              <option value="hot">hot</option>
              <option value="sale">sale</option>
              <option value="new">new</option>
              <option value="limited">limited</option>
            </select>
          </label>
          <label>
            <span className="form-label">فروشنده</span>
            <input
              className="form-input"
              value={form.sellerName}
              onChange={(e) => set({ sellerName: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">رضایت فروشنده (٪)</span>
            <input
              className="form-input"
              type="number"
              min="0"
              max="100"
              value={form.sellerScore}
              onChange={(e) => set({ sellerScore: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">گارانتی / اصالت</span>
            <input
              className="form-input"
              value={form.warranty}
              onChange={(e) => set({ warranty: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">توضیح ارسال</span>
            <input
              className="form-input"
              value={form.shippingNote}
              onChange={(e) => set({ shippingNote: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">شرایط مرجوعی</span>
            <input
              className="form-input"
              value={form.returnPolicy}
              onChange={(e) => set({ returnPolicy: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">امتیاز (۰–۵)</span>
            <input
              className="form-input"
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={form.rating}
              onChange={(e) => set({ rating: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">تعداد دیدگاه</span>
            <input
              className="form-input"
              type="number"
              value={form.reviewCount}
              onChange={(e) => set({ reviewCount: e.target.value })}
            />
          </label>
          <label className="admin-form-span">
            <span className="form-label">تصویر اصلی</span>
            <input className="form-input" value={form.image} onChange={(e) => set({ image: e.target.value })} />
          </label>
          <label className="admin-form-span">
            <span className="form-label">گالری تصاویر (هر خط یک URL)</span>
            <textarea
              className="form-input admin-mono"
              rows={3}
              dir="ltr"
              value={form.images}
              onChange={(e) => set({ images: e.target.value })}
              placeholder={'/pepito/uploads/01-1.png\n/pepito/uploads/01-2.jpg'}
            />
          </label>
          <label className="admin-form-span">
            <span className="form-label">نکات برجسته (هر خط یک مورد)</span>
            <textarea
              className="form-input"
              rows={3}
              value={form.highlights}
              onChange={(e) => set({ highlights: e.target.value })}
              placeholder={'ارسال سریع\nبسته‌بندی بهداشتی'}
            />
          </label>
          <label className="admin-form-span">
            <span className="form-label">رنگ‌ها (هر خط: نام|کدhex)</span>
            <textarea
              className="form-input admin-mono"
              rows={2}
              dir="ltr"
              value={form.colors}
              onChange={(e) => set({ colors: e.target.value })}
              placeholder={'آبی|#3b82f6\nسبز|#10b981'}
            />
          </label>
          <label className="admin-form-span">
            <span className="form-label">سایز / وزن (هر خط یک مورد)</span>
            <textarea
              className="form-input"
              rows={2}
              value={form.sizes}
              onChange={(e) => set({ sizes: e.target.value })}
              placeholder={'۴ کیلوگرم\n۱۰ کیلوگرم'}
            />
          </label>
          <label className="admin-form-span">
            <span className="form-label">نقاط قوت دیدگاه‌ها</span>
            <textarea
              className="form-input"
              rows={2}
              value={form.pros}
              onChange={(e) => set({ pros: e.target.value })}
            />
          </label>
          <label className="admin-form-span">
            <span className="form-label">نقاط ضعف دیدگاه‌ها</span>
            <textarea
              className="form-input"
              rows={2}
              value={form.cons}
              onChange={(e) => set({ cons: e.target.value })}
            />
          </label>
          <label className="admin-form-span">
            <span className="form-label">توضیح</span>
            <textarea
              className="form-input"
              rows={3}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <label className="admin-form-span">
            <span className="form-label">params JSON (جدول مشخصات)</span>
            <textarea
              className="form-input admin-mono"
              rows={3}
              dir="ltr"
              value={form.params}
              onChange={(e) => set({ params: e.target.value })}
            />
          </label>
        </div>
    </AdminModal>
  );
}

export function AdminShopProductFormPage() {
  const { id } = useParams();
  const to =
    !id || id === 'new'
      ? '/admin/shop/products?new=1'
      : `/admin/shop/products?edit=${encodeURIComponent(id)}`;
  return <Navigate to={to} replace />;
}
