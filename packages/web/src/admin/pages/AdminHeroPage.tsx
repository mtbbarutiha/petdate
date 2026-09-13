import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, RotateCcw, Upload } from 'lucide-react';
import { adminFetch } from '../api';
import { resolvePublicMediaUrl } from '../../lib/api';
import { appConfirm } from '../../components/AppDialog';
import { useI18n } from '../../i18n';

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

const ROLE_LABEL_KEYS: Record<HeroRole, string> = {
  playmate: 'admin.heroRolePlaymate',
  vet: 'admin.heroRoleVet',
  trainer: 'admin.heroRoleTrainer',
  no_pet: 'admin.heroRoleNoPet',
  adoption: 'admin.heroRoleAdoption',
};

export function AdminHeroPage() {
  const { t } = useI18n();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [cropNote, setCropNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyRole, setBusyRole] = useState<HeroRole | null>(null);
  const fileInputs = useRef<Partial<Record<HeroRole, HTMLInputElement | null>>>({});

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{
        slides: HeroSlide[];
        cropNote?: string;
      }>('/api/admin/hero');
      setSlides(data.slides || []);
      setCropNote(data.cropNote || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.heroLoadError'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (role: HeroRole, file: File | null) => {
    if (!file) return;
    setBusyRole(role);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await adminFetch<{ slide: HeroSlide }>(`/api/admin/hero/${role}/upload`, {
        method: 'POST',
        body: fd,
      });
      setSlides((prev) => prev.map((s) => (s.role === role ? data.slide : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.heroUploadError'));
    } finally {
      setBusyRole(null);
      const input = fileInputs.current[role];
      if (input) input.value = '';
    }
  };

  const reset = async (role: HeroRole) => {
    if (!(await appConfirm(t('admin.heroResetConfirm'), { danger: true, variant: 'admin' }))) {
      return;
    }
    setBusyRole(role);
    setError(null);
    try {
      const data = await adminFetch<{ slide: HeroSlide }>(`/api/admin/hero/${role}/reset`, {
        method: 'POST',
      });
      setSlides((prev) => prev.map((s) => (s.role === role ? data.slide : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.heroResetError'));
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{t('admin.heroPhotos')}</h1>
          <p>{t('admin.heroPhotosLead')}</p>
        </div>
      </header>

      {cropNote ? <p className="admin-muted" style={{ marginTop: 4 }}>{cropNote}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-hero-grid">
        {slides.map((slide) => {
          const preview = resolvePublicMediaUrl(slide.webp) || slide.webp;
          const busy = busyRole === slide.role;
          const isCustom = slide.source === 'custom';
          return (
            <article key={slide.role} className="admin-card admin-hero-card">
              <div className="admin-hero-card-preview">
                <img src={preview} alt={t(ROLE_LABEL_KEYS[slide.role])} />
              </div>
              <div className="admin-hero-card-body">
                <div className="admin-card-head" style={{ marginBottom: 8 }}>
                  <h2 style={{ margin: 0 }}>{t(ROLE_LABEL_KEYS[slide.role])}</h2>
                  <span className={`admin-badge ${isCustom ? 'admin-badge--info' : ''}`}>
                    {isCustom ? t('admin.heroCustom') : t('admin.heroDefault')}
                  </span>
                </div>
                {isCustom && slide.originalName ? (
                  <p className="admin-muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
                    {slide.originalName}
                  </p>
                ) : null}
                <div className="admin-row-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={busy}
                    onClick={() => fileInputs.current[slide.role]?.click()}
                  >
                    {busy ? (
                      t('admin.heroUploading')
                    ) : (
                      <>
                        <Upload size={14} /> {t('admin.heroUpload')}
                      </>
                    )}
                  </button>
                  <input
                    ref={(el) => {
                      fileInputs.current[slide.role] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    hidden
                    disabled={busy}
                    onChange={(e) => void upload(slide.role, e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    disabled={busy || !isCustom}
                    onClick={() => void reset(slide.role)}
                  >
                    <RotateCcw size={14} /> {t('admin.heroReset')}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {!slides.length ? (
          <div className="admin-card" style={{ padding: 24, gridColumn: '1 / -1' }}>
            <p className="admin-muted" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ImagePlus size={16} /> {t('admin.heroEmpty')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
