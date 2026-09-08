/**
 * DoorDooria-style nearby list collage + pet profile card (pet photo + owner overlay).
 * Uses sharp + Vazirmatn (file://) so Persian RTL shapes correctly via librsvg/pango.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { PetProfile } from '@petdate/shared';
import {
  mimeFromPetPhotoKey,
  resolvePetPhotoPath,
} from './pet-photo-store';
import {
  resolveUserAvatarPath,
} from './user-avatar-store';

const LIST_WIDTH = 720;
const ROW_H = 118;
const THUMB = 88;
const PAD = 14;
const PROFILE_SIZE = 800;
const OWNER_OVERLAY = 168;

function resolveFont(fileName: string): string | null {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'fonts', fileName),
    path.join(__dirname, '..', '..', 'assets', 'fonts', fileName),
    path.join(process.cwd(), 'assets', 'fonts', fileName),
    path.join(process.cwd(), 'packages', 'api', 'assets', 'fonts', fileName),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function fontFaceCss(): string {
  const regular = resolveFont('Vazirmatn-Regular.ttf');
  const bold = resolveFont('Vazirmatn-Bold.ttf') || regular;
  if (!regular) {
    throw new Error('فونت Vazirmatn پیدا نشد — packages/api/assets/fonts/Vazirmatn-Regular.ttf');
  }
  const regUrl = `file://${regular}`;
  const boldUrl = `file://${bold}`;
  return `
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${regUrl}') format('truetype');
      font-weight: 400;
    }
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${boldUrl}') format('truetype');
      font-weight: 700;
    }
  `;
}

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Eastern Arabic-Indic digits for captions drawn into images */
export function toFaDigits(text: string | number): string {
  return String(text ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}

export function formatDistanceFa(km: number | undefined | null): string {
  if (km == null || !Number.isFinite(km)) return 'فاصله نامشخص';
  if (km < 0.1) return 'نزدیک';
  if (km < 1) return `${toFaDigits(Math.round(km * 1000))} متر`;
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${toFaDigits(rounded)} کیلومتر`;
}

export function formatLastSeenFa(iso?: string | null): string {
  if (!iso) return 'آخرین بازدید نامشخص';
  const raw = String(iso).trim();
  const ms = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
    ? Date.parse(raw.replace(' ', 'T') + 'Z')
    : Date.parse(raw);
  if (!Number.isFinite(ms)) return 'آخرین بازدید نامشخص';
  const hours = (Date.now() - ms) / 3_600_000;
  if (hours < 1) return 'لحظاتی پیش آنلاین بوده';
  if (hours < 12) return 'امروز آنلاین بوده';
  if (hours < 48) return 'آخرین بازدید چند روز پیش';
  if (hours < 24 * 7) return 'این هفته آنلاین بوده';
  return 'آخرین بازدید مدتی پیش';
}

function speciesEmoji(species?: string): string {
  if (species === 'cat') return '🐈';
  if (species === 'dog') return '🐕';
  return '🐾';
}

function genderEmoji(gender?: string): string {
  if (gender === 'female') return '♀';
  if (gender === 'male') return '♂';
  return '';
}

function petPhotoStorageKeyFromUrl(url: string): string | null {
  const m = String(url ?? '')
    .trim()
    .match(/^\/api\/pets\/photos\/(\d+\/[\w.~-]+)$/);
  return m?.[1] ?? null;
}

function userAvatarStorageKeyFromUrl(url: string): string | null {
  const m = String(url ?? '')
    .trim()
    .match(/^\/api\/auth\/avatar\/(\d+\/[\w.~-]+)$/);
  return m?.[1] ?? null;
}

function defaultPetPhotoUrl(pet: { species?: string; id: number }): string {
  const dogs = [
    'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=400&q=80',
  ];
  const cats = [
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=400&q=80',
  ];
  const pool = pet.species === 'cat' ? cats : dogs;
  return pool[pet.id % pool.length]!;
}

async function fetchRemoteBuffer(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

/** Load pet/owner image bytes from local storage, https, or fallback. */
export async function loadImageBuffer(
  imageUrl: string | undefined | null,
  fallbackUrl?: string
): Promise<Buffer | null> {
  const raw = String(imageUrl ?? '').trim();
  if (raw) {
    const petKey = petPhotoStorageKeyFromUrl(raw);
    if (petKey) {
      const abs = resolvePetPhotoPath(petKey);
      if (abs && fs.existsSync(abs)) {
        try {
          return fs.readFileSync(abs);
        } catch {
          /* fall through */
        }
      }
    }
    const avKey = userAvatarStorageKeyFromUrl(raw);
    if (avKey) {
      const abs = resolveUserAvatarPath(avKey);
      if (abs && fs.existsSync(abs)) {
        try {
          return fs.readFileSync(abs);
        } catch {
          /* fall through */
        }
      }
    }
    if (/^https?:\/\//i.test(raw)) {
      const buf = await fetchRemoteBuffer(raw);
      if (buf) return buf;
    }
    // Telegram file_id / opaque — cannot load without Bot API
  }
  if (fallbackUrl) return fetchRemoteBuffer(fallbackUrl);
  return null;
}

async function squareThumb(buf: Buffer | null, size: number, placeholderHue: number): Promise<Buffer> {
  if (buf) {
    try {
      return await sharp(buf, { failOn: 'none' })
        .rotate()
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch {
      /* placeholder */
    }
  }
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="hsl(${placeholderHue},28%,28%)"/>
    <text x="50%" y="54%" text-anchor="middle" font-size="${Math.round(size * 0.36)}" fill="#ddd">🐾</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

export type NearbyListCardItem = PetProfile & {
  ownerAvatarUrl?: string;
  ownerLastSeenAt?: string;
};

export async function renderNearbyListCard(opts: {
  pets: NearbyListCardItem[];
  radiusKm: number;
  page: number;
  totalCount: number;
}): Promise<Buffer> {
  const pets = opts.pets;
  const headerH = 56;
  const height = Math.max(headerH + ROW_H, headerH + pets.length * ROW_H + PAD);
  const layered: sharp.OverlayOptions[] = [];

  const headerSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${LIST_WIDTH}" height="${headerH}" xmlns="http://www.w3.org/2000/svg">
  <defs><style>${fontFaceCss()}
    .h { font-family: Vazirmatn; font-weight: 700; font-size: 22px; fill: #f3f4f6; }
    .s { font-family: Vazirmatn; font-weight: 400; font-size: 15px; fill: #9ca3af; }
  </style></defs>
  <rect width="${LIST_WIDTH}" height="${headerH}" fill="#121218"/>
  <text x="${LIST_WIDTH - PAD}" y="28" class="h" text-anchor="end">🛰️ اطراف من ≥ ${toFaDigits(opts.radiusKm)} کیلومتر</text>
  <text x="${LIST_WIDTH - PAD}" y="48" class="s" text-anchor="end">${toFaDigits(opts.totalCount)} نتیجه · صفحه ${toFaDigits(opts.page + 1)}</text>
</svg>`;
  layered.push({
    input: await sharp(Buffer.from(headerSvg)).png().toBuffer(),
    left: 0,
    top: 0,
  });

  for (let i = 0; i < pets.length; i++) {
    const pet = pets[i]!;
    const top = headerH + i * ROW_H;
    const ageYears =
      pet.ageMonths != null ? toFaDigits(String(Math.max(1, Math.round(pet.ageMonths / 12)))) : '';
    const title = [speciesEmoji(pet.species), genderEmoji(pet.gender), pet.name, ageYears ? `(${ageYears})` : '']
      .filter(Boolean)
      .join(' ');
    const place = pet.ownerCity || pet.city || pet.ownerProvince || '';
    const midParts = [
      formatDistanceFa(pet.distanceKm) + ' 🏁',
      place || null,
      pet.breed || null,
    ].filter(Boolean);
    const mid = midParts.join(' · ');
    const last = formatLastSeenFa(pet.ownerLastSeenAt || pet.updatedAt);
    const rowSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${LIST_WIDTH}" height="${ROW_H}" xmlns="http://www.w3.org/2000/svg">
  <defs><style>${fontFaceCss()}
    .t { font-family: Vazirmatn; font-weight: 700; font-size: 23px; fill: #f9fafb; }
    .m { font-family: Vazirmatn; font-weight: 400; font-size: 16px; fill: #d1d5db; }
    .l { font-family: Vazirmatn; font-weight: 400; font-size: 14px; fill: #9ca3af; }
  </style></defs>
  <rect width="${LIST_WIDTH}" height="${ROW_H}" fill="${i % 2 === 0 ? '#1a1a22' : '#15151c'}"/>
  <line x1="0" y1="${ROW_H - 1}" x2="${LIST_WIDTH}" y2="${ROW_H - 1}" stroke="#2a2a35" stroke-width="1"/>
  <text x="${LIST_WIDTH - PAD}" y="38" class="t" text-anchor="end">${escapeXml(title)}</text>
  <text x="${LIST_WIDTH - PAD}" y="66" class="m" text-anchor="end">${escapeXml(mid)}</text>
  <text x="${LIST_WIDTH - PAD}" y="92" class="l" text-anchor="end">${escapeXml(last)}</text>
</svg>`;
    layered.push({
      input: await sharp(Buffer.from(rowSvg)).png().toBuffer(),
      left: 0,
      top,
    });

    const thumbBuf = await squareThumb(
      await loadImageBuffer(pet.imageUrl, defaultPetPhotoUrl(pet)),
      THUMB,
      (pet.id * 47) % 360
    );
    const thumbX = PAD;
    const thumbY = top + Math.round((ROW_H - THUMB) / 2);
    layered.push({ input: thumbBuf, left: thumbX, top: thumbY });

    if (pet.ownerVerified) {
      const badge = await sharp(
        Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="22" height="22" xmlns="http://www.w3.org/2000/svg">
  <circle cx="11" cy="11" r="10" fill="#16a34a"/>
  <path d="M6 11.5 L9.5 15 L16 7.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
</svg>`)
      )
        .png()
        .toBuffer();
      layered.push({ input: badge, left: thumbX + THUMB - 20, top: thumbY - 2 });
    }
  }

  return sharp({
    create: {
      width: LIST_WIDTH,
      height,
      channels: 3,
      background: { r: 18, g: 18, b: 24 },
    },
  })
    .composite(layered)
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/** Large pet photo with owner avatar composited in a corner (DoorDooria badge slot). */
export async function renderPetProfileCard(opts: {
  pet: PetProfile & { ownerAvatarUrl?: string };
  corner?: 'br' | 'tr';
}): Promise<Buffer> {
  const pet = opts.pet;
  const corner = opts.corner ?? 'br';
  const petBuf = await squareThumb(
    await loadImageBuffer(pet.imageUrl, defaultPetPhotoUrl(pet)),
    PROFILE_SIZE,
    (pet.id * 47) % 360
  );

  const ownerRaw = await loadImageBuffer(pet.ownerAvatarUrl);
  let ownerCircle: Buffer | null = null;
  if (ownerRaw) {
    try {
      const sized = await sharp(ownerRaw, { failOn: 'none' })
        .rotate()
        .resize(OWNER_OVERLAY, OWNER_OVERLAY, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      const mask = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OWNER_OVERLAY}" height="${OWNER_OVERLAY}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${OWNER_OVERLAY / 2}" cy="${OWNER_OVERLAY / 2}" r="${OWNER_OVERLAY / 2}" fill="#fff"/>
</svg>`);
      const circled = await sharp(sized)
        .composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }])
        .png()
        .toBuffer();
      const ring = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OWNER_OVERLAY + 10}" height="${OWNER_OVERLAY + 10}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${(OWNER_OVERLAY + 10) / 2}" cy="${(OWNER_OVERLAY + 10) / 2}" r="${OWNER_OVERLAY / 2 + 3}" fill="none" stroke="#ffffff" stroke-width="6"/>
  <circle cx="${(OWNER_OVERLAY + 10) / 2}" cy="${(OWNER_OVERLAY + 10) / 2}" r="${OWNER_OVERLAY / 2 + 3}" fill="none" stroke="#16a34a" stroke-width="2"/>
</svg>`);
      ownerCircle = await sharp({
        create: {
          width: OWNER_OVERLAY + 10,
          height: OWNER_OVERLAY + 10,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          { input: await sharp(ring).png().toBuffer(), left: 0, top: 0 },
          { input: circled, left: 5, top: 5 },
        ])
        .png()
        .toBuffer();
    } catch (err) {
      console.warn('owner overlay failed:', (err as Error).message);
    }
  }

  const overlays: sharp.OverlayOptions[] = [];
  if (ownerCircle) {
    const inset = 28;
    const left =
      corner === 'tr' || corner === 'br'
        ? PROFILE_SIZE - OWNER_OVERLAY - 10 - inset
        : inset;
    const top = corner === 'tr' ? inset : PROFILE_SIZE - OWNER_OVERLAY - 10 - inset;
    overlays.push({ input: ownerCircle, left, top });
  }

  // Small "صاحب" chip near overlay
  if (ownerCircle) {
    const chip = await sharp(
      Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="90" height="28" xmlns="http://www.w3.org/2000/svg">
  <defs><style>${fontFaceCss()}
    .c { font-family: Vazirmatn; font-size: 14px; fill: #fff; font-weight: 700; }
  </style></defs>
  <rect width="90" height="28" rx="14" fill="#16a34a"/>
  <text x="45" y="19" class="c" text-anchor="middle">صاحب پت</text>
</svg>`)
    )
      .png()
      .toBuffer();
    const inset = 28;
    const left = PROFILE_SIZE - OWNER_OVERLAY - 10 - inset + Math.round((OWNER_OVERLAY + 10 - 90) / 2);
    const top =
      (corner === 'tr' ? inset : PROFILE_SIZE - OWNER_OVERLAY - 10 - inset) + OWNER_OVERLAY + 10 - 6;
    if (top + 28 < PROFILE_SIZE) {
      overlays.push({ input: chip, left, top });
    }
  }

  return sharp(petBuf)
    .composite(overlays)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export function petPhotoContentType(storageKey: string): string {
  return mimeFromPetPhotoKey(storageKey);
}
