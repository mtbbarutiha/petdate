/**
 * Offline check: prescription PDF embeds لوگو مادر (mother logo PNG).
 * Run: npx tsx packages/api/src/services/prescription-pdf.selftest.ts
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generatePrescriptionPdf } from './prescription-pdf';
import { resolvePrescriptionLogoPath } from './prescription-html';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const MOTHER_LOGO_MD5 = 'beda5e5ccdd11c32dd06a4f1bce2c6bf';

async function main() {
  const logoPath = resolvePrescriptionLogoPath();
  assert(logoPath, 'mother logo path missing for PDF');
  const md5 = crypto.createHash('md5').update(fs.readFileSync(logoPath!)).digest('hex');
  assert(md5 === MOTHER_LOGO_MD5, `PDF logo md5=${md5} expected ${MOTHER_LOGO_MD5}`);

  const outDir = path.join(__dirname, '..', '..', 'data', 'selftest');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'rx-mother-logo-sample.pdf');

  await generatePrescriptionPdf(
    {
      vetName: 'دکتر تست',
      patientName: 'صاحب تست',
      petName: 'رکس',
      petSpecies: 'dog',
      petBreed: 'گلدن',
      medicationText: 'آموکسی‌سیلین ۵۰mg\nروزی دو بار با غذا',
      dateIso: '2026-09-08T12:00:00.000Z',
      prescriptionId: 99,
    },
    outPath
  );

  assert(fs.existsSync(outPath), 'PDF not written');
  const pdf = fs.readFileSync(outPath);
  assert(pdf.length > 2000, 'PDF too small');
  // pdfkit Flate-encodes PNG → look for mother logo pixel size (780×228)
  assert(pdf.includes(Buffer.from('/Width 780')), 'PDF should embed mother logo width 780');
  assert(pdf.includes(Buffer.from('/Height 228')), 'PDF should embed mother logo height 228');
  console.log('wrote', outPath, 'bytes', pdf.length);
  console.log('prescription-pdf.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
