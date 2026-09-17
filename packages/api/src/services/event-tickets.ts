/**
 * Event tickets — create on join, list mine, public lookup.
 */
import {
  EVENT_TICKET_TYPE_LABEL_FA,
  PET_SPECIES_LABELS,
  eventTicketExpiresAtIso,
  eventTicketPublicPath,
  eventTicketPublicUrl,
  isEventTicketCurrentlyValid,
  makeEventTicketCode,
  normalizeEventTicketCode,
  type EventTicketPublicView,
  type EventTicketStatus,
  type EventTicketSummary,
  type Game,
} from '@petdate/shared';
import { getDb } from '../db';
import { sendEventTicketSms } from './event-ticket-sms';

export function ensureEventTicketsSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      game_id INTEGER NOT NULL REFERENCES games(id),
      pet_id INTEGER REFERENCES pets(id),
      qr_payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'valid',
      expires_at TEXT,
      sms_sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, game_id)
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_event_tickets_user ON event_tickets (user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_event_tickets_game ON event_tickets (game_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_event_tickets_code ON event_tickets (ticket_code)`);
}

function mapRow(row: Record<string, unknown>, game?: Game | null): EventTicketSummary {
  const ticketCode = String(row.ticket_code);
  const status = String(row.status || 'valid') as EventTicketStatus;
  const expiresAt = row.expires_at != null ? String(row.expires_at) : null;
  const isValid = isEventTicketCurrentlyValid({
    status,
    expiresAt,
    gameStatus: game?.status,
    scheduledAt: game?.scheduledAt ?? undefined,
  });
  return {
    id: Number(row.id),
    ticketCode,
    userId: Number(row.user_id),
    gameId: Number(row.game_id),
    petId: row.pet_id != null ? Number(row.pet_id) : null,
    qrPayload: String(row.qr_payload || ''),
    status,
    expiresAt,
    smsSentAt: row.sms_sent_at != null ? String(row.sms_sent_at) : null,
    createdAt: String(row.created_at),
    publicPath: eventTicketPublicPath(ticketCode),
    publicUrl: eventTicketPublicUrl(ticketCode),
    isValid,
  };
}

function pickUserPet(userId: number): { id: number; name: string; species: string; imageUrl?: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, species, image_url FROM pets
       WHERE owner_id = ?
       ORDER BY id ASC
       LIMIT 1`
    )
    .get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    name: String(row.name),
    species: String(row.species || ''),
    imageUrl: row.image_url != null ? String(row.image_url) : undefined,
  };
}

function getGameRow(gameId: number): Game | null {
  // Lazy import to avoid circular init with dbService during boot
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { dbService } = require('../db') as typeof import('../db');
  return dbService.getGame(gameId);
}

export function getEventTicketByCode(rawCode: string): EventTicketSummary | null {
  ensureEventTicketsSchema();
  const code = normalizeEventTicketCode(rawCode) || String(rawCode || '').trim().toUpperCase();
  if (!code) return null;
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM event_tickets WHERE ticket_code = ? OR ticket_code = ?')
    .get(code, String(rawCode || '').trim()) as Record<string, unknown> | undefined;
  if (!row) return null;
  const game = getGameRow(Number(row.game_id));
  return mapRow(row, game);
}

