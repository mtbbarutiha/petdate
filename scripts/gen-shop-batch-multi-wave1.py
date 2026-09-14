#!/usr/bin/env python3
"""Generate Batch-multi wave 1/5 catalog (p250–p259 only) from the wave MANIFEST."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "scripts/shop-batch-multi-wave1.json").read_text())
PRODUCTS = MANIFEST["products"]
CACHE_BUST = MANIFEST["cacheBust"]

DESCRIPTIONS: dict[str, str] = {
    "cat-litter-mr-cat-cat-litter-10-l-carbon": """خاک گربه با کربن فعال برای کنترل بو در خانه‌های آپارتمانی. مناسب کسی که می‌خواهد بعد از هر بار استفاده بوی تند نماند.

کربن کمک می‌کند بو کمتر پخش شود؛ معجزه صفر بو نیست. لایه کافی در ظرف بگذار و گلوله را روزانه جمع کن تا خاک دیرتر عوض شود. برای چند گربه ممکن است زودتر تمام شود.

دور از رطوبت نگه دار. اگر گربه‌ات خاک عطری را دوست ندارد، مدل بدون اسانس را امتحان کن.

• خاک گربه با کربن برای کنترل بو
• بسته حدود ۱۰ لیتری
• جمع روزانه گلوله توصیه می‌شود
• مناسب خانه آپارتمانی
• برند مستر کت

— پت دیت شاپ.""",
    "cat-litter-mr-cat-baby-powder-scented-cat-litter-10l-10-kg": """خاک خوش‌بو با رایحه پودر بچه برای کسانی که بوی خاک معمولی را نمی‌پسندند. حجم ۱۰ لیتری برای پر کردن یک ظرف استاندارد.

رایحه تند نیست ولی بعضی گربه‌های حساس خاک معطر را رد می‌کنند — اگر دیدی کنار ظرف می‌نشیند، مدل بدون اسانس بهتر است. گلوله‌زنی خوب یعنی تعویض کمتر.

در جای خشک نگه دار و بعد از باز شدن در کیسه را ببند.

• رایحه پودر بچه
• حجم حدود ۱۰ لیتر
• گلوله‌زنی برای جمع آسان
• برند مستر کت
• اگر گربه معطر را رد کرد مدل ساده بگیر

— پت دیت شاپ.""",
    "cat-litter-meocat-activated-carbon-cat-litter-economy": """نسخه اقتصادی مئوکت با کربن فعال برای کنترل بو، بدون خرج اضافی روی بسته‌های بزرگ لوکس.

برای یک گربه یا بودجه محدود مناسب است. لایه را نازک نگذار؛ کربن وقتی کار می‌کند که خاک به اندازه باشد. روزانه گلوله را بردار.

جایگزین شست‌وشوی ظرف نیست — ظرف را گاه‌به‌گاه بشوی.

• کربن فعال برای بو
• خط اقتصادی مئوکت
• مناسب مصرف روزمره
• جمع روزانه گلوله
• بدون نام تأمین در کپی مشتری

— پت دیت شاپ.""",
    "cat-litter-mr-cat-oxygen-cat-litter-10-l-10-kg": """خاک ۱۰ لیتری مستر کت مدل اکسیژن برای کنترل بو و مصرف خانگی. انتخاب وسط بین ساده‌های بی‌بو و کربن‌دارهای قوی‌تر.

اگر گربه‌ات خاک خیلی معطر را پس می‌زند این مدل معمولاً ملایم‌تر است. حجم برای یک ظرف متوسط تا چند هفته کافیست بسته به تعداد گربه.

کیسه را بعد باز شدن محکم ببند تا خشک بماند.

• مدل اکسیژن مستر کت
• حدود ۱۰ لیتر
• کنترل بو برای خانه
• گلوله‌زنی روزمره
• نگهداری در جای خشک

— پت دیت شاپ.""",
    "cat-litter-meocat-super-clump-cat-litter-economy": """خاک اقتصادی با گلوله‌زنی قوی — یعنی جمع کردن راحت‌تر و تعویض کمتر نسبت به خاک‌های پودری ساده.

