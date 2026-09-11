# Deploy discipline (PetDate)

> **Agents:** do **not** `rsync` to the VPS from feature branches. The controlled path is **GitHub Actions → Deploy**. Before any break-glass manual deploy, run `./scripts/predeploy-check.sh` and only proceed if it passes. `deploy-vps.sh` runs the same check automatically (escape hatch: `SKIP_PREDEPLOY=1`).

> **Speed:** see [`AGENT_SPEED.md`](./AGENT_SPEED.md) — no duplicate agents, no multi-minute Telegram retries, merge to `main` after VPS verify.

## Controlled path: CI/CD

Parallel Cloud Agent rsyncs used to overwrite incomplete trees and delete live features (wallet **transactions**, **roles** cleanup, **web-cta-once-v2**). CI/CD is now the **only supported** production deploy path.

| Workflow | Trigger | What it does |
|----------|---------|----------------|
| `.github/workflows/ci.yml` | PR + `cursor/**` push | `npm ci` → build shared→api→bot→web → selftests → predeploy-check |
| `.github/workflows/deploy.yml` | push to `main`/`master`, or `workflow_dispatch` | same build, then SSH deploy of **full** tree (`DEPLOY_SCOPE=all`) |

**Why CI does not also build on `main`:** Deploy already builds before shipping. Running both doubled wall-clock (“two Build monorepo checks”) on every merge.

Deploy uses GitHub Environment **`production`** (enable required reviewers for manual approval).

### Secrets Mohammad must set

Repo → **Settings → Secrets and variables → Actions** (never commit these):

| Secret | Required | Example / notes |
|--------|----------|-----------------|
| `VPS_HOST` | yes | `185.110.189.218` |
| `VPS_USER` | yes | `root` |
| `VPS_SSH_KEY` | yes | Full private key PEM for that user (deploy key or user key). **Do not** put the key in git. |
| `VPS_PATH` | no | Default `/opt/petdate` |

Also create Environment **production** (Settings → Environments) and optionally require reviewers.

### How to trigger deploy

1. Merge finished work into `main` (or `master`) — push runs Deploy after CI build (and Environment approval if configured).
2. Manual: Actions → **Deploy** → Run workflow → set **confirm** to `deploy` → scope **all** (recommended).
3. Agents still often cannot `git push` (no token) — workflow files live in the repo; a human pushes/merges, then Actions deploys.

### Preserve on every deploy

- **Single `DATABASE_PATH`** — `ecosystem.config.cjs` absolute SQLite SoT; rsync **excludes** `*.db*` (never wipe live DB).
- **Marketplace roles** — `trainer` is a live selectable role; `pet_sitter` and `community_seeker` stay in `REMOVED_USER_ROLES` (DB sitter columns retained; find-sitter UX removed).
- **web-cta-once-v2** — CTA at most once per chat+user (api + bot markers checked in predeploy).
- **Transactions / wallet** — api route markers must remain (predeploy greps).
- **Full shop UI** — `ShopOrdersPage`, add-to-cart CTA, toman/rial + card-to-card checkout (`ShopCartPage` / `ShopCardPayPage`). Thin feature-branch `dist` must never rsync `--delete` over live shop.
- **Profile = My Pets** — `ProfilePage` must use `useMyPets` (same API source).
- **Playdate accept → chat** — bot enter-chat markers checked in predeploy.
- **Sticky keyboard** — never reintroduce send+delete carriers (clears ReplyKeyboard).
- **Telegram HTTP** — bot/api must keep IPv4 + keep-alive client (`telegram-http.ts`).

### Why `main` must stay complete

Production features historically lived only on feature branches while `main` lagged. Agents then deployed from incomplete trees and wiped shop/playdate/profile. **Merge the full restored tree into `main` before any CI deploy** so the next push to `main` cannot regress live UI. Prefer `DEPLOY_SCOPE=all` from that complete tree; never break-glass `ALLOW_DEPLOY=1` from a thin branch.


## Faster agent / ops paths (VPS)

