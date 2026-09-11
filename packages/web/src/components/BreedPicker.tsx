import { useEffect, useMemo, useState } from 'react';
import type { PetBreed } from '@petdate/shared';
import { listBreeds } from '../lib/api';

interface BreedPickerProps {
  species: string;
  value: string;
  onChange: (nameFa: string) => void;
  required?: boolean;
  label?: string;
}

/**
 * Searchable breed select — values must come from DB catalog (no free text).
 */
export function BreedPicker({
  species,
  value,
  onChange,
  required = true,
  label = 'نژاد',
}: BreedPickerProps) {
  const [breeds, setBreeds] = useState<PetBreed[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    void listBreeds(species)
      .then((rows) => {
        if (cancelled) return;
        setBreeds(rows);
        // Clear selection when species changes and current breed is invalid
        if (value && !rows.some((b) => b.nameFa === value)) {
          onChange('');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setBreeds([]);
        setLoadError(err instanceof Error ? err.message : 'بارگذاری نژادها ناموفق بود');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch on species
  }, [species]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return breeds;
    return breeds.filter(
      (b) =>
        b.nameFa.toLowerCase().includes(q) ||
        (b.nameEn && b.nameEn.toLowerCase().includes(q))
    );
  }, [breeds, query]);

  return (
    <div className="form-group breed-picker">
      <label className="form-label">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        className="form-input"
        type="search"
        enterKeyHint="search"
        placeholder="جستجوی نژاد (فارسی یا انگلیسی)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="جستجوی نژاد"
      />
      <select
        className="form-select"
        value={value}
        required={required}
        disabled={loading || breeds.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{loading ? 'در حال بارگذاری…' : 'نژاد را انتخاب کن'}</option>
        {filtered.map((b) => (
          <option key={b.id} value={b.nameFa}>
            {b.nameFa}
            {b.nameEn ? ` — ${b.nameEn}` : ''}
          </option>
        ))}
      </select>
      {query.trim() && filtered.length === 0 ? (
        <p className="pet-photo-hint">نژادی با این عبارت پیدا نشد — عبارت را عوض کن یا «سایر» را بزن.</p>
      ) : null}
      {loadError ? (
        <p className="pet-photo-error" role="alert">
          {loadError}
        </p>
      ) : null}
    </div>
  );
}