export function getEventTicketByUserGame(userId: number, gameId: number): EventTicketSummary | null {
  ensureEventTicketsSchema();
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM event_tickets WHERE user_id = ? AND game_id = ?')
    .get(userId, gameId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const game = getGameRow(gameId);
  return mapRow(row, game);
}

export function listEventTicketsForUser(
  userId: number,
  opts?: { includeExpired?: boolean }
): EventTicketSummary[] {
  ensureEventTicketsSchema();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM event_tickets WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(userId) as Record<string, unknown>[];
  const includeExpired = Boolean(opts?.includeExpired);
  const out: EventTicketSummary[] = [];
  for (const row of rows) {
    const game = getGameRow(Number(row.game_id));
    const summary = mapRow(row, game);
    if (!includeExpired && !summary.isValid) continue;
    out.push(summary);
  }
  return out;
}

export function buildEventTicketPublicView(ticket: EventTicketSummary): EventTicketPublicView | null {
  const game = getGameRow(ticket.gameId);
  if (!game) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { dbService } = require('../db') as typeof import('../db');
  const user = dbService.getUserById(ticket.userId);
  let petName: string | undefined;
  let species: string | undefined;
  let petImageUrl: string | undefined;
  if (ticket.petId != null) {
    const pet = dbService.getPet(ticket.petId);
    if (pet) {
      petName = pet.name;
      species = pet.species;
      petImageUrl = pet.imageUrl;
    }
  }
  if (!petName) {
    const fallback = pickUserPet(ticket.userId);
    if (fallback) {
      petName = fallback.name;
      species = fallback.species;
      petImageUrl = fallback.imageUrl;
    }
  }

  const speciesLabel = species
    ? PET_SPECIES_LABELS[species] || (species === 'dog' ? 'سگ' : species === 'cat' ? 'گربه' : species)
    : undefined;

  return {
    ...ticket,
    eventTitle: game.title,
    eventScheduledAt: game.scheduledAt,
    eventLocation: game.location,
    eventProvince: game.province,
    eventCity: game.city,
    eventPhotoUrl: game.photoUrl,
    currentPlayers: game.currentPlayers,
    maxPlayers: game.maxPlayers,
    ownerName: user?.name || 'کاربر پت‌دیت',
    petName,
    petSpecies: species,
    petSpeciesLabel: speciesLabel,
    petImageUrl,
    ticketTypeLabel: EVENT_TICKET_TYPE_LABEL_FA,
    isValid: isEventTicketCurrentlyValid({
      status: ticket.status,
      expiresAt: ticket.expiresAt,
      gameStatus: game.status,
      scheduledAt: game.scheduledAt,
    }),
  };
}

/**
 * Create (or return existing) ticket for a user after joining / hosting an event.
 * Optionally sends SMS with the public ticket link.
 */
export async function issueEventTicketForJoin(opts: {
  userId: number;
  gameId: number;
  sendSms?: boolean;
}): Promise<{
  ticket: EventTicketSummary;
  created: boolean;
  sms?: Awaited<ReturnType<typeof sendEventTicketSms>>;
}> {
  ensureEventTicketsSchema();
  const existing = getEventTicketByUserGame(opts.userId, opts.gameId);
  if (existing) {
    return { ticket: existing, created: false };
  }

  const game = getGameRow(opts.gameId);
  if (!game) {
    throw new Error('EVENT_NOT_FOUND');
  }

  const pet = pickUserPet(opts.userId);
  const db = getDb();
  const expiresAt = eventTicketExpiresAtIso(game.scheduledAt);

  const insert = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO event_tickets (ticket_code, user_id, game_id, pet_id, qr_payload, status, expires_at)
         VALUES (?, ?, ?, ?, ?, 'valid', ?)`
      )
      .run(
        `TMP-${opts.userId}-${opts.gameId}-${Date.now()}`,
        opts.userId,
        opts.gameId,
        pet?.id ?? null,
        'pending',
        expiresAt
      );
    const id = Number(info.lastInsertRowid);
    const code = makeEventTicketCode({
      id,
      city: game.city,
      province: game.province,
      scheduledAt: game.scheduledAt,
    });
    // Ensure uniqueness if collision (rare) — append id
    let finalCode = code;
    const clash = db.prepare('SELECT id FROM event_tickets WHERE ticket_code = ? AND id != ?').get(finalCode, id);
    if (clash) {
      finalCode = `${code}-${id}`;
    }
    const publicUrl = eventTicketPublicUrl(finalCode);
    db.prepare('UPDATE event_tickets SET ticket_code = ?, qr_payload = ? WHERE id = ?').run(
      finalCode,
      publicUrl,
      id
    );
    return db.prepare('SELECT * FROM event_tickets WHERE id = ?').get(id) as Record<string, unknown>;
  })();

  const ticket = mapRow(insert, game);

  let sms: Awaited<ReturnType<typeof sendEventTicketSms>> | undefined;
  if (opts.sendSms !== false) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dbService } = require('../db') as typeof import('../db');
    const user = dbService.getUserById(opts.userId);
    sms = await sendEventTicketSms({
      rawPhone: user?.phone,
      eventTitle: game.title,
      ticketCode: ticket.ticketCode,
      customerId: opts.userId,
    });
    if (sms.sent) {
      db.prepare(`UPDATE event_tickets SET sms_sent_at = datetime('now') WHERE id = ?`).run(ticket.id);
      ticket.smsSentAt = new Date().toISOString();
    }
  }

  return { ticket, created: true, sms };
}
