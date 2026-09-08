import { useEffect, useRef, useState } from 'react';

export type ChatSocketEvent =
  | {
      type: 'inbox';
      kind: 'playmate' | 'vet' | 'any';
      reason?: string;
      id?: number;
    }
  | {
      type: 'message';
      channel: 'playmate' | 'vet';
      threadId: number;
      message: unknown;
    }
  | {
      type: 'thread';
      channel: 'playmate' | 'vet';
      threadId: number;
      patch: Record<string, unknown>;
    }
  | {
      type: 'presence';
      userId: number;
      online: boolean;
      lastSeenAt?: string | null;
    }
  | { type: 'hello'; userId: number }
  | { type: 'error'; message: string };

export type ChatSocketStatus = 'idle' | 'connecting' | 'open' | 'closed';

type ThreadSub = { channel: 'playmate' | 'vet'; threadId: number } | null | undefined;

/** Dedicated WS host (bypasses main-site CDN when DNS points to origin). */
const DEFAULT_WS_HOST = 'ws.petdate.ir';

/** After this many hard failures, pause reconnects until the tab is focused again. */
const MAX_FAILURES_BEFORE_PAUSE = 3;
const PAUSE_RETRY_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

type Listener = (event: ChatSocketEvent) => void;

type SharedSocket = {
  token: string;
  ws: WebSocket | null;
  status: ChatSocketStatus;
  failures: number;
  pausedUntil: number;
  retryTimer: number | undefined;
  pingTimer: number | undefined;
  retryMs: number;
  listeners: Set<Listener>;
  statusListeners: Set<(status: ChatSocketStatus) => void>;
  /**
   * Desired thread rooms from each useChatSocket caller.
   * Multiple hooks share one socket (ChatPage + LiveIncomingRequests); a caller
   * with thread=null must NOT wipe another caller's playmate/vet subscription.
   */
  threadDesires: Map<object, string>;
  /** Rooms currently subscribed on the open socket. */
  activeThreadRooms: Set<string>;
  refCount: number;
};

let shared: SharedSocket | null = null;

