#!/usr/bin/env python3
"""Regenerate the full PetDate icon/brand package from لوگو مادر (mother logo).

لوگو مادر (canonical source of truth):
  packages/web/public/pepito/img/logo.png
  — horizontal pink dog+cat mark + «Pet Date» wordmark (agreed with Mohammad).

ALL surface assets are derived from this single file. Do not invent alternate
marks or neon icons.

Outputs:
  - favicon.svg / favicon.png / favicon.ico  (mark-only, TRANSPARENT bg)
  - apple-touch-icon.png                    (mark-only on soft opaque square)
  - pwa-192.png, pwa-512.png                (mark-only, transparent bg)
  - pwa-512-maskable.png                    (mark-only, soft padded safe zone)
  - brand/petdate-mark.png, brand/petdate-mark-192.png  (same as PWA — mark-only)
  - brand/petdate-og.png, brand/petdate-og.jpg  (FULL mother wordmark)
  - brand/petdate-channel.png, brand/petdate-banner.jpg  (FULL mother wordmark)
  - packages/api/assets/brand/petdate-email-logo.png  (FULL mother wordmark)
  - logo-assets/telegram/bot-profile-*.jpg   (stacked mark + «Pet Date», hi-res, light wash)
  - logo-assets/telegram/panel-profile-*.jpg (stacked mark + «Pet Date», lavender wash)
  - packages/bot/assets/bot-profile.jpg + welcome-logo.jpg  (runtime copies)

PWA / Home Screen policy (Mohammad):
  PWA icons must NOT include logo type/wordmark text — mark/icon only
  (pink dog+cat). Favicon must be transparent (no cream/white fill).
  Site header keeps full لوگو مادر via SiteLogo /
  pepito/img/logo.png / logo-light.png (untouched by this script).
"""

from __future__ import annotations

import base64
import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]  # packages/web
REPO = ROOT.parent.parent
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"
# لوگو مادر — never point this elsewhere without Mohammad's OK
LOGO = PUBLIC / "pepito" / "img" / "logo.png"
API_EMAIL = ROOT.parent / "api" / "assets" / "brand" / "petdate-email-logo.png"
TELEGRAM_DIR = REPO / "logo-assets" / "telegram"
BOT_ASSETS = ROOT.parent / "bot" / "assets"

SOFT = (244, 244, 247, 255)
TRANSPARENT = (0, 0, 0, 0)
OG_TOP = (252, 240, 248, 255)
OG_BOTTOM = (244, 244, 247, 255)
# Soft pink wash for bot (mark-only) — warmer, app-icon feel
TG_BOT_TOP = (255, 228, 240, 255)
TG_BOT_BOTTOM = (252, 244, 248, 255)
# Cooler lavender wash for panel (stacked mother) — distinct from bot
TG_PANEL_TOP = (244, 240, 255, 255)
TG_PANEL_BOTTOM = (248, 246, 252, 255)
TG_TOP = TG_BOT_TOP
TG_BOTTOM = TG_BOT_BOTTOM
TELEGRAM_SIZES = (512, 640, 1024)


def load_logo() -> Image.Image:
    if not LOGO.is_file():
        raise SystemExit(f"Missing لوگو مادر (mother logo): {LOGO}")
    return Image.open(LOGO).convert("RGBA")


def extract_mark(logo: Image.Image) -> Image.Image:
    """Crop the left dog+cat heart before the wordmark gap (from لوگو مادر).

    Used for PWA / favicon / apple-touch — no «Pet Date» type on home screen.
    """
    w, h = logo.size
    pixels = logo.load()
    col_counts: list[int] = []
    for x in range(w):
        c = 0
        for y in range(h):
            r, g, b, a = pixels[x, y]
            if a >= 20 and r + g + b >= 40:
                c += 1
        col_counts.append(c)

    start = next(i for i, c in enumerate(col_counts) if c > 5)
    empty_run = 0
    gap_start = None
    for i in range(start, w):
        if col_counts[i] < 3:
            empty_run += 1
            if empty_run >= 8:
                gap_start = i - empty_run + 1
                break
        else:
            empty_run = 0
    if gap_start is None:
        gap_start = w

    mxs: list[int] = []
    mys: list[int] = []
    for y in range(h):
        for x in range(start, gap_start):
            r, g, b, a = pixels[x, y]
            if a >= 20 and r + g + b >= 40:
                mxs.append(x)
                mys.append(y)

    pad = 2
    left = max(0, min(mxs) - pad)
    top = max(0, min(mys) - pad)
    right = min(w, max(mxs) + pad + 1)
    bottom = min(h, max(mys) + pad + 1)
    mark = logo.crop((left, top, right, bottom)).copy()

    mp = mark.load()
    for y in range(mark.size[1]):
        for x in range(mark.size[0]):
            rr, gg, bb, aa = mp[x, y]
            if rr + gg + bb < 45:
                mp[x, y] = (0, 0, 0, 0)
    return mark


