# Mining P1.6-F → Cloudflare v31: source provenance and read-only comparison

Checked 2026-11-22 KST. **Status: v31 source identity attested by operator; original bytes NOT transferred into this session; P1.6-F comparison HOLD.**

## 1. What is CURRENT vs historical

| Source | Identity | Confidence |
| --- | --- | --- |
| Current Cloudflare deployment | `sandstar` Worker **v31**, version ID `fb1dadd9-1ed2-4375-baf3-27f33173180d`; deployed 2026-11-21 05:39:43 UTC (14:39 KST), 100% traffic | **Current metadata readback** from Cloudflare deployments API |
| v31 deploy workspace | `~/workspace/sandstar/npc-p0/`, `base-index.html`, `build.py` → `dist-worker/main-inner.mjs` | **2026-11-22 operator readback** of v31; source bytes remain in operator workspace, not yet received here |
| P1.6-F | `SANDSTAR_MINING_P16F_ROPE_AUTO_UI_LOCAL_20261118.html`, 2,490,263 bytes, SHA-256 `444edeeaf6978b3aa575a092d64aae314743bb50e8eb3bef6d550dab38589ada` | **Local candidate SHA-256 + 11/11 Git blob readback + local Node verifier PASS** |
| GitHub `main` M2.5-D archive / old HTTP snapshot | Historical independent QA and observed HTML | **Not a v31 Wrangler origin** |

