#!/usr/bin/env python3
"""Generate charts for petdate investor PDF."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

try:
    import arabic_reshaper
    from bidi.algorithm import get_display

    def fa(t: str) -> str:
        return get_display(arabic_reshaper.reshape(t))
except Exception:

    def fa(t: str) -> str:
        return t

ROOT = Path("/agent/artifacts/investor-plan")
CHARTS = ROOT / "charts"
CHARTS.mkdir(parents=True, exist_ok=True)

NAVY = "#12263a"
NAVY2 = "#1a3a52"
TEAL = "#0f766e"
TEAL_LT = "#14b8a6"
CORAL = "#e05a45"
CORAL_LT = "#f07168"
WHITE = "#ffffff"
INK = "#1c2430"
MUTED = "#5a6a7a"
GRID = "#d8e0e8"

plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "axes.facecolor": WHITE,
        "figure.facecolor": WHITE,
        "axes.edgecolor": GRID,
        "axes.labelcolor": INK,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "text.color": INK,
    }
)

BURN = 538
PAYROLL = 330
AI_API = 88
RENT = 70
OPEX = 50
SETUP = 1090
RUNWAY = BURN * 12
ASK = RUNWAY + SETUP

UNIT_BASE = 20400
UNIT_PESS = 12000
UNIT_OPT = 30000

MAU_BASE = [
    1500, 3000, 5000, 8000, 11000, 15000, 18000, 22000, 26000,
    29000, 32000, 35000, 39000, 43000, 47000, 50000, 52500, 55000,
]
MAU_PESS = [
    800, 1500, 2500, 4000, 5500, 7000, 8500, 10000, 11500,
    12500, 13500, 15000, 16000, 17500, 19000, 20000, 21000, 22000,
]
MAU_OPT = [
    2500, 5000, 8000, 12000, 18000, 25000, 32000, 40000, 48000,
    54000, 57000, 60000, 68000, 76000, 84000, 90000, 95000, 100000,
]


def rev(mau, unit):
    return [m * unit / 1_000_000 for m in mau]


REV_BASE = rev(MAU_BASE, UNIT_BASE)
REV_PESS = rev(MAU_PESS, UNIT_PESS)
REV_OPT = rev(MAU_OPT, UNIT_OPT)
PNL_BASE = [r - BURN for r in REV_BASE]
BE_MONTH = next(i + 1 for i, p in enumerate(PNL_BASE) if p >= 0)


def save_fig(fig, name: str) -> Path:
    p = CHARTS / name
    fig.savefig(p, dpi=160, bbox_inches="tight", facecolor=WHITE, edgecolor="none")
    plt.close(fig)
    return p


def chart_burn_pie():
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    sizes = [PAYROLL, AI_API, RENT, OPEX]
    labels = [fa("حقوق ۵ نفر"), fa("AI API"), fa("اجاره"), fa("جاری")]
    colors = [NAVY, TEAL, CORAL, "#7c9aab"]
    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        colors=colors,
        autopct=lambda p: f"{p:.0f}%",
        startangle=90,
        explode=(0.02, 0.02, 0.02, 0.02),
        pctdistance=0.72,
        textprops={"fontsize": 10},
    )
    for at in autotexts:
        at.set_color(WHITE)
        at.set_fontweight("bold")
        at.set_fontsize(9)
    ax.set_title(fa(f"ترکیب Burn ماهانه — {BURN} میلیون تومان"), fontsize=12, pad=12, color=NAVY)
    return save_fig(fig, "burn_pie.png")


def chart_use_of_funds():
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    sizes = [RUNWAY, 200, 210, 80, 450, 150]
    labels = [
        fa("Runway ۱۲ماه"),
        fa("تجهیزات"),
        fa("ودیعه دفتر"),
        fa("حقوقی"),
        fa("مارکتینگ لانچ"),
        fa("احتیاطی"),
    ]
    colors = [NAVY, TEAL, TEAL_LT, "#7c9aab", CORAL, CORAL_LT]
    wedges, texts, autotexts = ax.pie(
        sizes,
        colors=colors,
        autopct=lambda p: f"{p:.0f}%" if p >= 4 else "",
        startangle=100,
        pctdistance=0.75,
        textprops={"fontsize": 9},
    )
    for at in autotexts:
        at.set_color(WHITE)
        at.set_fontweight("bold")
    ax.legend(wedges, labels, loc="center left", bbox_to_anchor=(1.0, 0.5), fontsize=9, frameon=False)
    ax.set_title(fa(f"مصرف وجوه — مجموع {ASK:,} میلیون تومان"), fontsize=12, pad=12, color=NAVY)
    return save_fig(fig, "use_of_funds.png")


def chart_revenue_scenarios():
    fig, ax = plt.subplots(figsize=(8.5, 4.0))
    months = list(range(1, 19))
    ax.plot(months, REV_PESS, color="#7c9aab", lw=2, ls="--", label=fa("بدبینانه"))
    ax.plot(months, REV_BASE, color=TEAL, lw=2.6, label=fa("پایه"))
    ax.plot(months, REV_OPT, color=CORAL, lw=2, ls="-.", label=fa("خوش‌بینانه"))
    ax.axhline(BURN, color=NAVY, lw=1.4, ls=":", label=fa(f"Burn = {BURN}"))
    ax.fill_between(months, REV_BASE, BURN, where=[r >= BURN for r in REV_BASE], alpha=0.12, color=TEAL)
    ax.set_xlabel(fa("ماه"), fontsize=10)
    ax.set_ylabel(fa("درآمد (میلیون تومان)"), fontsize=10)
    ax.set_xticks(months)
    ax.set_xlim(1, 18)
    ax.grid(True, alpha=0.35, color=GRID)
    ax.legend(loc="upper left", fontsize=9, frameon=False)
    ax.set_title(fa("مسیر درآمد ۱۸ماهه در سه سناریو"), fontsize=12, color=NAVY, pad=10)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    return save_fig(fig, "revenue_scenarios.png")


def chart_pnl_bars():
    fig, ax = plt.subplots(figsize=(8.5, 3.8))
    months = list(range(1, 19))
    colors = [CORAL if p < 0 else TEAL for p in PNL_BASE]
    ax.bar(months, PNL_BASE, color=colors, width=0.72, edgecolor="none")
    ax.axhline(0, color=NAVY, lw=1)
    ax.set_xlabel(fa("ماه"), fontsize=10)
    ax.set_ylabel(fa("سود/زیان ماهانه (میلیون)"), fontsize=10)
    ax.set_xticks(months)
    ax.grid(True, axis="y", alpha=0.35, color=GRID)
    ax.set_title(fa("سود و زیان ماهانه — سناریوی پایه"), fontsize=12, color=NAVY, pad=10)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.annotate(
        fa(f"سربه‌سر ≈ ماه {BE_MONTH}"),
        xy=(BE_MONTH, PNL_BASE[BE_MONTH - 1]),
        xytext=(BE_MONTH + 1.5, 220),
        fontsize=9,
        color=NAVY,
        arrowprops=dict(arrowstyle="->", color=NAVY, lw=1),
    )
    return save_fig(fig, "pnl_bars.png")


def chart_mau_growth():
    fig, ax = plt.subplots(figsize=(8.5, 3.6))
    months = list(range(1, 19))
    ax.fill_between(months, MAU_BASE, alpha=0.18, color=TEAL)
    ax.plot(months, MAU_BASE, color=TEAL, lw=2.5, marker="o", ms=3.5, label=fa("MAU پایه"))
    ax.axhline(26373, color=CORAL, lw=1.3, ls="--", label=fa("MAU سربه‌سر ≈ ۲۶٫۴k"))
    ax.set_xlabel(fa("ماه"), fontsize=10)
    ax.set_ylabel(fa("کاربر فعال ماهانه"), fontsize=10)
    ax.set_xticks(months)
    ax.yaxis.set_major_formatter(
        plt.FuncFormatter(lambda x, _: f"{int(x / 1000)}k" if x >= 1000 else str(int(x)))
    )
    ax.grid(True, alpha=0.35, color=GRID)
    ax.legend(loc="upper left", fontsize=9, frameon=False)
    ax.set_title(fa("رشد MAU — سناریوی پایه"), fontsize=12, color=NAVY, pad=10)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    return save_fig(fig, "mau_growth.png")


def chart_unit_stack():
    fig, ax = plt.subplots(figsize=(5.5, 3.6))
    cats = [fa("سکه/VIP"), fa("پت‌شاپ"), fa("دامپزشک")]
    vals = [12.5, 6.4, 1.5]
    colors = [NAVY, TEAL, CORAL]
    bars = ax.barh(cats, vals, color=colors, height=0.55)
    ax.set_xlabel(fa("هزار تومان به ازای هر MAU / ماه"), fontsize=9)
    ax.set_title(fa("اقتصاد واحد پایه — جمع ۲۰٫۴ هزار تومان"), fontsize=11, color=NAVY, pad=10)
    for b, v in zip(bars, vals):
        ax.text(v + 0.3, b.get_y() + b.get_height() / 2, f"{v}", va="center", fontsize=10, color=INK)
    ax.set_xlim(0, 16)
    ax.grid(True, axis="x", alpha=0.35, color=GRID)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    return save_fig(fig, "unit_economics.png")


def chart_bmc():
    fig, ax = plt.subplots(figsize=(10, 5.2))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5.2)
    ax.axis("off")
    cells = [
        (0, 2.6, 2, 2.6, TEAL, "شرکای کلیدی", "تلگرام·دامپزشکان\nتأمین‌کنندگان پت‌شاپ\nپرداخت‌یار"),
        (2, 3.9, 2, 1.3, NAVY, "فعالیت‌های کلیدی", "مچ همبازی·AI\nفروشگاه·پشتیبانی"),
        (2, 2.6, 2, 1.3, NAVY2, "منابع کلیدی", "محصول·برند\nداده مچ·تیم"),
        (4, 2.6, 2, 2.6, CORAL, "ارزش پیشنهادی", "همبازی امن پت\nسکه·VIP·فروشگاه\nمشاوره دامپزشک"),
        (6, 3.9, 2, 1.3, TEAL_LT, "روابط مشتری", "چت·بات·CRM\nباشگاه VIP"),
        (6, 2.6, 2, 1.3, "#0d9488", "کانال‌ها", "petdate.ir\nربات تلگرام"),
        (8, 2.6, 2, 2.6, "#c45c4a", "بخش‌های مشتری", "صاحبین سگ/گربه\nشهری ایران\nدامپزشکان"),
        (0, 0, 5, 2.4, "#3d5a73", "ساختار هزینه", f"Burn {BURN}M/ماه · حقوق·API·اجاره·جاری"),
        (5, 0, 5, 2.4, "#b85a48", "جریان درآمد", "سکه/VIP · حاشیه فروشگاه · کارمزد مشاوره"),
    ]
    for x, y, w, h, c, title, body in cells:
        ax.add_patch(
            FancyBboxPatch(
                (x + 0.05, y + 0.05),
                w - 0.1,
                h - 0.1,
                boxstyle="round,pad=0.02,rounding_size=0.08",
                facecolor=c,
                edgecolor=WHITE,
                linewidth=2,
            )
        )
        ax.text(
            x + w / 2,
            y + h - 0.35,
            fa(title),
            ha="center",
            va="top",
            color=WHITE,
            fontsize=9,
            fontweight="bold",
        )
        ax.text(
            x + w / 2,
            y + h / 2 - 0.15,
            fa(body),
            ha="center",
            va="center",
            color=WHITE,
            fontsize=7.5,
            linespacing=1.35,
        )
    ax.set_title(fa("بوم مدل کسب‌وکار petdate"), fontsize=13, color=NAVY, pad=8)
    return save_fig(fig, "bmc.png")


if __name__ == "__main__":
    for fn in (
        chart_burn_pie,
        chart_use_of_funds,
        chart_revenue_scenarios,
        chart_pnl_bars,
        chart_mau_growth,
        chart_unit_stack,
        chart_bmc,
    ):
        p = fn()
        print("wrote", p)
