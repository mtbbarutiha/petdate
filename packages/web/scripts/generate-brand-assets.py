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
  - logo-assets/telegram/bot-profile-*.jpg   (mark-only, circle-crop safe)
  - logo-assets/telegram/panel-profile-*.jpg (FULL mother wordmark)
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
# Soft pink→lavender wash — readable on Telegram's dark/light circular crop
TG_TOP = (255, 236, 245, 255)
TG_BOTTOM = (244, 244, 250, 255)
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


def make_telegram_avatar(
    asset: Image.Image,
    size: int,
    *,
    content_ratio: float,
) -> Image.Image:
    """Square JPG-ready avatar with padding so Telegram's circular crop keeps the mark.

    Telegram profile photos are shown as circles; keep content inside ~62–72% of
    the square so dog/cat ears and wordmark edges are not clipped.
    """
    under = vertical_gradient((size, size), TG_TOP, TG_BOTTOM)
    overlay = fit_on_canvas(
        asset, (size, size), bg=(0, 0, 0, 0), content_ratio=content_ratio
    )
    under.alpha_composite(overlay)
    return under


def save_jpg(im: Image.Image, path: Path, *, quality: int = 92) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(path, "JPEG", quality=quality, optimize=True, progressive=True)


def write_telegram_assets(logo: Image.Image, mark: Image.Image) -> list[Path]:
    """Bot = mark-only; panel/channel = full mother wordmark. Also sync bot runtime JPGs."""
    TELEGRAM_DIR.mkdir(parents=True, exist_ok=True)
    BOT_ASSETS.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    # BotFather / @Petdatebot avatar — mark only (no «Pet Date» type)
    bot_by_size: dict[int, Path] = {}
    for size in TELEGRAM_SIZES:
        # ~0.68 keeps dog/cat ears inside the circular crop with comfortable padding
        avatar = make_telegram_avatar(mark, size, content_ratio=0.68)
        dest = TELEGRAM_DIR / f"bot-profile-{size}.jpg"
        save_jpg(avatar, dest)
        bot_by_size[size] = dest
        written.append(dest)

    # Panel / channel / @petdating — full horizontal mother logo
    for size in TELEGRAM_SIZES:
        # Wide wordmark uses most of the horizontal diameter; vertical stays padded
        avatar = make_telegram_avatar(logo, size, content_ratio=0.82)
        dest = TELEGRAM_DIR / f"panel-profile-{size}.jpg"
        save_jpg(avatar, dest)
        written.append(dest)

    # Runtime copies used by packages/bot (welcome photo + optional local profile)
    bot_640 = bot_by_size[640]
    bot_1024 = bot_by_size[1024]
    runtime_bot = BOT_ASSETS / "bot-profile.jpg"
    runtime_welcome = BOT_ASSETS / "welcome-logo.jpg"
    runtime_bot.write_bytes(bot_640.read_bytes())
    runtime_welcome.write_bytes(bot_1024.read_bytes())
    written.extend([runtime_bot, runtime_welcome])
    return written


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
