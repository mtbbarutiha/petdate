import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Image as ImageIcon, Monitor, RefreshCw, Smartphone, Upload } from 'lucide-react';
import { adminFetch } from '../api';
import { resolvePublicMediaUrl } from '../../lib/api';
import { appConfirm } from '../../components/AppDialog';
import { useI18n } from '../../i18n';
import './AdminHeroPage.css';

type HeroRole = 'playmate' | 'vet' | 'trainer' | 'no_pet' | 'adoption';

type HeroSlide = {
  role: HeroRole;
  webp: string;
  srcSet: string;
  fallback: string;
  source: 'custom' | 'default';
  updatedAt: string | null;
  originalName?: string;
};

type HeroAdminPayload = {
  slides: HeroSlide[];
  cropNote?: string;
};

const ROLE_LABEL_KEYS: Record<HeroRole, string> = {
  playmate: 'admin.heroRolePlaymate',
  vet: 'admin.heroRoleVet',
  trainer: 'admin.heroRoleTrainer',
  no_pet: 'admin.heroRoleNoPet',
  adoption: 'admin.heroRoleAdoption',
};

const ROLE_PREVIEW_KEYS: Record<
  HeroRole,
  { kicker: string; title: string; lead: string; cta: string }
> = {
  playmate: {
    kicker: 'landing.heroPlaymateKicker',
    title: 'landing.heroPlaymateTitle',
    lead: 'landing.heroPlaymateLead',
    cta: 'landing.heroPlaymateCta',
  },
  vet: {
    kicker: 'landing.heroVetKicker',
    title: 'landing.heroVetTitle',
    lead: 'landing.heroVetLead',
    cta: 'landing.heroVetCta',
  },
  trainer: {
    kicker: 'landing.heroTrainerKicker',
    title: 'landing.heroTrainerTitle',
    lead: 'landing.heroTrainerLead',
    cta: 'landing.heroTrainerCta',
  },
  no_pet: {
    kicker: 'landing.heroNoPetKicker',
    title: 'landing.heroNoPetTitle',
    lead: 'landing.heroNoPetLead',
    cta: 'landing.heroNoPetCta',
  },
  adoption: {
    kicker: 'landing.heroAdoptionKicker',
    title: 'landing.heroAdoptionTitle',
    lead: 'landing.heroAdoptionLead',
    cta: 'landing.heroAdoptionCta',
  },
};

