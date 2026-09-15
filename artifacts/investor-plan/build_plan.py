#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PetDate investor feasibility PDF (FA, RTL) — events + SS 23% + tax 25% + screenshots."""
from __future__ import annotations

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
# سرور + هاست + دامنه + زیرساخت فنی
INFRA_TECH = 15_000_000

BURN = PAYROLL_TOTAL + INSURANCE_EMPLOYER + AI_COST + RENT + OPEX + INFRA_TECH  # 702.7M

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
RUNWAY = BURN * RUNWAY_MONTHS  # 8,432,400,000
# بسته شدن تمیز روی ۱۰ میلیارد: راه‌اندازی + ۱۲ ماه برن ≈ ۹٫۹۳B؛
# بافر عملیاتی نازک (~۶۸م / ≈۰٫۷٪) تا قفل سرمایه درخواستی.
CAPITAL_BASE = RUNWAY + SETUP_TOTAL  # 9,932,400,000
CAPITAL_ASK = 10_000_000_000  # سرمایه درخواستی صریح — ۱۰ میلیارد تومان
CONTINGENCY = CAPITAL_ASK - CAPITAL_BASE  # 67,600,000
BUFFER = CONTINGENCY  # alias for narrative/tables
CAPITAL_NEED = CAPITAL_BASE  # نیاز قبل از بافر گرد کردن
ASK_MONTHS = CAPITAL_ASK / BURN  # ≈ ۱۴٫۲ ماه پوشش کل (شامل راه‌اندازی)
RUNWAY_COVER_MONTHS = (CAPITAL_ASK - SETUP_TOTAL) / BURN  # ≈ ۱۲٫۱ ماه عملیات
DOC_VERSION = "۱٫۸"
DOC_VERSION_LATIN = "1.8"
POST_RAMP_GROWTH_M = 35  # میلیون تومان رشد ماهانه درآمد پس از ماه ۱۲

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


def _cashflow_series(
    ramp_m: list[int],
    burn: int,
    capital: int,
    growth_m: int = POST_RAMP_GROWTH_M,
    max_months: int = 60,
) -> list[dict]:
    """Monthly revenue / CF / cumulative CF starting from −capital."""
    rows: list[dict] = []
    cum = -float(capital)
    last = float(ramp_m[-1])
    for i in range(1, max_months + 1):
        if i <= len(ramp_m):
            rev_m = float(ramp_m[i - 1])
        else:
            last = last + growth_m
            rev_m = last
        cf = rev_m * 1_000_000 - burn
        cum += cf
        rows.append(
            {
                "month": i,
                "rev_m": rev_m,
                "rev": rev_m * 1_000_000,
                "cf": cf,
                "cum": cum,
            }
        )
    return rows


def _payback_from_ramp(
    ramp_m: list[int],
    burn: int,
    capital: int,
    growth_m: int = POST_RAMP_GROWTH_M,
    max_months: int = 48,
) -> int:
    """First month cumulative CF from −capital reaches ≥ 0."""
    for row in _cashflow_series(ramp_m, burn, capital, growth_m, max_months):
        if row["cum"] >= 0:
            return row["month"]
    return max_months


def _yearly_outlook(
    ramp_m: list[int],
    burn: int,
    capital: int,
    growth_m: int = POST_RAMP_GROWTH_M,
    years: int = 5,
) -> list[dict]:
    """Calendar-year aggregates for investor multi-year chart (years 1…N)."""
    series = _cashflow_series(ramp_m, burn, capital, growth_m, years * 12)
    out: list[dict] = []
    for y in range(1, years + 1):
        chunk = series[(y - 1) * 12 : y * 12]
        rev = sum(r["rev"] for r in chunk)
        profit_pre = sum(r["cf"] for r in chunk)
        # مالیات فقط روی سود ماهانه مثبت (ساده برای pitch)
        tax = sum(
            max(0.0, r["cf"]) * CORPORATE_TAX_RATE for r in chunk
        )
        profit_after = profit_pre - tax
        cum_end = chunk[-1]["cum"]
        # چندبرابر بازگشت: ۱ + cum/ask وقتی cum≥۰؛ قبل از payback نسبت بازیابی اصل
        recovered = max(0.0, capital + cum_end)  # اصل بازیابی‌شده (۰ تا capital+)
        recovery_pct = min(1.0, recovered / capital) if cum_end < 0 else 1.0
        roi_multiple = (capital + cum_end) / capital  # ۱.۰ در نقطه payback
        out.append(
            {
                "year": y,
                "rev": rev,
                "profit_pre": profit_pre,
                "profit_after": profit_after,
                "cum": cum_end,
                "recovery_pct": recovery_pct,
                "roi_multiple": roi_multiple,
            }
        )
    return out


BE_BASE = _be_from_ramp(BASE_REV_M, BURN)
CF_SERIES = _cashflow_series(BASE_REV_M, BURN, CAPITAL_ASK)
PB_BASE = _payback_from_ramp(BASE_REV_M, BURN, CAPITAL_ASK)
YEARLY = _yearly_outlook(BASE_REV_M, BURN, CAPITAL_ASK, years=5)
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


def fmt_b(n: float, digits: int = 1) -> str:
    return f"{n:.{digits}f}".replace(".", "٫")


def fmt_dec(n: float, digits: int = 1) -> str:
    return f"{n:.{digits}f}".replace(".", "٫")


def uri(path: Path) -> str:
    return path.resolve().as_uri()


# ── Charts (PNG for WeasyPrint — SVG arcs clip badly under RTL) ────────
CHARTS_DIR = ROOT / "charts"
CHARTS_DIR.mkdir(parents=True, exist_ok=True)

try:
    import arabic_reshaper

    def fa(t: str) -> str:
        # Noto + Matplotlib Agg: reshape only (python-bidi reverses glyphs here).
        return arabic_reshaper.reshape(t)
except Exception:  # pragma: no cover

    def fa(t: str) -> str:
        return t


def _mpl_setup() -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.rcParams.update(
        {
            "font.family": ["Noto Sans Arabic", "DejaVu Sans"],
            "axes.unicode_minus": False,
            "figure.facecolor": "#ffffff",
            "savefig.facecolor": "#ffffff",
            "savefig.bbox": "tight",
            "savefig.pad_inches": 0.08,
        }
    )


def _save_donut_png(
    parts: list[tuple[str, int, str]],
    center_top: str,
    center_bot: str,
    out_name: str,
    *,
    fig_size: tuple[float, float] = (3.55, 3.55),
) -> Path:
    """Donut without on-slice labels (legend is HTML) — avoids overlap/clip."""
    _mpl_setup()
    import matplotlib.pyplot as plt

    values = [v for _, v, _ in parts]
    colors = [c for _, _, c in parts]
    total = sum(values) or 1
    # Tiny slices (e.g. buffer ~0.7%) need a slight explode so they stay visible.
    explode = tuple(0.045 if (v / total) < 0.03 else 0.012 for v in values)

    fig, ax = plt.subplots(figsize=fig_size, dpi=160)
    wedges, _ = ax.pie(
        values,
        colors=colors,
        startangle=90,
        explode=explode,
        wedgeprops=dict(width=0.42, edgecolor="#ffffff", linewidth=1.6),
    )
    ax.set_aspect("equal")
    # Center hole labels (use LTR digits for clarity inside the ring)
    ax.text(
        0,
        0.12,
        fa(center_top),
        ha="center",
        va="center",
        fontsize=12,
        fontweight="bold",
        color=NAVY,
        fontfamily="Noto Sans Arabic",
    )
    ax.text(
        0,
        -0.14,
        center_bot,
        ha="center",
        va="center",
        fontsize=13,
        fontweight="bold",
        color=TEAL,
        fontfamily="DejaVu Sans",
    )
    ax.set_xlim(-1.35, 1.35)
    ax.set_ylim(-1.35, 1.35)
    out = CHARTS_DIR / out_name
    fig.savefig(out, dpi=160)
    plt.close(fig)
    return out


