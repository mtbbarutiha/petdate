/**
 * Guard: تکمیل پروفایل CTA must open gap-fill (`profile:edit:all`),
 * never the full registration wizard and never the section-edit menu.
 *
 * Run: npx tsx packages/bot/src/handlers/profile-gap-fill.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { profileActionsKeyboard, profileEditSectionsKeyboard } from '../keyboards';

function callbackDatas(kb: ReturnType<typeof profileActionsKeyboard>): string[] {
  const out: string[] = [];
  for (const row of kb.inline_keyboard) {
    for (const btn of row) {
      if ('callback_data' in btn && typeof btn.callback_data === 'string') {
        out.push(btn.callback_data);
      }
    }
  }
  return out;
}

function buttonLabel(
  kb: ReturnType<typeof profileActionsKeyboard>,
  data: string
): string | undefined {
  for (const row of kb.inline_keyboard) {
    for (const btn of row) {
      if ('callback_data' in btn && btn.callback_data === data && 'text' in btn) {
        return String(btn.text);
      }
    }
  }
  return undefined;
}

function main(): void {
  const incomplete = profileActionsKeyboard(false);
  const complete = profileActionsKeyboard(true);
  const editMenu = profileEditSectionsKeyboard({ incomplete: true });

  const incompleteCta = buttonLabel(incomplete, 'profile:edit:all');
  assert.equal(incompleteCta, '📋 تکمیل پروفایل', 'incomplete CTA must be تکمیل پروفایل');
  assert.ok(
    callbackDatas(incomplete).includes('profile:edit:all'),
    'incomplete تکمیل پروفایل must deep-link to gap-fill, not profile:edit'
  );
  assert.equal(
    buttonLabel(incomplete, 'profile:edit'),
    '📝 ویرایش پروفایل',
    'ویرایش پروفایل stays the section menu'
  );

  // Required-complete still uses gap-fill (leftover phone/photo/…), never the wizard.
  assert.equal(buttonLabel(complete, 'profile:edit:all'), '📋 تکمیل پروفایل');
  assert.ok(callbackDatas(complete).includes('profile:edit:all'));

  const editDatas = callbackDatas(editMenu);
  assert.ok(editDatas.includes('profile:edit:all'), 'تکمیل همه uses the same gap-fill callback');
  assert.equal(buttonLabel(editMenu, 'profile:edit:all'), '✨ تکمیل بخش‌های خالی');

  const indexSrc = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
  assert.match(
    indexSrc,
    /callbackQuery\('profile:edit:all'[\s\S]*?startProfileGapFill/,
    'profile:edit:all must start gap-fill, not the registration wizard'
  );
  assert.doesNotMatch(
    indexSrc,
    /callbackQuery\('profile:edit:all'[\s\S]*?startProfileWizard/
  );

  const startSrc = fs.readFileSync(path.join(__dirname, 'start.ts'), 'utf8');
  assert.match(startSrc, /startProfileGapFill/, 'returning incomplete users use gap-fill');
  assert.match(
    startSrc,
    /ویزارد تکمیل پروفایل بلافاصله بعد از انتخاب نقش[\s\S]*startProfileWizard/,
    'first-time role confirm still starts the full registration wizard'
  );

  console.log('profile-gap-fill.selftest: ok');
}

main();
