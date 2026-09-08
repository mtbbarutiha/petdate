/**
 * Self-test: publicWebOrigin / publicPdfOrigin must prefer domains and never emit raw VPS IP.
 * Also: Rx HTML embeds لوگو مادر (mother logo) as data URI.
 * Run: npx tsx src/services/prescription-html.selftest.ts
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  publicWebOrigin,
  publicPdfOrigin,
  prescriptionPublicUrl,
  prescriptionPdfPublicUrl,
  prescriptionWebPath,
  prescriptionPdfWebPath,
  prescriptionPdfPublicPath,
  renderPrescriptionHtml,
  resolvePrescriptionLogoPath,
  prescriptionLogoSrc,
} from './prescription-html';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const MOTHER_LOGO_MD5 = 'beda5e5ccdd11c32dd06a4f1bce2c6bf';

const prev = {
  PUBLIC_API_URL: process.env.PUBLIC_API_URL,
  PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL,
  PUBLIC_PDF_URL: process.env.PUBLIC_PDF_URL,
  PDF_PUBLIC_URL: process.env.PDF_PUBLIC_URL,
  WEB_URL: process.env.WEB_URL,
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN,
  APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
  WEB_PUBLIC_URL: process.env.WEB_PUBLIC_URL,
  API_PUBLIC_URL: process.env.API_PUBLIC_URL,
};

function clear() {
  for (const k of Object.keys(prev) as (keyof typeof prev)[]) {
    delete process.env[k];
  }
}

function restore() {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

try {
  clear();
  process.env.PUBLIC_API_URL = 'http://185.110.189.218';
  process.env.PUBLIC_WEB_URL = 'https://petdate.ir';
  process.env.PUBLIC_PDF_URL = 'https://pdf.petdate.ir';
  assert(publicWebOrigin() === 'https://petdate.ir', 'prefer PUBLIC_WEB_URL over IP API');
  assert(publicPdfOrigin() === 'https://pdf.petdate.ir', 'prefer PUBLIC_PDF_URL');
  assert(
    prescriptionPublicUrl(3) === 'https://petdate.ir/rx/3',
    `expected domain rx link, got ${prescriptionPublicUrl(3)}`
  );
  assert(
    prescriptionPdfPublicUrl(3) === 'https://pdf.petdate.ir/rx/3.pdf',
    `expected pdf subdomain link, got ${prescriptionPdfPublicUrl(3)}`
  );

  clear();
  process.env.PUBLIC_API_URL = 'http://185.110.189.218';
  assert(publicWebOrigin() === 'https://petdate.ir', 'skip raw IP → SITE.origin');
  assert(!publicWebOrigin().includes('185.110'), 'must not include VPS IP');
  assert(publicPdfOrigin() === 'https://pdf.petdate.ir', 'pdf default subdomain');

  clear();
  process.env.WEB_URL = 'https://www.petdate.ir/';
  assert(publicWebOrigin() === 'https://www.petdate.ir', 'strip trailing slash');

  clear();
  assert(publicWebOrigin('185.110.189.218') === 'https://petdate.ir', 'reqHost IP ignored');
  assert(prescriptionWebPath(12) === '/rx/12', 'path');
  assert(prescriptionPdfWebPath(12) === '/rx/12/pdf', 'legacy pdf path');
  assert(prescriptionPdfPublicPath(12) === '/rx/12.pdf', 'public pdf path');

  // لوگو مادر must be present and match pepito/img/logo.png
  const logoPath = resolvePrescriptionLogoPath();
  assert(logoPath, 'prescription logo path missing');
  const md5 = crypto.createHash('md5').update(fs.readFileSync(logoPath!)).digest('hex');
  assert(md5 === MOTHER_LOGO_MD5, `rx logo md5=${md5} expected mother ${MOTHER_LOGO_MD5}`);

  const src = prescriptionLogoSrc();
  assert(src.startsWith('data:image/png;base64,'), 'logo src must be data URI embed');

  const html = renderPrescriptionHtml({
    prescriptionId: 99,
    vetName: 'دکتر تست',
    patientName: 'صاحب تست',
    petName: 'رکس',
    petSpecies: 'dog',
    medicationText: 'آموکسی‌سیلین ۵۰mg\nروزی دو بار',
    dateIso: '2026-09-08T12:00:00.000Z',
  });
  assert(html.includes('data:image/png;base64,'), 'HTML must embed mother logo');
  assert(!html.includes('width="96" height="96"'), 'must not force square logo box');
  assert(html.includes('class="logo"'), 'logo class present');

  const outDir = path.join(__dirname, '..', '..', 'data', 'selftest');
  fs.mkdirSync(outDir, { recursive: true });
  const sampleHtml = path.join(outDir, 'rx-mother-logo-sample.html');
  fs.writeFileSync(sampleHtml, html, 'utf8');
  console.log('wrote', sampleHtml);

  console.log('prescription-html.selftest: ok');
} finally {
  restore();
}
