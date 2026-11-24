#!/usr/bin/env python3
"""Add the kitchen-scene GLB routes to a rebuilt Worker module.

Usage: add-worker-assets.py <module.mjs> <glb-dir>   (edits the module in place)

The three ingredient GLBs are NOT inlined into the HTML. They are served on
their own immutable paths (/fcb/glb/<stem>-<sha8>.glb) so the page downloads
them only when the kitchen scene asks for them (lazy-load). The insertion
points are exact-match and must occur exactly once, else nothing is written.
"""
import base64, hashlib, sys
from pathlib import Path

mod, glb_dir = Path(sys.argv[1]), Path(sys.argv[2])
src = mod.read_text(encoding="utf-8")
STEMS = ["wheat-crop-c073", "potato-crop-c047", "carrot-crop-carrot"]

sums = dict(reversed(l.split()) for l in (glb_dir / "SHA256SUMS.txt").read_text().splitlines() if l.strip())
entries = []
for stem in STEMS:
    data = (glb_dir / f"{stem}.glb").read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    assert sha == sums[f"{stem}.glb"], f"glb sha mismatch {stem}"
    entries.append(f'"/fcb/glb/{stem}-{sha[:8]}.glb":"{base64.b64encode(data).decode()}"')

const = "const FCB_GLB=Object.freeze({" + ",".join(entries) + "});\n"
route = ('if(Object.prototype.hasOwnProperty.call(FCB_GLB,p))return new Response(req.method==="HEAD"?null:b64bytes(FCB_GLB[p]),'
         '{headers:{...h,"content-type":"model/gltf-binary","cache-control":"public, max-age=31536000, immutable"}});\n')


def once(hay, needle, label):
    n = hay.count(needle)
    assert n == 1, f"{label}: expected 1, found {n}"


once(src, "export default {", "module export")
once(src, 'if(p==="/"||p==="/index.html")', "index route")
src = src.replace("export default {", const + "export default {")
src = src.replace('if(p==="/"||p==="/index.html")', route + 'if(p==="/"||p==="/index.html")')
mod.write_text(src, encoding="utf-8")
print("worker bytes:", len(src.encode()), "sha256:", hashlib.sha256(src.encode()).hexdigest(), "glb routes:", len(entries))
