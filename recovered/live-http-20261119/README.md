# SANDSTAR HTTP evidence (2026-11-19)

This folder is an **observed public HTML response** and **not Cloudflare Worker v21 raw source**. The source URL, split blob hashes, character/byte size, version context and limitations appear in `manifest.json`.

The HTML was captured through the `sandstar.aldol.app` route, which can include title-bridge injection and other edge transformations. Treat it as evidence only, never as the currently approved game release source.

To verify: `node tools/verify-http-snapshot.mjs --compare-qa`. To reconstruct only locally: append `--write`.
