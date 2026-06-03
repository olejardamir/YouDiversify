#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

errors=0

header() { echo; echo "==> $1"; }
fail() { echo "  FAIL: $1"; errors=$((errors + 1)); }
pass() { echo "  OK: $1"; }

header "1. manifest.json is valid JSON"
python3 -c "import json; json.load(open('manifest.json'))" 2>/dev/null && pass "manifest.json validates" || fail "invalid manifest.json"

header "2. manifest.json has required keys"
for key in manifest_version name version description permissions host_permissions action background content_scripts; do
  python3 -c "import json; exit(0 if '$key' in json.load(open('manifest.json')) else 1)" 2>/dev/null && pass "key: $key" || { fail "missing key: $key"; }
done

header "3. All referenced files exist"
python3 << 'PYEOF' 2>/dev/null
import json, os, sys
d = json.load(open('manifest.json'))
ok = True
files = []
for cs in d.get('content_scripts', []):
    files.extend(cs.get('js', []))
bg = d.get('background', {})
sw = bg.get('service_worker')
if sw: files.append(sw)
for src in (d.get('icons', {}), d.get('action', {}).get('default_icon', {})):
    files.extend(src.values())
for f in files:
    exists = os.path.isfile(f)
    print(f"  {'OK' if exists else 'FAIL'}: {f}")
    if not exists: ok = False
if not ok: sys.exit(1)
PYEOF
[ $? -eq 0 ] && pass "all referenced files exist" || fail "some referenced files missing"

header "4. Check for misspelled message constants"
for pattern in "YT_YOUDERSIFY_" "YT_YOUDIVERSIFY_"; do
  count=$(grep -rl "$pattern" --include="*.js" . 2>/dev/null | wc -l)
  echo "  $pattern -> $count file(s)"
done
typo_files=$(grep -rln "YOUDERSIFY\|YOUTUBIFY\|YOUDIVERSIFYY\|YOUTUBERSIFY" --include="*.js" . 2>/dev/null || true)
if [ -z "$typo_files" ]; then
  pass "no suspicious constant typos"
else
  echo "$typo_files" | while IFS= read -r f; do echo "  $f"; done
  fail "found suspicious constants"
fi

header "5. Check required content constants"
grep -q 'const OVERLAY_STATE_KEY =' content.js \
  && pass "content.js declares OVERLAY_STATE_KEY" \
  || fail "content.js uses overlay restore state but does not declare OVERLAY_STATE_KEY"

header "6. Check for dead legacy overlay messages"
dead_overlay=$(grep -n 'YT_YOUDIVERSIFY_SHOW_OVERLAY' background.js content.js global_overlay.js 2>/dev/null || true)
if echo "$dead_overlay" | grep -q 'background.js'; then
  fail "legacy YT_YOUDIVERSIFY_SHOW_OVERLAY fallback remains"
else
  pass "no legacy overlay fallback"
fi

header "7. Check manager open-video does not use undefined target variable"
bad_open=$(grep -n 'YT_YOUDIVERSIFY_OPEN_VIDEO.*url: target' global_overlay.js 2>/dev/null || true)
[ -z "$bad_open" ] && pass "manager open-video URL is not using target variable" || { echo "$bad_open"; fail "manager open-video uses wrong URL variable"; }

header "8. Check for blocking alert() calls in content.js"
alerts=$(grep -n "alert(" content.js 2>/dev/null || true)
if [ -z "$alerts" ]; then
  pass "no alert() calls"
else
  echo "$alerts"
  fail "found alert() calls"
fi

header "9. Verify no default_popup in manifest"
python3 -c "import json; exit(0 if 'default_popup' in json.load(open('manifest.json')).get('action', {}) else 1)" 2>/dev/null \
  && fail "manifest has default_popup" || pass "no default_popup"

header "10. Check no orphaned popup files"
for f in popup.html popup.js popup.css; do
  [ -f "$f" ] && fail "orphaned: $f" || pass "$f removed"
done

header "11. Check isYoutubeWatchUrl uses strict URL parsing"
grep -q 'parsed.pathname === "/watch"' background.js && pass "strict pathname check" || fail "isYoutubeWatchUrl does not check parsed.pathname"
grep -q 'parsed.searchParams.has("v")' background.js && pass "strict v param check" || fail "isYoutubeWatchUrl does not check parsed.searchParams"

header "12. Check no volumeOpen state in global_overlay.js"
! grep -q 'volumeOpen' global_overlay.js && pass "no volumeOpen in global_overlay.js" || fail "volumeOpen state still present"

header "13. Check toolbar action toggles overlay"
python3 << 'PYEOF'
from pathlib import Path
text = Path("background.js").read_text()
start = text.index("async function toggleOverlayFromAction")
end = text.index("async function rememberOverlayTabForNavigation")
block = text[start:end]
ok = "YT_YOUDIVERSIFY_GLOBAL_TOGGLE_OVERLAY" in block and "YT_YOUDIVERSIFY_GLOBAL_SHOW_OVERLAY" not in block
raise SystemExit(0 if ok else 1)
PYEOF
[ $? -eq 0 ] && pass "toolbar action uses overlay toggle message" || fail "toolbar action does not toggle overlay"

