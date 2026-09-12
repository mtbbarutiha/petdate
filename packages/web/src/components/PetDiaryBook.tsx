import { type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trash2 } from 'lucide-react';
import type { PetDiaryEntry } from '@petdate/shared';
import { EMPTY_STATE_PHOTO } from '../data/petImages';
import { useI18n } from '../i18n';
import { formatDiaryWhen } from '../lib/diaryDate';

export type PetDiaryBookProps = {
  id?: string;
  petName: string;
  photo: string;
  entries: PetDiaryEntry[];
  canWrite: boolean;
  body: string;
  busy: boolean;
  textareaId: string;
  /** Public pet page uses a shorter lead (no “also on public page” note). */
  publicLead?: boolean;
  backHref?: string;
  onBodyChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onDelete?: (entryId: number) => void;
};

/**
 * One diary-feel book: pet portrait cover, handwriting entries in a
 * continuous notebook, owner compose/delete. Shared by owner + public pages.
 */
export function PetDiaryBook({
  id,
  petName,
  photo,
  entries,
  canWrite,
  body,
  busy,
  textareaId,
  publicLead = false,
  backHref,
  onBodyChange,
  onSubmit,
  onDelete,
}: PetDiaryBookProps) {
  const { t, lang } = useI18n();
  const title = t('pets.diaryOf', { name: petName });
  const lead = publicLead ? t('pets.diaryLeadPublic') : t('pets.diaryLead');

  return (
    <section id={id} className="pepito-pet-diary" aria-label={title}>
      <div className="pepito-pet-diary-book">
        {backHref ? (
          <div className="pepito-pet-diary-pagebar">
            <Link to={backHref} className="pepito-pet-diary-back">
              <ArrowRight size={18} aria-hidden />
              {t('pets.diaryBack')}
            </Link>
          </div>
        ) : null}

        <header className="pepito-pet-diary-cover">
          <div className="pepito-pet-diary-portrait">
            <img
              src={photo}
              alt={petName}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== EMPTY_STATE_PHOTO) img.src = EMPTY_STATE_PHOTO;
              }}
            />
          </div>
          <p className="pepito-pet-diary-kicker">{t('pets.diary')}</p>
          <h2>{title}</h2>
          <p className="pepito-pet-diary-lead">{lead}</p>
        </header>

        {canWrite ? (
          <form className="pepito-pet-diary-form" onSubmit={(e) => void onSubmit(e)}>
            <label htmlFor={textareaId} className="sr-only">
              {t('pets.diaryWriteLabel')}
            </label>
            <textarea
              id={textareaId}
              rows={4}
              maxLength={4000}
              placeholder={t('pets.diaryPlaceholder', { name: petName })}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="pepito-btn button-1 pepito-pet-diary-submit"
              disabled={busy || !body.trim()}
            >
              {t('pets.diarySubmit')}
            </button>
          </form>
        ) : null}

        {entries.length === 0 ? (
          <p className="pepito-pet-diary-empty">
            {canWrite ? t('pets.diaryEmptyOwner') : t('pets.diaryEmptyPublic')}
          </p>
        ) : (
          <ol className="pepito-pet-diary-list">
            {entries.map((entry) => (
              <li key={entry.id} className="pepito-pet-diary-entry">
                <header>
                  <time dateTime={entry.createdAt}>{formatDiaryWhen(entry.createdAt, lang)}</time>
                  {canWrite && onDelete ? (
                    <button
                      type="button"
                      className="pepito-pet-diary-delete"
                      aria-label={t('pets.diaryDelete')}
                      disabled={busy}
                      onClick={() => void onDelete(entry.id)}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  ) : null}
                </header>
                <p>{entry.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
