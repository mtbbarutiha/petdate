#!/usr/bin/env python3
"""Generate Batch-multi wave 3/5 catalog (p270–p279 only) from the wave MANIFEST."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "scripts/shop-batch-multi-wave3.json").read_text())
PRODUCTS = MANIFEST["products"]
CACHE_BUST = MANIFEST["cacheBust"]

DESCRIPTIONS: dict[str, str] = {
    "dog-toys-luna-pomegranate-felt-squeaky-dog-toy": """عروسک نمدی صدادهنده لونا؛ سبک برای توله و سگ‌های بازی‌گوش نرم. داخل خانه بهتر از حیاط خشن است.

اگر سگ نمد را می‌درد، اسباب‌بازی مقاوم‌تر بگیر. صدای جیرجیر را بعضی سگ‌ها دوست دارند بعضی می‌ترسند.

بعد پاره شدن دور بینداز.

• نمد طرح انار / لونا
• صدادهنده
• مناسب بازی نرم خانگی
• زیر نظر اگر پاره شد
• جایگزین جویدنی مقاوم نیست

— پت دیت شاپ.""",
    "dog-toys-luna-squeaky-watermelon-plush-dog-toy": """نسخه کلاسیک هندوانه پولیشی لونا با صدا؛ هم‌سبک مدل خندان برای تنوع ظاهر.

همان قانون: بازی نرم، نظارت، دور انداختن وقتی پاره شد.

برای توله و سگ کم‌تهاجم مناسب‌تر است.

• پولیش هندوانه / صدا دار
• برند لونا
• تنوع ظاهری نسبت به مدل خندان
• نظارت هنگام بازی
• مقاوم جویدن سنگین نیست

— پت دیت شاپ.""",
    "cat-toys-petopoli-4-way-foldable-cat-play-tunnel": """تونل تاشو چهارراه برای دویدن و کمین؛ انرژی گربه آپارتمانی را خالی می‌کند بدون اینکه مبل قربانی شود.

روی سطح لغزنده فیکس کن. اگر چند گربه دارید اول جداگانه معرفی کنید تا دعوا سر ورودی نشود.

جمع‌شو برای خانه کوچک.

• تونل چهارراه تاشو
• برند پتوپولی
• تخلیه انرژی داخل خانه
• معرفی آرام به چند گربه
• بازی نظارت‌شده

— پت دیت شاپ.""",
    "cat-toys-cat-toy-layer-tower-of-tracks": """برج توپ و لایه با پر؛ گربه توپ را دنبال می‌کند و گاه‌به‌گاه به پر حمله می‌کند. مناسب میز و کنج خلوت.

باتری/قطعه متحرک اگر داشت را از دستور ساخت چک کن. زیر نظر توله تا قطعه نبلعد.

• برج طبقاتی + پر
• دنبال کردن توپ
• مناسب خانه کوچک
• نظارت روی توله
• بازی سبک خانگی

— پت دیت شاپ.""",
    "cat-toys-hanging-catnip-bat-toy-for-cats": """خفاش آویز با کت‌نیپ برای حمله از در و قفسه. نصب محکم؛ اگر بیفتد بازی تمام است و ممکن است پاره شود.

کت‌نیپ داخلش بو را زنده نگه می‌دارد. نخ و قطعات کوچک را چک کن.

• آویز خفاش + کت‌نیپ
• نصب محکم
• تقویت شکار خانگی
• برند جویسر
• ایمنی نخ و قطعه

— پت دیت شاپ.""",
    "cat-toys-little-yellow-cat-toy": """تعادل‌کننده تشویقی‌خور طرح جوجه اردک؛ گربه باید حرکت بدهد تا جایزه برسد. نسخه گربه‌ای پازل نرم.

تشویقی خشک ریز بریز.

زیر نظر اگر پلاستیک جویده شد.

• تشویقی‌خور تعادلی
• طرح جوجه اردک
• تقویت بازی فکری
• تشویقی خشک ریز
• بازی زیر نظر

— پت دیت شاپ.""",
    "cat-toys-play-tunnel-bag": """کیسه/تونل نرم برای قایم‌باشک؛ جایگزین سبک تونل سفت در خانه خیلی کوچک.

بعد بازی جمع کن تا زمین‌گیر نشود. اگر گربه داخلش ادرار کرد طبق پارچه بشوی.

• کیسه بازی تاشو
• برند پتوپولی
• قایم‌باشک خانگی
• جمع بعد بازی
• قابل شست‌وشو در حد پارچه

— پت دیت شاپ.""",
    "cat-toys-automatic-cat-teaser-ball-robotic-toy-for-cats": """توپ حرکتی خودکار برای وقتی خودت حوصله میله پر نداری. روی سطح صاف بهتر کار می‌کند.

باتری را چک کن و شب خاموش بگذار تا گربه نخوابد. زیر نظر اولین جلسه‌ها.

• توپ رباتیک خودکار
• تخلیه انرژی بدون میله
• سطح صاف
• خاموش کردن بین بازی
• اولین بار نظارت

— پت دیت شاپ.""",
    "dog-accessories-hannapet-silicone-h-harness-size-l": """هارنس H سیلیکونی سایز L برای سگ‌های متوسط رو به بزرگ؛ فشار کمتر روی گردن نسبت به قلاده ساده هنگام کشیدن.

