// Local preview server for a SANDSTAR Worker module (no Cloudflare, no deploy).
// Usage: node tools/farm-cooking-b/serve.mjs <worker-module.mjs> [port] [--static <dir>] [--assets <dir>]
// Requests are passed to the module's default fetch handler, exactly as the Worker would.
// --static <dir>: files under /fcb-static/* are served from <dir> (lazy-loaded scene assets).
// --assets <dir>: emulates Cloudflare Workers Static Assets — a request whose path is a file under <dir>
//   is served from <dir> (with the matching rules in <dir>/_headers) before the Worker runs.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const modPath = path.resolve(args[0]);
const port = Number(args[1] || 8787);
const si = args.indexOf('--static');
const staticDir = si >= 0 ? path.resolve(args[si + 1]) : null;
const ai = args.indexOf('--assets');
const assetsDir = ai >= 0 ? path.resolve(args[ai + 1]) : null;
// minimal _headers support: "/prefix/*" or exact path blocks followed by indented "Name: value" lines
const headerRules = [];
if (assetsDir && fs.existsSync(path.join(assetsDir, '_headers'))) {
  let cur = null;
  for (const line of fs.readFileSync(path.join(assetsDir, '_headers'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: {} }; headerRules.push(cur); }
    else if (cur) { const i = line.indexOf(':'); cur.headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
  }
}
const ruleMatch = (pat, p) => pat.endsWith('*') ? p.startsWith(pat.slice(0, -1)) : p === pat;
const worker = (await import(pathToFileURL(modPath).href)).default;
const types = { '.glb': 'model/gltf-binary', '.png': 'image/png', '.js': 'text/javascript', '.webp': 'image/webp', '.json': 'application/json' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:' + port);
    if (staticDir && url.pathname.startsWith('/fcb-static/')) {
      const rel = path.normalize(decodeURIComponent(url.pathname.slice('/fcb-static/'.length)));
      const file = path.join(staticDir, rel);
      if (!file.startsWith(staticDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not Found'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res); return;
    }
    if (assetsDir && url.pathname !== '/' && !url.pathname.split('/').some(seg => seg.startsWith('_') || seg === '..')) {
      const file = path.join(assetsDir, path.normalize(decodeURIComponent(url.pathname)));
      if (file.startsWith(assetsDir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const hdr = { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'content-length': fs.statSync(file).size };
        for (const r of headerRules) if (ruleMatch(r.pattern, url.pathname)) Object.assign(hdr, r.headers);
        res.writeHead(200, hdr);
        if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
        return;
      }
    }
    const r = await worker.fetch(new Request(url, { method: req.method }));
    const headers = Object.fromEntries(r.headers);
    res.writeHead(r.status, headers);
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(port, '127.0.0.1', () => console.log(`serving ${modPath} on http://127.0.0.1:${port}/`));
