"""Verify reviewed A-spot assets, serving only image bytes as static assets."""
from pathlib import Path
import hashlib
import sys

src, out = map(Path, sys.argv[1:])
expected = set("angler-atlas far-background front-bank underwater-gradient surface-tile bottom-tile river_fish perch carp prop-reeds prop-stones bobber-32".split())
expected = {x+".webp" for x in expected} | {"angler-atlas.json"}
data = {}
for line in (src / "SHA256SUMS.txt").read_text().splitlines():
    sha, name = line.split()
    if name not in expected or name in data:
        raise ValueError(f"unexpected A-spot art: {name}")
    data[name] = (src / name).read_bytes()
    if hashlib.sha256(data[name]).hexdigest() != sha:
        raise ValueError(f"unexpected A-spot hash: {name}")
if set(data) != expected:
    raise ValueError("incomplete A-spot art")
dest = out / "fishing-s1/a-v03"
dest.mkdir(parents=True, exist_ok=True)
with (out / "_headers").open("a", encoding="utf8") as f:
    for name, b in sorted(data.items()):
        if not name.endswith(".webp"):
            continue
        (dest / name).write_bytes(b)
        f.write(f"\n/fishing-s1/a-v03/{name}\n  Content-Type: image/webp\n  Cache-Control: public, max-age=31536000, immutable\n  X-Content-Type-Options: nosniff\n")
print("A-spot static art:", sum(len(v) for k,v in data.items() if k.endswith(".webp")), "bytes")
