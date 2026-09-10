/**
 * Admin finance analytics — P&L, sales charts, wallet ledger, top products.
 */
import { orderPublicIdOf } from '@petdate/shared';
import { getDb } from './db';
import { adminPlatform } from './admin-platform';

export type FinancePeriod = 'day' | 'week' | 'month' | 'year';

const PAID_STATUSES = `('paid','shipped','completed')`;

function db() {
  return getDb();
}

function settingNum(key: string, fallback: number): number {
  const settings = adminPlatform.getSettings();
  const n = Number(settings[key]);
  return Number.isFinite(n) ? n : fallback;
}

function periodStart(period: FinancePeriod, now = new Date()): string {
  const d = new Date(now);
  if (period === 'day') {
    d.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function previousPeriodBounds(period: FinancePeriod, now = new Date()): { start: string; end: string } {
  const end = new Date(periodStart(period, now).replace(' ', 'T') + 'Z');
  const start = new Date(end);
  if (period === 'day') start.setDate(start.getDate() - 1);
  else if (period === 'week') start.setDate(start.getDate() - 7);
  else if (period === 'month') start.setMonth(start.getMonth() - 1);
  else start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().replace('T', ' ').slice(0, 19),
    end: end.toISOString().replace('T', ' ').slice(0, 19),
  };
}

function parsePeriod(raw: unknown): FinancePeriod {
  return raw === 'day' || raw === 'week' || raw === 'year' ? raw : 'month';
}

type OrderItem = {
  productId?: string;
  title?: string;
  categorySlug?: string;
  qty?: number;
  priceToman?: number;
  costToman?: number;
};

function parseItems(json: string): OrderItem[] {
  try {
    const p = JSON.parse(json || '[]');
    return Array.isArray(p) ? (p as OrderItem[]) : [];
  } catch {
    return [];
  }
}

function orderCogs(
  row: { cogs_toman: number | null; total_toman: number; items_json: string },
  marginPercent: number,
  productCostMap: Map<string, number>
): number {
  if (row.cogs_toman != null && Number.isFinite(Number(row.cogs_toman))) {
    return Number(row.cogs_toman);
  }
  const items = parseItems(row.items_json);
  let fromItems = 0;
  let used = false;
  for (const it of items) {
    const qty = Math.max(1, Number(it.qty ?? 1));
    if (it.costToman != null && Number.isFinite(Number(it.costToman))) {
      fromItems += Number(it.costToman) * qty;
      used = true;
    } else if (it.productId && productCostMap.has(it.productId)) {
      fromItems += (productCostMap.get(it.productId) || 0) * qty;
      used = true;
    }
  }
  if (used) return fromItems;
  const margin = Math.min(95, Math.max(0, marginPercent)) / 100;
  return Math.round(Number(row.total_toman || 0) * (1 - margin));
}

function productCostMap(): Map<string, number> {
  const rows = db()
    .prepare(
      `SELECT id, COALESCE(cost_toman, CAST(price_toman * 0.65 AS INTEGER)) AS cost_toman
       FROM shop_products`
    )
    .all() as Array<{ id: string; cost_toman: number }>;
  return new Map(rows.map((r) => [r.id, Number(r.cost_toman || 0)]));
}

function sumPaidOrders(since: string, until?: string): {
  revenue: number;
  orders: number;
  cogs: number;
  rows: Array<{
    id: number;
    status: string;
    total_toman: number;
    cogs_toman: number | null;
    items_json: string;
    payment_currency: string;
    created_at: string;
  }>;
} {
  const margin = settingNum('financeMarginPercent', 35);
  const costs = productCostMap();
  let sql = `SELECT id, status, total_toman, cogs_toman, items_json,
                     COALESCE(payment_currency, 'toman') AS payment_currency, created_at
              FROM shop_orders
              WHERE status IN ${PAID_STATUSES} AND created_at >= ?`;
  const params: unknown[] = [since];
  if (until) {
    sql += ' AND created_at < ?';
    params.push(until);
  }
  sql += ' ORDER BY created_at ASC';
  const rows = db().prepare(sql).all(...params) as Array<{
    id: number;
    status: string;
    total_toman: number;
    cogs_toman: number | null;
    items_json: string;
    payment_currency: string;
    created_at: string;
  }>;
  let revenue = 0;
  let cogs = 0;
  for (const r of rows) {
    revenue += Number(r.total_toman || 0);
    cogs += orderCogs(r, margin, costs);
  }
  return { revenue, orders: rows.length, cogs, rows };
}

function paymentTopupRevenue(since: string, until?: string): number {
  let sql = `SELECT COALESCE(SUM(amount_toman), 0) AS c
             FROM payment_orders
             WHERE status = 'approved' AND amount_toman IS NOT NULL AND created_at >= ?`;
  const params: unknown[] = [since];
  if (until) {
    sql += ' AND created_at < ?';
    params.push(until);
  }
  return Number((db().prepare(sql).get(...params) as { c: number }).c || 0);
}

function serviceFees(since: string, until?: string): {
  vetRevenue: number;
  vetCount: number;
  playdateRevenue: number;
  playdateCount: number;
} {
  const vetFee = settingNum('vetConsultFeeToman', 250000);
  const playFee = settingNum('playdateFeeToman', 0);
  let vetSql = `SELECT COUNT(*) as c FROM vet_consultations
                WHERE status IN ('completed','closed','done','active') AND created_at >= ?`;
  let playSql = `SELECT COUNT(*) as c FROM playdate_requests
                 WHERE status = 'accepted' AND created_at >= ?`;
  const params: unknown[] = [since];
  if (until) {
    vetSql += ' AND created_at < ?';
    playSql += ' AND created_at < ?';
    params.push(until);
  }
  const vetCount = Number((db().prepare(vetSql).get(...params) as { c: number }).c || 0);
  const playdateCount = Number((db().prepare(playSql).get(...params) as { c: number }).c || 0);
  return {
    vetCount,
    playdateCount,
    vetRevenue: vetCount * vetFee,
    playdateRevenue: playdateCount * playFee,
  };
}

function opExForPeriod(period: FinancePeriod): number {
  const monthly = settingNum('financeOpExMonthlyToman', 5000000);
  if (period === 'day') return Math.round(monthly / 30);
  if (period === 'week') return Math.round(monthly / 4);
  if (period === 'year') return monthly * 12;
  return monthly;
}

function growthRate(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function bucketKey(iso: string, period: FinancePeriod): string {
  const d = iso.slice(0, 10);
  if (period === 'year') return iso.slice(0, 7);
  return d;
}

export const adminFinance = {
  parsePeriod,

  getDashboard(periodRaw?: unknown) {
    const period = parsePeriod(periodRaw);
    const since = periodStart(period);
    const prev = previousPeriodBounds(period);
    const current = sumPaidOrders(since);
    const previous = sumPaidOrders(prev.start, prev.end);
    const topups = paymentTopupRevenue(since);
    const prevTopups = paymentTopupRevenue(prev.start, prev.end);
    const fees = serviceFees(since);
    const prevFees = serviceFees(prev.start, prev.end);
    const opEx = opExForPeriod(period);

    const revenue = current.revenue + topups + fees.vetRevenue + fees.playdateRevenue;
    const prevRevenue =
      previous.revenue + prevTopups + prevFees.vetRevenue + prevFees.playdateRevenue;
    const expense = current.cogs + opEx;
    const netProfit = revenue - expense;
    const aov = current.orders ? Math.round(current.revenue / current.orders) : 0;
    const marginPct = revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;

    // Embed primary chart series so the Finance OS dashboard is not just nav tiles.
    const sales = this.getSalesCharts(period);

    return {
      period,
      since,
      generatedAt: new Date().toISOString(),
      kpis: {
        revenue,
        expense,
        netProfit,
        orders: current.orders,
        aov,
        growthRate: growthRate(revenue, prevRevenue),
        marginPct,
      },
      breakdown: {
        shopRevenue: current.revenue,
        paymentTopups: topups,
        vetFees: fees.vetRevenue,
        playdateFees: fees.playdateRevenue,
        cogs: current.cogs,
        operatingExpense: opEx,
        vetConsults: fees.vetCount,
        playdatesAccepted: fees.playdateCount,
      },
      charts: {
        salesTrend: sales.dailyOrMonthly,
        categories: sales.categories.slice(0, 8).map((c) => ({
          label: c.label,
          value: c.value,
        })),
        paymentMix: sales.paymentMix.map((p) => ({
          label: p.label,
          value: p.value,
          currency: p.currency,
        })),
        pnlCompare: [
          { label: 'درآمد', value: revenue },
          { label: 'هزینه', value: expense },
          { label: 'سود', value: Math.max(0, netProfit) },
        ],
        revenueMix: [
          { label: 'فروشگاه', value: current.revenue },
          { label: 'شارژ کیف پول', value: topups },
          { label: 'دامپزشک', value: fees.vetRevenue },
          { label: 'همبازی', value: fees.playdateRevenue },
        ].filter((s) => s.value > 0),
      },
      previous: { revenue: prevRevenue, orders: previous.orders },
      settings: {
        financeMarginPercent: settingNum('financeMarginPercent', 35),
        vetConsultFeeToman: settingNum('vetConsultFeeToman', 250000),
        playdateFeeToman: settingNum('playdateFeeToman', 0),
        financeOpExMonthlyToman: settingNum('financeOpExMonthlyToman', 5000000),
      },
    };
  },

  getPnL(periodRaw?: unknown) {
    const dash = this.getDashboard(periodRaw);
    const { revenue, expense, netProfit, marginPct } = dash.kpis;
    const lines = [
      { key: 'shop', label: 'درآمد فروشگاه (پت دیت شاپ)', type: 'income' as const, amount: dash.breakdown.shopRevenue },
      { key: 'topups', label: 'شارژ کیف پول (تومان تاییدشده)', type: 'income' as const, amount: dash.breakdown.paymentTopups },
      { key: 'vet', label: 'کارمزد/درآمد مشاوره دامپزشک', type: 'income' as const, amount: dash.breakdown.vetFees },
      { key: 'playdate', label: 'کارمزد همبازی', type: 'income' as const, amount: dash.breakdown.playdateFees },
      { key: 'cogs', label: 'بهای تمام‌شده کالا (COGS)', type: 'expense' as const, amount: dash.breakdown.cogs },
      { key: 'opex', label: 'هزینه‌های عملیاتی', type: 'expense' as const, amount: dash.breakdown.operatingExpense },
    ];
    return {
      period: dash.period,
      since: dash.since,
      generatedAt: dash.generatedAt,
      revenue,
      expense,
      netProfit,
      marginPct,
      grossProfit: dash.breakdown.shopRevenue - dash.breakdown.cogs,
      grossMarginPct:
        dash.breakdown.shopRevenue > 0
          ? Math.round(
              ((dash.breakdown.shopRevenue - dash.breakdown.cogs) / dash.breakdown.shopRevenue) *
                1000
            ) / 10
          : 0,
      lines,
      settings: dash.settings,
    };
  },

  getSalesCharts(periodRaw?: unknown) {
    const period = parsePeriod(periodRaw);
    const since = periodStart(period);
    const { rows, revenue } = sumPaidOrders(since);
    const costs = productCostMap();
    const margin = settingNum('financeMarginPercent', 35);

    const byBucket = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byPay = new Map<string, number>();

    for (const r of rows) {
      const key = bucketKey(r.created_at, period);
      byBucket.set(key, (byBucket.get(key) || 0) + Number(r.total_toman || 0));
      const cur = r.payment_currency || 'toman';
      byPay.set(cur, (byPay.get(cur) || 0) + Number(r.total_toman || 0));
      for (const it of parseItems(r.items_json)) {
        const cat = it.categorySlug || 'other';
        const qty = Math.max(1, Number(it.qty ?? 1));
        const line =
          it.priceToman != null
            ? Number(it.priceToman) * qty
            : Math.round(Number(r.total_toman || 0) / Math.max(1, parseItems(r.items_json).length));
        byCategory.set(cat, (byCategory.get(cat) || 0) + line);
      }
    }

    // fill empty days for smoother charts
    const series: Array<{ label: string; value: number }> = [];
    if (period === 'year') {
      const start = new Date(since.replace(' ', 'T') + 'Z');
      for (let m = 0; m < 12; m++) {
        const d = new Date(start.getFullYear(), m, 1);
        if (d > new Date()) break;
        const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        series.push({ label, value: byBucket.get(label) || 0 });
      }
    } else {
      const start = new Date(since.replace(' ', 'T') + 'Z');
      const days = period === 'day' ? 1 : period === 'week' ? 7 : 31;
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        if (d > new Date()) break;
        const label = d.toISOString().slice(0, 10);
        series.push({ label, value: byBucket.get(label) || 0 });
      }
    }

    const catLabels = new Map(
      (
        db().prepare('SELECT slug, label_fa FROM shop_categories').all() as Array<{
          slug: string;
          label_fa: string;
        }>
      ).map((c) => [c.slug, c.label_fa])
    );

    const currencyLabels: Record<string, string> = {
      toman: 'تومان',
      coins: 'سکه',
      stars: 'Stars',
      ton: 'TON',
    };

    return {
      period,
      since,
      totalRevenue: revenue,
      dailyOrMonthly: series,
      categories: [...byCategory.entries()]
        .map(([slug, value]) => ({
          slug,
          label: catLabels.get(slug) || slug,
          value,
        }))
        .sort((a, b) => b.value - a.value),
      paymentMix: [...byPay.entries()]
        .map(([currency, value]) => ({
          currency,
          label: currencyLabels[currency] || currency,
          value,
        }))
        .sort((a, b) => b.value - a.value),
      sampleCogsBasis: {
        marginPercent: margin,
        productsWithExplicitCost: [...costs.values()].filter((v) => v > 0).length,
      },
    };
  },

  getOrdersRevenue(status?: string) {
    let sql = `SELECT * FROM shop_orders WHERE 1=1`;
    const params: unknown[] = [];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const rows = db().prepare(sql).all(...params) as Array<Record<string, unknown>>;
    const statusTotals = db()
      .prepare(
        `SELECT status, COUNT(*) as count, COALESCE(SUM(total_toman), 0) as revenue
         FROM shop_orders GROUP BY status ORDER BY revenue DESC`
      )
      .all() as Array<{ status: string; count: number; revenue: number }>;

    const orders = rows.map((row) => {
      const id = Number(row.id);
      return {
        id,
        publicId: orderPublicIdOf({
          id,
          publicId: (row.public_id as string | undefined) || undefined,
        }),
        userId: row.user_id != null ? Number(row.user_id) : undefined,
        status: String(row.status),
        totalToman: Number(row.total_toman ?? 0),
        paymentCurrency: String(row.payment_currency ?? 'toman'),
        cogsToman: row.cogs_toman != null ? Number(row.cogs_toman) : null,
        customerName: (row.customer_name as string) || undefined,
        items: parseItems(String(row.items_json || '[]')),
        createdAt: String(row.created_at ?? ''),
      };
    });

    return {
      orders,
      statusTotals: statusTotals.map((s) => ({
        status: s.status,
        count: Number(s.count),
        revenue: Number(s.revenue),
      })),
      paidRevenue: statusTotals
        .filter((s) => ['paid', 'shipped', 'completed'].includes(s.status))
        .reduce((a, s) => a + Number(s.revenue), 0),
    };
  },

  getWalletOverview() {
    const balances = db()
      .prepare(
        `SELECT
           COALESCE(SUM(coins), 0) AS coins,
           COALESCE(SUM(wallet_toman), 0) AS toman,
           COALESCE(SUM(wallet_ton), 0) AS ton,
           COALESCE(SUM(wallet_stars), 0) AS stars
         FROM users`
      )
      .get() as { coins: number; toman: number; ton: number; stars: number };

    const ledgerAgg = db()
      .prepare(
        `SELECT currency, direction,
                COALESCE(SUM(amount), 0) AS total,
                COUNT(*) AS count
         FROM wallet_ledger
         GROUP BY currency, direction`
      )
      .all() as Array<{ currency: string; direction: string; total: number; count: number }>;

    const coinLedger = db()
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS credits,
           COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS debits,
           COUNT(*) AS entries
         FROM coin_ledger`
      )
      .get() as { credits: number; debits: number; entries: number };

    const recent = db()
      .prepare(
        `SELECT id, user_id, currency, amount, direction, reason, ref_type, created_at
         FROM wallet_ledger ORDER BY created_at DESC LIMIT 80`
      )
      .all() as Array<Record<string, unknown>>;

    const byCurrency: Record<
      string,
      { credits: number; debits: number; creditCount: number; debitCount: number }
    > = {};
    for (const row of ledgerAgg) {
      const cur = row.currency;
      if (!byCurrency[cur]) {
        byCurrency[cur] = { credits: 0, debits: 0, creditCount: 0, debitCount: 0 };
      }
      if (row.direction === 'credit') {
        byCurrency[cur].credits += Number(row.total);
        byCurrency[cur].creditCount += Number(row.count);
      } else {
        byCurrency[cur].debits += Number(row.total);
        byCurrency[cur].debitCount += Number(row.count);
      }
    }
    if (!byCurrency.coins) {
      byCurrency.coins = {
        credits: Number(coinLedger.credits),
        debits: Number(coinLedger.debits),
        creditCount: Number(coinLedger.entries),
        debitCount: 0,
      };
    } else {
      byCurrency.coins.credits += Number(coinLedger.credits);
      byCurrency.coins.debits += Number(coinLedger.debits);
    }

    return {
      balances: {
        coins: Number(balances.coins),
        toman: Number(balances.toman),
        ton: Number(balances.ton),
        stars: Number(balances.stars),
      },
      byCurrency,
      recent: recent.map((r) => ({
        id: Number(r.id),
        userId: r.user_id != null ? Number(r.user_id) : null,
        currency: String(r.currency),
        amount: Number(r.amount),
        direction: String(r.direction),
        reason: String(r.reason ?? ''),
        refType: (r.ref_type as string) || null,
        createdAt: String(r.created_at ?? ''),
      })),
      coinLedgerEntries: Number(coinLedger.entries),
    };
  },

  getTopProducts(periodRaw?: unknown, limit = 15) {
    const period = parsePeriod(periodRaw);
    const since = periodStart(period);
    const { rows } = sumPaidOrders(since);
    const byProduct = new Map<
      string,
      { productId: string; title: string; categorySlug: string; qty: number; revenue: number }
    >();
    const byCategory = new Map<string, { slug: string; revenue: number; qty: number }>();

    for (const r of rows) {
      const items = parseItems(r.items_json);
      if (!items.length) {
        const key = `order-${r.id}`;
        byProduct.set(key, {
          productId: key,
          title: `سفارش #${r.id}`,
          categorySlug: 'other',
          qty: 1,
          revenue: Number(r.total_toman || 0),
        });
        continue;
      }
      for (const it of items) {
        const id = it.productId || it.title || `unknown-${r.id}`;
        const qty = Math.max(1, Number(it.qty ?? 1));
        const revenue =
          it.priceToman != null
            ? Number(it.priceToman) * qty
            : Math.round(Number(r.total_toman || 0) / items.length);
        const prev = byProduct.get(id) || {
          productId: id,
          title: it.title || id,
          categorySlug: it.categorySlug || 'other',
          qty: 0,
          revenue: 0,
        };
        prev.qty += qty;
        prev.revenue += revenue;
        byProduct.set(id, prev);

        const cat = it.categorySlug || 'other';
        const cprev = byCategory.get(cat) || { slug: cat, revenue: 0, qty: 0 };
        cprev.qty += qty;
        cprev.revenue += revenue;
        byCategory.set(cat, cprev);
      }
    }

    const catLabels = new Map(
      (
        db().prepare('SELECT slug, label_fa FROM shop_categories').all() as Array<{
          slug: string;
          label_fa: string;
        }>
      ).map((c) => [c.slug, c.label_fa])
    );

    return {
      period,
      since,
      products: [...byProduct.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, Math.min(Math.max(limit, 1), 50)),
      categories: [...byCategory.values()]
        .map((c) => ({ ...c, label: catLabels.get(c.slug) || c.slug }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  },

  exportCsv(kind: 'pnl' | 'sales', periodRaw?: unknown): { filename: string; csv: string } {
    const period = parsePeriod(periodRaw);
    if (kind === 'pnl') {
      const pnl = this.getPnL(period);
      const lines = [
        'نوع,عنوان,مبلغ_تومان',
        ...pnl.lines.map((l) => `${l.type},${l.label.replace(/,/g, ' ')},${l.amount}`),
        `summary,درآمد کل,${pnl.revenue}`,
        `summary,هزینه کل,${pnl.expense}`,
        `summary,سود خالص,${pnl.netProfit}`,
        `summary,حاشیه سود درصد,${pnl.marginPct}`,
      ];
      return { filename: `petdate-pnl-${period}.csv`, csv: lines.join('\n') };
    }
    const sales = this.getSalesCharts(period);
    const lines = [
      'تاریخ,فروش_تومان',
      ...sales.dailyOrMonthly.map((p) => `${p.label},${p.value}`),
      '',
      'دسته,فروش_تومان',
      ...sales.categories.map((c) => `${c.label.replace(/,/g, ' ')},${c.value}`),
      '',
      'روش_پرداخت,مبلغ',
      ...sales.paymentMix.map((p) => `${p.label},${p.value}`),
    ];
    return { filename: `petdate-sales-${period}.csv`, csv: lines.join('\n') };
  },
};
