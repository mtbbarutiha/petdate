/**
 * Persian RTL veterinary prescription PDF (pdfkit + Vazirmatn).
 *
 * pdfkit 0.20 layouts each whitespace-separated token via fontkit, which
 * already shapes + reverses Arabic/Persian *within* a token. Feeding
 * pre-reversed/reshaped strings therefore double-flips glyphs (garbled text).
 *
 * Correct approach for multi-word RTL:
 * 1. Convert Persian/Arabic digits → ASCII (fontkit wrongly mirrors Eastern digits)
 * 2. Reverse token order so right-aligned LTR paint reads correctly RTL
 * 3. Leave Latin-only lines alone
 * 4. Never pass align tricks that fight fontkit — use align:'right' on logical tokens
 */
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { PET_SPECIES_LABELS } from '@petdate/shared';
import { resolvePrescriptionLogoPath } from './prescription-html';

/** Brand sky-blue — Pet Date Dr / petdate */
const BRAND_BLUE = '#5ba8d2';
const BRAND_BLUE_SOFT = '#e8f4fa';
const BRAND_BLUE_MID = '#b8dceb';
const INK = '#1e293b';
const MUTED = '#64748b';
const RULE = '#d4e6f0';
const PAPER = '#ffffff';
const BODY_BG = '#f7fafc';

/** Prescription product branding (not the playmate "همبازی" surface). */
const RX_BRAND_FA = 'پت دیت دکتر';
const RX_BRAND_EN = 'Pet Date Dr';

export type PrescriptionPdfInput = {
  vetName: string;
  patientName: string;
  petName: string;
  petSpecies?: string;
  petBreed?: string;
  medicationText: string;
  dateIso?: string;
  prescriptionId?: number;
};

function speciesLabel(species?: string): string | undefined {
  if (!species) return undefined;
  return PET_SPECIES_LABELS[species] || species;
}

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

function fontPaths(): { regular: string; bold: string } {
  const regular = resolveFont('Vazirmatn-Regular.ttf');
  if (!regular) {
    throw new Error('فونت Vazirmatn پیدا نشد — packages/api/assets/fonts/Vazirmatn-Regular.ttf');
  }
  const bold = resolveFont('Vazirmatn-Bold.ttf') || regular;
  return { regular, bold };
}

