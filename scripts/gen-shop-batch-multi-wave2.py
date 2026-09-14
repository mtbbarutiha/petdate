#!/usr/bin/env python3
"""Generate Batch-multi wave 2/5 catalog (p260–p269 only) from the wave MANIFEST."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "scripts/shop-batch-multi-wave2.json").read_text())
PRODUCTS = MANIFEST["products"]
CACHE_BUST = MANIFEST["cacheBust"]

DESCRIPTIONS: dict[str, str] = {
    "dog-treats-wanpy-chicken-jerky-chips-100g": """چیپس مرغ خشک ونپی؛ ترد و خوش‌بو برای جایزه سریع آموزش. تکه را بشکن تا کش نیاید و قورت ندهد.

از سهم روزانه کم کن. مرغ حساسیت شایع است — اگر خارش دارد پروتئین را عوض کن.

بسته ۱۰۰ گرم. جایگزین وعده نیست.

• چیپس مرغ خشک
• ۱۰۰ گرم
• برند ونپی
• مناسب آموزش
• تکه را خرد کن

— پت دیت شاپ.""",
    "cat-treats-bioline-catnip-spray-50ml": """اسپری کت‌نیپ برای زنده‌کردن اسباب‌بازی و اسکرچر کهنه. چند پاف کافی است؛ خیس کردن لازم نیست.

حدود یک‌سوم گربه‌ها به کت‌نیپ واکنش کمی دارند — طبیعی است. روی پارچه و اسباب‌بازی بزن، نه مستقیم روی چشم و بینی.

دور از بچه‌ها نگه دار. جایگزین بازی و توجه نیست.

• اسپری کت‌نیپ ۵۰ میل
• برند بایولاین
• برای اسباب‌بازی و اسکرچر
• چند پاف کافی است
• همه گربه‌ها واکنش یکسان ندارند

— پت دیت شاپ.""",
    "cat-treats-bonnest-catnip-spray-50-l": """اسپری کت‌نیپ بونست برای تشویق بازی و کنجکاوی. روی موش پارچه‌ای یا تونل بزن و بگذار گربه خودش کشف کند.

زیاده‌روی بو را بی‌اثر می‌کند. اگر گربه بی‌تفاوت بود چند روز فاصله بده.

۵۰ میلی‌لیتر. خوراکی نیست.

• کت‌نیپ اسپری بونست
• ۵۰ میلی‌لیتر
• تقویت بازی
• کم بزن، زیاد تکرار نکن
• خوراکی نیست

— پت دیت شاپ.""",
    "cat-treats-cat-grass-theething-stick-30-g": """اسنک جویدنی با طعم مرغ و حس علف گربه؛ برای گربه‌هایی که دوست دارند چیزی بجوند و مشغول شوند.

تکه کوچک بده و آب در دسترس باشد. اگر استفراغ بعد جویدن دیدی قطع کن و با دامپزشک حرف بزن.

بسته ۳۰ گرم. وعده اصلی نیست.

• اسنک علف‌گربه / طعم مرغ
• ۳۰ گرم
• برای مشغول‌کردن جویدن
• تکه کوچک شروع کن
• جایگزین غذای کامل نیست

— پت دیت شاپ.""",
    "cat-treats-bonnest-cat-nip-powder-20g-20-g": """پودر کت‌نیپ برای پاشیدن روی اسباب‌بازی، کارتُن و اسکرچر. کنترل‌شده‌تر از اسپری برای بعضی صاحبان.

نوک قاشق کافی است. روی غذای اصلی نپاش مگر دامپزشک گفته باشد.

بسته ۲۰ گرم. خشک و دربسته نگه دار.

• پودر کت‌نیپ ۲۰ گرم
• برند بونست
• برای اسباب‌بازی و اسکرچر
• مقدار کم
• دربسته نگهداری شود

— پت دیت شاپ.""",
    "cat-treats-chicken-cat-grass-treat-30-g": """تشویقی جویدنی علف‌گربه با طعم مرغ؛ گزینه دوم کنار اسنک مشابه برای تنوع طعم و بافت.

مثل هر تشویقی از وعده کم کن. برای گربه‌های حریص تکه را خرد کن.

۳۰ گرم. درمان گلوله مو تضمینی نیست.

• تشویقی علف‌گربه طعم مرغ
• ۳۰ گرم
• تنوع بافت جویدنی
• از کالری روزانه کم کن
• تضمین درمانی ندارد

— پت دیت شاپ.""",
    "dog-toys-enjoy-the-meal-puzzle-toy": """پازل غذایی AFP؛ سگ باید قطعه را جابه‌جا کند تا به تشویقی برسد. برای روزهای بارانی و سگ‌های باهوش خسته‌کننده است (به معنی خوب).

سختی را از آسان شروع کن تا ناامید نشود. زیر نظر باشد.

تشویقی را در سهم روزانه حساب کن.

• پازل غذایی AFP
• تقویت تمرکز و آرامش
• شروع از سطح آسان
• بازی نظارت‌شده
• کالری تشویقی را کم کن

— پت دیت شاپ.""",
    "dog-toys-ufo-treat-dispenser-dog-toy": """اسباب‌بازی فکری سفینه‌ای AFP که با حرکت سگ تشویقی را کم‌کم رها می‌کند. مغز را درگیر می‌کند تا کمتر از سر حوصله گاز بگیرد.

تشویقی خشک کوچک داخلش بگذار؛ خیس و چسبناک گیر می‌کند. زیر نظر بازی کند تا نشکند و تکه نبلعد.

بعد بازی خالی و بشوی.

