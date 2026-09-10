import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search } from 'lucide-react';
import {
  PET_SPECIES_LABELS,
  petPublicIdOf,
  type PetProfile,
} from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';
import { AdminModal } from '../AdminModal';
import {
  JalaliDateSelect,
  jalaliPartsToGregorianIso,
  type JalaliDateValue,
} from '../JalaliDateSelect';
import { AdminPetFormModal } from './AdminPetFormPage';

type AdminPetRow = PetProfile & {
  ownerName?: string;
  ownerPhone?: string;
  ownerPublicId?: string;
  spendToman6m?: number;
  vipOwner?: boolean;
  lastEvent?: {
    at: string;
    kind: 'purchase' | 'service';
    label: string;
    amountToman?: number;
  } | null;
};

type PetDossier = {
  pet: PetProfile;
  owner: { id: number; name?: string; phone?: string; publicId: string };
  medicalRecord: {
    notes?: string;
    vaccinations?: string;
    allergies?: string;
    chronicConditions?: string;
    lastCheckup?: string;
    medications?: string;
  };
  medicalEntries: Array<{ id: number; text: string; authorName?: string; createdAt: string }>;
  shopOrders: Array<{
    id: number;
    publicId?: string;
    status: string;
    totalToman: number;
    createdAt: string;
  }>;
  consults: Array<{
    id: number;
    publicId?: string;
    status: string;
    feeToman: number;
    notes?: string;
    createdAt: string;
  }>;
  spendToman6m: number;
  vipOwner: boolean;
};

function genderFa(g?: string | null): string | null {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (s === 'male' || s === 'm' || s === 'نر') return 'نر';
  if (s === 'female' || s === 'f' || s === 'ماده') return 'ماده';
  return g;
}

function formatFaDate(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(ms));
  } catch {
    return iso.slice(0, 10);
  }
}

