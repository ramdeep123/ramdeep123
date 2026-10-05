#!/usr/bin/env bash
# Builds a signed KAYA APK without Gradle: aapt2 → javac → dx → zipalign → apksigner.
# Works with Ubuntu/Debian packages:
#   apt-get install android-sdk-platform-23 aapt zipalign apksigner dalvik-exchange
# or a regular Android SDK (set ANDROID_HOME). Output: release/KAYA-<version>.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AND="$ROOT/android"
OUT="$AND/build"
VERSION_NAME="${VERSION_NAME:-$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo 1.0.0)}"
VERSION_CODE="${VERSION_CODE:-1}"
MIN_SDK=24
TARGET_SDK=34

# Use one consistent toolchain: the platform and build-tools of the same SDK
# (a full Android SDK via ANDROID_HOME, or Debian's /usr/lib/android-sdk).
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/lib/android-sdk}}"
[ -d "$SDK/build-tools" ] || SDK=/usr/lib/android-sdk
ANDROID_JAR="${ANDROID_JAR:-$(ls -d "$SDK"/platforms/android-*/android.jar 2>/dev/null | sort -V | tail -1)}"
BT="$(ls -d "$SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -1)"
find_tool() { if [ -x "$BT$1" ]; then echo "$BT$1"; else command -v "$1" 2>/dev/null || true; fi; }
AAPT2="$(find_tool aapt2)"; DX="$(find_tool dx)"; D8="$(find_tool d8)"
ZIPALIGN="$(find_tool zipalign)"; APKSIGNER="$(find_tool apksigner)"
[ -f "$ANDROID_JAR" ] || { echo "android.jar not found (set ANDROID_JAR)"; exit 1; }
[ -n "$AAPT2" ] && [ -n "$ZIPALIGN" ] && [ -n "$APKSIGNER" ] && { [ -n "$D8" ] || [ -n "$DX" ]; } || { echo "Android build-tools not found"; exit 1; }
echo "android.jar: $ANDROID_JAR"
echo "build-tools: $BT"

rm -rf "$OUT"
mkdir -p "$OUT/assets/www" "$OUT/gen" "$OUT/classes" "$OUT/dex" "$ROOT/release"

echo "→ staging web app"
cd "$ROOT"
cp index.html manifest.webmanifest "$OUT/assets/www/"
cp -r css js assets vendor "$OUT/assets/www/"

echo "→ compiling resources"
"$AAPT2" compile --dir "$AND/res" -o "$OUT/res.zip"
"$AAPT2" link -I "$ANDROID_JAR" \
  --manifest "$AND/AndroidManifest.xml" \
  --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --java "$OUT/gen" -A "$OUT/assets" -0 wasm -0 task -0 woff2 -0 png \
  -o "$OUT/base.apk" "$OUT/res.zip"

echo "→ compiling Java"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$ANDROID_JAR" -d "$OUT/classes" \
  $(find "$AND/src" "$OUT/gen" -name '*.java')

echo "→ dexing"
if [ -n "$D8" ]; then
  "$D8" --release --min-api $MIN_SDK --lib "$ANDROID_JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
else
  "$DX" --dex --min-sdk-version=$MIN_SDK --output="$OUT/dex/classes.dex" "$OUT/classes"
fi
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -X "$OUT/unsigned.apk" classes.dex)

echo "→ aligning"
"$ZIPALIGN" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "→ signing"
KS="$AND/kaya-release.keystore"
PROPS="$AND/keystore.properties"
if [ ! -f "$KS" ]; then
  PASS="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
  keytool -genkeypair -v -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias kaya \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=KAYA, OU=Mobile, O=KAYA, L=Bengaluru, ST=Karnataka, C=IN" >/dev/null 2>&1
  printf 'storeFile=kaya-release.keystore\nstorePassword=%s\nkeyAlias=kaya\nkeyPassword=%s\n' "$PASS" "$PASS" > "$PROPS"
  echo "  created new signing key: $KS (keep it safe — updates must be signed with it)"
fi
PASS="$(grep storePassword "$PROPS" | cut -d= -f2)"
APK="$ROOT/release/KAYA-$VERSION_NAME.apk"
"$APKSIGNER" sign --ks "$KS" --ks-key-alias kaya --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --v1-signing-enabled true --v2-signing-enabled true --out "$APK" "$OUT/aligned.apk"
"$APKSIGNER" verify "$APK"
rm -f "$APK.idsig"
echo "✓ $APK ($(du -h "$APK" | cut -f1))"
