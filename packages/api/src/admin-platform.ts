/**
 * Admin platform persistence — shop catalog, announcements, settings, dashboard stats.
 * Kept separate from db.ts to limit merge conflicts with parallel agents.
 */
import type { User, UserRole, PaymentOrder } from '@petdate/shared';
import { makeOrderPublicId, orderPublicIdOf } from '@petdate/shared';
import { getDb, dbService } from './db';

function db() {
  return getDb();
}

export type ShopProductRow = {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  categorySlug: string;
  petTypes: string[];
  priceToman: number;
  compareAtToman?: number;
  /** بهای تمام‌شده / COGS به تومان — برای P&L */
  costToman?: number;
  image?: string;
  badge?: string;
  inStock: boolean;
  stockQty: number;
  params: Record<string, string>;
  description: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShopProductInput = {
  id?: string;
  slug: string;
  title: string;
  brandId: string;
  categorySlug: string;
  petTypes?: string[];
  priceToman?: number;
  compareAtToman?: number;
  costToman?: number | null;
  image?: string;
  badge?: string | null;
  inStock?: boolean;
  stockQty?: number;
  params?: Record<string, string>;
  description?: string;
  featured?: boolean;
};

export type ShopCategoryRow = {
  slug: string;
  labelFa: string;
  petType: string;
  description: string;
  emoji: string;
  sortOrder: number;
};

export type ShopCategoryInput = {
  slug: string;
  labelFa: string;
  petType: string;
  description?: string;
  emoji?: string;
  sortOrder?: number;
};

export type ShopOrderRow = {
  id: number;
  /** شناسهٔ عمومی پایدار — PD-O##### */
  publicId: string;
  userId?: number;
  status: string;
  totalToman: number;
  items: unknown[];
  customerName?: string;
  customerPhone?: string;
  note?: string;
  paymentCurrency?: string;
  paymentAmount?: number;
  cogsToman?: number;
  createdAt: string;
  updatedAt: string;
  /** join — عکس پروفایل کاربر */
  userAvatarUrl?: string;
  userName?: string;
};

export type AnnouncementRow = {
  id: number;
  title: string;
  body: string;
  active: boolean;
  placement: string;
  createdAt: string;
  updatedAt: string;
};

function mapShopProduct(row: Record<string, unknown>): ShopProductRow {
  let petTypes: string[] = [];
  let params: Record<string, string> = {};
  try {
    const p = JSON.parse(String(row.pet_types || '[]'));
    petTypes = Array.isArray(p) ? p.map(String) : [];
  } catch {
    petTypes = [];
  }
  try {
    const p = JSON.parse(String(row.params || '{}'));
    params =
      p && typeof p === 'object' && !Array.isArray(p)
        ? Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]))
        : {};
  } catch {
    params = {};
  }
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    brandId: String(row.brand_id),
    categorySlug: String(row.category_slug),
    petTypes,
    priceToman: Number(row.price_toman ?? 0),
    compareAtToman: row.compare_at_toman != null ? Number(row.compare_at_toman) : undefined,
    costToman: row.cost_toman != null ? Number(row.cost_toman) : undefined,
    image: (row.image as string) || undefined,
    badge: (row.badge as string) || undefined,
    inStock: row.in_stock == null ? true : Boolean(row.in_stock),
    stockQty: Number(row.stock_qty ?? 0),
    params,
    description: String(row.description ?? ''),
    featured: Boolean(row.featured),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapShopCategory(row: Record<string, unknown>): ShopCategoryRow {
  return {
    slug: String(row.slug),
    labelFa: String(row.label_fa),
    petType: String(row.pet_type),
    description: String(row.description ?? ''),
    emoji: String(row.emoji ?? '🛒'),
    sortOrder: Number(row.sort_order ?? 100),
  };
}

