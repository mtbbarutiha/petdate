import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  GraduationCap,
  LogOut,
  MapPin,
  PawPrint,
  Pencil,
  Stethoscope,
  X,
} from 'lucide-react';
import {
  BRAND,
  FACE_VERIFY_REWARD,
  IRAN_PROVINCES,
  ONBOARDING_STATUS_LABELS,
  PHOTO_MODERATION_STATUS_LABELS,
  PROFILE_INTEREST_OPTIONS,
  USER_GENDER_LABELS,
  USER_ROLE_LABELS,
  buildProfileCardLines,
  citiesForProvince,
  computeProfileCompletion,
  faceVerifyButtonLabel,
  formatFaInt,
  normalizeRoles,
  parseUserAge,
  primaryRole,
  profileGenderEmoji,
  profileLanguageCode,
  profileVerifyStatusLabel,
  toPersianDigits,
  userDisplayPublicId,
  petPublicIdOf,
  userHasRole,
  type User,
  type UserGender,
} from '@petdate/shared';
import { AgePicker } from '../components/AgePicker';
import { InviteFriendsCard } from '../components/InviteFriendsCard';
import { PetAvatar } from '../components/PetAvatar';
import { ProfileAvatarEditor } from '../components/ProfileAvatarEditor';
import { PublicIdBadge } from '../components/PublicIdBadge';
import { RoleSwitchControl } from '../components/RoleSwitchControl';
import { formatAge } from '../data/mock';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useMyPets } from '../hooks/useMyPets';
import { useI18n } from '../i18n';
import {
  deleteUserAccountById,
  fetchProfileCard,
  listUserBlocks,
  listUserContacts,
  patchWebAcceptSeekerAdvice,
  patchWebProfile,
  resolvePublicMediaUrl,
  submitWebFaceVerification,
} from '../lib/api';
import { petProfileToUiPet } from '../lib/playdateMap';
import { PET_TYPE_LABELS } from '../types';

const HERO_IMG = '/pepito/uploads/2.jpg';

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

type PanelKind = 'contacts' | 'likes' | 'interactions' | 'blocked' | 'account' | 'verify' | null;

