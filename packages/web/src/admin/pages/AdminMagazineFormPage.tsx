import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Save } from 'lucide-react';
import { adminFetch } from '../api';
import {
  JalaliDateSelect,
  currentJalaliParts,
  gregorianIsoToJalaliParts,
  jalaliPartsToGregorianIso,
  type JalaliDateValue,
} from '../JalaliDateSelect';
import { MagazineRichTextEditor } from '../MagazineRichTextEditor';
import { resolvePublicMediaUrl } from '../../lib/api';
import { tr } from '../../i18n';

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  coverImage: string;
  category: string;
  tags: string;
  author: string;
  status: 'draft' | 'published' | 'scheduled';
  featured: boolean;
  metaTitle: string;
  metaDescription: string;
};

const empty: FormState = {
  title: '',
  slug: '',
  excerpt: '',
  bodyHtml: '',
  coverImage: '',
  category: '',
  tags: '',
  author: '',
  status: 'draft',
  featured: false,
  metaTitle: '',
  metaDescription: '',
};

function slugifyClient(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function AdminMagazineFormPage() {
  const { id: idParam } = useParams();
  const isNew = !idParam || idParam === 'new';
  const id = !isNew ? Number(idParam) : NaN;
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [publishJalali, setPublishJalali] = useState<JalaliDateValue>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    if (isNew) {
      setForm(empty);
      setPublishJalali(currentJalaliParts());
      setSlugTouched(false);
      return;
    }
    if (!Number.isFinite(id)) {
      setError(tr('شناسه نامعتبر'));
      return;
    }
    try {
      const data = await adminFetch<{
        article: FormState & { publishAt: string | null; tags: string[]; bodyHtml: string };
      }>(`/api/admin/magazine/${id}`);
      const a = data.article;
      setForm({
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        bodyHtml: a.bodyHtml,
        coverImage: a.coverImage,
        category: a.category,
        tags: Array.isArray(a.tags) ? a.tags.join('، ') : String(a.tags || ''),
        author: a.author,
        status: a.status,
        featured: Boolean(a.featured),
        metaTitle: a.metaTitle || '',
        metaDescription: a.metaDescription || '',
      });
      setSlugTouched(true);
      setPublishJalali(
        a.publishAt
          ? gregorianIsoToJalaliParts(a.publishAt.replace(' ', 'T'))
          : currentJalaliParts()
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  const publishAtIso = (): string | null => {
    const date = jalaliPartsToGregorianIso(publishJalali);
    if (!date) return null;
    return `${date} 09:00:00`;
  };

  const save = async (e: FormEvent, andPublish = false) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt,
        bodyHtml: form.bodyHtml,
        coverImage: form.coverImage,
        category: form.category,
        tags: form.tags,
        author: form.author,
        status: andPublish ? 'published' : form.status,
        featured: form.featured,
        publishAt: publishAtIso(),
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
      };
      if (!payload.title) throw new Error('عنوان الزامی است');

      if (isNew) {
        const data = await adminFetch<{ article: { id: number } }>('/api/admin/magazine', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSaved(true);
        navigate(`/admin/magazine/${data.article.id}`, { replace: true });
      } else {
        await adminFetch(`/api/admin/magazine/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (andPublish && form.status !== 'published') {
          await adminFetch(`/api/admin/magazine/${id}/publish`, {
            method: 'POST',
            body: JSON.stringify({ publishAt: publishAtIso() }),
          });
        }
        setSaved(true);
        await load();
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const uploadCover = async (file: File | null) => {
    if (!file) return;
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await adminFetch<{ url: string }>('/api/admin/magazine/upload', {
        method: 'POST',
        body: fd,
      });
      set({ coverImage: data.url });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'آپلود ناموفق');
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-muted">
            <Link to="/admin/magazine" className="admin-link">
              {tr('← مجله و اخبار')}
            </Link>
          </p>
          <h1>{isNew ? tr('مطلب جدید') : tr('ویرایش مطلب')}</h1>
        </div>
        <div className="admin-header-actions">
          {!isNew && form.status === 'published' && form.slug ? (
            <a
              className="admin-btn admin-btn--ghost"
              href={`/magazine/${form.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> {tr('پیش‌نمایش')}
            </a>
          ) : null}
          <button
            type="button"
            className="admin-btn"
            disabled={busy}
            onClick={(e) => void save(e as unknown as FormEvent, false)}
          >
            <Save size={16} /> {tr('ذخیره')}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={busy}
            onClick={(e) => void save(e as unknown as FormEvent, true)}
          >
            {tr('ذخیره و انتشار')}
          </button>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {saved ? <p className="admin-success">{tr('ذخیره شد')}</p> : null}

      <form className="admin-card admin-form-grid" style={{ padding: 16 }} onSubmit={(e) => void save(e)}>
        <label className="admin-span-2">
          <span className="form-label">{tr('عنوان')}</span>
          <input
            className="form-input"
            value={tr(form.title)}
            onChange={(e) => {
              const title = e.target.value;
              set({
                title,
                slug: slugTouched ? form.slug : slugifyClient(title),
              });
            }}
            required
          />
        </label>

        <label>
          <span className="form-label">{tr('اسلاگ (URL)')}</span>
          <input
            className="form-input"
            dir="ltr"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set({ slug: e.target.value });
            }}
            placeholder="auto-from-title"
          />
        </label>

        <label>
          <span className="form-label">{tr('وضعیت')}</span>
          <select
            className="form-input"
            value={form.status}
            onChange={(e) => set({ status: e.target.value as FormState['status'] })}
          >
            <option value="draft">{tr('پیش‌نویس')}</option>
            <option value="published">{tr('منتشر شده')}</option>
            <option value="scheduled">{tr('زمان‌بندی‌شده')}</option>
          </select>
        </label>

        <label>
          <span className="form-label">{tr('دسته‌بندی')}</span>
          <input
            className="form-input"
            value={form.category}
            onChange={(e) => set({ category: e.target.value })}
            placeholder={tr("مثلاً مراقبت")}
          />
        </label>

        <label>
          <span className="form-label">{tr('نویسنده')}</span>
          <input
            className="form-input"
            value={form.author}
            onChange={(e) => set({ author: e.target.value })}
            placeholder={tr("اختیاری")}
          />
        </label>

        <label className="admin-span-2">
          <span className="form-label">{tr('برچسب‌ها (با ویرگول)')}</span>
          <input
            className="form-input"
            value={form.tags}
            onChange={(e) => set({ tags: e.target.value })}
            placeholder={tr("دندان، سلامت، پت")}
          />
        </label>

        <label className="admin-span-2">
          <span className="form-label">{tr('خلاصه کوتاه')}</span>
          <textarea
            className="form-input"
            rows={2}
            value={form.excerpt}
            onChange={(e) => set({ excerpt: e.target.value })}
            placeholder={tr("برای کارت‌های لیست و متا")}
          />
        </label>

        <div className="admin-span-2">
          <JalaliDateSelect
            label={tr("تاریخ انتشار (جلالی)")}
            value={publishJalali}
            onChange={setPublishJalali}
            yearsBack={5}
            yearsForward={2}
          />
        </div>

        <label className="admin-span-2">
          <span className="form-label">{tr('تصویر کاور')}</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              dir="ltr"
              style={{ flex: 1, minWidth: 200 }}
              value={form.coverImage}
              onChange={(e) => set({ coverImage: e.target.value })}
              placeholder={tr("/pepito/uploads/… یا /api/magazine/images/…")}
            />
            <label className="admin-btn">
              {uploadBusy ? tr('در حال آپلود…') : tr('آپلود')}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploadBusy}
                onChange={(e) => void uploadCover(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {form.coverImage ? (
            <img
              src={resolvePublicMediaUrl(form.coverImage) || form.coverImage}
              alt=""
              style={{ marginTop: 10, maxWidth: 280, borderRadius: 12, display: 'block' }}
            />
          ) : null}
        </label>

        <label>
          <span className="form-label">{tr('عنوان SEO')}</span>
          <input
            className="form-input"
            value={form.metaTitle}
            onChange={(e) => set({ metaTitle: e.target.value })}
            placeholder={tr("خالی = عنوان مطلب")}
          />
        </label>

        <label>
          <span className="form-label">{tr('توضیح SEO')}</span>
          <input
            className="form-input"
            value={form.metaDescription}
            onChange={(e) => set({ metaDescription: e.target.value })}
            placeholder={tr("خالی = خلاصه")}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => set({ featured: e.target.checked })}
          />
          {tr('ویژه برای کاروسل صفحه اصلی')}
        </label>

        <div className="admin-span-2">
          <span className="form-label">{tr('متن کامل (ویرایشگر TipTap)')}</span>
          <MagazineRichTextEditor
            value={form.bodyHtml}
            onChange={(bodyHtml) => set({ bodyHtml })}
            disabled={busy}
          />
        </div>
      </form>
    </div>
  );
}
