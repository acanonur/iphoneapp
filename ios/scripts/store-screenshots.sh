#!/bin/sh
# The screenshots for the App Store page: the screens that show what Yaver
# does, in English, German and Turkish, at the sizes App Store Connect asks
# for an iPhone app — the large display (6.9-inch: 1320 x 2868) and the
# medium one (6.3-inch: 1206 x 2622). Apple's pages disagree about which of
# the two is required, so both are made; upload both.
#
#   ios/scripts/store-screenshots.sh <path to AISecretary.app> <output folder>
#
# They are taken over the sample data in Support/Staging.swift, like the
# screenshots that check the design, but at full size and numbered in the
# order they should appear on the page.
set -eu

APP="$1"
OUT="$2"
BUNDLE=com.canonur.aisecretary
STAGES="call report answered translator home brief answering"

# shoot <folder> <phones, best first, "|"-separated> <accepted sizes>
shoot() {
  FOLDER="$1"
  PHONES="$2"
  ACCEPTED="$3"
  . "$(dirname "$0")/simulator.sh"
  xcrun simctl install "$UDID" "$APP"
  for LANGUAGE in en de tr; do
    case "$LANGUAGE" in
      de) LOCALE=de_DE; NAME="Jonas Becker"; CALLS=tr ;;
      tr) LOCALE=tr_TR; NAME="Deniz Kaya"; CALLS=de ;;
      *)  LOCALE=en_GB; NAME="Deniz Kaya"; CALLS=de ;;
    esac
    mkdir -p "$OUT/$FOLDER/$LANGUAGE"
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
      FILE="$OUT/$FOLDER/$LANGUAGE/$NUMBER-$STAGE.png"
      xcrun simctl io "$UDID" screenshot "$FILE" >/dev/null 2>&1
      SIZE=$(sips -g pixelWidth -g pixelHeight "$FILE" | awk '/pixel/ { printf "%sx", $2 }' | sed 's/x$//')
      echo "  $FOLDER/$LANGUAGE/$NUMBER-$STAGE.png  $SIZE"
    done
  done
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl shutdown "$UDID" 2>/dev/null || true
  # App Store Connect takes only certain sizes; say so here rather than at upload.
  case " $ACCEPTED " in
    *" $SIZE "*) echo "Size accepted for the $FOLDER display: $SIZE" ;;
    *) echo "::warning::$FOLDER screenshots are $SIZE, which App Store Connect does not take ($ACCEPTED)" ;;
  esac
}

shoot "6.9-inch" "iPhone 17 Pro Max|iPhone 16 Pro Max|iPhone Air|iPhone 16 Plus" "1320x2868 1290x2796 1260x2736"
shoot "6.3-inch" "iPhone 17 Pro|iPhone 16 Pro|iPhone 17|iPhone 16" "1206x2622 1179x2556"
