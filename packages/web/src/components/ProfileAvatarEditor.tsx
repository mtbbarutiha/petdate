import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import { looksLikeHtmlBody } from '../lib/apiErrorMessage';

interface ProfileAvatarEditorProps {
  imageUrl: string;
  name?: string;
  /** Compact overlay control on the circular avatar (view + edit). */
  size?: 'lg' | 'xl';
  className?: string;
  onUploaded?: (url: string) => void;
}

/**
 * Circular profile avatar with gallery/camera upload.
 * Uploads via POST /api/auth/avatar and syncs authStore.user.avatarUrl.
 */
export function ProfileAvatarEditor({
  imageUrl,
  name = '',
  size = 'xl',
  className = '',
  onUploaded,
}: ProfileAvatarEditorProps) {
  const { uploadAvatar } = useAuthStore();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedPending, setUploadedPending] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const displaySrc = preview || imageUrl || '';
  const initial = (name || 'پ').trim().slice(0, 1);

  async function handleFile(file: File | undefined | null) {
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
    setUploading(true);

    try {
      const result = await uploadAvatar(file);
      onUploaded?.(result.url);
      setPreview(null);
      setUploadedPending(true);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'آپلود ناموفق بود';
      const friendly =
        raw.trim().startsWith('{') || raw.trim().startsWith('[') || looksLikeHtmlBody(raw)
          ? 'آپلود عکس ناموفق بود. یک عکس دیگر با فرمت JPG یا PNG امتحان کن.'
          : raw;
      setError(friendly);
      setPreview(null);
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
          onClick={() => galleryRef.current?.click()}
          aria-label="تغییر عکس پروفایل"
          title="تغییر عکس"
        >
          <Camera size={16} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className="pepito-avatar-editor-cam pepito-avatar-editor-cam--alt"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
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
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        capture="user"
        className="pepito-avatar-file-input"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

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
