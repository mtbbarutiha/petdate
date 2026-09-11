#!/usr/bin/env bash
# Deploy PetDate to a Ubuntu VPS (API + bot + web + nginx).
#
# Usage:
#   ./scripts/deploy-vps.sh user@SERVER_IP
#   DEPLOY_SCOPE=all|shared|api|bot|web ./scripts/deploy-vps.sh user@SERVER_IP
#
# Optional env:
#   REMOTE_DIR=/opt/petdate
#   BRANCH=<label for logs — does NOT auto-checkout>
#   DEPLOY_SCOPE=all (default) — full consistent tree (preferred / CI path)
#   ALLOW_PARTIAL_DEPLOY=1 — required when DEPLOY_SCOPE != all
#   SKIP_PREDEPLOY=1 — skip integrity check (not recommended)
#   RSYNC_DELETE=1 — use --delete only inside the scoped destination
#                    (default: on for scope=all, off for package scopes)
#
# IMPORTANT:
# - Feature branches must not deploy. See docs/DEPLOY.md.
# - Never rsync a single package with parent-level --delete; that wipes
#   siblings (api markers, bot web-cta-once-v2, shared roles, …).
# - Controlled path: GitHub Actions deploy.yml → this script with scope=all.
#
# Predeploy guard: scripts/predeploy-check.sh unless SKIP_PREDEPLOY=1.

set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 user@SERVER_IP"
  echo "Optional: DEPLOY_SCOPE=all|shared|api|bot|web"
  echo "Optional: SKIP_PREDEPLOY=1 to bypass integrity check (not recommended)."
  exit 1
fi

REMOTE_DIR="${REMOTE_DIR:-/opt/petdate}"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-all}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CURRENT_BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
BRANCH="${BRANCH:-$CURRENT_BRANCH}"

case "$DEPLOY_SCOPE" in
  all|shared|api|bot|web) ;;
  *)
    echo "ERROR: DEPLOY_SCOPE must be all|shared|api|bot|web (got: $DEPLOY_SCOPE)" >&2
    exit 1
    ;;
esac

if [[ "$DEPLOY_SCOPE" != "all" && "${ALLOW_PARTIAL_DEPLOY:-}" != "1" ]]; then
  echo "ERROR: partial scope '$DEPLOY_SCOPE' refused." >&2
  echo "Full consistent deploys (DEPLOY_SCOPE=all) are the controlled path." >&2
  echo "Override only with ALLOW_PARTIAL_DEPLOY=1 (never uses parent --delete)." >&2
  exit 1
fi

# --delete is safe only when the rsync source/dest pair is the scoped tree.
# Default: full deploy deletes stale files inside the project; package scopes do not.
if [[ -z "${RSYNC_DELETE:-}" ]]; then
  if [[ "$DEPLOY_SCOPE" == "all" ]]; then
    RSYNC_DELETE=1
  else
    RSYNC_DELETE=0
  fi
fi

echo "==> Deploying workspace branch: ${CURRENT_BRANCH} (label=${BRANCH})"
echo "==> Scope: ${DEPLOY_SCOPE}  REMOTE_DIR=${REMOTE_DIR}  RSYNC_DELETE=${RSYNC_DELETE}"
echo "==> Controlled path: prefer GitHub Actions deploy.yml over ad-hoc agent rsync."

if [[ "${SKIP_PREDEPLOY:-}" == "1" ]]; then
  echo "WARNING: SKIP_PREDEPLOY=1 — skipping scripts/predeploy-check.sh"
else
  if [[ ! -x "$ROOT/scripts/predeploy-check.sh" ]]; then
    echo "ERROR: scripts/predeploy-check.sh missing or not executable" >&2
    exit 1
  fi
  "$ROOT/scripts/predeploy-check.sh"
fi

# Data safety: never rsync-delete SQLite/uploads. Postgres magazine_articles is SoT on
# production — deploys must stay additive (boot seed-if-empty only; never TRUNCATE/DELETE).
COMMON_EXCLUDES=(
  --exclude node_modules
  --exclude .git
  --exclude .env
  --exclude '.env.*'
  --exclude 'packages/*/dist'
  --exclude 'packages/api/data/*.db*'
  --exclude 'packages/api/data/chat-uploads'
  --exclude 'packages/api/data/pet-photos'
  --exclude 'packages/api/data/user-avatars'
  --exclude 'packages/api/data/prescriptions'
  --exclude 'packages/api/data/magazine-images'
  --exclude 'packages/bot/data/sessions.json'
)

