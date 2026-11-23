#!/usr/bin/env node
// Read-only inventory of a proposed SANDSTAR production-source candidate.
// A matching hash is evidence of file identity, not proof of Cloudflare deployment identity.
import { createHash } from 'node:crypto';
import { createReadStream, lstatSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const expectation = args.filter((a) => a.startsWith('--expect-sha256='));
const paths = args.filter((a) => !a.startsWith('--'));

if (help) {
  console.log('Usage: node tools/inventory-source-candidate.mjs [--expect-sha256=<64 hex>] <file> [file...]');
  console.log('Reads files and prints JSON evidence. Never writes, deploys, or declares production equivalence.');
  process.exit(0);
}
if (expectation.length > 1 || (expectation.length && paths.length !== 1) || paths.length === 0 || args.some((a) => a.startsWith('--') && !a.startsWith('--expect-sha256='))) {
  console.error('Provide one or more file paths; --expect-sha256 requires exactly one path.');
  process.exit(2);
}
const expected = expectation.length ? expectation[0].split('=')[1].toLowerCase() : null;
if (expected !== null && !/^[a-f0-9]{64}$/.test(expected)) {
  console.error('Expected SHA-256 must be exactly 64 hex characters.');
  process.exit(2);
}

async function fingerprint(input) {
  const full = resolve(input);
  const info = lstatSync(full);
  if (!info.isFile()) throw new Error(`${basename(input)}: regular files only (symlinks and directories rejected)`);
  const hasher = createHash('sha256');
  let countedBytes = 0;
  for await (const part of createReadStream(full)) {
    hasher.update(part);
    countedBytes += part.length;
  }
  if (countedBytes !== info.size) throw new Error(`${basename(input)}: byte count changed while reading`);
  return { name: basename(input), bytes: countedBytes, sha256: hasher.digest('hex') };
}

try {
  const files = [];
  for (const p of paths) files.push(await fingerprint(p));
  const hash_matches_expected = expected === null ? null : files[0].sha256 === expected;
  console.log(JSON.stringify({
    classification: 'candidate-bytes-only',
    disclaimer: 'No claim of Cloudflare deployed script equivalence, version identity, or runtime QA.',
    files,
    expected_sha256: expected,
    hash_matches_expected
  }, null, 2));
  if (hash_matches_expected === false) process.exitCode = 1;
} catch (err) {
  console.error(`Inventory failed: ${err.message}`);
  process.exitCode = 2;
}
