import assert from 'node:assert/strict';
import {
  DEFAULT_ADMIN_PASSWORD,
  isDefaultAdminPassword,
  isUsableAdminPassword,
  resolveEnvAdminPassword,
} from './admin-password.ts';

assert.equal(DEFAULT_ADMIN_PASSWORD, 'petdate');
assert.equal(isDefaultAdminPassword('petdate'), true);
assert.equal(isDefaultAdminPassword('PETDATE'), true);
assert.equal(isDefaultAdminPassword('super-admin-bootstrap'), false);

assert.equal(isUsableAdminPassword('', 'production'), false);
assert.equal(isUsableAdminPassword('petdate', 'production'), false, 'prod rejects default');
assert.equal(isUsableAdminPassword('petdate', 'development'), true, 'dev may use default');
assert.equal(isUsableAdminPassword('launch-secret', 'production'), true);

assert.equal(
  resolveEnvAdminPassword({ ADMIN_PASSWORD: 'petdate', NODE_ENV: 'production' }),
  null
);
assert.equal(resolveEnvAdminPassword({ ADMIN_PASSWORD: '', NODE_ENV: 'production' }), null);
assert.equal(
  resolveEnvAdminPassword({ ADMIN_PASSWORD: 'launch-secret', NODE_ENV: 'production' }),
  'launch-secret'
);
assert.equal(
  resolveEnvAdminPassword({ ADMIN_PASSWORD: '', NODE_ENV: 'development' }),
  'petdate',
  'dev unset falls back to petdate'
);

console.log('admin-password.selftest: ok');
