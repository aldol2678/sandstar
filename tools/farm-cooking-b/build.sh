#!/usr/bin/env bash
# Build the farm+cooking B Worker module.
#
# Usage: tools/farm-cooking-b/build.sh [--base v44|v41|v39|v38] [--qa] [--glb static|inline] [build-dir]
#   --base v44 (default)  production baseline: release/v44/main.mjs (live serving script, game v44,
#                         fetched by Moa 2026-11-23 22:47 KST), module SHA-256 0951ddf7...
#   --base v41            release/v41/main.mjs (Cloudflare sandstar v41, 8b55cd67-...), SHA-256 7da5888c...
#   --base v39            v38 + tools/onboarding/patch-v38.py (PR #12), module SHA-256 c28b2b61...
#   --base v38            the archived v38 module (release/v38/main.mjs)
#   --qa                  local QA build: adds the world-time skip / scene mode / scene probe hooks
#                         the Playwright gates use. Never deploy a --qa build.
#   --glb static (default) GLBs go to <build-dir>/assets (Cloudflare Workers Static Assets, deploy
#                         with --assets); the Worker module carries no GLB bytes (startup CPU, 10021).
#   --glb inline          previous approach: GLBs base64-inlined into the module (+1.4 MB). The held
#                         v39/v41 candidate SHAs (b8d86f70... / 3b36af90...) come from commit 32c2904.
#   build-dir             default dist/farm-cooking-b-<base>[-qa] (gitignored)
# Local build only: no upload, no deploy.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
base=v44 qa="" glb=static
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base) base="$2"; shift 2;;
    --qa) qa="--qa"; shift;;
    --glb) glb="$2"; shift 2;;
    *) args+=("$1"); shift;;
  esac
done
out="${args[0]:-$root/dist/farm-cooking-b-$base${qa:+-qa}}"
mkdir -p "$out"

sha256sum -c <<SHA256
78b4503ad11f8944710bef061d861e95befc72b5debfc719e205c6c02c60ed07  $root/release/v38/main.mjs
SHA256
case "$base" in
  v44) sha256sum -c <<SHA256
0951ddf75d732f4d4f2a9ed4c60751db4d497f29ecb2c1a9ce5e62c155ecd4c3  $root/release/v44/main.mjs
SHA256
       cp "$root/release/v44/main.mjs" "$out/base-main.mjs";;
  v41) sha256sum -c <<SHA256
7da5888cd96d8b99b624e06d59a5492b29b3b67b442bc421f5e72ebc6a4ba5c3  $root/release/v41/main.mjs
SHA256
       cp "$root/release/v41/main.mjs" "$out/base-main.mjs";;
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
if [ "$base" = v44 ]; then
  python3 "$root/tools/mining-onboarding/patch.py" "$out/fcb-index.html" "$out/fcb-index.html"
  python3 "$root/tools/farm-market/patch.py" "$out/fcb-index.html" "$out/fcb-index.html"
fi
python3 "$root/tools/farm-cooking-b/rebuild-worker.py" "$out/base-main.mjs" "$out/fcb-index.html" "$out/fcb-main.mjs"
case "$glb" in
  static) python3 "$root/tools/farm-cooking-b/stage-static-assets.py" "$root/assets/glb" "$out/assets"
          if grep -q "FCB_GLB=" "$out/fcb-main.mjs"; then echo "GLB bytes found in the module" >&2; exit 4; fi;;
  inline) rm -rf "$out/assets"; python3 "$root/tools/farm-cooking-b/add-worker-assets.py" "$out/fcb-main.mjs" "$root/assets/glb";;
  *) echo "unknown --glb: $glb" >&2; exit 2;;
esac
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
  if grep -q "setSceneMode\|advance:sec=>\|sceneProbe:\|sceneFocus:" "$out/fcb-index.html"; then echo "QA hook code present in a non-QA build" >&2; exit 3; fi
fi
echo "base: $base · qa hooks: ${qa:-off} · glb: $glb"
sha256sum "$out/base-main.mjs" "$out/fcb-index.html" "$out/fcb-main.mjs"
