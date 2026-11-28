#!/usr/bin/env node
// Verify byte-identical P1.6-F local QA candidate; no writes unless --write.
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'recovered/mining-p16f-20261118/manifest.json'), 'utf8'));
function digest(algorithm, bytes) { return createHash(algorithm).update(bytes).digest('hex'); }
const chunks = [];
for (const part of manifest.parts) {
  const bytes = readFileSync(join(root, part.path));
  const gitBlob = digest('sha1', Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]));
  if (bytes.length !== part.bytes || gitBlob !== part.git_blob_sha1) {
    throw new Error('MISMATCH ' + part.path + ': ' + bytes.length + ' bytes, git blob ' + gitBlob);
  }
  chunks.push(bytes);
}
const source = Buffer.concat(chunks);
const hash = digest('sha256', source);
if (source.length !== manifest.size_bytes || hash !== manifest.sha256) {
  throw new Error('Source mismatch: ' + source.length + ' bytes SHA-256=' + hash);
}
console.log('PASS: verified ' + chunks.length + ' parts, ' + source.length + ' bytes, SHA-256=' + hash);
if (process.argv.includes('--write')) {
  const dist = join(root, 'dist');
  mkdirSync(dist, { recursive: true });
  const output = join(dist, manifest.filename);
  writeFileSync(output, source);
  console.log('WROTE ' + output + ' (isolated QA candidate; not a production deployment)');
}
