/**
 * Inbox consult peer avatars — TEAM_AGENTS photos, not stethoscope for known agents.
 * Run: npx tsx packages/web/src/lib/inboxConversations.avatars.selftest.ts
 */
import assert from 'node:assert/strict';
import type { VetConsultation } from '@petdate/shared';
import { resolveConsultPeerAvatarUrl } from './resolveConsultPeerAvatar';

function baseConsult(over: Partial<VetConsultation> = {}): VetConsultation {
  return {
    id: 1,
    vetUserId: 10,
    patientUserId: 20,
    status: 'active',
    createdAt: '2026-09-11T12:00:00Z',
    petName: 'Teddy',
    ...over,
  };
}

const leila = resolveConsultPeerAvatarUrl(
  baseConsult({ vetName: 'لیلا کیانی', serviceKind: 'trainer' }),
  'as_patient',
);
assert.ok(leila?.includes('leila-kiani'), `leila avatar: ${leila}`);

const faranak = resolveConsultPeerAvatarUrl(
  baseConsult({ vetName: 'فرانک احمدی', serviceKind: 'trainer' }),
  'as_patient',
);
assert.ok(faranak?.includes('faranak-ahmadi'), `faranak avatar: ${faranak}`);

const sanaz = resolveConsultPeerAvatarUrl(
  baseConsult({ vetName: 'دکتر ساناز غفاری', serviceKind: 'vet' }),
  'as_patient',
);
assert.ok(sanaz?.includes('sanaz-ghaffari'), `sanaz avatar: ${sanaz}`);

const sara = resolveConsultPeerAvatarUrl(
  baseConsult({ vetName: 'دکتر سارا نوری', serviceKind: 'vet' }),
  'as_patient',
);
assert.ok(sara?.includes('sara-noori'), `sara avatar: ${sara}`);

const apiWins = resolveConsultPeerAvatarUrl(
  baseConsult({
    vetName: 'لیلا کیانی',
    vetAvatarUrl: '/api/auth/avatar/9/custom.jpg',
  }),
  'as_patient',
);
assert.equal(apiWins, '/api/auth/avatar/9/custom.jpg');

const legacy = resolveConsultPeerAvatarUrl(
  baseConsult({ vetName: 'پاشا یزدانی' }),
  'as_patient',
);
assert.ok(legacy?.includes('leila-kiani'), `legacy pasha → leila: ${legacy}`);

const patient = resolveConsultPeerAvatarUrl(
  baseConsult({ patientAvatarUrl: '/api/auth/avatar/20/p.jpg' }),
  'as_vet',
);
assert.equal(patient, '/api/auth/avatar/20/p.jpg');

const patientDefault = resolveConsultPeerAvatarUrl(
  baseConsult({ patientGender: 'female' }),
  'as_vet',
);
assert.equal(patientDefault, '/images/defaults/avatar-female.jpg');

const vetDefault = resolveConsultPeerAvatarUrl(
  baseConsult({ vetName: 'صاحب ناشناس', vetGender: 'male' }),
  'as_patient',
);
assert.equal(vetDefault, '/images/defaults/avatar-male.jpg');

const verifyVideo = resolveConsultPeerAvatarUrl(
  baseConsult({
    vetName: 'لیلا کیانی',
    vetAvatarUrl: 'BAACAgQAAxkBAAITestVideoFileIdToken1234567890',
  }),
  'as_patient',
);
assert.ok(
  verifyVideo?.includes('leila-kiani'),
  `face-verify video must not be the consult avatar: ${verifyVideo}`
);

console.log('inboxConversations.avatars.selftest: ok');
