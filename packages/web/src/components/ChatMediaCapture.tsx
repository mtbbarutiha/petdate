import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Mic, Square, Trash2, Video, X } from 'lucide-react';
import {
  MAX_VIDEO_SECONDS,
  MAX_VOICE_SECONDS,
  buildCaptureFile,
  formatCaptureDuration,
  mediaPermissionErrorMessage,
  pickRecorderMime,
  stopMediaStream,
} from '../lib/chatMediaRecorder';
import { MAX_CHAT_ATTACH_BYTES } from '../lib/chatMediaUpload';

type CapturePhase =
  | 'idle'
  | 'recording-voice'
  | 'preview-voice'
  | 'camera'
  | 'recording-video'
  | 'preview-video'
  | 'sending';

type CaptureApi = {
  occupied: boolean;
  disabled: boolean;
  startVoice: () => void;
  openCamera: () => void;
};

const ChatMediaCaptureContext = createContext<CaptureApi | null>(null);

type ProviderProps = {
  disabled?: boolean;
  onError: (message: string) => void;
  onSend: (file: File) => void | Promise<void>;
  onOccupiedChange?: (occupied: boolean) => void;
  children: ReactNode;
};

/**
 * Shared in-chat voice/video capture (WhatsApp/Telegram style).
 * Wrap the composer shell; render triggers beside Send and session UI as sibling.
 */
