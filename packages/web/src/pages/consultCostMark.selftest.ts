/**
 * Instant-connect cost card: GraduationCap on the free AI line, Stethoscope
 * on paid human-vet; vet copy is Sara, trainer copy stays Faranak.
 * Run: npx tsx packages/web/src/pages/consultCostMark.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator } from '../i18n/lookup.ts';
import { en as enDict } from '../i18n/locales/en.ts';
import { fa as faDict } from '../i18n/locales/fa.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const vet = readFileSync(join(dir, 'VetConsultPage.tsx'), 'utf8');
const trainer = readFileSync(join(dir, 'ServiceConsultPage.tsx'), 'utf8');
const tFa = createTranslator(faDict);
const tEn = createTranslator(enDict, faDict);

assert.match(vet, /GraduationCap/, 'vet desk imports GraduationCap');
assert.match(
  vet,
  /pepito-vet-cost-mark[\s\S]{0,180}noOnlineVets \? \([\s\S]{0,80}<GraduationCap size=\{20\} strokeWidth=\{2\}/,
  'cost-mark uses GraduationCap when the free AI line is showing'
);
assert.match(
  vet,
  /pepito-vet-cost-mark[\s\S]{0,320}<Stethoscope size=\{20\} strokeWidth=\{2\}/,
  'cost-mark keeps Stethoscope for the paid human-vet line'
);

const pepitoCss = readFileSync(join(dir, '../styles/pepito.css'), 'utf8');
assert.match(
  pepitoCss,
  /\.pepito-vet-consult-cost\s*>\s*div\s*>\s*span\s*\{/,
  'cost-copy span rule must not target .pepito-vet-cost-mark (breaks icon flex centering)'
);
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-vet-consult-cost\s+span\s*\{/,
  'broad .pepito-vet-consult-cost span { display:block } must stay removed'
);
assert.match(
  pepitoCss,
  /\.pepito-vet-cost-mark\s*\{[\s\S]{0,280}display:\s*inline-flex;[\s\S]{0,120}align-items:\s*center;[\s\S]{0,80}justify-content:\s*center;/,
  'cost-mark keeps flex centering for the doctor icon'
);
assert.match(
  vet,
  /data-testid="vet-quick-connect"[\s\S]{0,520}<Stethoscope size=\{16\}/,
  'human real-doctor CTA keeps Stethoscope'
);
assert.match(vet, /consultDesk\.aiSaraFree/, 'vet free line + AI CTA use Sara');
assert.doesNotMatch(vet, /consultDesk\.aiLeilaFree/, 'vet desk must not use the Faranak trainer key');

assert.match(trainer, /consultDesk\.aiLeilaFree/, 'trainer desk keeps Faranak');
assert.doesNotMatch(trainer, /consultDesk\.aiSaraFree/, 'trainer desk must not use the Sara vet key');
assert.doesNotMatch(
  trainer,
  /pepito-vet-cost-mark/,
  'trainer desk does not invent a cost-mark panel'
);

assert.equal(tFa('consultDesk.aiSaraFree'), 'مشورت با سارا نوری (رایگان)');
assert.equal(tEn('consultDesk.aiSaraFree'), 'Consult Sara Noori (free)');
assert.equal(tFa('consultDesk.aiLeilaFree'), 'مشورت با فرانک احمدی (رایگان)');
assert.equal(tEn('consultDesk.aiLeilaFree'), 'Consult Faranak Ahmadi (free)');
assert.match(tFa('consultDesk.aiSaraFree'), /سارا نوری/);
assert.doesNotMatch(tFa('consultDesk.aiSaraFree'), /فرانک/);
assert.match(tFa('consultDesk.aiLeilaFree'), /فرانک احمدی/);
assert.doesNotMatch(tFa('consultDesk.aiLeilaFree'), /سارا/);

console.log('consultCostMark.selftest: ok');
