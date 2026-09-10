import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { DEFAULT_IMAGES, DOG_PHOTOS, CAT_PHOTOS, imageForType, petLocal } from '../../data/petImages';
import type { PetGender, PetSize, PetType } from '../../types';
import { PET_SIZE_LABELS, PET_TYPE_EMOJI, PET_TYPE_LABELS } from '../../types';
import { adminFetch } from '../api';
import { AdminModal } from '../AdminModal';

const TYPES = Object.keys(PET_TYPE_LABELS) as PetType[];
const SIZES = Object.keys(PET_SIZE_LABELS) as PetSize[];

const GALLERY: Partial<Record<PetType, readonly string[]>> = {
  dog: DOG_PHOTOS,
  cat: CAT_PHOTOS,
};

type PetFormModalProps = {
  open: boolean;
  editId?: number | null;
  onClose: () => void;
  onSaved: () => void;
};

type PetFormState = {
  name: string;
  type: PetType;
  breed: string;
  age: number;
  ageUnit: 'month' | 'year';
  size: PetSize;
  gender: PetGender;
  city: string;
  neighborhood: string;
  ownerId: string;
  ownerName: string;
  imageUrl: string;
  emoji: string;
  bio: string;
  vaccinated: boolean;
  neutered: boolean;
  lookingForPlaymate: boolean;
};

function blankPet(): PetFormState {
  return {
    name: '',
    type: 'dog',
    breed: '',
    age: 1,
    ageUnit: 'year',
    size: 'medium',
    gender: 'male',
    city: 'تهران',
    neighborhood: '',
    ownerId: '',
    ownerName: '',
    imageUrl: DEFAULT_IMAGES.dog,
    emoji: '🐕',
    bio: '',
    vaccinated: true,
    neutered: false,
    lookingForPlaymate: true,
  };
}

function speciesToType(species?: string): PetType {
  const s = String(species || '').toLowerCase();
  if (s === 'cat' || s === 'bird' || s === 'dog') return s;
  return 'dog';
}

