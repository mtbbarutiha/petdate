#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PetDate investor feasibility PDF (FA, RTL) — events + SS 23% + tax 25% + screenshots."""
from __future__ import annotations

import math
import shutil
from pathlib import Path

from weasyprint import HTML

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
SHOTS = ASSETS / "shots"
ARTIFACTS = ROOT.parent

# ── Brand (teal / navy / coral — no purple) ───────────────────────────
NAVY = "#12263a"
NAVY2 = "#1a3a52"
TEAL = "#0f766e"
TEAL_LT = "#14b8a6"
TEAL_DK = "#0d5c56"
CORAL = "#e05a45"
CORAL_LT = "#f07168"
SLATE = "#64748b"
INK = "#0f172a"
MINT_BG = "#f0fdfa"
SAND = "#f7faf9"

# ── حقوق ناخالص (تومان/ماه) ───────────────────────────────────────────
PAYROLL = {
    "مدیرعامل / مدیر پروژه": 100_000_000,
    "برنامه‌نویس هوش مصنوعی": 100_000_000,
    "مدیر سوشال‌مدیا": 70_000_000,
    "مدیر مالی": 60_000_000,
    "پشتیبان ۱": 30_000_000,
    "پشتیبان ۲": 30_000_000,
}
PAYROLL_TOTAL = sum(PAYROLL.values())  # 390M

SS_EMPLOYER_RATE = 0.23
INSURANCE_EMPLOYER = int(PAYROLL_TOTAL * SS_EMPLOYER_RATE)  # 89.7M
SS_EMPLOYEE_RATE = 0.07

CORPORATE_TAX_RATE = 0.25
VAT_RATE = 0.10

AI_USD = 400
USD_TOMAN = 220_000
AI_COST = AI_USD * USD_TOMAN  # 88M
RENT = 70_000_000
OPEX = 50_000_000

BURN = PAYROLL_TOTAL + INSURANCE_EMPLOYER + AI_COST + RENT + OPEX  # 687.7M

SETUP = {
    "تجهیزات و لپ‌تاپ (۶ نفر)": 480_000_000,
    "ودیعه دفتر (۲ ماه اجاره)": 140_000_000,
    "ثبت شرکت، حقوقی و مجوزها": 100_000_000,
    "برندینگ و کمپین لانچ": 500_000_000,
    "مبلمان و تجهیز دفتر": 150_000_000,
    "رزرو راه‌اندازی": 130_000_000,
}
SETUP_TOTAL = sum(SETUP.values())  # 1.5B
RUNWAY_MONTHS = 12
RUNWAY = BURN * RUNWAY_MONTHS
BUFFER = int((RUNWAY + SETUP_TOTAL) * 0.08)
CAPITAL_NEED = RUNWAY + SETUP_TOTAL + BUFFER
_HALF_B = 500_000_000
_ASK = int(round(CAPITAL_NEED / _HALF_B) * _HALF_B)
CAPITAL_ASK = _ASK if _ASK >= CAPITAL_NEED else _ASK + _HALF_B  # → 11B
ASK_MONTHS = CAPITAL_ASK / BURN

# ── اقتصاد سکه و ایونت ────────────────────────────────────────────────
COIN_TOMAN = 2_000
EVENT_JOIN_FEE_COINS = 2  # فرض استاندارد عضویت
EVENT_CREATE_COST_COINS = 100  # sink پلتفرم (کد محصول)
# مدل درآمد ایونت در این طرح:
# ایونت‌های پلتفرمی / ویژه‌شده → ۱۰۰٪ هزینه عضویت به خزانه پت‌دیت
# (ایونت میزبان‌محور ممکن است بعداً کارمزد ۲۰–۳۰٪ بگیرد؛ pitch روی مدل پلتفرمی است)
PLATFORM_JOIN_TAKE = 1.00


def event_join_toman(n_events: int, avg_attendees: int) -> int:
    coins = n_events * avg_attendees * EVENT_JOIN_FEE_COINS
    return int(coins * COIN_TOMAN * PLATFORM_JOIN_TAKE)


def event_create_toman(n_events: int) -> int:
    return int(n_events * EVENT_CREATE_COST_COINS * COIN_TOMAN)


# مثال‌های عددی برای سند
EVENT_EXAMPLES = [
    {"label": "۵۰ ایونت × ۲۰ نفر × ۲ سکه", "n": 50, "att": 20},
    {"label": "۱۰۰ ایونت × ۳۰ نفر × ۲ سکه", "n": 100, "att": 30},
    {"label": "۲۵۰ ایونت × ۲۵ نفر × ۲ سکه", "n": 250, "att": 25},
    {"label": "۵۰۰ ایونت × ۳۰ نفر × ۲ سکه", "n": 500, "att": 30},
]

SCENARIOS = {
    "بدبینانه": {
        "mau": 8000,
        "pay": 0.035,
        "arpu": 900_000,
        "shop": 80_000_000,
        "consult": 40_000_000,
        "events_n": 100,
        "events_att": 18,
        "be": 16,
        "pb": 28,
    },
    "پایه": {
        "mau": 14000,
        "pay": 0.05,
        "arpu": 1_100_000,
        "shop": 150_000_000,
        "consult": 90_000_000,
        "events_n": 250,
        "events_att": 25,
        "be": 10,
        "pb": 18,
    },
    "خوش‌بینانه": {
        "mau": 25000,
        "pay": 0.06,
        "arpu": 1_300_000,
        "shop": 280_000_000,
        "consult": 160_000_000,
        "events_n": 500,
        "events_att": 30,
        "be": 8,
        "pb": 13,
    },
}
for s in SCENARIOS.values():
    s["coins"] = int(s["mau"] * s["pay"] * s["arpu"])
    s["events_join"] = event_join_toman(s["events_n"], s["events_att"])
    s["events_create"] = event_create_toman(s["events_n"])
    s["events"] = s["events_join"] + s["events_create"]
    s["rev"] = s["coins"] + s["shop"] + s["consult"] + s["events"]
    s["profit_pre"] = s["rev"] - BURN
    s["profit_after"] = int(max(0, s["profit_pre"]) * (1 - CORPORATE_TAX_RATE))

# رمپ پایه (میلیون تومان) — شامل رشد تدریجی ایونت؛ ماه ۱۲ ≈ درآمد پایه
BASE_REV_M = [55, 95, 150, 210, 285, 365, 455, 555, 665, 790, 930, 1085]


def _be_from_ramp(ramp_m: list[int], burn: int) -> int:
    for i, v in enumerate(ramp_m, 1):
        if v * 1_000_000 >= burn:
            return i
    return len(ramp_m)


