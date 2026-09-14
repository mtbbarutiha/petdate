#!/usr/bin/env python3
"""Generate Batch-multi Part 1 catalog/seed files from the authoritative MANIFEST."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "scripts/shop-batch-multi-part1.json").read_text())
PRODUCTS = MANIFEST["products"]

# Exact MANIFEST copy, trailing --- stripped to match Batch 2 style.
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
    "dog-treats-rabbit-fillet-dr-clauders-80-g": """نوار فیله خرگوش خشک‌شده با پری‌بیوتیک؛ تشویقی گوشتی برای آموزش و جایزه کوچک.

از سهم کالری روزانه کم کن تا وزن نپرد. اگر آلرژی پروتئینی دارد با دامپزشک هماهنگ کن. بسته ۸۰ گرم برای تشویقی‌های کوتاه مناسب است نه وعده اصلی.

جایگزین غذای کامل نیست.

• فیله خرگوش خشک
• بسته ۸۰ گرم
• برند دکتر کلادرز
• مناسب آموزش و جایزه
• از کالری روزانه کم کن

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
    "dog-treats-wanpy-toothbrush-chews-100g": """تشویقی شکل مسواک با طعم مرغ؛ با جویدن به سایش سطحی دندان کمک می‌کند. جای مسواک و جرم‌گیری دامپزشکی را نمی‌گیرد.

مراقب توله و سگ‌های بلعنده عجول باش — تکه بزرگ را نصف کن. بسته ۱۰۰ گرم.

اگر دندان لق یا درد دهان دارد اول کلینیک.

• شکل مسواک / طعم مرغ
• ۱۰۰ گرم
• برند ونپی
• کمک به سایش سطحی — نه درمان لثه
• برای بلع عجول نصف کن

— پت دیت شاپ.""",
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

رنگ قرمز طبق وریانت. بعد بازی بشوی.

• سیلیکون طرح خرچنگ
• ماساژ لثه / گاز سبک
• نه برای جویدن‌کننده‌های خیلی قوی
• شست‌وشو بعد بازی
• جای مسواک دامپزشکی نیست

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
    "cat-toys-petopoli-4-way-foldable-cat-play-tunnel": """تونل تاشو چهارراه برای دویدن و کمین؛ انرژی گربه آپارتمانی را خالی می‌کند بدون اینکه مبل قربانی شود.

روی سطح لغزنده فیکس کن. اگر چند گربه دارید اول جداگانه معرفی کنید تا دعوا سر ورودی نشود.

جمع‌شو برای خانه کوچک.

• تونل چهارراه تاشو
• برند پتوپولی
• تخلیه انرژی داخل خانه
• رنگ قرمز وریانت
• معرفی آرام به چند گربه

— پت دیت شاپ.""",
    "cat-toys-cat-toy-layer-tower-of-tracks": """برج توپ و لایه با پر؛ گربه توپ را دنبال می‌کند و گاه‌به‌گاه به پر حمله می‌کند. مناسب میز و کنج خلوت.

باتری/قطعه متحرک اگر داشت را از دستور ساخت چک کن. زیر نظر توله تا قطعه نبلعد.

سبز طبق وریانت.

• برج طبقاتی + پر
• دنبال کردن توپ
• مناسب خانه کوچک
• نظارت روی توله
• وریانت سبز

— پت دیت شاپ.""",
    "cat-toys-hanging-catnip-bat-toy-for-cats": """خفاش آویز با کت‌نیپ برای حمله از در و قفسه. نصب محکم؛ اگر بیفتد بازی تمام است و ممکن است پاره شود.

کت‌نیپ داخلش بو را زنده نگه می‌دارد. نخ و قطعات کوچک را چک کن.

سبز / جویسر.

• آویز خفاش + کت‌نیپ
• نصب محکم
• تقویت شکار خانگی
• برند جویسر
• ایمنی نخ و قطعه

— پت دیت شاپ.""",
    "cat-toys-little-yellow-cat-toy": """تعادل‌کننده تشویقی‌خور طرح جوجه اردک؛ گربه باید حرکت بدهد تا جایزه برسد. نسخه گربه‌ای پازل نرم.

تشویقی خشک ریز بریز. آبی طبق وریانت.

زیر نظر اگر پلاستیک جویده شد.

• تشویقی‌خور تعادلی
• طرح جوجه اردک
• تقویت بازی فکری
• تشویقی خشک ریز
• وریانت آبی

— پت دیت شاپ.""",
    "cat-toys-play-tunnel-bag": """کیسه/تونل نرم برای قایم‌باشک؛ جایگزین سبک تونل سفت در خانه خیلی کوچک.

بعد بازی جمع کن تا زمین‌گیر نشود. اگر گربه داخلش ادرار کرد طبق پارچه بشوی.

سبز پتوپولی.

• کیسه بازی تاشو
• برند پتوپولی
• قایم‌باشک خانگی
• جمع بعد بازی
• قابل شست‌وشو در حد پارچه

— پت دیت شاپ.""",
    "cat-toys-automatic-cat-teaser-ball-robotic-toy-for-cats": """توپ حرکتی خودکار برای وقتی خودت حوصله میله پر نداری. روی سطح صاف بهتر کار می‌کند.

باتری را چک کن و شب خاموش بگذار تا گربه نخوابد. زیر نظر اولین جلسه‌ها.

آبی روشن.

• توپ رباتیک خودکار
• تخلیه انرژی بدون میله
• سطح صاف
• خاموش کردن بین بازی
• اولین بار نظارت

— پت دیت شاپ.""",
}


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def ts_price(n: int) -> str:
    return f"{n:_}"


