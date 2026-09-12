import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { PetBreed } from '@petdate/shared';
import { breedMatchesQuery } from '@petdate/shared';
import { listBreeds } from '../lib/api';

interface BreedPickerProps {
  species: string;
  value: string;
  onChange: (nameFa: string) => void;
  required?: boolean;
  label?: string;
}

/**
 * Searchable breed autocomplete — English OR Persian finds catalog breeds.
 * Values must come from DB catalog (no free text).
 */
export function BreedPicker({
  species,
  value,
  onChange,
  required = true,
  label = 'نژاد',
}: BreedPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [breeds, setBreeds] = useState<PetBreed[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setQuery('');
    setOpen(false);
    void listBreeds(species)
      .then((rows) => {
        if (cancelled) return;
        setBreeds(rows);
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

  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, []);

  const selected = useMemo(
    () => breeds.find((b) => b.nameFa === value) ?? null,
    [breeds, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    const rows = !q ? breeds : breeds.filter((b) => breedMatchesQuery(b, q));
    return rows.slice(0, 40);
  }, [breeds, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function pick(breed: PetBreed) {
    onChange(breed.nameFa);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onChange('');
    setQuery('');
    setOpen(true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = filtered[highlight];
      if (row) pick(row);
    }
  }

  const showList = open && !loading && breeds.length > 0;

  return (
    <div className="form-group breed-picker" ref={rootRef}>
      <label className="form-label" htmlFor={`${listId}-input`}>
        {label}
        {required ? ' *' : ''}
      </label>

      {selected ? (
        <div className="breed-picker-selected">
          <span className="breed-picker-selected-label">
            {selected.nameFa}
            {selected.nameEn ? (
              <span className="breed-picker-selected-en" dir="ltr">
                {' '}
                — {selected.nameEn}
              </span>
            ) : null}
          </span>
          <button type="button" className="breed-picker-clear" onClick={clear}>
            تغییر
          </button>
        </div>
      ) : null}

      <input
        id={`${listId}-input`}
        className="form-input"
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && filtered[highlight] ? `${listId}-opt-${filtered[highlight]!.id}` : undefined
        }
        enterKeyHint="search"
        autoComplete="off"
        placeholder={
          loading
            ? 'در حال بارگذاری نژادها…'
            : 'جستجوی نژاد (فارسی یا انگلیسی)…'
        }
        value={query}
        disabled={loading || breeds.length === 0}
        required={required && !value}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      <input type="hidden" value={value} required={required} readOnly aria-hidden tabIndex={-1} />

      {showList ? (
        <ul
          id={`${listId}-list`}
          className="breed-picker-suggestions"
          role="listbox"
          aria-label="پیشنهاد نژاد"
        >
          {filtered.length === 0 ? (
            <li className="breed-picker-empty" role="presentation">
              نژادی با این عبارت پیدا نشد — عبارت را عوض کن یا «سایر» را بزن.
            </li>
          ) : (
            filtered.map((b, idx) => (
              <li key={b.id} role="presentation">
                <button
                  type="button"
                  id={`${listId}-opt-${b.id}`}
                  role="option"
                  aria-selected={idx === highlight || b.nameFa === value}
                  className={`breed-picker-option${idx === highlight ? ' is-active' : ''}${
                    b.nameFa === value ? ' is-selected' : ''
                  }`}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(b)}
                >
                  <span>{b.nameFa}</span>
                  {b.nameEn ? (
                    <span className="breed-picker-option-en" dir="ltr">
                      {b.nameEn}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {loadError ? (
        <p className="pet-photo-error" role="alert">
          {loadError}
        </p>
      ) : null}
    </div>
  );
}