export function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('edit') === '1';
  const panelParam = searchParams.get('panel');
  const { user, token, logout, isProfileComplete, saveProfile, refreshMe } = useAuthStore();
  const { toastSuccess, toastError } = useAppToast();
  const { t, lang } = useI18n();
  const { pets: myPets, loading: petsLoading } = useMyPets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cardUser, setCardUser] = useState<User | null>(null);
  const [interactions, setInteractions] = useState<{
    likes: number;
    views: number;
    playdatesTotal: number;
    playdatesPending: number;
    playdatesAccepted: number;
  } | null>(null);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [panelLines, setPanelLines] = useState<string[]>([]);
  const [panelBusy, setPanelBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const verifyFileRef = useRef<HTMLInputElement>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<UserGender | ''>('');
  const [country, setCountry] = useState('ایران');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setAge(user.age ? String(user.age) : '');
    setGender(user.gender ?? '');
    setCountry(user.country ?? 'ایران');
    setProvince(user.province ?? '');
    setCity(user.city ?? '');
    setBio(user.bio ?? '');
    setInterests(user.interests ?? []);
    setError('');
  }, [user, editing]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const card = await fetchProfileCard(user.id);
        if (cancelled) return;
        setCardUser(card.user);
        setInteractions(card.extras?.interactions ?? null);
      } catch {
        if (!cancelled) setCardUser(user);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const cities = useMemo(() => (province ? citiesForProvince(province) : []), [province]);

  // Deep-link panels from sidebar / avatar menu (?panel=…)
  useEffect(() => {
    if (!user || editing) {
      if (editing) {
        setPanel(null);
        setPanelLines([]);
      }
      return;
    }
    const allowed: Exclude<PanelKind, null>[] = [
      'contacts',
      'likes',
      'interactions',
      'blocked',
      'account',
      'verify',
    ];
    if (!panelParam || !(allowed as string[]).includes(panelParam)) {
      setPanel(null);
      setPanelLines([]);
      return;
    }
    const kind = panelParam as Exclude<PanelKind, null>;
    setPanel(kind);
    const displayUser = cardUser ?? user;
    const likesCount = displayUser.likesCount ?? 0;
    const verifyStatus = displayUser.verificationStatus ?? 'none';
    const rewardLabel = lang === 'en' ? String(FACE_VERIFY_REWARD) : formatFaInt(FACE_VERIFY_REWARD);
    let cancelled = false;

    void (async () => {
      if (kind === 'account') {
        setPanelLines([]);
        setPanelBusy(false);
        return;
      }
      if (kind === 'likes') {
        setPanelLines([
          `تعداد لایک دریافتی: ${formatFaInt(likesCount)}`,
          'لایک‌ها از بازدید و تعامل دیگران روی پروفایل/پت جمع می‌شود.',
        ]);
        setPanelBusy(false);
        return;
      }
      if (kind === 'interactions') {
        setPanelLines([
          `❤️ لایک: ${formatFaInt(interactions?.likes ?? likesCount)}`,
          `👁️ بازدید: ${formatFaInt(interactions?.views ?? displayUser.profileViews ?? 0)}`,
          `🐾 درخواست همبازی: ${formatFaInt(interactions?.playdatesTotal ?? 0)}`,
          `⏳ در انتظار: ${formatFaInt(interactions?.playdatesPending ?? 0)}`,
          `✅ پذیرفته: ${formatFaInt(interactions?.playdatesAccepted ?? 0)}`,
        ]);
        setPanelBusy(false);
        return;
      }
      if (kind === 'verify') {
        setPanelLines([
          faceVerifyButtonLabel(verifyStatus),
          verifyStatus === 'verified'
            ? t('verify.profileVerified', { n: rewardLabel })
            : verifyStatus === 'pending'
              ? t('verify.profilePending', { n: rewardLabel })
              : t('verify.profileIntro', { n: rewardLabel }),
        ]);
        setVerifyError('');
        setPanelBusy(false);
        return;
      }
      if (kind === 'blocked') {
        setPanelBusy(true);
        setPanelLines([]);
        try {
          const list = await listUserBlocks(user.id);
          if (cancelled) return;
          setPanelLines(
            list.length
              ? list.map(
                  (b, i) =>
                    `${formatFaInt(i + 1)}. ${b.blockedName || 'بدون نام'}${
                      b.blockedUsername ? ` @${b.blockedUsername}` : ''
                    }`
                )
              : ['لیست بلاک خالی است.']
          );
        } catch {
          if (!cancelled) setPanelLines(['لیست بلاک در دسترس نیست.']);
        } finally {
          if (!cancelled) setPanelBusy(false);
        }
        return;
      }
      if (kind === 'contacts') {
        setPanelBusy(true);
        setPanelLines([]);
        try {
          const list = await listUserContacts(user.id);
          if (cancelled) return;
          setPanelLines(
            list.length
              ? list.map(
                  (c, i) =>
                    `${formatFaInt(i + 1)}. ${c.contactName || 'بدون نام'}${
                      c.contactUsername ? ` @${c.contactUsername}` : ''
                    }`
                )
              : ['هنوز مخاطبی نداری. از چت همبازی می‌تونی اضافه کنی.']
          );
        } catch {
          if (!cancelled) setPanelLines(['لیست مخاطبین در دسترس نیست.']);
        } finally {
          if (!cancelled) setPanelBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, editing, panelParam, cardUser, interactions, t, lang]);

  if (!user) return null;

  const userId = user.id;
  const display = cardUser ?? user;
  const cardLines = buildProfileCardLines(display);
  const completion = computeProfileCompletion(display);
  const onboardingLabel = !display.onboarding
    ? 'شروع نشده'
    : ONBOARDING_STATUS_LABELS[display.onboarding] ?? display.onboarding;
  const mainRole = primaryRole(normalizeRoles(display.roles, display.role), display.role);
  const needsWizard = !isProfileComplete;
  const isPetOwner = userHasRole(display, 'pet_owner');
  // Same pets as /my-pets: show block for owners OR whenever API returned pets
  // (e.g. multi-role users whose card lags roles briefly).
  const showPetsBlock = isPetOwner || myPets.length > 0 || petsLoading;
  const locationLabel = [display.city, display.province, display.country].filter(Boolean).join('، ') || '—';
  const avatarSrc = resolvePublicMediaUrl(display.avatarUrl);
  const genderPlain =
    display.gender === 'male' ? 'آقا' : display.gender === 'female' ? 'خانم' : null;
  const likes = display.likesCount ?? 0;
  const contactsCount = display.contactsCount ?? 0;
  const views = interactions?.views ?? display.profileViews ?? 0;
  const coins = display.coins ?? 0;
  const verifyStatus = display.verificationStatus ?? 'none';
  const ageLabel =
    display.age != null && Number(display.age) > 0 ? toPersianDigits(display.age) : null;
  const interestsLabel =
    display.interests && display.interests.length > 0
      ? display.interests.join(' · ')
      : 'هنوز انتخاب نشده';
  const publicId = userDisplayPublicId(display);
  const hasAboutMeta =
    Boolean(ageLabel) || Boolean(genderPlain) || locationLabel !== '—' || Boolean(display.phone);
  const roleLabel = mainRole ? USER_ROLE_LABELS[mainRole] : null;
  const metaBits = [
    ageLabel ? `${ageLabel} ساله` : null,
    genderPlain,
    profileLanguageCode(display),
  ].filter(Boolean);

  function openEdit() {
    setSearchParams({ edit: '1' }, { replace: false });
    setPanel(null);
    setPanelLines([]);
  }
  function closeEdit() {
    setSearchParams({}, { replace: true });
    setError('');
  }
  function closePanel() {
    setPanel(null);
    setPanelLines([]);
    if (searchParams.get('panel')) {
      const next = new URLSearchParams(searchParams);
      next.delete('panel');
      setSearchParams(next, { replace: true });
    }
  }
  function openPanelParam(kind: Exclude<PanelKind, null>) {
    setSearchParams({ panel: kind }, { replace: false });
  }
  function toggleInterest(item: string) {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item].slice(0, 6)
    );
  }
  async function onLogout() {
    setBusy(true);
    await logout();
    navigate('/auth/login', { replace: true });
  }
  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setError('نام را درست وارد کن'); toastError('نام را درست وارد کن'); return; }
    const ageNum = parseUserAge(age);
    if (ageNum == null) { setError('سن معتبر نیست'); toastError('سن معتبر نیست'); return; }
    if (!gender) { setError('جنسیت را انتخاب کن'); toastError('جنسیت را انتخاب کن'); return; }
    if (!country.trim()) { setError('کشور را مشخص کن'); toastError('کشور را مشخص کن'); return; }
    if (country === 'ایران' && !province) { setError('استان را انتخاب کن'); toastError('استان را انتخاب کن'); return; }
    if (city.trim().length < 2) { setError('شهر را وارد کن'); toastError('شهر را وارد کن'); return; }
    setBusy(true);
    setError('');
    try {
      await saveProfile({
        name: name.trim(),
        age: ageNum,
        gender,
        country,
        province: country === 'ایران' ? province : undefined,
        city: city.trim(),
        bio: bio.trim() || undefined,
        interests,
        onboarding: 'profile_complete',
      });
      toastSuccess('ذخیره شد');
      closeEdit();
      await refreshMe();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ذخیره پروفایل ناموفق بود'; setError(msg); toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function openContacts() {
    openPanelParam('contacts');
  }
  function openLikes() {
    openPanelParam('likes');
  }
  function openInteractions() {
    openPanelParam('interactions');
  }
  async function submitFaceVerify(opts: { file?: File; useAvatar?: boolean }) {
    if (!token) {
      toastError('وارد نشده‌اید');
      return;
    }
    setVerifyBusy(true);
    setVerifyError('');
    try {
      const res = await submitWebFaceVerification(token, {
        file: opts.file,
        photoUrl: opts.useAvatar ? display.avatarUrl : undefined,
      });
      setCardUser(res.user);
      await refreshMe();
      toastSuccess('درخواست احراز ثبت شد — در صف بررسی ادمین است');
      setPanelLines([
        faceVerifyButtonLabel(res.user.verificationStatus ?? 'pending'),
        'درخواست احراز در صف بررسی است — به‌محض تأیید، ۱۰۰ سکه جایزه واریز می‌شود.',
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ارسال احراز ناموفق بود';
      setVerifyError(msg);
      toastError(msg);
    } finally {
      setVerifyBusy(false);
      if (verifyFileRef.current) verifyFileRef.current.value = '';
    }
  }
  async function deactivateAccount() {
    if (!token) return;
    setBusy(true);
    try {
      await patchWebProfile(token, { isActive: false });
      await refreshMe();
      closePanel();
      toastSuccess('حساب غیرفعال شد.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'غیرفعال‌سازی ناموفق بود'; setError(msg); toastError(msg);
    } finally {
      setBusy(false);
    }
  }
  async function activateAccount() {
    if (!token) return;
    setBusy(true);
    try {
      await patchWebProfile(token, { isActive: true });
      await refreshMe();
      closePanel();
      toastSuccess('حساب فعال شد.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فعال‌سازی ناموفق بود'; setError(msg); toastError(msg);
    } finally {
      setBusy(false);
    }
  }
  async function deleteAccount() {
    if (!window.confirm('مطمئنی حساب حذف شود؟ این کار برگشت‌پذیر نیست.')) return;
    setBusy(true);
    try {
      await deleteUserAccountById(userId);
      await logout();
      navigate('/auth/login', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حذف حساب ناموفق بود'; setError(msg); toastError(msg);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="pepito-profile pepito-profile--edit">
        <header className="pepito-profile-edit-head">
          <div>
            <p className="pepito-eyebrow">{BRAND.displayName}</p>
            <h1>ویرایش پروفایل</h1>
            <p>هر بخش را جداگانه پر کن؛ در پایان ذخیره کن.</p>
          </div>
          <button type="button" className="pepito-profile-icon-btn" onClick={closeEdit} aria-label="انصراف">
            <X size={20} strokeWidth={2} />
          </button>
        </header>
        <form className="pepito-profile-edit-form" onSubmit={(e) => void onSave(e)} noValidate>
          <section className="pepito-profile-edit-section pepito-profile-edit-section--photo" aria-label="عکس پروفایل">
            <div className="pepito-profile-edit-section-head">
              <span className="pepito-profile-edit-step" aria-hidden>۱</span>
              <div>
                <h2 className="pepito-profile-edit-section-title">عکس پروفایل</h2>
                <p className="pepito-profile-edit-section-desc">چهره یا پت‌ات را واضح نشان بده.</p>
              </div>
            </div>
            <div className="pepito-profile-edit-avatar-block">
              <ProfileAvatarEditor imageUrl={avatarSrc} name={user.name} size="xl" />
              <p className="pepito-profile-edit-avatar-hint">برای تغییر عکس، روی آیکون دوربین بزن.</p>
            </div>
          </section>

          <section className="pepito-profile-edit-section" aria-label="مشخصات">
            <div className="pepito-profile-edit-section-head">
              <span className="pepito-profile-edit-step" aria-hidden>۲</span>
              <div>
                <h2 className="pepito-profile-edit-section-title">مشخصات</h2>
                <p className="pepito-profile-edit-section-desc">نام، سن و جنسیت.</p>
              </div>
            </div>
            <div className="pepito-profile-edit-grid">
              <label className="pepito-field">
                <span>نام نمایشی</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </label>
              <div className="pepito-field">
                <span>سن</span>
                <AgePicker value={age} onChange={setAge} />
              </div>
              <div className="pepito-field pepito-field--full">
                <span>جنسیت</span>
                <div className="pepito-choice-row" role="group" aria-label="جنسیت">
                  {(['male', 'female'] as UserGender[]).map((g) => (
                    <button key={g} type="button" className={`pepito-choice${gender === g ? ' is-on' : ''}`} onClick={() => setGender(g)}>
                      {USER_GENDER_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="pepito-profile-edit-section" aria-label="موقعیت">
            <div className="pepito-profile-edit-section-head">
              <span className="pepito-profile-edit-step" aria-hidden>۳</span>
              <div>
                <h2 className="pepito-profile-edit-section-title">موقعیت</h2>
                <p className="pepito-profile-edit-section-desc">کشور، استان و شهر.</p>
              </div>
            </div>
            <div className="pepito-profile-edit-grid">
              <div className="pepito-field pepito-field--full">
                <span>کشور</span>
                <div className="pepito-choice-row" role="group" aria-label="کشور">
                  {['ایران', 'سایر'].map((c) => (
                    <button key={c} type="button" className={`pepito-choice${country === c ? ' is-on' : ''}`} onClick={() => { setCountry(c); if (c !== 'ایران') setProvince(''); }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {country === 'ایران' ? (
                <label className="pepito-field">
                  <span>استان</span>
                  <select value={province} onChange={(e) => setProvince(e.target.value)} required>
                    <option value="">انتخاب استان</option>
                    {IRAN_PROVINCES.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </select>
                </label>
              ) : null}
              <label className={`pepito-field${country !== 'ایران' ? ' pepito-field--full' : ''}`}>
                <span>شهر</span>
                {cities.length > 0 ? (
                  <select value={city} onChange={(e) => setCity(e.target.value)} required>
                    <option value="">انتخاب شهر</option>
                    {cities.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                ) : (
                  <input value={city} onChange={(e) => setCity(e.target.value)} required />
                )}
              </label>
            </div>
          </section>

          <section className="pepito-profile-edit-section" aria-label="درباره">
            <div className="pepito-profile-edit-section-head">
              <span className="pepito-profile-edit-step" aria-hidden>۴</span>
              <div>
                <h2 className="pepito-profile-edit-section-title">درباره من</h2>
                <p className="pepito-profile-edit-section-desc">بیو و علایق (تا ۶ مورد).</p>
              </div>
            </div>
            <div className="pepito-profile-edit-grid">
              <label className="pepito-field pepito-field--full">
                <span>بیو</span>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="کمی از خودت و پت‌ات بگو…" />
              </label>
              <div className="pepito-field pepito-field--full">
                <span>علایق (تا ۶ مورد)</span>
                <div className="pepito-choice-wrap">
                  {PROFILE_INTEREST_OPTIONS.map((item) => (
                    <button key={item} type="button" className={`pepito-choice pepito-choice--sm${interests.includes(item) ? ' is-on' : ''}`} onClick={() => toggleInterest(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {error ? <p className="pepito-profile-error">{error}</p> : null}
          <div className="pepito-profile-edit-actions">
            <button type="submit" className="pepito-btn button-1" disabled={busy}>
              <PawIcon />
              {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
            <button type="button" className="pepito-btn pepito-btn--ghost" onClick={closeEdit} disabled={busy}>انصراف</button>
          </div>
        </form>
      </div>
    );
  }

  const panelTitle =
    panel === 'contacts' ? 'مخاطبین'
      : panel === 'likes' ? 'لایک‌ها'
        : panel === 'interactions' ? 'تعاملات'
          : panel === 'blocked' ? 'بلاک‌شده‌ها'
            : panel === 'account' ? 'حذف / غیرفعال‌سازی'
              : panel === 'verify' ? 'احراز چهره' : '';

  const supportLine =
    metaBits.length && locationLabel !== '—'
      ? `${metaBits.join('، ')} — ${locationLabel}`
      : metaBits.length
        ? metaBits.join('، ')
        : locationLabel !== '—'
          ? locationLabel
          : 'پروفایلت را کامل کن تا بهتر پیدا شوی.';

  return (
    <div className="pepito-profile pepito-profile--passport">
      <section
        className="pepito-profile-hero pepito-profile-hero--passport"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
        aria-label="پروفایل"
      >
        <div className="pepito-profile-hero-wash" aria-hidden />
        <div className="pepito-profile-hero-texture" aria-hidden />
        <div className="pepito-profile-hero-inner">
          <div className="pepito-profile-hero-toolbar">
            <p className="pepito-profile-brand">
              <PawPrint size={18} strokeWidth={2.25} aria-hidden />
              <span>{BRAND.displayName}</span>
            </p>
            <div className="pepito-profile-hero-cta">
              <button type="button" className="pepito-profile-hero-edit" onClick={openEdit}>
                <Pencil size={16} strokeWidth={2.25} aria-hidden />
                ویرایش
              </button>
              {needsWizard ? (
                <Link to="/onboarding/profile" className="pepito-profile-hero-complete">
                  تکمیل
                </Link>
              ) : null}
            </div>
          </div>

          <div className="pepito-profile-identity">
            <ProfileAvatarEditor imageUrl={avatarSrc} name={display.name} size="xl" />
            <div className="pepito-profile-identity-text">
              <h1>
                <span className="pepito-profile-name-emoji" aria-hidden>
                  {profileGenderEmoji(display.gender)}
                </span>
                {display.name || 'پروفایل من'}
              </h1>
              <p className="pepito-profile-support">{supportLine}</p>
              {roleLabel ? (
                <p className="pepito-profile-role-line">
                  <PawPrint size={14} aria-hidden />
                  {roleLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {display.isActive === false ? (
        <p className="pepito-profile-inactive-banner" role="status">
          حساب فعلاً غیرفعال است
        </p>
      ) : null}

      <section className="pepito-profile-pulse" aria-label="وضعیت و آمار">
        <div className="pepito-profile-completion" aria-label={cardLines.completion}>
          <div className="pepito-profile-completion-top">
            <span>تکمیل پروفایل</span>
            <strong>{toPersianDigits(completion.percent)}٪</strong>
          </div>
          <span className="pepito-profile-completion-bar pepito-profile-completion-bar--soft" aria-hidden>
            <span style={{ width: `${completion.percent}%` }} />
          </span>
        </div>
        <div className="pepito-profile-stats pepito-profile-stats--type" role="list">
          <button type="button" className="pepito-profile-stat" onClick={openLikes} role="listitem">
            <strong>{formatFaInt(likes)}</strong>
            <span>لایک</span>
          </button>
          <button type="button" className="pepito-profile-stat" onClick={openInteractions} role="listitem">
            <strong>{formatFaInt(views)}</strong>
            <span>بازدید</span>
          </button>
          <Link to="/wallet" className="pepito-profile-stat" aria-label={cardLines.walletViews} role="listitem">
            <strong>{formatFaInt(coins)}</strong>
            <span>سکه</span>
          </Link>
          <button
            type="button"
            className="pepito-profile-stat"
            onClick={() => void openContacts()}
            role="listitem"
          >
            <strong>{contactsCount > 0 ? formatFaInt(contactsCount) : '−'}</strong>
            <span>مخاطب</span>
          </button>
        </div>
      </section>

      <div className="pepito-profile-layout">
        <div className="pepito-profile-maincol">
          <section className="pepito-profile-block pepito-profile-about" aria-label="درباره">
            <header className="pepito-profile-section-head">
              <h2>درباره من</h2>
              <p>بیو، مشخصات و شناسه قابل کپی</p>
            </header>
            <div className="pepito-profile-about-panel">
              <div className="pepito-profile-about-lead">
                {display.bio ? (
                  <p className="pepito-profile-bio">{display.bio}</p>
                ) : (
                  <p className="pepito-profile-bio pepito-profile-bio--empty">
                    هنوز بیویی ننوشتی — از ویرایش اضافه کن.
                  </p>
                )}
                {display.interests && display.interests.length > 0 ? (
                  <ul className="pepito-profile-tags" aria-label="علایق">
                    {display.interests.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="pepito-profile-bio pepito-profile-bio--empty">علایق: {interestsLabel}</p>
                )}
              </div>

              {hasAboutMeta ? (
                <dl className="pepito-profile-about-meta" aria-label="شناسنامه">
                  {ageLabel ? (
                    <div>
                      <dt>سن</dt>
                      <dd>{ageLabel} ساله</dd>
                    </div>
                  ) : null}
                  {genderPlain ? (
                    <div>
                      <dt>جنسیت</dt>
                      <dd>{genderPlain}</dd>
                    </div>
                  ) : null}
                  {locationLabel !== '—' ? (
                    <div>
                      <dt>موقعیت</dt>
                      <dd>
                        <MapPin size={14} aria-hidden />
                        {locationLabel}
                      </dd>
                    </div>
                  ) : null}
                  {display.phone ? (
                    <div>
                      <dt>تلفن</dt>
                      <dd dir="ltr">{display.phone}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              <div className="pepito-profile-status-row" aria-label="وضعیت">
                <span className={`pepito-profile-badge${needsWizard ? ' is-warn' : ' is-ok'}`}>
                  {onboardingLabel}
                </span>
                <span
                  className={`pepito-profile-badge${
                    verifyStatus === 'verified' ? ' is-ok' : verifyStatus === 'pending' ? ' is-warn' : ''
                  }`}
                >
                  {profileVerifyStatusLabel(verifyStatus)}
                </span>
                {display.avatarUrl ? (
                  <span
                    className={`pepito-profile-badge${
                      (display.avatarModerationStatus ?? 'approved') === 'approved'
                        ? ' is-ok'
                        : (display.avatarModerationStatus ?? 'approved') === 'pending'
                          ? ' is-warn'
                          : ' is-danger'
                    }`}
                    title="وضعیت تأیید عکس پروفایل"
                  >
                    {(display.avatarModerationStatus ?? 'approved') === 'pending'
                      ? 'عکس خودت در انتظار تأیید ادمین'
                      : `عکس: ${
                          PHOTO_MODERATION_STATUS_LABELS[
                            display.avatarModerationStatus ?? 'approved'
                          ]
                        }`}
                  </span>
                ) : null}
              </div>

              <div className="pepito-profile-about-foot">
                <PublicIdBadge
                  label="شناسه کاربر/صاحب پت:"
                  value={publicId}
                  className="pepito-profile-id-row"
                />
              </div>
            </div>
          </section>

          {showPetsBlock ? (
            <section className="pepito-profile-block pepito-profile-pets" aria-label="پت‌های من">
              <header className="pepito-profile-section-head pepito-profile-section-head--row">
                <div>
                  <h2>پت‌های من</h2>
                  <p>
                    {petsLoading
                      ? 'در حال بارگذاری…'
                      : myPets.length
                        ? `${toPersianDigits(String(myPets.length))} پت ثبت‌شده`
                        : 'هنوز پتی ثبت نشده'}
                  </p>
                </div>
                <Link to="/my-pets" className="pepito-profile-textlink">
                  همه پت‌ها
                </Link>
              </header>
              <div className="pepito-profile-pets-panel">
                {petsLoading ? (
                  <div className="pepito-profile-pet-cards pepito-profile-pet-cards--muted" aria-busy="true">
                    <div className="pepito-profile-pet-card is-skeleton" aria-hidden />
                  </div>
                ) : myPets.length === 0 ? (
                  <Link to="/add-pet" className="pepito-profile-pet-empty">
                    <PetAvatar type="dog" size="md" name="پت" />
                    <div>
                      <strong>اولین پت را اضافه کن</strong>
                      <span>پروفایل، ویرایش و پرونده پزشکی</span>
                    </div>
                    <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
                  </Link>
                ) : (
                  <ul className="pepito-profile-pet-cards">
                    {myPets.map((pet) => {
                      const ui = petProfileToUiPet(pet);
                      const petIdLabel = petPublicIdOf(pet);
                      return (
                        <li key={pet.id}>
                          <Link to={`/pets/${pet.id}`} className="pepito-profile-pet-card">
                            <span className="pepito-profile-pet-card-media" aria-hidden>
                              <PetAvatar type={ui.type} size="md" imageUrl={ui.imageUrl} name={pet.name} />
                            </span>
                            <div className="pepito-profile-pet-card-body">
                              <strong>{pet.name}</strong>
                              <span>
                                {[PET_TYPE_LABELS[ui.type] || pet.species, formatAge(ui)]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                              {pet.imageUrl ? (
                                <span
                                  className={`pepito-profile-pet-mod${
                                    (pet.photoModerationStatus ?? 'approved') === 'pending'
                                      ? ' is-pending'
                                      : (pet.photoModerationStatus ?? 'approved') === 'rejected'
                                        ? ' is-rejected'
                                        : ' is-ok'
                                  }`}
                                >
                                  {(pet.photoModerationStatus ?? 'approved') === 'pending'
                                    ? 'عکس پت در انتظار تأیید ادمین'
                                    : PHOTO_MODERATION_STATUS_LABELS[
                                        pet.photoModerationStatus ?? 'approved'
                                      ]}
                                </span>
                              ) : null}
                              <span className="pepito-profile-pet-id" dir="ltr">
                                {petIdLabel}
                              </span>
                            </div>
                            <ChevronLeft
                              className="pepito-profile-pet-card-chevron"
                              size={18}
                              strokeWidth={2.25}
                              aria-hidden
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          ) : null}

          {mainRole === 'pet_owner' ? (
            <section className="pepito-profile-block pepito-profile-consult" aria-label="خدمات برای صاحب پت">
              <div className="pepito-profile-consult-copy">
                <h2>پزشک و مربی</h2>
                <p>درخواست به آنلاین‌ها — هزینه از موجودی سکه کسر می‌شود.</p>
              </div>
              <div className="pepito-profile-consult-actions">
                <Link
                  to="/vet-consult"
                  className="pepito-profile-consult-cta"
                  data-testid="owner-quick-vet-profile-cta"
                >
                  <Stethoscope size={18} aria-hidden />
                  مشاوره سریع پزشک
                </Link>
                <Link
                  to="/trainer-consult"
                  className="pepito-profile-consult-cta"
                  data-testid="owner-request-trainer-profile-cta"
                >
                  <GraduationCap size={18} aria-hidden />
                  پیدا کردن مربی
                </Link>
              </div>
              <div className="pepito-profile-owner-advice">
                <div className="pepito-profile-owner-advice__copy">
                  <h3>مشورت با صاحبین</h3>
                  <p>
                    اگر روشن باشد، افراد بدون پت می‌توانند با ۶ سکه از تو درباره نگهداری و هزینه
                    مشورت بگیرند.
                  </p>
                </div>
                <button
                  type="button"
                  className={`pepito-btn${display.acceptSeekerAdvice ? ' button-1' : ' pepito-btn--ghost'}`}
                  disabled={adviceBusy || !token}
                  data-testid="owner-accept-seeker-advice"
                  aria-pressed={Boolean(display.acceptSeekerAdvice)}
                  onClick={() => {
                    void (async () => {
                      if (!token) return;
                      setAdviceBusy(true);
                      try {
                        const next = !display.acceptSeekerAdvice;
                        await patchWebAcceptSeekerAdvice(token, next);
                        await refreshMe();
                        toastSuccess(
                          next
                            ? 'پذیرش مشورت با صاحبین روشن شد'
                            : 'پذیرش مشورت با صاحبین خاموش شد'
                        );
                      } catch (err) {
                        toastError(
                          err instanceof Error ? err.message : 'تغییر تنظیم ناموفق بود'
                        );
                      } finally {
                        setAdviceBusy(false);
                      }
                    })();
                  }}
                >
                  {adviceBusy
                    ? '…'
                    : display.acceptSeekerAdvice
                      ? 'پذیرش مشورت — روشن'
                      : 'پذیرش مشورت — خاموش'}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="pepito-profile-sidecol">
          {panel ? (
            <section className="pepito-profile-block pepito-profile-panel" aria-label={panelTitle}>
              <header className="pepito-profile-panel-head">
                <div>
                  <h2>{panelTitle}</h2>
                </div>
                <button
                  type="button"
                  className="pepito-profile-icon-btn"
                  onClick={closePanel}
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </header>
              {panelBusy ? <p className="pepito-profile-panel-loading">در حال بارگذاری…</p> : null}
              {panel === 'account' ? (
                <div className="pepito-profile-account-actions">
                  {display.isActive !== false ? (
                    <button
                      type="button"
                      className="pepito-btn pepito-btn--ghost"
                      disabled={busy}
                      onClick={() => void deactivateAccount()}
                    >
                      غیرفعال‌سازی
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pepito-btn button-1"
                      disabled={busy}
                      onClick={() => void activateAccount()}
                    >
                      فعال‌سازی
                    </button>
                  )}
                  <button
                    type="button"
                    className="pepito-btn pepito-profile-action--danger-solid"
                    disabled={busy}
                    onClick={() => void deleteAccount()}
                  >
                    حذف حساب
                  </button>
                </div>
              ) : panel === 'verify' ? (
                <div className="pepito-profile-verify-panel">
                  <ul className="pepito-profile-panel-list">
                    {panelLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {verifyStatus !== 'verified' && verifyStatus !== 'pending' ? (
                    <div className="pepito-profile-verify-actions">
                      <input
                        ref={verifyFileRef}
                        type="file"
                        accept="image/*,image/heic,image/heif,.heic,.heif"
                        capture="user"
                        className="pepito-avatar-file-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void submitFaceVerify({ file });
                        }}
                      />
                      <button
                        type="button"
                        className="pepito-btn button-1"
                        disabled={verifyBusy}
                        onClick={() => verifyFileRef.current?.click()}
                      >
                        {verifyBusy ? 'در حال ارسال…' : 'ارسال سلفی احراز'}
                      </button>
                      {display.avatarUrl ? (
                        <button
                          type="button"
                          className="pepito-btn pepito-btn--ghost"
                          disabled={verifyBusy}
                          onClick={() => void submitFaceVerify({ useAvatar: true })}
                        >
                          استفاده از عکس پروفایل
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {verifyError ? (
                    <p className="pepito-profile-error" role="alert">
                      {verifyError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <ul className="pepito-profile-panel-list">
                  {panelLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="pepito-profile-block pepito-profile-role-block" aria-label="تغییر نقش">
            <header className="pepito-profile-section-head">
              <h2>نقش‌های من</h2>
              <p>نقش فعال را ببین و با یک لمس عوض کن.</p>
            </header>
            <RoleSwitchControl variant="profile" />
          </section>
        </aside>
      </div>

      <div className="pepito-profile-block">
        <InviteFriendsCard variant="card" />
      </div>

      <section className="pepito-profile-block pepito-profile-block--quiet" aria-label="حساب">
        {error ? <p className="pepito-profile-error">{error}</p> : null}
        <button type="button" className="pepito-profile-logout" onClick={() => void onLogout()} disabled={busy}>
          <LogOut size={18} strokeWidth={2} aria-hidden />
          {busy ? 'خروج…' : 'خروج از حساب'}
        </button>
      </section>
    </div>
  );
}
