/**
 * Finance OS — accounts, transactions ledger, SBG cost allocation.
 * Additive SQLite schema (no wipe). Demo seed when empty.
 */
import type {
  FinanceOsAccount,
  FinanceOsAccountsBundle,
  FinanceOsAllocationBundle,
  FinanceOsBusiness,
  FinanceOsCategoryNode,
  FinanceOsCommitment,
  FinanceOsDimGroup,
  FinanceOsEquipment,
  FinanceOsImportLog,
  FinanceOsInvoice,
  FinanceOsOffice,
  FinanceOsPerson,
  FinanceOsSalesTeam,
  FinanceOsSbgExpense,
  FinanceOsSbgPerson,
  FinanceOsTransaction,
  FinanceOsTransactionsBundle,
  FinanceOsTxStatus,
} from '@petdate/shared';
import { getDb } from './db';

function db() {
  return getDb();
}
function nowIso(): string {
  return new Date().toISOString();
}
function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

let schemaReady = false;

export function ensureFinanceOsSchema(): void {
  if (schemaReady) return;
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS finance_os_businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS finance_os_sales_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      supervisor TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS finance_os_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      type TEXT NOT NULL DEFAULT '',
      dedication TEXT NOT NULL DEFAULT 'اختصاصی',
      provider TEXT NOT NULL DEFAULT '',
      line TEXT NOT NULL DEFAULT '',
      fee_percent REAL NOT NULL DEFAULT 0,
      opening_balance INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL DEFAULT '—',
      connection_type TEXT NOT NULL DEFAULT 'دستی (اکسل/CSV)',
      account_number TEXT NOT NULL DEFAULT '',
      iban TEXT NOT NULL DEFAULT '',
      card_number TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      provider_fee_percent REAL,
      sbg_margin_percent REAL,
      snapshots_json TEXT NOT NULL DEFAULT '[]',
      volume_json TEXT NOT NULL DEFAULT '[]',
      refunds_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS finance_os_people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      dept TEXT NOT NULL DEFAULT '',
      line TEXT NOT NULL DEFAULT '',
      sales INTEGER NOT NULL DEFAULT 0,
      team_code TEXT,
      team_history_json TEXT NOT NULL DEFAULT '[]',
      payments_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS finance_os_offices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL DEFAULT '',
      total_sqm REAL NOT NULL DEFAULT 0,
      space_json TEXT NOT NULL DEFAULT '[]',
      headcount_json TEXT NOT NULL DEFAULT '[]',
      areas_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS finance_os_dims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      key TEXT NOT NULL,
      items_json TEXT NOT NULL DEFAULT '[]',
      UNIQUE(kind, key)
    );
    CREATE TABLE IF NOT EXISTS finance_os_meta (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS finance_os_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT NOT NULL,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      desc TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'queued',
      note TEXT NOT NULL DEFAULT '',
      line TEXT NOT NULL DEFAULT '',
      sale_type TEXT,
      expense_type TEXT,
      category TEXT,
      campaign TEXT,
      product TEXT,
      payment_status TEXT,
      seller TEXT,
      related_person TEXT,
      raw_json TEXT NOT NULL DEFAULT '{}',
      suspicious_reason TEXT,
      duplicate_of_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS finance_os_import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      account TEXT NOT NULL,
      file_name TEXT NOT NULL DEFAULT '',
      rows INTEGER NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'file',
      status TEXT NOT NULL DEFAULT 'success'
    );
    CREATE TABLE IF NOT EXISTS finance_os_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT '',
      expense_category TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      purchase_date TEXT NOT NULL DEFAULT '',
      purchase_price INTEGER NOT NULL DEFAULT 0,
      current_value INTEGER NOT NULL DEFAULT 0,
      monthly_rate INTEGER NOT NULL DEFAULT 0,
      ownership TEXT NOT NULL DEFAULT 'SBG',
      assigned_business TEXT NOT NULL DEFAULT '',
      assigned_person TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS finance_os_sbg_people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      office TEXT NOT NULL DEFAULT '',
      allocation_method TEXT NOT NULL DEFAULT 'auto',
      time_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS finance_os_sbg_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      desc TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      related_person TEXT NOT NULL DEFAULT '',
      account TEXT NOT NULL DEFAULT '',
      allocated INTEGER NOT NULL DEFAULT 0,
      splits_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS finance_os_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      business TEXT NOT NULL,
      jy INTEGER NOT NULL,
      jm INTEGER NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      lines_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finance_os_commitments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      desc TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);
  schemaReady = true;
  seedFinanceOsIfEmpty();
}

function metaGet<T>(key: string, fallback: T): T {
  const row = db().prepare('SELECT value_json FROM finance_os_meta WHERE key = ?').get(key) as
    | { value_json: string }
    | undefined;
  return row ? parseJson(row.value_json, fallback) : fallback;
}

