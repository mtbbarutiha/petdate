#!/usr/bin/env bash
# Safe .env loader — never `source` the file (Persian comments / spaces break bash source).
# Usage: source scripts/lib/load-env.sh && load_env /opt/petdate/.env

load_env() {
  local file="${1:-}"
  if [[ -z "$file" ]]; then
    if [[ -f .env ]]; then
      file=".env"
    elif [[ -f /opt/petdate/.env ]]; then
      file="/opt/petdate/.env"
    else
      echo "load_env: no .env path given and none found" >&2
      return 1
    fi
  fi
  [[ -f "$file" ]] || {
    echo "load_env: missing $file" >&2
    return 1
  }

  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*export[[:space:]]+ ]]; then
      line="${line#*export}"
      line="${line#"${line%%[![:space:]]*}"}"
    fi
    if [[ ! "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      continue
    fi
    key="${line%%=*}"
    val="${line#*=}"
    if [[ "$val" =~ ^\".*\"$ ]]; then
      val="${val:1:${#val}-2}"
    elif [[ "$val" =~ ^\'.*\'$ ]]; then
      val="${val:1:${#val}-2}"
    else
      if [[ "$val" =~ ^(.*)[[:space:]]+#.*$ ]]; then
        val="${BASH_REMATCH[1]}"
        val="${val%"${val##*[![:space:]]}"}"
      fi
    fi
    printf -v "$key" '%s' "$val"
    export "$key"
  done <"$file"
}
