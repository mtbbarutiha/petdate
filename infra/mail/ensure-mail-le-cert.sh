#!/usr/bin/env bash
# Idempotent: obtain Let's Encrypt for mail.petdate.ir and wire Postfix/Dovecot.
# Safe to run on every full deploy. Never fails the ship (exit 0 after warnings).
#
# Skips certbot when public A is not the origin (old WCDN 185.239.1.100 still cached).
# If a live LE cert already exists, always rewire MTA/IMAP even if some resolvers lag.
set -euo pipefail

MAIL_HOST="${MAIL_HOST:-mail.petdate.ir}"
ORIGIN_IP="${ORIGIN_IP:-185.110.189.218}"
STALE_WCDN_IP="${STALE_WCDN_IP:-185.239.1.100}"
LIVE="/etc/letsencrypt/live/${MAIL_HOST}"
CERT="${LIVE}/fullchain.pem"
KEY="${LIVE}/privkey.pem"
LE_EMAIL="${MAIL_LE_EMAIL:-info@petdate.ir}"

log() { echo "[mail-le] $*" >&2; }

has_le_cert() {
  [[ -f "$CERT" && -f "$KEY" ]]
}

resolve_mail_a() {
  local dns="${1:-8.8.8.8}"
  if command -v dig >/dev/null 2>&1; then
    dig +short +time=3 +tries=1 A "$MAIL_HOST" "@${dns}" 2>/dev/null | grep -E '^[0-9.]+$' || true
  else
    getent ahostsv4 "$MAIL_HOST" 2>/dev/null | awk '{print $1}' | sort -u || true
  fi
}

origin_visible() {
  local ips
  ips="$(resolve_mail_a 8.8.8.8)"
  echo "$ips" | grep -qx "$ORIGIN_IP"
}

wire_mta() {
  if ! has_le_cert; then
    log "no LE cert at ${LIVE} — skip wire"
    return 1
  fi
  if command -v postconf >/dev/null 2>&1; then
    postconf -e "smtpd_tls_cert_file = ${CERT}"
    postconf -e "smtpd_tls_key_file = ${KEY}"
  fi
  if [[ -f /etc/dovecot/dovecot.conf ]]; then
    sed -i \
      -e "s|^ssl_cert = <.*|ssl_cert = <${CERT}|" \
      -e "s|^ssl_key = <.*|ssl_key = <${KEY}|" \
      /etc/dovecot/dovecot.conf
  fi
  # Debian privkey is ssl-cert:ssl-cert 0640 — let Postfix/Dovecot read it.
  if getent group ssl-cert >/dev/null 2>&1; then
    usermod -aG ssl-cert postfix 2>/dev/null || true
    usermod -aG ssl-cert dovecot 2>/dev/null || true
  fi
  systemctl reload postfix 2>/dev/null || systemctl restart postfix 2>/dev/null || true
  systemctl reload dovecot 2>/dev/null || systemctl restart dovecot 2>/dev/null || true
  log "wired LE cert into Postfix/Dovecot"
}

obtain_cert() {
  if ! command -v certbot >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx
  fi
  mkdir -p /var/www/certbot
  certbot certonly --nginx \
    -d "$MAIL_HOST" \
    --non-interactive --agree-tos \
    --email "$LE_EMAIL" \
    --keep-until-expiring \
    --expand
}

main() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root" >&2
    exit 0
  fi

  local google_ips
  google_ips="$(resolve_mail_a 8.8.8.8 | tr '\n' ' ')"
  log "Google DNS A ${MAIL_HOST}: ${google_ips:-<none>}"
  if echo "$google_ips" | grep -q "$STALE_WCDN_IP"; then
    log "WARNING: some answers still ${STALE_WCDN_IP} (old WCDN) — wait for TTL flush"
  fi

  if has_le_cert; then
    log "LE cert already present"
    wire_mta || true
    exit 0
  fi

  if ! origin_visible; then
    log "skip certbot: ${MAIL_HOST} is not ${ORIGIN_IP} on 8.8.8.8 yet (stale cache / WCDN)"
    exit 0
  fi

  if ! obtain_cert; then
    log "WARNING: certbot failed (Let's Encrypt resolvers may still see ${STALE_WCDN_IP}). Deploy continues."
    exit 0
  fi
  wire_mta || true
}

main "$@"