header "14. Check right-panel done flag resets before guard"
python3 << 'PYEOF'
from pathlib import Path
text = Path("content.js").read_text()
start = text.index("async function blockVisibleRightPanelChannels")
end = text.index("function scheduleRightPanelBlockScan")
block = text[start:end]
reset = block.index("rightPanelBlockDone = false")
guard = block.index("if (rightPanelBlockDone) return")
raise SystemExit(0 if reset < guard else 1)
PYEOF
[ $? -eq 0 ] && pass "right-panel done flag resets before done guard" || fail "rightPanelBlockDone can block future videos"

header "15. Check manager fallback sets force-play marker"
python3 << 'PYEOF'
from pathlib import Path
text = Path("global_overlay.js").read_text()
has_key = 'const FORCE_PLAY_ONCE_KEY = "yt_youdiversify_force_play_once"' in text
has_helper = "async function markForcePlayOnce" in text
fallback = text[text.index('const response = await safeSendMessage({ type: "YT_YOUDIVERSIFY_OPEN_VIDEO"'):]
has_call = "await markForcePlayOnce(url);" in fallback
raise SystemExit(0 if has_key and has_helper and has_call else 1)
PYEOF
[ $? -eq 0 ] && pass "manager fallback marks one-time force play" || fail "manager fallback can skip downvoted videos"

header "16. Check downvote-and-skip is user-initiated"
grep -q 'reason === "overlay-dislike"' content.js \
  && pass "overlay-dislike is treated as user-initiated" \
  || fail "overlay-dislike does not set userPressedNext"

header "17. Check background open-video normalizes YouTube URL"
python3 << 'PYEOF'
from pathlib import Path
text = Path("background.js").read_text()
start = text.index("async function openInYoutubeTab")
end = text.index("chrome.action.onClicked")
block = text[start:end]
ok = (
    'safeUrl.protocol = "https:"' in block and
    'safeUrl.hostname = "www.youtube.com"' in block and
    'safeUrl.search = `?v=${encodeURIComponent(videoId)}`' in block and
    'safeUrl.hash = ""' in block
)
raise SystemExit(0 if ok else 1)
PYEOF
[ $? -eq 0 ] && pass "background open-video URL is normalized" || fail "background open-video URL is not normalized"

header "18. Check skip candidates avoid current channel"
python3 << 'PYEOF'
from pathlib import Path
text = Path("content.js").read_text()
has_helper = "function isSameChannel" in text
playlist = text[text.index("async function getPlaylistNextVideo"):text.index("function getVideo()")]
recommendations = text[text.index("async function findNextPlayableVideo"):text.index("async function waitForRecommendationCountToGrow")]
ok = (
    has_helper and
    "const currentChannel = getChannelInfo();" in playlist and
    "if (isSameChannel(currentChannel, e)) return false;" in playlist and
    "const currentChannel = getChannelInfo();" in recommendations and
    "if (isSameChannel(currentChannel, data)) continue;" in recommendations
)
raise SystemExit(0 if ok else 1)
PYEOF
[ $? -eq 0 ] && pass "skip filters avoid the current channel" || fail "skip can choose the current channel"

header "19. Check manager playlist view avoids current channel"
python3 << 'PYEOF'
from pathlib import Path
content = Path("content.js").read_text()
overlay = Path("global_overlay.js").read_text()
ok = (
    "channel: getChannelInfo()" in content and
    "function isSameChannel" in overlay and
    'safeSendMessage({ type: "YT_YOUDIVERSIFY_FIND_TARGET" }' in overlay and
    "if (isSameChannel(currentChannel, e)) return false;" in overlay
)
raise SystemExit(0 if ok else 1)
PYEOF
[ $? -eq 0 ] && pass "manager playlist filters current channel" || fail "manager playlist can show current channel"

header "20. Check blocked-channel name handling is normalized"
python3 << 'PYEOF'
from pathlib import Path
content = Path("content.js").read_text()
overlay = Path("global_overlay.js").read_text()
ok = (
    "const normalizedName = normalizeChannelText(channelName);" in content and
    "normalizeChannelText(c.channelName) === normalizedName" in content and
    "const normalizedName = normalizeChannelName(channelName);" in overlay and
    "normalizeChannelName(c.channelName) === normalizedName" in overlay
)
raise SystemExit(0 if ok else 1)
PYEOF
[ $? -eq 0 ] && pass "blocked-channel names are normalized" || fail "blocked-channel names use raw matching"

if [ "${SKIP_ZIP_CHECK:-0}" = "1" ]; then
  pass "zip check skipped"
else
  header "21. Verify zip runtime files match local files"
  python3 << 'PYEOF'
import zipfile, pathlib, sys
required = ["manifest.json", "background.js", "content.js", "global_overlay.js"]
with zipfile.ZipFile("youdiversify.zip") as z:
    ok = True
    for name in required:
        same = z.read(name) == pathlib.Path(name).read_bytes()
        print(f"  {'OK' if same else 'FAIL'}: {name}")
        ok = ok and same
    sys.exit(0 if ok else 1)
PYEOF
  [ $? -eq 0 ] && pass "zip runtime files are current" || fail "zip runtime files are stale"
fi

echo
echo "================"
[ "$errors" -eq 0 ] && echo "All checks passed." || echo "$errors check(s) failed."
exit "$errors"
