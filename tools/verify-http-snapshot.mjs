#!/usr/bin/env node
// Read-only by default. Verifies Git blobs, reconstructs observed HTTP HTML.
// This does NOT establish equivalence to the original Cloudflare Worker script.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const current = JSON.parse(readFileSync(resolve(root, 'recovered/live-http-20261119/manifest.json'), 'utf8'));
const hash = (buf, algorithm) => createHash(algorithm).update(buf).digest('hex');

function checkParts(parts) {
  const buffers = [];
  for (const part of parts) {
    const bytes = readFileSync(resolve(root, part.path));
    const gitObject = Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]);
    if (hash(gitObject, 'sha1') !== part.git_blob_sha) {
      throw new Error('Git blob hash mismatch: ' + part.path);
    }
    if (part.characters !== undefined && bytes.toString('utf8').length !== part.characters) {
      throw new Error('UTF-8 character count mismatch: ' + part.path);
    }
    if (part.bytes !== undefined && bytes.length !== part.bytes) {
      throw new Error('Byte count mismatch: ' + part.path);
    }
    buffers.push(bytes);
  }
  return Buffer.concat(buffers);
}

const observed = checkParts(current.files);
if (observed.length !== current.html_utf8_bytes) throw new Error('Observed HTTP HTML byte length differs from manifest');
const observedText = observed.toString('utf8');
if (observedText.length !== current.html_characters) throw new Error('Observed HTTP HTML character length differs from manifest');
console.log('PASS: archived HTTP snapshot', observed.length, 'bytes, SHA-256', hash(observed, 'sha256'));
console.log('WARNING: HTTP snapshot is not Cloudflare Worker source.');

if (process.argv.includes('--compare-qa')) {
  const archived = JSON.parse(readFileSync(resolve(root, 'docs/source-manifest.json'), 'utf8')).game_archive;
  const qa = checkParts(archived.parts);
  if (qa.length !== archived.bytes || hash(qa, 'sha256') !== archived.sha256) {
    throw new Error('Existing QA archive integrity check failed');
  }
  const qaText = qa.toString('utf8');
  const probes = ['ssTitleArt', 'ssContinue', 'ssNew', 'ssSettings', 'ssM1Act', 'mine-exit', 'm1QuestBadge', 'sandstar-p1-world-v1', 'worldId', 'NPC'];
  console.log(JSON.stringify({
    comparison: 'static text presence only, NOT functional equivalence',
    qaBytes: qa.length,
    observedBytes: observed.length,
    qaSha256: archived.sha256,
    observedSha256: hash(observed, 'sha256'),
    probes: Object.fromEntries(probes.map(s => [s, { qa: qaText.includes(s), observed: observedText.includes(s) }]))
  }, null, 2));
}

if (process.argv.includes('--write')) {
  const output = resolve(root, 'dist', 'observed-sandstar-20261119.html');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, observed);
  console.log('WROTE locally only:', output);
}
