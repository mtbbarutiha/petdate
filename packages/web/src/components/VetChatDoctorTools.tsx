import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, FilePlus2, Loader2, PawPrint, Pill, UserRound, X } from 'lucide-react';
import {
  RX_CONDITION_CATEGORIES,
  USER_GENDER_LABELS,
  formatMedicalEntryAttribution,
  formatPetAge,
  formatRxMedicationTemplate,
  formatVetAuthorName,
  getRxCategoryById,
  getRxMedication,
  profileVerifyStatusLabel,
  userPublicIdOf,
  type PetMedicalEntry,
  type PetMedicalRecord,
  type PetProfile,
  type User,
  type VetConsultation,
} from '@petdate/shared';
import {
  addPetMedicalEntry,
  createConsultationPrescription,
  getPet,
  getPetMedical,
  getUserById,
  listPets,
  type CreatePrescriptionResponse,
} from '../lib/api';

const RX_NOTE =
  'پیشنهادها فقط راهنما هستند؛ دوز و مدت را خودتان تکمیل/ویرایش کنید.';

export type VetDoctorPanel = 'rx' | 'medical' | 'note' | 'pet' | 'owner' | null;

type Props = {
  open: VetDoctorPanel;
  onClose: () => void;
  consult: VetConsultation;
  vetUserId: number;
  vetName?: string;
  token?: string | null;
  onIssued?: (result: CreatePrescriptionResponse) => void;
  onNoteSaved?: (text: string) => void;
};

function truncate(text: string, max = 1200): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function VetChatDoctorToolbar({
  disabled,
  onOpen,
}: {
  disabled?: boolean;
  onOpen: (panel: Exclude<VetDoctorPanel, null>) => void;
}) {
  return (
    <div className="tg-vet-tools" role="toolbar" aria-label="ابزار پزشک">
      <button
        type="button"
        className="tg-vet-tool-btn tg-vet-tool-btn--rx"
        disabled={disabled}
        onClick={() => onOpen('rx')}
        data-testid="vet-chat-rx-open"
      >
        <Pill size={16} aria-hidden />
        نسخه
      </button>
      <button
        type="button"
        className="tg-vet-tool-btn"
        disabled={disabled}
        onClick={() => onOpen('medical')}
        data-testid="vet-chat-medical-open"
      >
        <ClipboardList size={16} aria-hidden />
        پرونده
      </button>
      <button
        type="button"
        className="tg-vet-tool-btn"
        disabled={disabled}
        onClick={() => onOpen('note')}
        data-testid="vet-chat-note-open"
      >
        <FilePlus2 size={16} aria-hidden />
        ثبت در پرونده
      </button>
      <button
        type="button"
        className="tg-vet-tool-btn"
        disabled={disabled}
        onClick={() => onOpen('pet')}
        data-testid="vet-chat-pet-open"
      >
        <PawPrint size={16} aria-hidden />
        پروفایل پت
      </button>
    </div>
  );
}

/** Trainer/sitter: non-medical profile views only. */
export function VetChatProfileToolbar({
  disabled,
  onOpen,
}: {
  disabled?: boolean;
  onOpen: (panel: 'pet' | 'owner') => void;
}) {
  return (
    <div className="tg-vet-tools" role="toolbar" aria-label="پروفایل طرف مقابل">
      <button
        type="button"
        className="tg-vet-tool-btn"
        disabled={disabled}
        onClick={() => onOpen('pet')}
        data-testid="service-chat-pet-open"
      >
        <PawPrint size={16} aria-hidden />
        پروفایل پت
      </button>
      <button
        type="button"
        className="tg-vet-tool-btn"
        disabled={disabled}
        onClick={() => onOpen('owner')}
        data-testid="service-chat-owner-open"
      >
        <UserRound size={16} aria-hidden />
        پروفایل صاحب پت
      </button>
    </div>
  );
}

