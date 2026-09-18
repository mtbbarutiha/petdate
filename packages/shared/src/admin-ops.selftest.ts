/**
 * Admin ops rules: customer conversion, drill reset, category parent,
 * personnel contract, verification queue.
 * Run: npx tsx packages/shared/src/admin-ops.selftest.ts
 */
import {
  brandServesCategory,
  calendarEventCodes,
  callQaIndicatorSet,
  categoryParentAllowed,
  categoryPublicSlug,
  countArticleLinks,
  customerConversionPath,
  detectBot,
  detectFrequentLogin,
  initialDashboardDrill,
  isDashboardDrillInitial,
  reduceDashboardDrill,
  requirePersonnelContract,
  userInVerificationQueue,
} from './admin-ops';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/* Customer conversion — finance approval alone is not enough */
assert(customerConversionPath({ financeApproved: true }) === null, 'finance approval does not convert');
assert(customerConversionPath({ paidViaGateway: true }) === 'پرداخت', 'gateway payment converts');
assert(
  customerConversionPath({ agentSavedFirstName: true, agentSavedLastName: true }) === 'تکمیل نام توسط کارشناس',
  'agent name converts'
);
assert(customerConversionPath({ agentSavedFirstName: true }) === null, 'first name alone is not enough');
assert(customerConversionPath({ selfRegistered: true }) === 'ثبت‌نام', 'self register converts');
assert(
  customerConversionPath({ financeApproved: true, paidViaGateway: true }) === 'پرداخت',
  'payment wins over finance flag'
);

/* Drill reset restores the whole board, not a stuck widget grain */
const start = initialDashboardDrill('day');
assert(isDashboardDrillInitial(start), 'fresh drill is initial');
const into = reduceDashboardDrill(start, { type: 'drillInto', label: '2026-09-01' });
assert(into.focusStack.length === 1, 'drill-into records focus at finest grain');
assert(into.grain === 'day', 'finest grain stays day');
const up = reduceDashboardDrill(into, { type: 'drillUp' });
assert(up.focusStack.length === 0, 'drill-up pops focus');
const coarsened = reduceDashboardDrill(up, { type: 'drillUp' });
assert(coarsened.grain === 'week', 'drill-up coarsens when stack empty');
const reset = reduceDashboardDrill(coarsened, { type: 'reset' });
assert(isDashboardDrillInitial(reset), 'reset returns to initial day grain');
assert(reset.focusStack.length === 0 && reset.category === null, 'reset clears category');
const cat = reduceDashboardDrill(start, { type: 'selectCategory', label: 'CRM' });
assert(reduceDashboardDrill(cat, { type: 'drillUp' }).category === null, 'category drill-up clears');
assert(reduceDashboardDrill(cat, { type: 'crumb', index: -1 }).category === null, 'root crumb is full reset');

/* Two-level categories + slug stability */
const cats = [
  { slug: 'dry-food', parentSlug: null, labelFa: 'غذای خشک' },
  { slug: 'dog-food', parentSlug: 'dry-food', labelFa: 'سگ' },
  { slug: 'cat-food', parentSlug: 'dry-food', labelFa: 'گربه' },
];
assert(categoryParentAllowed(cats, 'dog-treats', 'treats').ok, 'new child under root ok');
assert(!categoryParentAllowed(cats, 'dog-food', 'dog-food').ok, 'self parent rejected');
assert(!categoryParentAllowed(cats, 'dry-food', 'dog-food').ok, 'parent cannot become child');
assert(categoryPublicSlug('dog-food', { 'old-dog-food': 'dog-food' }) === 'dog-food', 'redirect map');
assert(categoryPublicSlug('dog-food') === 'dog-food', 'unchanged public slug');

/* Personnel contract */
assert(!requirePersonnelContract({ hasEmployee: false }).ok, 'no personnel row');
assert(
  !requirePersonnelContract({ hasEmployee: true, contractStart: '', contractEnd: '' }).ok,
  'no dates'
);
assert(
  !requirePersonnelContract({
    hasEmployee: true,
    contractStart: '2024-01-01',
    contractEnd: '2024-02-01',
    today: '2026-09-18',
  }).ok,
  'expired contract'
);
assert(
  requirePersonnelContract({
    hasEmployee: true,
    contractStart: '2026-01-01',
    contractEnd: '2027-01-01',
    today: '2026-09-18',
  }).ok,
  'active contract'
);

/* Verification queue joins unverified users, not only pending submissions */
assert(userInVerificationQueue({ verificationStatus: 'pending', phoneVerified: true }), 'pending stays');
assert(userInVerificationQueue({ verificationStatus: 'none', phoneVerified: false }), 'unverified phone enters queue');
assert(!userInVerificationQueue({ verificationStatus: 'verified', phoneVerified: true }), 'verified stays out');
assert(!userInVerificationQueue({ verificationStatus: 'rejected', phoneVerified: false }), 'rejected stays out');

assert(calendarEventCodes('2026-09-18', { orders: 20, registrations: 50, emails: 0 })[0]?.text === 'or=20', 'order code');
assert(calendarEventCodes('2026-09-18', { orders: 20, registrations: 50 })[1]?.href.includes('/admin/users'), 'reg link');
assert(callQaIndicatorSet('call_out').length === 10 && callQaIndicatorSet('call_in').length === 10, 'qa sets');
assert(detectBot({ userAgent: 'curl/8.0' }).bot, 'bot ua');
assert(
  detectFrequentLogin(
    Array.from({ length: 8 }, (_, i) => ({
      at: new Date(Date.now() - i * 1000).toISOString(),
      ip: '1.2.3.4',
      ok: false,
    }))
  ).length === 1,
  'frequent login'
);
const links = countArticleLinks('<a href="/shop">x</a><a href="https://example.com/a">y</a>');
assert(links.internal === 1 && links.external === 1, 'link counts');
assert(brandServesCategory(['dry-food', 'treats'], 'treats'), 'brand in category');
assert(!brandServesCategory(['beds'], 'dry-food'), 'brand not in category');
assert(brandServesCategory([], 'dry-food'), 'empty brand categories means all');

console.log('admin-ops.selftest: OK');
