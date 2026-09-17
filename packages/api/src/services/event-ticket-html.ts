/**
 * Event ticket HTML (print-ready) — purple/pink stub layout matching Pet Date sample.
 */
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import {
  BRAND,
  EVENT_TICKET_CTA_FA,
  EVENT_TICKET_EXCLUSIVE_BADGE_FA,
  EVENT_TICKET_FRIENDSHIP_FA,
  EVENT_TICKET_SCAN_FA,
  EVENT_TICKET_TYPE_LABEL_FA,
  EVENT_TICKET_YOURS_FA,
  SITE,
  formatPersianDateTime,
  toPersianDigits,
  type EventTicketPublicView,
} from '@petdate/shared';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveLogoPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'brand', 'petdate-email-logo.png'),
    path.join(process.cwd(), 'packages', 'api', 'assets', 'brand', 'petdate-email-logo.png'),
    path.join(process.cwd(), 'packages', 'web', 'public', 'pepito', 'img', 'logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function logoDataUri(): string {
  const p = resolveLogoPath();
  if (p) {
    try {
      return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
    } catch {
      /* fall through */
    }
  }
  return `${SITE.origin}/pepito/img/logo.png`;
}

export async function eventTicketQrSvg(payload: string, size = 168): Promise<string> {
  return QRCode.toString(payload, {
    type: 'svg',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#2a1848', light: '#ffffff' },
  });
}

export async function eventTicketQrPngBuffer(payload: string, size = 280): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#2a1848', light: '#ffffff' },
  });
}

