#!/usr/bin/env bash
# Build a debug-signed PetDate Android APK (Capacitor shell → https://petdate.ir).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")}"

APK_OUT="$ROOT/packages/web/public/downloads/petdate-android.apk"
GRADLE_APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -x "$ROOT/android/gradlew" ]]; then
  echo "Missing android/ project. Run: npx cap add android" >&2
  exit 1
fi

if [[ ! -d "$ANDROID_HOME/platforms" ]]; then
  echo "Android SDK not found at ANDROID_HOME=$ANDROID_HOME" >&2
  echo "Install cmdline-tools and run: sdkmanager \"platform-tools\" \"platforms;android-34\" \"build-tools;34.0.0\"" >&2
  exit 1
fi

echo "→ Sync Capacitor web assets"
npx cap sync android

echo "→ Assemble debug APK"
(cd android && ./gradlew assembleDebug)

mkdir -p "$(dirname "$APK_OUT")"
cp "$GRADLE_APK" "$APK_OUT"

SIZE="$(stat -c '%s' "$APK_OUT" 2>/dev/null || stat -f '%z' "$APK_OUT")"
echo "✓ $APK_OUT ($SIZE bytes)"

if (( SIZE < 102400 )); then
  echo "Warning: APK smaller than 100KB — build may be incomplete." >&2
  exit 1
fi