def _payback_from_ramp(
    ramp_m: list[int],
    burn: int,
    capital: int,
    growth_m: int = 35,
    max_months: int = 48,
) -> int:
    """Cumulative CF from -capital; after ramp, +growth_m M toman/mo on revenue."""
    cum = -float(capital)
    last = ramp_m[-1]
    for i in range(1, max_months + 1):
        if i <= len(ramp_m):
            v = ramp_m[i - 1]
        else:
            last = last + growth_m
            v = last
        cum += v * 1_000_000 - burn
        if cum >= 0:
            return i
    return max_months


BE_BASE = _be_from_ramp(BASE_REV_M, BURN)
PB_BASE = _payback_from_ramp(BASE_REV_M, BURN, CAPITAL_ASK)
SCENARIOS["پایه"]["be"] = BE_BASE
SCENARIOS["پایه"]["pb"] = PB_BASE
# حساسیت: بدبینانه/خوش‌بینانه — تقریبی نسبت به پایه
SCENARIOS["بدبینانه"]["be"] = 16
SCENARIOS["بدبینانه"]["pb"] = min(48, PB_BASE + 8)
SCENARIOS["خوش‌بینانه"]["be"] = 8
SCENARIOS["خوش‌بینانه"]["pb"] = max(BE_BASE, PB_BASE - 10)

# اهرم عملیاتی / HR
HR_PHASES = [
    {
        "phase": "فاز ۱ — لانچ",
        "team": 6,
        "mau": 7_000,
        "note": "تیم کامل؛ پشتیبانی دستی و لانچ",
    },
    {
        "phase": "فاز ۲ — مقیاس",
        "team": 6,
        "mau": 14_000,
        "note": "همان تیم با ≈۲× کاربر؛ پنل ادمین + سلف‌سرویس",
    },
    {
        "phase": "فاز ۳ — اتوماسیون",
        "team": 7,
        "mau": 30_000,
        "note": "ربات/AI بیشتر؛ پشتیبانی نسبی کمتر؛ هزینه/MAU پایین",
    },
]
for p in HR_PHASES:
    p["cost_per_mau"] = int(BURN / p["mau"])


def fmt(n: float | int) -> str:
    return f"{int(round(n)):,}".replace(",", "٬")


def fmt_b(n: float) -> str:
    return f"{n:.2f}".replace(".", "٫")


def uri(path: Path) -> str:
    return path.resolve().as_uri()


# ── SVG charts ─────────────────────────────────────────────────────────
def donut_chart(
    parts: list[tuple[str, int, str]],
    center_top: str,
    center_bot: str,
    size: int = 210,
) -> str:
    total = sum(v for _, v, _ in parts) or 1
    cx = cy = size / 2
    r = size * 0.40
    ri = size * 0.22
    acc = 0.0
    paths: list[str] = []
    legs: list[str] = []
    for label, val, color in parts:
        frac = val / total
        start = acc * 2 * math.pi - math.pi / 2
        acc += frac
        end = acc * 2 * math.pi - math.pi / 2
        large = 1 if frac > 0.5 else 0
        x1, y1 = cx + r * math.cos(start), cy + r * math.sin(start)
        x2, y2 = cx + r * math.cos(end), cy + r * math.sin(end)
        xi1, yi1 = cx + ri * math.cos(end), cy + ri * math.sin(end)
        xi2, yi2 = cx + ri * math.cos(start), cy + ri * math.sin(start)
        paths.append(
            f'<path d="M{x1:.2f},{y1:.2f} A{r},{r} 0 {large} 1 {x2:.2f},{y2:.2f} '
            f'L{xi1:.2f},{yi1:.2f} A{ri},{ri} 0 {large} 0 {xi2:.2f},{yi2:.2f} Z" fill="{color}"/>'
        )
        legs.append(
            f'<div class="leg"><span style="background:{color}"></span>'
            f"<b>{label}</b> · {fmt(val)} "
            f'<em>({frac * 100:.0f}٪)</em></div>'
        )
    return (
        f'<div class="chart-wrap">'
        f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
        + "".join(paths)
        + f'<circle cx="{cx}" cy="{cy}" r="{ri - 2}" fill="#fff"/>'
        + f'<text x="{cx}" y="{cy - 6}" text-anchor="middle" font-size="11" fill="{NAVY}" font-weight="700">{center_top}</text>'
        + f'<text x="{cx}" y="{cy + 12}" text-anchor="middle" font-size="12" fill="{TEAL}" font-weight="700">{center_bot}</text>'
        + "</svg>"
        + '<div class="legs">'
        + "".join(legs)
        + "</div></div>"
    )


def burn_pie() -> str:
    return donut_chart(
        [
            ("حقوق", PAYROLL_TOTAL, NAVY),
            ("بیمه کارفرما", INSURANCE_EMPLOYER, TEAL),
            ("AI API", AI_COST, CORAL),
            ("اجاره", RENT, TEAL_LT),
            ("جاری", OPEX, "#7c9aab"),
        ],
        "برن",
        f"{BURN / 1_000_000:.1f}M".replace(".", "٫"),
    )


def use_of_funds_pie() -> str:
    buffer_ask = CAPITAL_ASK - RUNWAY - SETUP_TOTAL
    return donut_chart(
        [
            ("Runway ۱۲م", RUNWAY, NAVY),
            ("راه‌اندازی", SETUP_TOTAL, TEAL),
            ("بافر + گرد", buffer_ask, CORAL),
        ],
        "سرمایه",
        f"{CAPITAL_ASK / 1e9:.1f}B".replace(".", "٫"),
        size=200,
    )


def revenue_mix_bars(s: dict) -> str:
    items = [
        ("سکه/VIP", s["coins"], NAVY),
        ("پت‌شاپ", s["shop"], TEAL),
        ("مشاوره", s["consult"], CORAL),
        ("ایونت", s["events"], TEAL_LT),
    ]
    mx = max(v for _, v, _ in items) or 1
    rows = []
    for label, val, color in items:
        w = max(4, int(val / mx * 100))
        rows.append(
            f'<div class="hbar">'
            f'<div class="hlab">{label}</div>'
            f'<div class="htrack"><div class="hfill" style="width:{w}%;background:{color}"></div></div>'
            f'<div class="hval">{fmt(val)}</div></div>'
        )
    return '<div class="hbars">' + "".join(rows) + "</div>"


