import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { uploadPetPhoto } from '../lib/api';

interface PetPhotoUploadProps {
  ownerId?: number;
  imageUrl: string;
  onChange: (url: string) => void;
  /** Optional fallback when no photo yet (e.g. type default). */
  placeholderSrc?: string;
  label?: string;
}

/**
 * Pet profile photo picker: device gallery / camera → multipart upload → preview.
 * Shows a local blob preview immediately, then swaps to the server URL.
 */
export function PetPhotoUpload({
  ownerId,
  imageUrl,
  onChange,
  placeholderSrc,
  label = 'عکس پت',
}: PetPhotoUploadProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const displaySrc = preview || imageUrl || placeholderSrc || '';

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    const looksImage =
      file.type.startsWith('image/') ||
      /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(file.name || '');
    if (!looksImage) {
      setError('فقط فایل تصویری انتخاب کن (JPG، PNG، WebP، HEIC)');
      return;
    }
    if (!ownerId) {
      setError('اول وارد حساب شو تا عکس ذخیره شود');
      return;
    }

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    blobUrlRef.current = localUrl;
    setPreview(localUrl);
    setError('');
    setUploading(true);

    try {
      const result = await uploadPetPhoto(ownerId, file);
      onChange(result.url);
      setPreview(null);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'آپلود ناموفق بود';
      const friendly =
        raw.trim().startsWith('{') || raw.trim().startsWith('[')
          ? 'آپلود عکس ناموفق بود. یک عکس دیگر با فرمت JPG یا PNG امتحان کن.'
          : raw;
      setError(friendly);
    } finally {
      setUploading(false);
    }
  }

  function clearPhoto() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreview(null);
    setError('');
    onChange('');
    if (galleryRef.current) galleryRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  return (
    <div className="pet-photo-upload">
      <label className="form-label">{label}</label>

      <div className="pet-photo-preview-wrap">
        {displaySrc ? (
          <img src={displaySrc} alt="پیش‌نمایش پت" className="pet-photo-preview" />
        ) : (
          <div className="pet-photo-placeholder" aria-hidden>
            <ImagePlus size={36} strokeWidth={1.6} />
            <span>هنوز عکسی انتخاب نشده</span>
          </div>
        )}
        {uploading && (
          <div className="pet-photo-uploading" role="status">
            <Loader2 size={22} className="pet-photo-spin" />
            <span>در حال آپلود…</span>
          </div>
        )}
      </div>

      <div className="pet-photo-actions">
        <button
          type="button"
          className="pet-photo-btn"
          disabled={uploading || !ownerId}
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus size={18} strokeWidth={2} />
          انتخاب از گالری
        </button>
        <button
          type="button"
          className="pet-photo-btn pet-photo-btn--secondary"
          disabled={uploading || !ownerId}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera size={18} strokeWidth={2} />
          دوربین
        </button>
        {(imageUrl || preview) && (
          <button
            type="button"
            className="pet-photo-btn pet-photo-btn--ghost"
            disabled={uploading}
            onClick={clearPhoto}
            aria-label="حذف عکس"
          >
            <X size={18} strokeWidth={2} />
          </button>
        )}
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="pet-photo-file-input"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="pet-photo-file-input"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {!ownerId && (
        <p className="pet-photo-hint">برای ذخیره عکس باید وارد حساب شده باشی.</p>
      )}
      {error && (
        <p className="pet-photo-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