function metaSet(key: string, value: unknown): void {
  db()
    .prepare(
      `INSERT INTO finance_os_meta (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
    )
    .run(key, JSON.stringify(value));
}

const DEFAULT_CATEGORY_TREE: FinanceOsCategoryNode[] = [
  {
    name: 'PEOPLE',
    children: [
      { name: 'حقوق', children: [] },
      { name: 'بیمه', children: [] },
      { name: 'مالیات بر درآمد', children: [] },
      { name: 'هدیه', children: [] },
      { name: 'پاداش', children: [] },
    ],
  },
  {
    name: 'MARKETING',
    children: [
      { name: 'تبلیغات-PAID', children: [] },
      { name: 'فانل', children: [{ name: 'پیامک', children: [] }, { name: 'تماس صوتی', children: [] }] },
      { name: 'ابزار', children: [{ name: 'وبسایت و لندینگ‌پیج', children: [] }] },
    ],
  },
  {
    name: 'OVERHEAD',
    children: [
      {
        name: 'اجاره و امکانات دفتر',
        children: [
          { name: 'اجاره دفتر', children: [] },
          { name: 'هزینه جاری دفتر', children: [] },
          { name: 'شارژ و سرویس ساختمان', children: [] },
        ],
      },
      {
        name: 'تجهیزات و دارایی‌ها',
        children: [
          { name: 'خرید لپ‌تاپ و کامپیوتر', children: [] },
          { name: 'استهلاک تجهیزات', children: [] },
        ],
      },
      { name: 'خدمات حرفه‌ای', children: [{ name: 'حسابداری و حسابرسی', children: [] }] },
    ],
  },
  {
    name: 'COST OF SALES',
    children: [
      { name: 'هزینه مستقیم محصول', children: [] },
      { name: 'کمیسیون فروش', children: [] },
    ],
  },
];

function seedFinanceOsIfEmpty(): void {
  const d = db();
  const bizCount = (d.prepare('SELECT COUNT(*) AS c FROM finance_os_businesses').get() as { c: number }).c;
  if (bizCount > 0) return;

  const businesses = [
    { name: 'هایپاد', code: 'HYP' },
    { name: 'آپدیت', code: 'UPD' },
    { name: 'ارتقا', code: 'ART' },
    { name: 'SBG', code: 'SBG' },
    { name: 'مشترک هلدینگ', code: 'HLD-SHR' },
    { name: 'پت‌دیت', code: 'PD' },
  ];
  const insBiz = d.prepare('INSERT INTO finance_os_businesses (name, code) VALUES (?, ?)');
  for (const b of businesses) insBiz.run(b.name, b.code);

  const teams = [
    { code: 'HST-RN', supervisor: 'علی مرادی' },
    { code: 'HST-MH', supervisor: 'زهرا کریمی' },
    { code: 'RST-ASK', supervisor: 'حسین رضایی' },
  ];
  const insTeam = d.prepare('INSERT INTO finance_os_sales_teams (code, supervisor) VALUES (?, ?)');
  for (const t of teams) insTeam.run(t.code, t.supervisor);

  const accounts: Array<Record<string, unknown>> = [
    {
      code: 'B-HY-P-8100',
      type: 'بانک رسمی',
      dedication: 'اختصاصی',
      provider: 'بانک ملت',
      line: 'هایپاد',
      fee: 0,
      opening: 95000000,
      accountNumber: '4001238812345001',
      iban: 'IR860120000000004001238812',
      cardNumber: '6104337812345678',
      snapshots: [{ date: '2026-08-10', amount: 128400000, source: 'manual', note: 'ثبت اولیه هنگام مهاجرت' }],
    },
    {
      code: 'L-SNAPAY',
      type: 'BNPL',
      dedication: 'مشترک',
      provider: 'اسنپ‌پی',
      line: 'مشترک هلدینگ',
      fee: 20,
      opening: 31000000,
      providerFee: 16.5,
      sbgMargin: 3.5,
      accountNumber: '—',
      iban: '—',
      cardNumber: '—',
      notes: 'شناسه پذیرنده در تنظیمات ارائه‌دهنده ثبت است',
      volumes: [
        {
          jy: 1405,
          jm: 5,
          allocations: [
            { business: 'هایپاد', amount: 180000000 },
            { business: 'آپدیت', amount: 120000000 },
            { business: 'ارتقا', amount: 60000000 },
            { business: 'پت‌دیت', amount: 40000000 },
          ],
        },
      ],
      refunds: [{ date: '2026-08-05', business: 'هایپاد', amount: 2500000, note: 'بازگشت وجه مشتری — لغو سفارش' }],
      snapshots: [{ date: '2026-08-11', amount: 42150000, source: 'import', note: 'از فایل روزانه اسنپ‌پی' }],
    },
    {
      code: 'G-ZRP-01',
      type: 'درگاه پرداخت',
      dedication: 'اختصاصی',
      provider: 'زرین‌پال',
      line: 'پت‌دیت',
      fee: 1.5,
      opening: 12000000,
      accountNumber: '—',
      iban: '—',
      cardNumber: '—',
      snapshots: [{ date: '2026-08-12', amount: 18500000, source: 'api', note: 'همگام‌سازی API' }],
    },
    {
      code: 'B-ACC-02',
      type: 'بانک رسمی',
      dedication: 'اختصاصی',
      provider: 'بانک صادرات',
      line: 'آپدیت',
      fee: 0,
      opening: 54000000,
      accountNumber: '0208123456001',
      iban: 'IR720190000000020812345601',
      cardNumber: '6037691212345678',
      snapshots: [],
    },
    {
      code: 'W-CASH-SBG',
      type: 'کیف پول نقدی',
      dedication: 'اختصاصی',
      provider: 'صندوق SBG',
      line: 'SBG',
      fee: 0,
      opening: 85000000,
      accountNumber: '—',
      iban: '—',
      cardNumber: '—',
      snapshots: [{ date: '2026-08-01', amount: 85000000, source: 'manual', note: 'موجودی ابتدای ماه' }],
    },
  ];
  const insAcc = d.prepare(`
    INSERT INTO finance_os_accounts (
      code, status, type, dedication, provider, line, fee_percent, opening_balance,
      owner, connection_type, account_number, iban, card_number, notes,
      provider_fee_percent, sbg_margin_percent, snapshots_json, volume_json, refunds_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const a of accounts) {
    insAcc.run(
      a.code,
      'active',
      a.type,
      a.dedication,
      a.provider,
      a.line,
      a.fee ?? 0,
      a.opening ?? 0,
      '—',
      'دستی (اکسل/CSV)',
      a.accountNumber ?? '',
      a.iban ?? '',
      a.cardNumber ?? '',
      a.notes ?? '',
      a.providerFee ?? null,
      a.sbgMargin ?? null,
      JSON.stringify(a.snapshots ?? []),
      JSON.stringify(a.volumes ?? []),
      JSON.stringify(a.refunds ?? [])
    );
  }

  const incomeDims: Array<[string, string[]]> = [
    ['نوع فروش', ['تیم فروش', 'مارکتینگ مستقیم', 'مارکتینگ رزرو', 'تیم آپگرید', 'انتقال-ورودی', 'نامشخص']],
    ['کمپین‌ها', ['SKMC54-1', 'SKMW54-1']],
    ['محصولات', ['Product A', 'Product B', 'Product C', 'Product D', 'Product E', 'اشتراک پت‌دیت']],
    [
      'وضعیت پرداخت',
      [
        'رزرو وبینار',
        'دپوزیت',
        'پرداخت قسط اول',
        'پرداخت کامل',
        'پرداخت قسط دوم',
        'تکمیل رزرو',
        'تکمیل دپوزیت',
        'نیمه اسنپ‌پی',
        'نیمه چک',
      ],
    ],
  ];
  const expenseDims: Array<[string, string[]]> = [
    ['نوع هزینه', ['مستقیم', 'فاکتور هولدینگ', 'عودت', 'بازگشت مبلغ', 'انتقال-خروجی', 'نامشخص']],
    ['کمپین‌ها', ['SKMC54-1', 'SKMW54-1']],
    ['تیم مرتبط', ['فروش', 'مارکتینگ', 'محصول', 'پشتیبانی', 'مالی', 'عملیات', 'مدیریت', 'سایر']],
  ];
  const insDim = d.prepare(
    'INSERT INTO finance_os_dims (kind, key, items_json) VALUES (?, ?, ?)'
  );
  for (const [k, items] of incomeDims) insDim.run('income', k, JSON.stringify(items));
  for (const [k, items] of expenseDims) insDim.run('expense', k, JSON.stringify(items));
  metaSet('categoryTree', DEFAULT_CATEGORY_TREE);
  metaSet('bankBalance', 85000000);

  const people = [
    {
      name: 'سعید',
      role: 'کارشناس فروش',
      dept: 'فروش - کلی',
      line: 'هایپاد',
      sales: 1,
      team: 'RST-ASK',
      hist: [
        { code: 'HST-RN', from: '2026-04-10' },
        { code: 'RST-ASK', from: '2026-06-10' },
      ],
      payments: [
        { jy: 1405, jm: 5, type: 'حقوق', amount: 47000000, note: 'افزایش حقوق' },
        { jy: 1405, jm: 5, type: 'بیمه', amount: 3200000, note: '' },
      ],
    },
    {
      name: 'اکبر',
      role: 'کارشناس فروش',
      dept: 'فروش ریموت',
      line: 'آپدیت',
      sales: 1,
      team: 'HST-MH',
      hist: [{ code: 'HST-MH', from: '2026-05-15' }],
      payments: [{ jy: 1405, jm: 5, type: 'حقوق', amount: 38000000, note: '' }],
    },
    {
      name: 'فروشنده یک',
      role: 'کارشناس فروش',
      dept: 'فروش حضوری',
      line: 'ارتقا',
      sales: 1,
      team: 'RST-ASK',
      hist: [{ code: 'RST-ASK', from: '2026-04-01' }],
      payments: [],
    },
    {
      name: 'امیر توکلی',
      role: 'حسابدار',
      dept: 'مالی',
      line: 'SBG',
      sales: 0,
      team: null,
      hist: [],
      payments: [
        { jy: 1405, jm: 5, type: 'حقوق', amount: 52000000, note: '' },
        { jy: 1405, jm: 5, type: 'بیمه', amount: 3600000, note: '' },
      ],
    },
    {
      name: 'علی مرادی',
      role: 'سرپرست تیم فروش',
      dept: 'فروش - کلی',
      line: 'هایپاد',
      sales: 1,
      team: 'HST-RN',
      hist: [{ code: 'HST-RN', from: '2026-01-01' }],
      payments: [],
    },
    {
      name: 'زهرا کریمی',
      role: 'سرپرست تیم فروش',
      dept: 'فروش ریموت',
      line: 'آپدیت',
      sales: 1,
      team: 'HST-MH',
      hist: [{ code: 'HST-MH', from: '2026-01-01' }],
      payments: [],
    },
    {
      name: 'حسین رضایی',
      role: 'سرپرست رزرو',
      dept: 'مارکتینگ',
      line: 'ارتقا',
      sales: 1,
      team: 'RST-ASK',
      hist: [{ code: 'RST-ASK', from: '2026-02-01' }],
      payments: [],
    },
  ];
  const insPeople = d.prepare(`
    INSERT INTO finance_os_people (name, role, dept, line, sales, team_code, team_history_json, payments_json)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  for (const p of people) {
    insPeople.run(
      p.name,
      p.role,
      p.dept,
      p.line,
      p.sales,
      p.team,
      JSON.stringify(p.hist),
      JSON.stringify(p.payments)
    );
  }

  const offices = [
    {
      name: 'دفتر مرکزی - ونک',
      address: 'تهران، ونک',
      totalSqm: 220,
      space: [{ jy: 1405, jm: 5, allocations: [{ business: 'هایپاد', sqm: 120 }, { business: 'آپدیت', sqm: 100 }] }],
      head: [{ jy: 1405, jm: 5, allocations: [{ business: 'هایپاد', count: 14 }, { business: 'آپدیت', count: 9 }] }],
      areas: [
        { id: 'area1', name: 'اتاق شماره ۱ (اختصاصی)', sqm: 40, monthlyRent: 45000000, assignedBusiness: 'هایپاد' },
        { id: 'area2', name: 'سالن مشترک', sqm: 80, monthlyRent: 90000000, assignedBusiness: null },
      ],
    },
    {
      name: 'دفتر شعبه - سعادت‌آباد',
      address: 'تهران، سعادت‌آباد',
      totalSqm: 140,
      space: [],
      head: [],
      areas: [],
    },
    {
      name: 'دفتر شعبه - کرج',
      address: 'کرج، عظیمیه',
      totalSqm: 90,
      space: [],
      head: [],
      areas: [],
    },
  ];
  const insOff = d.prepare(`
    INSERT INTO finance_os_offices (name, address, total_sqm, space_json, headcount_json, areas_json)
    VALUES (?,?,?,?,?,?)
  `);
  for (const o of offices) {
    insOff.run(o.name, o.address, o.totalSqm, JSON.stringify(o.space), JSON.stringify(o.head), JSON.stringify(o.areas));
  }

  const txs: Array<Record<string, unknown>> = [
    {
      account: 'B-HY-P-8100',
      date: '2026-08-05',
      amount: 47000000,
      desc: 'واریز فروش وبسایت',
      status: 'classified',
      note: 'تسویه بسته حرفه‌ای',
      line: 'هایپاد',
      saleType: 'تیم فروش',
      product: 'Product B',
      paymentStatus: 'پرداخت کامل',
      seller: 'سعید',
      raw: { 'شماره پیگیری': '71204458', 'نام طرف حساب': 'مشتری - کامران رضوی' },
    },
    {
      account: 'G-ZRP-01',
      date: '2026-08-07',
      amount: 3200000,
      desc: 'واریز درگاه زرین‌پال',
      status: 'classified',
      note: '',
      line: 'پت‌دیت',
      saleType: 'مارکتینگ مستقیم',
      product: 'اشتراک پت‌دیت',
      paymentStatus: 'پرداخت کامل',
      seller: '',
      raw: { ref: 'ZP-99211' },
    },
    {
      account: 'B-HY-P-8100',
      date: '2026-08-08',
      amount: -8500000,
      desc: 'پرداخت تبلیغات اینستاگرام',
      status: 'classified',
      note: '',
      line: 'هایپاد',
      expenseType: 'مستقیم',
      category: 'MARKETING ← تبلیغات-PAID',
      raw: {},
    },
    {
      account: 'W-CASH-SBG',
      date: '2026-08-05',
      amount: -32000000,
      desc: 'حقوق امیر توکلی - مرداد',
      status: 'classified',
      note: '',
      line: 'SBG',
      expenseType: 'فاکتور هولدینگ',
      category: 'PEOPLE ← حقوق',
      relatedPerson: 'امیر توکلی',
      raw: {},
    },
    {
      account: 'B-ACC-02',
      date: '2026-08-12',
      amount: 15000000,
      desc: 'واریز نامشخص — بررسی',
      status: 'queued',
      note: '',
      line: 'آپدیت',
      raw: { 'شماره پیگیری': '881122' },
    },
    {
      account: 'B-HY-P-8100',
      date: '2026-08-13',
      amount: -2100000,
      desc: 'برداشت مبهم',
      status: 'queued',
      note: '',
      line: 'هایپاد',
      raw: {},
    },
    {
      account: 'G-ZRP-01',
      date: '2026-08-07',
      amount: 3200000,
      desc: 'واریز درگاه زرین‌پال (تکراری؟)',
      status: 'suspicious',
      note: '',
      line: 'پت‌دیت',
      suspiciousReason: 'مبلغ و تاریخ مشابه تراکنش #2',
      duplicateOfId: 2,
      raw: { ref: 'ZP-99211-dup' },
    },
    {
      account: 'L-SNAPAY',
      date: '2026-08-14',
      amount: 8900000,
      desc: 'تسویه اسنپ‌پی — هایپاد',
      status: 'classified',
      note: '',
      line: 'هایپاد',
      saleType: 'تیم فروش',
      paymentStatus: 'نیمه اسنپ‌پی',
      seller: 'سعید',
      raw: {},
    },
  ];
  const insTx = d.prepare(`
    INSERT INTO finance_os_transactions (
      account, date, amount, desc, status, note, line, sale_type, expense_type, category,
      campaign, product, payment_status, seller, related_person, raw_json, suspicious_reason, duplicate_of_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const t of txs) {
    insTx.run(
      t.account,
      t.date,
      t.amount,
      t.desc,
      t.status,
      t.note ?? '',
      t.line ?? '',
      t.saleType ?? null,
      t.expenseType ?? null,
      t.category ?? null,
      t.campaign ?? null,
      t.product ?? null,
      t.paymentStatus ?? null,
      t.seller ?? null,
      t.relatedPerson ?? null,
      JSON.stringify(t.raw ?? {}),
      t.suspiciousReason ?? null,
      t.duplicateOfId ?? null
    );
  }

  const insLog = d.prepare(`
    INSERT INTO finance_os_import_log (at, account, file_name, rows, method, status)
    VALUES (?,?,?,?,?,?)
  `);
  insLog.run('2026-08-05T09:14:00', 'B-HY-P-8100', 'mellat-mordad05.csv', 6, 'file', 'success');
  insLog.run('2026-08-07T11:30:00', 'G-ZRP-01', 'zarinpal-export.xlsx', 3, 'file', 'success');
  insLog.run('2026-08-14T08:00:12', 'L-SNAPAY', 'api-sync', 5, 'api', 'success');
  insLog.run('2026-08-16T08:00:15', 'L-SNAPAY', 'api-sync', 0, 'api', 'failed');

  d.prepare(`
    INSERT INTO finance_os_equipment (
      code, category, expense_category, name, brand, purchase_date, purchase_price,
      current_value, monthly_rate, ownership, assigned_business, assigned_person
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    'LAP-0001',
    'کامپیوتر و لپ‌تاپ',
    'OVERHEAD ← تجهیزات و دارایی‌ها ← خرید لپ‌تاپ و کامپیوتر',
    'لپ‌تاپ Dell XPS #۱',
    'Dell',
    '2026-06-01',
    65000000,
    52000000,
    1500000,
    'SBG',
    'هایپاد',
    'سعید'
  );
  d.prepare(`
    INSERT INTO finance_os_equipment (
      code, category, expense_category, name, brand, purchase_date, purchase_price,
      current_value, monthly_rate, ownership, assigned_business, assigned_person
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    'PRN-0002',
    'تجهیزات اداری (پرینتر، اسکنر، تلفن)',
    'OVERHEAD ← تجهیزات و دارایی‌ها ← استهلاک تجهیزات',
    'پرینتر HP LaserJet',
    'HP',
    '2025-11-10',
    18000000,
    12000000,
    400000,
    'SBG',
    'SBG',
    'امیر توکلی'
  );

  d.prepare(`
    INSERT INTO finance_os_sbg_people (name, role, office, allocation_method, time_json)
    VALUES (?,?,?,?,?)
  `).run(
    'امیر توکلی',
    'حسابدار',
    'دفتر مرکزی - ونک',
    'auto',
    JSON.stringify([
      {
        jy: 1405,
        jm: 5,
        allocations: [
          { business: 'هایپاد', percent: 40 },
          { business: 'آپدیت', percent: 30 },
          { business: 'ارتقا', percent: 20 },
          { business: 'پت‌دیت', percent: 10 },
        ],
      },
    ])
  );

  const sbgEx = [
    {
      date: '2026-08-05',
      amount: -32000000,
      desc: 'حقوق امیر توکلی - مرداد',
      category: 'PEOPLE ← حقوق',
      person: 'امیر توکلی',
      account: 'W-CASH-SBG',
      allocated: 1,
      splits: [
        { business: 'هایپاد', amount: 12800000, basis: 'زمان' },
        { business: 'آپدیت', amount: 9600000, basis: 'زمان' },
        { business: 'ارتقا', amount: 6400000, basis: 'زمان' },
        { business: 'پت‌دیت', amount: 3200000, basis: 'زمان' },
      ],
    },
    {
      date: '2026-08-05',
      amount: -2400000,
      desc: 'بیمه امیر توکلی - مرداد',
      category: 'PEOPLE ← بیمه',
      person: 'امیر توکلی',
      account: 'W-CASH-SBG',
      allocated: 0,
      splits: [],
    },
    {
      date: '2026-08-01',
      amount: -95000000,
      desc: 'اجاره دفتر مرکزی - مرداد',
      category: 'OVERHEAD ← اجاره و امکانات دفتر ← اجاره دفتر',
      person: '',
      account: 'W-CASH-SBG',
      allocated: 0,
      splits: [],
    },
  ];
  const insSbg = d.prepare(`
    INSERT INTO finance_os_sbg_expenses (date, amount, desc, category, related_person, account, allocated, splits_json)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  for (const e of sbgEx) {
    insSbg.run(e.date, e.amount, e.desc, e.category, e.person, e.account, e.allocated, JSON.stringify(e.splits));
  }

  d.prepare(`
    INSERT INTO finance_os_commitments (desc, category, amount, due_date, status)
    VALUES (?,?,?,?,?)
  `).run('اجاره فصلی دفتر مرکزی به مالک ملک', 'اجاره به مالک ملک', 285000000, '2026-11-01', 'pending');
  d.prepare(`
    INSERT INTO finance_os_commitments (desc, category, amount, due_date, status)
    VALUES (?,?,?,?,?)
  `).run('مالیات بر درآمد سالانه SBG', 'مالیات بر درآمد', 180000000, '2027-03-20', 'pending');

  d.prepare(`
    INSERT INTO finance_os_invoices (number, business, jy, jm, total, status, lines_json, created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    'INV-SBG-1405-05-01',
    'هایپاد',
    1405,
    5,
    12800000,
    'issued',
    JSON.stringify([{ desc: 'حقوق امیر توکلی - مرداد', category: 'PEOPLE ← حقوق', amount: 12800000 }]),
    '2026-08-20T10:00:00.000Z'
  );
}

/* ---------- mappers ---------- */

function mapAccount(row: Record<string, unknown>): FinanceOsAccount {
  const snapshots = parseJson<FinanceOsAccount['snapshots']>(row.snapshots_json, []);
  const opening = Number(row.opening_balance) || 0;
  const lastSnap = snapshots.length ? snapshots[snapshots.length - 1].amount : opening;
  return {
    id: Number(row.id),
    code: String(row.code),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    type: String(row.type || ''),
    dedication: String(row.dedication || ''),
    provider: String(row.provider || ''),
    line: String(row.line || ''),
    feePercent: Number(row.fee_percent) || 0,
    openingBalance: opening,
    owner: String(row.owner || '—'),
    connectionType: String(row.connection_type || ''),
    accountNumber: String(row.account_number || ''),
    iban: String(row.iban || ''),
    cardNumber: String(row.card_number || ''),
    notes: String(row.notes || ''),
    providerFeePercent: row.provider_fee_percent != null ? Number(row.provider_fee_percent) : undefined,
    sbgMarginPercent: row.sbg_margin_percent != null ? Number(row.sbg_margin_percent) : undefined,
    snapshots,
    volumeAllocations: parseJson(row.volume_json, []),
    refunds: parseJson(row.refunds_json, []),
    currentBalance: lastSnap,
  };
}

function mapPerson(row: Record<string, unknown>): FinanceOsPerson {
  return {
    id: Number(row.id),
    name: String(row.name),
    role: String(row.role || ''),
    dept: String(row.dept || ''),
    line: String(row.line || ''),
    sales: Boolean(row.sales),
    teamCode: row.team_code != null ? String(row.team_code) : null,
    teamHistory: parseJson(row.team_history_json, []),
    payments: parseJson(row.payments_json, []),
  };
}

function mapOffice(row: Record<string, unknown>): FinanceOsOffice {
  return {
    id: Number(row.id),
    name: String(row.name),
    address: String(row.address || ''),
    totalSqm: Number(row.total_sqm) || 0,
    spaceAllocations: parseJson(row.space_json, []),
    headcountAllocations: parseJson(row.headcount_json, []),
    areas: parseJson(row.areas_json, []),
  };
}

function mapTx(row: Record<string, unknown>): FinanceOsTransaction {
  return {
    id: Number(row.id),
    account: String(row.account),
    date: String(row.date),
    amount: Number(row.amount) || 0,
    desc: String(row.desc || ''),
    status: (String(row.status || 'queued') as FinanceOsTxStatus),
    note: String(row.note || ''),
    line: String(row.line || ''),
    saleType: row.sale_type != null ? String(row.sale_type) : undefined,
    expenseType: row.expense_type != null ? String(row.expense_type) : undefined,
    category: row.category != null ? String(row.category) : undefined,
    campaign: row.campaign != null ? String(row.campaign) : undefined,
    product: row.product != null ? String(row.product) : undefined,
    paymentStatus: row.payment_status != null ? String(row.payment_status) : undefined,
    seller: row.seller != null ? String(row.seller) : undefined,
    relatedPerson: row.related_person != null ? String(row.related_person) : undefined,
    rawDetails: parseJson(row.raw_json, {}),
    suspiciousReason: row.suspicious_reason != null ? String(row.suspicious_reason) : undefined,
    duplicateOfId: row.duplicate_of_id != null ? Number(row.duplicate_of_id) : null,
  };
}

function listBusinesses(): FinanceOsBusiness[] {
  return (
    db().prepare('SELECT id, name, code FROM finance_os_businesses ORDER BY id').all() as Array<{
      id: number;
      name: string;
      code: string;
    }>
  ).map((r) => ({ id: r.id, name: r.name, code: r.code }));
}

function listSalesTeams(): FinanceOsSalesTeam[] {
  return (
    db().prepare('SELECT id, code, supervisor FROM finance_os_sales_teams ORDER BY id').all() as Array<{
      id: number;
      code: string;
      supervisor: string;
    }>
  ).map((r) => ({ id: r.id, code: r.code, supervisor: r.supervisor }));
}

function listDims(kind: 'income' | 'expense'): FinanceOsDimGroup[] {
  return (
    db()
      .prepare('SELECT kind, key, items_json FROM finance_os_dims WHERE kind = ? ORDER BY id')
      .all(kind) as Array<{ kind: string; key: string; items_json: string }>
  ).map((r) => ({
    key: r.key,
    kind: kind,
    items: parseJson<string[]>(r.items_json, []),
  }));
}

export function getFinanceOsAccountsBundle(): FinanceOsAccountsBundle {
  ensureFinanceOsSchema();
  const accounts = (
    db().prepare('SELECT * FROM finance_os_accounts ORDER BY id').all() as Array<Record<string, unknown>>
  ).map(mapAccount);
  const snappayAcc = accounts.find((a) => a.code === 'L-SNAPAY' || a.type === 'BNPL');
  return {
    accounts,
    businesses: listBusinesses(),
    salesTeams: listSalesTeams(),
    people: (
      db().prepare('SELECT * FROM finance_os_people ORDER BY id').all() as Array<Record<string, unknown>>
    ).map(mapPerson),
    offices: (
      db().prepare('SELECT * FROM finance_os_offices ORDER BY id').all() as Array<Record<string, unknown>>
    ).map(mapOffice),
    incomeDims: listDims('income'),
    expenseDims: listDims('expense'),
    categoryTree: metaGet<FinanceOsCategoryNode[]>('categoryTree', DEFAULT_CATEGORY_TREE),
    snappay: {
      providerFeePercent: snappayAcc?.providerFeePercent ?? 16.5,
      sbgMarginPercent: snappayAcc?.sbgMarginPercent ?? 3.5,
      volumes: snappayAcc?.volumeAllocations ?? [],
    },
  };
}

export function createFinanceOsAccount(input: {
  code: string;
  type?: string;
  dedication?: string;
  provider?: string;
  line?: string;
  feePercent?: number;
  openingBalance?: number;
  accountNumber?: string;
  iban?: string;
  cardNumber?: string;
  notes?: string;
}): FinanceOsAccount {
  ensureFinanceOsSchema();
  const code = String(input.code || '').trim();
  if (!code) throw new Error('کد حساب الزامی است');
  db()
    .prepare(
      `INSERT INTO finance_os_accounts (
        code, type, dedication, provider, line, fee_percent, opening_balance,
        account_number, iban, card_number, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      code,
      input.type || 'بانک رسمی',
      input.dedication || 'اختصاصی',
      input.provider || '',
      input.line || 'پت‌دیت',
      Number(input.feePercent) || 0,
      Number(input.openingBalance) || 0,
      input.accountNumber || '',
      input.iban || '',
      input.cardNumber || '',
      input.notes || ''
    );
  const row = db().prepare('SELECT * FROM finance_os_accounts WHERE code = ?').get(code) as Record<
    string,
    unknown
  >;
  return mapAccount(row);
}

export function updateFinanceOsAccount(
  id: number,
  patch: Partial<{
    status: string;
    type: string;
    dedication: string;
    provider: string;
    line: string;
    feePercent: number;
    openingBalance: number;
    owner: string;
    connectionType: string;
    accountNumber: string;
    iban: string;
    cardNumber: string;
    notes: string;
    providerFeePercent: number;
    sbgMarginPercent: number;
  }>
): FinanceOsAccount {
  ensureFinanceOsSchema();
  const prev = db().prepare('SELECT * FROM finance_os_accounts WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!prev) throw new Error('حساب یافت نشد');
  db()
    .prepare(
      `UPDATE finance_os_accounts SET
        status=?, type=?, dedication=?, provider=?, line=?, fee_percent=?, opening_balance=?,
        owner=?, connection_type=?, account_number=?, iban=?, card_number=?, notes=?,
        provider_fee_percent=?, sbg_margin_percent=?
       WHERE id=?`
    )
    .run(
      patch.status ?? prev.status,
      patch.type ?? prev.type,
      patch.dedication ?? prev.dedication,
      patch.provider ?? prev.provider,
      patch.line ?? prev.line,
      patch.feePercent ?? prev.fee_percent,
      patch.openingBalance ?? prev.opening_balance,
      patch.owner ?? prev.owner,
      patch.connectionType ?? prev.connection_type,
      patch.accountNumber ?? prev.account_number,
      patch.iban ?? prev.iban,
      patch.cardNumber ?? prev.card_number,
      patch.notes ?? prev.notes,
      patch.providerFeePercent ?? prev.provider_fee_percent,
      patch.sbgMarginPercent ?? prev.sbg_margin_percent,
      id
    );
  return mapAccount(db().prepare('SELECT * FROM finance_os_accounts WHERE id = ?').get(id) as Record<string, unknown>);
}

export function upsertFinanceOsDim(kind: 'income' | 'expense', key: string, items: string[]): FinanceOsDimGroup {
  ensureFinanceOsSchema();
  const k = String(key || '').trim();
  if (!k) throw new Error('کلید فهرست الزامی است');
  const clean = items.map((x) => String(x).trim()).filter(Boolean);
  db()
    .prepare(
      `INSERT INTO finance_os_dims (kind, key, items_json) VALUES (?, ?, ?)
       ON CONFLICT(kind, key) DO UPDATE SET items_json = excluded.items_json`
    )
    .run(kind, k, JSON.stringify(clean));
  return { kind, key: k, items: clean };
}

export function createFinanceOsPerson(input: {
  name: string;
  role?: string;
  dept?: string;
  line?: string;
  sales?: boolean;
  teamCode?: string | null;
}): FinanceOsPerson {
  ensureFinanceOsSchema();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('نام الزامی است');
  const info = db()
    .prepare(
      `INSERT INTO finance_os_people (name, role, dept, line, sales, team_code, team_history_json, payments_json)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      name,
      input.role || '',
      input.dept || '',
      input.line || '',
      input.sales ? 1 : 0,
      input.teamCode || null,
      JSON.stringify(input.teamCode ? [{ code: input.teamCode, from: nowIso().slice(0, 10) }] : []),
      '[]'
    );
  return mapPerson(
    db().prepare('SELECT * FROM finance_os_people WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<
      string,
      unknown
    >
  );
}

function ledgerSummary(rows: FinanceOsTransaction[]) {
  const income = rows
    .filter((t) => t.amount > 0 && t.saleType !== 'انتقال-ورودی')
    .reduce((s, t) => s + t.amount, 0);
  const expense = rows
    .filter(
      (t) =>
        t.amount < 0 &&
        t.expenseType !== 'انتقال-خروجی' &&
        t.expenseType !== 'عودت' &&
        t.expenseType !== 'بازگشت مبلغ'
    )
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const refundReturn = rows
    .filter((t) => t.amount < 0 && (t.expenseType === 'عودت' || t.expenseType === 'بازگشت مبلغ'))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return {
    income,
    expense,
    refundReturn,
    net: income - expense,
    count: rows.length,
  };
}

export function getFinanceOsTransactionsBundle(filters?: {
  status?: string;
  account?: string;
  direction?: string;
}): FinanceOsTransactionsBundle {
  ensureFinanceOsSchema();
  let rows = (
    db().prepare('SELECT * FROM finance_os_transactions ORDER BY date DESC, id DESC').all() as Array<
      Record<string, unknown>
    >
  ).map(mapTx);

  const queueCount = rows.filter((t) => t.status === 'queued').length;
  const suspiciousCount = rows.filter((t) => t.status === 'suspicious').length;

  if (filters?.status && filters.status !== 'all') {
    rows = rows.filter((t) => t.status === filters.status);
  }
  if (filters?.account) {
    rows = rows.filter((t) => t.account === filters.account);
  }
  if (filters?.direction === 'income') {
    rows = rows.filter((t) => t.amount > 0 && t.saleType !== 'انتقال-ورودی');
  } else if (filters?.direction === 'expense') {
    rows = rows.filter(
      (t) =>
        t.amount < 0 &&
        t.expenseType !== 'انتقال-خروجی' &&
        t.expenseType !== 'عودت' &&
        t.expenseType !== 'بازگشت مبلغ'
    );
  } else if (filters?.direction === 'transfer') {
    rows = rows.filter((t) => t.saleType === 'انتقال-ورودی' || t.expenseType === 'انتقال-خروجی');
  } else if (filters?.direction === 'refund') {
    rows = rows.filter((t) => t.expenseType === 'عودت' || t.expenseType === 'بازگشت مبلغ');
  }

  const classified = rows.filter((t) => t.status === 'classified');
  const accounts = (
    db().prepare('SELECT code, provider, line FROM finance_os_accounts WHERE status = ? ORDER BY id').all(
      'active'
    ) as Array<{ code: string; provider: string; line: string }>
  ).map((a) => ({ code: a.code, provider: a.provider, line: a.line }));

  const importLog = (
    db().prepare('SELECT * FROM finance_os_import_log ORDER BY id DESC LIMIT 50').all() as Array<
      Record<string, unknown>
    >
  ).map(
    (r): FinanceOsImportLog => ({
      id: Number(r.id),
      at: String(r.at),
      account: String(r.account),
      fileName: String(r.file_name || ''),
      rows: Number(r.rows) || 0,
      method: (String(r.method || 'file') as FinanceOsImportLog['method']),
      status: r.status === 'failed' ? 'failed' : 'success',
    })
  );

  return {
    transactions: rows,
    importLog,
    accounts,
    queueCount,
    suspiciousCount,
    ledgerSummary: ledgerSummary(classified.length ? classified : rows.filter((t) => t.status === 'classified')),
  };
}

export function classifyFinanceOsTransaction(
  id: number,
  patch: {
    status?: FinanceOsTxStatus;
    saleType?: string;
    expenseType?: string;
    category?: string;
    campaign?: string;
    product?: string;
    paymentStatus?: string;
    seller?: string;
    relatedPerson?: string;
    line?: string;
    note?: string;
  }
): FinanceOsTransaction {
  ensureFinanceOsSchema();
  const prev = db().prepare('SELECT * FROM finance_os_transactions WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!prev) throw new Error('تراکنش یافت نشد');
  const amount = Number(prev.amount) || 0;
  const status = patch.status || 'classified';
  db()
    .prepare(
      `UPDATE finance_os_transactions SET
        status=?, sale_type=?, expense_type=?, category=?, campaign=?, product=?,
        payment_status=?, seller=?, related_person=?, line=?, note=?,
        suspicious_reason=CASE WHEN ?='classified' THEN NULL ELSE suspicious_reason END
       WHERE id=?`
    )
    .run(
      status,
      amount > 0 ? patch.saleType ?? prev.sale_type : null,
      amount < 0 ? patch.expenseType ?? prev.expense_type : null,
      patch.category ?? prev.category,
      patch.campaign ?? prev.campaign,
      patch.product ?? prev.product,
      patch.paymentStatus ?? prev.payment_status,
      patch.seller ?? prev.seller,
      patch.relatedPerson ?? prev.related_person,
      patch.line ?? prev.line,
      patch.note ?? prev.note,
      status,
      id
    );
  return mapTx(db().prepare('SELECT * FROM finance_os_transactions WHERE id = ?').get(id) as Record<string, unknown>);
}

export function importFinanceOsTransactions(input: {
  account: string;
  fileName?: string;
  method?: 'file' | 'api' | 'manual';
  rows: Array<{ date: string; amount: number; desc?: string; note?: string }>;
}): { imported: number; log: FinanceOsImportLog } {
  ensureFinanceOsSchema();
  const account = String(input.account || '').trim();
  if (!account) throw new Error('حساب الزامی است');
  const acc = db().prepare('SELECT code, line FROM finance_os_accounts WHERE code = ?').get(account) as
    | { code: string; line: string }
    | undefined;
  if (!acc) throw new Error('حساب یافت نشد');
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const ins = db().prepare(`
    INSERT INTO finance_os_transactions (account, date, amount, desc, status, note, line, raw_json)
    VALUES (?,?,?,?, 'queued', ?, ?, '{}')
  `);
  let imported = 0;
  const tx = db().transaction(() => {
    for (const r of rows) {
      const amount = Number(r.amount);
      if (!Number.isFinite(amount) || !r.date) continue;
      ins.run(account, String(r.date).slice(0, 10), Math.round(amount), String(r.desc || ''), String(r.note || ''), acc.line);
      imported += 1;
    }
    db()
      .prepare(
        `INSERT INTO finance_os_import_log (at, account, file_name, rows, method, status) VALUES (?,?,?,?,?,?)`
      )
      .run(
        nowIso(),
        account,
        input.fileName || 'manual-import',
        imported,
        input.method || 'manual',
        imported > 0 ? 'success' : 'failed'
      );
  });
  tx();
  const logRow = db().prepare('SELECT * FROM finance_os_import_log ORDER BY id DESC LIMIT 1').get() as Record<
    string,
    unknown
  >;
  return {
    imported,
    log: {
      id: Number(logRow.id),
      at: String(logRow.at),
      account: String(logRow.account),
      fileName: String(logRow.file_name || ''),
      rows: Number(logRow.rows) || 0,
      method: (String(logRow.method) as FinanceOsImportLog['method']),
      status: logRow.status === 'failed' ? 'failed' : 'success',
    },
  };
}

export function resolveFinanceOsSuspicious(
  id: number,
  action: 'keep' | 'merge' | 'discard'
): { ok: true } {
  ensureFinanceOsSchema();
  const row = db().prepare('SELECT * FROM finance_os_transactions WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new Error('تراکنش یافت نشد');
  if (action === 'discard') {
    db().prepare('DELETE FROM finance_os_transactions WHERE id = ?').run(id);
  } else if (action === 'merge') {
    db().prepare('DELETE FROM finance_os_transactions WHERE id = ?').run(id);
  } else {
    db()
      .prepare(
        `UPDATE finance_os_transactions SET status='queued', suspicious_reason=NULL, duplicate_of_id=NULL WHERE id=?`
      )
      .run(id);
  }
  return { ok: true };
}

export function getFinanceOsAllocationBundle(): FinanceOsAllocationBundle {
  ensureFinanceOsSchema();
  const expenses = (
    db().prepare('SELECT * FROM finance_os_sbg_expenses ORDER BY date DESC, id DESC').all() as Array<
      Record<string, unknown>
    >
  ).map(
    (r): FinanceOsSbgExpense => ({
      id: Number(r.id),
      date: String(r.date),
      amount: Number(r.amount) || 0,
      desc: String(r.desc || ''),
      category: String(r.category || ''),
      relatedPerson: String(r.related_person || ''),
      account: String(r.account || ''),
      allocated: Boolean(r.allocated),
      splits: parseJson(r.splits_json, []),
    })
  );
  return {
    offices: (
      db().prepare('SELECT * FROM finance_os_offices ORDER BY id').all() as Array<Record<string, unknown>>
    ).map(mapOffice),
    sbgPeople: (
      db().prepare('SELECT * FROM finance_os_sbg_people ORDER BY id').all() as Array<Record<string, unknown>>
    ).map(
      (r): FinanceOsSbgPerson => ({
        id: Number(r.id),
        name: String(r.name),
        role: String(r.role || ''),
        office: String(r.office || ''),
        allocationMethod: r.allocation_method === 'manual' ? 'manual' : 'auto',
        timeAllocations: parseJson(r.time_json, []),
      })
    ),
    equipment: (
      db().prepare('SELECT * FROM finance_os_equipment ORDER BY id').all() as Array<Record<string, unknown>>
    ).map(
      (r): FinanceOsEquipment => ({
        id: Number(r.id),
        code: String(r.code),
        category: String(r.category || ''),
        expenseCategory: String(r.expense_category || ''),
        name: String(r.name),
        brand: String(r.brand || ''),
        purchaseDate: String(r.purchase_date || ''),
        purchasePrice: Number(r.purchase_price) || 0,
        currentValue: Number(r.current_value) || 0,
        monthlyRate: Number(r.monthly_rate) || 0,
        ownership: String(r.ownership || 'SBG'),
        assignedBusiness: String(r.assigned_business || ''),
        assignedPerson: String(r.assigned_person || ''),
      })
    ),
    expenses,
    invoices: (
      db().prepare('SELECT * FROM finance_os_invoices ORDER BY id DESC').all() as Array<Record<string, unknown>>
    ).map(
      (r): FinanceOsInvoice => ({
        id: Number(r.id),
        number: String(r.number),
        business: String(r.business),
        jy: Number(r.jy),
        jm: Number(r.jm),
        total: Number(r.total) || 0,
        status: (String(r.status || 'draft') as FinanceOsInvoice['status']),
        lines: parseJson(r.lines_json, []),
        createdAt: String(r.created_at || ''),
      })
    ),
    commitments: (
      db().prepare('SELECT * FROM finance_os_commitments ORDER BY id').all() as Array<Record<string, unknown>>
    ).map(
      (r): FinanceOsCommitment => ({
        id: Number(r.id),
        desc: String(r.desc),
        category: String(r.category || ''),
        amount: Number(r.amount) || 0,
        dueDate: String(r.due_date || ''),
        status: r.status === 'done' ? 'done' : 'pending',
      })
    ),
    bankBalance: metaGet<number>('bankBalance', 0),
    businesses: listBusinesses(),
    pendingAllocationCount: expenses.filter((e) => !e.allocated).length,
  };
}

export function allocateFinanceOsExpense(
  id: number,
  splits: Array<{ business: string; amount: number; basis?: string }>
): FinanceOsSbgExpense {
  ensureFinanceOsSchema();
  const prev = db().prepare('SELECT * FROM finance_os_sbg_expenses WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!prev) throw new Error('هزینه یافت نشد');
  const clean = (splits || [])
    .map((s) => ({
      business: String(s.business || '').trim(),
      amount: Math.round(Number(s.amount) || 0),
      basis: String(s.basis || 'دستی'),
    }))
    .filter((s) => s.business && s.amount);
  db()
    .prepare('UPDATE finance_os_sbg_expenses SET allocated=1, splits_json=? WHERE id=?')
    .run(JSON.stringify(clean), id);
  const row = db().prepare('SELECT * FROM finance_os_sbg_expenses WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
  return {
    id: Number(row.id),
    date: String(row.date),
    amount: Number(row.amount) || 0,
    desc: String(row.desc || ''),
    category: String(row.category || ''),
    relatedPerson: String(row.related_person || ''),
    account: String(row.account || ''),
    allocated: true,
    splits: clean,
  };
}

export function issueFinanceOsInvoice(input: {
  business: string;
  jy: number;
  jm: number;
  lines: Array<{ desc: string; category: string; amount: number }>;
}): FinanceOsInvoice {
  ensureFinanceOsSchema();
  const business = String(input.business || '').trim();
  if (!business) throw new Error('بیزنس‌لاین الزامی است');
  const lines = (input.lines || []).map((l) => ({
    desc: String(l.desc || ''),
    category: String(l.category || ''),
    amount: Math.round(Number(l.amount) || 0),
  }));
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const seq =
    (db().prepare('SELECT COUNT(*) AS c FROM finance_os_invoices').get() as { c: number }).c + 1;
  const number = `INV-SBG-${input.jy}-${String(input.jm).padStart(2, '0')}-${String(seq).padStart(2, '0')}`;
  const createdAt = nowIso();
  const info = db()
    .prepare(
      `INSERT INTO finance_os_invoices (number, business, jy, jm, total, status, lines_json, created_at)
       VALUES (?,?,?,?,?,'issued',?,?)`
    )
    .run(number, business, input.jy, input.jm, total, JSON.stringify(lines), createdAt);
  return {
    id: Number(info.lastInsertRowid),
    number,
    business,
    jy: input.jy,
    jm: input.jm,
    total,
    status: 'issued',
    lines,
    createdAt,
  };
}

export function updateFinanceOsBankBalance(balance: number): { bankBalance: number } {
  ensureFinanceOsSchema();
  const n = Math.round(Number(balance) || 0);
  metaSet('bankBalance', n);
  return { bankBalance: n };
}

export function markFinanceOsCommitmentDone(id: number): FinanceOsCommitment {
  ensureFinanceOsSchema();
  const prev = db().prepare('SELECT * FROM finance_os_commitments WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!prev) throw new Error('تعهد یافت نشد');
  db().prepare(`UPDATE finance_os_commitments SET status='done' WHERE id=?`).run(id);
  const bal = metaGet<number>('bankBalance', 0);
  metaSet('bankBalance', bal - (Number(prev.amount) || 0));
  return {
    id: Number(prev.id),
    desc: String(prev.desc),
    category: String(prev.category || ''),
    amount: Number(prev.amount) || 0,
    dueDate: String(prev.due_date || ''),
    status: 'done',
  };
}

export function getFinanceOsNavCounts(): {
  queue: number;
  suspicious: number;
  pendingAllocation: number;
} {
  ensureFinanceOsSchema();
  const queue = (
    db().prepare(`SELECT COUNT(*) AS c FROM finance_os_transactions WHERE status='queued'`).get() as {
      c: number;
    }
  ).c;
  const suspicious = (
    db()
      .prepare(`SELECT COUNT(*) AS c FROM finance_os_transactions WHERE status='suspicious'`)
      .get() as { c: number }
  ).c;
  const pendingAllocation = (
    db().prepare(`SELECT COUNT(*) AS c FROM finance_os_sbg_expenses WHERE allocated=0`).get() as {
      c: number;
    }
  ).c;
  return { queue, suspicious, pendingAllocation };
}
