import { useCallback, useEffect, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { petPublicIdOf, type PetProfile } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { resolvePublicMediaUrl } from '../../lib/api';
import { EMPTY_STATE_PHOTO } from '../../data/petImages';

function adminPetThumbSrc(pet: PetProfile): string {
  return (
    resolvePublicMediaUrl(pet.imageUrl, { petId: pet.id }) || EMPTY_STATE_PHOTO
  );
}

export function AdminPetsPage() {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [species, setSpecies] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (species) qs.set('species', species);
      const data = await adminFetch<{ total: number; pets: PetProfile[] }>(`/api/admin/pets?${qs}`);
      setPets(data.pets); setTotal(data.total); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, [q, species]);
  useEffect(() => { void load(); }, [load]);
  const remove = async (pet: PetProfile) => {
    if (!confirm(`حذف پت «${pet.name}»؟`)) return;
    try { await adminFetch(`/api/admin/pets/${pet.id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>مدیریت پت‌ها</h1><p>{formatNumFa(total)} پت</p></div></header>
      <div className="admin-toolbar">
        <div className="admin-search"><Search size={16} /><input placeholder="نام، آیدی PD-P، نژاد، شهر…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="admin-select" value={species} onChange={(e) => setSpecies(e.target.value)}>
          <option value="">همه</option><option value="dog">سگ</option><option value="cat">گربه</option><option value="bird">پرنده</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>جستجو</button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card"><table className="admin-table">
        <thead><tr><th>عکس</th><th>آیدی</th><th>نام</th><th>گونه</th><th>مالک</th><th>شهر</th><th></th></tr></thead>
        <tbody>
          {pets.map((pet) => {
            const publicId = petPublicIdOf(pet);
            return (
              <tr key={pet.id}>
                <td>
                  <img
                    src={adminPetThumbSrc(pet)}
                    alt=""
                    className="admin-thumb"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.dataset.fallback === '1') return;
                      el.dataset.fallback = '1';
                      el.src = EMPTY_STATE_PHOTO;
                    }}
                  />
                </td>
                <td>
                  <code className="admin-mono" dir="ltr">{publicId}</code>
                  <div className="admin-muted admin-mono">#{pet.id}</div>
                </td>
                <td><strong>{pet.name}</strong></td>
                <td>{pet.species} · {pet.breed || '—'}</td>
                <td className="admin-mono">#{pet.ownerId}</td>
                <td>{pet.city || '—'}</td>
                <td><button type="button" className="admin-btn admin-btn--danger" onClick={() => void remove(pet)}><Trash2 size={14} /></button></td>
              </tr>
            );
          })}
          {!pets.length ? <tr><td colSpan={7} className="admin-muted">پتی یافت نشد</td></tr> : null}
        </tbody>
      </table></div>
    </div>
  );
}