def rev_ramp_svg() -> str:
    burn_m = BURN / 1_000_000
    vals = BASE_REV_M
    w, h = 520, 168
    pad_l, pad_r, pad_t, pad_b = 28, 12, 18, 28
    plot_w = w - pad_l - pad_r
    plot_h = h - pad_t - pad_b
    mx = max(max(vals), burn_m) * 1.08
    n = len(vals)
    gap = 4
    bw = (plot_w - gap * (n - 1)) / n
    bars = []
    for i, v in enumerate(vals):
        x = pad_l + i * (bw + gap)
        bh = v / mx * plot_h
        y = pad_t + plot_h - bh
        color = TEAL if v >= burn_m else TEAL_LT
        bars.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" '
            f'rx="3" fill="{color}"/>'
            f'<text x="{x + bw / 2:.1f}" y="{h - 8}" text-anchor="middle" '
            f'font-size="7.5" fill="{SLATE}">M{i + 1}</text>'
        )
        if i in (0, 5, 9, 11) or v >= burn_m and (i == 0 or vals[i - 1] < burn_m):
            bars.append(
                f'<text x="{x + bw / 2:.1f}" y="{y - 3:.1f}" text-anchor="middle" '
                f'font-size="7" fill="{NAVY}" font-family="DejaVu Sans">{int(v)}</text>'
            )
    by = pad_t + plot_h - (burn_m / mx * plot_h)
    return (
        f'<svg class="ramp" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<line x1="{pad_l}" y1="{by:.1f}" x2="{w - pad_r}" y2="{by:.1f}" '
        f'stroke="{CORAL}" stroke-width="1.6" stroke-dasharray="5 4"/>'
        f'<text x="{pad_l}" y="{by - 4:.1f}" font-size="8" fill="{CORAL}">برن ≈ {burn_m:.0f}M</text>'
        + "".join(bars)
        + "</svg>"
    )


def shot(name: str, caption: str, cls: str = "") -> str:
    p = SHOTS / name
    if not p.exists():
        return ""
    return (
        f'<figure class="shot {cls}">'
        f'<img src="{uri(p)}" alt=""/>'
        f"<figcaption>{caption}</figcaption></figure>"
    )


def build_html() -> str:
    logo = uri(ASSETS / "petdate-mark.png")
    banner = uri(ASSETS / "petdate-banner.jpg")
    payroll_rows = "".join(
        f"<tr><td>{k}</td><td class='n'>{fmt(v)}</td></tr>" for k, v in PAYROLL.items()
    )
    setup_rows = "".join(
        f"<tr><td>{k}</td><td class='n'>{fmt(v)}</td></tr>" for k, v in SETUP.items()
    )
    scen_rows = "".join(
        f"<tr><td>{name}</td><td class='n'>{fmt(s['mau'])}</td>"
        f"<td class='n'>{fmt(s['events'])}</td>"
        f"<td class='n'>{fmt(s['rev'])}</td>"
        f"<td class='n'>{fmt(s['profit_pre'])}</td>"
        f"<td class='n'>{fmt(s['profit_after'])}</td>"
        f"<td class='n'>{s['be']}</td><td class='n'>{s['pb']}</td></tr>"
        for name, s in SCENARIOS.items()
    )
    use = [
        ("عملیات ۱۲ ماه (Runway)", RUNWAY),
        ("راه‌اندازی یک‌باره", SETUP_TOTAL),
        ("بافر + گرد کردن پیشنهاد", CAPITAL_ASK - RUNWAY - SETUP_TOTAL),
    ]
    use_rows = "".join(
        f"<tr><td>{k}</td><td class='n'>{fmt(v)}</td>"
        f"<td class='n'>{v / CAPITAL_ASK * 100:.0f}٪</td></tr>"
        for k, v in use
    )
    event_ex_rows = "".join(
        f"<tr><td>{ex['label']}</td>"
        f"<td class='n'>{fmt(ex['n'] * ex['att'] * EVENT_JOIN_FEE_COINS)}</td>"
        f"<td class='n'>{fmt(event_join_toman(ex['n'], ex['att']))}</td></tr>"
        for ex in EVENT_EXAMPLES
    )
    hr_rows = "".join(
        f"<tr><td>{p['phase']}</td><td class='n'>{p['team']}</td>"
        f"<td class='n'>{fmt(p['mau'])}</td>"
        f"<td class='n'>{fmt(p['cost_per_mau'])}</td>"
        f"<td>{p['note']}</td></tr>"
        for p in HR_PHASES
    )
    base = SCENARIOS["پایه"]
    labor_share = (PAYROLL_TOTAL + INSURANCE_EMPLOYER) / BURN * 100
    join_unit = EVENT_JOIN_FEE_COINS * COIN_TOMAN

    return f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>طرح توجیهی پت‌دیت</title>