Reference: [Moa v23 source-workspace statement](https://aram-ney8820.slack.com/archives/C0C8ZPRPQBD/p1795179861696359) (2026-11-20 22:04 KST). At that time, the reported v23 command was `cf_wrangler.py deploy <absolute path to main-inner.mjs> --name sandstar --compatibility-date 2026-11-18 --no-bundle`. v31 may differ. The v23 report also identified a production save namespace `sandstar-p1-world-v1:official-m25d`; do **not** infer v31 migration behavior from it.

**Updated evidence:** [Moa's v31 owner-side readback](https://aram-ney8820.slack.com/archives/C0C8ZPRPQBD/p1795281278094539) reports byte-for-byte match between Cloudflare's downloaded `main-inner.mjs` multipart part and local `npc-p0/dist-worker/main-inner.mjs`. This is strong operator-side evidence for the v31 uploaded Worker artifact, distinct from assistant-side direct raw-byte verification.

- **v31 Worker module:** 19,740,934 bytes, SHA-256 `3cf7b044ae91e7f5432923250faefcebbf8d32fa3915016142ec76fbd82dbdd3`, MD5 `bea98bf1b8ab86b32c8adb4df8a97659`, local modified 2026-11-21 14:33 KST. Cloudflare v31 metadata version ID `fb1dadd9-1ed2-4375-baf3-27f33173180d`.
- **v31 source input:** `npc-p0/base-index.html`, 13,020,884 bytes, SHA-256 `7bf24e528fdad455213a2a730de8555a8b40230b298da8983663e66e0dbf921f`, operator reports unchanged since before v31 build.
- **`build.py` provenance gap:** current `npc-p0/build.py`, 52,031 bytes, SHA-256 `d0b84d8b51fa80260876961c1b138ba0a21b2d1facacd17307f97600d5134e54`, modified **2026-11-21 23:23 KST**, after v31 deployment. No confirmed byte-identical build-time snapshot. Do not declare reproducible v31 build.
- **DO NOT substitute current generated outputs:** `npc-p0/dist-worker/main.mjs` (20,084,958 bytes) and `npc-p0/dist/index.html` (19,696,203 bytes) are later (23:24 KST) and differ from v31. Historical `rollback-sfx32-pre/main-inner.mjs` (18,825,234 bytes) is **pre-v31**, not the current Worker.
- **Embedded HTML and audio:** operator reported embedded HTML 19,352,191 bytes, SHA-256 `72667b039eb4c3d067a82cd6e3d3717add6ee74f65fa0f2d0ce7b6a4c046e6a7`; 38 SFX with 32 new MP3 references checked against a manifest. Rights/security still need explicit audit.
- There is **no dedicated full v31 archive** currently in the operator workspace or Drive (per operator). A [new owner-only transfer request](https://aram-ney8820.slack.com/archives/C0C8ZPRPQBD/p1795282709663249) was sent to enable source-level comparison.

**Remaining blocker:** Cloudflare script-content retrieval through this assistant's connector exceeds memory limits and the operator's `~/workspace/sandstar/npc-p0/` is not mounted here. **Full v31 source bytes are NOT present in this session**, so no feature-level `v31 ↔ P1.6-F` source diff has been performed. Public HTTP output differs from the uploaded Worker and cannot substitute for exact source provenance.

## 2. Independent read-only comparison tool

```sh
# Before comparing, separately verify provenance: which exact workspace/build artifact
# produced version fb1dadd9-1ed2-4375-baf3-27f33173180d?
node tools/verify-mining-p16f.mjs

# Optional: reconstruct the local P1.6-F candidate in dist/ (ONLY in an isolated checkout).
node tools/verify-mining-p16f.mjs --write

# Use an authorized, read-only copy of the proven v31 source in place of the baseline path.
python tools/compare-mining-sources.py \
  --baseline /private/v31/base-index.html \
  --candidate dist/SANDSTAR_MINING_P16F_ROPE_AUTO_UI_LOCAL_20261118.html
```

The Python tool does **not** write, send, mutate, or deploy source; stdout contains source path/size/SHA, counts of static feature markers, function-name set deltas, and `sandstar-p1-world-v1` save namespaces. It is *only a lexical inventory*, **not** a semantic source diff, proof of build parity, or functional QA. If v31 was built from a more complex pipeline or a generated module, review generated/source relationships before interpreting results.

### Local control check (not v31)

The script was run against available independent candidates `P1.6-D1` (baseline) and `P1.6-F` (candidate) on 2026-11-22:
- 551 function declarations matching the scanner on each side; 2 names unique to each side.
- `ropeAutoMove` marker count increased **0 → 40**; `ropeAutoMoveEnabled` **0 → 22**.
- The scanner found no `sandstar-p1-world-v1` save namespace present on just one side.
- `python -m py_compile` passed and the tool emitted `static_source_inventory_only`.
- These observations validate that the scanner can surface a known targeted change. They **do not** establish that v31 has or lacks any feature.

## 3. Provenance request to original workspace operator

[Read-only handoff request in original Slack thread](https://aram-ney8820.slack.com/archives/C0C8ZPRPQBD/p1795280773670179). Requested:
1. Verify whether `~/workspace/sandstar/npc-p0/` remained the actual v31 build/deploy workspace and locate its `base-index.html`, `build.py`, `dist-worker/main-inner.mjs`.
2. Give the full SHA-256/byte sizes and evidence mapping the selected build artifact to the Cloudflare **v31 UUID**, without credentials or secrets.
3. Preserve authorized source, build configuration, and required asset inventory in private owner-only storage, without re-deploying, pushing to public repositories, or changing existing source/rollback files.

## 4. Release / merge gates (all HOLD)

- [x] v31 module identity and full SHA-256 attested by original workspace operator (Cloudflare multipart vs local byte match), with provenance recorded; **[ ] independent source copy + hash readback in review session**
- [ ] Human-reviewed feature-level v31/P1.6-F diff: mines/veins, cave/loot, drill/hammer/rope/pickaxe, 5 worlds/portals, economy, farming M3, NPC/BGM, title, SEO
- [ ] Existing production save namespace and migration read/write behavior validated on clones, not user saves
- [ ] 4-tool integrated smoke rerun on a patch derived from the v31 base, Android/PC controls, 320×568/390×844/844×390 and five-world/BGM regression
- [ ] Asset rights and secrets audit, rollback path and manual approval before merge or production deployment

**No new production code merged, CI executed, v31 source bytes transferred into this session, or Worker deployed during this task.**