function buildWsUrl(token: string): string {
  const explicit =
    (import.meta.env.VITE_WS_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  if (explicit.startsWith('ws://') || explicit.startsWith('wss://')) {
    const u = new URL(explicit);
    if (!u.pathname || u.pathname === '/') u.pathname = '/api/ws/chat';
    u.search = `token=${encodeURIComponent(token)}`;
    return u.toString();
  }

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    const u = new URL(apiBase);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = `${u.pathname.replace(/\/$/, '')}/api/ws/chat`;
    u.search = `token=${encodeURIComponent(token)}`;
    return u.toString();
  }

  // Production: dedicated WS host (CDN on petdate.ir blocks Upgrade with 404).
  // If DNS for ws.petdate.ir still points at CDN, the circuit breaker pauses retries.
  const host = window.location.hostname;
  if (host === 'petdate.ir' || host === 'www.petdate.ir' || host === DEFAULT_WS_HOST) {
    return `wss://${DEFAULT_WS_HOST}/api/ws/chat?token=${encodeURIComponent(token)}`;
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws/chat?token=${encodeURIComponent(token)}`;
}

function setSharedStatus(next: ChatSocketStatus) {
  if (!shared || shared.status === next) return;
  shared.status = next;
  for (const fn of shared.statusListeners) fn(next);
}

function clearSharedTimers() {
  if (!shared) return;
  window.clearTimeout(shared.retryTimer);
  window.clearInterval(shared.pingTimer);
  shared.retryTimer = undefined;
  shared.pingTimer = undefined;
}

function scheduleReconnect() {
  if (!shared) return;
  clearSharedTimers();

  const now = Date.now();
  if (shared.failures >= MAX_FAILURES_BEFORE_PAUSE) {
    shared.pausedUntil = Math.max(shared.pausedUntil, now + PAUSE_RETRY_MS);
  }
  const wait = Math.max(shared.retryMs, shared.pausedUntil - now);
  shared.retryTimer = window.setTimeout(() => {
    if (!shared) return;
    shared.retryMs = Math.min(MAX_BACKOFF_MS, Math.round(shared.retryMs * 1.7));
    openSharedSocket();
  }, wait);
}

function parseThreadKey(key: string): { channel: string; threadId: number } | null {
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  const channel = key.slice(0, idx);
  const threadId = Number(key.slice(idx + 1));
  if (!Number.isFinite(threadId) || threadId <= 0) return null;
  if (channel !== 'playmate' && channel !== 'vet') return null;
  return { channel, threadId };
}

/**
 * Reconcile server subscriptions with the union of all callers' desired rooms.
 * Safe when LiveIncomingRequests (no thread) coexists with ChatPage (playmate:N).
 */
function syncThreadSubscriptions() {
  if (!shared?.ws || shared.ws.readyState !== WebSocket.OPEN) return;

  const desired = new Set<string>();
  for (const key of shared.threadDesires.values()) {
    if (key) desired.add(key);
  }

  for (const key of [...shared.activeThreadRooms]) {
    if (desired.has(key)) continue;
    const parsed = parseThreadKey(key);
    if (parsed) {
      try {
        shared.ws.send(
          JSON.stringify({
            type: 'unsubscribe',
            channel: parsed.channel,
            threadId: parsed.threadId,
          }),
        );
      } catch {
        /* ignore */
      }
    }
    shared.activeThreadRooms.delete(key);
  }

  for (const key of desired) {
    if (shared.activeThreadRooms.has(key)) continue;
    const parsed = parseThreadKey(key);
    if (!parsed) continue;
    try {
      shared.ws.send(
        JSON.stringify({
          type: 'subscribe',
          channel: parsed.channel,
          threadId: parsed.threadId,
        }),
      );
      shared.activeThreadRooms.add(key);
    } catch {
      /* ignore */
    }
  }
}

function setThreadDesire(owner: object, thread: ThreadSub) {
  if (!shared) return;
  const key =
    thread?.threadId && thread.channel ? `${thread.channel}:${thread.threadId}` : '';
  const prev = shared.threadDesires.get(owner);
  if (prev === key) {
    // Still reconcile in case the socket reconnected with empty active rooms.
    syncThreadSubscriptions();
    return;
  }
  shared.threadDesires.set(owner, key);
  syncThreadSubscriptions();
}

function clearThreadDesire(owner: object) {
  if (!shared) return;
  if (!shared.threadDesires.has(owner)) return;
  shared.threadDesires.delete(owner);
  syncThreadSubscriptions();
}

function openSharedSocket() {
  if (!shared) return;
  if (
    shared.ws &&
    (shared.ws.readyState === WebSocket.OPEN || shared.ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  setSharedStatus('connecting');
  const token = shared.token;
  let socket: WebSocket;
  try {
    socket = new WebSocket(buildWsUrl(token));
  } catch {
    shared.failures += 1;
    setSharedStatus('closed');
    scheduleReconnect();
    return;
  }
  shared.ws = socket;

  socket.onopen = () => {
    if (!shared || shared.ws !== socket) return;
    shared.failures = 0;
    shared.pausedUntil = 0;
    shared.retryMs = 800;
    // Fresh socket — re-subscribe every desired room.
    shared.activeThreadRooms.clear();
    setSharedStatus('open');
    clearSharedTimers();
    syncThreadSubscriptions();
    window.dispatchEvent(new Event('petdate:ws-open'));
    shared.pingTimer = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25_000);
  };

  socket.onmessage = (ev) => {
    if (!shared) return;
    try {
      const data = JSON.parse(String(ev.data)) as ChatSocketEvent;
      if (data && typeof data === 'object' && 'type' in data) {
        for (const fn of shared.listeners) fn(data);
      }
    } catch {
      /* ignore */
    }
  };

  socket.onclose = () => {
    if (!shared || shared.ws !== socket) return;
    shared.ws = null;
    shared.activeThreadRooms.clear();
    shared.failures += 1;
    setSharedStatus('closed');
    window.clearInterval(shared.pingTimer);
    shared.pingTimer = undefined;
    if (shared.refCount <= 0) return;
    scheduleReconnect();
  };

  socket.onerror = () => {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  };
}

function retainShared(token: string) {
  if (shared && shared.token !== token) {
    releaseShared(true);
  }
  if (!shared) {
    shared = {
      token,
      ws: null,
      status: 'idle',
      failures: 0,
      pausedUntil: 0,
      retryTimer: undefined,
      pingTimer: undefined,
      retryMs: 800,
      listeners: new Set(),
      statusListeners: new Set(),
      threadDesires: new Map(),
      activeThreadRooms: new Set(),
      refCount: 0,
    };
  }
  shared.refCount += 1;
  if (!shared.ws || shared.ws.readyState === WebSocket.CLOSED) {
    openSharedSocket();
  }
  return shared;
}

function releaseShared(force = false) {
  if (!shared) return;
  if (!force) shared.refCount = Math.max(0, shared.refCount - 1);
  if (!force && shared.refCount > 0) return;

  clearSharedTimers();
  try {
    shared.ws?.close();
  } catch {
    /* ignore */
  }
  shared = null;
}

/**
 * Live chat transport (shared singleton).
 * Callers should keep a slow ajax poll only when `connected` is false.
 * Reconnects are circuit-broken after repeated CDN/WS failures so the chats
 * page does not thrash.
 *
 * On `petdate:ws-open`, callers should catch-up-poll messages (subscribe races /
 * dropped frames while the socket looked "up").
 */
export function useChatSocket({
  token,
  enabled,
  thread,
  onEvent,
}: {
  token: string | null | undefined;
  enabled: boolean;
  thread?: ThreadSub;
  onEvent: (event: ChatSocketEvent) => void;
}): { status: ChatSocketStatus; connected: boolean } {
  const [status, setStatus] = useState<ChatSocketStatus>('idle');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const ownerRef = useRef<object | null>(null);
  if (!ownerRef.current) ownerRef.current = {};

  useEffect(() => {
    if (!enabled || !token) {
      setStatus('idle');
      return;
    }

    const owner = ownerRef.current!;
    const sock = retainShared(token);
    setStatus(sock.status);

    const listener: Listener = (event) => onEventRef.current(event);
    const onStatus = (next: ChatSocketStatus) => setStatus(next);
    sock.listeners.add(listener);
    sock.statusListeners.add(onStatus);

    const onVis = () => {
      if (document.visibilityState !== 'visible' || !shared) return;
      // Allow a fresh attempt after a pause when the user comes back.
      if (shared.status !== 'open' && Date.now() >= shared.pausedUntil) {
        shared.failures = 0;
        shared.retryMs = 800;
        openSharedSocket();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      sock.listeners.delete(listener);
      sock.statusListeners.delete(onStatus);
      clearThreadDesire(owner);
      releaseShared();
    };
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !token || !ownerRef.current) return;
    setThreadDesire(ownerRef.current, thread);
    return () => {
      // Keep desire until unmount of the retain effect — only clear on full release.
      // Updating desire on dependency change is enough; clearing here would flicker
      // unsubscribe between Strict Mode double-invokes. Final clear is in retain cleanup.
    };
  }, [enabled, token, thread?.channel, thread?.threadId, status]);

  return { status, connected: status === 'open' };
}
