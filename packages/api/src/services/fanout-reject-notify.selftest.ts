/**
 * Multi-recipient reject must not notify the requester; accept still does.
 * Run: cd packages/api && npx tsx src/services/fanout-reject-notify.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-fanout-reject-${process.pid}.db`;

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

async function main() {
  const { shouldNotifyRequesterOnReject } = await import('@petdate/shared');
  const { dbService, getDb } = await import('../db');
  const { planPlaydateRejectNotify, planConsultRejectNotify } = await import(
    './fanout-reject-notify'
  );

  getDb();
  const stamp = Date.now();

  const { user: requester } = dbService.findOrCreateUser({
    telegramId: `fanout_req_${stamp}`,
    name: 'Requester',
  });
  dbService.setUserRoles(requester.id, ['pet_owner']);
  const fromPet = dbService.createPet({
    ownerId: requester.id,
    name: 'Rex',
    species: 'dog',
  });

  const recipients: number[] = [];
  const toPets: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const { user } = dbService.findOrCreateUser({
      telegramId: `fanout_to_${stamp}_${i}`,
      name: `Owner ${i}`,
    });
    dbService.setUserRoles(user.id, ['pet_owner']);
    const pet = dbService.createPet({
      ownerId: user.id,
      name: `Peer ${i}`,
      species: 'dog',
    });
    recipients.push(user.id);
    toPets.push(pet.id);
  }

  const fanout = toPets.map((toPetId, i) =>
    dbService.createPlaydateRequest({
      fromPetId: fromPet.id,
      toPetId,
      fromUserId: requester.id,
      toUserId: recipients[i],
    })
  );
  assert.equal(fanout.length, 3, 'three playdate fan-out rows');

  const multiPlan = planPlaydateRejectNotify(fanout[0]!);
  assert.equal(multiPlan.recipientCount, 3, 'playdate fan-out count 3');
  assert.equal(multiPlan.notifyRequester, false, 'multi reject: no requester notify');
  assert.ok(
    !multiPlan.inboxUserIds.includes(requester.id),
    'multi reject: requester off inbox'
  );
  assert.ok(
    multiPlan.inboxUserIds.includes(recipients[0]!),
    'multi reject: recipient still inbox'
  );

  const soloFrom = dbService.createPet({
    ownerId: requester.id,
    name: 'SoloDog',
    species: 'dog',
  });
  const { user: soloTo } = dbService.findOrCreateUser({
    telegramId: `fanout_solo_${stamp}`,
    name: 'Solo Owner',
  });
  const soloPet = dbService.createPet({
    ownerId: soloTo.id,
    name: 'SoloPeer',
    species: 'dog',
  });
  const single = dbService.createPlaydateRequest({
    fromPetId: soloFrom.id,
    toPetId: soloPet.id,
    fromUserId: requester.id,
    toUserId: soloTo.id,
  });
  const singlePlan = planPlaydateRejectNotify(single);
  assert.equal(singlePlan.recipientCount, 1, 'direct playdate count 1');
  assert.equal(singlePlan.notifyRequester, true, 'single reject: notify requester');
  assert.ok(singlePlan.inboxUserIds.includes(requester.id), 'single reject inbox requester');

  const { user: patient } = dbService.findOrCreateUser({
    telegramId: `fanout_pat_${stamp}`,
    name: 'Patient',
  });
  const vets: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { user } = dbService.findOrCreateUser({
      telegramId: `fanout_vet_${stamp}_${i}`,
      name: `Vet ${i}`,
    });
    dbService.setUserRoles(user.id, ['vet']);
    vets.push(user.id);
  }
  const consults = vets.map((vetUserId) =>
    dbService.createVetConsultation({
      vetUserId,
      patientUserId: patient.id,
      notes: 'quick-connect',
      serviceKind: 'vet',
    })
  );
  const consultPlan = planConsultRejectNotify(consults[0]!);
  assert.equal(consultPlan.recipientCount, 4, 'consult fan-out count 4');
  assert.equal(consultPlan.notifyRequester, false, 'multi consult reject: no patient notify');
  assert.ok(
    !consultPlan.inboxUserIds.includes(patient.id),
    'multi consult: patient off inbox'
  );
  assert.ok(consultPlan.inboxUserIds.includes(vets[0]!), 'vet still notified locally');

  const { user: oneVet } = dbService.findOrCreateUser({
    telegramId: `fanout_onevet_${stamp}`,
    name: 'One Vet',
  });
  dbService.setUserRoles(oneVet.id, ['vet']);
  const oneConsult = dbService.createVetConsultation({
    vetUserId: oneVet.id,
    patientUserId: requester.id,
    notes: 'direct',
    serviceKind: 'trainer',
  });
  const onePlan = planConsultRejectNotify(oneConsult);
  assert.equal(onePlan.recipientCount, 1, 'direct consult count 1');
  assert.equal(onePlan.notifyRequester, true, 'single consult reject: notify patient');
  assert.ok(onePlan.inboxUserIds.includes(requester.id), 'single consult inbox patient');

  assert.equal(
    shouldNotifyRequesterOnReject(consultPlan.recipientCount),
    false,
    'predicate agrees with consult plan'
  );

  const playSrc = read('src/routes/playdates.ts');
  assert.match(playSrc, /planPlaydateRejectNotify/, 'playdate PATCH uses reject plan');
  assert.match(playSrc, /maybeNotifyPlaydateRequesterRejected/, 'playdate PATCH may DM requester');
  assert.match(
    playSrc,
    /status === 'rejected' && rejectPlan\?\.notifyRequester/,
    'playdate accept is not gated by reject plan'
  );

  const consultSrc = read('src/routes/consultations.ts');
  assert.match(consultSrc, /planConsultRejectNotify/, 'consult reject uses plan');
  assert.match(consultSrc, /maybeNotifyConsultRequesterRejected/, 'consult may DM patient');

  const acceptSrc = playSrc.slice(playSrc.indexOf("if (startOwnerChat && isRecipient)"));
  assert.match(acceptSrc, /openOwnerChatOnAccept/, 'accept still opens owner chat');

  const botPlay = read('../bot/src/handlers/playdates.ts');
  assert.doesNotMatch(
    botPlay,
    /requester\?\.telegramId[\s\S]{0,120}درخواست همبازی رد شد/,
    'bot no longer DMs requester on every playdate reject'
  );

  const botConsult = read('../bot/src/handlers/services.ts');
  assert.doesNotMatch(
    botConsult,
    /notify patient of consult decision/,
    'bot no longer DMs patient on every consult reject'
  );

  const hub = read('src/ws/chatHub.ts');
  assert.match(hub, /inboxUserIds/, 'thread notify can skip requester inbox');

  console.log('fanout-reject-notify.selftest: ok');
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
