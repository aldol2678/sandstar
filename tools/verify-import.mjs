#!/usr/bin/env node
// Verify and optionally reconstruct archived QA source. No network/deployment operations.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/source-manifest.json'), 'utf8'));
const hash = (bytes, alg) => createHash(alg).update(bytes).digest('hex');
const parts = [];
for (const part of manifest.game_archive.parts) {
  const bytes = readFileSync(resolve(root, part.path));
  const gitHeader = Buffer.from("blob " + bytes.length + "\0");
  const gitSha = hash(Buffer.concat([gitHeader, bytes]), 'sha1');
  if (bytes.length !== part.bytes || gitSha !== part.git_blob_sha) {
    throw new Error("Invalid recovered chunk: " + part.path);
  }
  parts.push(bytes);
}
const recovered = Buffer.concat(parts);
const target = manifest.game_archive;
if (recovered.length !== target.bytes || hash(recovered, 'sha256') !== target.sha256) {
  throw new Error('Reassembled game HTML does not match source SHA-256');
}
const bridge = readFileSync(resolve(root, manifest.title_bridge.path));
if (bridge.length !== manifest.title_bridge.bytes || hash(bridge, 'sha256') !== manifest.title_bridge.sha256) {
  throw new Error('Title bridge source does not match recorded SHA-256');
}
if (process.argv.includes('--write')) {
  const out = resolve(root, 'dist', 'recovered-m25d-ui1-region-bgm-qa.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, recovered);
  console.log("Recovered QA HTML: " + out);
}
console.log("PASS: QA archive " + recovered.length + " bytes / " + target.sha256);
console.log("PASS: title bridge " + bridge.length + " bytes / " + manifest.title_bridge.sha256);
console.log('Note: Cloudflare Worker v20 byte-for-byte equivalence remains unverified.');
