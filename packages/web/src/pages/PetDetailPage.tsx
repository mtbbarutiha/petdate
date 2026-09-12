import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  FileText,
  Heart,
  Pencil,
  Share2,
  Stethoscope,
} from 'lucide-react';
import { PetDiaryBook } from '../components/PetDiaryBook';
import type {
  PetDiaryEntry,
  PetMedicalEntry,
  PetMedicalRecord,
  PetProfile,
  Prescription,
} from '@petdate/shared';
import {
  PET_MEDICAL_FIELD_LABELS,
  petPublicIdOf,
  type PetMedicalField,
  toPersianDigits,
  userPublicIdOf,
} from '@petdate/shared';
import { PublicIdBadge } from '../components/PublicIdBadge';
import { formatAge } from '../data/mock';
import { EMPTY_STATE_PHOTO } from '../data/petImages';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { useAppToast } from '../hooks/useAppToast';
import {
  addPetWishlistTarget,
  createPetDiaryEntry,
  deletePetDiaryEntry,
  getPet,
  getPetMedical,
  listPetDiary,
  listPetPrescriptions,
  listPetWishlist,
  listPets,
  prescriptionPdfUrl,
  prescriptionWebPath,
  removePetWishlistTarget,
} from '../lib/api';
import { petProfileToUiPet } from '../lib/playdateMap';
import { sendPlaymateRequestNow } from '../lib/playmateActions';
import { petPublicUrl, shareOrCopyUrl } from '../lib/share';
import { PET_TYPE_LABELS } from '../types';

const MED_FIELDS = Object.keys(PET_MEDICAL_FIELD_LABELS) as PetMedicalField[];

