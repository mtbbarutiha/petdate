#!/usr/bin/env python3
"""Generate Batch-multi wave 5/5 catalog (p290–p299 only) from the wave MANIFEST."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "scripts/shop-batch-multi-wave5.json").read_text())
PRODUCTS = MANIFEST["products"]
CACHE_BUST = MANIFEST["cacheBust"]

DESCRIPTIONS: dict[str, str] = {
    "grooming-bonnest-calming-shampoo-for-pet-200-l": """شامپو آرامش‌بخش بونست برای حمام روزمره سگ و گربه وقتی پوست حساس است یا حیوان از شست‌وشو می‌ترسد.

شامپو غذا نیست و جای درمان دامپزشکی را نمی‌گیرد. وارد چشم نکن. بعد شست‌وشو خوب آبکشی کن.

اگر زخم باز یا عفونت پوست دارد اول کلینیک.

• شامپو آرامش‌بخش بونست
• مناسب سگ و گربه
• برای حمام خانگی
• دور از چشم
• جایگزین درمان پوست نیست

— پت دیت شاپ.""",
    "grooming-spray-massage-brush-for-pet": """برس اسپری‌دار طرح انبه برای شانه و ماساژ هم‌زمان. مخزن را با آب یا اسپری مجاز پر می‌کنی تا مو کمتر گره بخورد.

هوشمند به معنی ربات نیست — اسپری و دندانه کار را راحت‌تر می‌کند. روی پوست زخمی نکش.

بعد استفاده مخزن را خالی و خشک کن.

• برس اسپری‌دار طرح انبه
• مناسب سگ و گربه
• ماساژ + شانه
• نه روی پوست ملتهب
• مخزن را خشک نگه دار

— پت دیت شاپ.""",
    "dog-carriers-fiber-space-pet-carrier-backpack": """کوله فضایی مدل فایبر برای بردن سگ یا گربه کوچک در مسیرهای شهری. پنجره‌ها دید می‌دهند و هوا بهتر رد می‌شود.

قبل خرید وزن و جثه را با کوله بسنج؛ حیوان باید بتواند بچرخد نه اینکه فشرده شود. بندها را روی هر دو شانه تنظیم کن.

جایگزین باکس سفر هوایی تأییدشده نیست مگر مشخصات پرواز را جدا چک کنی.

• کوله فضایی فایبر
• مناسب سگ و گربه کوچک
• تهویه و دید
• اندازه با جثه
• نه لزوماً تأیید ایرلاین

— پت دیت شاپ.""",
    "dog-carriers-luxury-leather-space-pet-carier-backpack": """کوله فضایی با روکش چرم برای مسیر کوتاه شهری. ظاهر مرتب‌تر از کوله پارچه‌ای ساده.

چرم را خیس نگذار. حیوان را مدت طولانی در گرما داخل کوله نگذار — تهویه را باز نگه دار.

بند و زیپ را قبل هر خروج چک کن.

• کوله فضایی چرم لاکچری
• مناسب مسیر شهری
• مراقبت چرم
• تهویه باز
• چک زیپ و بند

— پت دیت شاپ.""",
    "dog-carriers-leather-pet-carier-backpack": """کوله فضایی چرمی با فضای پارک‌مانند داخل؛ حیوان جای پا دارد و کمتر روی هم جمع می‌شود.

چرم را خشک نگه دار. برای حیوان سنگین یا خیلی بی‌قرار مدل سفت‌تر/باکس سخت بهتر است.

روی زمین داغ نگذار.

• کوله چرمی پارک‌دار
• فضای داخلی بازتر
• مراقبت چرم
• مناسب جثه متناسب
• نه روی سطح داغ

— پت دیت شاپ.""",
    "cat-carriers-zarix-zeus-for-cat": """کوله فضایی مدل زئوس برای گربه؛ دید اطراف و حمل روی شانه یا پشت.

گربه‌ای که تا حالا کوله ندیده اول در خانه عادت بده — در را باز بگذار و تشویقی بده. زیپ را کامل ببند.

جایگزین باکس دامپزشکی سفت نیست اگر گربه خیلی مضطرب است.

• کوله فضایی زئوس
• برند زریکس
• مناسب گربه
• عادت تدریجی در خانه
• زیپ کامل

— پت دیت شاپ.""",
    "cat-carriers-raha-pet-hard-box-3": """باکس سخت رها برای تاکسی، کلینیک و جابه‌جایی کوتاه. دیواره سفت یعنی محافظت بیشتر از کوله نرم.

قفل در را قبل حرکت چک کن. برای پرواز قوانین ایرلاین را جدا بخوان.

تهویه را نبند.

• باکس سخت رها
• مناسب سگ و گربه
• قفل در
• تهویه باز
• کلینیک و مسیر شهری

