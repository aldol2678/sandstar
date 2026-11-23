#!/usr/bin/env bash
# Build the farm+cooking B Worker module from the committed v38 baseline.
# Usage: tools/farm-cooking-b/build.sh [build-dir]   (default: dist/farm-cooking-b, gitignored)
# Local build only: no upload, no deploy.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="${1:-$root/dist/farm-cooking-b}"
mkdir -p "$out"
sha256sum -c <<SHA256
78b4503ad11f8944710bef061d861e95befc72b5debfc719e205c6c02c60ed07  $root/release/v38/main.mjs
SHA256
node "$root/tools/phase0-v38/extract-html.mjs" "$root/release/v38/main.mjs" "$out/v38-index.html"
python3 "$root/tools/farm-cooking-b/patch-farm-cooking.py" "$out"
python3 "$root/tools/farm-cooking-b/rebuild-worker.py" "$root/release/v38/main.mjs" "$out/fcb-index.html" "$out/fcb-main.mjs"
python3 "$root/tools/farm-cooking-b/add-worker-assets.py" "$out/fcb-main.mjs" "$root/assets/glb"
node --check "$out/fcb-main.mjs"
# Inline JavaScript syntax check: every <script> block of the patched HTML.
node -e '
const fs=require("fs"),vm=require("vm");const h=fs.readFileSync(process.argv[1],"utf8");
const re=/<script>([\s\S]*?)<\/script>/g;let m,i=0;
while((m=re.exec(h))){i++;new vm.Script(m[1],{filename:"block"+i+".js"});}
console.log("inline script blocks syntax OK:",i);' "$out/fcb-index.html"
sha256sum "$out/fcb-index.html" "$out/fcb-main.mjs"
