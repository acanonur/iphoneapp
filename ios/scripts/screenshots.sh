#!/bin/sh
# Photographs every screen of the app in the simulator, in each of its three
# languages, over the ready-made data in Support/Staging.swift.
#
#   ios/scripts/screenshots.sh <path to AISecretary.app> <output folder>
#
# This is how the design is checked: the pictures show the real screens, as
# built, rather than what the code was meant to draw.
set -eu

APP="$1"
OUT="$2"
BUNDLE=com.canonur.aisecretary
STAGES="onboarding connect home offline brief call report answered failed translator settings"

# Prefer a current, ordinary-sized iPhone; fall back to whatever is there.
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = [d for runtime, ds in json.load(sys.stdin)["devices"].items() if "iOS" in runtime for d in ds]
phones = [d for d in devices if d["name"].startswith("iPhone")]
def rank(d):
    name = d["name"]
    for index, wanted in enumerate(["iPhone 17 Pro", "iPhone 17", "iPhone 16 Pro", "iPhone 16"]):
        if name == wanted:
            return index
    return 99
phones.sort(key=rank)
print(phones[0]["udid"] if phones else "")
')
if [ -z "$UDID" ]; then
  echo "No iPhone simulator is available."
  exit 1
fi
echo "Simulator: $(xcrun simctl list devices | grep "$UDID" | head -n 1)"

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
# The same clean status bar on every picture.
xcrun simctl status_bar "$UDID" override --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3 --operatorName "" || true

for LANGUAGE in en de tr; do
  case "$LANGUAGE" in
    de) LOCALE=de_DE; NAME="Jonas Becker"; CALLS=tr ;;
    tr) LOCALE=tr_TR; NAME="Deniz Kaya"; CALLS=de ;;
    *)  LOCALE=en_GB; NAME="Deniz Kaya"; CALLS=de ;;
  esac
  mkdir -p "$OUT/$LANGUAGE"
  for STAGE in $STAGES; do
    xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
    xcrun simctl launch "$UDID" "$BUNDLE" \
      -yaverStage "$STAGE" \
      -AppleLanguages "($LANGUAGE)" -AppleLocale "$LOCALE" \
      -aisecretary.onboarded YES \
      -aisecretary.userName "$NAME" \
      -aisecretary.reportLanguage "$LANGUAGE" \
      -aisecretary.callLanguage "$CALLS" >/dev/null
    sleep 4
    xcrun simctl io "$UDID" screenshot "$OUT/$LANGUAGE/$STAGE.png" >/dev/null 2>&1
    # Half size is plenty to judge a layout, and keeps the branch small.
    sips -Z 1748 "$OUT/$LANGUAGE/$STAGE.png" >/dev/null 2>&1 || true
    echo "  $LANGUAGE/$STAGE"
  done
done

xcrun simctl shutdown "$UDID" || true
