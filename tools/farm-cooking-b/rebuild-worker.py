#!/usr/bin/env python3
"""Re-encode a patched HTML into the v38 Worker module.

Usage: rebuild-worker.py <base-module.mjs> <patched.html> <out.mjs>
Only the HTML const content changes; every byte outside it must stay identical
to the base module (same escaping rules as tools/phase0-v38/rebuild-worker.py).
"""
import hashlib, sys
from pathlib import Path

base, html_path, out = (Path(a) for a in sys.argv[1:4])
src = base.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
marker = 'const HTML="'
start = src.index(marker)
i = start + len(marker)
end = -1
while i < len(src):
    c = src[i]
    if c == "\\":
        i += 2
        continue
    if c == '"':
        end = i
        break
    i += 1
assert end > 0


def js_escape(s):
    return (s.replace("\\", "\\\\").replace('"', '\\"')
             .replace("\n", "\\n").replace("\r", "\\r")
             .replace("\t", "\\t").replace("\b", "\\b").replace("\f", "\\f"))


new = src[:start + len(marker)] + js_escape(html) + src[end:]
assert new[:start + len(marker)] == src[:start + len(marker)]
assert new[end + (len(new) - len(src)):] == src[end:]
out.write_text(new, encoding="utf-8")
print("worker bytes:", len(new.encode()), "sha256:", hashlib.sha256(new.encode()).hexdigest())