/** Eastern Arabic-Indic / Persian digits → ASCII (avoids fontkit mirroring). */
export function toAsciiDigits(text: string): string {
  return String(text ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Prepare a line for pdfkit+fontkit RTL painting.
 * Reverse whitespace-separated tokens for Arabic-script lines; keep Latin-only lines as-is.
 */
export function rtlLine(text: string): string {
  const s = toAsciiDigits(String(text ?? ''));
  if (!s || !hasArabicScript(s)) return s;

  const tokens = s.split(/(\s+)/);
  const words = tokens.filter((t) => t.length > 0 && !/^\s+$/.test(t)).reverse();
  let i = 0;
  return tokens.map((t) => (/^\s+$/.test(t) ? t : words[i++])).join('');
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

export function prescriptionsDir(): string {
  const dir = path.join(__dirname, '..', '..', 'data', 'prescriptions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Absolute glyph paint — never advances flow / never auto-pages. */
function paint(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: {
    width?: number;
    align?: 'left' | 'center' | 'right';
    size: number;
    color: string;
    bold?: boolean;
  }
): void {
  doc.font(opts.bold ? 'VazirBold' : 'Vazir').fontSize(opts.size).fillColor(opts.color);
  doc.text(rtlLine(text), x, y, {
    width: opts.width,
    align: opts.align ?? 'left',
    lineBreak: false,
    continued: false,
  });
}

/**
 * Header logo: لوگو مادر (embedded PNG) + Rx subtitle.
 * Placed from the right edge (RTL header). Mother wordmark is landscape 780×228.
 */
function drawPetDateDrLogo(
  doc: PDFKit.PDFDocument,
  right: number,
  top: number,
  contentW: number
): void {
  const logoPath = resolvePrescriptionLogoPath();
  const logoH = 46;
  // Mother logo aspect ≈ 780/228 ≈ 3.42
  const logoW = Math.min(168, contentW * 0.42);
  const logoX = right - logoW;
  const logoY = top + 4;

  if (logoPath) {
    try {
      // fit keeps mother wordmark aspect (780×228); do not force square crop
      doc.image(logoPath, logoX, logoY, { fit: [logoW, logoH], align: 'right', valign: 'center' });
    } catch (err) {
      console.warn('prescription PDF logo embed failed:', (err as Error).message);
    }
  }

  const textRight = right;
  const textW = Math.min(280, contentW - 8);
  const textX = textRight - textW;
  const subY = logoPath ? logoY + logoH + 4 : top + 8;

  paint(doc, 'نسخه دامپزشکی  ·  کلینیک آنلاین', textX, subY, {
    width: textW,
    align: 'right',
    size: 10,
    color: MUTED,
  });

  doc
    .moveTo(textRight - 140, subY + 16)
    .lineTo(textRight, subY + 16)
    .strokeColor(BRAND_BLUE)
    .lineWidth(1.6)
    .stroke();
}

/** مهر پت دیت دکتر — circular seal at current origin. */
function drawPetDateDrStamp(doc: PDFKit.PDFDocument, radius: number, year: string): void {
  const R = radius;
  doc.save();
  doc.opacity(0.48);

  doc.circle(0, 0, R).fillOpacity(0.1).fill(BRAND_BLUE);
  doc.fillOpacity(1);

  doc.lineWidth(2.5).strokeColor(BRAND_BLUE).circle(0, 0, R).stroke();
  doc.lineWidth(1.2).circle(0, 0, R - 9).stroke();
  doc.lineWidth(0.8).circle(0, 0, R * 0.48).stroke();

  const brand = rtlLine(RX_BRAND_FA);
  doc.font('VazirBold').fontSize(9.5).fillColor(BRAND_BLUE);
  doc.text(brand, -doc.widthOfString(brand) / 2, -14, { lineBreak: false });

  const conf = rtlLine('نسخه تأییدشده');
  doc.font('Vazir').fontSize(7).fillColor(BRAND_BLUE);
  doc.text(conf, -doc.widthOfString(conf) / 2, 2, { lineBreak: false });

  const yr = rtlLine(year);
  doc.font('Vazir').fontSize(7.5).fillColor(BRAND_BLUE);
  doc.text(yr, -doc.widthOfString(yr) / 2, R - 21, { lineBreak: false });

  const en = RX_BRAND_EN;
  doc.font('Vazir').fontSize(6.5).fillColor(BRAND_BLUE);
  doc.text(en, -doc.widthOfString(en) / 2, -(R - 17), { lineBreak: false });

  doc.restore();
}

export async function generatePrescriptionPdf(
  input: PrescriptionPdfInput,
  outPath: string
): Promise<string> {
  const fonts = fontPaths();
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const dateFa = formatFaDate(input.dateIso);
  const yearFa = jalaliYear(input.dateIso);
  const petBits = [input.petName, speciesLabel(input.petSpecies), input.petBreed]
    .filter(Boolean)
    .join(' — ');
  const disclaimer =
    'این نسخه صرفاً جهت اطلاع صاحب حیوان خانگی است و جایگزین معاینه حضوری نیست. در صورت بروز عارضه با دامپزشک خود تماس بگیرید.';

  await new Promise<void>((resolve, reject) => {
    // Zero margins — we position everything absolutely to avoid auto page-breaks
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: true,
      info: {
        Title: `نسخه دارویی — ${input.petName}`,
        Author: RX_BRAND_FA,
        Subject: 'Veterinary Prescription — Pet Date Dr',
      },
    });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    doc.on('error', reject);
    stream.on('error', reject);
    stream.on('finish', () => resolve());

    doc.registerFont('Vazir', fonts.regular);
    doc.registerFont('VazirBold', fonts.bold);
    doc.font('Vazir');

    const pageW = 595.28;
    const pageH = 841.89;
    const left = 44;
    const contentW = pageW - left * 2;
    const right = left + contentW;

    // Soft wash + brand top bar
    doc.rect(0, 0, pageW, 96).fill(BRAND_BLUE_SOFT);
    doc.rect(0, 0, pageW, 5).fill(BRAND_BLUE);

    // Hero brand logo (لوگو مادر PNG embed)
    drawPetDateDrLogo(doc, right, 14, contentW);

    // Meta card
    let y = 96;
    const metaRows: string[] = [
      ...(input.prescriptionId ? [`شماره نسخه: ${input.prescriptionId}`] : []),
      `تاریخ: ${dateFa}`,
      `دامپزشک: ${input.vetName}`,
      `صاحب پت: ${input.patientName}`,
      `حیوان: ${petBits || '—'}`,
    ];
    const metaLineH = 20;
    const metaPad = 12;
    const metaH = metaRows.length * metaLineH + metaPad * 2;
    doc.roundedRect(left, y, contentW, metaH, 6).fillAndStroke(PAPER, RULE);
    doc.roundedRect(left + contentW - 4, y + 8, 3, metaH - 16, 1.5).fill(BRAND_BLUE);

    let my = y + metaPad;
    for (const row of metaRows) {
      paint(doc, row, left + 14, my + 2, {
        width: contentW - 30,
        align: 'right',
        size: 11,
        color: INK,
        bold: true,
      });
      my += metaLineH;
    }
    y = y + metaH + 16;

    // Medications heading
    paint(doc, 'دستور دارویی', left, y, {
      width: contentW,
      align: 'right',
      size: 13,
      color: BRAND_BLUE,
      bold: true,
    });
    y += 20;

    const medLines = String(input.medicationText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // Draw body panel; paint each med line absolutely (no flow text → no page 2)
    const lineH = 18;
    const bodyPad = 14;
    const bodyLines = medLines.length ? medLines : ['—'];
    const bodyH = Math.max(110, bodyLines.length * lineH + bodyPad * 2);
    doc.roundedRect(left, y, contentW, bodyH, 6).fillAndStroke(BODY_BG, RULE);
    doc.rect(left, y + 8, 3, bodyH - 16).fill(BRAND_BLUE_MID);

    let ly = y + bodyPad;
    for (const line of bodyLines) {
      paint(doc, line, left + 14, ly, {
        width: contentW - 28,
        align: 'right',
        size: 12,
        color: INK,
      });
      ly += lineH;
    }
    y = y + bodyH + 16;

    // Divider + disclaimer (wrap manually into ≤2 short lines)
    doc
      .moveTo(left, y)
      .lineTo(left + contentW, y)
      .strokeColor(RULE)
      .lineWidth(0.8)
      .stroke();
    y += 10;

    // Split disclaimer roughly in half for two absolute lines
    const mid = Math.floor(disclaimer.length / 2);
    let splitAt = disclaimer.indexOf(' ', mid);
    if (splitAt < 0) splitAt = mid;
    const d1 = disclaimer.slice(0, splitAt).trim();
    const d2 = disclaimer.slice(splitAt).trim();
    paint(doc, d1, left, y, {
      width: contentW,
      align: 'right',
      size: 8.5,
      color: MUTED,
    });
    paint(doc, d2, left, y + 12, {
      width: contentW,
      align: 'right',
      size: 8.5,
      color: MUTED,
    });

    // مهر پت دیت دکتر — lower-left, rotated ~-12°, semi-transparent
    const stampR = 46;
    doc.save();
    doc.translate(left + stampR + 4, pageH - 70);
    doc.rotate(-12);
    drawPetDateDrStamp(doc, stampR, yearFa);
    doc.restore();

    // Footer brand (right of stamp)
    paint(doc, `${RX_BRAND_FA} — ${RX_BRAND_EN}`, left + 110, pageH - 28, {
      width: contentW - 110,
      align: 'right',
      size: 8.5,
      color: MUTED,
    });

    doc.end();
  });

  return outPath;
}
