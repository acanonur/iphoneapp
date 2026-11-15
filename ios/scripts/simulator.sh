# Shared by the scripts that drive the simulator: picks an ordinary, current
# iPhone, starts it, and leaves its id in $UDID. Sourced, not run.

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
# The same clean status bar on every picture.
xcrun simctl status_bar "$UDID" override --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3 --operatorName "" || true