function faTime(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (!Number.isFinite(d.getTime())) return '—';
  try {
    return toPersianDigits(
      d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  } catch {
    return toPersianDigits(iso.slice(11, 16));
  }
}

function faDate(iso: string): string {
  const full = formatPersianDateTime(iso) || iso;
  // Prefer date portion before em-dash/time
  const cut = full.split(/[—–\-]/)[0]?.trim() || full;
  return cut;
}

export async function renderEventTicketHtml(view: EventTicketPublicView): Promise<string> {
  const qrSvg = await eventTicketQrSvg(view.qrPayload || view.publicUrl, 176);
  const logo = logoDataUri();
  const validClass = view.isValid ? '' : ' ticket--expired';
  const capacity = `${toPersianDigits(view.currentPlayers)} از ${toPersianDigits(view.maxPlayers)}`;
  const petName = escapeHtml(view.petName || '—');
  const species = escapeHtml(view.petSpeciesLabel || view.petSpecies || 'پت');
  const owner = escapeHtml(view.ownerName || '—');
  const title = escapeHtml(view.eventTitle);
  const loc = escapeHtml(view.eventLocation || [view.eventCity, view.eventProvince].filter(Boolean).join('، '));
  const photo = view.eventPhotoUrl
    ? escapeHtml(view.eventPhotoUrl.startsWith('http') ? view.eventPhotoUrl : `${SITE.origin}${view.eventPhotoUrl}`)
    : '';
  const petImg = view.petImageUrl
    ? escapeHtml(view.petImageUrl.startsWith('http') ? view.petImageUrl : `${SITE.origin}${view.petImageUrl}`)
    : '';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>بلیط ${title} | ${escapeHtml(BRAND.displayNameFa)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@500;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --pd-purple: #5b2d8e;
      --pd-purple-deep: #3d1a66;
      --pd-pink: #e91e8c;
      --pd-pink-soft: #fff0f7;
      --pd-ink: #2a1848;
      --pd-muted: #6b5a7a;
      --pd-radius: 22px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Vazirmatn, Tahoma, sans-serif;
      background:
        radial-gradient(ellipse at 20% 0%, #fce7f3 0%, transparent 50%),
        radial-gradient(ellipse at 90% 20%, #ede9fe 0%, transparent 45%),
        linear-gradient(160deg, #faf5ff 0%, #fff1f8 45%, #f5f3ff 100%);
      color: var(--pd-ink);
      padding: 24px 16px 48px;
    }
    .wrap { max-width: 920px; margin: 0 auto; }
    .ticket {
      display: grid;
      grid-template-columns: 1fr 240px;
      background: #fff;
      border-radius: var(--pd-radius);
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(91, 45, 142, 0.18);
      border: 2px solid rgba(233, 30, 140, 0.25);
      position: relative;
    }
    .ticket--expired { filter: grayscale(0.35); opacity: 0.85; }
    .main {
      position: relative;
      padding: 18px 20px 16px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.96)),
        ${photo ? `url('${photo}') center/cover no-repeat` : 'linear-gradient(135deg,#fdf2f8,#f3e8ff)'};
    }
    .main::before {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.88));
      pointer-events: none;
    }
    .main > * { position: relative; z-index: 1; }
    .top {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
      margin-bottom: 12px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand img { width: 48px; height: 48px; object-fit: contain; }
    .brand-text strong { display: block; font-size: 1.15rem; color: var(--pd-purple); }
    .brand-text span { font-size: 0.72rem; letter-spacing: 0.06em; color: var(--pd-pink); font-weight: 700; }
    .badge {
      background: var(--pd-pink); color: #fff; font-weight: 800; font-size: 0.82rem;
      padding: 8px 16px; border-radius: 999px; box-shadow: 0 6px 16px rgba(233,30,140,0.35);
    }
    .event-title {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--pd-purple); color: #fff; font-weight: 800;
      padding: 10px 16px; border-radius: 14px; font-size: 1rem; max-width: 100%;
    }
    .hero {
      margin: 14px 0; border-radius: 16px; overflow: hidden; min-height: 140px;
      background: ${photo ? `url('${photo}') center/cover` : 'linear-gradient(120deg,#c4b5fd,#f9a8d4)'};
      position: relative;
    }
    .hero-caption {
      position: absolute; right: 14px; bottom: 12px; color: #fff; font-weight: 700;
      text-shadow: 0 2px 8px rgba(0,0,0,0.45); font-size: 0.9rem;
    }
    .meta {
      background: rgba(255,255,255,0.92); border-radius: 14px; padding: 12px 14px;
      display: grid; gap: 8px; border: 1px solid rgba(91,45,142,0.12);
    }
    .meta-row { display: flex; align-items: center; gap: 10px; font-size: 0.92rem; }
    .meta-ico {
      width: 28px; height: 28px; border-radius: 8px; background: #f3e8ff; color: var(--pd-purple);
      display: grid; place-items: center; font-size: 0.85rem; flex-shrink: 0;
    }
    .bar {
      margin-top: 14px; background: var(--pd-purple-deep); border-radius: 14px;
      padding: 12px; display: grid; grid-template-columns: auto 1fr 1fr 1fr auto; gap: 8px; align-items: center;
    }
    .avatar {
      width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 3px solid #fbbf24;
      background: #fff;
    }
    .avatar-fallback {
      width: 52px; height: 52px; border-radius: 50%; background: #f9a8d4; display: grid; place-items: center;
      font-size: 1.4rem; border: 3px solid #fbbf24;
    }
    .cell { background: rgba(255,255,255,0.12); border-radius: 10px; padding: 8px 10px; color: #fff; min-width: 0; }
    .cell label { display: block; font-size: 0.68rem; opacity: 0.85; margin-bottom: 2px; }
    .cell strong { font-size: 0.9rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cta {
      background: var(--pd-pink); color: #fff; font-weight: 800; font-size: 0.78rem;
      padding: 10px 12px; border-radius: 16px 16px 16px 4px; max-width: 120px; line-height: 1.35;
      box-shadow: 0 6px 14px rgba(233,30,140,0.4);
    }
    .foot {
      margin-top: 10px; display: flex; justify-content: space-between; gap: 8px;
      color: var(--pd-muted); font-size: 0.78rem; font-weight: 700;
    }
    .stub {
      background: linear-gradient(180deg, #fff5fa, #ffe4f1);
      border-right: 2px dashed rgba(233,30,140,0.45);
      padding: 16px 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
    }
    .stub-brand { font-weight: 800; color: var(--pd-purple); font-size: 0.95rem; }
    .stub-tag { font-size: 0.65rem; letter-spacing: 0.05em; color: var(--pd-pink); font-weight: 700; }
    .qr-btn {
      background: var(--pd-pink); color: #fff; font-weight: 800; font-size: 0.78rem;
      padding: 6px 12px; border-radius: 999px;
    }
    .qr-box {
      position: relative; background: #fff; padding: 8px; border-radius: 12px;
      box-shadow: 0 4px 14px rgba(91,45,142,0.12);
    }
    .qr-box svg { display: block; width: 160px; height: 160px; }
    .qr-heart {
      position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none;
      font-size: 1.35rem; filter: drop-shadow(0 1px 2px rgba(255,255,255,0.9));
    }
    .tid {
      font-size: 0.72rem; font-weight: 700; border: 1.5px dashed rgba(91,45,142,0.35);
      padding: 8px 10px; border-radius: 10px; background: #fff; width: 100%; word-break: break-all;
    }
    .cap { font-size: 0.82rem; font-weight: 700; color: var(--pd-ink); }
    .yours {
      background: #3b82f6; color: #fff; font-weight: 800; font-size: 0.78rem;
      padding: 8px 10px; border-radius: 10px; width: 100%;
    }
    .scan { font-size: 0.75rem; font-weight: 700; color: var(--pd-muted); line-height: 1.4; }
    .actions { margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    .actions a, .actions button {
      appearance: none; border: 0; cursor: pointer; text-decoration: none;
      background: var(--pd-purple); color: #fff; font-family: inherit; font-weight: 700;
      padding: 10px 18px; border-radius: 12px; font-size: 0.9rem;
    }
    .actions a.secondary { background: #fff; color: var(--pd-purple); border: 2px solid var(--pd-purple); }
    @media (max-width: 760px) {
      .ticket { grid-template-columns: 1fr; }
      .stub { border-right: 0; border-top: 2px dashed rgba(233,30,140,0.45); }
      .bar { grid-template-columns: auto 1fr 1fr; }
      .bar .cta { grid-column: 1 / -1; max-width: none; border-radius: 12px; text-align: center; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .actions { display: none; }
      .ticket { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <article class="ticket${validClass}" data-ticket-code="${escapeHtml(view.ticketCode)}">
      <section class="main">
        <div class="top">
          <div class="brand">
            <img src="${logo}" alt="${escapeHtml(BRAND.displayName)}" />
            <div class="brand-text">
              <strong>${escapeHtml(BRAND.displayName)}</strong>
              <span>${escapeHtml(BRAND.taglineEn)}</span>
            </div>
          </div>
          <span class="badge">${EVENT_TICKET_EXCLUSIVE_BADGE_FA}</span>
          <span class="event-title">🌸 ${title}</span>
        </div>
        <div class="hero">
          <span class="hero-caption">${EVENT_TICKET_FRIENDSHIP_FA}</span>
        </div>
        <div class="meta">
          <div class="meta-row"><span class="meta-ico">📅</span><span>تاریخ رویداد: ${escapeHtml(faDate(view.eventScheduledAt))}</span></div>
          <div class="meta-row"><span class="meta-ico">⏰</span><span>ساعت شروع: ${escapeHtml(faTime(view.eventScheduledAt))}</span></div>
          <div class="meta-row"><span class="meta-ico">📍</span><span>مکان: ${loc || '—'}</span></div>
        </div>
        <div class="bar">
          ${
            petImg
              ? `<img class="avatar" src="${petImg}" alt="${petName}" />`
              : `<div class="avatar-fallback" aria-hidden="true">🐾</div>`
          }
          <div class="cell"><label>نام پت</label><strong>${petName} · ${species}</strong></div>
          <div class="cell"><label>صاحب پت</label><strong>${owner}</strong></div>
          <div class="cell"><label>نوع بلیط</label><strong>${EVENT_TICKET_TYPE_LABEL_FA}</strong></div>
          <div class="cta">${EVENT_TICKET_CTA_FA}</div>
        </div>
        <div class="foot">
          <span>${escapeHtml(SITE.domain)}</span>
          <span>${escapeHtml(BRAND.taglineEn)}</span>
        </div>
      </section>
      <aside class="stub">
        <div class="stub-brand">${escapeHtml(BRAND.displayName)}</div>
        <div class="stub-tag">${escapeHtml(BRAND.taglineEn)}</div>
        <div class="qr-btn">⚡ QR Ticket</div>
        <div class="qr-box">${qrSvg}<div class="qr-heart" aria-hidden="true">💗</div></div>
        <div class="tid">Ticket ID: ${escapeHtml(view.ticketCode)}</div>
        <div class="cap">👥 شرکت‌کننده: ${capacity}</div>
        <div class="yours">✓ ${EVENT_TICKET_YOURS_FA}</div>
        <div class="scan">📷 ${EVENT_TICKET_SCAN_FA}</div>
      </aside>
    </article>
    <div class="actions">
      <button type="button" onclick="window.print()">چاپ بلیط</button>
      <a class="secondary" href="/events">بازگشت به ایونت‌ها</a>
    </div>
  </div>
</body>
</html>`;
}
