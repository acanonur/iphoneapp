#!/bin/sh
# The screenshots for the App Store page: the screens that show what Yaver
# does, in English, German and Turkish, at the size App Store Connect asks
# for an iPhone app (the 6.9-inch display: 1320 x 2868, or 1290 x 2796).
#
#   ios/scripts/store-screenshots.sh <path to AISecretary.app> <output folder>
#
# They are taken over the sample data in Support/Staging.swift, like the
# screenshots that check the design, but on the largest iPhone and at full
# size, numbered in the order they should appear on the page.
set -eu

APP="$1"
OUT="$2"
BUNDLE=com.canonur.aisecretary
STAGES="call report answered translator home brief answering"

PHONES="iPhone 17 Pro Max|iPhone 16 Pro Max|iPhone 16 Plus|iPhone 15 Pro Max"
. "$(dirname "$0")/simulator.sh"
xcrun simctl install "$UDID" "$APP"

for LANGUAGE in en de tr; do
  case "$LANGUAGE" in
    de) LOCALE=de_DE; NAME="Jonas Becker"; CALLS=tr ;;
    tr) LOCALE=tr_TR; NAME="Deniz Kaya"; CALLS=de ;;
    *)  LOCALE=en_GB; NAME="Deniz Kaya"; CALLS=de ;;
  esac
  mkdir -p "$OUT/$LANGUAGE"
  NUMBER=0
  for STAGE in $STAGES; do
    NUMBER=$((NUMBER + 1))
    xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
    xcrun simctl launch "$UDID" "$BUNDLE" \
      -yaverStage "$STAGE" \
      -AppleLanguages "($LANGUAGE)" -AppleLocale "$LOCALE" \
      -aisecretary.onboarded YES \
      -aisecretary.userName "$NAME" \
      -aisecretary.reportLanguage "$LANGUAGE" \
      -aisecretary.callLanguage "$CALLS" >/dev/null
    sleep 5
    FILE="$OUT/$LANGUAGE/$NUMBER-$STAGE.png"
    xcrun simctl io "$UDID" screenshot "$FILE" >/dev/null 2>&1
    SIZE=$(sips -g pixelWidth -g pixelHeight "$FILE" | awk '/pixel/ { printf "%s ", $2 }')
    echo "  $LANGUAGE/$NUMBER-$STAGE.png  $SIZE"
  done
done
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true

# App Store Connect accepts only certain sizes; say so here rather than at upload.
case "$SIZE" in
  "1320 2868 "|"1290 2796 ") echo "Size accepted for the 6.9-inch display: $SIZE" ;;
  *) echo "::warning::Screenshot size $SIZE is not one App Store Connect takes for the 6.9-inch display" ;;
esac
