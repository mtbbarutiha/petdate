# PetDate Android APK

Native Android install wrapper for [https://petdate.ir](https://petdate.ir) built with **Capacitor 6** (WebView shell, not a full offline bundle).

| Field | Value |
|-------|-------|
| Package ID | `ir.petdate.app` |
| Label (launcher) | پت‌دیت |
| Remote URL | `https://petdate.ir` |
| Signing (current) | Debug (installable for sideload / internal testing) |

## Download

After a build, the APK is published at:

`packages/web/public/downloads/petdate-android.apk`

## Rebuild

Prerequisites: **Java 17+**, **Android SDK** (`cmdline-tools`, platform 34, build-tools 34.0.0).

```bash
# One-time SDK setup (if ANDROID_HOME is empty)
export ANDROID_HOME=$HOME/Android/Sdk
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Build
./scripts/build-android-apk.sh
```

Icons are generated from `packages/web/public/pwa-512.png` via `@capacitor/assets` (source copies live in `assets/`).

## Project layout

| Path | Purpose |
|------|---------|
| `capacitor.config.ts` | App id, name, remote `server.url` |
| `www/` | Minimal offline fallback HTML |
| `android/` | Gradle / Capacitor native project |
| `assets/icon.png` | Source icon for `@capacitor/assets` |

## Release signing (follow-up)

Production Play Store builds need a release keystore and `android/app/build.gradle` `signingConfigs`. Keep keystore files and `android/keystore.properties` **local only** (gitignored). Do not commit passwords.

## TWA alternative

A Bubblewrap **Trusted Web Activity** pointing at the same PWA is possible later if `/.well-known/assetlinks.json` is published on `petdate.ir` for `ir.petdate.app`. Capacitor was chosen first because it works without Digital Asset Links.
