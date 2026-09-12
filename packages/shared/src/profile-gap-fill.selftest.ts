/**
 * Guard: «تکمیل پروفایل» is a gap-fill path, not full re-registration.
 *
 * Run: npx tsx packages/shared/src/profile-gap-fill.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  isOptionalProfileWizardStep,
  isProfileComplete,
  missingProfileWizardSteps,
  nextMissingProfileWizardStep,
  PROFILE_WIZARD_STEPS,
  type ProfileCardUser,
} from './profile-card';

function user(partial: Partial<ProfileCardUser>): ProfileCardUser {
  return { id: 1, ...partial };
}

const COMPLETE: ProfileCardUser = user({
  name: 'سارا',
  age: 27,
  gender: 'female',
  country: 'ایران',
  province: 'تهران',
  city: 'تهران',
  phone: '09120000000',
  avatarUrl: 'AgAC-photo',
  bio: 'عاشق پت',
  interests: ['🐾 همبازی پت'],
});

function main(): void {
  // all-complete → no wizard
  assert.deepEqual(missingProfileWizardSteps(COMPLETE), [], 'all-complete must not start a wizard');
  assert.equal(nextMissingProfileWizardStep(COMPLETE), null);
  assert.equal(isProfileComplete(COMPLETE), true);

  // required-complete but optional empty still lists only optional gaps
  const requiredOnly = user({
    name: 'علی',
    age: 30,
    gender: 'male',
    country: 'ایران',
    province: 'اصفهان',
    city: 'اصفهان',
  });
  assert.equal(isProfileComplete(requiredOnly), true);
  assert.deepEqual(missingProfileWizardSteps(requiredOnly), [
    'profile_phone',
    'profile_photo',
    'profile_bio',
    'profile_interests',
  ]);

  // one missing field → only that step
  const missingAge = { ...COMPLETE, age: undefined };
  assert.deepEqual(missingProfileWizardSteps(missingAge), ['profile_age']);
  assert.equal(nextMissingProfileWizardStep(missingAge), 'profile_age');
  assert.ok(!missingProfileWizardSteps(missingAge).includes('profile_name'));

  const missingPhone = { ...COMPLETE, phone: '' };
  assert.deepEqual(missingProfileWizardSteps(missingPhone), ['profile_phone']);

  // multiple missing → separate steps in canonical order
  const missingAgeAndCity = user({
    name: 'سارا',
    age: undefined,
    gender: 'female',
    country: 'ایران',
    province: 'تهران',
    city: '',
    phone: '09120000000',
    avatarUrl: 'AgAC-photo',
    bio: 'عاشق پت',
    interests: ['🐾 همبازی پت'],
  });
  const multi = missingProfileWizardSteps(missingAgeAndCity);
  assert.deepEqual(multi, ['profile_age', 'profile_city']);
  assert.ok(PROFILE_WIZARD_STEPS.indexOf(multi[0]!) < PROFILE_WIZARD_STEPS.indexOf(multi[1]!));

  // filled fields never re-prompted after the missing one is written
  const afterAge: ProfileCardUser = { ...missingAgeAndCity, age: 27 };
  assert.deepEqual(missingProfileWizardSteps(afterAge), ['profile_city']);
  assert.ok(!missingProfileWizardSteps(afterAge).includes('profile_age'));
  assert.ok(!missingProfileWizardSteps(afterAge).includes('profile_name'));
  assert.ok(!missingProfileWizardSteps(afterAge).includes('profile_gender'));

  // location is split: Iran without province → province then city (not country)
  const iranNoProvince = user({
    name: 'سارا',
    age: 27,
    gender: 'female',
    country: 'ایران',
    city: '',
    phone: '0912',
    avatarUrl: 'x',
    bio: 'ب',
    interests: ['🐾 همبازی پت'],
  });
  assert.deepEqual(missingProfileWizardSteps(iranNoProvince), [
    'profile_province',
    'profile_city',
  ]);

  // other country with city missing → only city, never province
  const otherNoCity = user({
    name: 'سارا',
    age: 27,
    gender: 'female',
    country: 'ترکیه',
    city: '',
    phone: '0912',
    avatarUrl: 'x',
    bio: 'ب',
    interests: ['🐾 همبازی پت'],
  });
  assert.deepEqual(missingProfileWizardSteps(otherNoCity), ['profile_city']);

  // skip list removes a gap without reordering the rest
  assert.deepEqual(missingProfileWizardSteps(requiredOnly, { skip: ['profile_phone'] }), [
    'profile_photo',
    'profile_bio',
    'profile_interests',
  ]);

  assert.equal(isOptionalProfileWizardStep('profile_phone'), true);
  assert.equal(isOptionalProfileWizardStep('profile_name'), false);
  assert.equal(isOptionalProfileWizardStep('profile_city'), false);

  // name set, city/phone missing — do not restart from name
  const nameSetGaps = user({
    name: 'محمد',
    age: 22,
    gender: 'male',
    country: 'ایران',
    province: 'تهران',
  });
  const gaps = missingProfileWizardSteps(nameSetGaps);
  assert.ok(!gaps.includes('profile_name'), 'filled name must not be re-prompted');
  assert.ok(gaps.includes('profile_city'));
  assert.ok(gaps.includes('profile_phone'));
  assert.equal(nextMissingProfileWizardStep(nameSetGaps), 'profile_city');

  console.log('profile-gap-fill.selftest: ok');
}

main();
