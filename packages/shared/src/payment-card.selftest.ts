import assert from 'node:assert/strict';
import {
  HISTORICAL_PAYMENT_CARD_DEFAULT,
  PAYMENT_CARD_MISSING_ERROR_FA,
  isUnsafePaymentCardNumber,
  paymentCardPublicFields,
  resolvePaymentCardFromEnv,
} from './payment-card.ts';

assert.equal(isUnsafePaymentCardNumber(''), true);
assert.equal(isUnsafePaymentCardNumber('6037XXXXXXXXXXXX'), true, 'example placeholder');
assert.equal(isUnsafePaymentCardNumber('6037-XXXX-XXXX-XXXX'), true);
assert.equal(
  isUnsafePaymentCardNumber(HISTORICAL_PAYMENT_CARD_DEFAULT),
  false,
  'historical default is allowed when explicitly set in env'
);

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

// Explicit ops env with former hardcoded PAN + holder must work (prod reality).
const historical = resolvePaymentCardFromEnv({
  PAYMENT_CARD_NUMBER: HISTORICAL_PAYMENT_CARD_DEFAULT,
  PAYMENT_CARD_HOLDER: 'محمد تقی باروتیها',
});
assert.equal(historical.ok, true);
if (historical.ok) {
  assert.equal(historical.number, HISTORICAL_PAYMENT_CARD_DEFAULT);
  assert.equal(historical.holder, 'محمد تقی باروتیها');
}

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

const placeholderX = resolvePaymentCardFromEnv({
  PAYMENT_CARD_NUMBER: '6037XXXXXXXXXXXX',
  PAYMENT_CARD_HOLDER: 'پت‌دیت',
});
assert.equal(placeholderX.ok, false);
if (!placeholderX.ok) assert.equal(placeholderX.reason, 'placeholder');

console.log('payment-card.selftest: ok');