rsync_pkg() {
  local src="$1" dest="$2" use_delete="${3:-0}"
  local -a args=(-az)
  if [[ "$use_delete" == "1" ]]; then
    args+=(--delete)
  fi
  # Package-scoped sync: never pass the repo root as dest with --delete.
  echo "==> rsync ${src} → ${TARGET}:${dest}  (delete=${use_delete})"
  rsync "${args[@]}" "${COMMON_EXCLUDES[@]}" "$src" "$TARGET:$dest"
}

echo "==> Ensuring remote directory ${TARGET}:${REMOTE_DIR}"
ssh "$TARGET" "sudo mkdir -p '$REMOTE_DIR' && sudo chown -R \$(whoami):\$(whoami) '$REMOTE_DIR'"

# Ordered sync: shared → api → bot → web (+ root config on full deploy).
# Partial scopes only touch their package path — siblings stay intact.
case "$DEPLOY_SCOPE" in
  all)
    echo "==> Syncing FULL project tree (consistent set)"
    # Root-level sync with --delete, but excludes protect .env, DB, uploads, dist.
    rsync_args=(-az)
    if [[ "$RSYNC_DELETE" == "1" ]]; then
      rsync_args+=(--delete)
    fi
    rsync "${rsync_args[@]}" "${COMMON_EXCLUDES[@]}" \
      "$ROOT/" "$TARGET:$REMOTE_DIR/"
    ;;
  shared)
    rsync_pkg "$ROOT/packages/shared/" "$REMOTE_DIR/packages/shared/" "$RSYNC_DELETE"
    ;;
  api)
    rsync_pkg "$ROOT/packages/api/" "$REMOTE_DIR/packages/api/" "$RSYNC_DELETE"
    # Keep shared in sync when API changes depend on it (no delete on shared).
    rsync_pkg "$ROOT/packages/shared/" "$REMOTE_DIR/packages/shared/" 0
    ;;
  bot)
    rsync_pkg "$ROOT/packages/bot/" "$REMOTE_DIR/packages/bot/" "$RSYNC_DELETE"
    rsync_pkg "$ROOT/packages/shared/" "$REMOTE_DIR/packages/shared/" 0
    ;;
  web)
    rsync_pkg "$ROOT/packages/web/" "$REMOTE_DIR/packages/web/" "$RSYNC_DELETE"
    ;;
esac

# Also push root deploy helpers on package scopes so remote scripts stay current
# without touching other packages.
if [[ "$DEPLOY_SCOPE" != "all" ]]; then
  for f in ecosystem.config.cjs package.json package-lock.json .env.example; do
    if [[ -f "$ROOT/$f" ]]; then
      rsync -az "$ROOT/$f" "$TARGET:$REMOTE_DIR/$f"
    fi
  done
  if [[ -d "$ROOT/scripts" ]]; then
    rsync -az --exclude '*.db*' "$ROOT/scripts/" "$TARGET:$REMOTE_DIR/scripts/"
  fi
fi

REMOTE_BUILD_SCOPE="$DEPLOY_SCOPE"
ssh "$TARGET" bash -s <<EOF
set -euo pipefail
cd '$REMOTE_DIR'
SCOPE='$REMOTE_BUILD_SCOPE'

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
if ! command -v nginx >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y nginx
fi
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm i -g pm2
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from example — edit secrets before production use."
fi

# Preserve single SQLite SoT — never overwrite live DB via rsync (excluded above).
if [[ -f ecosystem.config.cjs ]]; then
  grep -q 'DATABASE_PATH' ecosystem.config.cjs || {
    echo "ERROR: ecosystem.config.cjs must set DATABASE_PATH for single-SQLite SoT" >&2
    exit 1
  }
fi