export function AdminPetFormModal({ open, editId, onClose, onSaved }: PetFormModalProps) {
  const isEdit = Boolean(editId);
  const [form, setForm] = useState<PetFormState>(() => blankPet());
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setLoadError(null);

    if (editId == null) {
      setForm(blankPet());
      setLoadedId(null);
      return;
    }

    let cancelled = false;
    setBusy(true);
    void (async () => {
      try {
        const data = await adminFetch<{
          pet: {
            id: number;
            name: string;
            species: string;
            breed?: string;
            gender?: string;
            ageMonths?: number;
            size?: string;
            city?: string;
            neighborhood?: string;
            ownerId: number;
            imageUrl?: string;
            bio?: string;
            vaccinated?: boolean;
            neutered?: boolean;
            lookingForPlaymate?: boolean;
          };
          owner: { name?: string };
        }>(`/api/admin/pets/${editId}/dossier`);
        if (cancelled) return;
        const pet = data.pet;
        const months = pet.ageMonths ?? 12;
        const useYears = months >= 12 && months % 12 === 0;
        setForm({
          ...blankPet(),
          name: pet.name || '',
          type: speciesToType(pet.species),
          breed: pet.breed || '',
          age: useYears ? Math.max(1, Math.round(months / 12)) : Math.max(1, months),
          ageUnit: useYears ? 'year' : 'month',
          size: (pet.size as PetSize) || 'medium',
          gender: (pet.gender as PetGender) || 'male',
          city: pet.city || '',
          neighborhood: pet.neighborhood || '',
          ownerId: String(pet.ownerId),
          ownerName: data.owner?.name || '',
          imageUrl: pet.imageUrl || imageForType(speciesToType(pet.species), 0),
          emoji: PET_TYPE_EMOJI[speciesToType(pet.species)] || '🐾',
          bio: pet.bio || '',
          vaccinated: pet.vaccinated !== false,
          neutered: Boolean(pet.neutered),
          lookingForPlaymate: pet.lookingForPlaymate !== false,
        });
        setLoadedId(pet.id);
        setLoadError(null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'پت پیدا نشد');
          setLoadedId(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, editId]);

  const gallery = useMemo(() => GALLERY[form.type] ?? [], [form.type]);

  const update = (field: keyof PetFormState, value: string | number | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'type' && typeof value === 'string') {
        const t = value as PetType;
        next.imageUrl = imageForType(t, 0);
        next.emoji = PET_TYPE_EMOJI[t];
      }
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const ageMonths =
        form.ageUnit === 'month' ? Number(form.age) : Math.round(Number(form.age) * 12);
      const payload = {
        name: form.name.trim(),
        species: form.type,
        type: form.type,
        breed: form.breed.trim(),
        gender: form.gender,
        ageMonths,
        size: form.size,
        city: form.city.trim(),
        neighborhood: form.neighborhood.trim(),
        imageUrl: form.imageUrl,
        bio: form.bio,
        vaccinated: form.vaccinated,
        neutered: form.neutered,
        lookingForPlaymate: form.lookingForPlaymate,
        ownerId: Number(form.ownerId) || undefined,
      };

      if (isEdit && editId != null) {
        await adminFetch(`/api/admin/pets/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        if (!payload.ownerId || !Number.isFinite(payload.ownerId)) {
          throw new Error('شناسه مالک (ownerId) الزامی است');
        }
        await adminFetch('/api/admin/pets', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'خطا در ذخیره');
    } finally {
      setBusy(false);
    }
  };

  if (isEdit && open && loadError && !loadedId) {
    return (
      <AdminModal
        open={open}
        title="پت پیدا نشد"
        onClose={onClose}
        size="sm"
        footer={
          <button type="button" className="admin-btn" onClick={onClose}>
            بستن
          </button>
        }
      >
        <p>{loadError}</p>
      </AdminModal>
    );
  }

  return (
    <AdminModal
      open={open}
      title={isEdit ? `ویرایش ${form.name || ''}` : 'پت جدید'}
      onClose={onClose}
      size="lg"
      as="form"
      onSubmit={(e) => void handleSubmit(e)}
      busy={busy}
      footer={
        <>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
            {isEdit ? 'ذخیره تغییرات' : 'ثبت پت'}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={onClose}>
            انصراف
          </button>
        </>
      }
    >
      {saveError ? <p className="admin-error">{saveError}</p> : null}

      <div className="admin-form-preview" style={{ textAlign: 'center' }}>
        <img src={form.imageUrl} alt={form.name || 'پت'} style={{ maxWidth: 160, borderRadius: 12 }} />
        <p className="admin-muted">پیش‌نمایش عکس</p>
      </div>

      {gallery.length > 0 && (
        <div className="admin-gallery">
          <label className="form-label">انتخاب عکس {PET_TYPE_LABELS[form.type]}</label>
          <div className="admin-gallery-grid">
            {gallery.map((photoId) => (
              <button
                key={photoId}
                type="button"
                className={`admin-gallery-item${form.imageUrl === petLocal(photoId) ? ' active' : ''}`}
                onClick={() => update('imageUrl', petLocal(photoId))}
              >
                <img src={petLocal(photoId)} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="admin-form-grid">
        <div className="form-group">
          <label className="form-label">نام *</label>
          <input
            className="form-input"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">نوع</label>
          <select
            className="form-select"
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {PET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">نژاد *</label>
          <input
            className="form-input"
            required
            value={form.breed}
            onChange={(e) => update('breed', e.target.value)}
          />
        </div>
        {!isEdit ? (
          <div className="form-group">
            <label className="form-label">شناسه مالک (ownerId) *</label>
            <input
              className="form-input"
              required
              dir="ltr"
              value={form.ownerId}
              onChange={(e) => update('ownerId', e.target.value)}
              placeholder="مثلاً 12"
            />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">مالک</label>
            <input className="form-input" disabled value={form.ownerName || form.ownerId} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">شهر</label>
          <input
            className="form-input"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">محله</label>
          <input
            className="form-input"
            value={form.neighborhood}
            onChange={(e) => update('neighborhood', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">سن</label>
          <input
            type="number"
            min={1}
            className="form-input"
            value={form.age}
            onChange={(e) => update('age', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">واحد سن</label>
          <select
            className="form-select"
            value={form.ageUnit}
            onChange={(e) => update('ageUnit', e.target.value)}
          >
            <option value="year">سال</option>
            <option value="month">ماه</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">جنسیت</label>
          <select
            className="form-select"
            value={form.gender}
            onChange={(e) => update('gender', e.target.value)}
          >
            <option value="male">نر</option>
            <option value="female">ماده</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">سایز</label>
          <select
            className="form-select"
            value={form.size}
            onChange={(e) => update('size', e.target.value)}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {PET_SIZE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group admin-form-full">
          <label className="form-label">درباره</label>
          <textarea
            className="form-textarea"
            value={form.bio}
            onChange={(e) => update('bio', e.target.value)}
          />
        </div>
        <div className="form-group admin-form-full">
          <label className="form-label">لینک عکس (دلخواه)</label>
          <input
            className="form-input"
            value={form.imageUrl}
            onChange={(e) => update('imageUrl', e.target.value)}
          />
        </div>
      </div>
    </AdminModal>
  );
}

export function AdminPetFormPage() {
  const { id } = useParams();
  const to = id ? `/admin/pets?edit=${encodeURIComponent(id)}` : '/admin/pets?new=1';
  return <Navigate to={to} replace />;
}