— پت دیت شاپ.""",
    "cat-carriers-jupiter-cat-hard-box": """باکس حمل سخت ژوپیتر؛ انتخاب وسط بین کوله نرم و باکس خیلی بزرگ.

کف را با حوله نازک بپوشان. اگر حیوان پنجه می‌زند قفل را دوباره چک کن.

جای بازی خانگی نیست.

• باکس سخت ژوپیتر
• مناسب سگ و گربه
• کف ضدلغزش/حوله
• قفل دوباره چک شود
• برای جابه‌جایی نه خواب دائم

— پت دیت شاپ.""",
    "bird-food-oshkaia-mixed-nut-cockatiel-food-kg": """خوراک آجیلی مخلوط اوشکایا برای عروس هلندی؛ تنوع مغز و دانه به‌جای دان ساده تکراری.

آجیل چرب است — سهم را کنترل کن تا وزن نپرد. آب تازه همیشه باشد. جایگزین بررسی بال و مدفوع نیست.

دور از رطوبت نگه دار.

• مخلوط آجیلی عروس هلندی
• برند اوشکایا
• تنوع دانه
• سهم را کنترل کن
• جای خشک

— پت دیت شاپ.""",
    "bird-food-oshkaia-mynah-bird-food-kg": """خوراک اوشکایا برای مرغ مینا و پرندگان حشره‌خوار؛ پروتئین بیشتر از دان طوطی معمولی.

حشره‌خوارها به تنوع نیاز دارند — این بسته کمک روزانه است نه تمام رژیم. اگر اسهال یا بی‌اشتهایی دیدی قطع کن و با دامپزشک پرندگان حرف بزن.

خشک و دربسته نگه دار.

• خوراک مینا / حشره‌خوار
• برند اوشکایا
• پروتئین بالاتر از دان ساده
• تنوع رژیم را فراموش نکن
• نگهداری خشک

— پت دیت شاپ.""",
}


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def ts_price(n: int) -> str:
    return f"{n:_}"


def extra_fields(p: dict) -> str:
    label = (p.get("weightLabel") or "").strip()
    kind = p.get("weightKind") or ""
    if not label:
        return ""
    if kind == "model":
        return f",\n    model: {ts_string(label)}"
    if kind == "color":
        return f",\n    color: {ts_string(label)}"
    if kind == "size":
        return f",\n    size: {ts_string(label)}"
    return f",\n    weight: {ts_string(label)}"


def suitable_for(p: dict) -> str:
    pets = p["petTypes"]
    if "dog" in pets and "cat" in pets:
        return "سگ و گربه"
    if "dog" in pets:
        return "سگ"
    if "cat" in pets:
        return "گربه"
    if "bird" in pets:
        return "پرنده"
    return "سگ و گربه"


def web_params(p: dict) -> str:
    parts = [f'      مناسب_برای: {ts_string(suitable_for(p))},']
    label = (p.get("weightLabel") or "").strip()
    kind = p.get("weightKind") or ""
    if label and kind == "model":
        parts.insert(0, f"      مدل: {ts_string(label)},")
    elif label and kind == "color":
        parts.insert(0, f"      رنگ: {ts_string(label)},")
    elif label and kind == "size":
        parts.insert(0, f"      سایز: {ts_string(label)},")
    elif label:
        parts.insert(0, f"      وزن: {ts_string(label)},")
    return "\n".join(parts)


def api_block(p: dict) -> str:
    pets = ", ".join(ts_string(t) for t in p["petTypes"])
    desc = DESCRIPTIONS[p["slug"]]
    return f"""  row({{
    id: {ts_string(p["proposedId"])},
    slug: {ts_string(p["slug"])},
    title: {ts_string(p["title"])},
    titleEn: {ts_string(p.get("titleEn") or "")},
    brandId: {ts_string(p["brandId"])},
    categorySlug: {ts_string(p["categorySlug"])},
    petTypes: [{pets}],
    priceToman: {ts_price(p["priceToman"])}{extra_fields(p)},
    description:
      {ts_string(desc)},
  }}),"""


def web_block(p: dict) -> str:
    pets = ", ".join(ts_string(t) for t in p["petTypes"])
    desc = DESCRIPTIONS[p["slug"]]
    return f"""  product({{
    id: {ts_string(p["proposedId"])},
    slug: {ts_string(p["slug"])},
    title: {ts_string(p["title"])},
    titleEn: {ts_string(p.get("titleEn") or "")},
    brandId: {ts_string(p["brandId"])},
    categorySlug: {ts_string(p["categorySlug"])},
    petTypes: [{pets}],
    priceToman: {ts_price(p["priceToman"])},
    params: {{
{web_params(p)}
    }},
    description:
      {ts_string(desc)},
  }}),"""


def write_web() -> None:
    blocks = "\n".join(web_block(p) for p in PRODUCTS)
    text = f"""import type {{ ShopProduct }} from './shopCatalog';

