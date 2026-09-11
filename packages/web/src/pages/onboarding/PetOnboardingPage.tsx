import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toEnglishDigits } from '@petdate/shared';
import { AuthShell } from '../../components/AuthShell';
import { PetAgePicker } from '../../components/AgePicker';
import { BreedPicker } from '../../components/BreedPicker';
import { PetPhotoUpload } from '../../components/PetPhotoUpload';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAppToast } from '../../hooks/useAppToast';
import { usePetStore } from '../../hooks/usePetStore';
import { useUserStore } from '../../hooks/useUserStore';
import { createPet } from '../../lib/api';
import type { PetGender, PetSize, PetType } from '../../types';
import { PET_GENDER_LABELS, PET_SIZE_LABELS, PET_TYPE_EMOJI, PET_TYPE_LABELS } from '../../types';

const PET_TYPES = Object.keys(PET_TYPE_LABELS) as PetType[];
const PET_SIZES = Object.keys(PET_SIZE_LABELS) as PetSize[];
const PET_GENDERS = Object.keys(PET_GENDER_LABELS) as PetGender[];
const PERSONALITY_TRAITS = ['بازیگوش', 'آرام', 'اجتماعی', 'پرانرژی', 'مهربان', 'آموزش‌دیده', 'محافظ', 'خجالتی'];

