import assert from 'node:assert/strict';
import {
  PAYMENT_CARD_MISSING_ERROR_FA,
  isUnsafePaymentCardNumber,
  paymentCardPublicFields,
  resolvePaymentCardFromEnv,
} from './payment-card.ts';

assert.equal(isUnsafePaymentCardNumber(''), true);
assert.equal(isUnsafePaymentCardNumber('62198611052407631'), true, 'historical hardcoded default');
assert.equal(isUnsafePaymentCardNumber('6037XXXXXXXXXXXX'), true, 'example placeholder');
assert.equal(isUnsafePaymentCardNumber('6037-XXXX-XXXX-XXXX'), true);

const missing = resolvePaymentCardFromEnv({ PAYMENT_CARD_NUMBER: '', PAYMENT_CARD_HOLDER: '' });
assert.equal(missing.ok, false);
if (!missing.ok) {
  assert.equal(missing.reason, 'missing');
  assert.equal(missing.error, PAYMENT_CARD_MISSING_ERROR_FA);
}

const noHolder = resolvePaymentCardFromEnv({
  PAYMENT_CARD_NUMBER: '4242424242424242',
  PAYMENT_CARD_HOLDER: '',
});
assert.equal(noHolder.ok, false);

const hardcoded = resolvePaymentCardFromEnv({
  PAYMENT_CARD_NUMBER: '62198611052407631',
  PAYMENT_CARD_HOLDER: 'محمد تقی باروتیها',
});
assert.equal(hardcoded.ok, false);
if (!hardcoded.ok) assert.equal(hardcoded.reason, 'placeholder');

// Classic Luhn-valid test PAN — not a live PetDate destination card.
const ok = resolvePaymentCardFromEnv({
  PAYMENT_CARD_NUMBER: '4242 4242 4242 4242',
  PAYMENT_CARD_HOLDER: 'پت‌دیت',
});
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.number, '4242424242424242');
  assert.equal(ok.holder, 'پت‌دیت');
  const pub = paymentCardPublicFields(ok);
  assert.match(pub.cardMasked, /\*\*\*\*/);
  assert.doesNotMatch(pub.cardMasked, /42424242/);
}

const short = resolvePaymentCardFromEnv({
  PAYMENT_CARD_NUMBER: '60379911223344',
  PAYMENT_CARD_HOLDER: 'پت‌دیت',
});
assert.equal(short.ok, false);
if (!short.ok) assert.equal(short.reason, 'invalid');

console.log('payment-card.selftest: ok');