Root cause of many multi-minute loops: **IPv6 to `api.telegram.org` SSL-times out** (~5–10s per attempt). Always prefer IPv4.

```bash
curl -4 -sS -o /dev/null -w '%{http_code} %{time_total}\n' --connect-timeout 5 https://api.telegram.org/
source /opt/petdate/scripts/lib/load-env.sh && load_env /opt/petdate/.env
./scripts/redis-cli.sh PING
./scripts/force-main-menu.sh
./scripts/tg-api.sh getMe
```

### Break-glass scoped deploy (bot/api only — no web wipe)

```bash
./scripts/predeploy-check.sh
ALLOW_PARTIAL_DEPLOY=1 DEPLOY_SCOPE=bot ./scripts/deploy-vps.sh root@185.110.189.218
ALLOW_PARTIAL_DEPLOY=1 DEPLOY_SCOPE=api ./scripts/deploy-vps.sh root@185.110.189.218
```

## Root cause (ad-hoc rsync)

Several Cloud Agents each ran something like:

```bash
rsync -az --delete packages/web/dist/ root@VPS:/opt/petdate/packages/web/dist/
```

from **their own incomplete feature branch**. That replaced the live site with an older/partial bundle (and package-scoped `--delete` against the wrong destination could wipe siblings).

## What actually fixes it

1. **Feature branches must not deploy to VPS.** They only commit.
2. **Merge to `main`/`master`**, then let **Deploy** workflow ship a **full consistent** tree (shared → api → bot → web + pm2).
3. Run `scripts/predeploy-check.sh` before any break-glass `deploy-vps.sh`.
4. Package-scoped sync (`DEPLOY_SCOPE=web|api|bot|shared`) **never** uses parent-level `--delete` and requires `ALLOW_PARTIAL_DEPLOY=1`. Prefer `DEPLOY_SCOPE=all`.
5. Escape hatch only when you knowingly accept overwrite risk: `ALLOW_DEPLOY=1` or `SKIP_PREDEPLOY=1`.

```bash
./scripts/predeploy-check.sh
DEPLOY_SCOPE=all ./scripts/deploy-vps.sh root@185.110.189.218
# partial (discouraged):
# ALLOW_PARTIAL_DEPLOY=1 DEPLOY_SCOPE=web ./scripts/deploy-vps.sh root@185.110.189.218
```

## Canonical brand logos

| Role | Path |
|------|------|
| **لوگو مادر (source of truth)** | `packages/web/public/pepito/img/logo.png` (md5 `beda5e5ccdd11c32dd06a4f1bce2c6bf`) |
| Footer light | `packages/web/public/pepito/img/logo-light.png` |
| PWA / favicon / apple-touch / brand marks | `packages/web/scripts/generate-brand-assets.py` — **mark-only** (pink dog+cat, no «Pet Date» type) |
| OG / channel / email | same script — **full** mother wordmark |

**Rule:** Site header / SiteLogo / `logo.png` / `logo-light` keep full لوگو مادر with type. PWA Home Screen / favicon / apple-touch use the **mark-only** crop (no wordmark text) extracted from mother. Regenerate with:

```bash
python3 packages/web/scripts/generate-brand-assets.py
```

Do **not** invent a new PWA mark or neon icon.

## Live paths on VPS

- App root: `/opt/petdate` (`VPS_PATH`)
- AI trainer/vet fallback: set `AI_CONSULT_API_KEY` (or `OPENAI_API_KEY`) in `/opt/petdate/.env` and restart `petdate-api`. Without it, پاشا یزدانی uses the rich offline knowledge base only.
- Voice notes for AI chats (پاشا / support): same key enables Whisper STT (`AI_CONSULT_STT_MODEL`, default `whisper-1`). Without a key, users get a polite “please type” Persian fallback.
- Web: `/opt/petdate/packages/web/dist` (nginx root)
- API/Bot: `/opt/petdate/packages/{api,bot}/dist` + `pm2 restart petdate-api petdate-bot`
- DB: `/opt/petdate/packages/api/data/petdate.db` via `DATABASE_PATH` in `ecosystem.config.cjs`