export function PetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, isLoggedIn } = useAuthStore();
  const { t } = useI18n();
  const { toastSuccess, toastError, toastInfo } = useAppToast();
  const petId = Number(id);

  const [pet, setPet] = useState<PetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [myPets, setMyPets] = useState<PetProfile[]>([]);
  const [showPickFrom, setShowPickFrom] = useState(false);
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  const [record, setRecord] = useState<PetMedicalRecord | null>(null);
  const [entries, setEntries] = useState<PetMedicalEntry[]>([]);
  const [rxList, setRxList] = useState<Prescription[]>([]);
  const [medicalError, setMedicalError] = useState('');
  const [wishlist, setWishlist] = useState<PetProfile[]>([]);
  const [wishBusy, setWishBusy] = useState(false);
  const [diary, setDiary] = useState<PetDiaryEntry[]>([]);
  const [diaryBody, setDiaryBody] = useState('');
  const [diaryBusy, setDiaryBusy] = useState(false);

  const myUserId = authUser?.id;
  const isMyPet = Boolean(
    myUserId != null && pet != null && Number(pet.ownerId) === Number(myUserId)
  );
  // Prefer #pet-medical — hash is not part of the CDN cache key; www still
  // poisoned `?tab=medical` 404 responses from before the nginx SPA fallback.
  const tabMedical =
    searchParams.get('tab') === 'medical' || location.hash === '#pet-medical';
  const tabDiary = location.hash === '#pet-diary';

  const ui = useMemo(() => (pet ? petProfileToUiPet(pet) : null), [pet]);

  const loadPet = useCallback(async () => {
    if (!Number.isFinite(petId) || petId <= 0) {
      setPet(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getPet(petId);
      setPet(row);
      if (!row) setError('پت پیدا نشد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری پت ناموفق بود');
      setPet(null);
    } finally {
      setLoading(false);
    }
  }, [petId]);

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
    if (!myUserId) {
      setMyPets([]);
      return;
    }
    void listPets({ ownerId: myUserId })
      .then(setMyPets)
      .catch(() => setMyPets([]));
  }, [myUserId]);

  useEffect(() => {
    // Only the owner loads the medical dossier on this page (vets use chat tools).
    // Avoid 403→WCDN-HTML→raw JSON parse errors for other logged-in viewers.
    if (!pet || !myUserId || !isMyPet) {
      setRecord(null);
      setEntries([]);
      setRxList([]);
      if (pet && tabMedical && (!myUserId || !isMyPet)) {
        setMedicalError('دسترسی به پرونده پزشکی را نداری.');
      } else {
        setMedicalError('');
      }
      return;
    }
    let cancelled = false;
    void getPetMedical(pet.id, myUserId)
      .then((data) => {
        if (cancelled) return;
        setRecord(data.record);
        setEntries(data.entries || []);
        setMedicalError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setRecord(null);
        setEntries([]);
        const raw = err instanceof Error ? err.message : '';
        setMedicalError(
          raw && !/Unexpected token|DOCTYPE|is not valid JSON/i.test(raw)
            ? raw
            : 'بارگذاری پرونده پزشکی ناموفق بود. لطفاً دوباره تلاش کن.'
        );
      });
    void listPetPrescriptions(pet.id, myUserId)
      .then((rows) => {
        if (!cancelled) setRxList(rows);
      })
      .catch(() => {
        if (!cancelled) setRxList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pet, myUserId, isMyPet, tabMedical]);

  useEffect(() => {
    if (!pet || !isMyPet) {
      setDiary([]);
      return;
    }
    void loadDiary(pet.slug || pet.id);
  }, [pet, isMyPet, loadDiary]);

  useEffect(() => {
    if (!tabMedical || loading || !pet) return;
    const t = window.setTimeout(() => {
      document.getElementById('pet-medical')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [tabMedical, loading, pet, isMyPet, medicalError]);

  useEffect(() => {
    if (!tabDiary || loading || !pet || !isMyPet) return;
    const t = window.setTimeout(() => {
      document.getElementById('pet-diary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [tabDiary, loading, pet, isMyPet]);

  useEffect(() => {
    if (!pet || !isMyPet) {
      setWishlist([]);
      return;
    }
    void listPetWishlist(pet.id)
      .then(setWishlist)
      .catch(() => setWishlist([]));
  }, [pet, isMyPet]);

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
      setError(msg); toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  function onRequestClick() {
    if (!isLoggedIn || !myUserId) {
      navigate('/auth/login');
      return;
    }
    if (alreadyRequested || busy) return;
    if (myPets.length === 0) {
      const msg = 'اول یک پت ثبت کن'; setError(msg); toastError(msg);
      return;
    }
    if (myPets.length === 1) {
      void sendFrom(myPets[0]!.id);
      return;
    }
    setShowPickFrom(true);
  }

  async function toggleWish(target: PetProfile) {
    if (!pet || !myUserId || !isMyPet) return;
    setWishBusy(true);
    try {
      const exists = wishlist.some((w) => w.id === target.id);
      if (exists) {
        await removePetWishlistTarget(pet.id, target.id, myUserId);
        setWishlist((rows) => rows.filter((w) => w.id !== target.id));
      } else {
        await addPetWishlistTarget(pet.id, target.id, myUserId);
        setWishlist((rows) => [...rows, target]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ویش‌لیست به‌روز نشد'; setError(msg); toastError(msg);
    } finally {
      setWishBusy(false);
    }
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

  if (loading) {
    return (
      <div className="pepito-pet-profile">
        <p>در حال بارگذاری…</p>
      </div>
    );
  }

  if (!pet || !ui) {
    return (
      <div className="pepito-pet-profile pepito-pet-profile--empty">
        <img src={EMPTY_STATE_PHOTO} alt="" className="empty-photo" />
        <h3>پت پیدا نشد</h3>
        <Link to="/my-pets" className="pepito-btn button-1">
          پت‌های من
        </Link>
      </div>
    );
  }

  const traits = Array.isArray((pet.personality as { traits?: string[] })?.traits)
    ? (pet.personality as { traits: string[] }).traits
    : [];
  const photoPending =
    isMyPet && (pet.photoModerationStatus ?? 'approved') === 'pending' && Boolean(pet.imageUrl);
  const photo = ui.imageUrl || '/brand/photo-placeholder.svg';
  return (
    <div
      className={`pepito-pet-profile${tabMedical ? ' is-medical-focus' : ''}${tabDiary ? ' is-diary-focus' : ''}`}
    >
      {photoPending ? (
        <div className="pepito-photo-pending" role="status" data-testid="photo-pending-banner">
          <p>{t('moderation.bannerPet')}</p>
        </div>
      ) : null}
      <div className="pepito-pet-profile-hero">
        <img src={photo} alt={pet.name} onError={(e) => {
          const img = e.currentTarget;
          if (img.src !== EMPTY_STATE_PHOTO) img.src = EMPTY_STATE_PHOTO;
        }} />
        <div className="pepito-pet-profile-hero-wash" aria-hidden />
        <div className="pepito-pet-profile-hero-bar">
          <button type="button" className="icon-btn icon-btn--glass" onClick={() => navigate(-1)} aria-label="بازگشت">
            <ArrowRight size={20} />
          </button>
          <div className="pepito-pet-profile-hero-title">
            <p className="pepito-pet-profile-hero-brand">پت‌دیت</p>
            <h1>{pet.name}</h1>
          </div>
          <div className="pepito-pet-profile-hero-actions">
            {isMyPet ? (
              <Link to={`/pets/${pet.id}/edit`} className="icon-btn icon-btn--glass" aria-label="ویرایش">
                <Pencil size={18} />
              </Link>
            ) : (
              <button
                type="button"
                className="icon-btn icon-btn--glass"
                aria-label="علاقه‌مندی پت"
                disabled={wishBusy || myPets.length === 0}
                onClick={() => {
                  if (myPets.length === 1) void toggleWish(pet);
                  else toastInfo('از پروفایل پت خودت ویش‌لیست را مدیریت کن');
                }}
              >
                <Heart size={18} />
              </button>
            )}
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
        <div className="pepito-pet-profile-hero-meta">
          <p className="pepito-pet-profile-sub">
            {PET_TYPE_LABELS[ui.type] || pet.species} · {formatAge(ui)}
            {pet.breed ? ` · ${pet.breed}` : ''}
          </p>
          <p className="pepito-pet-profile-loc">
            {[pet.neighborhood, pet.city || pet.ownerCity].filter(Boolean).join('، ') || '—'}
          </p>
        </div>
      </div>

      <div className="pepito-pet-profile-body">
        <div className="pepito-pet-profile-ids" aria-label="شناسه‌های پت">
          <PublicIdBadge label="شناسه پت:" value={petPublicIdOf(pet)} />
          {pet.ownerId ? (
            <PublicIdBadge
              label="شناسه صاحب پت:"
              value={userPublicIdOf({ id: pet.ownerId })}
            />
          ) : null}
        </div>

        {isMyPet ? (
          <div className="pepito-pet-profile-owner-actions">
            <Link to={`/pets/${pet.id}/edit`} className="pepito-btn button-2">
              <Pencil size={16} aria-hidden />
              ویرایش پروفایل پت
            </Link>
            <a href="#pet-diary" className="pepito-btn button-2">
              <BookOpen size={16} aria-hidden />
              دفتر خاطرات
            </a>
            <a href="#pet-medical" className="pepito-btn button-1">
              <Stethoscope size={16} aria-hidden />
              پرونده پزشکی
            </a>
          </div>
        ) : null}

        {pet.bio ? <p className="pepito-pet-profile-bio">{pet.bio}</p> : null}

        <div className="pepito-pet-profile-tags">
          {traits.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          {pet.vaccinated ? <span className="tag green">واکسینه</span> : null}
          {pet.neutered ? <span className="tag green">عقیم</span> : null}
          {pet.lookingForPlaymate ? <span className="tag blue">دنبال همبازی</span> : null}
        </div>

        {!isMyPet ? (
          <div className="pepito-pet-profile-cta">
            <button
              type="button"
              className="pepito-btn button-1"
              disabled={busy || alreadyRequested}
              onClick={onRequestClick}
            >
              {alreadyRequested ? 'درخواست ارسال شده' : 'درخواست همبازی'}
            </button>
          </div>
        ) : null}

        {showPickFrom ? (
          <div className="pepito-pet-profile-pick">
            <p>از طرف کدوم پت؟</p>
            {myPets.map((p) => (
              <button key={p.id} type="button" className="pepito-btn button-2" onClick={() => void sendFrom(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="auth-error">{error}</p> : null}

        {tabMedical && !isMyPet && medicalError ? (
          <section id="pet-medical" className="pepito-pet-medical" aria-label="پرونده پزشکی">
            <header className="pepito-pet-medical-head">
              <Stethoscope size={20} aria-hidden />
              <div>
                <h2>پرونده پزشکی</h2>
                <p>فقط صاحب پت می‌تواند این بخش را ببیند.</p>
              </div>
            </header>
            <p className="pepito-pet-medical-muted" role="alert">
              {medicalError}
            </p>
          </section>
        ) : null}

        {isMyPet ? (
          <PetDiaryBook
            id="pet-diary"
            petName={pet.name}
            photo={photo}
            entries={diary}
            canWrite
            body={diaryBody}
            busy={diaryBusy}
            textareaId="owner-pet-diary-body"
            backHref={tabDiary ? `/pets/${pet.id}` : undefined}
            onBodyChange={setDiaryBody}
            onSubmit={onSubmitDiary}
            onDelete={onDeleteDiary}
          />
        ) : null}

        {isMyPet ? (
          <section id="pet-medical" className="pepito-pet-medical" aria-label="پرونده پزشکی">
            <header className="pepito-pet-medical-head">
              <Stethoscope size={20} aria-hidden />
              <div>
                <h2>پرونده پزشکی</h2>
                <p>خلاصه سلامت + یادداشت پزشکان + نسخه‌ها — پزشک بعدی هم می‌بیند.</p>
              </div>
            </header>

            {medicalError && !record ? (
              <p className="pepito-pet-medical-muted" role="alert">
                {medicalError || 'پرونده در دسترس نیست'}
              </p>
            ) : (
              <>
                <div className="pepito-pet-medical-cards">
                  {MED_FIELDS.map((field) => {
                    const value = record?.[field];
                    return (
                      <article key={field} className="pepito-pet-medical-card">
                        <h3>{PET_MEDICAL_FIELD_LABELS[field]}</h3>
                        <p>{value || 'هنوز ثبت نشده'}</p>
                      </article>
                    );
                  })}
                </div>

                {record?.lastUpdatedByName ? (
                  <p className="pepito-pet-medical-meta">
                    آخرین به‌روزرسانی توسط {record.lastUpdatedByName}
                    {record.updatedAt ? ` · ${toPersianDigits(record.updatedAt.slice(0, 10))}` : ''}
                  </p>
                ) : null}

                <div className="pepito-pet-medical-entries">
                  <h3>یادداشت‌های بالینی</h3>
                  {entries.length === 0 ? (
                    <p className="pepito-pet-medical-muted">
                      هنوز یادداشتی نیست — پزشک از چت مشاوره ثبت می‌کند.
                    </p>
                  ) : (
                    <ul>
                      {entries.map((e) => (
                        <li key={e.id} className="pepito-pet-medical-entry">
                          <header>
                            <strong>{e.authorName || `پزشک #${e.authorUserId}`}</strong>
                            <time>{toPersianDigits(e.createdAt.slice(0, 16).replace('T', ' '))}</time>
                          </header>
                          <p>{e.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pepito-pet-medical-rx">
                  <h3>
                    <FileText size={16} aria-hidden /> نسخه‌ها
                  </h3>
                  {rxList.length === 0 ? (
                    <p className="pepito-pet-medical-muted">نسخه‌ای ثبت نشده.</p>
                  ) : (
                    <ul>
                      {rxList.map((rx) => (
                        <li key={rx.id} className="pepito-pet-medical-rx-card">
                          <strong>نسخه {toPersianDigits(String(rx.id))}</strong>
                          <p>
                            {rx.text.slice(0, 160)}
                            {rx.text.length > 160 ? '…' : ''}
                          </p>
                          <div className="pepito-pet-medical-rx-links">
                            <a href={prescriptionWebPath(rx.id)} target="_blank" rel="noreferrer">
                              مشاهده
                            </a>
                            <a href={prescriptionPdfUrl(rx.id)} target="_blank" rel="noreferrer">
                              PDF
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>
        ) : null}

        {isMyPet ? (
          <section className="pepito-pet-wishlist" aria-label="ویش‌لیست پت">
            <header>
              <h2>ویش‌لیست این پت</h2>
              <p>جدا از علاقه‌مندی‌های حساب کاربری — مخصوص همین پت.</p>
            </header>
            {wishlist.length === 0 ? (
              <p className="pepito-pet-medical-muted">هنوز پتی به ویش‌لیست اضافه نشده.</p>
            ) : (
              <ul className="pepito-pet-wishlist-grid">
                {wishlist.map((w) => (
                  <li key={w.id}>
                    <Link to={`/pets/${w.id}`}>{w.name}</Link>
                    <button type="button" onClick={() => void removePetWishlistTarget(pet.id, w.id, myUserId!).then(() => setWishlist((rows) => rows.filter((x) => x.id !== w.id)))}>
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
