/**
 * GTM / siteAnalytics pure helpers — no DOM required.
 * Run: npx tsx packages/web/src/lib/siteAnalytics.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  buildGtmLinkClickPayload,
  buildGtmPageViewPayload,
  classifyTrackedLink,
  DEFAULT_GTM_ID,
  GTM_DASHBOARD_URL,
  isCtaPath,
  isPetdateHost,
  isValidGtmContainerId,
  isValidGa4MeasurementId,
  resolveGa4MeasurementId,
  setRuntimeGa4MeasurementId,
} from './siteAnalytics.ts';

assert.equal(DEFAULT_GTM_ID, 'GTM-KQPJT9Q4');
assert.equal(GTM_DASHBOARD_URL, 'https://tagmanager.google.com/');
assert.ok(isValidGtmContainerId('GTM-KQPJT9Q4'));
assert.ok(isValidGtmContainerId('gtm-kqpjt9q4'));
assert.equal(isValidGtmContainerId('KQPJT9Q4'), false);
assert.ok(isValidGa4MeasurementId('G-ABCDEF12'));
assert.equal(isValidGa4MeasurementId('UA-123'), false);
assert.equal(isValidGa4MeasurementId('G-XXXX'), false);
setRuntimeGa4MeasurementId('G-TESTMEAS1');
assert.equal(resolveGa4MeasurementId(), 'G-TESTMEAS1');
setRuntimeGa4MeasurementId(null);

assert.equal(isPetdateHost('petdate.ir'), true);
assert.equal(isPetdateHost('www.petdate.ir'), true);
assert.equal(isPetdateHost('localhost'), true);
assert.equal(isPetdateHost('evil.com'), false);

assert.equal(isCtaPath('/login'), true);
assert.equal(isCtaPath('/login/extra'), true);
assert.equal(isCtaPath('/shop/cart'), true);
assert.equal(isCtaPath('/shop'), false);
assert.equal(isCtaPath('/faq'), false);

const page = buildGtmPageViewPayload({
  path: '/shop?utm_source=tg',
  title: 'فروشگاه',
  locationHref: 'https://petdate.ir/shop?utm_source=tg',
});
assert.equal(page.event, 'page_view');
assert.equal(page.page_path, '/shop');
assert.equal(page.page_title, 'فروشگاه');
assert.equal(page.page_location, 'https://petdate.ir/shop?utm_source=tg');

const origin = 'https://petdate.ir';

assert.equal(classifyTrackedLink('#', { currentOrigin: origin }), null);
assert.equal(classifyTrackedLink('javascript:void(0)', { currentOrigin: origin }), null);

const outbound = classifyTrackedLink('https://example.com/x', { currentOrigin: origin });
assert.ok(outbound);
assert.equal(outbound.kind, 'outbound');
assert.equal(outbound.outbound, true);

const telegram = classifyTrackedLink('https://t.me/petdatebot', { currentOrigin: origin });
assert.ok(telegram);
assert.equal(telegram.kind, 'telegram');

const download = classifyTrackedLink('/rx/12.pdf', { currentOrigin: origin, downloadAttr: false });
assert.ok(download);
assert.equal(download.kind, 'download');

const cta = classifyTrackedLink('/login', { currentOrigin: origin });
assert.ok(cta);
assert.equal(cta.kind, 'cta');
assert.equal(cta.outbound, false);

const contact = classifyTrackedLink('tel:+9821', { currentOrigin: origin });
assert.ok(contact);
assert.equal(contact.kind, 'contact');

const internalNoise = classifyTrackedLink('/faq', { currentOrigin: origin });
assert.equal(internalNoise, null);

const explicit = classifyTrackedLink('/faq', { currentOrigin: origin, explicitCta: true });
assert.ok(explicit);
assert.equal(explicit.kind, 'cta');

const click = buildGtmLinkClickPayload({
  kind: 'outbound',
  url: 'https://example.com/x',
  domain: 'example.com',
  outbound: true,
  text: '  بیشتر بخوانید  ',
});
assert.equal(click.event, 'link_click');
assert.equal(click.link_kind, 'outbound');
assert.equal(click.link_text, 'بیشتر بخوانید');
assert.equal(click.outbound, true);

console.log('siteAnalytics.selftest: OK');
