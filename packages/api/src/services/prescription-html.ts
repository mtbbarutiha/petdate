/**
 * Public web (HTML) view of a veterinary prescription —
 * RTL, لوگو مادر (mother logo) embedded as base64 for reliable PDF/print.
 */
import fs from 'fs';
import path from 'path';
import { PET_SPECIES_LABELS, SITE } from '@petdate/shared';

const RX_BRAND_EN = 'Pet Date Dr';

/** Same file as packages/web/public/pepito/img/logo.png (لوگو مادر). */
export const PRESCRIPTION_LOGO_ASSET = 'petdate-dr-logo.png';

export type PrescriptionHtmlInput = {
  prescriptionId: number;
  vetName: string;
  patientName: string;
  petName: string;
  petSpecies?: string;
  petBreed?: string;
  medicationText: string;
  dateIso?: string;
  pdfUrl?: string;
  /** Override logo src; default embeds لوگو مادر as data URI. */
  logoUrl?: string;
};

/**
 * Resolve لوگو مادر for Rx HTML/PDF — prefers api brand copy of pepito logo.png.
 */
export function resolvePrescriptionLogoPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'brand', PRESCRIPTION_LOGO_ASSET),
    path.join(__dirname, '..', '..', 'assets', 'brand', PRESCRIPTION_LOGO_ASSET),
    path.join(process.cwd(), 'assets', 'brand', PRESCRIPTION_LOGO_ASSET),
    path.join(process.cwd(), 'packages', 'api', 'assets', 'brand', PRESCRIPTION_LOGO_ASSET),
    path.join(process.cwd(), 'packages', 'web', 'public', 'pepito', 'img', 'logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** data:image/png;base64,… of لوگو مادر, or static path fallback. */
export function prescriptionLogoSrc(): string {
  const p = resolvePrescriptionLogoPath();
  if (p) {
    try {
      const buf = fs.readFileSync(p);
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      /* fall through */
    }
  }
  return `/assets/brand/${PRESCRIPTION_LOGO_ASSET}`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toAsciiDigits(text: string): string {
  return String(text ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function formatFaDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (!Number.isFinite(d.getTime())) {
    return toAsciiDigits(new Date().toLocaleDateString('fa-IR'));
  }
  try {
    return toAsciiDigits(
      d.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function jalaliYear(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  try {
    return toAsciiDigits(
      new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(d)
    );
  } catch {
    return String(d.getFullYear());
  }
}

function speciesLabel(species?: string): string | undefined {
  if (!species) return undefined;
  return PET_SPECIES_LABELS[species] || species;
}

function medLinesHtml(text: string): string {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return '<p class="med-line">—</p>';
  return lines
    .map((l) => `<p class="med-line">${escapeHtml(toAsciiDigits(l))}</p>`)
    .join('\n');
}

/** True when hostname is a raw IPv4 (never use for user-facing rx / SMS links). */
function isRawIpHostname(host: string): boolean {
  const h = String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h.split('%')[0] || '');
}

function originFromCandidate(raw: string | undefined | null): string | null {
  if (!raw || !String(raw).trim()) return null;
  const trimmed = String(raw).trim().replace(/\/$/, '');
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (isRawIpHostname(u.hostname)) return null;
    if (/^localhost$|^127\.0\.0\.1$/i.test(u.hostname)) return null;
    return `${u.protocol}//${u.host}`.replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * Absolute public site origin for user-facing links (SMS / Telegram / chat).
 * Prefers PUBLIC_WEB_URL / WEB_URL — never a bare VPS IP.
 */
export function publicWebOrigin(reqHost?: string): string {
  const fromEnv =
    originFromCandidate(process.env.PUBLIC_WEB_URL) ||
    originFromCandidate(process.env.WEB_URL) ||
    originFromCandidate(process.env.PUBLIC_ORIGIN) ||
    originFromCandidate(process.env.APP_PUBLIC_URL) ||
    originFromCandidate(process.env.WEB_PUBLIC_URL) ||
    originFromCandidate(process.env.PUBLIC_API_URL) ||
    originFromCandidate(process.env.API_PUBLIC_URL);
  if (fromEnv) return fromEnv;

  if (reqHost) {
    const hostOnly = String(reqHost).split(',')[0]!.trim().split(':')[0]!;
    if (
      !isRawIpHostname(hostOnly) &&
      !/^localhost$|^127\.0\.0\.1$/i.test(hostOnly)
    ) {
      const proto = process.env.PUBLIC_API_PROTO || 'https';
      return `${proto}://${reqHost.replace(/\/$/, '')}`;
    }
  }

  return SITE.origin;
}

/**
 * Origin for prescription PDF download links (SMS / chat captions).
 * Prefers PUBLIC_PDF_URL (e.g. https://pdf.petdate.ir); never a bare VPS IP.
 */
export function publicPdfOrigin(): string {
  return (
    originFromCandidate(process.env.PUBLIC_PDF_URL) ||
    originFromCandidate(process.env.PDF_PUBLIC_URL) ||
    'https://pdf.petdate.ir'
  );
}

/** @deprecated Prefer publicWebOrigin for user-facing rx links. */
export function publicApiBaseUrl(reqHost?: string): string {
  return publicWebOrigin(reqHost);
}

export function prescriptionWebPath(id: number): string {
  return `/rx/${id}`;
}

/**
 * Path on the main site (petdate.ir/rx/{id}/pdf) — HTML page / legacy.
 * Prefer prescriptionPdfPublicPath for SMS download links.
 */
export function prescriptionPdfWebPath(id: number): string {
  return `/rx/${id}/pdf`;
}

/** Stable PDF download path on pdf.petdate.ir: /rx/{id}.pdf */
export function prescriptionPdfPublicPath(id: number): string {
  return `/rx/${id}.pdf`;
}

export function prescriptionPublicUrl(id: number, reqHost?: string): string {
  return `${publicWebOrigin(reqHost)}${prescriptionWebPath(id)}`;
}

/**
 * Absolute HTTPS PDF download URL for SMS / share.
 * Example: https://pdf.petdate.ir/rx/42.pdf
 */
export function prescriptionPdfPublicUrl(id: number, _reqHost?: string): string {
  return `${publicPdfOrigin()}${prescriptionPdfPublicPath(id)}`;
}

export function renderPrescriptionHtml(input: PrescriptionHtmlInput): string {
  const dateFa = formatFaDate(input.dateIso);
  const yearFa = jalaliYear(input.dateIso);
  const petBits = [input.petName, speciesLabel(input.petSpecies), input.petBreed]
    .filter(Boolean)
    .join(' — ');
  const logoUrl = input.logoUrl || prescriptionLogoSrc();
  const pdfUrl = input.pdfUrl || prescriptionPdfWebPath(input.prescriptionId);
  const disclaimer =
    'این نسخه صرفاً جهت اطلاع صاحب حیوان خانگی است و جایگزین معاینه حضوری نیست. در صورت بروز عارضه با دامپزشک خود تماس بگیرید.';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>نسخه دارویی — ${escapeHtml(input.petName)} | ${RX_BRAND_EN}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --brand: #5ba8d2;
      --brand-soft: #e8f4fa;
      --ink: #0f172a;
      --muted: #64748b;
      --rule: #d4e6f0;
      --paper: #ffffff;
      --page: #f0f6fa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Vazirmatn", system-ui, sans-serif;
      background:
        radial-gradient(1200px 500px at 100% 0%, #d8eef8 0%, transparent 55%),
        radial-gradient(900px 420px at 0% 100%, #f3e8ef 0%, transparent 50%),
        var(--page);
      color: var(--ink);
      padding: 24px 16px 48px;
    }
    .sheet {
      max-width: 720px;
      margin: 0 auto;
      background: var(--paper);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
      border: 1px solid var(--rule);
    }
    .topbar { height: 5px; background: var(--brand); }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 22px 16px;
      background: linear-gradient(180deg, var(--brand-soft), #fff);
      border-bottom: 1px solid var(--rule);
    }
    .header-text { flex: 1; text-align: right; min-width: 0; }
    .header-text .kicker {
      margin: 0;
      color: var(--muted);
      font-size: 0.95rem;
      font-weight: 600;
    }
    .header-text .rule {
      margin-top: 10px;
      height: 2px;
      width: min(180px, 50%);
      margin-inline-start: auto;
      background: var(--brand);
      border-radius: 2px;
    }
    .logo {
      height: 52px;
      width: auto;
      max-width: min(220px, 48vw);
      object-fit: contain;
      flex-shrink: 0;
      background: transparent;
    }
    .body { padding: 20px 22px 28px; }
    .meta {
      border: 1px solid var(--rule);
      border-radius: 12px;
      padding: 14px 16px;
      position: relative;
      background: #fff;
    }
    .meta::after {
      content: "";
      position: absolute;
      top: 12px;
      bottom: 12px;
      right: 0;
      width: 4px;
      border-radius: 4px;
      background: var(--brand);
    }
    .meta p {
      margin: 0 0 8px;
      font-size: 0.98rem;
      line-height: 1.55;
    }
    .meta p:last-child { margin-bottom: 0; }
    .section-title {
      margin: 22px 0 10px;
      color: var(--brand);
      font-size: 1.05rem;
      font-weight: 700;
    }
    .med {
      border: 1px solid var(--rule);
      border-radius: 12px;
      padding: 16px;
      background: linear-gradient(180deg, #f7fbfd, #fff);
    }
    .med-line {
      margin: 0 0 10px;
      white-space: pre-wrap;
      line-height: 1.7;
      font-size: 1rem;
    }
    .med-line:last-child { margin-bottom: 0; }
    .disclaimer {
      margin: 18px 0 0;
      color: var(--muted);
      font-size: 0.82rem;
      line-height: 1.65;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 22px 22px;
      flex-wrap: wrap;
    }
    .stamp {
      width: 110px;
      height: 110px;
      border-radius: 50%;
      border: 2.5px solid color-mix(in srgb, var(--brand) 55%, transparent);
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--brand);
      opacity: 0.75;
      background: color-mix(in srgb, var(--brand) 8%, transparent);
    }
    .stamp strong { display: block; font-size: 0.78rem; }
    .stamp span { display: block; font-size: 0.68rem; margin-top: 4px; }
    .actions {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .brand-foot {
      color: var(--muted);
      font-size: 0.9rem;
      letter-spacing: 0.02em;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      border-radius: 10px;
      background: var(--brand);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.92rem;
    }
    .btn:hover { filter: brightness(0.96); }
    @media (max-width: 520px) {
      .logo { height: 40px; max-width: min(180px, 55vw); }
      .header { padding: 14px 14px 12px; }
      .body { padding: 16px 14px 20px; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border: none; border-radius: 0; max-width: none; }
      .btn { display: none; }
    }
  </style>
</head>
<body>
  <article class="sheet">
    <div class="topbar"></div>
    <header class="header">
      <div class="header-text">
        <p class="kicker">نسخه دامپزشکی · کلینیک آنلاین</p>
        <div class="rule" aria-hidden="true"></div>
      </div>
      <img class="logo" src="${escapeHtml(logoUrl)}" alt="${RX_BRAND_EN}" />
    </header>
    <div class="body">
      <div class="meta">
        <p>شماره نسخه: ${escapeHtml(String(input.prescriptionId))}</p>
        <p>تاریخ: ${escapeHtml(dateFa)}</p>
        <p>دامپزشک: ${escapeHtml(input.vetName || '—')}</p>
        <p>صاحب پت: ${escapeHtml(input.patientName || '—')}</p>
        <p>حیوان: ${escapeHtml(petBits || '—')}</p>
      </div>
      <h2 class="section-title">دستور دارویی</h2>
      <div class="med">
        ${medLinesHtml(input.medicationText)}
      </div>
      <p class="disclaimer">${escapeHtml(disclaimer)}</p>
    </div>
    <footer class="footer">
      <div class="stamp" aria-hidden="true">
        <div>
          <strong>${RX_BRAND_EN}</strong>
          <span>نسخه تأییدشده</span>
          <span>${escapeHtml(yearFa)}</span>
        </div>
      </div>
      <div class="actions">
        <div class="brand-foot">${RX_BRAND_EN}</div>
        <a class="btn" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">دانلود PDF</a>
      </div>
    </footer>
  </article>
</body>
</html>`;
}

export function writePrescriptionHtmlFile(html: string, outPath: string): void {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
}
