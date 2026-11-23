import fs from 'node:fs';
import crypto from 'node:crypto';
const src = fs.readFileSync(process.argv[2], 'utf8');
const startMarker = 'const HTML="';
const start = src.indexOf(startMarker);
if (start < 0) { console.error('not found'); process.exit(1); }
let i = start + startMarker.length;
let end = -1;
while (i < src.length) {
  const c = src[i];
  if (c === '\\') { i += 2; continue; }
  if (c === '"') { end = i; break; }
  i++;
}
if (end < 0) { console.error('no closing quote'); process.exit(1); }
const raw = src.slice(start + startMarker.length, end);
const html = JSON.parse('"'+raw+'"');
fs.writeFileSync(process.argv[3], html, 'utf8');
console.log('html bytes', Buffer.byteLength(html), 'sha', crypto.createHash('sha256').update(html).digest('hex'));
console.log('script blocks', (html.match(/<script>/g)||[]).length, 'after', JSON.stringify(src.slice(end, end+40)));
