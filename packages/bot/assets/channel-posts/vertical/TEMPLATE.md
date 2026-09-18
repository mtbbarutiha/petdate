# Canonical @petdating vertical channel posts (9:16)

**Reuse this when the user says «پست تولید کن».** This is the last successful structure (message_ids **121–130** on `@petdating`).

## Spec

| Item | Value |
|------|--------|
| Aspect | **9:16** vertical (`GenerateImage` `aspect_ratio: "9:16"`) |
| Export | **1080×1920** JPEG, preferably &lt; ~900KB |
| Channel | `@petdating` |
| CTA button | `🐾 ورود به ربات` → `https://t.me/Petdatebot` |
| Brand | Pet Date purple `#5D2E8E` / pink `#E91E63`, logo dog+cat heart, tagline `PLAY · MEET · FRIENDS` |
| Style | Premium high-CTR; topic-matched imagery; **do not** reuse the same lonely-dog→park 16:9 template for every post |
| Captions | Persian body + Persian/English hashtags + `@Petdatebot` · optional `PetDate.ir` |

## Topics (order)

1. **playmate** — همبازی / friendship (before→after lonely→friends OK *only here*)
2. **trainer** — مربی آنلاین / clicker / obedience
3. **vet** — دامپزشک آنلاین / soft clinic
4. **shop** — پت‌شاپ / products
5. **events** — ایونت / outdoor meetup
6. **nearby** — همبازی نزدیک / map·GPS
7. **community** — جامعه پت‌دوست‌ها
8. **consult** — مشورت بدون پت
9. **profile** — پروفایل پت / phone passport UI
10. **all-features** — همه امکانات collage (still one cohesive vertical ad)

## Image-prompt structure (per topic)

```
Vertical 9:16 premium Telegram ad for Pet Date app. TOPIC: <topic> — DISTINCT from lonely-dog story (except playmate).

COMPOSITION:
- Top: Pet Date logo (pink/purple dog+cat heart) + PLAY · MEET · FRIENDS
- Hero: topic-matched photoreal scene filling most of the frame
- Mid/bottom: purple/pink Persian headline banners + pink CTA pill «PetDate.ir»
- Sparse floating pink hearts / purple paw prints only

Colors: deep purple #5D2E8E, magenta #E91E63, white. High-CTR. Clean Persian typography.
Explicit NO-list of other topics' motifs so banners stay distinct.
```

Full prompts used for 121–130 are in `manifest.json` → `posts[].image_prompt`.

## Publish workflow

```bash
# from repo root
TELEGRAM_BOT_TOKEN=… node packages/bot/scripts/publish-channel-vertical-posts.mjs
```

Script reads JPGs from `packages/bot/assets/channel-posts/vertical/`, sends `sendPhoto` + caption + inline keyboard.

## Assets

| File | Topic |
|------|--------|
| `v-post-01-playmate.jpg` | playmate |
| `v-post-02-trainer.jpg` | trainer |
| `v-post-03-vet.jpg` | vet |
| `v-post-04-shop.jpg` | shop |
| `v-post-05-event.jpg` | events |
| `v-post-06-nearby.jpg` | nearby |
| `v-post-07-community.jpg` | community |
| `v-post-08-consult.jpg` | consult (no-pet) |
| `v-post-09-profile.jpg` | profile |
| `v-post-10-all.jpg` | all-features |

## Live posts (canonical keep set)

- https://t.me/petdating/121 … https://t.me/petdating/130

## Activity series (v-post-11…15)

Five posts covering core product activities (publish with
`publish-channel-activity-posts.mjs` — does **not** re-send 01–10):

| File | Topic |
|------|--------|
| `v-post-11-playmate.jpg` | همبازی پت |
| `v-post-12-shop.jpg` | پت‌شاپ |
| `v-post-13-vet.jpg` | دامپزشک آنلاین |
| `v-post-14-adoption.jpg` | پذیرش حیوان خانگی |
| `v-post-15-event.jpg` | ایونت / پت‌دیتینگ پارک |

```bash
TELEGRAM_BOT_TOKEN=… node packages/bot/scripts/publish-channel-activity-posts.mjs
```

Same CTA: `🐾 ورود به ربات` → `https://t.me/Petdatebot`. Do not delete older posts.
