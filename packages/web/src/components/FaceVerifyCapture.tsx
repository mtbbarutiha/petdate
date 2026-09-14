import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Loader2, Square, Trash2, Upload, Video, X } from 'lucide-react';
import {
  buildCaptureFile,
  formatCaptureDuration,
  mediaPermissionErrorMessage,
  pickRecorderMime,
  stopMediaStream,
} from '../lib/chatMediaRecorder';

/** Short selfie clip for KYC — keep under chat video max. */
export const FACE_VERIFY_MAX_SECONDS = 15;

type Phase = 'idle' | 'camera' | 'recording' | 'preview' | 'uploading';

type Props = {
  disabled?: boolean;
  busy?: boolean;
  hasProfilePhoto: boolean;
  profilePhotoUrl?: string;
  onError: (message: string) => void;
  onSubmit: (file: File) => void | Promise<void>;
  labels: {
    openCamera: string;
    pickFile: string;
    needPhoto: string;
    matchHint: string;
    ready: string;
    record: string;
    stop: string;
    retake: string;
    send: string;
    cancel: string;
    recording: string;
    uploading: string;
    noCamera: string;
  };
};

/**
 * Face-verify selfie video capture for Profile → احراز چهره.
 * Reuses MediaRecorder helpers from chat voice/video notes.
 * Prefers live front camera; falls back to file input when getUserMedia is blocked.
 */
