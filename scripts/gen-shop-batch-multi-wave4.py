#!/usr/bin/env python3
"""Generate Batch-multi wave 4/5 catalog (p280–p289 only) from the wave MANIFEST."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "scripts/shop-batch-multi-wave4.json").read_text())
PRODUCTS = MANIFEST["products"]
CACHE_BUST = MANIFEST["cacheBust"]

DESCRIPTIONS: dict[str, str] = {
    "dog-accessories-hannapet-silicone-h-harness-sizr-m": """هارنس H سیلیکونی سایز M برای سگ‌های کوچک تا متوسط؛ فشار کمتر روی گردن نسبت به قلاده ساده هنگام کشیدن.

جدول سایز روی محصول را با دور سینه واقعی چک کن؛ حرف M بین برندها یکی نیست.

برای توله در حال رشد ممکن است زود کوچک شود.

• هارنس H سیلیکونی
• سایز M
• برند حناپت
• اندازه با دور سینه
• مناسب سگ کوچک–متوسط

— پت دیت شاپ.""",
    "dog-accessories-waudog-classic-leather-collar-25-mm": """قلاده چرمی کلاسیک ۲۵ میلی‌متری WAUDOG؛ ظاهر مرتب برای پیاده‌روی شهری.

چرم را خشک نگه دار و گاه‌به‌گاه با مراقبت چرم تمیز کن. برای سگ‌های خیلی کشنده هارنس مکمل بهتر است.

گردن را قبل خرید اندازه بگیر.

• قلاده چرمی کلاسیک
• پهنای ۲۵ میلی‌متر
• برند WAUDOG
• مراقبت چرم
• برای کشنده شدید هارنس اضافه کن

— پت دیت شاپ.""",
    "dog-accessories-hannapet-silicone-dog-leash-size-m": """لیش سیلیکونی سایز M؛ جفت طبیعی هارنس M همان برند. دست را کمتر می‌سوزاند در کشیدن‌های کوتاه.

کارابین را روی حلقه هارنس قفل کن. اگر سگ خیلی سنگین است به L فکر کن.

شست‌وشوی آب خنک.

• لیش سیلیکونی M
• برند حناپت
• جفت هارنس هم‌سایز
• قفل کارابین
• شست‌وشوی آسان

— پت دیت شاپ.""",
    "cat-accessories-hannapet-double-wooden-bowl-stand": """پایه چوبی دو ظرف برای آب و غذا؛ ارتفاع ملایم تا گردن کمتر خم شود — مخصوصاً برای گربه‌های مسن‌تر.

چوب را خیس نگذار؛ ظرف‌ها را جدا بشوی. جای ثابت انتخاب کن تا گربه سردرگم نشود.

یک عدد.

• پایه چوبی دوقلو
• برند حناپت
• ارتفاع راحت‌تر برای خوردن
• شست‌وشوی ظرف جدا از چوب
• جای ثابت در خانه

— پت دیت شاپ.""",
    "cat-accessories-eggshell-bowls-for-cats": """ست ظرف پایه‌دار طرح تخم‌مرغ؛ ظاهر فانتزی با ارتفاع کم تا متوسط برای گربه روزمره.

سبیل‌ها به دیواره تنگ حساس‌اند — اگر دیدید کنار ظرف غذا می‌گذارند ظرف پهن‌تر بهتر است.

روزانه بشوی.

• طرح تخم‌مرغ پایه‌دار
• آب + غذا
• مناسب گربه
• سبیل را فشار ندهد
• شست‌وشوی روزانه

— پت دیت شاپ.""",
    "cat-accessories-high-legend-bowls-for-cat": """ظرف پایه‌دار طرح خندان؛ انتخاب رنگی برای خانه‌هایی که ظرف ساده نمی‌خواهند.

پایه را روی سطح صاف بگذار تا نلغزد. استیل/پلاستیک را بعد هر وعده تمیز کن تا بو نگیرد.

جای ظرف کنار خاک نباشد.

• مدل خندان پایه‌دار
• جدا از خاک گربه
• سطح صاف
• تمیزکاری بعد وعده
• مناسب گربه خانگی

— پت دیت شاپ.""",
    "cat-accessories-hanapet-double-metal-bowl-stand": """پایه فلزی دو ظرف؛ مقاوم‌تر از چوب در برابر رطوبت ریز آب. مناسب گربه‌هایی که دور ظرف آب می‌پاشند.

فلز را خشک کن تا لکه نماند. ارتفاع را با جثه گربه بسنج.

یک عدد.

• پایه فلزی دوقلو
• حناپت
• مقاوم رطوبت
• خشک کردن بعد شست‌وشو
• مناسب پاشیدن آب

— پت دیت شاپ.""",
    "cat-accessories-petopoli-four-legged-pet-bowl": """ظرف مرتفع چهارپایه؛ برای گربه‌هایی که ایستاده راحت‌تر می‌خورند یا صاحب از ریخت‌وپاش روی زمین خسته شده.

پاها را قفل چک کن. مدل چهارپایه پتوپولی.

لغزش روی سرامیک را با زیرپایی کنترل کن.

• چهارپایه مرتفع
• برند پتوپولی
• کمتر خم شدن گردن
• چک پایداری پاها
• کنترل لغزش

— پت دیت شاپ.""",
    "grooming-mojan-pet-brush": """برس فنری برای کندن موهای شل سگ و گربه کوتاه‌مو تا متوسط.

