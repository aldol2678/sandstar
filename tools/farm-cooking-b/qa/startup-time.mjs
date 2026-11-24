// Local stand-in for Worker "script startup" cost: time to import (parse + compile + run top level)
// each module in a fresh Node process, plus the first fetch() of "/" (the HTML response).
// This is NOT Cloudflare's measurement (different machine, V8 flags and limit); compare builds relative to each other.
// Usage: node startup-time.mjs <runs> <label=module.mjs>...
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const runs = Number(process.argv[2] || 15);
const child = `
const t0=performance.now();
const m=await import(process.argv[1]);
const t1=performance.now();
const h=m.default||m;
const res=await h.fetch(new Request('https://local.test/'),{},{waitUntil(){},passThroughOnException(){}});
await res.arrayBuffer();
const t2=performance.now();
console.log(JSON.stringify({importMs:t1-t0,firstFetchMs:t2-t1,status:res.status,cpu:process.cpuUsage()}));`;
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const out = {};
const targets = process.argv.slice(3).map(arg => arg.split('='));
const rowsBy = Object.fromEntries(targets.map(([label]) => [label, []]));
// interleave builds run by run so machine noise hits both equally
for (let i = 0; i < runs; i++) for (const [label, file] of targets) rowsBy[label].push(JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', child, pathToFileURL(file).href]).toString().trim().split('\n').pop()));
for (const [label, file] of targets) {
  const rows = rowsBy[label];
  out[label] = { bytes: statSync(file).size, runs, importMsMedian: +med(rows.map(r => r.importMs)).toFixed(1), importMsMin: +Math.min(...rows.map(r => r.importMs)).toFixed(1), importMsMax: +Math.max(...rows.map(r => r.importMs)).toFixed(1), firstFetchMsMedian: +med(rows.map(r => r.firstFetchMs)).toFixed(1), status: rows[0].status };
  console.log(label, JSON.stringify(out[label]));
}
const labels = Object.keys(out);
if (labels.length > 1) { const a = out[labels[0]], b = out[labels[1]]; console.log(`ratio ${labels[1]}/${labels[0]}: import ${(b.importMsMedian / a.importMsMedian).toFixed(3)} · bytes ${(b.bytes / a.bytes).toFixed(3)}`); }