اندازه سینه را دقیق بگیر؛ تنگ = زخم، گشاد = دررفتن.

برای سگ‌های خیلی کشنده ممکن است به مدل محکم‌تر نیاز باشد.

• هارنس H سیلیکونی
• سایز L
• برند حناپت
• فشار کمتر روی گردن
• اندازه‌گیری سینه قبل خرید

— پت دیت شاپ.""",
    "dog-accessories-hannapet-silicone-dog-leash-size-l": """لیش سیلیکونی سایز L؛ نرم در دست و قابل شست‌وشو نسبت به پارچه‌های زبر.

با هارنس مناسب جفت کن نه فقط قلاده گردنی برای سگ‌های کشنده. گره و کارابین را قبل خروج چک کن.

طول را با فضای پیاده‌روی‌ات بسنج.

• لیش سیلیکونی L
• برند حناپت
• نرم و قابل شست‌وشو
• چک قفل قبل خروج
• مناسب پیاده‌روی

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


def web_params(p: dict) -> str:
    suitable = "سگ" if "dog" in p["petTypes"] else "گربه"
    parts = [f'      مناسب_برای: {ts_string(suitable)},']
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

export const SHOP_BATCH_MULTI_WAVE3_PRODUCTS: ShopProduct[] = [
{blocks}
];
"""
    dest = ROOT / "packages/web/src/data/shopBatchMultiWave3Products.ts"
    dest.write_text(text)


def write_api() -> None:
    blocks = "\n".join(api_block(p) for p in PRODUCTS)
    text = f"""/**
 * PetDate shop Batch-multi wave 3/5 — 10 live SKUs (p270–p279).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 * Gallery cache-bust is batch-multi-w3-v2 (wave 1/2 stay on their own busts).
 */
import {{ getDb }} from '../db';
import {{ withShopImagesParam }} from './shop-product-images';
import {{ HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE3_SLUGS }} from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_WAVE3_CACHE_BUST = {ts_string(CACHE_BUST)};

function multiGallery(slug: string): {{ image: string; images: string[] }} {{
  const images = [
    `${{P}}/${{slug}}.jpg?v=${{SHOP_BATCH_MULTI_WAVE3_CACHE_BUST}}`,
    `${{P}}/${{slug}}-2.jpg?v=${{SHOP_BATCH_MULTI_WAVE3_CACHE_BUST}}`,
    `${{P}}/${{slug}}-3.jpg?v=${{SHOP_BATCH_MULTI_WAVE3_CACHE_BUST}}`,
  ];
  return {{ image: images[0]!, images }};
}}

export type ShopBatchMultiWave3Product = {{
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_WAVE3_SLUGS)[number];
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
    slug: 'dog-toys',
    labelFa: 'اسباب بازی سگ',
    petType: 'dog',
    description: 'توپ، لاتکس و اسباب‌بازی تعاملی',
    emoji: '🎾',
    sortOrder: 50,
  }},
  {{
    slug: 'cat-toys',
    labelFa: 'اسباب بازی گربه',
    petType: 'cat',
    description: 'موش، میله و اسباب‌بازی',
    emoji: '🐭',
    sortOrder: 60,
  }},
  {{
    slug: 'dog-accessories',
    labelFa: 'قلاده، لیش و هارنس',
    petType: 'dog',
    description: 'هارنس، لیش و قلاده',
    emoji: '🦮',
    sortOrder: 80,
  }},
] as const;

function row(
  partial: Omit<
    ShopBatchMultiWave3Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {{
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }}
): ShopBatchMultiWave3Product {{
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

export const SHOP_BATCH_MULTI_WAVE3_PRODUCTS: ShopBatchMultiWave3Product[] = [
{blocks}
];

export {{ SHOP_BATCH_MULTI_WAVE3_SLUGS }};

export function seedShopBatchMultiWave3Products(): number {{
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
  for (const p of SHOP_BATCH_MULTI_WAVE3_PRODUCTS) {{
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
    dest = ROOT / "packages/api/src/data/shop-batch-multi-wave3-products.ts"
    dest.write_text(text)


def write_price_index() -> None:
    path = ROOT / "packages/api/src/data/shop-price-index.json"
    existing = json.loads(path.read_text())
    keep = [
        row
        for row in existing
        if str(row.get("id", "")).startswith("p") and 221 <= int(str(row["id"])[1:]) <= 269
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
    dest = ROOT / "tmp/cache-bust-shop-batch-multi-w3-v2"
    dest.write_text(f"{CACHE_BUST}\n")


def main() -> None:
    missing = [p["slug"] for p in PRODUCTS if p["slug"] not in DESCRIPTIONS]
    if missing:
        raise SystemExit(f"missing descriptions: {missing}")
    if [p["proposedId"] for p in PRODUCTS] != [f"p{i}" for i in range(270, 280)]:
        raise SystemExit("wave 3 ids must be p270–p279 in order")
    if CACHE_BUST != "batch-multi-w3-v2":
        raise SystemExit("wave 3 cache bust must be batch-multi-w3-v2")
    write_web()
    write_api()
    write_price_index()
    write_cache_bust()
    print(f"generated {len(PRODUCTS)} wave-3 SKUs cache={CACHE_BUST}")


if __name__ == "__main__":
    main()
