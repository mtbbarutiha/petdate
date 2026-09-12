import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import {
  PROFILE_PHOTO_CHANGE_COST,
  isStoredCustomProfilePhoto,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { looksLikeHtmlBody } from '../lib/apiErrorMessage';
import { ConfirmModal } from './ConfirmModal';

interface ProfileAvatarEditorProps {
  imageUrl: string;
  name?: string;
  /** Compact overlay control on the circular avatar (view + edit). */
  size?: 'lg' | 'xl';
  className?: string;
  onUploaded?: (url: string) => void;
}

function formatCoins(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n);
}

/**
 * Circular profile avatar with gallery/camera upload.
 * Uploads via POST /api/auth/avatar and syncs authStore.user.avatarUrl.
 * Replacing an existing custom photo costs coins and clears face verification.
 */
export function ProfileAvatarEditor({
  imageUrl,
  name = '',
  size = 'xl',
  className = '',
  onUploaded,
}: ProfileAvatarEditorProps) {
  const { uploadAvatar, user } = useAuthStore();
  const { t } = useI18n();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedPending, setUploadedPending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const coins = Math.max(0, Math.floor(Number(user?.coins) || 0));
  const isReplacement = isStoredCustomProfilePhoto(user?.avatarUrl);
  const cost = PROFILE_PHOTO_CHANGE_COST;

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const displaySrc = preview || imageUrl || '';
  const initial = (name || 'پ').trim().slice(0, 1);

  function clearLocalPreview() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreview(null);
    setPendingFile(null);
  }

  function openPicker(kind: 'gallery' | 'camera') {
    setError('');
    if (isReplacement && coins < cost) {
      setError(t('verify.photoChangeNeedCoins', { n: cost, balance: coins }));
      return;
    }
    if (kind === 'gallery') galleryRef.current?.click();
    else cameraRef.current?.click();
  }

  function stageFile(file: File | undefined | null) {
    if (!file) return;
    const looksImage =
      file.type.startsWith('image/') ||
      /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(file.name || '');
    if (!looksImage) {
      setError('فقط فایل تصویری انتخاب کن (JPG، PNG، WebP، HEIC)');
      return;
    }

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    blobUrlRef.current = localUrl;
    setPreview(localUrl);
    setError('');

    if (isReplacement) {
      setPendingFile(file);
      return;
    }
    void uploadSelected(file);
  }

  async function uploadSelected(file: File) {
    setUploading(true);
    setError('');
    try {
      const result = await uploadAvatar(file);
      onUploaded?.(result.url);
      setUploadedPending(true);
      clearLocalPreview();
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'آپلود ناموفق بود';
      const friendly =
        raw.trim().startsWith('{') || raw.trim().startsWith('[') || looksLikeHtmlBody(raw)
          ? 'آپلود عکس ناموفق بود. یک عکس دیگر با فرمت JPG یا PNG امتحان کن.'
          : raw;
      setError(friendly);
      clearLocalPreview();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={`pepito-avatar-editor pepito-avatar-editor--${size}${className ? ` ${className}` : ''}`}>
      <div className="pepito-avatar-editor-ring" aria-hidden={uploading ? undefined : true}>
        {displaySrc ? (
          <img src={displaySrc} alt={name ? `عکس ${name}` : 'عکس پروفایل'} />
        ) : (
          <span className="pepito-avatar-editor-initial">{initial}</span>
        )}
        {uploading ? (
          <div className="pepito-avatar-editor-busy" role="status">
            <Loader2 size={22} className="pepito-avatar-spin" />
          </div>
        ) : null}
      </div>

      <div className="pepito-avatar-editor-actions">
        <button
          type="button"
          className="pepito-avatar-editor-cam"
          disabled={uploading}
          onClick={() => openPicker('gallery')}
          aria-label="تغییر عکس پروفایل"
          title="تغییر عکس"
        >
          <Camera size={16} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className="pepito-avatar-editor-cam pepito-avatar-editor-cam--alt"
          disabled={uploading}
          onClick={() => openPicker('camera')}
          aria-label="عکس با دوربین"
          title="دوربین"
        >
          <Camera size={14} strokeWidth={2.25} />
        </button>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        className="pepito-avatar-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          stageFile(file);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        capture="user"
        className="pepito-avatar-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          stageFile(file);
        }}
      />

      <ConfirmModal
        open={Boolean(pendingFile)}
        title={t('verify.photoChangeTitle')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        busy={uploading}
        testId="profile-photo-change-confirm"
        onCancel={() => {
          if (uploading) return;
          clearLocalPreview();
        }}
        onConfirm={() => {
          const file = pendingFile;
          if (!file || uploading) return;
          void uploadSelected(file);
        }}
      >
        <dl className="pepito-confirm-modal__stats">
          <div className="pepito-confirm-modal__row pepito-confirm-modal__row--fee">
            <dt>{t('verify.photoChangeCost')}</dt>
            <dd>{formatCoins(cost)} سکه</dd>
          </div>
          <div className="pepito-confirm-modal__row">
            <dt>{t('verify.photoChangeBalance')}</dt>
            <dd>{formatCoins(coins)} سکه</dd>
          </div>
        </dl>
        <p className="pepito-lead-modal__lead">{t('verify.photoChangeLead', { n: cost })}</p>
      </ConfirmModal>

      {error ? (
        <p className="pepito-avatar-editor-error" role="alert">
          {error}
        </p>
      ) : uploadedPending ? (
        <p className="pepito-avatar-editor-hint" role="status">
          پیش‌نمایش برای خودت فعال است — تا تأیید ادمین عمومی نیست.
        </p>
      ) : null}
    </div>
  );
}