# Infra only on full deploys (avoid surprise restarts on web-only pushes)
if [[ "\$SCOPE" == "all" ]]; then
  if command -v docker >/dev/null 2>&1; then
    sudo systemctl enable --now docker >/dev/null 2>&1 || true
    docker compose up -d postgres redis minio
    sudo tee /etc/systemd/system/petdate-infra.service >/dev/null <<'UNIT'
[Unit]
Description=PetDate infra (postgres redis minio)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/petdate
ExecStart=/usr/bin/docker compose up -d postgres redis minio
ExecStop=/usr/bin/docker compose stop postgres redis minio
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
UNIT
    sudo sed -i "s|WorkingDirectory=/opt/petdate|WorkingDirectory=$REMOTE_DIR|g" /etc/systemd/system/petdate-infra.service
    sudo systemctl daemon-reload
    sudo systemctl enable --now petdate-infra.service
  else
    echo "WARNING: docker not installed — Postgres/Redis probes may fail."
  fi

  if [[ -x ./scripts/ensure-elasticsearch.sh ]]; then
    sudo ./scripts/ensure-elasticsearch.sh || echo "WARNING: Elasticsearch setup failed"
  fi
fi

npm install

if command -v chattr >/dev/null 2>&1 && [[ -d packages/web/dist ]]; then
  find packages/web/dist -type f -exec lsattr {} + 2>/dev/null | awk '/i/ {print \$NF}' | while read -r f; do
    sudo chattr -i "\$f" 2>/dev/null || true
  done
fi

# Ordered build: shared → api → bot → web (only what the scope needs)
build_shared() { npm run build -w @petdate/shared; }
build_api()    { npm run build -w @petdate/api; }
build_bot()    { npm run build -w @petdate/bot; }
build_web()    { npm run build -w @petdate/web; }

case "\$SCOPE" in
  all)
    build_shared
    build_api
    build_bot
    build_web
    ;;
  shared) build_shared ;;
  api)    build_shared; build_api ;;
  bot)    build_shared; build_bot ;;
  web)    build_shared; build_web ;;
esac

mkdir -p packages/api/data

if [[ "\$SCOPE" == "all" && -x ./scripts/backup-sqlite.sh ]]; then
  sudo mkdir -p /var/backups/petdate
  sudo chmod 700 /var/backups/petdate
  (sudo crontab -l 2>/dev/null | grep -v backup-sqlite || true; echo "15 2 * * * $REMOTE_DIR/scripts/backup-sqlite.sh >> /var/log/petdate-backup.log 2>&1") | sudo crontab - || true
fi

if [[ ! -f ecosystem.config.cjs ]]; then
  echo "ERROR: ecosystem.config.cjs missing after sync" >&2
  exit 1
fi

# Restart only processes affected by this scope
case "\$SCOPE" in
  all)
    pm2 startOrReload ecosystem.config.cjs
    pm2 save
    ;;
  api|shared)
    # shared changes can affect bot too — reload both for consistency
    pm2 startOrReload ecosystem.config.cjs
    pm2 save
    ;;
  bot)
    pm2 restart petdate-bot || pm2 startOrReload ecosystem.config.cjs
    pm2 save
    ;;
  web)
    echo "Web dist updated — nginx serves packages/web/dist (no pm2 restart)."
    ;;
esac

if [[ "\$SCOPE" == "all" || "\$SCOPE" == "api" || "\$SCOPE" == "bot" ]]; then
  sudo env PATH=\$PATH:\$(dirname \$(which node)) pm2 startup systemd -u \$(whoami) --hp \$HOME >/tmp/pm2-startup.txt || true
fi

