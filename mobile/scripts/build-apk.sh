#!/usr/bin/env bash
# Builds the Android APK on Windows and installs it on a connected phone.
#
# Only needed for native changes (new native module, permissions, app version).
# Everyday changes go out as an over-the-air update instead:  npm run update:app
#
# Native C++ modules exceed Windows' 260-character path limit when built from the repo
# folder, so the app is copied to a short folder (C:\rt by default) and built there.
# The folder is kept between runs, so later builds are incremental:
#   - npm ci only when package-lock.json changed,
#   - expo prebuild only when app.json / package.json / plugins changed,
#   - Gradle daemon + build cache, and only the phone's CPU architecture.
#
# Run from the repo:  bash mobile/scripts/build-apk.sh
# Options (env):  ARCHS=arm64-v8a,x86_64 (add x86_64 for the emulator)   CLEAN=1 (full rebuild)   INSTALL=0   DEBUG_SIGN=1
# Result: C:\rt\android\app\build\outputs\apk\release\app-release.apk
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${BUILD_DIR:-/c/rt}"
ARCHS="${ARCHS:-arm64-v8a}"
export ANDROID_HOME="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/c/Program Files/Eclipse Adoptium/jdk-21.0.12.8-hotspot}"
START=$SECONDS

hash_of() { cat "$@" 2>/dev/null | sha1sum | cut -d' ' -f1; }

echo "→ Kopiuję aplikację do $DEST"
mkdir -p "$DEST"
for item in src assets plugins app.json package.json package-lock.json tsconfig.json .env.local; do
  [ -e "$SRC/$item" ] && rm -rf "${DEST:?}/$item" && cp -r "$SRC/$item" "$DEST/"
done
cd "$DEST"

if [ "${CLEAN:-0}" = 1 ]; then rm -f .deps-hash .native-hash; fi

DEPS_HASH=$(hash_of package-lock.json)
if [ ! -d node_modules ] || [ "$(cat .deps-hash 2>/dev/null)" != "$DEPS_HASH" ]; then
  echo "→ Instaluję zależności"
  npm ci --no-audit --no-fund --loglevel=error
  echo "$DEPS_HASH" > .deps-hash
else
  echo "→ Zależności bez zmian"
fi

NATIVE_HASH=$(hash_of app.json package.json package-lock.json plugins/*)
if [ ! -d android ] || [ "$(cat .native-hash 2>/dev/null)" != "$NATIVE_HASH" ]; then
  echo "→ Generuję projekt Androida"
  CI=1 npx expo prebuild -p android --clean --no-install
  echo "sdk.dir=$(cygpath -m "$ANDROID_HOME")" > android/local.properties
  echo "$NATIVE_HASH" > .native-hash
else
  echo "→ Projekt Androida bez zmian"
fi

# Release signing key (see plugins/with-release-signing.js). DEBUG_SIGN=1 builds without it, for local tests only.
SIGNING="${RT_SIGNING_PROPERTIES:-$HOME/.reptrack/signing.properties}"
if [ ! -f "$SIGNING" ] && [ "${DEBUG_SIGN:-0}" != 1 ]; then
  echo "Brak klucza podpisu ($SIGNING). Ustaw DEBUG_SIGN=1 tylko do testów lokalnych."; exit 1
fi

echo "→ Buduję APK ($ARCHS)"
cd android
./gradlew assembleRelease -q --build-cache --parallel -PreactNativeArchitectures="$ARCHS"

APK="$DEST/android/app/build/outputs/apk/release/app-release.apk"
echo "✓ Gotowe w $(( (SECONDS - START) / 60 )) min $(( (SECONDS - START) % 60 )) s: $(cygpath -w "$APK")"

if [ "${INSTALL:-1}" = 1 ]; then
  ADB="$ANDROID_HOME/platform-tools/adb.exe"
  DEVICE=$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1; exit}')
  if [ -n "$DEVICE" ]; then
    echo "→ Instaluję na $DEVICE"
    "$ADB" -s "$DEVICE" install -r "$APK"
    "$ADB" -s "$DEVICE" shell monkey -p app.reptrack.mobile -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    echo "✓ Uruchomiono na telefonie"
  else
    echo "Telefon nie jest połączony — zainstaluj APK ręcznie albo podłącz telefon i uruchom ponownie."
  fi
fi