export function AdminPetsPage() {
  const [pets, setPets] = useState<AdminPetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [species, setSpecies] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [eventFrom, setEventFrom] = useState<JalaliDateValue>(null);
  const [eventTo, setEventTo] = useState<JalaliDateValue>(null);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<PetDossier | null>(null);
  const [dossierBusy, setDossierBusy] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const modalNew = searchParams.get('new') === '1';
  const editRaw = searchParams.get('edit');
  const editId = editRaw ? Number(editRaw) : null;
  const modalOpen = modalNew || (editId != null && Number.isFinite(editId));

  const closeModal = () => navigate('/admin/pets', { replace: true });

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (species) qs.set('species', species);
      if (ownerName.trim()) qs.set('ownerName', ownerName.trim());
      if (ownerPhone.trim()) qs.set('ownerPhone', ownerPhone.trim());
      const fromIso = jalaliPartsToGregorianIso(eventFrom);
      const toIso = jalaliPartsToGregorianIso(eventTo);
      if (fromIso) qs.set('lastEventFrom', fromIso);
      if (toIso) qs.set('lastEventTo', toIso);
      const data = await adminFetch<{ total: number; pets: AdminPetRow[] }>(
        `/api/admin/pets?${qs}`
      );
      setPets(data.pets);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [q, species, ownerName, ownerPhone, eventFrom, eventTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDossier = async (petId: number) => {
    setDossierBusy(true);
    try {
      const data = await adminFetch<PetDossier>(`/api/admin/pets/${petId}/dossier`);
      setDossier(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setDossierBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>مدیریت پت‌ها</h1>
          <p>{formatNumFa(total)} پت · جدول pets</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => navigate('/admin/pets?new=1')}
        >
          <Plus size={16} /> پت جدید
        </button>
      </header>

      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="admin-search">
          <Search size={16} />
          <input
            placeholder="نام، آیدی PD-P، نژاد، شهر…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
        >
          <option value="">همه گونه‌ها</option>
          <option value="dog">سگ</option>
          <option value="cat">گربه</option>
          <option value="bird">پرنده</option>
        </select>
        <input
          className="admin-input"
          placeholder="نام مالک"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          style={{ minWidth: 120 }}
        />
        <input
          className="admin-input"
          placeholder="موبایل مالک"
          value={ownerPhone}
          onChange={(e) => setOwnerPhone(e.target.value)}
          dir="ltr"
          style={{ minWidth: 130 }}
        />
        <JalaliDateSelect label="از (آخرین رویداد)" value={eventFrom} onChange={setEventFrom} />
        <JalaliDateSelect label="تا (آخرین رویداد)" value={eventTo} onChange={setEventTo} />
        <button type="button" className="admin-btn" onClick={() => void load()}>
          جستجو
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>آیدی پت</th>
              <th>نام</th>
              <th>گونه / نژاد</th>
              <th>سن / جنسیت</th>
              <th>مالک</th>
              <th>آخرین رویداد</th>
              <th>هزینه ۶ ماه</th>
              <th>شهر</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pets.map((pet) => {
              const publicId = petPublicIdOf(pet);
              const speciesLabel = PET_SPECIES_LABELS[pet.species] || pet.species;
              const meta = [
                pet.ageMonths != null ? `${Math.round(pet.ageMonths / 12)}س` : null,
                genderFa(pet.gender),
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <tr key={pet.id}>
                  <td>
                    <AdminIdChip publicId={publicId} />
                  </td>
                  <td>
                    <AdminEntityCell
                      thumb={
                        <AdminThumb
                          src={pet.imageUrl}
                          petId={pet.id}
                          kind="pet"
                          label={pet.name}
                          alt={pet.name}
                        />
                      }
                      title={
                        <button
                          type="button"
                          className="admin-linkish"
                          style={{
                            background: 'none',
                            border: 0,
                            padding: 0,
                            cursor: 'pointer',
                            fontWeight: 700,
                            color: 'inherit',
                          }}
                          onClick={() => void openDossier(pet.id)}
                          disabled={dossierBusy}
                        >
                          {pet.name}
                        </button>
                      }
                      subtitle={
                        pet.vipOwner ? (
                          <span className="admin-badge admin-badge--mint">مشتری ویژه</span>
                        ) : undefined
                      }
                    />
                  </td>
                  <td>
                    <div className="admin-cell-compact">
                      <span>{speciesLabel}</span>
                      <span className="admin-muted">{pet.breed || '—'}</span>
                    </div>
                  </td>
                  <td className="admin-muted admin-cell-nowrap">{meta || '—'}</td>
                  <td>
                    <div className="admin-cell-compact">
                      <strong>{pet.ownerName || '—'}</strong>
                      <span className="admin-muted" dir="ltr">
                        {pet.ownerPhone || '—'}
                      </span>
                      <code className="admin-mono admin-id-public" dir="ltr">
                        {pet.ownerPublicId || '—'}
                      </code>
                    </div>
                  </td>
                  <td>
                    {pet.lastEvent ? (
                      <div className="admin-cell-compact">
                        <span>{pet.lastEvent.label}</span>
                        <span className="admin-muted">{formatFaDate(pet.lastEvent.at)}</span>
                      </div>
                    ) : (
                      <span className="admin-muted">—</span>
                    )}
                  </td>
                  <td className="admin-cell-nowrap">
                    {formatTomanFa(pet.spendToman6m ?? 0)}
                  </td>
                  <td className="admin-cell-nowrap">{pet.city || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn"
                      title="ویرایش"
                      onClick={() => navigate(`/admin/pets?edit=${pet.id}`)}
                    >
                      <Pencil size={14} /> ویرایش
                    </button>
                  </td>
                </tr>
              );
            })}
            {!pets.length ? (
              <tr>
                <td colSpan={9} className="admin-muted">
                  پتی یافت نشد
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminPetFormModal
        open={modalOpen}
        editId={modalNew ? null : editId}
        onClose={closeModal}
        onSaved={() => void load()}
      />

      <AdminModal
        open={Boolean(dossier)}
        title={dossier ? `پرونده ${dossier.pet.name}` : 'پرونده پت'}
        onClose={() => setDossier(null)}
        size="lg"
        footer={
          <button type="button" className="admin-btn" onClick={() => setDossier(null)}>
            بستن
          </button>
        }
      >
        {dossier ? (
          <div className="admin-dossier" style={{ display: 'grid', gap: 16 }}>
            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>مالک</h3>
              <p style={{ margin: 0 }}>
                {dossier.owner.name || '—'} ·{' '}
                <span dir="ltr">{dossier.owner.phone || '—'}</span> ·{' '}
                <code dir="ltr">{dossier.owner.publicId}</code>
                {dossier.vipOwner ? (
                  <>
                    {' '}
                    <span className="admin-badge admin-badge--mint">مشتری ویژه</span>
                  </>
                ) : null}
              </p>
              <p className="admin-muted" style={{ margin: '4px 0 0' }}>
                هزینه ۶ ماه: {formatTomanFa(dossier.spendToman6m)}
              </p>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>پرونده پزشکی</h3>
              <ul className="admin-log-list">
                <li>یادداشت: {dossier.medicalRecord.notes || '—'}</li>
                <li>واکسن: {dossier.medicalRecord.vaccinations || '—'}</li>
                <li>آلرژی: {dossier.medicalRecord.allergies || '—'}</li>
                <li>مزمن: {dossier.medicalRecord.chronicConditions || '—'}</li>
                <li>داروها: {dossier.medicalRecord.medications || '—'}</li>
                <li>آخرین چکاپ: {dossier.medicalRecord.lastCheckup || '—'}</li>
              </ul>
              {dossier.medicalEntries.length ? (
                <ul className="admin-log-list">
                  {dossier.medicalEntries.map((e) => (
                    <li key={e.id}>
                      <b>{e.authorName || '—'}</b> · {formatFaDate(e.createdAt)}
                      <div>{e.text}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>خریدها / سفارش‌ها</h3>
              <ul className="admin-log-list">
                {dossier.shopOrders.map((o) => (
                  <li key={o.id}>
                    {o.publicId || `#${o.id}`} · {o.status} · {formatTomanFa(o.totalToman)} ·{' '}
                    {formatFaDate(o.createdAt)}
                  </li>
                ))}
                {!dossier.shopOrders.length ? (
                  <li className="admin-muted">سفارشی نیست</li>
                ) : null}
              </ul>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>خدمات / مشاوره‌ها</h3>
              <ul className="admin-log-list">
                {dossier.consults.map((c) => (
                  <li key={c.id}>
                    {c.publicId || `#${c.id}`} · {c.status} · {formatTomanFa(c.feeToman)} ·{' '}
                    {formatFaDate(c.createdAt)}
                    {c.notes ? <div className="admin-muted">{c.notes}</div> : null}
                  </li>
                ))}
                {!dossier.consults.length ? (
                  <li className="admin-muted">خدماتی نیست</li>
                ) : null}
              </ul>
            </section>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
