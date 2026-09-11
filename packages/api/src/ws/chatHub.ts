import type { Server as HttpServer } from 'http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { dbService } from '../db';
import { getUserFromBearer } from '../services/web-otp';

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
  | {
      type: 'typing';
      channel: 'playmate' | 'vet';
      threadId: number;
      userId: number;
    }
  | { type: 'hello'; userId: number }
  | { type: 'error'; message: string };

type ClientState = {
  ws: WebSocket;
  userId: number;
  rooms: Set<string>;
};

const clients = new Set<ClientState>();

/** Throttle patient typing → DB activity touches (ms). */
const TYPING_TOUCH_MIN_MS = 5_000;
const lastTypingTouchMs = new Map<number, number>();

function roomInbox(userId: number) {
  return `inbox:${userId}`;
}
function roomPlaymate(id: number) {
  return `playmate:${id}`;
}
function roomVet(id: number) {
  return `vet:${id}`;
}

function send(ws: WebSocket, event: ChatSocketEvent) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(event));
  } catch {
    /* ignore */
  }
}

function broadcast(room: string, event: ChatSocketEvent, exceptUserId?: number) {
  for (const client of clients) {
    if (!client.rooms.has(room)) continue;
    if (exceptUserId != null && client.userId === exceptUserId) continue;
    send(client.ws, event);
  }
}

export function notifyInbox(
  userIds: Array<number | null | undefined>,
  payload: Omit<Extract<ChatSocketEvent, { type: 'inbox' }>, 'type'> & { type?: 'inbox' }
) {
  const unique = [...new Set(userIds.filter((id): id is number => Number.isFinite(id) && id! > 0))];
  for (const userId of unique) {
    broadcast(roomInbox(userId), {
      type: 'inbox',
      kind: payload.kind,
      reason: payload.reason,
      id: payload.id,
    });
  }
}

export function notifyPlaymateMessage(threadId: number, message: unknown, participantIds: number[]) {
  broadcast(roomPlaymate(threadId), {
    type: 'message',
    channel: 'playmate',
    threadId,
    message,
  });
  notifyInbox(participantIds, { kind: 'playmate', reason: 'message', id: threadId });
}

export function notifyVetMessage(threadId: number, message: unknown, participantIds: number[]) {
  broadcast(roomVet(threadId), {
    type: 'message',
    channel: 'vet',
    threadId,
    message,
  });
  notifyInbox(participantIds, { kind: 'vet', reason: 'message', id: threadId });
}

export function notifyPlaymateThread(
  threadId: number,
  participantIds: number[],
  patch: Record<string, unknown>
) {
  broadcast(roomPlaymate(threadId), {
    type: 'thread',
    channel: 'playmate',
    threadId,
    patch,
  });
  notifyInbox(participantIds, { kind: 'playmate', reason: 'thread', id: threadId });
}

export function notifyVetThread(
  threadId: number,
  participantIds: number[],
  patch: Record<string, unknown>
) {
  broadcast(roomVet(threadId), {
    type: 'thread',
    channel: 'vet',
    threadId,
    patch,
  });
  notifyInbox(participantIds, { kind: 'vet', reason: 'thread', id: threadId });
}

export function notifyPresence(userId: number, online: boolean, lastSeenAt?: string | null) {
  for (const client of clients) {
    // Presence is useful to anyone looking at inbox/thread; send to all connected peers
    // that share an inbox subscription with this user is complex — broadcast to all
    // authenticated sockets except self is fine at current scale.
    if (client.userId === userId) continue;
    send(client.ws, { type: 'presence', userId, online, lastSeenAt });
  }
}

function parseMessage(raw: RawData): Record<string, unknown> | null {
  try {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw as ArrayBuffer).toString('utf8');
    const data = JSON.parse(text) as unknown;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Attach chat WebSocket at path `/api/ws/chat`.
 * Auth: `?token=` session token (same as Bearer web session).
 */
export function attachChatWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: '/api/ws/chat',
    maxPayload: 64 * 1024,
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = (url.searchParams.get('token') || '').trim();
    const session = getUserFromBearer(token ? `Bearer ${token}` : undefined);
    if (!session?.user?.id) {
      send(ws, { type: 'error', message: 'unauthorized' });
      ws.close(4401, 'unauthorized');
      return;
    }

    const userId = session.user.id;
    const client: ClientState = {
      ws,
      userId,
      rooms: new Set([roomInbox(userId)]),
    };
    clients.add(client);
    send(ws, { type: 'hello', userId });

    ws.on('message', (raw) => {
      const data = parseMessage(raw);
      if (!data) return;
      const type = String(data.type || '');

      if (type === 'ping') {
        send(ws, { type: 'hello', userId: client.userId });
        return;
      }

      if (type === 'subscribe') {
        const channel = String(data.channel || '');
        const threadId = Number(data.threadId);
        if (!Number.isFinite(threadId) || threadId <= 0) return;
        if (channel === 'playmate') client.rooms.add(roomPlaymate(threadId));
        if (channel === 'vet') {
          // Chat room only after vet accepts — pending consults must not join.
          const consult = dbService.getVetConsultation(threadId);
          if (
            !consult ||
            consult.status !== 'active' ||
            Boolean(consult.chatEnded) ||
            (consult.vetUserId !== client.userId &&
              consult.patientUserId !== client.userId)
          ) {
            return;
          }
          client.rooms.add(roomVet(threadId));
        }
        return;
      }

      if (type === 'unsubscribe') {
        const channel = String(data.channel || '');
        const threadId = Number(data.threadId);
        if (!Number.isFinite(threadId) || threadId <= 0) return;
        if (channel === 'playmate') client.rooms.delete(roomPlaymate(threadId));
        if (channel === 'vet') client.rooms.delete(roomVet(threadId));
        return;
      }

      // Patient typing in an active consult resets the idle-close timer.
      if (type === 'typing') {
        const channel = String(data.channel || '');
        const threadId = Number(data.threadId);
        if (channel !== 'vet' || !Number.isFinite(threadId) || threadId <= 0) return;
        const consult = dbService.getVetConsultation(threadId);
        if (
          !consult ||
          consult.status !== 'active' ||
          Boolean(consult.chatEnded) ||
          consult.patientUserId !== client.userId
        ) {
          return;
        }
        const now = Date.now();
        const prev = lastTypingTouchMs.get(threadId) ?? 0;
        if (now - prev >= TYPING_TOUCH_MIN_MS) {
          lastTypingTouchMs.set(threadId, now);
          dbService.touchVetConsultPatientActivity(threadId);
        }
        // Fan out typing indicator to the other participant (optional UI).
        broadcast(
          roomVet(threadId),
          {
            type: 'typing',
            channel: 'vet',
            threadId,
            userId: client.userId,
          },
          client.userId
        );
      }
    });

    ws.on('close', () => {
      clients.delete(client);
    });
    ws.on('error', () => {
      clients.delete(client);
    });
  });

  return wss;
}