export function ChatMediaCaptureProvider({
  disabled = false,
  onError,
  onSend,
  onOccupiedChange,
  children,
}: ProviderProps) {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>('');
  const tickRef = useRef<number | undefined>(undefined);
  const startedAtRef = useRef(0);
  const maxSecondsRef = useRef(MAX_VOICE_SECONDS);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const autoStopRef = useRef(false);

  const occupied =
    phase === 'recording-voice' ||
    phase === 'preview-voice' ||
    phase === 'camera' ||
    phase === 'recording-video' ||
    phase === 'preview-video' ||
    phase === 'sending';

  useEffect(() => {
    onOccupiedChange?.(occupied);
  }, [occupied, onOccupiedChange]);

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

  const startTicker = useCallback(
    (maxSeconds: number) => {
      clearTicker();
      maxSecondsRef.current = maxSeconds;
      startedAtRef.current = Date.now();
      setSeconds(0);
      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= maxSecondsRef.current && !autoStopRef.current) {
          autoStopRef.current = true;
          try {
            recorderRef.current?.stop();
          } catch {
            /* ignore */
          }
        }
      }, 250);
    },
    [clearTicker],
  );

  const finishToPreview = useCallback(
    (kind: 'voice' | 'video') => {
      clearTicker();
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;

      const mime = mimeRef.current || (kind === 'voice' ? 'audio/webm' : 'video/webm');
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];

      if (!blob.size) {
        onError(
          kind === 'voice'
            ? 'ضبط صدا خالی بود. دوباره امتحان کن.'
            : 'ضبط ویدیو خالی بود. دوباره امتحان کن.',
        );
        setPhase('idle');
        return;
      }
      if (blob.size > MAX_CHAT_ATTACH_BYTES) {
        onError('حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)');
        setPhase('idle');
        return;
      }

      const file = buildCaptureFile(blob, kind, mime);
      const url = URL.createObjectURL(file);
      revokePreview();
      setPreviewFile(file);
      setPreviewUrl(url);
      setPhase(kind === 'voice' ? 'preview-voice' : 'preview-video');
    },
    [clearTicker, onError, revokePreview],
  );

  const beginRecorder = useCallback(
    (stream: MediaStream, kind: 'audio' | 'video', nextPhase: CapturePhase) => {
      const mime = pickRecorderMime(kind);
      if (!mime && typeof MediaRecorder === 'undefined') {
        stopMediaStream(stream);
        onError('مرورگر شما از ضبط رسانه پشتیبانی نمی‌کند.');
        return;
      }
      mimeRef.current = mime || (kind === 'audio' ? 'audio/webm' : 'video/webm');
      chunksRef.current = [];
      autoStopRef.current = false;

      let recorder: MediaRecorder;
      try {
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
        if (!mime && recorder.mimeType) mimeRef.current = recorder.mimeType;
      } catch (err) {
        stopMediaStream(stream);
        onError(mediaPermissionErrorMessage(err, kind));
        return;
      }

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onerror = () => {
        onError(kind === 'audio' ? 'خطا هنگام ضبط صدا.' : 'خطا هنگام ضبط ویدیو.');
        hardReset();
      };
      recorder.onstop = () => {
        finishToPreview(kind === 'audio' ? 'voice' : 'video');
      };

      streamRef.current = stream;
      recorderRef.current = recorder;
      setPhase(nextPhase);
      startTicker(kind === 'audio' ? MAX_VOICE_SECONDS : MAX_VIDEO_SECONDS);
      try {
        recorder.start(250);
      } catch (err) {
        onError(mediaPermissionErrorMessage(err, kind));
        hardReset();
      }
    },
    [finishToPreview, hardReset, onError, startTicker],
  );

  const startVoice = useCallback(async () => {
    if (disabled || occupied) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onError('این مرورگر از ضبط صدا پشتیبانی نمی‌کند.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      beginRecorder(stream, 'audio', 'recording-voice');
    } catch (err) {
      onError(mediaPermissionErrorMessage(err, 'audio'));
    }
  }, [beginRecorder, disabled, occupied, onError]);

  const openCamera = useCallback(async () => {
    if (disabled || occupied) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onError('این مرورگر از ضبط ویدیو پشتیبانی نمی‌کند.');
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
      setPhase('camera');
    } catch (err) {
      onError(mediaPermissionErrorMessage(err, 'video'));
      hardReset();
    }
  }, [disabled, hardReset, occupied, onError]);

  useEffect(() => {
    if (phase !== 'camera' && phase !== 'recording-video') return;
    const el = videoElRef.current;
    const stream = streamRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [phase]);

  const startVideoRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || phase !== 'camera') return;
    beginRecorder(stream, 'video', 'recording-video');
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
    if (!previewFile || phase === 'sending') return;
    setPhase('sending');
    try {
      await onSend(previewFile);
      hardReset();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ارسال رسانه ناموفق بود');
      setPhase(previewFile.type.startsWith('video/') ? 'preview-video' : 'preview-voice');
    }
  }, [hardReset, onError, onSend, phase, previewFile]);

  const api = useMemo<CaptureApi>(
    () => ({
      occupied,
      disabled,
      startVoice: () => {
        void startVoice();
      },
      openCamera: () => {
        void openCamera();
      },
    }),
    [disabled, occupied, openCamera, startVoice],
  );

  const nearLimit =
    seconds >=
      (phase === 'recording-video' || phase === 'preview-video'
        ? MAX_VIDEO_SECONDS
        : MAX_VOICE_SECONDS) -
        5 &&
    (phase === 'recording-voice' || phase === 'recording-video');

  let session: ReactNode = null;

  if (phase === 'camera' || phase === 'recording-video' || phase === 'preview-video') {
    const overlay = (
      <div className="tg-capture-overlay" role="dialog" aria-modal="true" aria-label="ضبط ویدیو">
        <div className="tg-capture-overlay-inner">
          <div className="tg-capture-video-stage">
            {phase === 'preview-video' && previewUrl ? (
              <video
                className="tg-capture-video"
                src={previewUrl}
                controls
                playsInline
                controlsList="nodownload"
              />
            ) : (
              <video
                ref={videoElRef}
                className="tg-capture-video"
                muted={phase !== 'recording-video'}
                playsInline
                autoPlay
              />
            )}
            {(phase === 'recording-video' || phase === 'camera') && (
              <div className={`tg-capture-timer${nearLimit ? ' is-warn' : ''}`} aria-live="polite">
                {phase === 'recording-video' ? (
                  <>
                    <span className="tg-capture-rec-dot" aria-hidden />
                    {formatCaptureDuration(seconds)}
                    <span className="tg-capture-timer-max">
                      {' '}
                      / {formatCaptureDuration(MAX_VIDEO_SECONDS)}
                    </span>
                  </>
                ) : (
                  'آماده ضبط'
                )}
              </div>
            )}
          </div>
          <div className="tg-capture-overlay-actions" dir="rtl">
            {phase === 'camera' ? (
              <>
                <button type="button" className="tg-capture-btn tg-capture-btn--ghost" onClick={hardReset}>
                  <X size={18} />
                  انصراف
                </button>
                <button
                  type="button"
                  className="tg-capture-btn tg-capture-btn--rec"
                  onClick={startVideoRecording}
                  aria-label="شروع ضبط ویدیو"
                >
                  <span className="tg-capture-rec-core" />
                </button>
              </>
            ) : null}
            {phase === 'recording-video' ? (
              <button
                type="button"
                className="tg-capture-btn tg-capture-btn--stop"
                onClick={stopRecording}
                aria-label="توقف ضبط"
              >
                <Square size={18} />
                توقف
              </button>
            ) : null}
            {phase === 'preview-video' ? (
              <>
                <button type="button" className="tg-capture-btn tg-capture-btn--ghost" onClick={hardReset}>
                  <Trash2 size={18} />
                  حذف
                </button>
                <button
                  type="button"
                  className="tg-capture-btn tg-capture-btn--send"
                  onClick={() => void sendPreview()}
                  aria-label="ارسال ویدیو"
                >
                  <Check size={18} />
                  ارسال
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
    const threadHost =
      typeof document !== 'undefined'
        ? document.querySelector('.tg-thread:not(.tg-thread--blank)')
        : null;
    session = threadHost ? createPortal(overlay, threadHost) : overlay;
  } else if (phase === 'recording-voice' || phase === 'preview-voice' || phase === 'sending') {
    session = (
      <div className="tg-capture-bar" dir="rtl" role="status" aria-live="polite">
        <button
          type="button"
          className="tg-capture-icon-btn is-danger"
          onClick={hardReset}
          disabled={phase === 'sending'}
          aria-label="لغو ضبط"
          title="لغو"
        >
          <Trash2 size={18} />
        </button>
        <div className="tg-capture-bar-main">
          {phase === 'recording-voice' ? (
            <>
              <span className="tg-capture-rec-dot" aria-hidden />
              <span className={`tg-capture-bar-time${nearLimit ? ' is-warn' : ''}`}>
                {formatCaptureDuration(seconds)}
                <span className="tg-capture-timer-max">
                  {' '}
                  / {formatCaptureDuration(MAX_VOICE_SECONDS)}
                </span>
              </span>
              <span className="tg-capture-bar-hint">در حال ضبط صدا…</span>
            </>
          ) : null}
          {phase === 'preview-voice' && previewUrl ? (
            <audio
              className="tg-capture-audio-preview"
              src={previewUrl}
              controls
              preload="metadata"
              controlsList="nodownload"
            />
          ) : null}
          {phase === 'sending' ? (
            <span className="tg-capture-bar-hint">
              <Loader2 size={16} className="tg-spin" /> در حال ارسال…
            </span>
          ) : null}
        </div>
        {phase === 'recording-voice' ? (
          <button
            type="button"
            className="tg-capture-icon-btn is-stop"
            onClick={stopRecording}
            aria-label="پایان ضبط"
            title="توقف"
          >
            <Square size={16} />
          </button>
        ) : null}
        {phase === 'preview-voice' ? (
          <button
            type="button"
            className="tg-capture-icon-btn is-send"
            onClick={() => void sendPreview()}
            aria-label="ارسال پیام صوتی"
            title="ارسال"
          >
            <Check size={18} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <ChatMediaCaptureContext.Provider value={api}>
      {session}
      {children}
    </ChatMediaCaptureContext.Provider>
  );
}

/** Mic + video buttons (Telegram-style replace Send when composer empty). */
export function ChatMediaCaptureTriggers() {
  const api = useContext(ChatMediaCaptureContext);
  if (!api || api.occupied) return null;
  return (
    <div className="tg-capture-triggers">
      <button
        type="button"
        className="tg-capture-trigger"
        onClick={api.openCamera}
        disabled={api.disabled}
        aria-label="ضبط ویدیو"
        title="ضبط ویدیو"
      >
        <Video size={20} />
      </button>
      <button
        type="button"
        className="tg-capture-trigger tg-capture-trigger--mic"
        onClick={api.startVoice}
        disabled={api.disabled}
        aria-label="ضبط صدا"
        title="ضبط صدا"
      >
        <Mic size={20} />
      </button>
    </div>
  );
}

/** @deprecated use ChatMediaCaptureProvider + Triggers */
export function ChatMediaCapture() {
  return null;
}