def extract_wordmark(logo: Image.Image) -> Image.Image:
    """Crop the «Pet Date» type to the right of the mark gap (from لوگو مادر)."""
    w, h = logo.size
    pixels = logo.load()
    col_counts: list[int] = []
    for x in range(w):
        c = 0
        for y in range(h):
            r, g, b, a = pixels[x, y]
            if a >= 20 and r + g + b >= 40:
                c += 1
        col_counts.append(c)

    start = next(i for i, c in enumerate(col_counts) if c > 5)
    empty_run = 0
    gap_end = None
    for i in range(start, w):
        if col_counts[i] < 3:
            empty_run += 1
        else:
            if empty_run >= 8:
                gap_end = i
                break
            empty_run = 0
    if gap_end is None:
        gap_end = start + (w - start) // 3

    mxs: list[int] = []
    mys: list[int] = []
    for y in range(h):
        for x in range(gap_end, w):
            r, g, b, a = pixels[x, y]
            if a >= 20 and r + g + b >= 40:
                mxs.append(x)
                mys.append(y)
    if not mxs:
        return logo.crop((gap_end, 0, w, h)).copy()

    pad = 2
    left = max(gap_end, min(mxs) - pad)
    top = max(0, min(mys) - pad)
    right = min(w, max(mxs) + pad + 1)
    bottom = min(h, max(mys) + pad + 1)
    word = logo.crop((left, top, right, bottom)).copy()
    wp = word.load()
    for y in range(word.size[1]):
        for x in range(word.size[0]):
            rr, gg, bb, aa = wp[x, y]
            if rr + gg + bb < 45:
                wp[x, y] = (0, 0, 0, 0)
    return word


