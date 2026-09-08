import fs from 'fs';
import path from 'path';
import {
  PET_GENDER_LABELS,
  PET_SIZE_LABELS,
  PET_SPECIES_LABELS,
  formatPetAge,
  type PetProfile,
} from '@petdate/shared';
import { infra } from '../config/infra';
import {
  mimeFromPetPhotoKey,
  resolvePetPhotoPath,
} from './pet-photo-store';
import { telegramFetch, telegramBotApiUrl } from './telegram-http';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function defaultPetPhoto(pet: { species?: string; id: number }): string {
  const dogs = [
    'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80',
  ];
  const cats = [
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
  ];
  const pool = pet.species === 'cat' ? cats : dogs;
  return pool[pet.id % pool.length]!;
}

function formatPetHtml(pet: PetProfile): string {
  const species = PET_SPECIES_LABELS[pet.species] ?? pet.species;
  const lines = [
    `🐾 <b>${escapeHtml(pet.name)}</b>`,
    `${species}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ''}`,
  ];
  const ownerLoc = [pet.ownerProvince, pet.ownerCity || pet.city].filter(Boolean).join('، ');
  if (ownerLoc) lines.push(`📍 ${escapeHtml(ownerLoc)}`);
  else if (pet.city) {
    lines.push(
      `📍 ${escapeHtml(pet.city)}${pet.neighborhood ? ` — ${escapeHtml(pet.neighborhood)}` : ''}`
    );
  }
  if (pet.ownerName) lines.push(`👤 صاحب: ${escapeHtml(pet.ownerName)}`);
  if (pet.ownerVerified) lines.push('✅ صاحب پت احراز شده');
  if (pet.gender) lines.push(`⚧ ${PET_GENDER_LABELS[pet.gender] ?? pet.gender}`);
  if (pet.ageMonths) lines.push(`🎂 ${formatPetAge(pet.ageMonths)}`);
  if (pet.size) lines.push(`📏 ${PET_SIZE_LABELS[pet.size] ?? pet.size}`);
  if (pet.color) lines.push(`🎨 ${escapeHtml(pet.color)}`);
  lines.push(pet.vaccinated ? '💉 واکسن زده' : '🚫 واکسن نزده');
  lines.push(pet.neutered ? '✂️ عقیم شده' : '➖ عقیم نشده');
  if (pet.bio) lines.push(`💬 ${escapeHtml(pet.bio)}`);
  lines.push(pet.lookingForPlaymate ? '🔍 دنبال همبازی' : '⏸️ فعلاً همبازی نمی‌خواد');
  return lines.filter(Boolean).join('\n');
}

/** Keep JSON Telegram calls short; multipart photo upload may need longer. */
const TELEGRAM_CALL_TIMEOUT_MS = 4000;
const TELEGRAM_UPLOAD_TIMEOUT_MS = 20000;

