/**
 * Role reply keyboards: primary first, money grouped, destructive styled.
 * Run: npx tsx packages/bot/src/roleMenuOrder.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'keyboards.ts'), 'utf8');

const common = src.slice(src.indexOf('function appendCommonMenuRows'), src.indexOf('export function vetMenuKeyboard'));
assert.ok(common.indexOf('c.shop') < common.indexOf('c.coins'), 'common: شاپ before سکه');
assert.ok(common.indexOf('c.invite') < common.indexOf('c.coins'), 'common: دعوت before سکه');
assert.match(common, /extraFinance/, 'owner earn can sit on the finance row');

const owner = src.slice(src.indexOf('export function petOwnerMenuKeyboard'), src.indexOf('export function trainerMenuKeyboard'));
assert.ok(owner.indexOf('m.findPlaymate') < owner.indexOf('m.nearbyPets'), 'owner: همبازی first');
assert.ok(owner.indexOf('m.quickVet') < owner.indexOf('appendCommonMenuRows'), 'owner: consult before common/money');
assert.match(owner, /appendCommonMenuRows\(kb, m\.earn\)/, 'owner earn grouped with coins');
assert.doesNotMatch(owner, /\.text\(m\.earn\)\s*\n\s*\.primary\(\)/, 'earn is not a primary browse row');

const vet = src.slice(src.indexOf('export function vetMenuKeyboard'), src.indexOf('export function petOwnerMenuKeyboard'));
assert.ok(vet.indexOf('m.recentPatients') < vet.indexOf('m.visitFee'), 'vet: patients before visit fee');
assert.ok(vet.indexOf('m.profile') < vet.indexOf('m.visitFee'), 'vet: profile before money');

const admin = src.slice(src.indexOf('export function adminPanelKeyboard'), src.indexOf('export function myRolesSwitchKeyboard'));
assert.ok(admin.indexOf('m.faceQueue') < admin.indexOf('m.pendingPayments'), 'admin: verify queues before payments');
assert.ok(admin.indexOf('m.pendingPayments') < admin.indexOf('m.stats'), 'admin: payments not mixed with browse stats');
assert.match(admin, /\.text\(m\.pendingPayments\)\s*\n\s*\.danger\(\)/, 'pending payments use danger style');

console.log('roleMenuOrder.selftest: ok');
