import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Upload } from 'lucide-react';
import { LandingChrome } from '../components/LandingChrome';
import { MobileAppDownloadStrip } from '../components/MobileAppDownloadStrip';
import { PetLoverReviewCardView } from '../components/PetLoverReviewCardView';
import { useI18n } from '../i18n';
import { useAuthStore } from '../hooks/useAuthStore';
import { loginPath } from '../lib/authRedirect';
import {
  fetchPetLoverReviewsList,
  submitPetLoverReview,
  type PetLoverReviewCard,
} from '../lib/petLoverReviewsApi';

export function PetLoversReviewsPage() {
  const { t, dir } = useI18n();
  const { isLoggedIn, token, user } = useAuthStore();
  const [reviews, setReviews] = useState<PetLoverReviewCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const defaultHandle = useMemo(() => {
    const name = String(user?.name || user?.username || '').trim();
    return name ? name.replace(/\s+/g, '') : '';
  }, [user?.name, user?.username]);

  useEffect(() => {
    if (!handle && defaultHandle) setHandle(defaultHandle);
  }, [defaultHandle, handle]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchPetLoverReviewsList({ limit: 60 })
      .then((result) => {
        if (!cancelled) {
          setReviews(result.reviews);
          setTotal(result.total);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('reviewsPage.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    setOkMsg(null);
    if (!isLoggedIn || !token) {
      setFormErr(t('reviewsPage.loginRequired'));
      return;
    }
    if (!photo) {
      setFormErr(t('reviewsPage.photoRequired'));
      return;
    }
    if (body.trim().length < 8) {
      setFormErr(t('reviewsPage.bodyShort'));
      return;
    }
    setBusy(true);
    try {
      const result = await submitPetLoverReview({
        token,
        displayHandle: handle,
        body: body.trim(),
        rating,
        photo,
      });
      setOkMsg(result.message);
      setBody('');
      setPhoto(null);
      setRating(5);
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : t('reviewsPage.submitError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LandingChrome
      bannerTitle={t('reviewsPage.bannerTitle')}
      bannerLead={t('reviewsPage.bannerLead')}
      actionLabel={t('reviewsPage.home')}
      actionTo="/"
      hideActionOnMobile
      showMobileEvents={false}
    >
      <div className="pepito-reviews-page" dir={dir}>
        <section className="pepito-section pepito-reviews-section pepito-reviews-page-hero">
          <div className="pepito-section-head pepito-section-head--center">
            <p className="pepito-eyebrow">
              <span className="pepito-eyebrow-icon" aria-hidden>
                <i className="flaticon-pawprint-4" />
              </span>
              {t('landing.reviewsEyebrow')}
            </p>
            <h1>{t('landing.reviewsTitle')}</h1>
            <p className="pepito-reviews-page-lead">{t('reviewsPage.lead')}</p>
          </div>

          <div className="pepito-review-trust pepito-reviews-page-trust">
            <span className="pepito-review-trust-tag">{t('landing.trustTag')}</span>
            <p className="pepito-review-trust-desc">
              {t('landing.trustDescBefore')}{' '}
              <span className="pepito-underline-pink">petdate</span>{' '}
              {t('landing.trustDescAfter')}
            </p>
          </div>

          <p className="pepito-reviews-page-count">
            {t('reviewsPage.count', { n: String(total) })}
          </p>

          {loading ? (
            <p className="pepito-reviews-page-status">{t('reviewsPage.loading')}</p>
          ) : error ? (
            <p className="pepito-reviews-page-status pepito-reviews-page-status--err">{error}</p>
          ) : (
            <div className="pepito-reviews pepito-reviews--page">
              {reviews.map((r) => (
                <PetLoverReviewCardView
                  key={r.id}
                  review={r}
                  starsAria={t('landing.starsAria')}
                />
              ))}
            </div>
          )}
        </section>

        <section className="pepito-section pepito-reviews-submit" id="submit-review">
          <div className="pepito-section-head pepito-section-head--center">
            <h2>{t('reviewsPage.submitTitle')}</h2>
            <p className="pepito-reviews-page-lead">{t('reviewsPage.submitLead')}</p>
          </div>

          {!isLoggedIn ? (
            <div className="pepito-reviews-gate">
              <p>{t('reviewsPage.memberOnly')}</p>
              <Link
                className="pepito-btn button-1"
                to={loginPath('/reviews#submit-review')}
              >
                {t('reviewsPage.loginCta')}
              </Link>
            </div>
          ) : (
            <form className="pepito-reviews-form" onSubmit={(e) => void onSubmit(e)}>
              <label className="pepito-reviews-field">
                <span>{t('reviewsPage.handleLabel')}</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder={t('reviewsPage.handlePh')}
                  maxLength={40}
                  required
                  dir="rtl"
                />
              </label>
              <label className="pepito-reviews-field">
                <span>{t('reviewsPage.bodyLabel')}</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('reviewsPage.bodyPh')}
                  rows={4}
                  maxLength={400}
                  required
                  dir="rtl"
                />
              </label>
              <label className="pepito-reviews-field">
                <span>{t('reviewsPage.ratingLabel')}</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
              </label>
              <label className="pepito-reviews-field pepito-reviews-photo">
                <span>{t('reviewsPage.photoLabel')}</span>
                <div className="pepito-reviews-photo-row">
                  <span className="pepito-btn button-3 pepito-reviews-photo-btn">
                    <Upload size={16} aria-hidden />
                    {t('reviewsPage.photoPick')}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                {preview ? (
                  <img
                    className="pepito-reviews-photo-preview"
                    src={preview}
                    alt=""
                    width={160}
                    height={160}
                  />
                ) : null}
              </label>
              {formErr ? (
                <p className="pepito-reviews-page-status pepito-reviews-page-status--err">
                  {formErr}
                </p>
              ) : null}
              {okMsg ? (
                <p className="pepito-reviews-page-status pepito-reviews-page-status--ok">
                  {okMsg}
                </p>
              ) : null}
              <button type="submit" className="pepito-btn button-1" disabled={busy}>
                {busy ? t('reviewsPage.submitting') : t('reviewsPage.submitCta')}
              </button>
              <p className="pepito-reviews-form-note">{t('reviewsPage.moderationNote')}</p>
            </form>
          )}

          <div className="pepito-reviews-page-back">
            <Link to="/" className="pepito-news-back">
              <ChevronLeft size={18} aria-hidden />
              {t('reviewsPage.home')}
            </Link>
          </div>
        </section>

        <MobileAppDownloadStrip />
      </div>
    </LandingChrome>
  );
}
