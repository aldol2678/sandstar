#!/usr/bin/env python3
"""Re-encode patched HTML into a worker module on the v37 baseline.

Only the HTML const content changes; everything outside it must stay
byte-identical to v37-baseline-main-inner.mjs.
"""
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE / "v37-baseline-main-inner.mjs"
HTML = HERE / "phase0-index.html"
OUT = HERE / "phase0-main-inner.mjs"

src = BASE.read_text(encoding="utf-8")
html = HTML.read_text(encoding="utf-8")
marker = 'const HTML="'
start = src.index(marker)
assert start >= 0
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
    # Same as npc-p0/build.py, PLUS \t: the v37 const contains 4,122 \t
    # escapes (Three.js shader strings). Without re-escaping them they
    # become literal tabs, which changes bytes and breaks JSON-based
    # round-trip extraction.
    return (s.replace("\\", "\\\\").replace('"', '\\"')
             .replace("\n", "\\n").replace("\r", "\\r")
             .replace("\t", "\\t").replace("\b", "\\b").replace("\f", "\\f"))

new = src[:start + len(marker)] + js_escape(html) + src[end:]
assert new[:start + len(marker)] == src[:start + len(marker)]
assert new[end + (len(new) - len(src)):] == src[end:]
OUT.write_text(new, encoding="utf-8")
print("worker bytes:", len(new.encode()), "sha256:", hashlib.sha256(new.encode()).hexdigest())
print("baseline bytes:", len(src.encode()))
