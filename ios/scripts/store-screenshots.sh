#!/bin/sh
# The screenshots for the App Store page: the screens that show what Yaver
# does, in English, German and Turkish, at the sizes App Store Connect asks
# for an iPhone app — the medium display (6.3-inch: 1206 x 2622) and the
# large one (6.9-inch: 1320 x 2868). Apple's pages disagree about which of
# the two is required, so both are made; upload both.
#
#   ios/scripts/store-screenshots.sh <path to AISecretary.app> <output folder>
#
# They are taken over the sample data in Support/Staging.swift, like the
# screenshots that check the design, but numbered in the order they should
# appear on the page. They are taken on the 6.3-inch iPhone the other
# screenshots use, which is already running: a simulator that has never run
# on the build machine takes a quarter of an hour before it is any use. The
# 6.9-inch pictures are the same screens scaled to that display's size (the
# two screens have the same shape, to within a pixel).
#
# They are saved as JPEG: App Store Connect refuses pictures with an alpha
# channel, which the simulator's PNGs have.
set -eu

APP="$1"
OUT="$2"
BUNDLE=com.canonur.aisecretary
STAGES="call report answered translator home brief answering"
MEDIUM="6.3-inch"
LARGE="6.9-inch"

# The pixel size of a picture, as "1206x2622".
size() {
  sips -g pixelWidth -g pixelHeight "$1" | awk '/pixel/ { printf "%sx", $2 }' | sed 's/x$//'
}

# accepted <folder> <size> <sizes App Store Connect takes>
accepted() {
  case " $3 " in
    *" $2 "*) echo "Size accepted for the $1 display: $2" ;;
    *) echo "::warning::$1 screenshots are $2, which App Store Connect does not take ($3)" ;;
  esac
}

PHONES="iPhone 17 Pro|iPhone 16 Pro|iPhone 17|iPhone 16"
. "$(dirname "$0")/simulator.sh"
xcrun simctl install "$UDID" "$APP"
for LANGUAGE in en de tr; do
  case "$LANGUAGE" in
    de) LOCALE=de_DE; NAME="Jonas Becker"; CALLS=tr ;;
    tr) LOCALE=tr_TR; NAME="Deniz Kaya"; CALLS=de ;;
    *)  LOCALE=en_GB; NAME="Deniz Kaya"; CALLS=de ;;
  esac
  mkdir -p "$OUT/$MEDIUM/$LANGUAGE" "$OUT/$LARGE/$LANGUAGE"
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
    FILE="$NUMBER-$STAGE.jpg"
    xcrun simctl io "$UDID" screenshot --type=jpeg "$OUT/$MEDIUM/$LANGUAGE/$FILE" >/dev/null 2>&1
    sips -z 2868 1320 "$OUT/$MEDIUM/$LANGUAGE/$FILE" --out "$OUT/$LARGE/$LANGUAGE/$FILE" >/dev/null
    for FOLDER in "$MEDIUM" "$LARGE"; do
      if [ "$(sips -g hasAlpha "$OUT/$FOLDER/$LANGUAGE/$FILE" | awk '/hasAlpha/ { print $2 }')" = "yes" ]; then
        echo "::warning::$FOLDER/$LANGUAGE/$FILE has an alpha channel, which App Store Connect refuses"
      fi
    done
    echo "  $LANGUAGE/$FILE  $(size "$OUT/$MEDIUM/$LANGUAGE/$FILE") and $(size "$OUT/$LARGE/$LANGUAGE/$FILE")"
  done
done
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
# App Store Connect takes only certain sizes; say so here rather than at upload.
accepted "$MEDIUM" "$(size "$OUT/$MEDIUM/en/1-call.jpg")" "1206x2622 1179x2556"
accepted "$LARGE" "$(size "$OUT/$LARGE/en/1-call.jpg")" "1320x2868 1290x2796 1260x2736"