def _legs_html(
    parts: list[tuple[str, int, str]],
    *,
    compact: bool = False,
) -> str:
    total = sum(v for _, v, _ in parts) or 1
    legs: list[str] = []
    for label, val, color in parts:
        pct = val / total * 100
        if compact:
            legs.append(
                f'<div class="leg"><span style="background:{color}"></span>'
                f"<b>{label}</b> <em>({pct:.0f}٪)</em></div>"
            )
        else:
            legs.append(
                f'<div class="leg"><span style="background:{color}"></span>'
                f"<b>{label}</b> · {fmt(val)} "
                f'<em>({pct:.0f}٪)</em></div>'
            )
    return '<div class="legs" dir="rtl">' + "".join(legs) + "</div>"


def donut_chart(
    parts: list[tuple[str, int, str]],
    center_top: str,
    center_bot: str,
    out_name: str,
    *,
    compact_legs: bool = False,
    img_max: int = 200,
) -> str:
    png = _save_donut_png(parts, center_top, center_bot, out_name)
    return (
        f'<div class="chart-wrap">'
        f'<div class="donut-frame" dir="ltr">'
        f'<img class="donut" src="{uri(png)}" width="{img_max}" height="{img_max}" '
        f'alt="" style="max-width:{img_max}px;width:100%;height:auto"/>'
        f"</div>"
        + _legs_html(parts, compact=compact_legs)
        + "</div>"
    )


def burn_pie() -> str:
    return donut_chart(
        [
            ("حقوق", PAYROLL_TOTAL, NAVY),
            ("بیمه کارفرما", INSURANCE_EMPLOYER, TEAL),
            ("AI API", AI_COST, CORAL),
            ("اجاره", RENT, TEAL_LT),
            ("جاری", OPEX, "#7c9aab"),
            ("زیرساخت فنی", INFRA_TECH, NAVY2),
        ],
        "برن",
        f"{BURN / 1_000_000:.1f}M".replace(".", "٫"),
        "burn_pie.png",
        img_max=200,
    )


def use_of_funds_pie() -> str:
    return donut_chart(
        [
            ("Runway ۱۲م", RUNWAY, NAVY),
            ("راه‌اندازی", SETUP_TOTAL, TEAL),
            ("بافر عملیاتی", CONTINGENCY, CORAL),
        ],
        "سرمایه",
        "۱۰B",
        "use_of_funds.png",
        compact_legs=True,
        img_max=176,
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
    """Bar ramp as LTR SVG (safe) with burn label on the right — no overlap."""
    burn_m = BURN / 1_000_000
    vals = BASE_REV_M
    w, h = 540, 200
    pad_l, pad_r, pad_t, pad_b = 36, 78, 28, 32
    plot_w = w - pad_l - pad_r
    plot_h = h - pad_t - pad_b
    mx = max(max(vals), burn_m) * 1.12
    n = len(vals)
    gap = 5
    bw = (plot_w - gap * (n - 1)) / n
    bars: list[str] = []
    for i, v in enumerate(vals):
        x = pad_l + i * (bw + gap)
        bh = v / mx * plot_h
        y = pad_t + plot_h - bh
        color = TEAL if v >= burn_m else TEAL_LT
        bars.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" '
            f'rx="3" fill="{color}"/>'
            f'<text x="{x + bw / 2:.1f}" y="{h - 10}" text-anchor="middle" '
            f'font-size="7.5" fill="{SLATE}" font-family="DejaVu Sans">M{i + 1}</text>'
        )
        label_here = i in (0, 5, 9, 11) or (
            v >= burn_m and (i == 0 or vals[i - 1] < burn_m)
        )
        if label_here:
            bars.append(
                f'<text x="{x + bw / 2:.1f}" y="{y - 5:.1f}" text-anchor="middle" '
                f'font-size="7.5" fill="{NAVY}" font-family="DejaVu Sans">{int(v)}</text>'
            )
    by = pad_t + plot_h - (burn_m / mx * plot_h)
    return (
        f'<div class="ramp-wrap" dir="ltr">'
        f'<svg class="ramp" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
        f'xmlns="http://www.w3.org/2000/svg">'
        f'<line x1="{pad_l}" y1="{by:.1f}" x2="{w - pad_r}" y2="{by:.1f}" '
        f'stroke="{CORAL}" stroke-width="1.6" stroke-dasharray="5 4"/>'
        f'<text x="{w - pad_r + 6}" y="{by + 3:.1f}" font-size="8.5" fill="{CORAL}" '
        f'font-family="DejaVu Sans" text-anchor="start">برن ≈ {burn_m:.0f}M</text>'
        + "".join(bars)
        + "</svg></div>"
    )


def payback_recovery_chart() -> str:
    """Cumulative cash recovery of the ۱۰B ask until payback — clean LTR PNG."""
    _mpl_setup()
    import matplotlib.pyplot as plt
    from matplotlib.ticker import MultipleLocator

    horizon = min(36, max(PB_BASE + 4, 30))
    rows = CF_SERIES[:horizon]
    xs = [r["month"] for r in rows]
    ys = [r["cum"] / 1_000_000_000 for r in rows]  # میلیارد

    fig, ax = plt.subplots(figsize=(7.2, 3.35), dpi=160)
    ax.axhline(0, color=NAVY, lw=1.15, zorder=2)
    ax.fill_between(
        xs,
        ys,
        0,
        where=[y < 0 for y in ys],
        color=CORAL,
        alpha=0.14,
        interpolate=True,
        zorder=1,
    )
    ax.fill_between(
        xs,
        ys,
        0,
        where=[y >= 0 for y in ys],
        color=TEAL,
        alpha=0.16,
        interpolate=True,
        zorder=1,
    )
    ax.plot(xs, ys, color=TEAL, lw=2.4, zorder=3)
    # mark start capital
    ax.scatter([0], [-CAPITAL_ASK / 1e9], color=CORAL, s=28, zorder=4, clip_on=False)
    ax.annotate(
        fa(f"شروع: −{CAPITAL_ASK / 1e9:.0f}B"),
        xy=(1, ys[0]),
        xytext=(3.2, ys[0] - 1.15),
        fontsize=8,
        color=CORAL,
        arrowprops=dict(arrowstyle="->", color=CORAL, lw=0.9),
    )
    # payback marker
    if PB_BASE <= horizon:
        pb_y = next(r["cum"] for r in rows if r["month"] == PB_BASE) / 1e9
        ax.axvline(PB_BASE, color=TEAL_DK, ls="--", lw=1.2, alpha=0.85)
        ax.scatter([PB_BASE], [pb_y], color=TEAL_DK, s=36, zorder=5)
        ax.annotate(
            fa(f"بازگشت اصل · ماه {PB_BASE}"),
            xy=(PB_BASE, pb_y),
            xytext=(min(PB_BASE + 1.2, horizon - 6), max(1.4, pb_y + 1.6)),
            fontsize=8.5,
            color=TEAL_DK,
            fontweight="bold",
            arrowprops=dict(arrowstyle="->", color=TEAL_DK, lw=1.0),
        )

    ax.set_xlim(0, horizon + 0.5)
    ymin = min(ys) * 1.08
    ymax = max(0.8, max(ys) * 1.35)
    ax.set_ylim(ymin, ymax)
    # BE marker (after limits so label sits cleanly)
    if BE_BASE <= horizon:
        ax.axvline(BE_BASE, color=SLATE, ls=":", lw=1.0, alpha=0.7)
        ax.text(
            BE_BASE + 0.15,
            ymin + (ymax - ymin) * 0.06,
            fa(f"سربه‌سر م{BE_BASE}"),
            ha="left",
            va="bottom",
            fontsize=7.5,
            color=SLATE,
        )
    ax.set_xlabel(fa("ماه از تزریق سرمایه"), fontsize=9, color=SLATE)
    ax.set_ylabel(fa("جریان نقدی تجمعی (میلیارد تومان)"), fontsize=9, color=SLATE)
    ax.set_title(
        fa("بازگشت هزینه اولیه — بازیابی ۱۰ میلیارد تا نقطه Payback"),
        fontsize=11,
        color=NAVY,
        pad=10,
        fontweight="bold",
    )
    ax.xaxis.set_major_locator(MultipleLocator(3))
    ax.yaxis.set_major_locator(MultipleLocator(2))
    ax.grid(True, axis="y", alpha=0.28, color="#d8e0e8")
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#c5d0d8")
    ax.spines["bottom"].set_color("#c5d0d8")
    fig.tight_layout(pad=0.4)
    out = CHARTS_DIR / "payback_recovery.png"
    fig.savefig(out, dpi=160)
    plt.close(fig)
    return (
        f'<div class="plot-wrap" dir="ltr">'
        f'<img class="plot" src="{uri(out)}" alt="بازگشت هزینه اولیه"/>'
        f"</div>"
    )