const P = '/pepito/uploads';
const V = {ts_string(CACHE_BUST)};

function gallery(slug: string): {{ image: string; images: string[] }} {{
  const images = [
    `${{P}}/${{slug}}.jpg?v=${{V}}`,
    `${{P}}/${{slug}}-2.jpg?v=${{V}}`,
    `${{P}}/${{slug}}-3.jpg?v=${{V}}`,
  ];
  return {{ image: images[0]!, images }};
}}

function bullets(description: string): string[] {{
  return description
    .split('\\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('• '))
    .map((line) => line.slice(2).trim())
    .slice(0, 3);
}}

function product(
  partial: Omit<ShopProduct, 'image' | 'images' | 'badge' | 'inStock' | 'featured' | 'sellerName' | 'warranty' | 'highlights'>
): ShopProduct {{
  const {{ image, images }} = gallery(partial.slug);
  return {{
    ...partial,
    image,
    images,
    badge: 'new',
    inStock: true,
    featured: true,
    sellerName: 'پت‌دیت شاپ',
    warranty: 'ضمانت اصالت و سلامت فیزیکی کالا',
    highlights: bullets(partial.description),
  }};
}}

export const SHOP_BATCH_MULTI_WAVE5_PRODUCTS: ShopProduct[] = [
{blocks}
];
"""
    dest = ROOT / "packages/web/src/data/shopBatchMultiWave5Products.ts"
    dest.write_text(text)


def write_api() -> None:
    blocks = "\n".join(api_block(p) for p in PRODUCTS)
    text = f"""/**
 * PetDate shop Batch-multi wave 5/5 — 10 live SKUs (p290–p299).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 * Gallery cache-bust is batch-multi-w5-v1 (wave 1–4 stay on their own busts).
 * Slug typo is historical: dog-carriers-*-carier-backpack (carier not carrier).
 */
import {{ getDb }} from '../db';
import {{ withShopImagesParam }} from './shop-product-images';
import {{ HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE5_SLUGS }} from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_WAVE5_CACHE_BUST = {ts_string(CACHE_BUST)};

function multiGallery(slug: string): {{ image: string; images: string[] }} {{
  const images = [
    `${{P}}/${{slug}}.jpg?v=${{SHOP_BATCH_MULTI_WAVE5_CACHE_BUST}}`,
    `${{P}}/${{slug}}-2.jpg?v=${{SHOP_BATCH_MULTI_WAVE5_CACHE_BUST}}`,
    `${{P}}/${{slug}}-3.jpg?v=${{SHOP_BATCH_MULTI_WAVE5_CACHE_BUST}}`,
  ];
  return {{ image: images[0]!, images }};
}}

export type ShopBatchMultiWave5Product = {{
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_WAVE5_SLUGS)[number];
  title: string;
  titleEn: string;
  brandId: string;
  categorySlug: string;
  petTypes: string[];
  priceToman: number;
  costToman: number;
  image: string;
  images: string[];
  badge: 'new';
  inStock: true;
  stockQty: number;
  featured: true;
  params: Record<string, string>;
  description: string;
}};

const CATEGORIES = [
  {{
    slug: 'grooming',
    labelFa: 'بهداشت و آراستگی',
    petType: 'dog',
    description: 'شامپو و برس',
    emoji: '🧴',
    sortOrder: 100,
  }},
  {{
    slug: 'dog-carriers',
    labelFa: 'کوله و باکس حمل سگ',
    petType: 'dog',
    description: 'کوله فضایی و کیف حمل',
    emoji: '🧳',
    sortOrder: 110,
  }},
  {{
    slug: 'cat-carriers',
    labelFa: 'کوله و باکس حمل گربه',
    petType: 'cat',
    description: 'کوله فضایی و باکس حمل',
    emoji: '🎒',
    sortOrder: 120,
  }},
  {{
    slug: 'bird-food',
    labelFa: 'غذای پرنده',
    petType: 'bird',
    description: 'دان، پلت و مخلوط غذایی',
    emoji: '🐦',
    sortOrder: 130,
  }},
] as const;

function row(
  partial: Omit<
    ShopBatchMultiWave5Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {{
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }}
): ShopBatchMultiWave5Product {{
  const hasDog = partial.petTypes.includes('dog');
  const hasCat = partial.petTypes.includes('cat');
  const hasBird = partial.petTypes.includes('bird');
  const suitable = hasDog && hasCat ? 'سگ و گربه' : hasDog ? 'سگ' : hasCat ? 'گربه' : hasBird ? 'پرنده' : 'سگ و گربه';
  const params: Record<string, string> = {{
    مناسب_برای: suitable,
    __titleEn: partial.titleEn,
  }};
  if (partial.weight) params['وزن'] = partial.weight;
  if (partial.color) params['رنگ'] = partial.color;
  if (partial.model) params['مدل'] = partial.model;
  if (partial.size) params['سایز'] = partial.size;
  return {{
    ...partial,
    costToman: partial.priceToman,
    ...multiGallery(partial.slug),
    badge: 'new',
    inStock: true,
    stockQty: 25,
    featured: true,
    params,
  }};
}}