def param_lines(p: dict, indent: str) -> str:
    kind = p.get("paramKind") or ""
    label = (p.get("weightLabel") or "").strip()
    suitable = "سگ" if p["petTypes"] == ["dog"] else "گربه"
    rows: list[tuple[str, str]] = []
    if kind == "weight" and label:
        rows.append(("وزن", label))
    elif kind == "color" and label:
        rows.append(("رنگ", label))
    elif kind == "model" and label:
        rows.append(("مدل", label))
    rows.append(("مناسب_برای", suitable))
    inner = ",\n".join(f'{indent}  {k}: {ts_string(v)}' for k, v in rows)
    return f"{{\n{inner},\n{indent}}}"


def web_block(p: dict) -> str:
    desc = DESCRIPTIONS[p["slug"]]
    pets = ", ".join(ts_string(t) for t in p["petTypes"])
    return f"""  product({{
    id: {ts_string(p["id"])},
    slug: {ts_string(p["slug"])},
    title: {ts_string(p["title"])},
    titleEn: {ts_string(p["titleEn"])},
    brandId: {ts_string(p["brandId"])},
    categorySlug: {ts_string(p["categorySlug"])},
    petTypes: [{pets}],
    priceToman: {ts_price(p["priceToman"])},
    params: {param_lines(p, "    ")},
    description:
      {ts_string(desc)},
  }}),"""


def api_block(p: dict) -> str:
    desc = DESCRIPTIONS[p["slug"]]
    pets = ", ".join(ts_string(t) for t in p["petTypes"])
    kind = p.get("paramKind") or ""
    label = (p.get("weightLabel") or "").strip()
    extra = ""
    if kind == "weight" and label:
        extra = f',\n    weight: {ts_string(label)}'
    elif kind == "color" and label:
        extra = f',\n    color: {ts_string(label)}'
    elif kind == "model" and label:
        extra = f',\n    model: {ts_string(label)}'
    return f"""  row({{
    id: {ts_string(p["id"])},
    slug: {ts_string(p["slug"])},
    title: {ts_string(p["title"])},
    titleEn: {ts_string(p["titleEn"])},
    brandId: {ts_string(p["brandId"])},
    categorySlug: {ts_string(p["categorySlug"])},
    petTypes: [{pets}],
    priceToman: {ts_price(p["priceToman"])}{extra},
    description:
      {ts_string(desc)},
  }}),"""


def write_web() -> None:
    blocks = "\n".join(web_block(p) for p in PRODUCTS)
    text = f"""import type {{ ShopProduct }} from './shopCatalog';

const P = '/pepito/uploads';
const V = 'batch-multi-v1';

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
    slugs = ",\n  ".join(ts_string(p["slug"]) for p in PRODUCTS)
    blocks = "\n".join(api_block(p) for p in PRODUCTS)
    text = f"""/**
 * PetDate shop Batch-multi Part 1 — 25 live SKUs (p250–p274).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 */
import {{ getDb }} from '../db';
import {{ withShopImagesParam }} from './shop-product-images';
import {{ HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_SLUGS }} from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_CACHE_BUST = 'batch-multi-v1';

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
  {{
    slug: 'cat-toys',
    labelFa: 'اسباب بازی گربه',
    petType: 'cat',
    description: 'موش، میله و اسباب‌بازی',
    emoji: '🐭',
    sortOrder: 60,
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
  }}
): ShopBatchMultiProduct {{
  const suitable = partial.petTypes.includes('dog') ? 'سگ' : 'گربه';
  const params: Record<string, string> = {{
    مناسب_برای: suitable,
    __titleEn: partial.titleEn,
  }};
  if (partial.weight) params['وزن'] = partial.weight;
  if (partial.color) params['رنگ'] = partial.color;
  if (partial.model) params['مدل'] = partial.model;
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

export const SHOP_BATCH_MULTI_PRICE_INDEX = SHOP_BATCH_MULTI_PRODUCTS.map((p) => ({{
  id: p.id,
  slug: p.slug,
  title: p.title,
  brandId: p.brandId,
  categorySlug: p.categorySlug,
  priceToman: p.priceToman,
}}));

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
    del slugs  # slugs live in shop-zero-margin-slugs.ts


def write_price_index() -> None:
    path = ROOT / "packages/api/src/data/shop-price-index.json"
    existing = json.loads(path.read_text())
    seen = {row["id"] for row in existing}
    for p in PRODUCTS:
        if p["id"] in seen:
            continue
        existing.append(
            {
                "id": p["id"],
                "slug": p["slug"],
                "title": p["title"],
                "brandId": p["brandId"],
                "categorySlug": p["categorySlug"],
                "priceToman": p["priceToman"],
            }
        )
    path.write_text(json.dumps(existing, ensure_ascii=False, separators=(",", ":")) + "\n")


def main() -> None:
    missing = [p["slug"] for p in PRODUCTS if p["slug"] not in DESCRIPTIONS]
    if missing:
        raise SystemExit(f"missing descriptions: {missing}")
    write_web()
    write_api()
    write_price_index()
    print(f"generated {len(PRODUCTS)} batch-multi SKUs")


if __name__ == "__main__":
    main()
