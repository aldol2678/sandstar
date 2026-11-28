#!/usr/bin/env python3
"""Read-only SANDSTAR source fingerprint comparison (not a build equivalence test).

Usage: python tools/compare-mining-sources.py --baseline /path/to/base-index.html \
       --candidate /path/to/SANDSTAR_MINING_P16F_ROPE_AUTO_UI_LOCAL_20261118.html

Never publishes raw sources, never writes files, never connects to the network.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

MARKERS = {
    "world_mine_100m": "mine-100m",
    "world_5_generation": "worldGenVersion",
    "treasure_ledger": "treasureP13",
    "treasure_open": "p13",
    "craft_workbench": "p14",
    "forge_plus20": "p15",
    "drill_motor": "P16_DRILL_MOTORS",
    "hammer_core": "P16_HAMMER_CORES",
    "pickaxe_trace": "p16Trace",
    "rope_device": "p16Rope",
    "rope_auto_toggle": "ropeAutoMove",
    "rope_auto_enabled": "ropeAutoMoveEnabled",
    "rope_hang_pause": "ropeHangPaused",
    "mine_bgm_region": "bgm-new3",
    "npc_v23_marker": "npc-p0-noquest",
    "m3_farming": "farmM3",
    "archaeology": "archWorld",
    "title_bridge_marker": "sandstar-v2",
    "official_save_namespace": "sandstar-p1-world-v1:official-m25d",
}
FUN_PATTERN = re.compile(r"\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(")
SAVE_PATTERN = re.compile(r"sandstar-p1-world-v1(?::[A-Za-z0-9_-]+)?")


def fingerprint(path: Path):
    raw = path.read_bytes()
    text = raw.decode('utf-8')
    return {
        "path": str(path), "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "marker_counts": {key: text.count(value) for key, value in MARKERS.items()},
        "functions": set(FUN_PATTERN.findall(text)),
        "save_namespaces": set(SAVE_PATTERN.findall(text)),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--baseline', type=Path, required=True,
                    help='Local authorized Wrangler project HTML/JS source, never HTTP snapshot')
    ap.add_argument('--candidate', type=Path, required=True,
                    help='Verified isolated P1.6-F HTML candidate')
    args = ap.parse_args()
    if not args.baseline.is_file() or not args.candidate.is_file():
        ap.error('Both local files must exist; do not substitute a published HTTP response for a Wrangler source')
    base = fingerprint(args.baseline)
    cand = fingerprint(args.candidate)
    base_functions = base.pop('functions')
    cand_functions = cand.pop('functions')
    base_keys = base.pop('save_namespaces')
    cand_keys = cand.pop('save_namespaces')
    output = {
        'kind': 'static_source_inventory_only',
        'warning': 'Marker presence and source hashes do not prove version/deployment identity, runtime equivalence, save compatibility, or release readiness.',
        'baseline': base, 'candidate': cand,
        'function_name_counts': {'baseline': len(base_functions), 'candidate': len(cand_functions)},
        'function_names_only_in_baseline': sorted(base_functions - cand_functions)[:80],
        'function_names_only_in_candidate': sorted(cand_functions - base_functions)[:80],
        'only_in_baseline_total': len(base_functions - cand_functions),
        'only_in_candidate_total': len(cand_functions - base_functions),
        'save_namespaces_only_in_baseline': sorted(base_keys - cand_keys),
        'save_namespaces_only_in_candidate': sorted(cand_keys - base_keys),
        'save_namespaces_shared': sorted(base_keys & cand_keys),
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, UnicodeError) as exc:
        print(f'error reading source: {exc}', file=sys.stderr)
        sys.exit(2)
