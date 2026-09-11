import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, PawPrint } from 'lucide-react';
import type { PetProfile } from '@petdate/shared';
import { toEnglishDigits, toPersianDigits } from '@petdate/shared';
import { PetAgePicker } from '../components/AgePicker';
import { BreedPicker } from '../components/BreedPicker';
import { PetPhotoUpload } from '../components/PetPhotoUpload';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { getPet, updatePet } from '../lib/api';
import type { PetGender, PetSize, PetType } from '../types';
import { PET_GENDER_LABELS, PET_SIZE_LABELS, PET_TYPE_LABELS } from '../types';

const PET_TYPES = Object.keys(PET_TYPE_LABELS) as PetType[];
const PET_SIZES = Object.keys(PET_SIZE_LABELS) as PetSize[];
const PET_GENDERS = Object.keys(PET_GENDER_LABELS) as PetGender[];
const PERSONALITY_TRAITS = ['بازیگوش', 'آرام', 'اجتماعی', 'پرانرژی', 'مهربان', 'آموزش‌دیده'];

function speciesToType(species?: string): PetType {
  const s = String(species || '').toLowerCase();
  if (s.includes('cat') || s.includes('گربه')) return 'cat';
  if (s.includes('bird') || s.includes('پرنده')) return 'bird';
  if (s.includes('rabbit') || s.includes('خرگوش')) return 'rabbit';
  if (s.includes('hamster') || s.includes('همستر')) return 'hamster';
  if (s.includes('dog') || s.includes('سگ')) return 'dog';
  return 'other';
}

