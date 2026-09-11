/**
 * share helpers — Web Share API + clipboard fallback.
 * Run: npx tsx packages/web/src/lib/share.selftest.ts
 */
import assert from 'node:assert/strict';
import { petPublicUrl, shareOrCopyUrl } from './share.ts';

assert.equal(petPublicUrl(42), '/pet/42');
assert.equal(petPublicUrl('7'), '/pet/7');
assert.equal(petPublicUrl({ id: 35, slug: 'teddy' }), '/pet/teddy');
assert.equal(petPublicUrl({ id: 35, slug: 'benji' }), '/pet/benji');

function setNavigator(value: {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
} | undefined) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value,
  });
}

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

try {
  const box: { sharedUrl: string | null; copied: string } = { sharedUrl: null, copied: '' };
  setNavigator({
    share: async (data) => {
      box.sharedUrl = typeof data.url === 'string' ? data.url : null;
    },
  });
  const msgShare = await shareOrCopyUrl({
    url: 'https://petdate.ir/pets/1',
    title: 'رکس',
    text: 'پروفایل رکس',
  });
  assert.equal(msgShare, 'اشتراک‌گذاری شد');
  assert.equal(box.sharedUrl, 'https://petdate.ir/pets/1');

  setNavigator({
    clipboard: {
      writeText: async (text) => {
        box.copied = text;
      },
    },
  });
  const msgCopy = await shareOrCopyUrl({ url: 'https://petdate.ir/pets/9' });
  assert.equal(msgCopy, 'لینک کپی شد');
  assert.equal(box.copied, 'https://petdate.ir/pets/9');

  setNavigator({
    share: async () => {
      const err = new Error('cancelled');
      err.name = 'AbortError';
      throw err;
    },
  });
  const msgAbort = await shareOrCopyUrl({ url: 'https://petdate.ir/pets/3' });
  assert.equal(msgAbort, null);

  setNavigator({
    share: async () => {
      throw new Error('NotAllowedError');
    },
    clipboard: {
      writeText: async (text) => {
        box.copied = text;
      },
    },
  });
  const msgFallback = await shareOrCopyUrl({ url: 'https://petdate.ir/pets/5' });
  assert.equal(msgFallback, 'لینک کپی شد');
  assert.equal(box.copied, 'https://petdate.ir/pets/5');
} finally {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'navigator');
  }
}

console.log('share.selftest: ok');