export const SHOP_BATCH_MULTI_WAVE5_PRODUCTS: ShopBatchMultiWave5Product[] = [
{blocks}
];

export {{ SHOP_BATCH_MULTI_WAVE5_SLUGS }};

export function seedShopBatchMultiWave5Products(): number {{
  const d = getDb();

  const insCat = d.prepare(
    `INSERT INTO shop_categories (slug, label_fa, pet_type, description, emoji, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO NOTHING`
  );
  for (const c of CATEGORIES) {{
    insCat.run(c.slug, c.labelFa, c.petType, c.description, c.emoji, c.sortOrder);
  }}

  const findBySlug = d.prepare(`SELECT id, stock_qty FROM shop_products WHERE slug = ?`);
  const upsert = d.prepare(
    `INSERT INTO shop_products (
      id, slug, title, brand_id, category_slug, pet_types, price_toman, cost_toman,
      image, badge, in_stock, stock_qty, params, description, featured, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      brand_id = excluded.brand_id,
      category_slug = excluded.category_slug,
      pet_types = excluded.pet_types,
      price_toman = excluded.price_toman,
      cost_toman = excluded.cost_toman,
      image = excluded.image,
      badge = excluded.badge,
      in_stock = excluded.in_stock,
      params = excluded.params,
      description = excluded.description,
      featured = excluded.featured,
      updated_at = datetime('now')`
  );

  let count = 0;
  for (const p of SHOP_BATCH_MULTI_WAVE5_PRODUCTS) {{
    if ((HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)) continue;
    const existing = findBySlug.get(p.slug) as {{ id: string; stock_qty: number }} | undefined;
    const id = existing?.id ?? p.id;
    const stockQty = existing ? Number(existing.stock_qty) : p.stockQty;
    upsert.run(
      id,
      p.slug,
      p.title,
      p.brandId,
      p.categorySlug,
      JSON.stringify(p.petTypes),
      p.priceToman,
      p.costToman,
      p.image,
      p.badge,
      stockQty,
      JSON.stringify(withShopImagesParam(p.params, p.images)),
      p.description
    );
    count += 1;
  }}
  return count;
}}
"""
    dest = ROOT / "packages/api/src/data/shop-batch-multi-wave5-products.ts"
    dest.write_text(text)


def write_price_index() -> None:
    path = ROOT / "packages/api/src/data/shop-price-index.json"
    existing = json.loads(path.read_text())
    keep = [
        row
        for row in existing
        if str(row.get("id", "")).startswith("p") and 221 <= int(str(row["id"])[1:]) <= 289
    ]
    seen = {row["id"] for row in keep}
    for p in PRODUCTS:
        if p["proposedId"] in seen:
            continue
        keep.append(
            {
                "id": p["proposedId"],
                "slug": p["slug"],
                "title": p["title"],
                "brandId": p["brandId"],
                "categorySlug": p["categorySlug"],
                "priceToman": p["priceToman"],
            }
        )
    path.write_text(json.dumps(keep, ensure_ascii=False, separators=(",", ":")) + "\n")


def write_cache_bust() -> None:
    dest = ROOT / "tmp/cache-bust-shop-batch-multi-w5-v1"
    dest.write_text(f"{CACHE_BUST}\n")


def main() -> None:
    missing = [p["slug"] for p in PRODUCTS if p["slug"] not in DESCRIPTIONS]
    if missing:
        raise SystemExit(f"missing descriptions: {missing}")
    if [p["proposedId"] for p in PRODUCTS] != [f"p{i}" for i in range(290, 300)]:
        raise SystemExit("wave 5 ids must be p290–p299 in order")
    if CACHE_BUST != "batch-multi-w5-v1":
        raise SystemExit("wave 5 cache bust must be batch-multi-w5-v1")
    if PRODUCTS[3]["slug"] != "dog-carriers-luxury-leather-space-pet-carier-backpack":
        raise SystemExit("p293 slug must keep historical carier typo")
    if PRODUCTS[4]["slug"] != "dog-carriers-leather-pet-carier-backpack":
        raise SystemExit("p294 slug must keep historical carier typo")
    write_web()
    write_api()
    write_price_index()
    write_cache_bust()
    print(f"generated {len(PRODUCTS)} wave-5 SKUs cache={CACHE_BUST}")


if __name__ == "__main__":
    main()
