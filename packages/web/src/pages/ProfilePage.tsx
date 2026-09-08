import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Ban,
  Banknote,
  Bell,
  BellOff,
  ChevronLeft,
  Eye,
  Heart,
  LogOut,
  MapPin,
  PawPrint,
  Pencil,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  BRAND,
  FACE_VERIFY_REWARD,
  IRAN_PROVINCES,
  ONBOARDING_STATUS_LABELS,
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
  userHasRole,
  type User,
  type UserGender,
} from '@petdate/shared';
import { AgePicker } from '../components/AgePicker';
import { InviteFriendsCard } from '../components/InviteFriendsCard';
import { PetAvatar } from '../components/PetAvatar';
import { ProfileAvatarEditor } from '../components/ProfileAvatarEditor';
import { RoleSwitchControl } from '../components/RoleSwitchControl';
import { formatAge } from '../data/mock';
import { useAuthStore } from '../hooks/useAuthStore';
import { useMyPets } from '../hooks/useMyPets';
import {
  deleteUserAccountById,
  fetchProfileCard,
  listUserBlocks,
  listUserContacts,
  patchWebProfile,
  resolvePublicMediaUrl,
  setSilentChatRequests,
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
  const { user, token, logout, isProfileComplete, saveProfile, refreshMe } = useAuthStore();
  const { pets: myPets, loading: petsLoading } = useMyPets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);
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
  const primaryPet = myPets[0] ? petProfileToUiPet(myPets[0]) : null;
  const avatarSrc =
    resolvePublicMediaUrl(display.avatarUrl) ||
    (isPetOwner && primaryPet?.imageUrl ? resolvePublicMediaUrl(primaryPet.imageUrl) : '');
  const genderPlain =
    display.gender === 'male' ? 'آقا' : display.gender === 'female' ? 'خانم' : null;
  const likes = display.likesCount ?? 0;
  const contactsCount = display.contactsCount ?? 0;
  const views = interactions?.views ?? display.profileViews ?? 0;
  const coins = display.coins ?? 0;
  const verifyStatus = display.verificationStatus ?? 'none';
  const silentOn = Boolean(display.silentChatRequests);
  const ageLabel =
    display.age != null && Number(display.age) > 0 ? toPersianDigits(display.age) : null;
  const interestsLabel =
    display.interests && display.interests.length > 0
      ? display.interests.join(' · ')
      : 'هنوز انتخاب نشده';
  const publicId = userDisplayPublicId(display);
  const roleLabel = mainRole ? USER_ROLE_LABELS[mainRole] : null;
  const metaBits = [
    ageLabel ? `${ageLabel} ساله` : null,
    genderPlain,
    profileLanguageCode(display),
  ].filter(Boolean);

  function openEdit() {
    setSearchParams({ edit: '1' }, { replace: false });
  }
  function closeEdit() {
    setSearchParams({}, { replace: true });
    setError('');
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
    if (name.trim().length < 2) { setError('نام را درست وارد کن'); return; }
    const ageNum = parseUserAge(age);
    if (ageNum == null) { setError('سن معتبر نیست'); return; }
    if (!gender) { setError('جنسیت را انتخاب کن'); return; }
    if (!country.trim()) { setError('کشور را مشخص کن'); return; }
    if (country === 'ایران' && !province) { setError('استان را انتخاب کن'); return; }
    if (city.trim().length < 2) { setError('شهر را وارد کن'); return; }
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
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
      closeEdit();
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره پروفایل ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function openContacts() {
    setPanel('contacts');
    setPanelBusy(true);
    setPanelLines([]);
    try {
      const list = await listUserContacts(userId);
      setPanelLines(
        list.length
          ? list.map((c, i) => `${formatFaInt(i + 1)}. ${c.contactName || 'بدون نام'}${c.contactUsername ? ` @${c.contactUsername}` : ''}`)
          : ['هنوز مخاطبی نداری. از چت همبازی می‌تونی اضافه کنی.']
      );
    } catch {
      setPanelLines(['لیست مخاطبین در دسترس نیست.']);
    } finally {
      setPanelBusy(false);
    }
  }
  async function openBlocked() {
    setPanel('blocked');
    setPanelBusy(true);
    setPanelLines([]);
    try {
      const list = await listUserBlocks(userId);
      setPanelLines(
        list.length
          ? list.map((b, i) => `${formatFaInt(i + 1)}. ${b.blockedName || 'بدون نام'}${b.blockedUsername ? ` @${b.blockedUsername}` : ''}`)
          : ['لیست بلاک خالی است.']
      );
    } catch {
      setPanelLines(['لیست بلاک در دسترس نیست.']);
    } finally {
      setPanelBusy(false);
    }
  }
  function openLikes() {
    setPanel('likes');
    setPanelLines([`تعداد لایک دریافتی: ${formatFaInt(likes)}`, 'لایک‌ها از بازدید و تعامل دیگران روی پروفایل/پت جمع می‌شود.']);
  }
  function openInteractions() {
    setPanel('interactions');
    setPanelLines([
      `❤️ لایک: ${formatFaInt(interactions?.likes ?? likes)}`,
      `👁️ بازدید: ${formatFaInt(interactions?.views ?? display.profileViews ?? 0)}`,
      `🐾 درخواست همبازی: ${formatFaInt(interactions?.playdatesTotal ?? 0)}`,
      `⏳ در انتظار: ${formatFaInt(interactions?.playdatesPending ?? 0)}`,
      `✅ پذیرفته: ${formatFaInt(interactions?.playdatesAccepted ?? 0)}`,
    ]);
  }
  function openVerify() {
    setPanel('verify');
    setPanelLines([
      faceVerifyButtonLabel(verifyStatus),
      verifyStatus === 'verified'
        ? 'پروفایلت احراز شده است.'
        : verifyStatus === 'pending'
          ? 'درخواست احراز در صف بررسی است.'
          : `جایزه تأیید: ${formatFaInt(FACE_VERIFY_REWARD)} سکه — از ربات «احراز چهره» بزن.`,
    ]);
  }
  async function toggleSilent() {
    setBusy(true);
    try {
      const updated = await setSilentChatRequests(userId, !silentOn);
      setCardUser(updated);
      await refreshMe();
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر سایلنت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }
  async function deactivateAccount() {
    if (!token) return;
    setBusy(true);
    try {
      await patchWebProfile(token, { isActive: false });
      await refreshMe();
      setPanel(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'غیرفعال‌سازی ناموفق بود');
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
      setPanel(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فعال‌سازی ناموفق بود');
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
      setError(err instanceof Error ? err.message : 'حذف حساب ناموفق بود');
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

  return (
    <div className="pepito-profile">
      <div className="pepito-profile-top">
        <section
          className="pepito-profile-hero pepito-profile-hero--compact"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
          aria-label="پروفایل"
        >
          <div className="pepito-profile-hero-wash" aria-hidden />
          <div className="pepito-profile-hero-inner">
            <div className="pepito-profile-hero-toolbar">
              <p className="pepito-kicker pepito-profile-kicker">
                <span className="pepito-kicker-dot" aria-hidden><PawPrint size={14} /></span>
                {BRAND.displayName}
              </p>
              <div className="pepito-profile-hero-cta">
                <button type="button" className="pepito-btn button-1 pepito-profile-hero-edit" onClick={openEdit}>
                  <Pencil size={16} strokeWidth={2.25} aria-hidden />
                  ویرایش
                </button>
                {needsWizard ? (
                  <Link to="/onboarding/profile" className="pepito-btn pepito-btn--ghost pepito-profile-hero-complete">
                    تکمیل
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="pepito-profile-identity">
              <ProfileAvatarEditor imageUrl={avatarSrc} name={display.name} size="lg" />
              <div className="pepito-profile-identity-text">
                <div className="pepito-profile-name-row">
                  <h1>
                    <span className="pepito-profile-name-emoji" aria-hidden>{profileGenderEmoji(display.gender)}</span>
                    {display.name || 'پروفایل من'}
                  </h1>
                  {roleLabel ? (
                    <span className="pepito-profile-active-chip">{roleLabel}</span>
                  ) : null}
                </div>
                {metaBits.length ? (
                  <p className="pepito-profile-meta">{metaBits.join(' · ')}</p>
                ) : null}
                <p className="pepito-profile-loc">
                  <MapPin size={14} strokeWidth={2} aria-hidden />
                  <span>{locationLabel}</span>
                </p>
              </div>
            </div>

            <div className="pepito-profile-completion" aria-label={cardLines.completion}>
              <div className="pepito-profile-completion-top">
                <span>تکمیل پروفایل</span>
                <strong>{toPersianDigits(completion.percent)}٪</strong>
              </div>
              <span className="pepito-profile-completion-bar" aria-hidden>
                <span style={{ width: `${completion.percent}%` }} />
              </span>
            </div>
          </div>
        </section>

        <section className="pepito-profile-stats pepito-profile-stats--strip" aria-label="آمار پروفایل">
          <button type="button" className="pepito-profile-stat" onClick={openLikes}>
            <Heart size={16} strokeWidth={2} aria-hidden />
            <strong>{formatFaInt(likes)}</strong>
            <span>لایک</span>
          </button>
          <button type="button" className="pepito-profile-stat" onClick={openInteractions}>
            <Eye size={16} strokeWidth={2} aria-hidden />
            <strong>{formatFaInt(views)}</strong>
            <span>بازدید</span>
          </button>
          <Link to="/wallet" className="pepito-profile-stat" aria-label={cardLines.walletViews}>
            <Wallet size={16} strokeWidth={2} aria-hidden />
            <strong>{formatFaInt(coins)}</strong>
            <span>سکه</span>
          </Link>
          <button type="button" className="pepito-profile-stat" onClick={() => void openContacts()}>
            <Users size={16} strokeWidth={2} aria-hidden />
            <strong>{contactsCount > 0 ? formatFaInt(contactsCount) : '−'}</strong>
            <span>مخاطب</span>
          </button>
        </section>
      </div>

      {display.isActive === false ? (
        <p className="pepito-profile-inactive-banner" role="status">حساب فعلاً غیرفعال است</p>
      ) : null}

      <section className="pepito-profile-block pepito-profile-about" aria-label="درباره">
        <header className="pepito-profile-section-head">
          <h2>شناسنامه</h2>
          <p>مشخصات، وضعیت و آیدی قابل کپی</p>
        </header>
        <dl className="pepito-profile-facts pepito-profile-facts--rows">
          {ageLabel ? (
            <div>
              <dt>سن</dt>
              <dd>{ageLabel}</dd>
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
              <dd>{locationLabel}</dd>
            </div>
          ) : null}
          {roleLabel ? (
            <div>
              <dt>نقش</dt>
              <dd>{roleLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>وضعیت</dt>
            <dd>
              <span className={`pepito-profile-badge${needsWizard ? ' is-warn' : ' is-ok'}`}>
                {onboardingLabel}
              </span>
            </dd>
          </div>
          <div>
            <dt>احراز</dt>
            <dd>
              <span
                className={`pepito-profile-badge${
                  verifyStatus === 'verified' ? ' is-ok' : verifyStatus === 'pending' ? ' is-warn' : ''
                }`}
              >
                {profileVerifyStatusLabel(verifyStatus)}
              </span>
            </dd>
          </div>
          {display.phone ? (
            <div>
              <dt>موبایل</dt>
              <dd dir="ltr">{display.phone}</dd>
            </div>
          ) : null}
          <div>
            <dt>آیدی</dt>
            <dd>
              <button
                type="button"
                className="pepito-profile-public-id"
                dir="ltr"
                title="کپی آیدی"
                onClick={() => {
                  void navigator.clipboard?.writeText(publicId);
                }}
              >
                <code>{publicId}</code>
              </button>
            </dd>
          </div>
        </dl>
        {display.bio ? (
          <p className="pepito-profile-bio">{display.bio}</p>
        ) : (
          <p className="pepito-profile-bio pepito-profile-bio--empty">
            هنوز بیویی ننوشتی — با ویرایش می‌تونی اضافه کنی.
          </p>
        )}
        {display.interests && display.interests.length > 0 ? (
          <ul className="pepito-profile-tags">
            {display.interests.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="pepito-profile-bio pepito-profile-bio--empty">علایق: {interestsLabel}</p>
        )}
      </section>

      {showPetsBlock ? (
        <section className="pepito-profile-block" aria-label="پت‌های من">
          <header className="pepito-profile-section-head">
            <h2>پت‌های من</h2>
            <p>
              {petsLoading
                ? 'در حال بارگذاری…'
                : myPets.length
                  ? `${toPersianDigits(String(myPets.length))} پت ثبت‌شده`
                  : 'هنوز پتی ثبت نشده — از مسیر پت‌ها اضافه کن.'}
            </p>
          </header>
          {petsLoading ? (
            <div className="pepito-profile-pet-row pepito-profile-pet-row--muted" aria-busy="true">
              <span>…</span>
            </div>
          ) : myPets.length === 0 ? (
            <Link to="/add-pet" className="pepito-profile-pet-row">
              <PetAvatar type="dog" size="sm" name="پت" />
              <div className="pepito-profile-pet-row-text">
                <strong>هنوز پتی ثبت نشده</strong>
                <span>پروفایل، ویرایش و پرونده پزشکی</span>
              </div>
              <ChevronLeft size={18} strokeWidth={2.25} className="pepito-profile-pet-row-chevron" aria-hidden />
            </Link>
          ) : (
            <ul className="pepito-profile-pet-list">
              {myPets.map((pet) => {
                const ui = petProfileToUiPet(pet);
                return (
                  <li key={pet.id}>
                    <Link to={`/pets/${pet.id}`} className="pepito-profile-pet-row">
                      <PetAvatar
                        type={ui.type}
                        size="sm"
                        imageUrl={ui.imageUrl}
                        name={pet.name}
                      />
                      <div className="pepito-profile-pet-row-text">
                        <strong>{pet.name}</strong>
                        <span>
                          {[
                            PET_TYPE_LABELS[ui.type] || pet.species,
                            formatAge(ui),
                            pet.breed,
                            pet.city || pet.ownerCity || locationLabel,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      <ChevronLeft
                        size={18}
                        strokeWidth={2.25}
                        className="pepito-profile-pet-row-chevron"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/my-pets" className="pepito-profile-action pepito-profile-action--wide">
            مدیریت کامل پت‌ها
          </Link>
        </section>
      ) : null}

      {mainRole === 'pet_owner' ? (
        <section className="pepito-profile-block" aria-label="مشاوره سریع با پزشک">
          <header className="pepito-profile-section-head">
            <h2>مشاوره سریع</h2>
            <p>هزینه اتصال فوری از موجودی سکه کسر می‌شود.</p>
          </header>
          <Link
            to="/vet-consult"
            className="pepito-profile-action pepito-profile-action--primary pepito-profile-action--wide"
            data-testid="owner-quick-vet-profile-cta"
          >
            <Stethoscope size={18} aria-hidden />
            درخواست مشاوره سریع
          </Link>
        </section>
      ) : null}

      <section className="pepito-profile-block" aria-label="اقدامات پروفایل">
        <header className="pepito-profile-section-head">
          <h2>مدیریت</h2>
          <p>ویرایش، احراز و تنظیمات حریم</p>
        </header>

        <div className="pepito-profile-action-groups">
          <div className="pepito-profile-action-group" aria-label="اصلی">
            <button type="button" className="pepito-profile-action pepito-profile-action--primary" onClick={openEdit}>
              <Pencil size={18} aria-hidden />
              ویرایش پروفایل
            </button>
            {needsWizard ? (
              <Link to="/onboarding/profile" className="pepito-profile-action pepito-profile-action--ok">
                تکمیل پروفایل
              </Link>
            ) : null}
            <button
              type="button"
              className={`pepito-profile-action${verifyStatus === 'none' || verifyStatus === 'rejected' ? ' pepito-profile-action--ok' : ''}`}
              onClick={openVerify}
            >
              <ShieldCheck size={18} aria-hidden />
              {faceVerifyButtonLabel(verifyStatus)}
            </button>
            <button type="button" className="pepito-profile-action pepito-profile-action--soft" onClick={openInteractions}>
              <Eye size={18} aria-hidden />
              تعاملات
            </button>
            <Link to="/wallet/earn" className="pepito-profile-action pepito-profile-action--soft">
              <Banknote size={18} aria-hidden />
              کسب درآمد / برداشت
            </Link>
          </div>

          <div className="pepito-profile-action-group pepito-profile-action-group--prefs" aria-label="حریم و حساب">
            <button type="button" className="pepito-profile-action pepito-profile-action--wide pepito-profile-action--soft" onClick={() => void toggleSilent()} disabled={busy}>
              {silentOn ? <Bell size={18} aria-hidden /> : <BellOff size={18} aria-hidden />}
              {silentOn ? 'سایلنت خاموش (الان روشن است)' : 'سایلنت درخواست چت'}
            </button>
            <button type="button" className="pepito-profile-action pepito-profile-action--wide pepito-profile-action--warn" onClick={() => void openBlocked()}>
              <Ban size={18} aria-hidden />
              بلاک‌شده‌ها
            </button>
            <button type="button" className="pepito-profile-action pepito-profile-action--wide pepito-profile-action--danger" onClick={() => setPanel('account')}>
              حذف / غیرفعال‌سازی حساب
            </button>
          </div>
        </div>
      </section>

      {panel ? (
        <section className="pepito-profile-block pepito-profile-panel" aria-label={panelTitle}>
          <header className="pepito-profile-panel-head">
            <div>
              <p className="pepito-eyebrow">جزئیات</p>
              <h2>{panelTitle}</h2>
            </div>
            <button type="button" className="pepito-profile-icon-btn" onClick={() => setPanel(null)} aria-label="بستن">
              <X size={18} />
            </button>
          </header>
          {panelBusy ? <p className="pepito-profile-panel-loading">در حال بارگذاری…</p> : null}
          {panel === 'account' ? (
            <div className="pepito-profile-account-actions">
              {display.isActive !== false ? (
                <button type="button" className="pepito-btn pepito-btn--ghost" disabled={busy} onClick={() => void deactivateAccount()}>غیرفعال‌سازی</button>
              ) : (
                <button type="button" className="pepito-btn button-1" disabled={busy} onClick={() => void activateAccount()}>فعال‌سازی</button>
              )}
              <button type="button" className="pepito-btn pepito-profile-action--danger-solid" disabled={busy} onClick={() => void deleteAccount()}>حذف حساب</button>
            </div>
          ) : (
            <ul className="pepito-profile-panel-list">{panelLines.map((line) => <li key={line}>{line}</li>)}</ul>
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
      {savedToast ? <div className="toast" role="status">ذخیره شد</div> : null}
    </div>
  );
}