function mapShopOrder(row: Record<string, unknown>): ShopOrderRow {
  let items: unknown[] = [];
  try {
    const p = JSON.parse(String(row.items_json || '[]'));
    items = Array.isArray(p) ? p : [];
  } catch {
    items = [];
  }
  return {
    id: Number(row.id),
    publicId: orderPublicIdOf({
      id: Number(row.id),
      publicId: (row.public_id as string | undefined) || undefined,
    }),
    userId: row.user_id != null ? Number(row.user_id) : undefined,
    status: String(row.status),
    totalToman: Number(row.total_toman ?? 0),
    items,
    customerName: (row.customer_name as string) || undefined,
    customerPhone: (row.customer_phone as string) || undefined,
    note: (row.note as string) || undefined,
    paymentCurrency: (row.payment_currency as string) || 'toman',
    paymentAmount: row.payment_amount != null ? Number(row.payment_amount) : undefined,
    cogsToman: row.cogs_toman != null ? Number(row.cogs_toman) : undefined,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    userAvatarUrl: (row.user_avatar_url as string) || undefined,
    userName: (row.user_name as string) || undefined,
  };
}

function mapAnnouncement(row: Record<string, unknown>): AnnouncementRow {
  return {
    id: Number(row.id),
    title: String(row.title),
    body: String(row.body ?? ''),
    active: row.active == null ? true : Boolean(row.active),
    placement: String(row.placement ?? 'landing'),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export const adminPlatform = {
  getDashboardStats() {
    const d = db();
    const q = (sql: string) =>
      Number((d.prepare(sql).get() as { c: number } | undefined)?.c ?? 0);
    const wallet = d
      .prepare(
        `SELECT
           COALESCE(SUM(coins), 0) AS coins,
           COALESCE(SUM(wallet_toman), 0) AS toman,
           COALESCE(SUM(wallet_ton), 0) AS ton,
           COALESCE(SUM(wallet_stars), 0) AS stars
         FROM users`
      )
      .get() as { coins: number; toman: number; ton: number; stars: number };
    const logStats = dbService.getAppErrorLogStats();
    return {
      users: q('SELECT COUNT(*) as c FROM users'),
      pets: q('SELECT COUNT(*) as c FROM pets'),
      playdates: q('SELECT COUNT(*) as c FROM playdate_requests'),
      playdatesPending: q(
        `SELECT COUNT(*) as c FROM playdate_requests WHERE status = 'pending'`
      ),
      vetConsults: q('SELECT COUNT(*) as c FROM vet_consultations'),
      vetConsultsOpen: q(
        `SELECT COUNT(*) as c FROM vet_consultations WHERE status IN ('requested','active')`
      ),
      shopOrders: q('SELECT COUNT(*) as c FROM shop_orders'),
      shopRevenueToman: q(
        `SELECT COALESCE(SUM(total_toman), 0) as c FROM shop_orders WHERE status IN ('paid','shipped','completed')`
      ),
      walletTotals: {
        coins: Number(wallet.coins ?? 0),
        toman: Number(wallet.toman ?? 0),
        ton: Number(wallet.ton ?? 0),
        stars: Number(wallet.stars ?? 0),
      },
      paymentOrdersPending: q(
        `SELECT COUNT(*) as c FROM payment_orders WHERE status IN ('pending','awaiting_receipt')`
      ),
      botRelated: {
        chatMessages: q('SELECT COUNT(*) as c FROM playdate_chat_messages'),
        openGames: q(`SELECT COUNT(*) as c FROM games WHERE status = 'open'`),
        errors24h: logStats.errors24h,
      },
    };
  },

  listUsersAdmin(filters?: {
    q?: string;
    role?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  }): { total: number; users: User[] } {
    const d = db();
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (filters?.q) {
      const like = `%${filters.q.trim()}%`;
      const qTrim = filters.q.trim();
      where += ` AND (
        name LIKE ? OR IFNULL(username,'') LIKE ? OR IFNULL(phone,'') LIKE ?
        OR IFNULL(telegram_id,'') LIKE ? OR CAST(id AS TEXT) = ?
        OR IFNULL(public_id,'') LIKE ? OR upper(IFNULL(public_id,'')) = upper(?)
      )`;
      params.push(like, like, like, like, qTrim, like, qTrim);
    }
    if (filters?.role) {
      where += ` AND (role = ? OR roles LIKE ?)`;
      params.push(filters.role, `%"${filters.role}"%`);
    }
    if (filters?.active === true) where += ' AND is_active = 1';
    else if (filters?.active === false) where += ' AND is_active = 0';
    const total = Number(
      (d.prepare(`SELECT COUNT(*) as c FROM users ${where}`).get(...params) as { c: number }).c
    );
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const offset = Math.max(filters?.offset ?? 0, 0);
    const rows = d
      .prepare(`SELECT id FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as { id: number }[];
    const users = rows
      .map((r) => dbService.getUserById(r.id))
      .filter((u): u is User => Boolean(u));
    return { total, users };
  },

  setUserActive(userId: number, isActive: boolean): User | null {
    const existing = dbService.getUserById(userId);
    if (!existing) return null;
    db().prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, userId);
    return dbService.getUserById(userId);
  },

  listPaymentOrdersAdmin(filters?: { status?: string; limit?: number }): PaymentOrder[] {
    const d = db();
    let sql = `SELECT id FROM payment_orders WHERE 1=1`;
    const params: unknown[] = [];
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Math.min(Math.max(filters?.limit ?? 100, 1), 300));
    const ids = d.prepare(sql).all(...params) as { id: number }[];
    return ids
      .map((r) => dbService.getPaymentOrder(r.id))
      .filter((o): o is PaymentOrder => Boolean(o));
  },

  listShopProducts(filters?: {
    q?: string;
    categorySlug?: string;
    inStock?: boolean;
  }): ShopProductRow[] {
    const d = db();
    let sql = 'SELECT * FROM shop_products WHERE 1=1';
    const params: unknown[] = [];
    if (filters?.q) {
      sql += ' AND (title LIKE ? OR slug LIKE ? OR id LIKE ?)';
      const like = `%${filters.q}%`;
      params.push(like, like, like);
    }
    if (filters?.categorySlug) {
      sql += ' AND category_slug = ?';
      params.push(filters.categorySlug);
    }
    if (filters?.inStock === true) sql += ' AND in_stock = 1';
    if (filters?.inStock === false) sql += ' AND in_stock = 0';
    sql += ' ORDER BY featured DESC, updated_at DESC';
    return (d.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapShopProduct);
  },

  getShopProduct(idOrSlug: string): ShopProductRow | null {
    const row = db()
      .prepare('SELECT * FROM shop_products WHERE id = ? OR slug = ?')
      .get(idOrSlug, idOrSlug) as Record<string, unknown> | undefined;
    return row ? mapShopProduct(row) : null;
  },

  upsertShopProduct(input: ShopProductInput): ShopProductRow {
    const id = (input.id || input.slug || `p-${Date.now()}`).trim();
    const slug = (input.slug || id).trim();
    db()
      .prepare(
        `INSERT INTO shop_products (
        id, slug, title, brand_id, category_slug, pet_types, price_toman, compare_at_toman,
        cost_toman, image, badge, in_stock, stock_qty, params, description, featured, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        brand_id = excluded.brand_id,
        category_slug = excluded.category_slug,
        pet_types = excluded.pet_types,
        price_toman = excluded.price_toman,
        compare_at_toman = excluded.compare_at_toman,
        cost_toman = excluded.cost_toman,
        image = excluded.image,
        badge = excluded.badge,
        in_stock = excluded.in_stock,
        stock_qty = excluded.stock_qty,
        params = excluded.params,
        description = excluded.description,
        featured = excluded.featured,
        updated_at = datetime('now')`
      )
      .run(
        id,
        slug,
        input.title,
        input.brandId,
        input.categorySlug,
        JSON.stringify(input.petTypes ?? []),
        input.priceToman ?? 0,
        input.compareAtToman ?? null,
        input.costToman ?? null,
        input.image ?? null,
        input.badge ?? null,
        input.inStock === false ? 0 : 1,
        input.stockQty ?? 0,
        JSON.stringify(input.params ?? {}),
        input.description ?? '',
        input.featured ? 1 : 0
      );
    return this.getShopProduct(id)!;
  },

  deleteShopProduct(id: string): boolean {
    return db().prepare('DELETE FROM shop_products WHERE id = ?').run(id).changes > 0;
  },

  replaceShopCatalog(input: {
    products: ShopProductInput[];
    categories?: ShopCategoryInput[];
  }): { products: number; categories: number } {
    const d = db();
    const tx = d.transaction(() => {
      if (input.categories?.length) {
        d.prepare('DELETE FROM shop_categories').run();
        const ins = d.prepare(
          `INSERT INTO shop_categories (slug, label_fa, pet_type, description, emoji, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        input.categories.forEach((c, i) => {
          ins.run(
            c.slug,
            c.labelFa,
            c.petType,
            c.description ?? '',
            c.emoji ?? '🛒',
            c.sortOrder ?? i * 10
          );
        });
      }
      d.prepare('DELETE FROM shop_products').run();
      for (const p of input.products) {
        this.upsertShopProduct(p);
      }
    });
    tx();
    return {
      products: this.listShopProducts().length,
      categories: this.listShopCategories().length,
    };
  },

  listShopCategories(): ShopCategoryRow[] {
    return (
      db()
        .prepare('SELECT * FROM shop_categories ORDER BY sort_order ASC, slug ASC')
        .all() as Record<string, unknown>[]
    ).map(mapShopCategory);
  },

  upsertShopCategory(input: ShopCategoryInput): ShopCategoryRow {
    db()
      .prepare(
        `INSERT INTO shop_categories (slug, label_fa, pet_type, description, emoji, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         label_fa = excluded.label_fa,
         pet_type = excluded.pet_type,
         description = excluded.description,
         emoji = excluded.emoji,
         sort_order = excluded.sort_order`
      )
      .run(
        input.slug,
        input.labelFa,
        input.petType,
        input.description ?? '',
        input.emoji ?? '🛒',
        input.sortOrder ?? 100
      );
    return this.listShopCategories().find((c) => c.slug === input.slug)!;
  },

  deleteShopCategory(slug: string): boolean {
    return db().prepare('DELETE FROM shop_categories WHERE slug = ?').run(slug).changes > 0;
  },

  listShopOrders(filters?: { status?: string; q?: string; limit?: number }): ShopOrderRow[] {
    const d = db();
    let sql = `SELECT so.*,
                      u.avatar_url AS user_avatar_url,
                      u.name AS user_name
               FROM shop_orders so
               LEFT JOIN users u ON u.id = so.user_id
               WHERE 1=1`;
    const params: unknown[] = [];
    if (filters?.status) {
      sql += ' AND so.status = ?';
      params.push(filters.status);
    }
    if (filters?.q) {
      const qTrim = filters.q.trim();
      if (qTrim) {
        const like = `%${qTrim}%`;
        sql += ` AND (
          CAST(so.id AS TEXT) = ?
          OR IFNULL(so.public_id,'') LIKE ?
          OR upper(IFNULL(so.public_id,'')) = upper(?)
          OR IFNULL(so.customer_name,'') LIKE ?
          OR IFNULL(so.customer_phone,'') LIKE ?
          OR IFNULL(u.name,'') LIKE ?
          OR IFNULL(u.public_id,'') LIKE ?
          OR upper(IFNULL(u.public_id,'')) = upper(?)
        )`;
        params.push(qTrim, like, qTrim, like, like, like, like, qTrim);
      }
    }
    sql += ' ORDER BY so.created_at DESC LIMIT ?';
    params.push(Math.min(Math.max(filters?.limit ?? 100, 1), 300));
    return (d.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapShopOrder);
  },

  listShopOrdersForUser(userId: number, filters?: { limit?: number }): ShopOrderRow[] {
    const d = db();
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 100);
    return (
      d
        .prepare(
          `SELECT * FROM shop_orders
           WHERE user_id = ?
           ORDER BY created_at DESC, id DESC
           LIMIT ?`
        )
        .all(userId, limit) as Record<string, unknown>[]
    ).map(mapShopOrder);
  },

  getShopOrder(id: number): ShopOrderRow | null {
    const row = db()
      .prepare(
        `SELECT so.*,
                u.avatar_url AS user_avatar_url,
                u.name AS user_name
         FROM shop_orders so
         LEFT JOIN users u ON u.id = so.user_id
         WHERE so.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapShopOrder(row) : null;
  },

  createShopOrder(input: {
    userId?: number;
    status?: string;
    totalToman: number;
    items: unknown[];
    customerName?: string;
    customerPhone?: string;
    note?: string;
    paymentCurrency?: string;
    paymentAmount?: number;
    cogsToman?: number;
  }): ShopOrderRow {
    const r = db()
      .prepare(
        `INSERT INTO shop_orders (
          user_id, status, total_toman, items_json, customer_name, customer_phone, note,
          payment_currency, payment_amount, cogs_toman
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId ?? null,
        input.status ?? 'pending',
        input.totalToman,
        JSON.stringify(input.items ?? []),
        input.customerName ?? null,
        input.customerPhone ?? null,
        input.note ?? null,
        input.paymentCurrency ?? 'toman',
        input.paymentAmount ?? input.totalToman,
        input.cogsToman ?? null
      );
    const newId = Number(r.lastInsertRowid);
    try {
      db().prepare('UPDATE shop_orders SET public_id = ? WHERE id = ?').run(makeOrderPublicId(newId), newId);
    } catch (err) {
      console.warn('shop_orders public_id assign skipped/failed:', (err as Error).message);
    }
    return this.getShopOrder(newId)!;
  },

  updateShopOrderStatus(id: number, status: string): ShopOrderRow | null {
    db()
      .prepare(`UPDATE shop_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(status, id);
    return this.getShopOrder(id);
  },

  listAnnouncements(): AnnouncementRow[] {
    return (
      db()
        .prepare('SELECT * FROM admin_announcements ORDER BY created_at DESC')
        .all() as Record<string, unknown>[]
    ).map(mapAnnouncement);
  },

  upsertAnnouncement(input: {
    id?: number;
    title: string;
    body?: string;
    active?: boolean;
    placement?: string;
  }): AnnouncementRow {
    const d = db();
    if (input.id) {
      d.prepare(
        `UPDATE admin_announcements
         SET title = ?, body = ?, active = ?, placement = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        input.title,
        input.body ?? '',
        input.active === false ? 0 : 1,
        input.placement ?? 'landing',
        input.id
      );
      return this.listAnnouncements().find((a) => a.id === input.id)!;
    }
    const r = d
      .prepare(
        `INSERT INTO admin_announcements (title, body, active, placement)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.body ?? '',
        input.active === false ? 0 : 1,
        input.placement ?? 'landing'
      );
    return this.listAnnouncements().find((a) => a.id === Number(r.lastInsertRowid))!;
  },

  deleteAnnouncement(id: number): boolean {
    return db().prepare('DELETE FROM admin_announcements WHERE id = ?').run(id).changes > 0;
  },

  getSettings(): Record<string, string> {
    const rows = db().prepare('SELECT key, value FROM admin_settings').all() as {
      key: string;
      value: string;
    }[];
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },

  setSettings(patch: Record<string, string>): Record<string, string> {
    const upsert = db().prepare(
      `INSERT INTO admin_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    );
    const tx = db().transaction(() => {
      for (const [k, v] of Object.entries(patch)) {
        upsert.run(k, String(v ?? ''));
      }
    });
    tx();
    return this.getSettings();
  },
};

// silence unused import if tree-shaken oddly
void (null as unknown as UserRole);