سوپرکلامپ برای کسی است که می‌خواهد هزینه ماهانه را پایین نگه دارد ولی هنوز گلوله سفت داشته باشد. اگر گرد و خاک زیاد اذیتت می‌کند هنگام ریختن آرام بریز.

ظرف را بیش از حد پر نکن؛ گربه جا برای کندن می‌خواهد.

• گلوله‌زنی قوی (سوپرکلامپ)
• خط اقتصادی مئوکت
• جمع آسان‌تر گلوله
• مناسب بودجه روزمره
• هنگام ریختن گرد و خاک را کم کن

— پت دیت شاپ.""",
    "cat-litter-mr-cat-kitten-cat-litter-7l-7-kg": """خاک مخصوص بچه‌گربه با دانه ریزتر و حجم ۷ لیتر — مناسب ظرف کوچک و دوره عادت به خاک.

توله خاک درشت را گاهی قورت می‌دهد یا دوست ندارد؛ دانه ریزتر کمک می‌کند عادت بگیرد. ظرف را در جای خلوت بگذار و اول بارها تشویق کن.

اگر اسهال دارد اول دامپزشک، نه عوض کردن هیجانی برند خاک.

• مخصوص بچه‌گربه
• دانه ریزتر / حجم حدود ۷ لیتر
• برند مستر کت
• مناسب آموزش خاک
• جای خلوت برای ظرف

— پت دیت شاپ.""",
    "dog-treats-afp-chill-out-ice-bone": """استخوان قابل انجماد AFP برای روزهای گرم یا بعد از بازی سنگین. داخلش را با آب یا خوراکی مجاز پر می‌کنی، فریز می‌کنی، بعد می‌دهی سگ بجود.

خنک‌کننده است نه جایگزین آب؛ سگ را بدون سایه در گرما رها نکن. فقط مایعات و خوراکی‌های امن سگ داخلش بریز — نه شکلات و نه استخوان پخته.

بعد از بازی بشوی و خشک کن.

• قابل پر کردن و انجماد
• برند AFP
• مناسب تابستان و آرام‌سازی
• فقط خوراکی امن سگ
• شست‌وشو بعد مصرف

— پت دیت شاپ.""",
    "dog-treats-dr-clauders-pork-filet-strips-80-g": """استریپس فیله خوک برای سگ‌هایی که طعم گوشت قوی دوست دارند. جویدنی نرم‌تر از استخوان خشک؛ خوب برای جایزه میانی پیاده‌روی.

خوک برای بعضی سگ‌ها سنگین است — با مقدار کم شروع کن. بسته ۸۰ گرم. غذای اصلی نیست.

دور از رطوبت نگه دار.

• فیله استریپس خوک
• ۸۰ گرم
• برند دکتر کلادرز
• شروع با تکه کوچک
• تشویقی نه وعده اصلی

— پت دیت شاپ.""",
    "dog-treats-rabbit-fillet-dr-clauders-80-g": """نوار فیله خرگوش خشک‌شده با پری‌بیوتیک؛ تشویقی گوشتی برای آموزش و جایزه کوچک.

از سهم کالری روزانه کم کن تا وزن نپرد. اگر آلرژی پروتئینی دارد با دامپزشک هماهنگ کن. بسته ۸۰ گرم برای تشویقی‌های کوتاه مناسب است نه وعده اصلی.

جایگزین غذای کامل نیست.

• فیله خرگوش خشک
• بسته ۸۰ گرم
• برند دکتر کلادرز
• مناسب آموزش و جایزه
• از کالری روزانه کم کن

— پت دیت شاپ.""",
    "dog-treats-wanpy-toothbrush-chews-100g": """تشویقی شکل مسواک با طعم مرغ؛ با جویدن به سایش سطحی دندان کمک می‌کند. جای مسواک و جرم‌گیری دامپزشکی را نمی‌گیرد.

مراقب توله و سگ‌های بلعنده عجول باش — تکه بزرگ را نصف کن. بسته ۱۰۰ گرم.

اگر دندان لق یا درد دهان دارد اول کلینیک.