export function PetOnboardingPage() {
  const navigate = useNavigate();
  const { updatePet, myPet } = usePetStore();
  const { saveOnboardingToApi } = useUserStore();
  const { user: authUser, isLoggedIn, applyUser } = useAuthStore();
  const { toastSuccess, toastError } = useAppToast();
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState({
    name: myPet.name === 'رکس' ? '' : myPet.name,
    type: 'dog' as PetType,
    breed: '',
    age: '1',
    ageUnit: 'year' as 'month' | 'year',
    size: 'medium' as PetSize,
    gender: 'male' as PetGender,
    city: myPet.city || authUser?.city || '',
    neighborhood: myPet.neighborhood === 'ونک' ? '' : myPet.neighborhood,
    bio: '',
    imageUrl: '',
    vaccinated: true,
    neutered: false,
    lookingForPlaymate: true,
    traits: ['بازیگوش'] as string[],
    healthNotes: '',
  });

  const ownerId = authUser?.id;

  const update = (field: string, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTrait = (trait: string) => {
    setForm((prev) => ({
      ...prev,
      traits: prev.traits.includes(trait)
        ? prev.traits.filter((t) => t !== trait)
        : [...prev.traits, trait],
    }));
  };

  const goHomeAfterSkip = () => {
    // مثل ربات: ثبت پت جدا از پروفایل است و اجباری نیست
    navigate('/home', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setSubmitError('نام پت الزامی است'); toastError('نام پت الزامی است');
      return;
    }
    if (!form.breed.trim()) {
      setSubmitError('نژاد پت الزامی است — از لیست انتخاب کن'); toastError('نژاد پت الزامی است');
      return;
    }
    setSaving(true);
    setSubmitError('');

    const ageNum = Number(toEnglishDigits(form.age).replace(/[^\d]/g, '')) || 1;
    const ageMonths = form.ageUnit === 'year' ? ageNum * 12 : ageNum;
    const ownerName = authUser?.name || myPet.ownerName;
    const resolvedOwnerId = ownerId ?? myPet.ownerId;
    const petData = {
      name: form.name.trim(),
      type: form.type,
      breed: form.breed.trim(),
      age: ageNum,
      ageUnit: form.ageUnit,
      size: form.size,
      gender: form.gender,
      city: form.city,
      neighborhood: form.neighborhood,
      ownerName,
      ownerId: resolvedOwnerId,
      imageUrl: form.imageUrl || '',
      emoji: PET_TYPE_EMOJI[form.type],
      bio: form.bio,
      traits: form.traits,
      vaccinated: form.vaccinated,
      neutered: form.neutered,
      lookingForPlaymate: form.lookingForPlaymate,
      healthNotes: form.healthNotes,
      distanceKm: 0,
    };

    try {
      let localPatch = { ...petData };

      if (isLoggedIn && ownerId) {
        const created = await createPet({
          ownerId,
          name: form.name.trim(),
          species: form.type,
          breed: form.breed.trim(),
          gender: form.gender,
          ageMonths,
          size: form.size,
          bio: form.bio.trim() || undefined,
          vaccinated: form.vaccinated,
          neutered: form.neutered,
          lookingForPlaymate: form.lookingForPlaymate,
          diseases: form.healthNotes.trim() || undefined,
          personality: form.traits.length ? { traits: form.traits } : undefined,
          imageUrl: form.imageUrl || undefined,
          city: form.city.trim() || authUser?.city,
          neighborhood: form.neighborhood.trim() || undefined,
        });
        if (created.owner) applyUser(created.owner);
        localPatch = {
          ...localPatch,
          ownerId: created.ownerId,
          imageUrl: created.imageUrl || form.imageUrl || '',
        };
        // First pet during onboarding becomes the primary local myPet
        updatePet(myPet.id, { ...localPatch, id: created.id });
      } else {
        updatePet(myPet.id, localPatch);
      }

      await saveOnboardingToApi('profile_complete');
      toastSuccess('پروفایل تکمیل شد!');
      window.setTimeout(() => navigate('/home', { replace: true }), 1400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ثبت پروفایل ناموفق بود';
      setSubmitError(msg); toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  const isValid = Boolean(form.name.trim() && form.breed.trim());

  return (
    <AuthShell
      wide
      backTo="/onboarding/profile"
      backLabel="بازگشت به پروفایل"
      bannerTitle="پروفایل پت"
      bannerLead="نام و نژاد الزامی‌اند — نژاد را از لیست انتخاب کن"
      bannerImage="/pepito/uploads/2.jpg"
    >
      <p className="pepito-auth-kicker">پت</p>
      <h1>پروفایل پت‌ات</h1>
      <p className="auth-lead">
        اطلاعات پت رو وارد کن — نام و نژاد الزامی‌اند
      </p>

      <PetPhotoUpload
        ownerId={ownerId}
        imageUrl={form.imageUrl}
        onChange={(url) => update('imageUrl', url)}
        label="عکس پت (اختیاری)"
      />

      <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="form-group">
          <label className="form-label">نام پت *</label>
          <input className="form-input" placeholder="مثلاً: رکس" value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">نوع حیوان</label>
          <select
            className="form-select"
            value={form.type}
            onChange={(e) => {
              update('type', e.target.value);
              update('breed', '');
            }}
          >
            {PET_TYPES.map((t) => (
              <option key={t} value={t}>{PET_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <BreedPicker
          species={form.type}
          value={form.breed}
          onChange={(breed) => update('breed', breed)}
        />

        <div className="form-group">
          <label className="form-label">سن پت</label>
          <PetAgePicker
            value={form.age}
            unit={form.ageUnit}
            onChangeValue={(v) => update('age', v)}
            onChangeUnit={(u) => update('ageUnit', u)}
          />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">سایز</label>
            <select className="form-select" value={form.size} onChange={(e) => update('size', e.target.value)}>
              {PET_SIZES.map((s) => (
                <option key={s} value={s}>{PET_SIZE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">جنسیت</label>
            <select className="form-select" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
              {PET_GENDERS.map((g) => (
                <option key={g} value={g}>{PET_GENDER_LABELS[g]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">محله (اختیاری)</label>
          <input className="form-input" placeholder="مثلاً: ونک" value={form.neighborhood} onChange={(e) => update('neighborhood', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">شخصیت و ویژگی‌ها (اختیاری)</label>
          <div className="trait-chips">
            {PERSONALITY_TRAITS.map((trait) => (
              <button
                key={trait}
                type="button"
                className={`trait-chip${form.traits.includes(trait) ? ' active' : ''}`}
                onClick={() => toggleTrait(trait)}
              >
                {trait}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">سلامت و یادداشت پزشکی (اختیاری)</label>
          <textarea
            className="form-textarea"
            placeholder="آلرژی، دارو، بیماری خاص..."
            value={form.healthNotes}
            onChange={(e) => update('healthNotes', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">درباره پت (اختیاری)</label>
          <textarea className="form-textarea" placeholder="شخصیت، علاقه‌ها..." value={form.bio} onChange={(e) => update('bio', e.target.value)} />
        </div>

        <div className="form-check-group">
          <label className="form-check">
            <input type="checkbox" checked={form.vaccinated} onChange={(e) => update('vaccinated', e.target.checked)} />
            <span>واکسینه شده</span>
          </label>
          <label className="form-check">
            <input type="checkbox" checked={form.neutered} onChange={(e) => update('neutered', e.target.checked)} />
            <span>عقیم‌شده</span>
          </label>
          <label className="form-check">
            <input type="checkbox" checked={form.lookingForPlaymate} onChange={(e) => update('lookingForPlaymate', e.target.checked)} />
            <span>دنبال همبازی هستم</span>
          </label>
        </div>

        {submitError && (
          <p className="pet-photo-error" role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" className="pepito-btn button-1 auth-submit" disabled={!isValid || saving}>
          {saving ? 'در حال ذخیره…' : 'تکمیل پروفایل'}
        </button>
        <button
          type="button"
          className="pepito-btn pepito-btn--ghost auth-skip-btn"
          disabled={saving}
          onClick={goHomeAfterSkip}
        >
          فعلاً رد کن
        </button>
      </form>

    </AuthShell>
  );
}