• جایزه‌دهنده / فکری
• برند AFP
• مناسب کاهش حوصلگی
• تشویقی خشک کوچک
• بازی زیر نظر

— پت دیت شاپ.""",
    "dog-toys-crab-silicone-dog-chew-toothbrush-toy": """جویدنی سیلیکونی به شکل خرچنگ برای گاز سبک و ماساژ لثه. برای سگ‌های مخرب سنگین ممکن است زود پاره شود.

اگر تکه‌تکه شد جمع کن. جای مسواک واقعی نیست.

بعد بازی بشوی.

• سیلیکون طرح خرچنگ
• ماساژ لثه / گاز سبک
• نه برای جویدن‌کننده‌های خیلی قوی
• شست‌وشو بعد بازی
• جای مسواک دامپزشکی نیست

— پت دیت شاپ.""",
    "dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy": """عروسک پولیشی هندوانه با صدای جیرجیر برای بازی سبک داخل خانه. مناسب سگ‌های کوچک و متوسط که گاز مخرب سنگین ندارند.

اگر پاره شد جمع کن تا الیاف نبلعد. جایزه خوراکی نیست؛ زیر نظر بازی کند.

شست‌وشوی سطحی بعد بازی.

• پولیش هندوانه صدا‌دار
• برند لونا
• بازی سبک خانگی
• نه برای جویدن‌کننده‌های خیلی قوی
• جمع کن اگر پاره شد

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

export const SHOP_BATCH_MULTI_WAVE2_PRODUCTS: ShopProduct[] = [
{blocks}
];
"""
    dest = ROOT / "packages/web/src/data/shopBatchMultiWave2Products.ts"
    dest.write_text(text)


def write_api() -> None:
    blocks = "\n".join(api_block(p) for p in PRODUCTS)
    text = f"""/**
 * PetDate shop Batch-multi wave 2/5 — 10 live SKUs (p260–p269).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 * Gallery cache-bust is batch-multi-w2-v4 (wave 1 stays on batch-multi-w1-v1).
 */
import {{ getDb }} from '../db';
import {{ withShopImagesParam }} from './shop-product-images';
import {{ HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE2_SLUGS }} from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_WAVE2_CACHE_BUST = {ts_string(CACHE_BUST)};

function multiGallery(slug: string): {{ image: string; images: string[] }} {{
  const images = [
    `${{P}}/${{slug}}.jpg?v=${{SHOP_BATCH_MULTI_WAVE2_CACHE_BUST}}`,
    `${{P}}/${{slug}}-2.jpg?v=${{SHOP_BATCH_MULTI_WAVE2_CACHE_BUST}}`,
    `${{P}}/${{slug}}-3.jpg?v=${{SHOP_BATCH_MULTI_WAVE2_CACHE_BUST}}`,
  ];
  return {{ image: images[0]!, images }};
}}

export type ShopBatchMultiWave2Product = {{
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_WAVE2_SLUGS)[number];
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
    slug: 'dog-treats',
    labelFa: 'تشویقی و مکمل غذایی سگ',
    petType: 'dog',
    description: 'تشویقی، اسنک و مکمل',
    emoji: '🍖',
    sortOrder: 30,
  }},
  {{
    slug: 'cat-treats',
    labelFa: 'تشویقی گربه و مکمل غذایی',
    petType: 'cat',
    description: 'تشویقی، بستنی و مکمل',
    emoji: '🍦',
    sortOrder: 40,
  }},
  {{
    slug: 'dog-toys',
    labelFa: 'اسباب بازی سگ',
    petType: 'dog',
    description: 'توپ، لاتکس و اسباب‌بازی تعاملی',
    emoji: '🎾',
    sortOrder: 50,
  }},
] as const;

function row(
  partial: Omit<
    ShopBatchMultiWave2Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {{
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }}
): ShopBatchMultiWave2Product {{
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

export const SHOP_BATCH_MULTI_WAVE2_PRODUCTS: ShopBatchMultiWave2Product[] = [
{blocks}
];

export {{ SHOP_BATCH_MULTI_WAVE2_SLUGS }};

export function seedShopBatchMultiWave2Products(): number {{
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
  for (const p of SHOP_BATCH_MULTI_WAVE2_PRODUCTS) {{
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
    dest = ROOT / "packages/api/src/data/shop-batch-multi-wave2-products.ts"
    dest.write_text(text)


def write_price_index() -> None:
    path = ROOT / "packages/api/src/data/shop-price-index.json"
    existing = json.loads(path.read_text())
    keep = [
        row
        for row in existing
        if str(row.get("id", "")).startswith("p") and 221 <= int(str(row["id"])[1:]) <= 259
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
    dest = ROOT / "tmp/cache-bust-shop-batch-multi-w2-v4"
    dest.write_text(f"{CACHE_BUST}\n")


def main() -> None:
    missing = [p["slug"] for p in PRODUCTS if p["slug"] not in DESCRIPTIONS]
    if missing:
        raise SystemExit(f"missing descriptions: {missing}")
    if [p["proposedId"] for p in PRODUCTS] != [f"p{i}" for i in range(260, 270)]:
        raise SystemExit("wave 2 ids must be p260–p269 in order")
    if CACHE_BUST != "batch-multi-w2-v4":
        raise SystemExit("wave 2 cache bust must be batch-multi-w2-v4")
    write_web()
    write_api()
    write_price_index()
    write_cache_bust()
    print(f"generated {len(PRODUCTS)} wave-2 SKUs cache={CACHE_BUST}")


if __name__ == "__main__":
    main()
