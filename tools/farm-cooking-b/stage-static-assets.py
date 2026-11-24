#!/usr/bin/env python3
"""Stage the kitchen-scene GLBs as Cloudflare Workers Static Assets (outside the Worker module).

Usage: stage-static-assets.py <glb-dir> <assets-out-dir>

Why: a Worker's script startup CPU grows with the module, and inlining the three GLBs as base64
added ~1.4 MB to it (v41 already hit `Script startup exceeded CPU time limit [10021]` once).
Static Assets are uploaded next to the Worker and served by Cloudflare before the Worker runs,
on the same paths the page already lazy-loads: /fcb/glb/<stem>-<sha8>.glb (immutable, the page
checks size + SHA-256 before parsing). The Worker module itself carries no GLB bytes.

Deploy (test Worker only, never production without 알돌 approval):
  wrangler deploy fcb-main.mjs --name <test-worker> --compatibility-date 2026-11-18 --no-bundle --assets <assets-out-dir>

Writes <assets-out-dir>/fcb/glb/*.glb and <assets-out-dir>/_headers, and prints the file list with SHA-256.
Refuses to run if a GLB does not match assets/glb/SHA256SUMS.txt.
"""
import hashlib, shutil, sys
from pathlib import Path

glb_dir, out = Path(sys.argv[1]), Path(sys.argv[2])
STEMS = ["wheat-crop-c073", "potato-crop-c047", "carrot-crop-carrot"]
sums = dict(reversed(l.split()) for l in (glb_dir / "SHA256SUMS.txt").read_text().splitlines() if l.strip())

if out.exists():
    shutil.rmtree(out)
(out / "fcb" / "glb").mkdir(parents=True)
listing = []
for stem in STEMS:
    data = (glb_dir / f"{stem}.glb").read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    assert sha == sums[f"{stem}.glb"], f"glb sha mismatch {stem}"
    rel = f"fcb/glb/{stem}-{sha[:8]}.glb"
    (out / rel).write_bytes(data)
    listing.append((rel, len(data), sha))

# Cloudflare Workers Static Assets header rules (same values the inline route used to send).
(out / "_headers").write_text(
    "/fcb/glb/*\n"
    "  Content-Type: model/gltf-binary\n"
    "  Cache-Control: public, max-age=31536000, immutable\n"
    "  X-Content-Type-Options: nosniff\n", encoding="utf-8")

for rel, n, sha in listing:
    print(f"asset {rel} {n}B sha256 {sha}")
print("static assets:", len(listing), "files,", sum(n for _, n, _ in listing), "bytes")
