# SANDSTAR mining P1.6-F archive and v31 intake gate

Status: **source archived for review, NOT integrated or released** · 2026-11-22 KST.

## Grounded source identity
- Local candidate: `SANDSTAR_MINING_P16F_ROPE_AUTO_UI_LOCAL_20261118.html` (2026-11-18).
- Size: **2,490,263 bytes**, SHA-256 `444edeeaf6978b3aa575a092d64aae314743bb50e8eb3bef6d550dab38589ada`.
- Archive: `recovered/mining-p16f-20261118/parts/part-01.txt` through `part-11.txt`; each Git blob SHA-1 verified against the original byte slices; `manifest.json` records sizes and hashes.
- Verify without modifications: `node tools/verify-mining-p16f.mjs`. Optional `--write` reconstructs the HTML in `dist/`.
- Independently checked the embedded JavaScript using `node --check` on the one inline script (Node v22.16.0): PASS.
- This is a **local/isolated QA candidate** only. Never use these parts as a Cloudflare Worker source or replace `main` / production on this evidence alone.

## What changed since the earlier local P1.6-D1 candidate
The D1 HTML had 2,487,795 bytes / SHA-256 `dee99137b14f762168cedbc12ac167330dc06a1c970601ca06d18df59e232aa8`. The F HTML is 2,468 bytes larger; line-based sequence comparison counted **33 non-equal hunks**. Key differences verified in the F source:
- P1.6-E: tap-to-connect/disconnect rope; manual vertical movement and rope handling; portrait HUD no-overlap tweaks.
- P1.6-F: optional center-bottom auto-ascent toggle `ropeAutoMove`, opt-in, canceled by explicit manual direction, jump, detachment or swing; automatic movement not persisted.
- Rope state and button labels updated; old P1.6-D1 sandbox save namespace stays `sandstar-p1-world-v1:pickaxe-p16d1-20261118-sandbox`.
- Inherited P1.6-D1 features: vein-tracking pickaxe, drill, hammer, rope, treasure/forge progression. No claim of a comprehensive new-game diff.

## Previous isolated QA (not rerun here)
- 2026-11-18 P1.6-F automated auto-ascent **38/38**, E regression **40/40** in simulated Chromium 844×390 and 390×844; no live release.
- Earlier P1.6-D1 four-tool integrated smoke QA **95/96**; portrait drill/rope HUD overlap, later E/F targeted HUD non-overlap QA PASS. **Full four-tool integrated rerun on F is not evidenced.**
- Real Android multi-finger input, real browser-origin save/restore, 320×568 screen, long-session performance and five-world transitions remain **HOLD**.

## Cloudflare production identity (read-only API, verified 2026-11-22)
- Current Worker script: `sandstar`, **v31**; version ID `fb1dadd9-1ed2-4375-baf3-27f33173180d`; latest 100% deployment `d6787361-7416-4998-b9dc-576b979021db` created 2026-11-21 05:39:43 UTC.
- Historical **v22** version ID `949c7699-9455-4617-a585-c9c55105ab06`. It is **not the current release**.
- The Cloudflare source download exceeded connector memory limits; the API version metadata is **not source code**. Exact v31 ↔ P1.6-F and v22 ↔ P1.6-F code diff is **UNKNOWN**, not PASS. Public HTTP snapshots and M2.5-D QA do not establish Wrangler bundle identity.
- Never apply the local P1.6-F HTML over production or label GitHub `main` operationally canonical without original Wrangler project intake and diff.

## Integration checklist (all blocked until evidence)
- [ ] Obtain **v31 actual Wrangler workspace or authorized exact source artifact**, config and assets, verify SHA and version provenance; retain v22 as historical reference.
- [ ] Compare v31 vs P1.6-F at feature level and produce conflict map for: mining/rope/drill/hammer/pickaxe; farming M3; 5 worlds and portals; NPC/dialogue; BGM/title/SEO; economy and save keys.
- [ ] Preserve existing production saves. Test v31 → staged candidate migration/restore on cloned saves only, never write back to real users.
- [ ] Rerun four-tool and P1.6-E/F integration tests; Android + PC viewport/physical touch QA and all five worlds, with manual release gate.
- [ ] Separate implementable feature patch PR from archive-only intake PR; do not merge, trigger private CI or deploy without independent gate.

Related: [issue #1](https://github.com/aldol2678/sandstar/issues/1), [issue #2](https://github.com/aldol2678/sandstar/issues/2), [v22 intake PR #8](https://github.com/aldol2678/sandstar/pull/8).
