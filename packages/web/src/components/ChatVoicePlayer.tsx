import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';

type Props = {
  src: string;
  mimeType?: string | null;
  secure?: boolean;
  onBroken?: () => void;
};

/**
 * WhatsApp/Telegram-style voice bubble: fetch media as a blob (correct MIME),
 * then play via object URL — fixes Android WebView failing on bare audio URLs
 * and cross-device playback when Content-Type was wrong.
 */
export function ChatVoicePlayer({ src, mimeType, secure, onBroken }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);
    setBlobUrl(null);
    setProgress(0);
    setPlaying(false);

    (async () => {
      try {
        const res = await fetch(src, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const headerType = (res.headers.get('content-type') || '')
          .split(';')[0]!
          .trim();
        const type =
          headerType && headerType !== 'application/octet-stream'
            ? headerType
            : mimeType || 'audio/webm';
        const blob = new Blob([buf], { type });
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setBlobUrl(objectUrl);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
          onBroken?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, mimeType, onBroken]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d > 0) {
        setDuration(d);
        setProgress(el.currentTime / d);
      }
    };
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      el.currentTime = 0;
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [blobUrl]);

  async function toggle() {
    const el = audioRef.current;
    if (!el || !blobUrl) return;
    try {
      if (el.paused) await el.play();
      else el.pause();
    } catch {
      setError(true);
      onBroken?.();
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setProgress(ratio);
  }

  const bars = WAVE_BARS;
  const clock =
    duration > 0
      ? formatVoiceClock(playing || progress > 0 ? duration * progress : duration)
      : '0:00';

  if (error) {
    return (
      <div className="tg-voice-player is-broken" role="status">
        پیام صوتی در دسترس نیست
      </div>
    );
  }

  return (
    <div className={`tg-voice-player${playing ? ' is-playing' : ''}`}>
      {blobUrl ? (
        <audio
          ref={audioRef}
          src={blobUrl}
          preload="metadata"
          playsInline
          controlsList={secure ? 'nodownload noplaybackrate' : undefined}
          onContextMenu={secure ? (ev) => ev.preventDefault() : undefined}
        />
      ) : null}
      <button
        type="button"
        className="tg-voice-play"
        onClick={() => void toggle()}
        disabled={loading || !blobUrl}
        aria-label={playing ? 'توقف' : 'پخش پیام صوتی'}
      >
        {loading ? (
          <Loader2 size={18} className="tg-spin" aria-hidden />
        ) : playing ? (
          <Pause size={18} aria-hidden />
        ) : (
          <Play size={18} aria-hidden />
        )}
      </button>
      <div className="tg-voice-body">
        <div
          className="tg-voice-wave"
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="پیشرفت پیام صوتی"
          onClick={seek}
        >
          {bars.map((h, i) => {
            const lit = progress > 0 && i / bars.length <= progress;
            return (
              <span
                key={i}
                className={`tg-voice-bar${lit ? ' is-lit' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <span className="tg-voice-time">{clock}</span>
      </div>
    </div>
  );
}

function formatVoiceClock(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

const WAVE_BARS = [
  28, 44, 62, 38, 72, 48, 86, 40, 68, 52, 90, 34, 58, 76, 42, 64, 50, 82, 36, 70, 46, 78, 54, 66,
  32, 60, 74, 48, 88, 40, 56, 70,
];