if [[ "\$SCOPE" == "all" || "\$SCOPE" == "web" ]]; then
  if [[ -f infra/nginx/petdate.conf ]]; then
    sudo cp infra/nginx/petdate.conf /etc/nginx/sites-available/petdate
    sudo ln -sfn /etc/nginx/sites-available/petdate /etc/nginx/sites-enabled/petdate
    sudo rm -f /etc/nginx/sites-enabled/default
  fi
  if [[ -f infra/nginx/ws.petdate.ir.conf ]]; then
    sudo cp infra/nginx/ws.petdate.ir.conf /etc/nginx/sites-available/ws.petdate.ir
    sudo ln -sfn /etc/nginx/sites-available/ws.petdate.ir /etc/nginx/sites-enabled/ws.petdate.ir
  fi
  if [[ -f infra/nginx/pdf.petdate.ir.conf ]]; then
    sudo cp infra/nginx/pdf.petdate.ir.conf /etc/nginx/sites-available/pdf.petdate.ir
    sudo ln -sfn /etc/nginx/sites-available/pdf.petdate.ir /etc/nginx/sites-enabled/pdf.petdate.ir
  fi
  if [[ -f infra/nginx/petdate.conf ]]; then
    sudo nginx -t && sudo systemctl reload nginx
  elif [[ "\$SCOPE" == "all" ]]; then
    sudo tee /etc/nginx/sites-available/petdate >/dev/null <<'NGINX'
server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 20m;

  root $REMOTE_DIR/packages/web/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /rx {
    proxy_pass http://127.0.0.1:3001/rx;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
  }

  location /assets/brand/ {
    proxy_pass http://127.0.0.1:3001/assets/brand/;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
NGINX
    sudo sed -i "s|\\\$REMOTE_DIR|$REMOTE_DIR|g; s|$REMOTE_DIR|$REMOTE_DIR|g" /etc/nginx/sites-available/petdate || true
    sudo ln -sfn /etc/nginx/sites-available/petdate /etc/nginx/sites-enabled/petdate
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl reload nginx
  fi
fi

# Post-deploy sanity: markers that agents have wiped before
echo "==> Post-deploy markers"
if [[ -f packages/api/dist/services/web-chat-cta-once.js ]] || [[ -f packages/api/src/services/web-chat-cta-once.ts ]]; then
  grep -R -l 'web-cta-once-v2' packages/api packages/bot 2>/dev/null | head -3 || true
  echo "OK: web-cta-once-v2 sources present"
else
  echo "WARNING: web-cta-once module missing after deploy"
fi
if grep -q "REMOVED_USER_ROLES = \\['pet_sitter', 'community_seeker'\\]" packages/shared/src/petdate.ts 2>/dev/null; then
  grep -q "'trainer'" packages/shared/src/petdate.ts \
    && ! awk '/export const USER_ROLES/,/];/' packages/shared/src/petdate.ts | grep -q "pet_sitter" \
    && echo "OK: pet_sitter removed from live roles; trainer active"
fi
if [[ -f ecosystem.config.cjs ]]; then
  grep -q 'DATABASE_PATH' ecosystem.config.cjs && echo "OK: single DATABASE_PATH in ecosystem"
fi

# Fail fast if bot Telegram HTTP client cannot load (undici missing → crash loop)
if [[ "\$SCOPE" == "all" || "\$SCOPE" == "bot" || "\$SCOPE" == "api" ]]; then
  echo "==> Post-deploy: require telegram-http + undici"
  node -e "require('undici'); console.log('OK: undici')"
  if [[ -f packages/bot/dist/telegram-http.js ]]; then
    node -e "require('./packages/bot/dist/telegram-http.js'); console.log('OK: bot telegram-http')"
  fi
  if [[ -f packages/api/dist/services/telegram-http.js ]]; then
    node -e "require('./packages/api/dist/services/telegram-http.js'); console.log('OK: api telegram-http')"
  fi
  if [[ "\$SCOPE" == "all" || "\$SCOPE" == "bot" ]]; then
    pm2 describe petdate-bot >/tmp/pm2-bot.txt 2>/dev/null || true
    if grep -qi 'status.*errored\|status.*stopped' /tmp/pm2-bot.txt 2>/dev/null; then
      echo "ERROR: petdate-bot not online after deploy" >&2
      pm2 logs petdate-bot --err --lines 30 --nostream || true
      exit 1
    fi
    echo "OK: petdate-bot process present"
  fi
fi

echo ""
echo "Deploy done (scope=\$SCOPE)."
echo "Web:   http://SERVER_IP/"
echo "API:   http://SERVER_IP/api/health"
echo "Edit $REMOTE_DIR/.env then: pm2 restart petdate-api petdate-bot"
EOF