def sample_brand_colors(logo: Image.Image) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    """Median pink (mark) + purple (wordmark) from لوگو مادر."""
    w, h = logo.size
    pixels = logo.load()
    pinks: list[tuple[int, int, int]] = []
    purples: list[tuple[int, int, int]] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 200:
                continue
            if r > 180 and b > 140 and g < 200 and r > g:
                pinks.append((r, g, b))
            if b > r and b > g and r < 140 and b > 100:
                purples.append((r, g, b))
    pink = sorted(pinks)[len(pinks) // 2] if pinks else (231, 137, 186)
    purple = sorted(purples)[len(purples) // 2] if purples else (88, 72, 140)
    return pink, purple


def upscale_mark_crisp(mark: Image.Image, factor: int = 10) -> Image.Image:
    """Progressive LANCZOS upscale + unsharp — keeps mother mark as sharp as raster allows."""
    from PIL import ImageFilter

    cur = mark
    target_w = mark.size[0] * factor
    target_h = mark.size[1] * factor
    while cur.size[0] < target_w or cur.size[1] < target_h:
        nw = min(cur.size[0] * 2, target_w)
        nh = min(cur.size[1] * 2, target_h)
        cur = cur.resize((nw, nh), Image.Resampling.LANCZOS)
    r, g, b, a = cur.split()
    rgb = Image.merge("RGB", (r, g, b)).filter(
        ImageFilter.UnsharpMask(radius=3.0, percent=170, threshold=2)
    )
    out = rgb.convert("RGBA")
    out.putalpha(a)
    return out


def make_named_lockup(
    logo: Image.Image,
    *,
    bg_top: tuple[int, int, int, int],
    bg_bottom: tuple[int, int, int, int],
    master_size: int = 2048,
) -> Image.Image:
    """Mark from لوگو مادر + crisp vector «Pet Date» (Inter Bold) on soft wash."""
    from PIL import ImageDraw, ImageFont, ImageFilter

    _, purple = sample_brand_colors(logo)
    mark_hi = upscale_mark_crisp(extract_mark(logo), factor=10)
    bg = vertical_gradient((master_size, master_size), bg_top, bg_bottom)

    mark_target_w = int(master_size * 0.62)
    scale = mark_target_w / mark_hi.size[0]
    mw, mh = max(1, int(mark_hi.size[0] * scale)), max(1, int(mark_hi.size[1] * scale))
    mark_r = mark_hi.resize((mw, mh), Image.Resampling.LANCZOS)

    font_path = Path("/usr/share/fonts/truetype/macos/Inter-Bold.ttf")
    if not font_path.is_file():
        font_path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    text = "Pet Date"
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    lo, hi, best = 40, 500, 140
    for _ in range(24):
        mid = (lo + hi) // 2
        font = ImageFont.truetype(str(font_path), mid)
        bb = probe.textbbox((0, 0), text, font=font)
        tw = bb[2] - bb[0]
        if tw < master_size * 0.62:
            lo = mid
            best = mid
        else:
            hi = mid
    font = ImageFont.truetype(str(font_path), best)
    bb = probe.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    gap = int(master_size * 0.05)
    total_h = mh + gap + th
    top0 = (master_size - total_h) // 2 - int(master_size * 0.015)
    bg.alpha_composite(mark_r, ((master_size - mw) // 2, top0))
    draw = ImageDraw.Draw(bg)
    draw.text(
        ((master_size - tw) // 2 - bb[0], top0 + mh + gap - bb[1]),
        text,
        font=font,
        fill=(*purple, 255),
    )
    return bg


def make_telegram_avatar(
    asset: Image.Image,
    size: int,
    *,
    content_ratio: float = 1.0,
    top: tuple[int, int, int, int] = TG_BOT_TOP,
    bottom: tuple[int, int, int, int] = TG_BOT_BOTTOM,
    supersample: int = 1,
) -> Image.Image:
    """If asset is already a full square lockup, just downscale; else fit on wash."""
    from PIL import ImageFilter

    if asset.size[0] == asset.size[1] and content_ratio >= 0.99:
        rgb = asset.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
        return rgb.filter(ImageFilter.UnsharpMask(radius=0.7, percent=85, threshold=1)).convert(
            "RGBA"
        )

    master = size * max(1, supersample)
    under = vertical_gradient((master, master), top, bottom)
    overlay = fit_on_canvas(
        asset, (master, master), bg=(0, 0, 0, 0), content_ratio=content_ratio
    )
    under.alpha_composite(overlay)
    if master != size:
        under = under.resize((size, size), Image.Resampling.LANCZOS)
    return under


def save_jpg(im: Image.Image, path: Path, *, quality: int = 98) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(
        path,
        "JPEG",
        quality=quality,
        optimize=True,
        progressive=False,
        subsampling=0,
    )


def write_telegram_assets(logo: Image.Image, mark: Image.Image) -> list[Path]:
    """Bot + panel: mother mark + crisp «Pet Date» name; distinct background washes."""
    from PIL import ImageFilter

    del mark  # mark-only bot avatar retired — name is required on bot profile
    TELEGRAM_DIR.mkdir(parents=True, exist_ok=True)
    BOT_ASSETS.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    bot_lockup = make_named_lockup(
        logo,
        bg_top=(255, 252, 254, 255),
        bg_bottom=(255, 242, 248, 255),
        master_size=2048,
    )
    panel_lockup = make_named_lockup(
        logo,
        bg_top=TG_PANEL_TOP,
        bg_bottom=TG_PANEL_BOTTOM,
        master_size=2048,
    )

    bot_by_size: dict[int, Path] = {}
    for size in TELEGRAM_SIZES:
        avatar = make_telegram_avatar(bot_lockup, size, content_ratio=1.0)
        dest = TELEGRAM_DIR / f"bot-profile-{size}.jpg"
        save_jpg(avatar, dest)
        bot_by_size[size] = dest
        written.append(dest)

    # Lossless PNG master for Telegram upload (sharpest)
    bot_png = TELEGRAM_DIR / "bot-profile-1024.png"
    bot_lockup.resize((1024, 1024), Image.Resampling.LANCZOS).convert("RGB").save(
        bot_png, "PNG", optimize=True
    )
    written.append(bot_png)

    for size in TELEGRAM_SIZES:
        avatar = make_telegram_avatar(panel_lockup, size, content_ratio=1.0)
        dest = TELEGRAM_DIR / f"panel-profile-{size}.jpg"
        save_jpg(avatar, dest)
        written.append(dest)

    panel_png = TELEGRAM_DIR / "panel-profile-1024.png"
    panel_lockup.resize((1024, 1024), Image.Resampling.LANCZOS).convert("RGB").save(
        panel_png, "PNG", optimize=True
    )
    written.append(panel_png)

    runtime_bot = BOT_ASSETS / "bot-profile.jpg"
    runtime_welcome = BOT_ASSETS / "welcome-logo.jpg"
    runtime_bot.write_bytes(bot_by_size[640].read_bytes())
    runtime_welcome.write_bytes(bot_by_size[1024].read_bytes())
    written.extend([runtime_bot, runtime_welcome])
    return written


def fit_on_canvas(
    asset: Image.Image,
    size: tuple[int, int],
    *,
    bg: tuple[int, int, int, int] = SOFT,
    content_ratio: float = 0.68,
    maskable_safe: bool = False,
) -> Image.Image:
    canvas = Image.new("RGBA", size, bg)
    aw, ah = asset.size
    cw, ch = size
    ratio = 0.55 if maskable_safe else content_ratio
    target_w = int(cw * ratio)
    target_h = int(ch * ratio)
    scale = min(target_w / aw, target_h / ah)
    nw, nh = max(1, int(aw * scale)), max(1, int(ah * scale))
    resized = asset.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (cw - nw) // 2
    oy = (ch - nh) // 2
    canvas.alpha_composite(resized, (ox, oy))
    return canvas


def make_square_icon(
    asset: Image.Image,
    size: int,
    content_ratio: float = 0.68,
    *,
    bg: tuple[int, int, int, int] = SOFT,
) -> Image.Image:
    return fit_on_canvas(asset, (size, size), bg=bg, content_ratio=content_ratio)


def vertical_gradient(size: tuple[int, int], top: tuple, bottom: tuple) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        a = int(top[3] + (bottom[3] - top[3]) * t)
        for x in range(w):
            px[x, y] = (r, g, b, a)
    return img


def make_og(logo: Image.Image) -> Image.Image:
    w, h = 1200, 630
    canvas = vertical_gradient((w, h), OG_TOP, OG_BOTTOM)
    target_w = int(w * 0.72)
    scale = target_w / logo.size[0]
    nw, nh = max(1, int(logo.size[0] * scale)), max(1, int(logo.size[1] * scale))
    if nh > int(h * 0.42):
        scale = (h * 0.42) / logo.size[1]
        nw, nh = max(1, int(logo.size[0] * scale)), max(1, int(logo.size[1] * scale))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (w - nw) // 2
    oy = (h - nh) // 2
    canvas.alpha_composite(resized, (ox, oy))
    return canvas


def make_channel_square(logo: Image.Image, size: int = 1024) -> Image.Image:
    under = vertical_gradient((size, size), OG_TOP, OG_BOTTOM)
    overlay = fit_on_canvas(logo, (size, size), bg=(0, 0, 0, 0), content_ratio=0.78)
    under.alpha_composite(overlay)
    return under


def write_favicon_svg(mark: Image.Image, dest: Path) -> None:
    buf = io.BytesIO()
    side = max(mark.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(mark, ((side - mark.size[0]) // 2, (side - mark.size[1]) // 2))
    sq.resize((128, 128), Image.Resampling.LANCZOS).save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Pet Date">
  <!-- Derived from لوگو مادر packages/web/public/pepito/img/logo.png (mark crop — no wordmark) -->
  <image href="data:image/png;base64,{b64}" width="128" height="128" preserveAspectRatio="xMidYMid meet"/>
</svg>
"""
    dest.write_text(svg, encoding="utf-8")


def save_png(im: Image.Image, path: Path, *, rgb: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = im.convert("RGB") if rgb else im
    out.save(path, "PNG", optimize=True)


def main() -> int:
    BRAND.mkdir(parents=True, exist_ok=True)
    API_EMAIL.parent.mkdir(parents=True, exist_ok=True)

    logo = load_logo()
    mark = extract_mark(logo)
    print(f"لوگو مادر: {LOGO} ({logo.size[0]}x{logo.size[1]})")
    print(f"Mark crop (PWA/favicon — no type): {mark.size[0]}x{mark.size[1]}")

    # PWA + apple-touch + brand marks: MARK ONLY (pink dog+cat), no «Pet Date» text.
    # Favicon + any/maskable-any PWA: transparent bg (no cream/white fill).
    # Maskable + apple-touch: soft opaque fill (safe zone / iOS).
    # Site header keeps full mother via pepito/img/logo.png (not rewritten here).
    pwa_512 = make_square_icon(mark, 512, 0.78, bg=TRANSPARENT)
    pwa_192 = make_square_icon(mark, 192, 0.78, bg=TRANSPARENT)
    apple = make_square_icon(mark, 180, 0.78, bg=SOFT)
    maskable = fit_on_canvas(
        mark, (512, 512), bg=SOFT, content_ratio=0.72, maskable_safe=True
    )
    favicon_32 = make_square_icon(mark, 32, 0.78, bg=TRANSPARENT)
    save_png(pwa_512, PUBLIC / "pwa-512.png")
    save_png(pwa_192, PUBLIC / "pwa-192.png")
    save_png(apple, PUBLIC / "apple-touch-icon.png", rgb=True)
    save_png(maskable, PUBLIC / "pwa-512-maskable.png", rgb=True)
    save_png(favicon_32, PUBLIC / "favicon.png")
    save_png(pwa_512, BRAND / "petdate-mark.png")
    save_png(pwa_192, BRAND / "petdate-mark-192.png")

    # Email CID: full horizontal mother logo on soft bg.
    email_w = 240
    scale = email_w / logo.size[0]
    enw, enh = max(1, int(logo.size[0] * scale)), max(1, int(logo.size[1] * scale))
    email_logo = logo.resize((enw, enh), Image.Resampling.LANCZOS)
    pad_x, pad_y = 12, 10
    email_canvas = Image.new("RGBA", (enw + pad_x * 2, enh + pad_y * 2), SOFT)
    email_canvas.alpha_composite(email_logo, (pad_x, pad_y))
    save_png(email_canvas, API_EMAIL, rgb=True)

    # ICO from mark crop — transparent bg (readable at 16/32/48)
    ico_base = make_square_icon(mark, 256, 0.78, bg=TRANSPARENT).convert("RGBA")
    ico_base.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    write_favicon_svg(mark, PUBLIC / "favicon.svg")

    # OG / channel / banner: FULL mother wordmark (marketing surfaces)
    og = make_og(logo)
    save_png(og, BRAND / "petdate-og.png")
    og.convert("RGB").save(BRAND / "petdate-og.jpg", "JPEG", quality=90, optimize=True)

    save_png(make_channel_square(logo, 1024), BRAND / "petdate-channel.png")
    og.convert("RGB").save(BRAND / "petdate-banner.jpg", "JPEG", quality=90, optimize=True)

    telegram_paths = write_telegram_assets(logo, mark)

    print("Wrote (PWA/favicon = mark-only; OG/email/panel = full mother; bot TG = mark-only):")
    for p in [
        PUBLIC / "favicon.ico",
        PUBLIC / "favicon.png",
        PUBLIC / "favicon.svg",
        PUBLIC / "apple-touch-icon.png",
        PUBLIC / "pwa-192.png",
        PUBLIC / "pwa-512.png",
        PUBLIC / "pwa-512-maskable.png",
        BRAND / "petdate-mark.png",
        BRAND / "petdate-mark-192.png",
        BRAND / "petdate-og.png",
        BRAND / "petdate-og.jpg",
        BRAND / "petdate-channel.png",
        BRAND / "petdate-banner.jpg",
        API_EMAIL,
        *telegram_paths,
    ]:
        rel = p.relative_to(REPO) if p.is_relative_to(REPO) else p
        print(f"  {rel} ({p.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