export function FaceVerifyCapture({
  disabled = false,
  busy = false,
  hasProfilePhoto,
  profilePhotoUrl,
  onError,
  onSubmit,
  labels,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [cameraBlocked, setCameraBlocked] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef('');
  const tickRef = useRef<number | undefined>(undefined);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const autoStopRef = useRef(false);

  const clearTicker = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = undefined;
    }
  }, []);

  const revokePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewFile(null);
  }, []);

  const hardReset = useCallback(() => {
    clearTicker();
    autoStopRef.current = false;
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    revokePreview();
    setSeconds(0);
    setPhase('idle');
  }, [clearTicker, revokePreview]);

  useEffect(() => () => hardReset(), [hardReset]);

  useEffect(() => {
    if (phase !== 'camera' && phase !== 'recording') return;
    const el = videoElRef.current;
    const stream = streamRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [phase]);

  const beginRecorder = useCallback(
    (stream: MediaStream) => {
      chunksRef.current = [];
      const mime = pickRecorderMime('video');
      mimeRef.current = mime || '';
      if (!mime && typeof MediaRecorder === 'undefined') {
        onError(labels.noCamera);
        stopMediaStream(stream);
        streamRef.current = null;
        setPhase('idle');
        return;
      }
      let recorder: MediaRecorder;
      try {
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
      } catch {
        onError(labels.noCamera);
        stopMediaStream(stream);
        streamRef.current = null;
        setPhase('idle');
        return;
      }
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        clearTicker();
        stopMediaStream(streamRef.current);
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current || 'video/webm',
        });
        chunksRef.current = [];
        if (!blob.size) {
          onError('ضبط ویدیو خالی بود. دوباره امتحان کن.');
          setPhase('idle');
          return;
        }
        const file = buildCaptureFile(blob, 'video', mimeRef.current);
        const url = URL.createObjectURL(blob);
        setPreviewFile(file);
        setPreviewUrl(url);
        setPhase('preview');
      };
      recorder.start(250);
      startedTick();
      setPhase('recording');
    },
    [clearTicker, labels.noCamera, onError]
  );

  function startedTick() {
    clearTicker();
    setSeconds(0);
    const started = Date.now();
    tickRef.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (s >= FACE_VERIFY_MAX_SECONDS && !autoStopRef.current) {
        autoStopRef.current = true;
        try {
          recorderRef.current?.stop();
        } catch {
          hardReset();
        }
      }
    }, 250);
  }

  const openCamera = useCallback(async () => {
    if (disabled || busy || phase !== 'idle') return;
    if (!hasProfilePhoto) {
      onError(labels.needPhoto);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraBlocked(true);
      onError(labels.noCamera);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setCameraBlocked(false);
      setPhase('camera');
    } catch (err) {
      setCameraBlocked(true);
      onError(mediaPermissionErrorMessage(err, 'video'));
      hardReset();
    }
  }, [busy, disabled, hardReset, hasProfilePhoto, labels.needPhoto, labels.noCamera, onError, phase]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || phase !== 'camera') return;
    beginRecorder(stream);
  }, [beginRecorder, phase]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || (rec.state !== 'recording' && rec.state !== 'paused')) return;
    try {
      rec.stop();
    } catch {
      hardReset();
    }
  }, [hardReset]);

  const sendPreview = useCallback(async () => {
    if (!previewFile || phase === 'uploading' || busy) return;
    if (!hasProfilePhoto) {
      onError(labels.needPhoto);
      return;
    }
    setPhase('uploading');
    try {
      await onSubmit(previewFile);
      hardReset();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ارسال ویدیو ناموفق بود');
      setPhase('preview');
    }
  }, [busy, hardReset, hasProfilePhoto, labels.needPhoto, onError, onSubmit, phase, previewFile]);

  const onPickFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!hasProfilePhoto) {
        onError(labels.needPhoto);
        return;
      }
      const mime = (file.type || '').toLowerCase();
      const name = file.name.toLowerCase();
      const isVideo =
        mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(name);
      if (!isVideo) {
        onError('لطفاً یک ویدیوی سلفی کوتاه انتخاب کن (MP4 / WebM / MOV).');
        return;
      }
      revokePreview();
      const url = URL.createObjectURL(file);
      setPreviewFile(file);
      setPreviewUrl(url);
      setPhase('preview');
    },
    [hasProfilePhoto, labels.needPhoto, onError, revokePreview]
  );

  const nearLimit = seconds >= FACE_VERIFY_MAX_SECONDS - 3 && phase === 'recording';
  const locked = disabled || busy;

  const overlay =
    phase === 'camera' || phase === 'recording' || phase === 'preview' || phase === 'uploading'
      ? createPortal(
          <div
            className="tg-capture-overlay face-verify-capture-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="ضبط ویدیو احراز چهره"
          >
            <div className="tg-capture-overlay-inner">
              {profilePhotoUrl ? (
                <div className="face-verify-capture-ref" dir="rtl">
                  <img src={profilePhotoUrl} alt="" />
                  <span>{labels.matchHint}</span>
                </div>
              ) : null}
              <div className="tg-capture-video-stage">
                {phase === 'preview' || phase === 'uploading' ? (
                  previewUrl ? (
                    <video
                      className="tg-capture-video"
                      src={previewUrl}
                      controls
                      playsInline
                      controlsList="nodownload"
                    />
                  ) : null
                ) : (
                  <video
                    ref={videoElRef}
                    className="tg-capture-video"
                    muted={phase !== 'recording'}
                    playsInline
                    autoPlay
                  />
                )}
                {(phase === 'recording' || phase === 'camera') && (
                  <div className={`tg-capture-timer${nearLimit ? ' is-warn' : ''}`} aria-live="polite">
                    {phase === 'recording' ? (
                      <>
                        <span className="tg-capture-rec-dot" aria-hidden />
                        {formatCaptureDuration(seconds)}
                        <span className="tg-capture-timer-max">
                          {' '}
                          / {formatCaptureDuration(FACE_VERIFY_MAX_SECONDS)}
                        </span>
                      </>
                    ) : (
                      labels.ready
                    )}
                  </div>
                )}
              </div>
              <div className="tg-capture-overlay-actions" dir="rtl">
                {phase === 'camera' ? (
                  <>
                    <button type="button" className="tg-capture-btn tg-capture-btn--ghost" onClick={hardReset}>
                      <X size={18} />
                      {labels.cancel}
                    </button>
                    <button
                      type="button"
                      className="tg-capture-btn tg-capture-btn--rec"
                      onClick={startRecording}
                      aria-label={labels.record}
                    >
                      <span className="tg-capture-rec-core" />
                    </button>
                  </>
                ) : null}
                {phase === 'recording' ? (
                  <button
                    type="button"
                    className="tg-capture-btn tg-capture-btn--stop"
                    onClick={stopRecording}
                    aria-label={labels.stop}
                  >
                    <Square size={18} />
                    {labels.stop}
                  </button>
                ) : null}
                {phase === 'preview' ? (
                  <>
                    <button type="button" className="tg-capture-btn tg-capture-btn--ghost" onClick={hardReset}>
                      <Trash2 size={18} />
                      {labels.retake}
                    </button>
                    <button
                      type="button"
                      className="tg-capture-btn tg-capture-btn--send"
                      onClick={() => void sendPreview()}
                    >
                      <Check size={18} />
                      {labels.send}
                    </button>
                  </>
                ) : null}
                {phase === 'uploading' ? (
                  <button type="button" className="tg-capture-btn tg-capture-btn--send" disabled>
                    <Loader2 size={18} className="spin" />
                    {labels.uploading}
                  </button>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="face-verify-capture">
      {!hasProfilePhoto ? (
        <p className="face-verify-capture-need-photo" role="status">
          {labels.needPhoto}
        </p>
      ) : (
        <p className="face-verify-capture-hint">{labels.matchHint}</p>
      )}
      <div className="pepito-profile-verify-actions">
        <button
          type="button"
          className="pepito-btn button-1"
          disabled={locked || !hasProfilePhoto}
          onClick={() => void openCamera()}
        >
          <Camera size={16} aria-hidden />
          {labels.openCamera}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
          capture="user"
          className="pepito-avatar-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            onPickFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="pepito-btn pepito-btn--ghost"
          disabled={locked || !hasProfilePhoto}
          onClick={() => {
            if (!hasProfilePhoto) {
              onError(labels.needPhoto);
              return;
            }
            fileRef.current?.click();
          }}
        >
          {cameraBlocked ? <Upload size={16} aria-hidden /> : <Video size={16} aria-hidden />}
          {labels.pickFile}
        </button>
      </div>
      {overlay}
    </div>
  );
}
