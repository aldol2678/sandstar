#!/usr/bin/env bash
# Rebuild the current verified Worker module without deploying it or changing assets/bindings.
# Usage: bash tools/farm-input/build.sh CURRENT.mjs NEW_OUTPUT_DIRECTORY
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
base="$(realpath "$1")"
out="$(realpath -m "$2")"
test -f "$base"
test ! -e "$out" || { echo "Output directory must not exist" >&2; exit 2; }
mkdir -p "$out"
node "$root/tools/phase0-v38/extract-html.mjs" "$base" "$out/base.html"
python3 "$root/tools/farm-input/patch.py" "$out/base.html" "$out/candidate.html"
python3 "$root/tools/farm-cooking-b/rebuild-worker.py" "$base" "$out/candidate.html" "$out/main.mjs"
node --check "$out/main.mjs"
node -e '
const fs=require("fs"),vm=require("vm");let i=0;
for(const m of fs.readFileSync(process.argv[1],"utf8").matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1],{filename:"inline-"+(++i)+".js"});
if(!i)throw Error("no inline scripts");
console.log("inline script syntax checked:",i);
' "$out/candidate.html"
node "$root/tools/farm-input/qa.cjs" "$out/candidate.html"
sha256sum "$base" "$out/base.html" "$out/candidate.html" "$out/main.mjs"
echo "Candidate only. Retain the original Worker static assets and bindings; no upload/deploy."