<style>
  @page {{ size: A4; margin: 12mm 11mm 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: "Noto Naskh Arabic", "Noto Sans Arabic", "DejaVu Sans", sans-serif;
    color:{INK}; font-size:10pt; line-height:1.62;
    background: {SAND};
  }}
  h1 {{ font-size:20pt; color:{NAVY}; margin:0 0 .35em; }}
  h2 {{
    font-size:13pt; color:{TEAL_DK}; margin:1.15em 0 .45em;
    padding-bottom:5px; border-bottom:2.5px solid {TEAL_LT};
  }}
  h3 {{ font-size:10.5pt; color:{NAVY2}; margin:.9em 0 .35em; }}
  p {{ margin:.35em 0 .6em; }}
  table {{ width:100%; border-collapse:collapse; margin:.5em 0 .85em; font-size:9pt; }}
  th, td {{ border-bottom:1px solid #dce5ec; padding:6px 7px; text-align:right; }}
  th {{ background:{MINT_BG}; color:{TEAL_DK}; font-weight:700; }}
  tr:nth-child(even) td {{ background:#fbfdfe; }}
  td.n, th.n {{ text-align:left; direction:ltr; font-family: DejaVu Sans, sans-serif; font-size:8.5pt; }}
  tr.tfoot td {{ font-weight:700; background:#e6f7f4 !important; }}
  ul.t {{ margin:.15em 0 .7em; padding-right:1.05em; }}
  ul.t li {{ margin:.12em 0; }}

  .cover {{
    page-break-after: always; border-radius:18px; overflow:hidden;
    background:
      radial-gradient(ellipse at 15% 20%, rgba(20,184,166,.35), transparent 50%),
      radial-gradient(ellipse at 90% 80%, rgba(224,90,69,.28), transparent 45%),
      linear-gradient(160deg, {NAVY} 0%, {NAVY2} 42%, {TEAL_DK} 100%);
    color:#ecfdf5; padding:16mm 13mm 12mm; min-height:255mm;
    position: relative;
  }}
  .cover::after {{
    content:""; position:absolute; inset:auto 0 0 0; height:6px;
    background: linear-gradient(90deg, {TEAL_LT}, {CORAL});
  }}
  .cover img.logo {{
    width:72px; height:72px; object-fit:contain; background:#fff;
    border-radius:16px; padding:8px; box-shadow:0 8px 24px rgba(0,0,0,.25);
  }}
  .cover img.banner {{
    width:100%; max-height:92px; object-fit:cover; border-radius:12px;
    margin-top:14px; border:1px solid rgba(255,255,255,.18);
  }}
  .eyebrow {{ font-size:8.5pt; letter-spacing:.02em; opacity:.88; margin-top:16px; }}
  .cover h1 {{ color:#fff; font-size:24pt; margin-top:4px; line-height:1.35; }}
  .tag {{ font-size:10.5pt; opacity:.93; max-width:94%; }}
  .kpis {{ display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:18px; }}
  .kpi {{
    background:rgba(255,255,255,.11); border:1px solid rgba(255,255,255,.2);
    border-radius:12px; padding:11px 12px; backdrop-filter: blur(2px);
  }}
  .kpi .l {{ font-size:8pt; opacity:.85; }}
  .kpi .v {{ font-size:12.5pt; font-weight:700; margin-top:2px; }}
  .cfoot {{ margin-top:22px; font-size:8pt; opacity:.78; }}

  .callout {{
    background:{MINT_BG}; border-right:4px solid {TEAL}; border-radius:10px;
    padding:9px 11px; margin:8px 0 12px;
  }}
  .warn {{ background:#fff7ed; border-right-color:{CORAL}; }}
  .coral {{ background:#fff5f3; border-right-color:{CORAL}; }}
  .hl {{ color:{TEAL_DK}; font-weight:700; }}
  .muted {{ color:{SLATE}; font-size:8.5pt; }}
  .grid2 {{ display:grid; grid-template-columns:1.05fr .95fr; gap:12px; align-items:start; }}
  .grid3 {{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }}
  .card {{
    background:#fff; border:1px solid #d8e4ea; border-radius:12px; padding:11px;
    box-shadow: 0 1px 0 rgba(18,38,58,.04);
  }}
  .card h3 {{ margin-top:0; }}
  .legs {{ margin-top:6px; }}
  .leg {{ font-size:8pt; margin:3px 0; display:flex; gap:7px; align-items:center; }}
  .leg span {{ width:10px; height:10px; border-radius:3px; display:inline-block; flex-shrink:0; }}
  .leg em {{ color:{SLATE}; font-style:normal; }}
  .chart-wrap {{ display:flex; flex-direction:column; align-items:center; }}

  .bmc {{ display:grid; grid-template-columns:repeat(5,1fr); gap:5px; }}
  .bmc .c {{
    background:#fff; border:1px solid #cfdbe3; border-radius:8px; padding:7px;
    font-size:7.5pt; min-height:64px;
  }}
  .bmc .c b {{ display:block; color:{TEAL}; margin-bottom:2px; font-size:8pt; }}
  .bmc .w {{ grid-column: span 2; }}

  .hbars {{ display:flex; flex-direction:column; gap:7px; }}
  .hbar {{ display:grid; grid-template-columns:72px 1fr 78px; gap:6px; align-items:center; }}
  .hlab {{ font-size:8pt; color:{NAVY}; }}
  .htrack {{ background:#e8eef2; border-radius:6px; height:12px; overflow:hidden; }}
  .hfill {{ height:100%; border-radius:6px; }}
  .hval {{ font-size:7.5pt; direction:ltr; text-align:left; font-family:DejaVu Sans,sans-serif; color:{SLATE}; }}

  .shots {{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:8px 0 12px; }}
  .shots.one {{ grid-template-columns:1fr; }}
  .shots.tri {{ grid-template-columns:1.2fr 1fr 0.85fr; }}
  figure.shot {{ margin:0; background:#fff; border:1px solid #d5e0e7; border-radius:10px; overflow:hidden; }}
  figure.shot img {{ width:100%; display:block; max-height:148px; object-fit:cover; object-position:top; }}
  figure.shot.tall img {{ max-height:190px; }}
  figure.shot figcaption {{
    font-size:7.5pt; color:{SLATE}; padding:6px 8px; line-height:1.45;
    border-top:1px solid #e8eef2; background:#fafcfd;
  }}

  .pb {{ page-break-before: always; }}
  .fn {{ font-size:7.5pt; color:{SLATE}; margin-top:.25em; }}
  .badge {{
    display:inline-block; background:{TEAL}; color:#fff; font-size:7.5pt;
    padding:2px 8px; border-radius:4px; margin-left:4px;
  }}
  .statrow {{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:8px 0 12px; }}
  .stat {{
    background:#fff; border:1px solid #d5e0e7; border-radius:10px; padding:8px 9px; text-align:center;
  }}
  .stat .v {{ font-size:11pt; font-weight:700; color:{TEAL_DK}; direction:ltr; font-family:DejaVu Sans,sans-serif; }}
  .stat .l {{ font-size:7.5pt; color:{SLATE}; margin-top:2px; }}
</style>
</head>
<body>

<section class="cover">
  <img class="logo" src="{logo}" alt="پت‌دیت"/>
  <div class="eyebrow">سند محرمانه · ویژه سرمایه‌گذار · نسخه ۱٫۳</div>
  <h1>طرح توجیهی سرمایه‌گذاری<br/>پت‌دیت (PetDate)</h1>
  <p class="tag">سوپراپ فارسی پت: همبازی، ایونت، پت‌شاپ و مشاوره دامپزشک —
  وب + ربات تلگرام با اقتصاد سکه یکپارچه و پنل ادمین عملیاتی</p>
  <img class="banner" src="{banner}" alt=""/>
  <div class="kpis">
    <div class="kpi"><div class="l">برن ماهانه (با بیمه کارفرما)</div><div class="v">{fmt(BURN)} تومان</div></div>
    <div class="kpi"><div class="l">سرمایه پیشنهادی</div><div class="v">{fmt(CAPITAL_ASK)} تومان</div></div>
    <div class="kpi"><div class="l">Runway با این سرمایه</div><div class="v">≈ {ASK_MONTHS:.0f} ماه</div></div>
    <div class="kpi"><div class="l">سربه‌سر پایه (با ایونت)</div><div class="v">ماه {base['be']}</div></div>
  </div>
  <div class="cfoot">بیمه کارفرما ۲۳٪ · مالیات عملکرد ۲۵٪ · سکه ≈ {fmt(COIN_TOMAN)} تومان ·
  عضویت ایونت فرض {EVENT_JOIN_FEE_COINS} سکه · دلار AI: {fmt(USD_TOMAN)} تومان<br/>
  اعداد درآمد سناریویی‌اند؛ ترم‌شیت سهام در مذاکره نهایی قفل می‌شود.</div>
</section>

<h2>۱. خلاصه اجرایی</h2>
<p><strong>پت‌دیت</strong> پلتفرم همبازی و خدمات پت در ایران است — با لایه ایونت گروهی، شاپ، و مشاوره روی وب و تلگرام.
این سند نیاز سرمایه برای تیم ۶ نفره، دفتر و رشد ۱۲ ماهه را با <strong>بیمه کارفرما</strong>،
<strong>مالیات عملکرد</strong> و <strong>درآمد ایونت</strong> توجیه می‌کند.</p>
<div class="callout">
<strong>پیشنهاد:</strong> جذب <span class="hl">{fmt(CAPITAL_ASK)} تومان</span>
(≈ {fmt_b(CAPITAL_ASK/1e9)} میلیارد) برای راه‌اندازی + Runway.
برن <strong>{fmt(BURN)}</strong> تومان/ماه.
در سناریو پایه (با ایونت)، سربه‌سر حدود ماه <strong>{base['be']}</strong>
و بازگشت اصل حدود ماه <strong>{base['pb']}</strong>.
</div>
<div class="statrow">
  <div class="stat"><div class="v">{fmt(int(BURN/1e6))}M</div><div class="l">برن ماهانه</div></div>
  <div class="stat"><div class="v">{fmt_b(CAPITAL_ASK/1e9)}B</div><div class="l">سرمایه پیشنهادی</div></div>
  <div class="stat"><div class="v">{fmt(int(base['rev']/1e6))}M</div><div class="l">درآمد پایه م۱۲</div></div>
  <div class="stat"><div class="v">{fmt(int(base['events']/1e6))}M</div><div class="l">سهم ایونت م۱۲</div></div>
</div>

<h2>۲. مسئله، فرصت و محصول</h2>
<ul class="t">
  <li>بازار بزرگ صاحب‌پت؛ خدمات اجتماعی، ایونت و خرید هنوز پراکنده‌اند.</li>
  <li>تلگرام کانال توزیع قوی؛ پت‌دیت وب+ربات را با یک حساب وصل می‌کند.</li>
  <li>موتور درآمد: سکه/VIP + مارجین شاپ + کارمزد مشاوره + <strong>ایونت</strong>.</li>
</ul>
<div class="bmc">
  <div class="c"><b>مشتری</b>صاحب پت، خریدار شاپ، شرکت‌کننده ایونت</div>
  <div class="c"><b>ارزش</b>همبازی + ایونت + خرید + مشاوره</div>
  <div class="c"><b>کانال</b>تلگرام، وب، سوشال</div>
  <div class="c"><b>رابطه</b>چت، ربات، پشتیبانی</div>
  <div class="c"><b>درآمد</b>سکه، شاپ، مشاوره، ایونت</div>
  <div class="c w"><b>منابع</b>پلتفرم، برند، داده مچ، تیم AI، پنل ادمین</div>
  <div class="c w"><b>فعالیت</b>رشد کاربر، ایونت، محتوا، کیفیت مچ</div>
  <div class="c w"><b>شرکا</b>درگاه، تأمین‌کننده، متخصصان</div>
  <div class="c w"><b>هزینه</b>حقوق، بیمه کارفرما، اجاره، AI، جاری</div>
</div>

<div class="pb"></div>
<h2>۳. تجربه محصول — وب، چت و همبازی</h2>
<p class="muted">اسکرین‌شات‌های واقعی از محصول جاری پت‌دیت.</p>
<div class="shots">
  {shot("gutters-guides-top-1440.png", "لندینگ وب — معرفی برند و مسیر ورود به خدمات پت‌دیت", "tall")}
  {shot("matches-desktop.png", "همبازی پت — کشف و اتصال صاحبان حیوان خانگی", "tall")}
</div>
<div class="shots tri">
  {shot("chat-desktop.png", "چت دسکتاپ — گفت‌وگوی درون‌پلتفرمی")}
  {shot("chat-mobile.png", "چت موبایل — تجربه همراه")}
  {shot("gutters-guides-about-1440.png", "صفحه درباره / اعتماد برند")}
</div>

<h2>۴. پنل ادمین — عملیات و مالی</h2>
<p>پنل ادمین قدرتمند، ستون اتوماسیون عملیاتی است: مالی، سفارش، کیف‌پول و مانیتورینگ —
کاهش وابستگی به نیروی انسانی با رشد کاربر.</p>
<div class="shots">
  {shot("admin-finance-dashboard.png", "داشبورد مالی ادمین — دید یکپارچه درآمد و جریان نقد", "tall")}
  {shot("admin_platform_dashboard_kpis.png", "KPI پلتفرم — مانیتورینگ رشد و سلامت سیستم", "tall")}
</div>
<div class="shots">
  {shot("admin-finance-pnl.png", "P&amp;L عملیاتی — سود و زیان قابل گزارش به سرمایه‌گذار")}
  {shot("admin-finance-wallet.png", "دفتر کیف‌پول — تومان، سکه و رهگیری تراکنش")}
</div>

<div class="pb"></div>
<h2>۵. درآمد ایونت‌ها <span class="badge">جدید در مدل</span></h2>
<div class="callout coral">
<strong>فرض مدل:</strong> هزینه عضویت استاندارد <strong>{EVENT_JOIN_FEE_COINS} سکه</strong> به ازای هر شرکت‌کننده
(≈ <strong>{fmt(join_unit)}</strong> تومان با قیمت سکه {fmt(COIN_TOMAN)}).
در این طرح، ایونت‌های <strong>پلتفرمی / ویژه‌شده</strong> با take rate
<strong>{int(PLATFORM_JOIN_TAKE*100)}٪</strong> مدل می‌شوند (کل کارمزد عضویت به خزانه پت‌دیت).
ایونت میزبان‌محور در محصول فعلی ممکن است سهم میزبان داشته باشد؛ کارمزد ۲۰–۳۰٪ پلتفرم مسیر بعدی است و در این pitch استفاده نشده.
هزینه ساخت ایونت در کد محصول: <strong>{EVENT_CREATE_COST_COINS} سکه</strong> (sink پلتفرم) — در سناریوها به درآمد ایونت افزوده شده است.
</div>

<h3>مثال تبدیل به تومان (فقط عضویت، take ۱۰۰٪)</h3>
<table>
  <thead><tr><th>سناریو حجم</th><th class="n">سکه عضویت</th><th class="n">درآمد تومان</th></tr></thead>
  <tbody>{event_ex_rows}</tbody>
</table>

<h3>سهم ایونت در ماه ۱۲ (سناریوها)</h3>
<table>
  <thead>
    <tr><th>سناریو</th><th class="n">ایونت/ماه</th><th class="n">میانگین نفر</th>
    <th class="n">عضویت</th><th class="n">ساخت</th><th class="n">جمع ایونت</th></tr>
  </thead>
  <tbody>
    {"".join(
      f"<tr><td>{name}</td><td class='n'>{s['events_n']}</td>"
      f"<td class='n'>{s['events_att']}</td>"
      f"<td class='n'>{fmt(s['events_join'])}</td>"
      f"<td class='n'>{fmt(s['events_create'])}</td>"
      f"<td class='n'>{fmt(s['events'])}</td></tr>"
      for name, s in SCENARIOS.items()
    )}
  </tbody>
</table>
<p class="fn">فرمول عضویت: N × میانگین شرکت‌کننده × {EVENT_JOIN_FEE_COINS} × {fmt(COIN_TOMAN)} × {int(PLATFORM_JOIN_TAKE*100)}٪.
فرمول ساخت: N × {EVENT_CREATE_COST_COINS} × {fmt(COIN_TOMAN)}.</p>

<div class="card">
  <h3>ترکیب درآمد ماه ۱۲ — سناریو پایه</h3>
  {revenue_mix_bars(base)}
  <p class="muted" style="margin-top:8px">جمع: {fmt(base['rev'])} تومان
  (سکه/VIP {fmt(base['coins'])} + شاپ {fmt(base['shop'])} + مشاوره {fmt(base['consult'])} + ایونت {fmt(base['events'])})</p>
</div>

<div class="pb"></div>
<h2>۶. نیروی انسانی و برن ماهانه</h2>
<p class="muted">حقوق‌ها <strong>ناخالص</strong>اند؛ سهم بیمه کارفرما جداگانه به برن اضافه شده است.</p>
<table>
  <thead><tr><th>نقش</th><th class="n">حقوق ماهانه ناخالص (تومان)</th></tr></thead>
  <tbody>
    {payroll_rows}
    <tr class="tfoot"><td>جمع حقوق ناخالص</td><td class="n">{fmt(PAYROLL_TOTAL)}</td></tr>
  </tbody>
</table>
<table>
  <thead><tr><th>سرفصل OPEX</th><th class="n">مبلغ ماهانه</th></tr></thead>
  <tbody>
    <tr><td>حقوق تیم (ناخالص)</td><td class="n">{fmt(PAYROLL_TOTAL)}</td></tr>
    <tr><td>بیمه تأمین اجتماعی — سهم کارفرما ({SS_EMPLOYER_RATE*100:.0f}٪)</td>
        <td class="n">{fmt(INSURANCE_EMPLOYER)}</td></tr>
    <tr><td>هوش مصنوعی ({AI_USD}$ × {fmt(USD_TOMAN)})</td><td class="n">{fmt(AI_COST)}</td></tr>
    <tr><td>اجاره دفتر</td><td class="n">{fmt(RENT)}</td></tr>
    <tr><td>هزینه‌های جاری (ابزار، اینترنت، عوارض جزئی)</td><td class="n">{fmt(OPEX)}</td></tr>
    <tr class="tfoot"><td>جمع برن ماهانه</td><td class="n">{fmt(BURN)}</td></tr>
  </tbody>
</table>
<p class="fn">سهم بیمه‌شده ({SS_EMPLOYEE_RATE*100:.0f}٪) و مالیات حقوق از خالص پرسنل کسر می‌شود و به برن شرکت اضافه نمی‌گردد.</p>
<div class="grid2">
  <div class="card"><h3>ترکیب برن</h3>{burn_pie()}</div>
  <div class="card">
    <h3>نکات هزینه</h3>
    <ul class="t">
      <li>حقوق + بیمه ≈ {labor_share:.0f}٪ برن — بزرگ‌ترین اهرم.</li>
      <li>برن سالانه ثابت: <strong>{fmt(BURN*12)}</strong> تومان.</li>
      <li>سرمایه‌گذاری روی مهندس AI → اتوماسیون پشتیبانی و کاهش هزینه نسبی در مقیاس.</li>
      <li>جاری ۵۰م شامل رزرو کوچک عوارض/بیمه مسئولیت است.</li>
    </ul>
  </div>
</div>

<h2>۶٫۱. بیمه و مالیات (فرض ایران)</h2>
<table>
  <thead><tr><th>مورد</th><th>فرض طرح</th><th>اثر</th></tr></thead>
  <tbody>
    <tr><td>بیمه کارفرما</td><td>۲۳٪ روی حقوق ناخالص</td><td class="n">+{fmt(INSURANCE_EMPLOYER)} / ماه</td></tr>
    <tr><td>بیمه بیمه‌شده</td><td>۷٪ از حقوق</td><td>هزینه شرکت نیست</td></tr>
    <tr><td>مالیات حقوق</td><td>کسر از منبع</td><td>هزینه اضافه شرکت نیست</td></tr>
    <tr><td>مالیات عملکرد</td><td>۲۵٪ روی سود مشمول پس از BE</td><td>در جدول سناریوها</td></tr>
    <tr><td>VAT (~۱۰٪)</td><td>عبورکننده / pass-through برای B2C دیجیتال</td><td>خنثی در برن</td></tr>
  </tbody>
</table>
<p class="fn">VAT برای درآمد دیجیتال B2C اغلب عبورکننده است؛ کالاهای شاپ ممکن است مشمول باشند — در برن خنثی فرض شده.</p>

<h2>۷. اتوماسیون → اهرم عملیاتی (کاهش هزینه نسبی HR)</h2>
<div class="callout">
با توسعه پلتفرم (ربات تلگرام، AI، پنل ادمین مالی/کیف‌پول، سلف‌سرویس سفارش و ایونت)،
<strong>نیاز نیروی انسانی نسبت به مقیاس کاربر کاهش می‌یابد</strong> — همان تیم، کاربران بیشتر،
هزینه به ازای هر MAU پایین‌تر. این همان دلیل سرمایه‌گذاری روی نقش برنامه‌نویس هوش مصنوعی است.
</div>
<table>
  <thead>
    <tr><th>فاز</th><th class="n">تیم</th><th class="n">MAU فرض</th>
    <th class="n">برن / MAU</th><th>توضیح</th></tr>
  </thead>
  <tbody>{hr_rows}</tbody>
</table>
<ul class="t">
  <li><strong>فاز ۱:</strong> ۶ نفر برای لانچ، پشتیبانی دستی و تثبیت محصول.</li>
  <li><strong>فاز ۲:</strong> همان ۶ نفر با ≈۲× کاربر — پنل ادمین و سلف‌سرویس بار پشتیبانی را کم می‌کند.</li>
  <li><strong>فاز ۳:</strong> اتوماسیون بیشتر (ربات + AI)؛ رشد نسبی پشتیبانی کندتر از رشد MAU؛
  حتی با یک نقش اضافه، <em>cost per MAU</em> به شکل معنادار پایین می‌آید.</li>
</ul>
<p class="muted">اعداد MAU فازها برای نمایش اهرم‌اند؛ با جدول سناریوهای درآمد هم‌راستا ولی ساده‌سازی‌شده‌اند.</p>

<div class="pb"></div>
<h2>۸. سرمایه اولیه و Use of Funds</h2>
<table>
  <thead><tr><th>جزء</th><th class="n">مبلغ</th></tr></thead>
  <tbody>
    {setup_rows}
    <tr class="tfoot"><td>جمع راه‌اندازی</td><td class="n">{fmt(SETUP_TOTAL)}</td></tr>
    <tr><td>Runway {RUNWAY_MONTHS} ماه × برن {fmt(BURN)}</td><td class="n">{fmt(RUNWAY)}</td></tr>
    <tr><td>بافر ≈۸٪</td><td class="n">{fmt(BUFFER)}</td></tr>
    <tr class="tfoot"><td>حداقل نیاز محاسبه‌شده</td><td class="n">{fmt(CAPITAL_NEED)}</td></tr>
    <tr class="tfoot"><td>پیشنهاد جذب (گرد به ۰٫۵ میلیارد)</td><td class="n">{fmt(CAPITAL_ASK)}</td></tr>
  </tbody>
</table>
<div class="grid2">
  <div class="card"><h3>مصرف وجوه</h3>{use_of_funds_pie()}</div>
  <div class="card">
    <h3>جدول سهم</h3>
    <table>
      <thead><tr><th>سرفصل</th><th class="n">مبلغ</th><th class="n">سهم</th></tr></thead>
      <tbody>{use_rows}</tbody>
    </table>
    <div class="callout" style="margin-top:8px">≈ <span class="hl">{fmt_b(CAPITAL_ASK/1e9)} میلیارد</span>
    (≈ <strong>{ASK_MONTHS:.1f}</strong> ماه برن، شامل راه‌اندازی)</div>
  </div>
</div>

<div class="pb"></div>
<h2>۹. پیش‌بینی درآمد و سربه‌سر (با ایونت)</h2>
<div class="callout warn">درآمدها <strong>فرض مدل</strong> هستند نه تعهد.
سود پس از مالیات = max(۰، درآمد − برن) × (۱ − ۲۵٪).
استک درآمد: سکه/VIP + شاپ + مشاوره + <strong>ایونت</strong>.</div>
<table>
  <thead>
    <tr><th>سناریو</th><th class="n">MAU م۱۲</th><th class="n">ایونت م۱۲</th>
    <th class="n">درآمد م۱۲</th>
    <th class="n">سود پیش از مالیات</th><th class="n">سود پس از مالیات</th>
    <th class="n">سربه‌سر</th><th class="n">Payback</th></tr>
  </thead>
  <tbody>{scen_rows}</tbody>
</table>
<h3>رمپ درآمد سناریو پایه (میلیون تومان)</h3>
{rev_ramp_svg()}
<ul class="t">
  <li>سربه‌سر عملیاتی وقتی درآمد ماهانه ≥ {fmt(BURN)} تومان.</li>
  <li>پایه با ایونت: سربه‌سر ≈ ماه <strong>{base['be']}</strong> · Payback ≈ ماه <strong>{base['pb']}</strong>
  (جریان نقدی تجمعی از −سرمایه، با رشد ملایم درآمد پس از م۱۲).</li>
  <li>برای پوشش برن با حاشیه ≈۸۵٪، حدود <strong>{fmt(int(BURN/0.85))}</strong> تومان GMV ماهانه لازم است.</li>
  <li>VAT (~۱۰٪) عبورکننده فرض شده و در برن خنثی است.</li>
</ul>

<h2>۱۰. نقشه راه و ریسک</h2>
<table>
  <thead><tr><th>فاز</th><th>بازه</th><th>تمرکز</th></tr></thead>
  <tbody>
    <tr><td>آماده‌سازی</td><td>۰–۱</td><td>تیم، دفتر، حقوقی، لانچ، لیست بیمه</td></tr>
    <tr><td>رشد اولیه</td><td>۲–۶</td><td>تلگرام/سوشال، سکه، ایونت پلتفرمی</td></tr>
    <tr><td>مقیاس + اتوماسیون</td><td>۷–۱۲</td><td>سربه‌سر، پنل ادمین، کاهش cost/MAU</td></tr>
    <tr><td>تثبیت</td><td>۱۳–۱۸</td><td>B2B، کارمزد ایونت میزبان، راند بعد</td></tr>
  </tbody>
</table>
<table>
  <thead><tr><th>ریسک</th><th>پوشش</th></tr></thead>
  <tbody>
    <tr><td>رشد کند / ایونت کم</td><td>بافر سرمایه؛ KPI ماهانه ایونت و پرداخت</td></tr>
    <tr><td>نوسان دلار / AI</td><td>سقف مصرف؛ قیمت‌گذاری پویا سکه</td></tr>
    <tr><td>مدل کارمزد ایونت</td><td>شروع با ایونت پلتفرمی؛ مسیر کمیسیون میزبان</td></tr>
    <tr><td>پرداخت / رگولاتوری</td><td>چند درگاه؛ فاکتور استاندارد</td></tr>
    <tr><td>سقف بیمه / تغییر نرخ</td><td>محافظه‌کاری روی پایه کامل حقوق</td></tr>
  </tbody>
</table>

<h2>۱۱. پیشنهاد سرمایه‌گذاری</h2>
<ul class="t">
  <li><strong>مبلغ:</strong> {fmt(CAPITAL_ASK)} تومان</li>
  <li><strong>مصرف:</strong> راه‌اندازی + Runway تیم ۶ نفره (بیمه کارفرما ۲۳٪)</li>
  <li><strong>هدف ۱۲ماه:</strong> عبور از سربه‌سر در سناریو پایه (با استک ایونت)</li>
  <li><strong>گزارش:</strong> P&amp;L ماهانه، MAU، نرخ پرداخت، حجم ایونت، CAC</li>
  <li><strong>سهام/valuation:</strong> در مذاکره ترم‌شیت</li>
</ul>
<div class="callout">
<strong>جمع‌بندی:</strong> برن <span class="hl">{fmt(BURN)}</span> تومان/ماه ·
سرمایه پیشنهادی <span class="hl">{fmt(CAPITAL_ASK)}</span> تومان ·
ایونت پایه م۱۲ ≈ <span class="hl">{fmt(base['events'])}</span> تومان ·
سربه‌سر پایه ماه <span class="hl">{base['be']}</span>.
</div>
<p class="muted">پت‌دیت · طرح توجیهی سرمایه‌گذاری · اعداد به تومان · نسخه ۱٫۳ (ایونت + اتوماسیون + بیمه/مالیات)</p>
</body></html>"""


def write_assumptions() -> None:
    base = SCENARIOS["پایه"]
    text = f"""# فرض‌های طرح توجیهی پت‌دیت

## حقوق ناخالص (تومان/ماه)
{chr(10).join(f'- {k}: {v:,}' for k, v in PAYROLL.items())}
- جمع ناخالص: {PAYROLL_TOTAL:,}

## بیمه تأمین اجتماعی (فرض ایران — بخش خصوصی)
- سهم کارفرما: **{SS_EMPLOYER_RATE*100:.0f}%** = ۲۰٪ بیمه + ۳٪ بیکاری روی پایه حقوق بیمه‌شده
- محاسبه طرح (محافظه‌کار): `{PAYROLL_TOTAL:,} × {SS_EMPLOYER_RATE} = {INSURANCE_EMPLOYER:,}` تومان/ماه
- سهم بیمه‌شده: {SS_EMPLOYEE_RATE*100:.0f}% — از خالص حقوق کسر می‌شود؛ **به برن شرکت اضافه نمی‌شود**
- سقف/کف دستمزد روزانه بیمه در عمل ممکن است پایه را کمتر کند؛ در pitch پایه کامل استفاده شده

## مالیات (فرض ایران)
- **مالیات حقوق (کسر از منبع):** از حقوق پرسنل کسر می‌شود — هزینه اضافه شرکت نیست
- **مالیات بر عملکرد / شرکت:** **{CORPORATE_TAX_RATE*100:.0f}%** روی سود مشمول پس از سربه‌سر
  - `سود_پس_از_مالیات = max(0, درآمد − برن) × (1 − {CORPORATE_TAX_RATE})`
- **VAT (~{VAT_RATE*100:.0f}%):** عبورکننده / pass-through برای B2C دیجیتال؛ خنثی در برن؛ شاپ ممکن است مشمول باشد
- **سایر عوارض / بیمه مسئولیت:** رزرو کوچک (~۵–۱۰م) داخل OPEX جاری {OPEX:,}

## اقتصاد سکه و ایونت
- قیمت سکه مرجع: **{COIN_TOMAN:,}** تومان
- هزینه عضویت استاندارد (فرض pitch): **{EVENT_JOIN_FEE_COINS} سکه**/شرکت‌کننده ≈ {EVENT_JOIN_FEE_COINS * COIN_TOMAN:,} تومان
- هزینه ساخت ایونت (کد محصول `EVENT_CREATE_COST`): **{EVENT_CREATE_COST_COINS} سکه** — sink پلتفرم
- **مدل take پلتفرم در این طرح:** ایونت پلتفرمی/ویژه → **{int(PLATFORM_JOIN_TAKE*100)}%** از هزینه عضویت
  - مسیر بعدی: ایونت میزبان‌محور با کارمزد ۲۰–۳۰٪ (در اعداد فعلی استفاده نشده)
- فرمول عضویت: `N_events × avg_attendees × {EVENT_JOIN_FEE_COINS} × {COIN_TOMAN} × {PLATFORM_JOIN_TAKE}`
- فرمول ساخت: `N_events × {EVENT_CREATE_COST_COINS} × {COIN_TOMAN}`
- مثال‌ها (فقط عضویت):
  - ۵۰×۲۰×۲ = ۴٬۰۰۰ سکه = {event_join_toman(50, 20):,} تومان
  - ۱۰۰×۳۰×۲ = ۶٬۰۰۰ سکه = {event_join_toman(100, 30):,} تومان
  - ۲۵۰×۲۵×۲ = ۱۲٬۵۰۰ سکه = {event_join_toman(250, 25):,} تومان
  - ۵۰۰×۳۰×۲ = ۳۰٬۰۰۰ سکه = {event_join_toman(500, 30):,} تومان

### حجم ایونت ماه ۱۲ در سناریوها
{chr(10).join(
  f"- {name}: {s['events_n']} ایونت × {s['events_att']} نفر → عضویت {s['events_join']:,} + ساخت {s['events_create']:,} = **{s['events']:,}**"
  for name, s in SCENARIOS.items()
)}

## OPEX ماهانه
- حقوق ناخالص: {PAYROLL_TOTAL:,}
- بیمه کارفرما ۲۳٪: {INSURANCE_EMPLOYER:,}
- AI: {AI_USD}$ × {USD_TOMAN:,} = {AI_COST:,}
- اجاره: {RENT:,}
- جاری: {OPEX:,}
- **برن: {BURN:,}**

## سرمایه
- راه‌اندازی: {SETUP_TOTAL:,}
- Runway 12م: {RUNWAY:,}
- بافر ≈۸٪: {BUFFER:,}
- نیاز محاسبه‌شده: {CAPITAL_NEED:,}
- **پیشنهاد (گرد به ۰٫۵ میلیارد): {CAPITAL_ASK:,}** (≈{ASK_MONTHS:.1f} ماه برن)

## استک درآمد و سربه‌سر
- استک: سکه/VIP + شاپ + مشاوره + **ایونت**
- رمپ پایه (میلیون): {BASE_REV_M}

## پایه ماه ۱۲
- سکه/VIP: {base['coins']:,}
- شاپ: {base['shop']:,}
- مشاوره: {base['consult']:,}
- ایونت: {base['events']:,}
- **درآمد کل: {base['rev']:,}**
- سود پیش از مالیات: {base['profit_pre']:,}
- سود پس از مالیات ۲۵٪: {base['profit_after']:,}
- سربه‌سر: ماه {base['be']}
- Payback: ماه {base['pb']}
  - تعریف: جریان نقدی تجمعی از −{CAPITAL_ASK:,}؛ پس از رمپ ۱۲ماه، درآمد ماهانه +۳۵م رشد؛ اولین ماهی که cum ≥ ۰

## اهرم HR / اتوماسیون
فرض: برن اسمی ثابت ≈{BURN:,}؛ با رشد MAU و اتوماسیون (ربات، AI، پنل ادمین، سلف‌سرویس) هزینه به ازای MAU کاهش می‌یابد.
{chr(10).join(
  f"- {p['phase']}: تیم {p['team']} · MAU {p['mau']:,} · برن/MAU ≈ {p['cost_per_mau']:,} تومان — {p['note']}"
  for p in HR_PHASES
)}
"""
    (ROOT / "ASSUMPTIONS.md").write_text(text, encoding="utf-8")


def main() -> None:
    html = build_html()
    html_path = ROOT / "petdate-tarh-tojihi.html"
    pdf_path = ROOT / "petdate-tarh-tojihi.pdf"
    copy_path = ARTIFACTS / "petdate-tarh-tojihi-sarmayehgozar.pdf"

    html_path.write_text(html, encoding="utf-8")
    HTML(filename=str(html_path), base_url=str(ROOT)).write_pdf(str(pdf_path))
    shutil.copy2(pdf_path, copy_path)
    write_assumptions()

    base = SCENARIOS["پایه"]
    print("OK", pdf_path, pdf_path.stat().st_size)
    print("COPY", copy_path)
    print(
        f"BURN={BURN:,} INS={INSURANCE_EMPLOYER:,} ASK={CAPITAL_ASK:,} "
        f"NEED={CAPITAL_NEED:,} BE_base={base['be']} PB_base={base['pb']}"
    )
    print(
        f"BASE_REV={base['rev']:,} EVENTS={base['events']:,} "
        f"(join={base['events_join']:,} create={base['events_create']:,})"
    )
    for ex in EVENT_EXAMPLES:
        print(
            f"EX {ex['n']}x{ex['att']}x2 -> "
            f"{event_join_toman(ex['n'], ex['att']):,} toman"
        )


if __name__ == "__main__":
    main()
