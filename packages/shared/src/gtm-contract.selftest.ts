/**
 * Shared GTM contract selftest.
 * Run: npx tsx packages/shared/src/gtm-contract.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  CLARITY_PROJECT_ID,
  GTM_CONTAINER_ID,
  GTM_EVENT_NAMES,
  GTM_SITE_TRIGGERS,
  GTM_SITE_VARIABLES,
  GTM_UI_SETUP_CHECKLIST,
  isGtmEventName,
} from './gtm-contract';

assert.equal(GTM_CONTAINER_ID, 'GTM-KQPJT9Q4');
assert.equal(CLARITY_PROJECT_ID, 'ygkl5nck6k');
assert.ok(GTM_SITE_VARIABLES.some((v) => v.name === 'page_path'));
assert.ok(GTM_SITE_VARIABLES.some((v) => v.name === 'user_status'));
assert.ok(GTM_SITE_VARIABLES.some((v) => v.name === 'utm_source'));
assert.ok(GTM_SITE_TRIGGERS.some((t) => t.name === 'page_view'));
assert.ok(GTM_SITE_TRIGGERS.some((t) => t.name === 'purchase'));
assert.ok(GTM_UI_SETUP_CHECKLIST.some((c) => c.id === 'tag-ga4-config'));
assert.ok(GTM_UI_SETUP_CHECKLIST.some((c) => c.id === 'var-dl-utm'));
assert.ok(isGtmEventName('login'));
assert.equal(isGtmEventName('not_an_event'), false);
assert.ok(GTM_EVENT_NAMES.includes('generate_lead'));

console.log('gtm-contract.selftest: OK');