export function VetChatDoctorSheets({
  open,
  onClose,
  consult,
  vetUserId,
  vetName,
  token,
  onIssued,
  onNoteSaved,
}: Props) {
  // Lock page scroll while a doctor sheet is open (sheet is portaled to body).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes the active sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sheet = (
    <div
      className="tg-vet-sheet-overlay"
      role="presentation"
      onClick={onClose}
      data-testid="vet-doctor-sheet-overlay"
    >
      <div
        className="tg-vet-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={
          open === 'rx'
            ? 'صدور نسخه'
            : open === 'medical'
              ? 'پرونده پزشکی'
              : open === 'note'
                ? 'ثبت در پرونده'
                : open === 'owner'
                  ? ((consult.serviceKind ?? 'vet') === 'seeker_advice' ? 'پروفایل درخواست‌کننده' : 'پروفایل صاحب پت')
                  : 'پروفایل پت'
        }
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tg-vet-sheet-head">
          <h2>
            {open === 'rx'
              ? '💊 صدور نسخه'
              : open === 'medical'
                ? '📋 پرونده پزشکی'
                : open === 'note'
                  ? '📝 ثبت در پرونده'
                  : open === 'owner'
                    ? ((consult.serviceKind ?? 'vet') === 'seeker_advice' ? '👤 پروفایل درخواست‌کننده' : '👤 پروفایل صاحب پت')
                    : '🐾 پروفایل پت'}
          </h2>
          <button type="button" className="tg-vet-sheet-close" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </header>

        {open === 'rx' ? (
          <RxSheetBody
            consult={consult}
            vetUserId={vetUserId}
            token={token}
            onClose={onClose}
            onIssued={onIssued}
          />
        ) : null}
        {open === 'medical' ? (
          <MedicalSheetBody consult={consult} vetUserId={vetUserId} />
        ) : null}
        {open === 'note' ? (
          <NoteSheetBody
            consult={consult}
            vetUserId={vetUserId}
            vetName={vetName}
            token={token}
            onClose={onClose}
            onNoteSaved={onNoteSaved}
          />
        ) : null}
        {open === 'pet' ? <PetSheetBody consult={consult} /> : null}
        {open === 'owner' ? <OwnerSheetBody consult={consult} /> : null}
      </div>
    </div>
  );

  // Portal above chat stacking contexts (header ⋮ / foot transform / bottom dock)
  // so sheets never paint under menus. Parent transform on .tg-thread-foot would
  // otherwise trap position:fixed and clip the overlay to the composer only.
  return createPortal(sheet, document.body);
}

function usePatientPets(consult: VetConsultation) {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listPets({ ownerId: consult.patientUserId });
        if (!cancelled) setPets(rows);
      } catch (err) {
        if (!cancelled) {
          setPets([]);
          setError(err instanceof Error ? err.message : 'بارگذاری پت‌ها ناموفق بود');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consult.patientUserId]);

  const preferredPetId = useMemo(() => {
    if (consult.petId && pets.some((p) => p.id === consult.petId)) return consult.petId;
    if (pets.length === 1) return pets[0]!.id;
    return null;
  }, [consult.petId, pets]);

  return { pets, loading, error, preferredPetId };
}

