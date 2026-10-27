#!/usr/bin/env bash
# OPUS MARKET Android ilovasini Gradle'siz yig'ish: aapt2 → javac → d8 → zipalign → apksigner
# Ishlatish: bash /d/opus-android/build.sh <versionCode> <versionName>
set -euo pipefail
VC="${1:-2}"; VN="${2:-2.0}"
R=/d/opus-android
SDK=$R/sdk; BT=$SDK/build-tools/34.0.0; JAR=$SDK/platforms/android-34/android.jar
export JAVA_HOME='D:\opus-android\jdk17'; export PATH="$R/jdk17/bin:$PATH"
B=$R/build; A=$R/app
rm -rf "$B"; mkdir -p "$B/gen" "$B/classes" "$B/dex"

sed -i "s/VERSION = \"[^\"]*\"/VERSION = \"$VN\"/" "$A/src/uz/opusmarket/app/BuildInfo.java"

echo "1) Resurslar"
"$BT/aapt2.exe" compile --dir "$A/res" -o "$B/res.zip"
"$BT/aapt2.exe" link -o "$B/base.apk" -I "$JAR" --manifest "$A/AndroidManifest.xml" -A "$A/assets" \
  --java "$B/gen" --min-sdk-version 24 --target-sdk-version 34 --version-code "$VC" --version-name "$VN" "$B/res.zip"

echo "2) Java"
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR" -d "$B/classes" $(find "$A/src" "$B/gen" -name "*.java")
[ -f "$B/classes/uz/opusmarket/app/MainActivity.class" ] || { echo "Java kompilyatsiyasi muvaffaqiyatsiz"; exit 1; }

echo "3) DEX"
cmd //c "$(cygpath -w "$BT/d8.bat")" --release --min-api 24 --lib "$(cygpath -w "$JAR")" --output "$(cygpath -w "$B/dex")" $(find "$B/classes" -name "*.class" -exec cygpath -w {} \;)

echo "4) APK"
cp "$B/base.apk" "$B/unsigned.apk"
[ -f "$B/dex/classes.dex" ] || { echo "DEX yaratilmadi"; exit 1; }
(cd "$B/dex" && "$BT/aapt.exe" add "$(cygpath -w "$B/unsigned.apk")" classes.dex >/dev/null)
"$BT/zipalign.exe" -p -f 4 "$B/unsigned.apk" "$B/aligned.apk"

echo "5) Imzo"
KS=$R/keys/opus-release.jks
PASS=$(cat "$R/keys/pass.txt")
cmd //c "$(cygpath -w "$BT/apksigner.bat")" sign --ks "$(cygpath -w "$KS")" --ks-key-alias opus --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$(cygpath -w "$B/OPUS-$VN.apk")" "$(cygpath -w "$B/aligned.apk")"
cmd //c "$(cygpath -w "$BT/apksigner.bat")" verify "$(cygpath -w "$B/OPUS-$VN.apk")" && echo "IMZO OK"
ls -la "$B/OPUS-$VN.apk"