• شکل مسواک / طعم مرغ
• ۱۰۰ گرم
• برند ونپی
• کمک به سایش سطحی — نه درمان لثه
• برای بلع عجول نصف کن

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
    return f",\n    weight: {ts_string(label)}"


def web_params(p: dict) -> str:
    suitable = "سگ" if "dog" in p["petTypes"] else "گربه"
    parts = [f'      مناسب_برای: {ts_string(suitable)},']
    label = (p.get("weightLabel") or "").strip()
    kind = p.get("weightKind") or ""
    if label and kind == "model":
        parts.insert(0, f"      مدل: {ts_string(label)},")
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

export const SHOP_BATCH_MULTI_PRODUCTS: ShopProduct[] = [
{blocks}
];
"""
    dest = ROOT / "packages/web/src/data/shopBatchMultiProducts.ts"
    dest.write_text(text)


def write_api() -> None:
    blocks = "\n".join(api_block(p) for p in PRODUCTS)
    text = f"""/**
 * PetDate shop Batch-multi wave 1/5 — 10 live SKUs (p250–p259).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 */
import {{ getDb }} from '../db';
import {{ withShopImagesParam }} from './shop-product-images';
import {{ HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_SLUGS }} from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_CACHE_BUST = {ts_string(CACHE_BUST)};

function multiGallery(slug: string): {{ image: string; images: string[] }} {{
  const images = [
    `${{P}}/${{slug}}.jpg?v=${{SHOP_BATCH_MULTI_CACHE_BUST}}`,
    `${{P}}/${{slug}}-2.jpg?v=${{SHOP_BATCH_MULTI_CACHE_BUST}}`,
    `${{P}}/${{slug}}-3.jpg?v=${{SHOP_BATCH_MULTI_CACHE_BUST}}`,
  ];
  return {{ image: images[0]!, images }};
}}

export type ShopBatchMultiProduct = {{
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_SLUGS)[number];
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
    slug: 'cat-litter',
    labelFa: 'لوازم دستشویی گربه',
    petType: 'cat',
    description: 'خاک، سینی و بیلچه',
    emoji: '🚽',
    sortOrder: 70,
  }},
  {{
    slug: 'dog-treats',
    labelFa: 'تشویقی و مکمل غذایی سگ',
    petType: 'dog',
    description: 'تشویقی، اسنک و مکمل',
    emoji: '🍖',
    sortOrder: 30,
  }},
] as const;

function row(
  partial: Omit<
    ShopBatchMultiProduct,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {{
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }}
): ShopBatchMultiProduct {{
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

export const SHOP_BATCH_MULTI_PRODUCTS: ShopBatchMultiProduct[] = [
{blocks}
];

export {{ SHOP_BATCH_MULTI_SLUGS }};

export function seedShopBatchMultiProducts(): number {{
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
  for (const p of SHOP_BATCH_MULTI_PRODUCTS) {{
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
    dest = ROOT / "packages/api/src/data/shop-batch-multi-products.ts"
    dest.write_text(text)


def write_price_index() -> None:
    path = ROOT / "packages/api/src/data/shop-price-index.json"
    existing = json.loads(path.read_text())
    keep = [row for row in existing if str(row.get("id", "")).startswith("p") and 221 <= int(str(row["id"])[1:]) <= 249]
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
    old = ROOT / "tmp/cache-bust-shop-batch-multi-v1"
    if old.exists():
        old.unlink()
    dest = ROOT / "tmp/cache-bust-shop-batch-multi-w1-v1"
    dest.write_text(f"{CACHE_BUST}\n")


def main() -> None:
    missing = [p["slug"] for p in PRODUCTS if p["slug"] not in DESCRIPTIONS]
    if missing:
        raise SystemExit(f"missing descriptions: {missing}")
    if [p["proposedId"] for p in PRODUCTS] != [f"p{i}" for i in range(250, 260)]:
        raise SystemExit("wave 1 ids must be p250–p259 in order")
    write_web()
    write_api()
    write_price_index()
    write_cache_bust()
    print(f"generated {len(PRODUCTS)} wave-1 SKUs cache={CACHE_BUST}")


if __name__ == "__main__":
    main()
