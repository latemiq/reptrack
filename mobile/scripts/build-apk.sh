#!/usr/bin/env bash
# Builds the Android APK on Windows.
#
# Native C++ modules (react-native-worklets, screens…) exceed Windows' 260-character
# path limit when built from the repo folder, so this copies the app to a short folder
# (C:\rt by default) and builds there. Run from the repo:  bash mobile/scripts/build-apk.sh
# Result: C:\rt\android\app\build\outputs\apk\release\app-release.apk
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${BUILD_DIR:-/c/rt}"
export ANDROID_HOME="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/c/Program Files/Eclipse Adoptium/jdk-21.0.12.8-hotspot}"

echo "→ Kopiuję aplikację do $DEST"
mkdir -p "$DEST"
# Source, config and assets only — dependencies and the native project are generated in DEST.
for item in src assets plugins app.json package.json package-lock.json tsconfig.json .env.local; do
  [ -e "$SRC/$item" ] && rm -rf "${DEST:?}/$item" && cp -r "$SRC/$item" "$DEST/"
done

cd "$DEST"
echo "→ Instaluję zależności"
npm ci --no-audit --no-fund --loglevel=error

echo "→ Generuję projekt Androida"
CI=1 npx expo prebuild -p android --clean --no-install

echo "→ Buduję APK (arm64 + x86_64)"
cd android
echo "sdk.dir=$(cygpath -m "$ANDROID_HOME")" > local.properties
./gradlew assembleRelease --no-daemon -q -PreactNativeArchitectures=arm64-v8a,x86_64

echo "✓ Gotowe: $(cygpath -w "$DEST/android/app/build/outputs/apk/release/app-release.apk")"