هفته‌ای چند بار کوتاه بهتر از یک‌بار وحشیانه است. اگر پوست حساس است با فشار کمتر.

موی جمع‌شده را بعد هر وعده پاک کن.

• برس فنری موژان
• مناسب سگ و گربه
• کاهش ریزش روی مبل
• فشار ملایم
• پاک کردن مو از برس

— پت دیت شاپ.""",
    "grooming-dog-shedding-brush-hair-release-button": """برس بیضی با دکمه تخلیه مو؛ بعد شانه یک فشار و مو می‌افتد توی سطل نه روی فرش.

روی پوست ملتهب نکش. برای مو بلند ممکن است به شانه جدا هم نیاز باشد.

تمیزکاری بعد هر بار.

• دکمه تخلیه مو
• مدل بیضی
• مناسب سگ و گربه
• نه روی پوست زخمی
• کمک به کنترل ریزش

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
    return "گربه"


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

export const SHOP_BATCH_MULTI_WAVE4_PRODUCTS: ShopProduct[] = [
{blocks}
];
"""
    dest = ROOT / "packages/web/src/data/shopBatchMultiWave4Products.ts"
    dest.write_text(text)


def write_api() -> None:
    blocks = "\n".join(api_block(p) for p in PRODUCTS)
    text = f"""/**
 * PetDate shop Batch-multi wave 4/5 — 10 live SKUs (p280–p289).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 * Gallery cache-bust is batch-multi-w4-v3 (wave 1–3 stay on their own busts).
 * Slug typo is historical: hannapet-silicone-h-harness-sizr-m (sizr not size).
 */
import {{ getDb }} from '../db';
import {{ withShopImagesParam }} from './shop-product-images';
import {{ HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE4_SLUGS }} from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_WAVE4_CACHE_BUST = {ts_string(CACHE_BUST)};

function multiGallery(slug: string): {{ image: string; images: string[] }} {{
  const images = [
    `${{P}}/${{slug}}.jpg?v=${{SHOP_BATCH_MULTI_WAVE4_CACHE_BUST}}`,
    `${{P}}/${{slug}}-2.jpg?v=${{SHOP_BATCH_MULTI_WAVE4_CACHE_BUST}}`,
    `${{P}}/${{slug}}-3.jpg?v=${{SHOP_BATCH_MULTI_WAVE4_CACHE_BUST}}`,
  ];
  return {{ image: images[0]!, images }};
}}

export type ShopBatchMultiWave4Product = {{
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_WAVE4_SLUGS)[number];
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
    slug: 'dog-accessories',
    labelFa: 'قلاده، لیش و هارنس',
    petType: 'dog',
    description: 'هارنس، لیش و قلاده',
    emoji: '🦮',
    sortOrder: 80,
  }},
  {{
    slug: 'cat-accessories',
    labelFa: 'ظروف و لوازم گربه',
    petType: 'cat',
    description: 'ظرف و پایه غذا',
    emoji: '🍽️',
    sortOrder: 90,
  }},
  {{
    slug: 'grooming',
    labelFa: 'بهداشت و آراستگی',
    petType: 'dog',
    description: 'شامپو و برس',
    emoji: '🧴',
    sortOrder: 100,
  }},
] as const;

function row(
  partial: Omit<
    ShopBatchMultiWave4Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {{
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }}
): ShopBatchMultiWave4Product {{
  const hasDog = partial.petTypes.includes('dog');
  const hasCat = partial.petTypes.includes('cat');
  const suitable = hasDog && hasCat ? 'سگ و گربه' : hasDog ? 'سگ' : 'گربه';
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

export const SHOP_BATCH_MULTI_WAVE4_PRODUCTS: ShopBatchMultiWave4Product[] = [
{blocks}
];

export {{ SHOP_BATCH_MULTI_WAVE4_SLUGS }};

export function seedShopBatchMultiWave4Products(): number {{
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
  for (const p of SHOP_BATCH_MULTI_WAVE4_PRODUCTS) {{
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
    dest = ROOT / "packages/api/src/data/shop-batch-multi-wave4-products.ts"
    dest.write_text(text)


def write_price_index() -> None:
    path = ROOT / "packages/api/src/data/shop-price-index.json"
    existing = json.loads(path.read_text())
    keep = [
        row
        for row in existing
        if str(row.get("id", "")).startswith("p") and 221 <= int(str(row["id"])[1:]) <= 279
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
    dest = ROOT / "tmp/cache-bust-shop-batch-multi-w4-v3"
    dest.write_text(f"{CACHE_BUST}\n")


def main() -> None:
    missing = [p["slug"] for p in PRODUCTS if p["slug"] not in DESCRIPTIONS]
    if missing:
        raise SystemExit(f"missing descriptions: {missing}")
    if [p["proposedId"] for p in PRODUCTS] != [f"p{i}" for i in range(280, 290)]:
        raise SystemExit("wave 4 ids must be p280–p289 in order")
    if CACHE_BUST != "batch-multi-w4-v3":
        raise SystemExit("wave 4 cache bust must be batch-multi-w4-v3")
    if PRODUCTS[0]["slug"] != "dog-accessories-hannapet-silicone-h-harness-sizr-m":
        raise SystemExit("p280 slug must keep historical sizr typo")
    write_web()
    write_api()
    write_price_index()
    write_cache_bust()
    print(f"generated {len(PRODUCTS)} wave-4 SKUs cache={CACHE_BUST}")


if __name__ == "__main__":
    main()
