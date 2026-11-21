# Mining P1.6-F independent local QA source archive

**Not production code and not a deployable Wrangler project.** See `docs/MINING_P16F_V31_INTAKE.md`.

The 2026-11-18 HTML is split into 11 byte-preserving Git blobs because the source contains long embedded art/audio lines. Verify with `node tools/verify-mining-p16f.mjs`; use `--write` only to reconstruct locally in `dist/`. The manifest includes the exact SHA-256 of the full source and per-blob Git SHA-1 values.

No Cloudflare deployment, GitHub Actions, production save mutation or main merge was performed by archiving.
