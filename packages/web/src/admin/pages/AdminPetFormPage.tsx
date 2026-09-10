import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { usePetStore } from '../../hooks/usePetStore';
import { DEFAULT_IMAGES, DOG_PHOTOS, CAT_PHOTOS, imageForType, petLocal } from '../../data/petImages';
import type { PetGender, PetSize, PetType } from '../../types';
import { PET_SIZE_LABELS, PET_TYPE_EMOJI, PET_TYPE_LABELS } from '../../types';
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

function blankPet(ownerId: number) {
  return {
    name: '',
    type: 'dog' as PetType,
    breed: '',
    age: 1,
    ageUnit: 'year' as 'month' | 'year',
    size: 'medium' as PetSize,
    gender: 'male' as PetGender,
    city: 'تهران',
    neighborhood: '',
    ownerName: '',
    ownerId,
    imageUrl: DEFAULT_IMAGES.dog,
    emoji: '🐕',
    bio: '',
    traits: ['بازیگوش'],
    vaccinated: true,
    neutered: false,
    lookingForPlaymate: true,
    distanceKm: 1,
  };
}

export function AdminPetFormModal({ open, editId, onClose, onSaved }: PetFormModalProps) {
  const { pets, addPet, updatePet, getPetById } = usePetStore();
  const isEdit = Boolean(editId);
  const existing = isEdit && editId != null ? getPetById(editId) : undefined;

  const [form, setForm] = useState(() => blankPet(1));

  useEffect(() => {
    if (!open) return;
    const cur = editId != null ? getPetById(editId) : undefined;
    if (cur) {
      setForm({
        ...blankPet(cur.ownerId),
        ...cur,
        bio: cur.bio ?? '',
        traits: cur.traits ?? ['بازیگوش'],
      });
    } else {
      setForm(blankPet(Math.max(0, ...pets.map((p) => p.ownerId)) + 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const gallery = useMemo(() => GALLERY[form.type] ?? [], [form.type]);

  const update = (field: string, value: string | number | boolean | string[]) => {
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isEdit && existing) {
      updatePet(existing.id, form);
    } else {
      addPet(form);
    }
    onSaved();
    onClose();
  };

  if (isEdit && open && !existing) {
    return (
      <AdminModal
        open={open}
        title="پت پیدا نشد"
        onClose={onClose}
        size="sm"
        footer={<button type="button" className="admin-btn" onClick={onClose}>بستن</button>}
      >
        <p>این پت در استور محلی نیست.</p>
      </AdminModal>
    );
  }

  return (
    <AdminModal
      open={open}
      title={isEdit ? `ویرایش ${existing?.name}` : 'پت جدید'}
      onClose={onClose}
      size="lg"
      as="form"
      onSubmit={handleSubmit}
      footer={
        <>
          <button type="submit" className="admin-btn admin-btn--primary">
            {isEdit ? 'ذخیره تغییرات' : 'ثبت پت'}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
            انصراف
          </button>
        </>
      }
    >
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
          <input className="form-input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">نوع</label>
          <select className="form-select" value={form.type} onChange={(e) => update('type', e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{PET_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">نژاد *</label>
          <input className="form-input" required value={form.breed} onChange={(e) => update('breed', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">صاحب *</label>
          <input className="form-input" required value={form.ownerName} onChange={(e) => update('ownerName', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">محله *</label>
          <input className="form-input" required value={form.neighborhood} onChange={(e) => update('neighborhood', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">فاصله (km)</label>
          <input type="number" step="0.1" className="form-input" value={form.distanceKm} onChange={(e) => update('distanceKm', Number(e.target.value))} />
        </div>
        <div className="form-group">
          <label className="form-label">سن</label>
          <input type="number" min={1} className="form-input" value={form.age} onChange={(e) => update('age', Number(e.target.value))} />
        </div>
        <div className="form-group">
          <label className="form-label">سایز</label>
          <select className="form-select" value={form.size} onChange={(e) => update('size', e.target.value)}>
            {SIZES.map((s) => <option key={s} value={s}>{PET_SIZE_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="form-group admin-form-full">
          <label className="form-label">درباره</label>
          <textarea className="form-textarea" value={form.bio} onChange={(e) => update('bio', e.target.value)} />
        </div>
        <div className="form-group admin-form-full">
          <label className="form-label">لینک عکس (دلخواه)</label>
          <input className="form-input" value={form.imageUrl} onChange={(e) => update('imageUrl', e.target.value)} />
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
