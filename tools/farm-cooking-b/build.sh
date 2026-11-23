#!/usr/bin/env bash
# Build the farm+cooking B Worker module.
#
# Usage: tools/farm-cooking-b/build.sh [--base v39|v38] [--qa] [build-dir]
#   --base v39 (default)  production baseline: v38 + tools/onboarding/patch-v38.py (PR #12),
#                         Cloudflare sandstar v39, module SHA-256 c28b2b61...
#   --base v38            the archived v38 module (release/v38/main.mjs)
#   --qa                  local QA build: adds the world-time skip / scene mode hooks the
#                         Playwright gates use. Never deploy a --qa build.
#   build-dir             default dist/farm-cooking-b-<base>[-qa] (gitignored)
# Local build only: no upload, no deploy.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
base=v39 qa=""
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base) base="$2"; shift 2;;
    --qa) qa="--qa"; shift;;
    *) args+=("$1"); shift;;
  esac
done
out="${args[0]:-$root/dist/farm-cooking-b-$base${qa:+-qa}}"
mkdir -p "$out"

sha256sum -c <<SHA256
78b4503ad11f8944710bef061d861e95befc72b5debfc719e205c6c02c60ed07  $root/release/v38/main.mjs
SHA256
case "$base" in
  v38) cp "$root/release/v38/main.mjs" "$out/base-main.mjs";;
  v39) python3 "$root/tools/onboarding/patch-v38.py" "$root/release/v38/main.mjs" "$out/base-main.mjs"
       sha256sum -c <<SHA256
c28b2b61768bf63a5e89360e3d207a83c7b9672c8b46ac4c796113aefd9bbc49  $out/base-main.mjs
SHA256
       ;;
  *) echo "unknown base: $base" >&2; exit 2;;
esac

node "$root/tools/phase0-v38/extract-html.mjs" "$out/base-main.mjs" "$out/base-index.html"
python3 "$root/tools/farm-cooking-b/patch-farm-cooking.py" "$out" $qa
python3 "$root/tools/farm-cooking-b/rebuild-worker.py" "$out/base-main.mjs" "$out/fcb-index.html" "$out/fcb-main.mjs"
python3 "$root/tools/farm-cooking-b/add-worker-assets.py" "$out/fcb-main.mjs" "$root/assets/glb"
node --check "$out/fcb-main.mjs"
# Inline JavaScript syntax check: every <script> block of the patched HTML.
node -e '
const fs=require("fs"),vm=require("vm");const h=fs.readFileSync(process.argv[1],"utf8");
const re=/<script>([\s\S]*?)<\/script>/g;let m,i=0;
while((m=re.exec(h))){i++;new vm.Script(m[1],{filename:"block"+i+".js"});}
console.log("inline script blocks syntax OK:",i);' "$out/fcb-index.html"
# QA hooks must exist only in --qa builds.
hooks=$(grep -c "qaHooks:true" "$out/fcb-index.html" || true)
if [ -n "$qa" ]; then [ "$hooks" = 1 ] || { echo "QA hooks missing from --qa build" >&2; exit 3; }
else
  [ "$hooks" = 0 ] || { echo "QA hooks present in a non-QA build" >&2; exit 3; }
  if grep -q "setSceneMode\|advance:sec=>" "$out/fcb-index.html"; then echo "QA hook code present in a non-QA build" >&2; exit 3; fi
fi
echo "base: $base · qa hooks: ${qa:-off}"
sha256sum "$out/base-main.mjs" "$out/fcb-index.html" "$out/fcb-main.mjs"
