# SANDSTAR HTTP Snapshot vs QA Archive: Source Recovery Comparison

Date: 2026-11-19 KST · Status: **STATIC EVIDENCE ONLY / PROD EQUIVALENCE UNKNOWN**

**Subsequent deployment:** Cloudflare `sandstar` v22 (`949c7699-9455-4617-a585-c9c55105ab06`) deployed at 2026-11-19 07:19:41 KST. This is **after the v21-era HTTP observation**; do not attribute this archived HTML to v22, and do not assume an immutable v21 byte match.

## Source ledger

| Evidence | Bytes | Class |
| --- | ---: | --- |
| Archived `M25D-UI1-REGION-BGM-QA` from Drive / GitHub PR #5 | 5,923,918 | Verified archived QA candidate, not exact production source |
| `recovered/live-http-20261119/parts/*` | 12,019,476 | Firecrawl `rawHtml` observation via public `sandstar.aldol.app` route |
| Cloudflare `sandstar` v21 (`032cf8b8-ed7b-4ce7-8228-bef1038331f7`) | NOT ACQUIRED | Wrangler source not available from the current connector |
| Cloudflare `sandstar` v20 (`6ff911f0-e9ae-450d-90f9-bd3d8ec59213`) | NOT ACQUIRED | Prior deployment retained as historic comparison target |
| `sandstar-title-bridge` worker source from Drive | 659,846 | Archived source, deployment-record hash matches, live code comparison unverified |

Live HTTP observation and Firecrawl `rawHtml` are **different layers** from source code. A separate direct HTTP capture produced 11,998,630 bytes, whereas this archive's UTF-8 content is 12,019,476 bytes. This difference is a scraper/output caveat, not evidence of a functional build change.

## Independent static inspection

An independent comparison between the archived QA HTML and a separate public `rawHtml` observation found:

- Both HTML documents had the page title `흙별 | SANDSTAR`.
- QA had **one** inline `<script>`; observed live HTML had **four**. One of the live scripts was Cloudflare Insights, and two short scripts accompanied the title UI.
- Main inline script text was approximately **5.77M characters** in QA versus **11.18M characters** in the observed live page. It was **not exactly identical**.
- `ssTitleArt` occurred in the live observation but not the QA archive; this is consistent with the separate title injection bridge, **not proof of v21 game logic changing**.
- `ssM1Act`, `mine-exit`, `m1QuestBadge`, `worldId`, `sandstar-p1-world-v1` and `localStorage` were detectable in both.
- `drill`, `chest`, `farm`, `rope` and `NPC` appeared in both, but keyword presence proves **neither feature completeness nor runtime correctness**.
- Save-key tokens should be inspected as parsed JS string expressions. A literal concatenated `sandstar-p1-world-v1:official-m25d` was not present in the sampled HTML responses, although its components were.

The observed page includes the separate title bridge and potentially telemetry/asset injection. It cannot be treated as the unmodified output of the Cloudflare origin Worker or as an exact immutable release artifact.

## Offline manual procedure

Run `node tools/verify-http-snapshot.mjs` to verify and reconstruct archived bytes **in memory**. With `--compare-qa`, validate the existing QA archive and print markers from both. Add `--write` only when local HTML output is explicitly needed. These commands do not deploy, start CI, or modify user saves.

## Remaining P0

1. Recover the **actual v21 Wrangler upload source**, asset manifest, and local build configuration from the authorized deployment workspace. If unavailable, record an irrecoverable source gap, not an invented reconstruction.
2. Compare v21 and v20 to the QA archive at code, static-assets, save-key and world transition levels, separated from title-bridge injection.
3. Perform a secret/license audit and Android + PC real-device save, portal, mining, rope and BGM QA before any promotion to canonical production source.

No Cloudflare deployment, GitHub Actions, CI, or save-data changes made by this recovery branch.