function publicHttpsOrigin(): string | null {
  for (const cand of [
    process.env.PUBLIC_API_URL,
    process.env.API_PUBLIC_URL,
    process.env.PUBLIC_WEB_URL,
    process.env.WEB_URL,
  ]) {
    const v = String(cand ?? '')
      .trim()
      .replace(/\/$/, '');
    if (/^https:\/\//i.test(v)) return v;
  }
  return null;
}

/** Local pet-photos API path → storage key `ownerId/filename`. */
export function petPhotoStorageKeyFromUrl(url: string): string | null {
  const m = String(url ?? '')
    .trim()
    .match(/^\/api\/pets\/photos\/(\d+\/[\w.~-]+)$/);
  return m?.[1] ?? null;
}

export type ResolvedNotifyPhoto =
  | { kind: 'ref'; value: string }
  | { kind: 'upload'; buffer: Buffer; filename: string; contentType: string };

/**
 * Turn pets.image_url into something Telegram sendPhoto accepts.
 * Relative `/api/pets/photos/...` paths have no host — Telegram rejects them
 * with "invalid file HTTP URL specified: URL host is empty". Prefer uploading
 * the local file; otherwise absolutize with a public HTTPS origin.
 */
export function resolvePlaydateNotifyPhoto(pet: PetProfile): ResolvedNotifyPhoto {
  const raw = String(pet.imageUrl ?? '').trim();
  if (!raw) return { kind: 'ref', value: defaultPetPhoto(pet) };

  if (/^https?:\/\//i.test(raw)) {
    return { kind: 'ref', value: raw };
  }

  const storageKey = petPhotoStorageKeyFromUrl(raw);
  if (storageKey) {
    const abs = resolvePetPhotoPath(storageKey);
    if (abs && fs.existsSync(abs)) {
      try {
        return {
          kind: 'upload',
          buffer: fs.readFileSync(abs),
          filename: path.basename(storageKey) || 'pet.jpg',
          contentType: mimeFromPetPhotoKey(storageKey),
        };
      } catch (err) {
        console.warn('playdate notify read local photo failed:', (err as Error).message);
      }
    }
    const origin = publicHttpsOrigin();
    if (origin) return { kind: 'ref', value: `${origin}${raw}` };
    return { kind: 'ref', value: defaultPetPhoto(pet) };
  }

  // Other site-relative paths (avatars, proxied images, …)
  if (raw.startsWith('/')) {
    const origin = publicHttpsOrigin();
    if (origin) return { kind: 'ref', value: `${origin}${raw}` };
    return { kind: 'ref', value: defaultPetPhoto(pet) };
  }

  // Opaque Telegram file_id stored by the bot
  return { kind: 'ref', value: raw };
}

async function telegramCall(
  method: string,
  body: Record<string, unknown>,
  timeoutMs = TELEGRAM_CALL_TIMEOUT_MS
): Promise<boolean> {
  const token = infra.telegram.botToken;
  if (!token) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await telegramFetch(telegramBotApiUrl(token, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn(`telegram ${method} failed:`, data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`telegram ${method} error:`, (err as Error).message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function telegramSendPhotoUpload(opts: {
  chatId: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
  caption: string;
  replyMarkup: unknown;
}): Promise<boolean> {
  const token = infra.telegram.botToken;
  if (!token) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_UPLOAD_TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append('chat_id', opts.chatId);
    form.append('caption', opts.caption.slice(0, 1024));
    form.append('parse_mode', 'HTML');
    form.append('reply_markup', JSON.stringify(opts.replyMarkup));
    form.append(
      'photo',
      new Blob([new Uint8Array(opts.buffer)], { type: opts.contentType || 'image/jpeg' }),
      opts.filename || 'pet.jpg'
    );
    const res = await telegramFetch(telegramBotApiUrl(token, 'sendPhoto'), {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.warn('telegram sendPhoto upload failed:', data.description ?? res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('telegram sendPhoto upload error:', (err as Error).message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Notify recipient owner on Telegram when a playdate request is created
 * (same payload as bot notifyIncomingPlaydateRequest).
 */
export async function notifyPlaydateRequestTelegram(opts: {
  requestId: number;
  toTelegramId: string;
  fromPet: PetProfile;
  toPetName: string;
  speciesLabel?: string;
}): Promise<boolean> {
  if (!infra.telegram.botToken || !opts.toTelegramId) return false;
  const tgId = String(opts.toTelegramId).trim();
  if (!tgId || /^(fake_|demo_)/i.test(tgId)) return false;

  // سایلنت درخواست چت: درخواست در لیست می‌ماند؛ نوتیف تلگرام ارسال نمی‌شود
  try {
    const { dbService } = await import('../db');
    const recipient = dbService.getUserByTelegramId(tgId);
    if (recipient?.silentChatRequests) return false;
  } catch {
    /* ignore — still notify */
  }

  const speciesLabel =
    opts.speciesLabel ?? PET_SPECIES_LABELS[opts.fromPet.species] ?? opts.fromPet.species;
  const caption = [
    '📬 <b>درخواست همبازی جدید</b>',
    '',
    `از طرف <b>${escapeHtml(opts.fromPet.name)}</b> برای <b>${escapeHtml(opts.toPetName)}</b>`,
    speciesLabel ? `دسته: ${escapeHtml(speciesLabel)}` : null,
    '',
    formatPetHtml(opts.fromPet),
  ]
    .filter((l) => l !== null)
    .join('\n')
    .slice(0, 1024);

  // Same layout as bot playdateActionKeyboard — accept/reject + owner profile.
  // callback_data: playdate:owner:<id> fits Telegram's 64-byte limit.
  const reply_markup = {
    inline_keyboard: [
      [
        { text: '✅ قبول', callback_data: `playdate:accept:${opts.requestId}` },
        { text: '❌ رد', callback_data: `playdate:reject:${opts.requestId}` },
      ],
      [
        {
          text: '👤 مشاهده پروفایل صاحب پت',
          callback_data: `playdate:owner:${opts.requestId}`,
        },
      ],
    ],
  };

  const photo = resolvePlaydateNotifyPhoto(opts.fromPet);
  let sentPhoto = false;
  if (photo.kind === 'upload') {
    sentPhoto = await telegramSendPhotoUpload({
      chatId: tgId,
      buffer: photo.buffer,
      filename: photo.filename,
      contentType: photo.contentType,
      caption,
      replyMarkup: reply_markup,
    });
  } else {
    sentPhoto = await telegramCall('sendPhoto', {
      chat_id: tgId,
      photo: photo.value,
      caption,
      parse_mode: 'HTML',
      reply_markup,
    });
  }
  if (sentPhoto) return true;

  return telegramCall('sendMessage', {
    chat_id: tgId,
    text: caption,
    parse_mode: 'HTML',
    reply_markup,
  });
}
