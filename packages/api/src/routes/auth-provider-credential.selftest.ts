/**
 * Web credential upload: vets can POST kind=vet even while offline.
 * Run: cd packages/api && npx tsx src/routes/auth-provider-credential.selftest.ts
 */
process.env.DATABASE_URL = '';
const tmpDir = `/tmp/petdate-selftest-vet-cred-${process.pid}`;
process.env.DATABASE_PATH = `${tmpDir}/petdate.db`;

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type { User } from '@petdate/shared';

fs.mkdirSync(tmpDir, { recursive: true });

function jpegFile(): File {
  return new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], 'license.jpg', {
    type: 'image/jpeg',
  });
}

async function listen(app: Express): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return {
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function upload(
  port: number,
  token: string | null,
  kind: string,
  file?: File
): Promise<{ status: number; body: Record<string, unknown> }> {
  const form = new FormData();
  form.append('kind', kind);
  if (file) form.append('file', file);
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/provider-credential`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const raw = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    body = { error: raw };
  }
  return { status: res.status, body };
}

async function main() {
  const { dbService, getDb } = await import('../db.ts');
  getDb();
  const { authRouter } = await import('./auth.ts');
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const { port, close } = await listen(app);
  const stamp = Date.now();
  try {
    const { user: vet } = dbService.findOrCreateUser({
      telegramId: `selftest_vet_cred_${stamp}`,
      name: 'Selftest Vet Cred',
      username: 'selftest_vet_cred',
    });
    dbService.setUserRoles(vet.id, ['vet']);
    assert.equal(Boolean(dbService.getUserById(vet.id)?.vetOnline), false, 'starts offline');
    const vetTok = `selftest_vet_tok_${stamp}`;
    dbService.createWebSession(vet.id, vetTok, new Date(Date.now() + 3600_000).toISOString());

    const unauth = await upload(port, null, 'vet', jpegFile());
    assert.equal(unauth.status, 401, 'guest is 401');

    const { user: owner } = dbService.findOrCreateUser({
      telegramId: `selftest_owner_cred_${stamp}`,
      name: 'Owner',
      username: 'owner_cred',
    });
    dbService.setUserRoles(owner.id, ['pet_owner']);
    const ownerTok = `selftest_owner_tok_${stamp}`;
    dbService.createWebSession(owner.id, ownerTok, new Date(Date.now() + 3600_000).toISOString());
    const ownerUp = await upload(port, ownerTok, 'vet', jpegFile());
    assert.equal(ownerUp.status, 403, 'owner cannot upload vet cred');

    const badKind = await upload(port, vetTok, 'nope', jpegFile());
    assert.equal(badKind.status, 400, 'invalid kind is 400');

    const ok = await upload(port, vetTok, 'vet', jpegFile());
    assert.equal(ok.status, 201, `vet upload 201 not ${ok.status}: ${JSON.stringify(ok.body)}`);
    const returned = ok.body.user as User;
    assert.equal(returned.vetCredentialStatus, 'pending', 'status pending after upload');
    assert.match(
      String(returned.vetCredentialFileId || ''),
      /^\/api\/auth\/provider-credential-file\//,
      'web file path stored'
    );
    assert.equal(Boolean(dbService.getUserById(vet.id)?.vetOnline), false, 'upload does not force online');

    const pending = dbService.listPendingVetCredentials();
    assert.ok(
      pending.some((u) => u.id === vet.id),
      'uploaded vet appears in admin pending queue'
    );

    const url = String(ok.body.url || '');
    const fileRes = await fetch(`http://127.0.0.1:${port}${url}`);
    assert.equal(fileRes.status, 200, 'stored file is readable');

    const { user: trainer } = dbService.findOrCreateUser({
      telegramId: `selftest_tr_cred_${stamp}`,
      name: 'Trainer',
      username: 'tr_cred',
    });
    dbService.setUserRoles(trainer.id, ['trainer']);
    const trTok = `selftest_tr_tok_${stamp}`;
    dbService.createWebSession(trainer.id, trTok, new Date(Date.now() + 3600_000).toISOString());
    const trOk = await upload(port, trTok, 'trainer', jpegFile());
    assert.equal(trOk.status, 201, 'trainer upload still works');
    assert.equal((trOk.body.user as User).trainerCredentialStatus, 'pending');

    const vetAsTrainer = await upload(port, vetTok, 'trainer', jpegFile());
    assert.equal(vetAsTrainer.status, 403, 'vet cannot upload trainer kind');
  } finally {
    try {
      dbService.deleteUserByTelegramId(`selftest_vet_cred_${stamp}`);
      dbService.deleteUserByTelegramId(`selftest_owner_cred_${stamp}`);
      dbService.deleteUserByTelegramId(`selftest_tr_cred_${stamp}`);
    } catch {
      /* ignore cleanup */
    }
    await close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  console.log('auth-provider-credential.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
