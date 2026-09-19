import { useEffect, useState } from 'react';
import { Sparkles, Upload } from 'lucide-react';
import { FANTASY_PHOTO_AI_COST, FANTASY_PHOTO_STYLES } from '@petdate/shared';
import { useI18n } from '../i18n';
import { loginPath } from '../lib/authRedirect';
import { Link } from 'react-router-dom';
import { generateFantasyPhoto } from '../lib/petLoverReviewsApi';
import { resolvePublicMediaUrl } from '../lib/mediaUrl';

type Props = {
  isLoggedIn: boolean;
  token: string | null;
  onUsePhoto: (file: File) => void;
};

export function FantasyPhotoStudio({ isLoggedIn, token, onUsePhoto }: Props) {
  const { t, lang } = useI18n();
  const [styleId, setStyleId] = useState(FANTASY_PHOTO_STYLES[0]!.id);
  const [source, setSource] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setSourcePreview(null);
      return;
    }
    const url = URL.createObjectURL(source);
    setSourcePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  const generate = async () => {
    setError(null);
    setNote(null);
    if (!isLoggedIn || !token) {
      setError(t('reviewsPage.loginRequired'));
      return;
    }
    if (!source) {
      setError(t('reviewsPage.aiNeedPhoto'));
      return;
    }
    setBusy(true);
    try {
      const result = await generateFantasyPhoto({ token, styleId, photo: source });
      const abs = resolvePublicMediaUrl(result.photoUrl) || result.photoUrl;
      setResultUrl(abs);
      const blob = await fetch(abs).then((r) => r.blob());
      const file = new File([blob], `fantasy-${styleId}.jpg`, {
        type: blob.type || 'image/jpeg',
      });
      onUsePhoto(file);
      setNote(t('reviewsPage.aiReady', { coins: String(result.coins) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reviewsPage.aiError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pepito-section pepito-reviews-ai" id="ai-photo">
      <div className="pepito-section-head pepito-section-head--center">
        <p className="pepito-eyebrow">
          <span className="pepito-eyebrow-icon" aria-hidden>
            <Sparkles size={16} />
          </span>
          {t('reviewsPage.aiEyebrow')}
        </p>
        <h2>{t('reviewsPage.aiTitle')}</h2>
        <p className="pepito-reviews-page-lead">{t('reviewsPage.aiLead', { n: String(FANTASY_PHOTO_AI_COST) })}</p>
      </div>

      <div className="pepito-reviews-ai-styles" role="listbox" aria-label={t('reviewsPage.aiStyles')}>
        {FANTASY_PHOTO_STYLES.map((s) => {
          const selected = s.id === styleId;
          const label = lang === 'en' ? s.labelEn : s.labelFa;
          return (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`pepito-reviews-ai-style${selected ? ' is-selected' : ''}`}
              onClick={() => setStyleId(s.id)}
            >
              <img src={s.sampleUrl} alt="" width={160} height={160} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {!isLoggedIn ? (
        <div className="pepito-reviews-gate">
          <p>{t('reviewsPage.aiMember')}</p>
          <Link className="pepito-btn button-1" to={loginPath('/reviews#ai-photo')}>
            {t('reviewsPage.loginCta')}
          </Link>
        </div>
      ) : (
        <div className="pepito-reviews-ai-panel">
          <label className="pepito-reviews-field pepito-reviews-photo">
            <span>{t('reviewsPage.aiUpload')}</span>
            <div className="pepito-reviews-photo-row">
              <span className="pepito-btn button-3 pepito-reviews-photo-btn">
                <Upload size={16} aria-hidden />
                {t('reviewsPage.photoPick')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setSource(e.target.files?.[0] || null)}
              />
            </div>
          </label>
          <div className="pepito-reviews-ai-previews">
            {sourcePreview ? (
              <figure>
                <img src={sourcePreview} alt="" width={220} height={220} />
                <figcaption>{t('reviewsPage.aiYours')}</figcaption>
              </figure>
            ) : null}
            {resultUrl ? (
              <figure>
                <img src={resultUrl} alt="" width={220} height={220} />
                <figcaption>{t('reviewsPage.aiResult')}</figcaption>
              </figure>
            ) : null}
          </div>
          {error ? <p className="pepito-reviews-page-status pepito-reviews-page-status--err">{error}</p> : null}
          {note ? <p className="pepito-reviews-page-status pepito-reviews-page-status--ok">{note}</p> : null}
          <button type="button" className="pepito-btn button-1" disabled={busy} onClick={() => void generate()}>
            <Sparkles size={16} aria-hidden />
            {busy ? t('reviewsPage.aiBusy') : t('reviewsPage.aiCta', { n: String(FANTASY_PHOTO_AI_COST) })}
          </button>
          <p className="pepito-reviews-form-note">{t('reviewsPage.aiNote')}</p>
        </div>
      )}
    </section>
  );
}
