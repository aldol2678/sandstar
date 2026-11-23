#!/usr/bin/env python3
"""SANDSTAR Phase 0 follow-up patch (P0-4b + P0-5b), 2026-11-23.

Applies on top of phase0-index.html (the P0-patched v37 build).

Root cause found by Steel QA probe (probe-report.json / probe2-report.json):
  The mine surface apron (x19-67) is station-protected: stationProtectedType
  returns 'grass' for y=78, so tile() reports grass, but setTile() refuses
  to carve any tile where stationGeneratedTile()!==undefined. Result: the
  stick scan returns the apron grass as a normal target, doMine() "mines"
  it, breakBlock()'s setTile() fails SILENTLY, holdProgress resets, and the
  cycle repeats forever -- sparks + sound, zero progress, zero feedback.
  That is Yeoul #4's true root cause ("pad/long-press no response" at
  X44-55); the P0 stationrock-floor notice alone never fires there because
  the scan hits the grass first and the floor tile is out of reach (2.02).
  Fix: treat station-protected tiles as protected in miningTarget (stick
  scan + holdTarget branch) and show the guidance in breakBlock as a
  safety net for tap mining.
  P0-5b: mobile fullmap '작업 대장간'/'서온' pills still touch by ~1px
  (probe confirmed within-frame). Add a 2px clearance margin to the
  label collision test so near-touches are pushed apart too.

Usage: python3 patch-phase0b.py   (reads phase0-index.html, writes it back)
Each replacement asserts an exact count and aborts without writing on
mismatch (rep_once style, same as patch-phase0.py).
"""
import hashlib
import sys

PATH = "phase0-index.html"


def rep_once(s, old, new, name):
    n = s.count(old)
    if n != 1:
        print(f"ABORT {name}: expected 1 occurrence, found {n}")
        sys.exit(1)
    return s.replace(old, new)


def main():
    with open(PATH, encoding="utf-8") as f:
        s = f.read()
    orig_len = len(s)

    # --- P0-4b/1: stick scan: station-protected tile -> guidance, not a target.
    s = rep_once(
        s,
        "if(t&&t!=='bedrock'&&t!=='bed'&&t!=='chest'&&t!=='stationrock'&&canReach(x,y))return {x,y};",
        "if(t&&t!=='bedrock'&&t!=='bed'&&t!=='chest'&&t!=='stationrock'&&canReach(x,y)){if(ssRegion==='mine'&&stationGeneratedTile(x,y)!==undefined){ssMineNotice(ssP0ProtectedFloorMsg(x));return null;}return {x,y};}",
        "stick-scan-protected",
    )
    # --- P0-4b/2: holdTarget (long-press) branch: same guard.
    s = rep_once(
        s,
        "if(t==='stationrock'&&canReach(holdTarget.x,holdTarget.y))ssMineNotice(ssP0ProtectedFloorMsg(holdTarget.x));return t&&t!=='bedrock'&&t!=='stationrock'&&canReach(holdTarget.x,holdTarget.y)?holdTarget:null}",
        "if(t==='stationrock'&&canReach(holdTarget.x,holdTarget.y))ssMineNotice(ssP0ProtectedFloorMsg(holdTarget.x));if(t&&t!=='bedrock'&&t!=='stationrock'&&canReach(holdTarget.x,holdTarget.y)&&ssRegion==='mine'&&stationGeneratedTile(holdTarget.x,holdTarget.y)!==undefined){ssMineNotice(ssP0ProtectedFloorMsg(holdTarget.x));return null;}return t&&t!=='bedrock'&&t!=='stationrock'&&canReach(holdTarget.x,holdTarget.y)?holdTarget:null}",
        "holdtarget-protected",
    )
    # --- P0-4b/3: breakBlock safety net: silent setTile failure -> guidance.
    s = rep_once(
        s,
        "if(!setTile(x,y,null))return false;game.mined++;",
        "if(!setTile(x,y,null)){if(ssRegion==='mine'&&stationGeneratedTile(x,y)!==undefined)ssMineNotice(ssP0ProtectedFloorMsg(x));return false;}game.mined++;",
        "breakblock-protected",
    )
    # --- P0-5b: fullmap label collision test: 2px clearance margin.
    s = rep_once(
        s,
        "for(const r of rects){if(cx-tw/2<r.x1&&cx+tw/2>r.x0&&tryCy-fs-4<r.y1&&tryCy+6>r.y0){hit=true;break;}}",
        "for(const r of rects){if(cx-tw/2-2<r.x1&&cx+tw/2+2>r.x0&&tryCy-fs-6<r.y1&&tryCy+8>r.y0){hit=true;break;}}",
        "label-margin",
    )
    # --- Marker: note the follow-up in the Phase 0 marker comment.
    s = rep_once(
        s,
        "/* SANDSTAR Phase 0 2026-11-23 (phase0-20261123): Yeoul QA 5+1, on v37 baseline. */",
        "/* SANDSTAR Phase 0 2026-11-23 (phase0-20261123): Yeoul QA 5+1, on v37 baseline. Follow-up P0-4b (apron grass notice) + P0-5b (label margin) 2026-11-23. */",
        "marker",
    )

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"patched {PATH}: {orig_len} -> {len(s)} chars (+{len(s)-orig_len})")
    print("sha256:", hashlib.sha256(s.encode("utf-8")).hexdigest())


if __name__ == "__main__":
    main()
