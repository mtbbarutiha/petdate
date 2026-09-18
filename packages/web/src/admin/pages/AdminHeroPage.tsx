import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Image as ImageIcon,
  Monitor,
  RefreshCw,
  Smartphone,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { adminFetch } from '../api';
import { resolvePublicMediaUrl } from '../../lib/api';
import { appConfirm } from '../../components/AppDialog';
import { useI18n } from '../../i18n';
import { AdminBrandLoader } from '../AdminBrandLoader';
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
  posX: number;
  posY: number;
  scale: number;
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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function withCacheBust(url: string, stamp: string | null | undefined): string {
  if (!url || !stamp) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(stamp)}`;
}

function mediaStyle(posX: number, posY: number, scale: number): CSSProperties {
  return {
    objectPosition: `${posX}% ${posY}%`,
    transform: `scale(${scale})`,
    transformOrigin: `${posX}% ${posY}%`,
  };
}

function DevicePreview({
  mode,
  src,
  posX,
  posY,
  scale,
  kicker,
  title,
  lead,
  cta,
  desktopLabel,
  mobileLabel,
}: {
  mode: 'desktop' | 'mobile';
  src: string;
  posX: number;
  posY: number;
  scale: number;
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
          <img
            className="admin-hero-frame-media"
            src={src}
            alt=""
            style={mediaStyle(posX, posY, scale)}
          />
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
  const [focusBusy, setFocusBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [posX, setPosX] = useState(slide.posX ?? 50);
  const [posY, setPosY] = useState(slide.posY ?? 0);
  const [scale, setScale] = useState(slide.scale ?? 1);
  const [dirty, setDirty] = useState(false);
  const previewKeys = ROLE_PREVIEW_KEYS[slide.role];
  const remoteSrc =
    resolvePublicMediaUrl(slide.webp) ||
    resolvePublicMediaUrl(slide.fallback) ||
    slide.webp ||
    slide.fallback;
  const previewSrc = localPreview || withCacheBust(remoteSrc, slide.updatedAt);

  useEffect(() => {
    setPosX(slide.posX ?? 50);
    setPosY(slide.posY ?? 0);
    setScale(slide.scale ?? 1);
    setDirty(false);
  }, [slide.role, slide.posX, slide.posY, slide.scale, slide.updatedAt, slide.webp]);

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

  const nudge = (dx: number, dy: number) => {
    setPosX((x) => clamp(x + dx, 0, 100));
    setPosY((y) => clamp(y + dy, 0, 100));
    setDirty(true);
  };

  const nudgeZoom = (delta: number) => {
    setScale((s) => Math.round(clamp(s + delta, 1, 2) * 100) / 100);
    setDirty(true);
  };

  const saveFocus = async () => {
    setFocusBusy(true);
    setError(null);
    try {
      const data = await adminFetch<{ ok: boolean; slide: HeroSlide }>(
        `/api/admin/hero/${slide.role}/focus`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posX, posY, scale }),
        }
      );
      onChange(data.slide);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.heroFocusError'));
    } finally {
      setFocusBusy(false);
    }
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
            disabled={busy || (slide.source === 'default' && !dirty && posX === 50 && posY === 0 && scale === 1)}
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
          posX={posX}
          posY={posY}
          scale={scale}
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
          posX={posX}
          posY={posY}
          scale={scale}
          kicker={t(previewKeys.kicker)}
          title={t(previewKeys.title)}
          lead={t(previewKeys.lead)}
          cta={t(previewKeys.cta)}
          desktopLabel={t('admin.heroPreviewDesktop')}
          mobileLabel={t('admin.heroPreviewMobile')}
        />
      </div>

      <div className="admin-hero-focus">
        <div className="admin-hero-focus-head">
          <strong>{t('admin.heroFocusTitle')}</strong>
          <p className="admin-muted">{t('admin.heroFocusLead')}</p>
        </div>

        <div className="admin-hero-focus-pad" role="group" aria-label={t('admin.heroPanGroup')}>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={focusBusy} onClick={() => nudge(0, -5)} aria-label={t('admin.heroPanUp')}>
            <ArrowUp size={16} />
          </button>
          <div className="admin-hero-focus-mid">
            <button type="button" className="admin-btn admin-btn--ghost" disabled={focusBusy} onClick={() => nudge(-5, 0)} aria-label={t('admin.heroPanLeft')}>
              <ArrowLeft size={16} />
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={focusBusy} onClick={() => { setPosX(50); setPosY(0); setScale(1); setDirty(true); }} aria-label={t('admin.heroFocusReset')}>
              ·
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={focusBusy} onClick={() => nudge(5, 0)} aria-label={t('admin.heroPanRight')}>
              <ArrowRight size={16} />
            </button>
          </div>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={focusBusy} onClick={() => nudge(0, 5)} aria-label={t('admin.heroPanDown')}>
            <ArrowDown size={16} />
          </button>
        </div>

        <div className="admin-hero-focus-zoom" role="group" aria-label={t('admin.heroZoomGroup')}>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={focusBusy} onClick={() => nudgeZoom(-0.05)} aria-label={t('admin.heroZoomOut')}>
            <ZoomOut size={16} /> {t('admin.heroZoomOut')}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={focusBusy} onClick={() => nudgeZoom(0.05)} aria-label={t('admin.heroZoomIn')}>
            <ZoomIn size={16} /> {t('admin.heroZoomIn')}
          </button>
        </div>

        <div className="admin-hero-focus-sliders">
          <label>
            <span>{t('admin.heroPosX')} ({Math.round(posX)}%)</span>
            <input
              type="range"
              min={0}
              max={100}
              value={posX}
              disabled={focusBusy}
              onChange={(e) => {
                setPosX(Number(e.target.value));
                setDirty(true);
              }}
            />
          </label>
          <label>
            <span>{t('admin.heroPosY')} ({Math.round(posY)}%)</span>
            <input
              type="range"
              min={0}
              max={100}
              value={posY}
              disabled={focusBusy}
              onChange={(e) => {
                setPosY(Number(e.target.value));
                setDirty(true);
              }}
            />
          </label>
          <label>
            <span>{t('admin.heroScale')} ({scale.toFixed(2)}×)</span>
            <input
              type="range"
              min={100}
              max={200}
              value={Math.round(scale * 100)}
              disabled={focusBusy}
              onChange={(e) => {
                setScale(Number(e.target.value) / 100);
                setDirty(true);
              }}
            />
          </label>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={focusBusy || !dirty}
          onClick={() => void saveFocus()}
        >
          {focusBusy ? t('admin.heroFocusSaving') : t('admin.heroFocusSave')}
        </button>
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
      setSlides(
        (data.slides || []).map((s) => ({
          ...s,
          posX: s.posX ?? 50,
          posY: s.posY ?? 0,
          scale: s.scale ?? 1,
        }))
      );
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
      {loading ? <AdminBrandLoader size="card" /> : null}
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