function RxSheetBody({
  consult,
  vetUserId,
  token,
  onClose,
  onIssued,
}: {
  consult: VetConsultation;
  vetUserId: number;
  token?: string | null;
  onClose: () => void;
  onIssued?: (result: CreatePrescriptionResponse) => void;
}) {
  const { pets, loading, error, preferredPetId } = usePatientPets(consult);
  const [petId, setPetId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [step, setStep] = useState<'pet' | 'compose'>('pet');

  useEffect(() => {
    if (preferredPetId != null) {
      setPetId(preferredPetId);
      setStep('compose');
    } else if (!loading && pets.length > 1) {
      setStep('pet');
    }
  }, [preferredPetId, loading, pets.length]);

  const petName = pets.find((p) => p.id === petId)?.name || consult.petName || 'پت';
  const category = categoryId ? getRxCategoryById(categoryId) : null;

  const appendMed = useCallback((catId: string, medId: string) => {
    const med = getRxMedication(catId, medId);
    if (!med) return;
    const line = formatRxMedicationTemplate(med);
    setDraft((prev) => {
      const base = prev.trim();
      return base ? `${base}\n${line}` : line;
    });
    setCategoryId(null);
  }, []);

  async function issue() {
    if (!petId) {
      setLocalError('اول پت را انتخاب کن.');
      return;
    }
    const text = draft.trim();
    if (!text) {
      setLocalError('پیش‌نویس خالی است — دارو انتخاب یا متن بنویس.');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const result = await createConsultationPrescription(
        consult.id,
        { vetUserId, petId, text },
        token,
      );
      onIssued?.(result);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'صدور نسخه ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="tg-vet-sheet-body tg-vet-sheet-loading">
        <Loader2 className="tg-spin" size={22} />
        <span>در حال بارگذاری…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tg-vet-sheet-body">
        <p className="tg-vet-sheet-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!pets.length) {
    return (
      <div className="tg-vet-sheet-body">
        <p className="tg-vet-sheet-hint">بیمار پتی ندارد؛ اول از او بخواه پت ثبت کند.</p>
      </div>
    );
  }

  if (step === 'pet') {
    return (
      <div className="tg-vet-sheet-body">
        <p className="tg-vet-sheet-hint">نسخه برای کدام پت؟</p>
        <div className="tg-vet-chip-grid">
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="tg-vet-chip"
              onClick={() => {
                setPetId(p.id);
                setStep('compose');
              }}
            >
              💊 {p.name}
              {p.species ? <small>{p.species}</small> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tg-vet-sheet-body">
      <p className="tg-vet-sheet-kicker">
        نسخه برای «{petName}»
        {pets.length > 1 ? (
          <button type="button" className="tg-vet-linkish" onClick={() => setStep('pet')}>
            تغییر پت
          </button>
        ) : null}
      </p>
      <p className="tg-vet-sheet-hint">{RX_NOTE}</p>

      {!category ? (
        <div className="tg-vet-chip-grid" aria-label="دسته‌های بیماری">
          {RX_CONDITION_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="tg-vet-chip"
              onClick={() => setCategoryId(cat.id)}
            >
              {cat.emoji} {cat.labelFa}
            </button>
          ))}
        </div>
      ) : (
        <div className="tg-vet-med-block">
          <div className="tg-vet-med-head">
            <strong>
              {category.emoji} {category.labelFa}
            </strong>
            <button type="button" className="tg-vet-linkish" onClick={() => setCategoryId(null)}>
              بازگشت
            </button>
          </div>
          <div className="tg-vet-chip-grid">
            {category.medications.map((med) => (
              <button
                key={med.id}
                type="button"
                className="tg-vet-chip tg-vet-chip--med"
                onClick={() => appendMed(category.id, med.id)}
              >
                💊 {med.nameFa}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="tg-vet-field">
        <span>متن نسخه</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          dir="auto"
          placeholder="نام دارو، دوز، فاصله و مدت…"
          data-testid="vet-rx-draft"
        />
      </label>

      {localError ? (
        <p className="tg-vet-sheet-error" role="alert">
          {localError}
        </p>
      ) : null}

      <div className="tg-vet-sheet-actions">
        <button type="button" className="tg-vet-action-secondary" onClick={onClose} disabled={busy}>
          انصراف
        </button>
        <button
          type="button"
          className="tg-vet-action-primary"
          onClick={() => void issue()}
          disabled={busy || !draft.trim()}
          data-testid="vet-rx-issue"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="tg-spin" /> در حال صدور…
            </>
          ) : (
            'تأیید و صدور نسخه'
          )}
        </button>
      </div>
    </div>
  );
}

function MedicalSheetBody({
  consult,
  vetUserId,
}: {
  consult: VetConsultation;
  vetUserId: number;
}) {
  const { pets, loading, error, preferredPetId } = usePatientPets(consult);
  const [petId, setPetId] = useState<number | null>(null);
  const [record, setRecord] = useState<PetMedicalRecord | null>(null);
  const [entries, setEntries] = useState<PetMedicalEntry[]>([]);
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (preferredPetId != null) setPetId(preferredPetId);
  }, [preferredPetId]);

  useEffect(() => {
    if (petId == null) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      setFetchError(null);
      try {
        const data = await getPetMedical(petId, vetUserId);
        if (!cancelled) {
          setRecord(data.record);
          setEntries(data.entries);
          setPet(data.pet);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'بارگذاری پرونده ناموفق بود');
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [petId, vetUserId]);

  if (loading) {
    return (
      <div className="tg-vet-sheet-body tg-vet-sheet-loading">
        <Loader2 className="tg-spin" size={22} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="tg-vet-sheet-body">
        <p className="tg-vet-sheet-error">{error}</p>
      </div>
    );
  }
  if (!pets.length) {
    return (
      <div className="tg-vet-sheet-body">
        <p className="tg-vet-sheet-hint">پت ثبت‌شده‌ای برای بیمار نیست.</p>
      </div>
    );
  }

  return (
    <div className="tg-vet-sheet-body">
      {pets.length > 1 ? (
        <div className="tg-vet-chip-grid tg-vet-chip-grid--compact">
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`tg-vet-chip${petId === p.id ? ' is-active' : ''}`}
              onClick={() => setPetId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}

      {fetching ? (
        <div className="tg-vet-sheet-loading">
          <Loader2 className="tg-spin" size={22} />
        </div>
      ) : fetchError ? (
        <p className="tg-vet-sheet-error">{fetchError}</p>
      ) : record && pet ? (
        <div className="tg-vet-medical">
          <h3>پرونده — {pet.name}</h3>
          <dl>
            <div>
              <dt>یادداشت</dt>
              <dd>{record.notes || '—'}</dd>
            </div>
            <div>
              <dt>واکسن‌ها</dt>
              <dd>{record.vaccinations || '—'}</dd>
            </div>
            <div>
              <dt>آلرژی</dt>
              <dd>{record.allergies || '—'}</dd>
            </div>
            <div>
              <dt>بیماری مزمن</dt>
              <dd>{record.chronicConditions || '—'}</dd>
            </div>
            <div>
              <dt>آخرین معاینه</dt>
              <dd>{record.lastCheckup || '—'}</dd>
            </div>
            <div>
              <dt>دارو</dt>
              <dd>{record.medications || '—'}</dd>
            </div>
          </dl>
          {record.lastUpdatedByName || record.lastUpdatedByUserId != null ? (
            <p className="tg-vet-sheet-hint">
              آخرین ویرایشگر:{' '}
              {formatVetAuthorName(record.lastUpdatedByName, record.lastUpdatedByUserId)}
            </p>
          ) : null}
          {entries.length ? (
            <div className="tg-vet-entries">
              <h4>ثبت‌های بالینی</h4>
              <ul>
                {entries.slice(0, 12).map((e) => (
                  <li key={e.id}>
                    <small>{formatMedicalEntryAttribution(e)}</small>
                    <p>{e.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="tg-vet-sheet-hint">پت را انتخاب کن.</p>
      )}
    </div>
  );
}

function NoteSheetBody({
  consult,
  vetUserId,
  vetName,
  token,
  onClose,
  onNoteSaved,
}: {
  consult: VetConsultation;
  vetUserId: number;
  vetName?: string;
  token?: string | null;
  onClose: () => void;
  onNoteSaved?: (text: string) => void;
}) {
  const { pets, loading, error, preferredPetId } = usePatientPets(consult);
  const [petId, setPetId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (preferredPetId != null) setPetId(preferredPetId);
  }, [preferredPetId]);

  async function save() {
    if (!petId) {
      setLocalError('اول پت را انتخاب کن.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      setLocalError('متن مورد بالینی خالی است.');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await addPetMedicalEntry(
        petId,
        {
          authorUserId: vetUserId,
          authorName: vetName,
          consultId: consult.id,
          text: trimmed,
        },
        token,
      );
      onNoteSaved?.(trimmed);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'ثبت پرونده ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="tg-vet-sheet-body tg-vet-sheet-loading">
        <Loader2 className="tg-spin" size={22} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="tg-vet-sheet-body">
        <p className="tg-vet-sheet-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="tg-vet-sheet-body">
      {pets.length > 1 ? (
        <div className="tg-vet-chip-grid tg-vet-chip-grid--compact">
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`tg-vet-chip${petId === p.id ? ' is-active' : ''}`}
              onClick={() => setPetId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : pets[0] ? (
        <p className="tg-vet-sheet-kicker">ثبت برای «{pets[0].name}»</p>
      ) : (
        <p className="tg-vet-sheet-hint">پت ثبت‌شده‌ای نیست.</p>
      )}

      <label className="tg-vet-field">
        <span>مورد بالینی</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          dir="auto"
          placeholder="یافته‌ها، تشخیص موقت، توصیه…"
          data-testid="vet-note-draft"
        />
      </label>

      {localError ? (
        <p className="tg-vet-sheet-error" role="alert">
          {localError}
        </p>
      ) : null}

      <div className="tg-vet-sheet-actions">
        <button type="button" className="tg-vet-action-secondary" onClick={onClose} disabled={busy}>
          انصراف
        </button>
        <button
          type="button"
          className="tg-vet-action-primary"
          onClick={() => void save()}
          disabled={busy || !text.trim() || !petId}
          data-testid="vet-note-save"
        >
          {busy ? 'در حال ثبت…' : 'ثبت در پرونده'}
        </button>
      </div>
    </div>
  );
}

function PetSheetBody({ consult }: { consult: VetConsultation }) {
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(consult.petId));
  const [error, setError] = useState<string | null>(null);
  const { pets, loading: listLoading } = usePatientPets(consult);

  useEffect(() => {
    if (!consult.petId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const row = await getPet(consult.petId!);
        if (!cancelled) setPet(row);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'خطا');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consult.petId]);

  if (loading || listLoading) {
    return (
      <div className="tg-vet-sheet-body tg-vet-sheet-loading">
        <Loader2 className="tg-spin" size={22} />
      </div>
    );
  }

  const display = pet || pets.find((p) => p.id === consult.petId) || pets[0] || null;

  if (!display) {
    return (
      <div className="tg-vet-sheet-body">
        <p className="tg-vet-sheet-hint">
          {error || 'اطلاعات پت در دسترس نیست.'}
          {consult.petName ? ` · ${consult.petName}` : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="tg-vet-sheet-body">
      <div className="tg-vet-pet-card">
        <h3>{display.name}</h3>
        <dl>
          <div>
            <dt>گونه</dt>
            <dd>{display.species || consult.petSpecies || '—'}</dd>
          </div>
          <div>
            <dt>نژاد</dt>
            <dd>{display.breed || consult.petBreed || '—'}</dd>
          </div>
          {display.gender ? (
            <div>
              <dt>جنسیت</dt>
              <dd>{display.gender}</dd>
            </div>
          ) : null}
          {display.size ? (
            <div>
              <dt>سایز</dt>
              <dd>{display.size}</dd>
            </div>
          ) : null}
          {display.ageMonths != null ? (
            <div>
              <dt>سن</dt>
              <dd>{formatPetAge(display.ageMonths)}</dd>
            </div>
          ) : null}
          {display.city ? (
            <div>
              <dt>شهر</dt>
              <dd>{display.city}</dd>
            </div>
          ) : null}
        </dl>
        {display.bio ? <p className="tg-vet-sheet-hint">{truncate(display.bio, 400)}</p> : null}
      </div>
    </div>
  );
}

function OwnerSheetBody({ consult }: { consult: VetConsultation }) {
  const [owner, setOwner] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await getUserById(consult.patientUserId);
        if (!cancelled) setOwner(row);
      } catch (err) {
        if (!cancelled) {
          setOwner(null);
          setError(err instanceof Error ? err.message : 'بارگذاری پروفایل ناموفق بود');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consult.patientUserId]);

  if (loading) {
    return (
      <div className="tg-vet-sheet-body tg-vet-sheet-loading">
        <Loader2 className="tg-spin" size={22} />
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="tg-vet-sheet-body">
        <p className="tg-vet-sheet-hint">
          {error || ((consult.serviceKind ?? 'vet') === 'seeker_advice' ? 'پروفایل درخواست‌کننده در دسترس نیست.' : 'پروفایل صاحب پت در دسترس نیست.')}
          {consult.patientName ? ` · ${consult.patientName}` : ''}
        </p>
      </div>
    );
  }

  const publicId = userPublicIdOf(owner);
  const gender = owner.gender ? USER_GENDER_LABELS[owner.gender] : null;
  const place = [owner.province, owner.city].filter(Boolean).join('، ') || owner.city || null;
  const verify = profileVerifyStatusLabel(owner.verificationStatus);

  return (
    <div className="tg-vet-sheet-body">
      <div className="tg-vet-pet-card">
        <h3>{owner.name?.trim() || consult.patientName || ((consult.serviceKind ?? 'vet') === 'seeker_advice' ? 'درخواست‌کننده' : 'صاحب پت')}</h3>
        <dl>
          <div>
            <dt>آیدی</dt>
            <dd>{publicId}</dd>
          </div>
          {owner.age != null ? (
            <div>
              <dt>سن</dt>
              <dd>{owner.age}</dd>
            </div>
          ) : null}
          {gender ? (
            <div>
              <dt>جنسیت</dt>
              <dd>{gender}</dd>
            </div>
          ) : null}
          {place ? (
            <div>
              <dt>موقعیت</dt>
              <dd>{place}</dd>
            </div>
          ) : null}
          {verify ? (
            <div>
              <dt>احراز</dt>
              <dd>{verify}</dd>
            </div>
          ) : null}
        </dl>
        {owner.bio ? <p className="tg-vet-sheet-hint">{truncate(owner.bio, 400)}</p> : null}
      </div>
    </div>
  );
}