function withCacheBust(url: string, stamp: string | null | undefined): string {
  if (!url || !stamp) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(stamp)}`;
}

function DevicePreview({
  mode,
  src,
  kicker,
  title,
  lead,
  cta,
  desktopLabel,
  mobileLabel,
}: {
  mode: 'desktop' | 'mobile';
  src: string;
  kicker: string;
  title: string;
  lead: string;
  cta: string;
  desktopLabel: string;
  mobileLabel: string;
}) {
  return (
    <div className={`admin-hero-device admin-hero-device--${mode}`}>
      <div className="admin-hero-device-chrome" aria-hidden>
        {mode === 'desktop' ? <Monitor size={14} /> : <Smartphone size={14} />}
        <span>{mode === 'desktop' ? desktopLabel : mobileLabel}</span>
      </div>
      <div className="admin-hero-frame" aria-label={mode === 'desktop' ? desktopLabel : mobileLabel}>
        {src ? (
          <img className="admin-hero-frame-media" src={src} alt="" />
        ) : (
          <div className="admin-hero-frame-empty" aria-hidden />
        )}
        <div className="admin-hero-frame-wash" aria-hidden />
        <div className="admin-hero-frame-copy">
          <p className="admin-hero-frame-kicker">{kicker}</p>
          <p className="admin-hero-frame-title">{title}</p>
          <p className="admin-hero-frame-lead">{lead}</p>
          <span className="admin-hero-frame-cta">{cta}</span>
        </div>
        <div className="admin-hero-frame-dots" aria-hidden>
          <span className="is-active" />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function SlideCard({
  slide,
  onChange,
}: {
  slide: HeroSlide;
  onChange: (next: HeroSlide) => void;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const previewKeys = ROLE_PREVIEW_KEYS[slide.role];
  const remoteSrc =
    resolvePublicMediaUrl(slide.webp) ||
    resolvePublicMediaUrl(slide.fallback) ||
    slide.webp ||
    slide.fallback;
  const previewSrc = localPreview || withCacheBust(remoteSrc, slide.updatedAt);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const clearLocal = () => {
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    try {
      const body = new FormData();
      body.append('file', file);
      const data = await adminFetch<{ ok: boolean; slide: HeroSlide }>(
        `/api/admin/hero/${slide.role}/upload`,
        { method: 'POST', body }
      );
      onChange(data.slide);
      clearLocal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.heroUploadError'));
      clearLocal();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const reset = async () => {
    if (!(await appConfirm(t('admin.heroResetConfirm'), { danger: true, variant: 'admin' }))) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await adminFetch<{ ok: boolean; slide: HeroSlide }>(
        `/api/admin/hero/${slide.role}/reset`,
        { method: 'POST' }
      );
      onChange(data.slide);
      clearLocal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.heroResetError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="admin-card admin-hero-card">
      <header className="admin-hero-card-head">
        <div>
          <h2>{t(ROLE_LABEL_KEYS[slide.role])}</h2>
          <p className="admin-muted">
            {slide.source === 'custom'
              ? `${t('admin.heroCustom')}${slide.originalName ? ` · ${slide.originalName}` : ''}`
              : t('admin.heroDefault')}
            {slide.updatedAt ? ` · ${new Date(slide.updatedAt).toLocaleString()}` : ''}
          </p>
        </div>
        <div className="admin-hero-card-actions">
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
            hidden
            disabled={busy}
            onChange={(e) => void upload(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor={inputId}
            className={`admin-btn admin-btn--primary${busy ? ' is-disabled' : ''}`}
          >
            <Upload size={16} aria-hidden />{' '}
            {busy ? t('admin.heroUploading') : t('admin.heroUpload')}
          </label>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={busy || slide.source === 'default'}
            onClick={() => void reset()}
          >
            <RefreshCw size={16} aria-hidden /> {t('admin.heroReset')}
          </button>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-hero-previews">
        <DevicePreview
          mode="desktop"
          src={previewSrc}
          kicker={t(previewKeys.kicker)}
          title={t(previewKeys.title)}
          lead={t(previewKeys.lead)}
          cta={t(previewKeys.cta)}
          desktopLabel={t('admin.heroPreviewDesktop')}
          mobileLabel={t('admin.heroPreviewMobile')}
        />
        <DevicePreview
          mode="mobile"
          src={previewSrc}
          kicker={t(previewKeys.kicker)}
          title={t(previewKeys.title)}
          lead={t(previewKeys.lead)}
          cta={t(previewKeys.cta)}
          desktopLabel={t('admin.heroPreviewDesktop')}
          mobileLabel={t('admin.heroPreviewMobile')}
        />
      </div>
    </article>
  );
}

export function AdminHeroPage() {
  const { t } = useI18n();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [cropNote, setCropNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<HeroAdminPayload>('/api/admin/hero');
      setSlides(data.slides || []);
      setCropNote(data.cropNote || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.heroLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchSlide = (next: HeroSlide) => {
    setSlides((prev) => prev.map((s) => (s.role === next.role ? next : s)));
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>
            <ImageIcon size={22} aria-hidden /> {t('admin.heroPhotos')}
          </h1>
          <p className="admin-muted">{t('admin.heroPhotosLead')}</p>
        </div>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void load()}>
          <RefreshCw size={16} aria-hidden /> {t('admin.heroRefresh')}
        </button>
      </header>

      <div className="admin-card admin-hero-note">
        <strong>{t('admin.heroAutoCropTitle')}</strong>
        <p>{cropNote || t('admin.heroAutoCropBody')}</p>
        <p className="admin-muted">{t('admin.heroPreviewHint')}</p>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {loading ? <p className="admin-muted">{t('admin.heroLoading')}</p> : null}
      {!loading && slides.length === 0 ? (
        <p className="admin-muted">{t('admin.heroEmpty')}</p>
      ) : null}

      <div className="admin-hero-list">
        {slides.map((slide) => (
          <SlideCard key={slide.role} slide={slide} onChange={patchSlide} />
        ))}
      </div>
    </div>
  );
}
