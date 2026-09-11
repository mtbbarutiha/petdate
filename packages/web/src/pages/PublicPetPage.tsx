import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Heart,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  formatPetAge,
  isNumericPetIdParam,
  petPublicPath,
  toPersianDigits,
  type PetDiaryEntry,
  type PetProfile,
} from '@petdate/shared';
import { EMPTY_STATE_PHOTO } from '../data/petImages';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import {
  createPetDiaryEntry,
  deletePetDiaryEntry,
  getPet,
  listPetDiary,
  listPets,
} from '../lib/api';
import { petProfileToUiPet } from '../lib/playdateMap';
import { sendPlaymateRequestNow } from '../lib/playmateActions';
import { petPublicUrl, shareOrCopyUrl } from '../lib/share';
import { loginPath } from '../lib/authRedirect';
import { LandingChrome } from '../components/LandingChrome';
import { PET_GENDER_LABELS, PET_SIZE_LABELS, PET_TYPE_LABELS } from '../types';

export function PublicPetPage() {
  const { slugOrId } = useParams<{ slugOrId: string }>();
  const navigate = useNavigate();
  const { user: authUser, isLoggedIn } = useAuthStore();
  const { toastSuccess, toastError, toastInfo } = useAppToast();

  const [pet, setPet] = useState<PetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diary, setDiary] = useState<PetDiaryEntry[]>([]);
  const [diaryBody, setDiaryBody] = useState('');
  const [diaryBusy, setDiaryBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [myPets, setMyPets] = useState<PetProfile[]>([]);
  const [showPickFrom, setShowPickFrom] = useState(false);
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  const myUserId = authUser?.id;
  const isMyPet = Boolean(myUserId && pet && pet.ownerId === myUserId);
  const ui = useMemo(() => (pet ? petProfileToUiPet(pet) : null), [pet]);

  const loadPet = useCallback(async () => {
    const key = String(slugOrId ?? '').trim();
    if (!key) {
      setPet(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getPet(key);
      setPet(row);
      if (!row) setError('پت پیدا نشد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری پت ناموفق بود');
      setPet(null);
    } finally {
      setLoading(false);
    }
  }, [slugOrId]);

  const loadDiary = useCallback(async (petKey: string | number) => {
    try {
      const data = await listPetDiary(petKey);
      setDiary(data.entries || []);
    } catch {
      setDiary([]);
    }
  }, []);

  useEffect(() => {
    void loadPet();
  }, [loadPet]);

  useEffect(() => {
    if (!pet) return;
    void loadDiary(pet.slug || pet.id);
  }, [pet, loadDiary]);

  useEffect(() => {
    if (!myUserId) {
      setMyPets([]);
      return;
    }
    void listPets({ ownerId: myUserId })
      .then(setMyPets)
      .catch(() => setMyPets([]));
  }, [myUserId]);

  if (
    pet?.slug &&
    slugOrId &&
    isNumericPetIdParam(slugOrId) &&
    String(pet.id) === String(slugOrId).trim()
  ) {
    return <Navigate to={petPublicPath(pet)} replace />;
  }
  if (
    pet?.slug &&
    slugOrId &&
    !isNumericPetIdParam(slugOrId) &&
    slugOrId.toLowerCase() === pet.slug.toLowerCase() &&
    slugOrId !== pet.slug
  ) {
    return <Navigate to={petPublicPath(pet)} replace />;
  }

  async function sendFrom(fromPetId: number) {
    if (!myUserId || !pet) return;
    setBusy(true);
    setError(null);
    try {
      const req = await sendPlaymateRequestNow({
        fromPetId,
        toPetId: pet.id,
        fromUserId: myUserId,
      });
      setAlreadyRequested(true);
      setShowPickFrom(false);
      toastSuccess('درخواست همبازی ارسال شد');
      if (req?.id) navigate(`/chats/${req.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ارسال درخواست ناموفق بود';
      setError(msg);
      toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  function onRequestClick() {
    if (!isLoggedIn || !myUserId) {
      navigate(loginPath(petPublicPath(pet || { id: 0 })));
      return;
    }
    if (alreadyRequested || busy) return;
    if (myPets.length === 0) {
      const msg = 'اول یک پت ثبت کن';
      setError(msg);
      toastError(msg);
      return;
    }
    if (myPets.length === 1) {
      void sendFrom(myPets[0]!.id);
      return;
    }
    setShowPickFrom(true);
  }

  async function onSharePet() {
    if (!pet) return;
    const url = petPublicUrl(pet);
    const title = `${pet.name} | پت‌دیت`;
    const text = `پروفایل ${pet.name} را در پت‌دیت ببین`;
    const message = await shareOrCopyUrl({ url, title, text });
    if (!message) return;
    toastInfo(message);
  }

  async function onSubmitDiary(e: FormEvent) {
    e.preventDefault();
    if (!pet || !myUserId || !isMyPet) return;
    const body = diaryBody.trim();
    if (!body) {
      toastError('متن خاطره را بنویس');
      return;
    }
    setDiaryBusy(true);
    try {
      const entry = await createPetDiaryEntry(pet.slug || pet.id, body, myUserId);
      setDiary((rows) => [entry, ...rows]);
      setDiaryBody('');
      toastSuccess('خاطره ثبت شد');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'ثبت خاطره ناموفق بود');
    } finally {
      setDiaryBusy(false);
    }
  }

  async function onDeleteDiary(entryId: number) {
    if (!pet || !myUserId || !isMyPet) return;
    setDiaryBusy(true);
    try {
      await deletePetDiaryEntry(pet.slug || pet.id, entryId, myUserId);
      setDiary((rows) => rows.filter((r) => r.id !== entryId));
      toastSuccess('خاطره حذف شد');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'حذف ناموفق بود');
    } finally {
      setDiaryBusy(false);
    }
  }

  const photo = ui?.imageUrl || EMPTY_STATE_PHOTO;
  const diaryTitle = pet ? `دفتر خاطرات ${pet.name}` : 'دفتر خاطرات';
  const genderLabel =
    pet?.gender && PET_GENDER_LABELS[pet.gender] ? PET_GENDER_LABELS[pet.gender] : null;
  const sizeLabel =
    pet?.size && PET_SIZE_LABELS[pet.size] ? PET_SIZE_LABELS[pet.size] : null;
  const ageLabel =
    pet?.ageMonths != null && pet.ageMonths >= 0 ? formatPetAge(pet.ageMonths) : null;

  return (
    <LandingChrome hideBanner footer>
      <div
        className="pepito-public-pet"
        style={
          {
            ['--pet-diary-photo' as string]: `url(${JSON.stringify(photo)})`,
          } as CSSProperties
        }
      >
        {loading ? (
          <div className="pepito-public-pet-shell">
            <p className="pepito-public-pet-loading">در حال بارگذاری…</p>
          </div>
        ) : !pet || !ui ? (
          <div className="pepito-public-pet-shell pepito-public-pet-shell--empty">
            <img src={EMPTY_STATE_PHOTO} alt="" className="empty-photo" />
            <h1>پت پیدا نشد</h1>
            <p>{error || 'این پروفایل در دسترس نیست.'}</p>
            <Link to="/" className="pepito-btn button-1">
              بازگشت به خانه
            </Link>
          </div>
        ) : (
          <>
            <header className="pepito-public-pet-hero">
              <img
                src={photo}
                alt={pet.name}
                className="pepito-public-pet-hero-img"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== EMPTY_STATE_PHOTO) img.src = EMPTY_STATE_PHOTO;
                }}
              />
              <div className="pepito-public-pet-hero-wash" aria-hidden />
              <div className="pepito-public-pet-hero-bar">
                <button
                  type="button"
                  className="icon-btn icon-btn--glass"
                  onClick={() => navigate(-1)}
                  aria-label="بازگشت"
                >
                  <ArrowRight size={20} />
                </button>
                <div className="pepito-public-pet-hero-brand">
                  <p>پت‌دیت</p>
                  <h1>{pet.name}</h1>
                </div>
                <div className="pepito-public-pet-hero-actions">
                  {isMyPet ? (
                    <Link
                      to={`/pets/${pet.id}/edit`}
                      className="icon-btn icon-btn--glass"
                      aria-label="ویرایش"
                    >
                      <Pencil size={18} />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="icon-btn icon-btn--glass"
                    aria-label="اشتراک"
                    onClick={() => void onSharePet()}
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            </header>

            <div className="pepito-public-pet-shell">
              <section className="pepito-public-pet-info" aria-label="اطلاعات پت">
                <p className="pepito-public-pet-kicker">
                  {[
                    PET_TYPE_LABELS[ui.type] || pet.species,
                    pet.breed,
                    ageLabel,
                    genderLabel,
                    sizeLabel,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="pepito-public-pet-loc">
                  {[pet.city || pet.ownerCity, pet.ownerProvince].filter(Boolean).join('، ') ||
                    '—'}
                </p>
                {pet.ownerName ? (
                  <p className="pepito-public-pet-owner">
                    صاحب پت: {pet.ownerName}
                    {pet.ownerVerified ? ' · تأییدشده' : ''}
                  </p>
                ) : null}
                {pet.bio ? <p className="pepito-public-pet-bio">{pet.bio}</p> : null}
                {pet.color ? (
                  <p className="pepito-public-pet-meta-line">رنگ: {pet.color}</p>
                ) : null}

                <div className="pepito-public-pet-tags">
                  {pet.vaccinated ? <span className="tag green">واکسینه</span> : null}
                  {pet.neutered ? <span className="tag green">عقیم</span> : null}
                  {pet.lookingForPlaymate ? (
                    <span className="tag blue">دنبال همبازی</span>
                  ) : null}
                </div>

                {isMyPet ? (
                  <div className="pepito-public-pet-owner-actions">
                    <Link to={`/pets/${pet.id}/edit`} className="pepito-btn button-2">
                      <Pencil size={16} aria-hidden />
                      ویرایش پروفایل
                    </Link>
                    <Link to={`/pets/${pet.id}?tab=medical`} className="pepito-btn button-1">
                      پرونده پزشکی
                    </Link>
                  </div>
                ) : (
                  <div className="pepito-public-pet-cta">
                    <button
                      type="button"
                      className="pepito-btn button-1"
                      disabled={busy || alreadyRequested}
                      onClick={onRequestClick}
                    >
                      <Heart size={16} aria-hidden />
                      {alreadyRequested ? 'درخواست ارسال شده' : 'درخواست همبازی'}
                    </button>
                  </div>
                )}

                {showPickFrom ? (
                  <div className="pepito-public-pet-pick">
                    <p>از طرف کدوم پت؟</p>
                    {myPets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="pepito-btn button-2"
                        onClick={() => void sendFrom(p.id)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                {error ? <p className="auth-error">{error}</p> : null}
              </section>

              <section className="pepito-pet-diary" aria-label={diaryTitle}>
                <div className="pepito-pet-diary-paper">
                  <header className="pepito-pet-diary-head">
                    <BookOpen size={22} aria-hidden />
                    <div>
                      <h2>{diaryTitle}</h2>
                      <p>لحظه‌های کوچک، به قلم صاحب پت.</p>
                    </div>
                  </header>

                  {isMyPet ? (
                    <form className="pepito-pet-diary-form" onSubmit={(e) => void onSubmitDiary(e)}>
                      <label htmlFor="pet-diary-body" className="sr-only">
                        نوشتن خاطره
                      </label>
                      <textarea
                        id="pet-diary-body"
                        rows={4}
                        maxLength={4000}
                        placeholder={`امروز ${pet.name} چه کرد؟`}
                        value={diaryBody}
                        onChange={(e) => setDiaryBody(e.target.value)}
                        disabled={diaryBusy}
                      />
                      <button
                        type="submit"
                        className="pepito-btn button-1"
                        disabled={diaryBusy || !diaryBody.trim()}
                      >
                        ثبت خاطره
                      </button>
                    </form>
                  ) : null}

                  {diary.length === 0 ? (
                    <p className="pepito-pet-diary-empty">
                      {isMyPet
                        ? 'هنوز خاطره‌ای نیست — اولین صفحه را بنویس.'
                        : 'هنوز خاطره‌ای در این دفتر نیست.'}
                    </p>
                  ) : (
                    <ul className="pepito-pet-diary-list">
                      {diary.map((entry) => (
                        <li key={entry.id} className="pepito-pet-diary-entry">
                          <header>
                            <time>
                              {toPersianDigits(
                                entry.createdAt.slice(0, 16).replace('T', ' ')
                              )}
                            </time>
                            {isMyPet ? (
                              <button
                                type="button"
                                className="pepito-pet-diary-delete"
                                aria-label="حذف خاطره"
                                disabled={diaryBusy}
                                onClick={() => void onDeleteDiary(entry.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </header>
                          <p>{entry.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </LandingChrome>
  );
}
