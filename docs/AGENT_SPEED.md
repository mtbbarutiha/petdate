# Agent / ops speed (PetDate)

Short rules so Cloud Agents do not burn minutes on known dead ends.

## Do not

1. **Spawn duplicate agents** for the same live bug (keyboard missing, Telegram `ECONNRESET`, shop wipe). One root-cause fix + one deploy.
2. **Multi-minute Telegram retry loops** — VPS **IPv6 → `api.telegram.org` SSL-times out (~5–8s)**. Prefer IPv4 (`curl -4`, bot/api `telegram-http.ts`). Cap retries (~4 × 250ms backoff), fail fast.
3. **“Restore menu” loops** — never send+delete ReplyKeyboard carriers (clears the menu). Sticky middleware is a **no-op**; use content `reply_markup` or `pushReplyKeyboard*` (visible, not deleted).
4. **Thin web rsync with `--delete`** from feature branches — wipes shop / playdate / profile. Use CI Deploy or `DEPLOY_SCOPE=all`; partial needs `ALLOW_PARTIAL_DEPLOY=1` and still never parent-level delete.
5. **Wait on a broken deploy** — if `predeploy-check` fails or pm2 crash-loops (`Cannot find module 'undici'`), stop and fix install/build; do not keep forcing menus over SSH.

## Do

1. **Merge to `main` ASAP** after a successful VPS verify so the next agent starts from a complete tree.
2. **One root cause** over symptom restore (fix IPv4 HTTP, not 8× `force-main-menu.sh`).
3. **Scoped live fixes:** `ALLOW_PARTIAL_DEPLOY=1 DEPLOY_SCOPE=bot|api` — never touch web unless the change is web.
4. **Ops helpers (IPv4, short timeouts):**
   ```bash
   curl -4 -sS -o /dev/null -w '%{http_code} %{time_total}\n' --connect-timeout 5 https://api.telegram.org/
   ./scripts/tg-api.sh getMe
   ./scripts/redis-cli.sh PING
   ./scripts/force-main-menu.sh
   ./scripts/predeploy-check.sh
   ```
5. Optional local Bot API / proxy: set `TELEGRAM_API_ROOT` (no trailing slash), e.g. `https://api.telegram.org` or a local Bot API base.

## Measured on production VPS (`185.110.189.218`)

| Path | Typical |
|------|---------|
| `curl -4` HTTPS `api.telegram.org` | ~0.04–0.06s |
| `curl -6` HTTPS `api.telegram.org` | SSL timeout ~5–8s (**broken**) |
| Bot/API HTTP client | undici `Agent({ connect: { family: 4 } })` + ≤4 short retries |

## Related

- Deploy discipline: [`DEPLOY.md`](./DEPLOY.md)
- Guards: `scripts/predeploy-check.sh` (sticky no-delete + telegram-http markers)