export function PetEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuthStore();
  const { toastError, toastSuccess } = useAppToast();
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    type: 'dog' as PetType,
    breed: '',
    age: '1',
    ageUnit: 'year' as 'month' | 'year',
    size: 'medium' as PetSize,
    gender: 'male' as PetGender,
    city: '',
    neighborhood: '',
    bio: '',
    imageUrl: '',
    vaccinated: true,
    neutered: false,
    lookingForPlaymate: true,
    healthNotes: '',
    traits: [] as string[],
  });

  const ownerId = user?.id;

  useEffect(() => {
    const petId = Number(id);
    if (!Number.isFinite(petId) || petId <= 0) {
      setLoading(false);
      setError('شناسه پت نامعتبر است');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getPet(petId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setError('پت پیدا نشد');
          return;
        }
        if (ownerId && row.ownerId !== ownerId) {
          setError('اجازه ویرایش این پت را نداری');
          return;
        }
        setPet(row);
        const months = row.ageMonths || 12;
        const useYears = months >= 12 && months % 12 === 0;
        setForm({
          name: row.name || '',
          type: speciesToType(row.species),
          breed: row.breed || '',
          age: String(useYears ? months / 12 : months),
          ageUnit: useYears ? 'year' : 'month',
          size: (row.size as PetSize) || 'medium',
          gender: (row.gender as PetGender) || 'male',
          city: row.city || row.ownerCity || '',
          neighborhood: row.neighborhood || '',
          bio: row.bio || '',
          imageUrl: row.imageUrl || '',
          vaccinated: Boolean(row.vaccinated),
          neutered: Boolean(row.neutered),
          lookingForPlaymate: Boolean(row.lookingForPlaymate),
          healthNotes: String((row.health as { diseases?: string } | undefined)?.diseases || ''),
          traits: Array.isArray((row.personality as { traits?: string[] } | undefined)?.traits)
            ? [...((row.personality as { traits: string[] }).traits)]
            : [],
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, ownerId]);

  const preview = useMemo(() => form.imageUrl || pet?.imageUrl || '', [form.imageUrl, pet?.imageUrl]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pet || !ownerId) return;
    if (!form.name.trim()) {
      setError('نام پت الزامی است'); toastError('نام پت الزامی است');
      return;
    }
    if (!form.breed.trim()) {
      setError('نژاد پت الزامی است — از لیست انتخاب کن'); toastError('نژاد پت الزامی است');
      return;
    }
    setSaving(true);
    setError('');
    const ageNum = Number(toEnglishDigits(form.age).replace(/[^\d]/g, '')) || 1;
    const ageMonths = form.ageUnit === 'year' ? ageNum * 12 : ageNum;
    try {
      const updated = await updatePet(pet.id, {
        ownerId,
        name: form.name.trim(),
        species: form.type,
        breed: form.breed.trim(),
        gender: form.gender,
        ageMonths,
        size: form.size,
        bio: form.bio.trim() || undefined,
        photoUrl: form.imageUrl || undefined,
        imageUrl: form.imageUrl || undefined,
        city: form.city.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        vaccinated: form.vaccinated,
        neutered: form.neutered,
        lookingForPlaymate: form.lookingForPlaymate,
        personality: form.traits.length ? { traits: form.traits } : { traits: [] },
        diseases: form.healthNotes.trim() || undefined,
      });
      toastSuccess('تغییرات ذخیره شد');
      navigate(`/pets/${updated.id}`, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ذخیره ناموفق بود'; setError(msg); toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="pepito-pet-edit">
        <p>برای ویرایش پت وارد شو.</p>
        <Link to={`/auth/login?next=/pets/${id}/edit`} className="pepito-btn button-1">
          ورود
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pepito-pet-edit">
        <p>در حال بارگذاری…</p>
      </div>
    );
  }

  if (error && !pet) {
    return (
      <div className="pepito-pet-edit">
        <p className="auth-error">{error}</p>
        <Link to="/my-pets" className="pepito-btn button-2">
          پت‌های من
        </Link>
      </div>
    );
  }

  return (
    <div className="pepito-pet-edit">
      <header className="pepito-pet-edit-head">
        <button
          type="button"
          className="pepito-profile-icon-btn"
          onClick={() => navigate(`/pets/${id}`)}
          aria-label="بازگشت"
        >
          <ArrowRight size={20} />
        </button>
        <div>
          <p className="pepito-kicker pepito-pet-edit-kicker">
            <span className="pepito-kicker-dot" aria-hidden>
              <PawPrint size={14} />
            </span>
            ویرایش پت
          </p>
          <h1>{form.name || 'پروفایل پت'}</h1>
        </div>
      </header>

      <form className="pepito-pet-edit-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <section className="pepito-profile-edit-section pepito-profile-edit-section--photo">
          <div className="pepito-profile-edit-section-head">
            <span className="pepito-profile-edit-step" aria-hidden>
              ۱
            </span>
            <div>
              <h2 className="pepito-profile-edit-section-title">عکس</h2>
              <p className="pepito-profile-edit-section-desc">چهره پت را واضح نشان بده.</p>
            </div>
          </div>
          {ownerId ? (
            <PetPhotoUpload
              ownerId={ownerId}
              imageUrl={preview}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
            />
          ) : null}
        </section>

        <section className="pepito-profile-edit-section">
          <div className="pepito-profile-edit-section-head">
            <span className="pepito-profile-edit-step" aria-hidden>
              ۲
            </span>
            <div>
              <h2 className="pepito-profile-edit-section-title">مشخصات</h2>
              <p className="pepito-profile-edit-section-desc">نام، نوع، سن و جزئیات.</p>
            </div>
          </div>
          <div className="pepito-profile-edit-grid">
            <label className="pepito-field">
              نام
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <div className="pepito-field pepito-field--full">
              <span>نوع</span>
              <div className="pepito-choice-row" role="group">
                {PET_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`pepito-choice${form.type === t ? ' is-on' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, type: t, breed: '' }))}
                  >
                    {PET_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="pepito-field pepito-field--full">
              <BreedPicker
                species={form.type}
                value={form.breed}
                onChange={(breed) => setForm((f) => ({ ...f, breed }))}
              />
            </div>
            <div className="pepito-field">
              <span className="pepito-field-label">سن</span>
              <PetAgePicker
                value={form.age}
                unit={form.ageUnit}
                onChangeValue={(age) => setForm((f) => ({ ...f, age }))}
                onChangeUnit={(ageUnit) => setForm((f) => ({ ...f, ageUnit }))}
              />
            </div>
            <div className="pepito-field pepito-field--full">
              <span>جنسیت</span>
              <div className="pepito-choice-row">
                {PET_GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`pepito-choice${form.gender === g ? ' is-on' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, gender: g }))}
                  >
                    {PET_GENDER_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>
            <div className="pepito-field pepito-field--full">
              <span>سایز</span>
              <div className="pepito-choice-row">
                {PET_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pepito-choice${form.size === s ? ' is-on' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, size: s }))}
                  >
                    {PET_SIZE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <label className="pepito-field">
              شهر
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </label>
            <label className="pepito-field">
              محله
              <input
                value={form.neighborhood}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
              />
            </label>
            <label className="pepito-field pepito-field--full">
              درباره پت
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </label>
            <label className="pepito-field pepito-field--full">
              یادداشت سلامت
              <textarea
                rows={2}
                value={form.healthNotes}
                onChange={(e) => setForm((f) => ({ ...f, healthNotes: e.target.value }))}
              />
            </label>
            <div className="pepito-field pepito-field--full">
              <span>شخصیت</span>
              <div className="pepito-choice-row">
                {PERSONALITY_TRAITS.map((t) => {
                  const on = form.traits.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`pepito-choice${on ? ' is-on' : ''}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          traits: on ? f.traits.filter((x) => x !== t) : [...f.traits, t].slice(0, 6),
                        }))
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="pepito-check">
              <input
                type="checkbox"
                checked={form.vaccinated}
                onChange={(e) => setForm((f) => ({ ...f, vaccinated: e.target.checked }))}
              />
              واکسینه
            </label>
            <label className="pepito-check">
              <input
                type="checkbox"
                checked={form.neutered}
                onChange={(e) => setForm((f) => ({ ...f, neutered: e.target.checked }))}
              />
              عقیم‌شده
            </label>
            <label className="pepito-check">
              <input
                type="checkbox"
                checked={form.lookingForPlaymate}
                onChange={(e) => setForm((f) => ({ ...f, lookingForPlaymate: e.target.checked }))}
              />
              دنبال همبازی
            </label>
          </div>
        </section>

        {error ? <p className="auth-error">{error}</p> : null}

        <p className="pepito-pet-edit-hint">
          سن نمایشی: {toPersianDigits(form.age)} {form.ageUnit === 'year' ? 'سال' : 'ماه'}
        </p>

        <div className="pepito-profile-edit-actions pepito-pet-edit-actions">
          <button type="submit" className="pepito-btn button-1" disabled={saving}>
            <PawPrint size={16} aria-hidden />
            {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </button>
          <Link to={`/pets/${id}`} className="pepito-btn pepito-btn--ghost">
            انصراف
          </Link>
        </div>
      </form>
    </div>
  );
}