def later_years_chart() -> str:
    """Years 2–5: annual revenue, after-tax profit, ROI multiple — no overlap."""
    _mpl_setup()
    import matplotlib.pyplot as plt
    import numpy as np

    years = [y for y in YEARLY if y["year"] >= 2]
    labels = [fa(f"سال {y['year']}") for y in years]
    rev_b = [y["rev"] / 1e9 for y in years]
    profit_b = [y["profit_after"] / 1e9 for y in years]
    roi = [y["roi_multiple"] for y in years]
    x = np.arange(len(years))
    width = 0.34

    fig, ax = plt.subplots(figsize=(7.2, 3.55), dpi=160)
    bars1 = ax.bar(
        x - width / 2,
        rev_b,
        width,
        label=fa("درآمد سالانه"),
        color=NAVY,
        edgecolor="none",
        zorder=3,
    )
    bars2 = ax.bar(
        x + width / 2,
        profit_b,
        width,
        label=fa("سود خالص پس از مالیات"),
        color=TEAL,
        edgecolor="none",
        zorder=3,
    )
    ax.set_ylabel(fa("میلیارد تومان"), fontsize=9, color=SLATE)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylim(0, max(rev_b) * 1.28)
    ax.grid(True, axis="y", alpha=0.28, color="#d8e0e8", zorder=0)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#c5d0d8")
    ax.spines["bottom"].set_color("#c5d0d8")

    # value labels on bars (only tops — avoid clutter)
    for b in bars1:
        ax.text(
            b.get_x() + b.get_width() / 2,
            b.get_height() + 0.35,
            f"{b.get_height():.1f}",
            ha="center",
            va="bottom",
            fontsize=7.2,
            color=NAVY,
            fontfamily="DejaVu Sans",
        )
    for b in bars2:
        ax.text(
            b.get_x() + b.get_width() / 2,
            b.get_height() + 0.35,
            f"{b.get_height():.1f}",
            ha="center",
            va="bottom",
            fontsize=7.2,
            color=TEAL_DK,
            fontfamily="DejaVu Sans",
        )

    ax2 = ax.twinx()
    ax2.plot(
        x,
        roi,
        color=CORAL,
        lw=2.3,
        marker="o",
        ms=6,
        label=fa("چندبرابر سرمایه (ROI)"),
        zorder=4,
    )
    for xi, r in zip(x, roi):
        ax2.annotate(
            f"{r:.1f}×",
            xy=(xi, r),
            xytext=(0, 8),
            textcoords="offset points",
            ha="center",
            fontsize=8,
            color=CORAL,
            fontweight="bold",
            fontfamily="DejaVu Sans",
        )
    ax2.set_ylabel(fa("چندبرابر Ask (۱۰B)"), fontsize=9, color=CORAL)
    ax2.set_ylim(0, max(roi) * 1.45)
    ax2.spines["top"].set_visible(False)
    ax2.spines["right"].set_color("#e8c4bc")
    ax2.tick_params(axis="y", colors=CORAL)

    ax.set_title(
        fa("چشم‌انداز سال‌های بعد — درآمد، سود خالص و چندبرابر سرمایه"),
        fontsize=11,
        color=NAVY,
        pad=10,
        fontweight="bold",
    )
    # single combined legend below — avoids overlap with bars/line
    h1, l1 = ax.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(
        h1 + h2,
        l1 + l2,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.14),
        ncol=3,
        frameon=False,
        fontsize=8,
    )
    fig.tight_layout(rect=(0, 0.06, 1, 1))
    out = CHARTS_DIR / "later_years.png"
    fig.savefig(out, dpi=160, bbox_inches="tight", pad_inches=0.12)
    plt.close(fig)
    return (
        f'<div class="plot-wrap" dir="ltr">'
        f'<img class="plot" src="{uri(out)}" alt="چشم‌انداز سال‌های بعد"/>'
        f"</div>"
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
    # لوگو مادر PNG (packages/web/public/pepito/img/logo.png)
    logo = uri(ASSETS / "petdate-logo.png")
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
        ("بافر عملیاتی (بسته ۱۰ میلیارد)", CONTINGENCY),
    ]
    use_rows = "".join(
        f"<tr><td>{k}</td><td class='n'>{fmt(v)}</td>"
        f"<td class='n'>{fmt_dec(v / CAPITAL_ASK * 100, 1)}٪</td></tr>"
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
    ask_months_txt = fmt_dec(ASK_MONTHS, 1)
    runway_cover_txt = fmt_dec(RUNWAY_COVER_MONTHS, 1)
    payback_chart_html = payback_recovery_chart()
    later_years_html = later_years_chart()
    y2 = next(y for y in YEARLY if y["year"] == 2)
    y5 = next(y for y in YEARLY if y["year"] == 5)
    yearly_rows = "".join(
        f"<tr><td>سال {y['year']}</td>"
        f"<td class='n'>{fmt_b(y['rev']/1e9, 2)}</td>"
        f"<td class='n'>{fmt_b(y['profit_after']/1e9, 2)}</td>"
        f"<td class='n'>{fmt_b(y['cum']/1e9, 2)}</td>"
        f"<td class='n'>{fmt_dec(y['roi_multiple'], 1)}×</td></tr>"
        for y in YEARLY
        if y["year"] >= 2
    )
    # بازیابی اصل در ماه payback
    pb_cum = next(r["cum"] for r in CF_SERIES if r["month"] == PB_BASE)

    return f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>طرح توجیهی پت‌دیت — نسخه {DOC_VERSION}</title>
<style>
  @page {{
    size: A4;
    margin: 16mm 14mm 18mm 14mm;
    @bottom-center {{
      content: "پت‌دیت · طرح توجیهی سرمایه‌گذاری · محرمانه · v{DOC_VERSION_LATIN}  ·  " counter(page);
      font-family: "Noto Sans Arabic", "DejaVu Sans", sans-serif;
      font-size: 7.5pt;
      color: #64748b;
      letter-spacing: 0.01em;
      padding-top: 4mm;
      border-top: 0.6pt solid #d5e0e7;
      width: 100%;
      margin: 0 2mm;
    }}
  }}
  @page cover {{
    margin: 0;
    @bottom-center {{ content: none; }}
  }}

  * {{ box-sizing: border-box; }}
  html {{ background: #fff; }}
  body {{
    font-family: "Noto Naskh Arabic", "Noto Sans Arabic", "DejaVu Sans", sans-serif;
    color: {INK};
    font-size: 9.8pt;
    line-height: 1.68;
    background: #fff;
    margin: 0;
  }}

  h1, h2, h3 {{
    font-family: "Noto Sans Arabic", "Noto Kufi Arabic", "Noto Naskh Arabic", sans-serif;
    font-weight: 700;
    line-height: 1.35;
  }}
  h1 {{ font-size: 20pt; color: {NAVY}; margin: 0 0 .4em; }}
  h2 {{
    font-size: 12.5pt;
    color: {NAVY};
    margin: 1.35em 0 .55em;
    padding: 0 0 7px;
    border-bottom: 2px solid {TEAL};
    page-break-after: avoid;
  }}
  h2 .num {{
    display: inline-block;
    color: {TEAL};
    font-weight: 700;
    margin-left: 6px;
    font-family: "DejaVu Sans", sans-serif;
    font-size: 11pt;
  }}
  h3 {{
    font-size: 10.2pt;
    color: {NAVY2};
    margin: 1em 0 .4em;
    page-break-after: avoid;
  }}
  p {{ margin: .3em 0 .55em; }}
  strong {{ font-weight: 700; }}

  table {{
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: .55em 0 .95em;
    font-size: 8.7pt;
    border: 1px solid #d5e0e7;
    border-radius: 10px;
    overflow: hidden;
  }}
  th, td {{
    border-bottom: 1px solid #e8eef2;
    padding: 7px 9px;
    text-align: right;
    vertical-align: middle;
  }}
  th {{
    background: linear-gradient(180deg, #f0fdfa 0%, #e6f5f2 100%);
    color: {TEAL_DK};
    font-weight: 700;
    font-family: "Noto Sans Arabic", sans-serif;
    font-size: 8.2pt;
    border-bottom: 1.5px solid #c5ddd8;
  }}
  tr:last-child td {{ border-bottom: none; }}
  tr:nth-child(even) td {{ background: #fafcfd; }}
  td.n, th.n {{
    text-align: left;
    direction: ltr;
    font-family: "DejaVu Sans", sans-serif;
    font-size: 8.2pt;
    font-variant-numeric: tabular-nums;
  }}
  tr.tfoot td {{
    font-weight: 700;
    background: #e6f7f4 !important;
    color: {NAVY};
    border-top: 1.5px solid #b6d9d2;
  }}
  tr.ask td {{
    font-weight: 700;
    background: linear-gradient(90deg, #ecfdf5, #fff7ed) !important;
    color: {NAVY};
    border-top: 2px solid {TEAL};
  }}

  ul.t {{ margin: .2em 0 .75em; padding-right: 1.1em; }}
  ul.t li {{ margin: .18em 0; }}

  /* ── Cover ── */
  .cover {{
    page: cover;
    page-break-after: always;
    min-height: 297mm;
    padding: 18mm 16mm 16mm;
    color: #ecfdf5;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse 80% 55% at 100% 0%, rgba(20,184,166,.32), transparent 55%),
      radial-gradient(ellipse 60% 45% at 0% 100%, rgba(224,90,69,.22), transparent 50%),
      linear-gradient(155deg, #0b1c2c 0%, {NAVY} 38%, {NAVY2} 68%, {TEAL_DK} 100%);
  }}
  .cover-top {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }}
  .cover-brand {{
    display: flex;
    align-items: center;
    gap: 14px;
  }}
  .cover img.logo {{
    height: 52px; width: auto; max-width: 220px; object-fit: contain;
    background: rgba(255,255,255,.06); border-radius: 14px; padding: 8px 12px;
    box-shadow: 0 10px 28px rgba(0,0,0,.28);
  }}
  .brand-name {{
    font-family: "Noto Sans Arabic", "DejaVu Sans", sans-serif;
    font-size: 22pt; font-weight: 700; color: #fff; letter-spacing: 0.02em;
  }}
  .brand-sub {{ font-size: 8.5pt; opacity: .82; margin-top: 2px; }}
  .ver-pill {{
    font-family: "DejaVu Sans", sans-serif;
    font-size: 8pt; color: #ecfdf5;
    border: 1px solid rgba(255,255,255,.35);
    border-radius: 999px; padding: 5px 12px;
    background: rgba(255,255,255,.08);
    white-space: nowrap;
  }}
  .cover-rule {{
    height: 2px; width: 64px; background: {TEAL_LT};
    margin: 22px 0 14px; border-radius: 2px;
  }}
  .eyebrow {{
    font-family: "Noto Sans Arabic", sans-serif;
    font-size: 8.5pt; letter-spacing: .04em; opacity: .88;
    color: {TEAL_LT};
  }}
  .cover h1 {{
    color: #fff; font-size: 26pt; margin: 6px 0 10px; line-height: 1.32;
    max-width: 92%;
  }}
  .tag {{
    font-size: 10.5pt; opacity: .92; max-width: 92%;
    line-height: 1.65; margin: 0 0 16px;
  }}
  .cover img.banner {{
    width: 100%; height: 88px; object-fit: cover; object-position: center;
    border-radius: 14px; margin: 4px 0 18px;
    border: 1px solid rgba(255,255,255,.16);
    box-shadow: 0 8px 20px rgba(0,0,0,.18);
  }}
  .kpis {{
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin-top: 4px;
  }}
  .kpi {{
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(255,255,255,.22);
    border-radius: 14px; padding: 12px 14px;
  }}
  .kpi .l {{
    font-size: 7.8pt; opacity: .82;
    font-family: "Noto Sans Arabic", sans-serif;
  }}
  .kpi .v {{
    font-size: 13pt; font-weight: 700; margin-top: 4px;
    font-family: "Noto Sans Arabic", "DejaVu Sans", sans-serif;
  }}
  .kpi.accent {{
    background: rgba(20,184,166,.18);
    border-color: rgba(20,184,166,.45);
  }}
  .cfoot {{
    margin-top: 20px; font-size: 7.6pt; opacity: .78; line-height: 1.55;
    border-top: 1px solid rgba(255,255,255,.16); padding-top: 12px;
  }}
  .cover-accent {{
    position: absolute; left: 0; right: 0; bottom: 0; height: 7px;
    background: linear-gradient(90deg, {TEAL_LT} 0%, {TEAL} 45%, {CORAL} 100%);
  }}

  /* ── Content chrome ── */
  .callout {{
    background: {MINT_BG};
    border-right: 4px solid {TEAL};
    border-radius: 0 10px 10px 0;
    padding: 10px 12px;
    margin: 8px 0 14px;
    page-break-inside: avoid;
  }}
  .warn {{ background: #fff7ed; border-right-color: {CORAL}; }}
  .coral {{ background: #fff5f3; border-right-color: {CORAL}; }}
  .hl {{ color: {TEAL_DK}; font-weight: 700; }}
  .muted {{ color: {SLATE}; font-size: 8.3pt; }}
  .grid2 {{
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
    align-items: start; margin: 8px 0 12px;
  }}
  .grid2 > .card {{
    min-width: 0;
    max-width: 100%;
    overflow: visible;
  }}
  .card {{
    background: #fff;
    border: 1px solid #d8e4ea;
    border-radius: 12px;
    padding: 12px 13px;
    page-break-inside: avoid;
  }}
  .card h3 {{ margin-top: 0; }}
  .card table {{
    margin-bottom: 0;
    font-size: 8pt;
  }}
  .card table th, .card table td {{ padding: 5px 6px; }}

  .funds-grid {{
    grid-template-columns: 0.95fr 1.05fr;
  }}
  .funds-grid .chart-wrap {{
    padding: 6px 0 2px;
  }}
  .funds-grid .legs {{
    max-width: 100%;
  }}
  .funds-grid .leg {{
    font-size: 7.6pt;
    white-space: normal;
  }}
  .funds-grid .card table {{
    font-size: 7.6pt;
  }}
  .funds-grid .card table th,
  .funds-grid .card table td {{
    padding: 4px 5px;
  }}

  .legs {{
    margin-top: 12px; width: 100%;
    direction: rtl; text-align: right;
  }}
  .leg {{
    font-size: 7.9pt; margin: 6px 0;
    display: flex; gap: 8px; align-items: flex-start;
    line-height: 1.45;
    justify-content: flex-start;
  }}
  .leg b {{ font-weight: 700; }}
  .leg span {{
    width: 10px; height: 10px; border-radius: 3px;
    display: inline-block; flex-shrink: 0; margin-top: 2px;
  }}
  .leg em {{
    color: {SLATE}; font-style: normal;
    direction: ltr; unicode-bidi: isolate;
    font-family: "DejaVu Sans", "Noto Sans Arabic", sans-serif;
  }}
  .chart-wrap {{
    display: flex; flex-direction: column; align-items: center;
    overflow: visible;
    width: 100%;
    gap: 2px;
  }}
  .donut-frame {{
    direction: ltr;
    width: 100%;
    text-align: center;
  }}
  .chart-wrap img.donut {{
    display: inline-block;
    margin: 2px auto 0;
    max-width: 190px;
    width: 100%;
    height: auto;
  }}

  .bmc {{
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;
    margin: 8px 0 12px;
  }}
  .bmc .c {{
    background: #f8fbfc;
    border: 1px solid #d0dce4;
    border-radius: 8px;
    padding: 8px;
    font-size: 7.4pt;
    min-height: 62px;
    page-break-inside: avoid;
  }}
  .bmc .c b {{
    display: block; color: {TEAL}; margin-bottom: 3px;
    font-size: 7.8pt; font-family: "Noto Sans Arabic", sans-serif;
  }}
  .bmc .w {{ grid-column: span 2; }}

  .hbars {{ display: flex; flex-direction: column; gap: 10px; }}
  .hbar {{
    display: grid; grid-template-columns: 78px 1fr 88px;
    gap: 10px; align-items: center;
  }}
  .hlab {{ font-size: 8pt; color: {NAVY}; }}
  .htrack {{
    background: #e8eef2; border-radius: 6px; height: 12px; overflow: hidden;
  }}
  .hfill {{ height: 100%; border-radius: 6px; }}
  .hval {{
    font-size: 7.4pt; direction: ltr; text-align: left;
    font-family: "DejaVu Sans", sans-serif; color: {SLATE};
  }}

  .shots {{
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    margin: 8px 0 14px;
  }}
  .shots.one {{ grid-template-columns: 1fr; }}
  .shots.tri {{ grid-template-columns: 1.15fr 1fr .9fr; }}
  figure.shot {{
    margin: 0; background: #fff;
    border: 1px solid #d0dce4; border-radius: 12px;
    overflow: hidden; page-break-inside: avoid;
    box-shadow: 0 1px 3px rgba(18,38,58,.04);
  }}
  figure.shot img {{
    width: 100%; display: block;
    max-height: 168px; object-fit: cover; object-position: top center;
    background: #0f172a;
  }}
  figure.shot.tall img {{ max-height: 200px; }}
  figure.shot.panel img {{ max-height: 210px; object-position: top right; }}
  figure.shot figcaption {{
    font-size: 7.4pt; color: {SLATE}; padding: 7px 9px;
    line-height: 1.45; border-top: 1px solid #e8eef2;
    background: #fafcfd;
    font-family: "Noto Sans Arabic", sans-serif;
  }}

  .pb {{ page-break-before: always; }}
  .fn {{ font-size: 7.3pt; color: {SLATE}; margin-top: .2em; }}
  .badge {{
    display: inline-block; background: {TEAL}; color: #fff;
    font-size: 7pt; padding: 2px 8px; border-radius: 4px;
    margin-right: 4px; vertical-align: middle;
    font-family: "Noto Sans Arabic", sans-serif;
  }}
  .statrow {{
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 9px; margin: 10px 0 14px;
  }}
  .stat {{
    background: linear-gradient(180deg, #fff 0%, #f7fbfa 100%);
    border: 1px solid #d5e0e7; border-radius: 11px;
    padding: 10px 8px; text-align: center;
    page-break-inside: avoid;
  }}
  .stat .v {{
    font-size: 12pt; font-weight: 700; color: {TEAL_DK};
    direction: ltr; font-family: "DejaVu Sans", sans-serif;
  }}
  .stat .l {{
    font-size: 7.3pt; color: {SLATE}; margin-top: 3px;
    font-family: "Noto Sans Arabic", sans-serif;
  }}
  .divider {{
    height: 1px; background: linear-gradient(90deg, {TEAL_LT}, transparent);
    margin: 14px 0 6px; border: none;
  }}
  svg.ramp {{
    display: block; width: 100%; max-width: 540px;
    margin: 0 auto; height: auto;
  }}
  .ramp-wrap {{
    direction: ltr;
    margin: 8px 0 12px;
    overflow: visible;
    page-break-inside: avoid;
  }}
  .plot-wrap {{
    direction: ltr;
    margin: 10px 0 14px;
    overflow: visible;
    page-break-inside: avoid;
    background: #fff;
    border: 1px solid #d8e4ea;
    border-radius: 12px;
    padding: 10px 12px 8px;
  }}
  .plot-wrap img.plot {{
    display: block;
    width: 100%;
    max-width: 640px;
    height: auto;
    margin: 0 auto;
  }}
  .narrative ol.steps {{
    margin: .35em 0 .8em;
    padding-right: 1.25em;
  }}
  .narrative ol.steps li {{
    margin: .35em 0;
    padding-right: 2px;
  }}
  .ask-hero {{
    display: grid; grid-template-columns: 1.2fr .8fr; gap: 12px;
    margin: 8px 0 14px; page-break-inside: avoid;
  }}
  .ask-box {{
    background: linear-gradient(135deg, {NAVY} 0%, {TEAL_DK} 100%);
    color: #ecfdf5; border-radius: 14px; padding: 14px 16px;
  }}
  .ask-box .l {{ font-size: 8pt; opacity: .85; }}
  .ask-box .v {{
    font-size: 18pt; font-weight: 700; margin-top: 4px;
    font-family: "Noto Sans Arabic", "DejaVu Sans", sans-serif;
  }}
  .ask-box .s {{ font-size: 8pt; opacity: .8; margin-top: 6px; line-height: 1.5; }}
  .ask-side {{
    background: {MINT_BG}; border: 1px solid #c5ddd8;
    border-radius: 14px; padding: 12px 14px;
  }}
  .ask-side .row {{
    display: flex; justify-content: space-between;
    font-size: 8.2pt; padding: 4px 0;
    border-bottom: 1px solid #dceae6;
  }}
  .ask-side .row:last-child {{ border-bottom: none; font-weight: 700; color: {TEAL_DK}; }}
  .ask-side .n {{ direction: ltr; font-family: "DejaVu Sans", sans-serif; }}
</style>
</head>
<body>

<section class="cover">
  <div class="cover-top">
    <div class="cover-brand">
      <img class="logo" src="{logo}" alt="پت‌دیت"/>
      <div>
        <div class="brand-name">پت‌دیت</div>
        <div class="brand-sub">PetDate · petdate.ir</div>
      </div>
    </div>
    <div class="ver-pill">نسخه {DOC_VERSION} · محرمانه</div>
  </div>
  <div class="cover-rule"></div>
  <div class="eyebrow">سند ویژه سرمایه‌گذار · طرح توجیهی</div>
  <h1>طرح توجیهی سرمایه‌گذاری<br/>پت‌دیت (PetDate)</h1>
  <p class="tag">سوپراپ فارسی پت: همبازی، ایونت، پت‌شاپ و مشاوره دامپزشک —
  وب + ربات تلگرام با اقتصاد سکه یکپارچه و پنل ادمین عملیاتی.</p>
  <img class="banner" src="{banner}" alt=""/>
  <div class="kpis">
    <div class="kpi accent">
      <div class="l">سرمایه درخواستی</div>
      <div class="v">۱۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان</div>
    </div>
    <div class="kpi">
      <div class="l">برن ماهانه (با بیمه کارفرما + زیرساخت)</div>
      <div class="v">{fmt(BURN)} تومان</div>
    </div>
    <div class="kpi">
      <div class="l">پوشش کل با این سرمایه</div>
      <div class="v">≈ {ask_months_txt} ماه برن</div>
    </div>
    <div class="kpi">
      <div class="l">سربه‌سر پایه (با ایونت)</div>
      <div class="v">ماه {base['be']}</div>
    </div>
  </div>
  <div class="cfoot">
    بیمه کارفرما ۲۳٪ · مالیات عملکرد ۲۵٪ · زیرساخت فنی {fmt(INFRA_TECH)}/ماه ·
    سکه ≈ {fmt(COIN_TOMAN)} تومان · عضویت ایونت فرض {EVENT_JOIN_FEE_COINS} سکه ·
    دلار AI: {fmt(USD_TOMAN)} تومان<br/>
    بسته سرمایه: راه‌اندازی {fmt(SETUP_TOTAL)} + Runway ۱۲ماه {fmt(RUNWAY)} + بافر {fmt(CONTINGENCY)}
    = <strong>۱۰ میلیارد تومان</strong>.
    اعداد درآمد سناریویی‌اند؛ ترم‌شیت سهام در مذاکره نهایی قفل می‌شود.
  </div>
  <div class="cover-accent"></div>
</section>

<h2><span class="num">۰۱</span> خلاصه اجرایی</h2>
<p><strong>پت‌دیت</strong> پلتفرم همبازی و خدمات پت در ایران است — با لایه ایونت گروهی، شاپ، و مشاوره روی وب و تلگرام.
این سند نیاز سرمایه برای تیم ۶ نفره، دفتر و رشد ۱۲ ماهه را با <strong>بیمه کارفرما</strong>،
<strong>مالیات عملکرد</strong> و <strong>درآمد ایونت</strong> توجیه می‌کند.</p>

<div class="ask-hero">
  <div class="ask-box">
    <div class="l">سرمایه درخواستی (Ask)</div>
    <div class="v">۱۰ میلیارد تومان</div>
    <div class="s">راه‌اندازی ۱٫۵ میلیارد + ۱۲ ماه برن ≈ ۹٫۹۳ میلیارد؛
    بافر عملیاتی نازک برای بسته شدن تمیز روی <strong>۱۰٬۰۰۰٬۰۰۰٬۰۰۰</strong> تومان
    (≈ {ask_months_txt} ماه پوشش کل · ≈ {runway_cover_txt} ماه عملیات پس از راه‌اندازی).</div>
  </div>
  <div class="ask-side">
    <div class="row"><span>برن ماهانه</span><span class="n">{fmt(BURN)}</span></div>
    <div class="row"><span>راه‌اندازی</span><span class="n">{fmt(SETUP_TOTAL)}</span></div>
    <div class="row"><span>Runway ۱۲م</span><span class="n">{fmt(RUNWAY)}</span></div>
    <div class="row"><span>بافر</span><span class="n">{fmt(CONTINGENCY)}</span></div>
    <div class="row"><span>جمع Ask</span><span class="n">{fmt(CAPITAL_ASK)}</span></div>
  </div>
</div>

<div class="statrow">
  <div class="stat"><div class="v">{fmt_dec(BURN/1e6, 1)}M</div><div class="l">برن ماهانه</div></div>
  <div class="stat"><div class="v">۱۰B</div><div class="l">سرمایه درخواستی</div></div>
  <div class="stat"><div class="v">{fmt(int(base['rev']/1e6))}M</div><div class="l">درآمد پایه م۱۲</div></div>
  <div class="stat"><div class="v">{fmt(int(base['events']/1e6))}M</div><div class="l">سهم ایونت م۱۲</div></div>
</div>
<div class="callout">
<strong>پیشنهاد:</strong> جذب <span class="hl">۱۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان</span>
برای راه‌اندازی + Runway تیم ۶ نفره.
برن <strong>{fmt(BURN)}</strong> تومان/ماه (شامل {fmt(INFRA_TECH)} زیرساخت فنی).
در سناریو پایه (با ایونت)، سربه‌سر حدود ماه <strong>{base['be']}</strong>
و بازگشت اصل حدود ماه <strong>{base['pb']}</strong>.
</div>

<h2><span class="num">۰۲</span> مسئله، فرصت و محصول</h2>
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
  <div class="c w"><b>هزینه</b>حقوق، بیمه کارفرما، اجاره، AI، جاری، زیرساخت</div>
</div>

<div class="pb"></div>
<h2><span class="num">۰۳</span> تجربه محصول — وب، چت و همبازی</h2>
<p class="muted">اسکرین‌شات‌های واقعی از محصول جاری پت‌دیت (وب).</p>
<div class="shots">
  {shot("gutters-guides-top-1440.png", "لندینگ وب — معرفی برند و مسیر ورود به خدمات پت‌دیت", "tall")}
  {shot("matches-desktop.png", "همبازی پت — کشف و اتصال صاحبان حیوان خانگی", "tall")}
</div>
<div class="shots">
  {shot("chat-desktop.png", "چت دسکتاپ — گفت‌وگوی درون‌پلتفرمی")}
  {shot("chat-mobile.png", "چت موبایل — تجربه همراه")}
</div>

<h2><span class="num">۰۴</span> پنل ادمین جاری — عملیات، مالی و فروشگاه</h2>
<p>اسکرین‌شات‌های تازه از <strong>پنل ادمین فعلی</strong> پت‌دیت (لوگوی مادر، کنسول عملیاتی):
داشبورد پلتفرم، مالی، P&amp;L، کیف‌پول و سفارش‌های فروشگاه —
ستون اتوماسیون برای رشد بدون نیروی انسانی متناسب.</p>
<div class="shots">
  {shot("admin-finance-dashboard.png", "داشبورد مالی ادمین — درآمد، هزینه، سود و ترکیب پرداخت", "tall panel")}
  {shot("admin_platform_dashboard_kpis.png", "داشبورد پلتفرم — ویجت‌ها و مانیتورینگ ماژول‌ها", "tall panel")}
</div>
<div class="shots">
  {shot("admin-finance-pnl.png", "P&amp;L عملیاتی — سود و زیان قابل گزارش به سرمایه‌گذار", "panel")}
  {shot("admin-finance-wallet.png", "دفتر کیف‌پول — تومان، سکه، ستاره و TON", "panel")}
</div>
<div class="shots">
  {shot("admin-shop-orders.png", "سفارش‌های فروشگاه — صف پرداخت‌شده و رهگیری سفارش", "panel")}
  {shot("admin-finance-sales.png", "نمودار فروش مالی — روند و دسته‌بندی درآمد", "panel")}
</div>

<div class="pb"></div>
<h2><span class="num">۰۵</span> درآمد ایونت‌ها <span class="badge">مدل درآمد</span></h2>
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
<h2><span class="num">۰۶</span> نیروی انسانی و برن ماهانه</h2>
<p class="muted">حقوق‌ها <strong>ناخالص</strong>اند؛ سهم بیمه کارفرما جداگانه به برن اضافه شده است. تیم ۶ نفره.</p>
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
    <tr><td>سرور + هاست + دامنه + زیرساخت فنی</td><td class="n">{fmt(INFRA_TECH)}</td></tr>
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
      <li>زیرساخت فنی: <strong>{fmt(INFRA_TECH)}</strong> تومان/ماه در برن لحاظ شده.</li>
      <li>سرمایه‌گذاری روی مهندس AI → اتوماسیون پشتیبانی و کاهش هزینه نسبی در مقیاس.</li>
    </ul>
  </div>
</div>

<h2><span class="num">۰۶٫۱</span> بیمه و مالیات (فرض ایران)</h2>
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

<h2><span class="num">۰۷</span> اتوماسیون → اهرم عملیاتی</h2>
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
<h2><span class="num">۰۸</span> سرمایه اولیه و Use of Funds</h2>
<div class="callout">
<strong>بسته ۱۰ میلیارد:</strong> راه‌اندازی {fmt(SETUP_TOTAL)} +
Runway ۱۲ ماه ({fmt(BURN)} × ۱۲ = {fmt(RUNWAY)}) =
<strong>{fmt(CAPITAL_BASE)}</strong> تومان؛
بافر عملیاتی <strong>{fmt(CONTINGENCY)}</strong> تومان
تا قفل سرمایه درخواستی روی <span class="hl">۱۰٬۰۰۰٬۰۰۰٬۰۰۰</span>.
</div>
<table>
  <thead><tr><th>جزء</th><th class="n">مبلغ</th></tr></thead>
  <tbody>
    {setup_rows}
    <tr class="tfoot"><td>جمع راه‌اندازی</td><td class="n">{fmt(SETUP_TOTAL)}</td></tr>
    <tr><td>Runway {RUNWAY_MONTHS} ماه × برن {fmt(BURN)}</td><td class="n">{fmt(RUNWAY)}</td></tr>
    <tr class="tfoot"><td>جمع راه‌اندازی + Runway ۱۲م</td><td class="n">{fmt(CAPITAL_BASE)}</td></tr>
    <tr><td>بافر عملیاتی (بسته شدن روی ۱۰ میلیارد)</td><td class="n">{fmt(CONTINGENCY)}</td></tr>
    <tr class="ask"><td>سرمایه درخواستی (Ask)</td><td class="n">{fmt(CAPITAL_ASK)}</td></tr>
  </tbody>
</table>
<div class="grid2 funds-grid">
  <div class="card"><h3>مصرف وجوه</h3>{use_of_funds_pie()}</div>
  <div class="card">
    <h3>جدول سهم</h3>
    <table>
      <thead><tr><th>سرفصل</th><th class="n">مبلغ</th><th class="n">سهم</th></tr></thead>
      <tbody>{use_rows}
        <tr class="ask"><td>جمع</td><td class="n">{fmt(CAPITAL_ASK)}</td><td class="n">۱۰۰٪</td></tr>
      </tbody>
    </table>
    <div class="callout" style="margin-top:8px">
      <span class="hl">۱۰ میلیارد تومان</span> ·
      ≈ <strong>{ask_months_txt}</strong> ماه پوشش کل ·
      ≈ <strong>{runway_cover_txt}</strong> ماه عملیات
    </div>
  </div>
</div>

<div class="pb"></div>
<h2><span class="num">۰۹</span> پیش‌بینی درآمد و سربه‌سر</h2>
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
  (جریان نقدی تجمعی از −۱۰ میلیارد، با رشد ملایم درآمد پس از م۱۲).</li>
  <li>برای پوشش برن با حاشیه ≈۸۵٪، حدود <strong>{fmt(int(BURN/0.85))}</strong> تومان GMV ماهانه لازم است.</li>
  <li>VAT (~۱۰٪) عبورکننده فرض شده و در برن خنثی است.</li>
</ul>

<div class="pb"></div>
<h2><span class="num">۰۹٫۱</span> نمودار بازگشت هزینه اولیه</h2>
<p>از لحظه تزریق <strong>۱۰ میلیارد</strong>، جریان نقدی تجمعی از
<span class="hl">−{fmt(CAPITAL_ASK)}</span> شروع می‌شود.
هر ماه: درآمد − برن ({fmt(BURN)}). نقطه برخورد با صفر =
<strong>بازگشت اصل سرمایه ≈ ماه {base['pb']}</strong>
(در این مدل ≈ {fmt_b(pb_cum/1e6, 0)} میلیون بالای صفر).</p>
{payback_chart_html}
<div class="callout">
<strong>خوانش سرمایه‌گذار:</strong> تا ماه {base['be']} زیان عملیاتی ماهانه طبیعی است
(رمپ لانچ). از ماه {base['be']} به بعد حاشیه مثبت ماهانه جمع می‌شود و تا ماه
<strong>{base['pb']}</strong> کل اصل ۱۰ میلیارد بازیابی می‌شود —
بدون فرض رشد انفجاری؛ فقط رمپ ۱۲ماه + رشد ماهانه ≈{POST_RAMP_GROWTH_M}M پس از آن.
</div>

<h2><span class="num">۰۹٫۲</span> چشم‌انداز سال‌های بعد (۲ تا ۵)</h2>
<p>پس از عبور از Payback، مدل پایه چه چیزی برای سرمایه‌گذار می‌سازد؟
نمودار زیر درآمد سالانه، سود خالص پس از مالیات ۲۵٪، و
<strong>چندبرابر سرمایه (۱ + جریان نقدی تجمعی / ۱۰B)</strong> را نشان می‌دهد.</p>
{later_years_html}
<table>
  <thead>
    <tr><th>سال</th><th class="n">درآمد (میلیارد)</th>
    <th class="n">سود خالص (میلیارد)</th>
    <th class="n">جریان نقدی تجمعی</th>
    <th class="n">چندبرابر Ask</th></tr>
  </thead>
  <tbody>{yearly_rows}</tbody>
</table>
<p class="fn">سال ۲: درآمد ≈ {fmt_b(y2['rev']/1e9, 1)}B · سود خالص ≈ {fmt_b(y2['profit_after']/1e9, 1)}B ·
چندبرابر ≈ {fmt_dec(y2['roi_multiple'], 1)}× —
تا پایان سال ۵ چندبرابر ≈ <strong>{fmt_dec(y5['roi_multiple'], 1)}×</strong>
روی Ask ده میلیارد (فرض رشد ملایم ثابت؛ نه تعهد).</p>

<h2><span class="num">۱۰</span> نقشه راه و ریسک</h2>
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

<div class="pb"></div>
<h2><span class="num">۱۱</span> چرا این سرمایه‌گذاری برای سرمایه‌گذار قابل‌قبول است؟</h2>
<div class="narrative">
<p>این بخش برای سرمایه‌گذار شکاک نوشته شده: نه شعار برند، بلکه
<strong>بستن حلقه اعداد</strong> — از مسئله بازار تا بازگشت اصل و آپساید پس از آن.</p>

<h3>۱) مسئله و بازار — چرا الان؟</h3>
<p>صاحب‌پت در ایران خدمات اجتماعی، ایونت گروهی، خرید و مشاوره را جداگانه و پراکنده می‌گیرد.
تلگرام کانال توزیع آماده است؛ پت‌دیت وب + ربات را با یک حساب و اقتصاد سکه یکپارچه وصل می‌کند.
این یعنی CAC پایین‌تر از اپ‌های خالص موبایل و مسیر ورود کوتاه‌تر به پرداخت.</p>

<h3>۲) موتور درآمد — سکه + ایونت (قابل اندازه‌گیری)</h3>
<ul class="t">
  <li><strong>سکه/VIP:</strong> هسته تکرارشونده؛ قیمت مرجع سکه {fmt(COIN_TOMAN)} تومان.</li>
  <li><strong>ایونت پلتفرمی:</strong> عضویت فرض {EVENT_JOIN_FEE_COINS} سکه/نفر + ساخت {EVENT_CREATE_COST_COINS} سکه —
  در پایه م۱۲ ≈ <strong>{fmt(base['events'])}</strong> تومان روی استک درآمد
  ({fmt(base['rev'])} جمع).</li>
  <li>شاپ و مشاوره حاشیه مکمل‌اند؛ ایونت اهرم رشد اجتماعی و تکرار خرید سکه است.</li>
</ul>

<h3>۳) اتوماسیون → برن ثابت، هزینه به ازای کاربر کاهشی</h3>
<p>برن اسمی ماهانه قفل است روی <strong>{fmt(BURN)}</strong> تومان.
با ربات، AI و پنل ادمین مالی/کیف‌پول، همان تیم ۶–۷ نفره MAU بیشتری را پوشش می‌دهد:
از ≈{fmt(HR_PHASES[0]['cost_per_mau'])} تومان برن/MAU در لانچ تا
≈{fmt(HR_PHASES[2]['cost_per_mau'])} در فاز اتوماسیون —
یعنی مقیاس بدون انفجار HR.</p>

<h3>۴) هزینه‌های واقعی ایران — نه مدل خوش‌بینانه دلاری</h3>
<table>
  <thead><tr><th>قلم</th><th>فرض</th><th class="n">اثر روی مدل</th></tr></thead>
  <tbody>
    <tr><td>بیمه کارفرما</td><td>۲۳٪ روی حقوق ناخالص</td><td class="n">+{fmt(INSURANCE_EMPLOYER)}/ماه</td></tr>
    <tr><td>مالیات عملکرد</td><td>۲۵٪ روی سود مشمول</td><td>در سود خالص و جدول سالانه</td></tr>
    <tr><td>زیرساخت فنی</td><td>سرور + هاست + دامنه</td><td class="n">{fmt(INFRA_TECH)}/ماه داخل برن</td></tr>
    <tr><td>برن کل</td><td>حقوق+بیمه+AI+اجاره+جاری+infra</td><td class="n"><strong>{fmt(BURN)}</strong></td></tr>
  </tbody>
</table>

<h3>۵) بسته سرمایه — Runway شفاف</h3>
<ol class="steps">
  <li>راه‌اندازی یک‌باره: {fmt(SETUP_TOTAL)} تومان.</li>
  <li>۱۲ ماه عملیات: {fmt(BURN)} × ۱۲ = {fmt(RUNWAY)}.</li>
  <li>جمع ≈ {fmt(CAPITAL_BASE)} + بافر نازک {fmt(CONTINGENCY)} =
  <strong>Ask قفل: ۱۰٬۰۰۰٬۰۰۰٬۰۰۰</strong>.</li>
  <li>پوشش: ≈ {ask_months_txt} ماه برن کل · ≈ {runway_cover_txt} ماه عملیات پس از راه‌اندازی —
  یعنی حتی اگر رمپ درآمد کندتر از پایه باشد، زمان کافی برای اصلاح مسیر هست.</li>
</ol>

<h3>۶) سربه‌سر، Payback، و آپساید بعد از بازگشت اصل</h3>
<div class="statrow">
  <div class="stat"><div class="v">م{base['be']}</div><div class="l">سربه‌سر عملیاتی</div></div>
  <div class="stat"><div class="v">م{base['pb']}</div><div class="l">بازگشت اصل ۱۰B</div></div>
  <div class="stat"><div class="v">{fmt_dec(y2['roi_multiple'], 1)}×</div><div class="l">چندبرابر پایان سال ۲</div></div>
  <div class="stat"><div class="v">{fmt_dec(y5['roi_multiple'], 1)}×</div><div class="l">چندبرابر پایان سال ۵</div></div>
</div>
<p>از نگاه سرمایه‌گذار محافظه‌کار: ابتدا اصل در ≈ ماه {base['pb']} برمی‌گردد؛
سپس جریان نقدی تجمعی مثبت می‌ماند و تا سال ۵ — با فرض رشد ملایم —
به حدود <strong>{fmt_dec(y5['roi_multiple'], 1)} برابر Ask</strong> می‌رسد.
این آپساید بعد از Payback است، نه جایگزین بازگشت اصل.</p>

<h3>۷) پوشش ریسک — چرا اعداد «می‌بندند»</h3>
<ul class="t">
  <li><strong>رشد کند:</strong> بافر + KPI ماهانه ایونت/پرداخت؛ مسیر کاهش burn نسبی با اتوماسیون.</li>
  <li><strong>نوسان دلار/AI:</strong> سقف مصرف API؛ قیمت‌گذاری پویا سکه.</li>
  <li><strong>مدل ایونت:</strong> شروع با ایونت پلتفرمی ۱۰۰٪ take؛ کمیسیون میزبان مسیر بعدی است نه وابستگی فعلی.</li>
  <li><strong>رگولاتوری/پرداخت:</strong> چند درگاه؛ گزارش P&amp;L ماهانه به سرمایه‌گذار.</li>
  <li><strong>بیمه/مالیات:</strong> نرخ‌های ایران از روز اول داخل برن و سود خالص‌اند — سورپرایز پنهان کمتر.</li>
</ul>
<div class="callout">
<strong>جمع‌بندی برای ترم‌شیت:</strong>
Ask <span class="hl">۱۰ میلیارد</span> · برن <span class="hl">{fmt_dec(BURN/1e6, 1)}M</span>/ماه ·
سربه‌سر پایه ماه {base['be']} · بازگشت اصل ماه {base['pb']} ·
پس از آن مسیر چندبرابر تا ≈{fmt_dec(y5['roi_multiple'], 1)}× در افق ۵ساله مدل پایه.
محصول واقعی (وب، چت، همبازی، پنل مالی) همین حالا اسکرین دارد — سرمایه برای مقیاس است، نه ساخت از صفر.
</div>
</div>

<h2><span class="num">۱۲</span> پیشنهاد سرمایه‌گذاری</h2>
<ul class="t">
  <li><strong>مبلغ:</strong> ۱۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان (۱۰ میلیارد)</li>
  <li><strong>مصرف:</strong> راه‌اندازی ۱٫۵B + Runway ۱۲ماه تیم ۶ نفره (بیمه کارفرما ۲۳٪) + بافر نازک</li>
  <li><strong>پوشش:</strong> ≈ {ask_months_txt} ماه برن کل · ≈ {runway_cover_txt} ماه عملیات پس از راه‌اندازی</li>
  <li><strong>هدف ۱۲ماه:</strong> عبور از سربه‌سر در سناریو پایه (با استک ایونت)</li>
  <li><strong>بازگشت اصل:</strong> ≈ ماه {base['pb']} در مدل پایه (نمودار ۰۹٫۱)</li>
  <li><strong>گزارش:</strong> P&amp;L ماهانه، MAU، نرخ پرداخت، حجم ایونت، CAC</li>
  <li><strong>سهام/valuation:</strong> در مذاکره ترم‌شیت</li>
</ul>
<div class="callout">
<strong>جمع‌بندی:</strong> برن <span class="hl">{fmt(BURN)}</span> تومان/ماه ·
سرمایه درخواستی <span class="hl">۱۰٬۰۰۰٬۰۰۰٬۰۰۰</span> تومان ·
ایونت پایه م۱۲ ≈ <span class="hl">{fmt(base['events'])}</span> تومان ·
سربه‌سر پایه ماه <span class="hl">{base['be']}</span> ·
Payback ماه <span class="hl">{base['pb']}</span>.
</div>
<p class="muted" style="margin-top:16px;text-align:center">
پت‌دیت · طرح توجیهی سرمایه‌گذاری · اعداد به تومان · نسخه {DOC_VERSION}
</p>
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
- **زیرساخت فنی (سرور + هاست + دامنه): {INFRA_TECH:,}**
- **برن: {BURN:,}** (قبلاً بدون infra: ۶۸۷٬۷۰۰٬۰۰۰)

## سرمایه
- راه‌اندازی: {SETUP_TOTAL:,}
- Runway 12م: {RUNWAY:,}
- جمع پایه (راه‌اندازی + Runway): {CAPITAL_BASE:,}
- بافر عملیاتی (بسته ۱۰ میلیارد): {CONTINGENCY:,}
- **سرمایه درخواستی (Ask): {CAPITAL_ASK:,}** = ۱۰ میلیارد تومان
- پوشش کل: ≈{ASK_MONTHS:.1f} ماه برن · عملیات پس از راه‌اندازی ≈{RUNWAY_COVER_MONTHS:.1f} ماه
- منطق بسته: راه‌اندازی + ۱۲ ماه برن ≈ ۹٫۹۳ میلیارد؛ بافر نازک تا قفل روی ۱۰٬۰۰۰٬۰۰۰٬۰۰۰

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
  - تعریف: جریان نقدی تجمعی از −{CAPITAL_ASK:,}؛ پس از رمپ ۱۲ماه، درآمد ماهانه +{POST_RAMP_GROWTH_M}م رشد؛ اولین ماهی که cum ≥ ۰

## چشم‌انداز سالانه (پایه، سال ۲–۵)
{chr(10).join(
  f"- سال {y['year']}: درآمد {y['rev']:,.0f} · سود خالص {y['profit_after']:,.0f} · cum {y['cum']:,.0f} · ROI {y['roi_multiple']:.1f}×"
  for y in YEARLY if y['year'] >= 2
)}

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
        f"BASE={CAPITAL_BASE:,} CONTINGENCY={CONTINGENCY:,} "
        f"ASK_MO={ASK_MONTHS:.2f} BE_base={base['be']} PB_base={base['pb']} "
        f"VER={DOC_VERSION_LATIN}"
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
