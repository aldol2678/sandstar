// Runtime checks for the transplanted trace logic, plus Worker response parity.
// Usage: node --test tools/mining-pickaxe-trace/qa.mjs
// Optionally set SANDSTAR_BASE_WORKER and SANDSTAR_TRACE_WORKER to check a build pair.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('./trace.js', import.meta.url), 'utf8');

function fixture() {
 const key = (x, y) => `${x},${y}`;
 const ore = new Map();
 const protectedTiles = new Set();
 const hud = { hidden: true, textContent: '' };
 const strokes = [];
 const game = { tool: 'pickaxe', worldGenVersion: 2, edits: {}, pickaxeForge: { rank: 0 } };
 const player = { x: 10.5, y: 10.5 };
 let now = 100;
 const world = {
  $: () => hud, game, p: player, ssRegion: 'mine', paused: false, ssM16TransitionLocked: false,
  WW: 512, WH: 192, PLAYER_CENTER_FROM_FEET: .5, T: 27,
  performance: { now: () => now }, key,
  tile: (x, y) => ore.get(key(x, y)), stationGeneratedTile: (x, y) =>
   protectedTiles.has(key(x, y)) ? 'stationrock' : undefined,
  camera: { x: 0, y: 0 }, viewW: 600, viewH: 600,
  visionVisible: () => true,
  ctx: { save() {}, restore() {}, strokeRect(...args) { strokes.push(args); }, fillRect() {} },
 };
 const api = runInNewContext(source + '\npickaxeTrace;', world);
 return {
  api, hud, game, world, strokes,
  put: (x, y, type = 'copper') => ore.set(key(x, y), type),
  protect: (x, y) => protectedTiles.add(key(x, y)),
  advance: ms => { now += ms; },
  mine(x, y, type = 'copper') {
   ore.delete(key(x, y));
   api.onMined(x, y, type);
  },
 };
}

test('follows the closest natural matching ore and honors the existing visibility mask', () => {
 const f = fixture();
 f.put(10, 9);
 f.put(11, 10, 'iron');
 f.put(11, 11);
 f.put(12, 10);
 f.protect(10, 9);
 f.game.edits['11,11'] = 'copper';
 f.mine(10, 10);
 assert.equal(f.api.multiplier(12, 10, 'copper'), 1.05);
 assert.equal(f.api.multiplier(11, 11, 'copper'), 1);
 f.world.visionVisible = () => false;
 f.api.render();
 assert.equal(f.hud.hidden, false);
 assert.match(f.hud.textContent, /결 읽기 1\/3 · → · \+5%/);
 assert.equal(f.strokes.length, 0);
 f.world.visionVisible = () => true;
 f.api.render();
 assert.deepEqual(f.strokes, [[328, 274, 19, 19]]);
});

test('following the marked natural seam caps the chain at 3 and respects forge rank', () => {
 const f = fixture();
 for (let x = 10; x <= 15; x++) f.put(x, 10);
 f.mine(10, 10);
 f.mine(11, 10);
 assert.equal(f.api.multiplier(12, 10, 'copper'), 1.10);
 f.mine(12, 10);
 f.mine(13, 10);
 for (const [rank, multiplier] of [[0, 1.15], [7, 1.18], [15, 1.21], [20, 1.24]]) {
  f.game.pickaxeForge.rank = rank;
  assert.equal(f.api.multiplier(14, 10, 'copper'), multiplier);
 }
 f.api.render();
 assert.match(f.hud.textContent, /3\/3.*\+24%/);
 f.mine(14, 10);
 f.mine(15, 10);
 assert.equal(f.hud.hidden, true);
});

test('expires at eight seconds and never persists in the world save', () => {
 const f = fixture();
 const before = JSON.stringify(f.game);
 f.put(11, 10);
 f.mine(10, 10);
 f.advance(7999);
 assert.equal(f.api.multiplier(11, 10, 'copper'), 1.05);
 f.advance(1);
 assert.equal(f.api.multiplier(11, 10, 'copper'), 1);
 assert.equal(f.hud.hidden, true);
 assert.equal(JSON.stringify(f.game), before);
});

test('leaving the mine, changing tools, or replacing the target ends the trace', () => {
 for (const invalidate of [
  f => { f.world.ssRegion = 'life_forest_01'; },
  f => { f.game.tool = 'hammer'; },
  f => { f.game.tool = 'drill'; },
  f => { f.world.ssM16TransitionLocked = true; },
  f => { f.world.paused = true; },
  f => { f.game.edits['11,10'] = 'copper'; },
  f => { f.api.reset(); },
 ]) {
  const f = fixture();
  f.put(11, 10);
  f.mine(10, 10);
  f.api.render();
  assert.equal(f.hud.hidden, false);
  invalidate(f);
  assert.equal(f.api.multiplier(11, 10, 'copper'), 1);
  assert.equal(f.hud.hidden, true);
 }
});

test('the v1 world generator continues to use its existing mining damage', () => {
 const f = fixture();
 f.game.worldGenVersion = 1;
 f.put(11, 10);
 f.mine(10, 10);
 f.api.render();
 assert.equal(f.api.multiplier(11, 10, 'copper'), 1);
 assert.equal(f.hud.hidden, true);
});

const { SANDSTAR_BASE_WORKER: from, SANDSTAR_TRACE_WORKER: to } = process.env;
if (from || to) {
 test('Worker preserves non-HTML routes and all embedded scripts except the core game', async () => {
  assert.ok(from && to, 'Both Worker paths are required');
  const load = async path => (await import(pathToFileURL(resolve(path)))).default;
  const [baseline, candidate] = await Promise.all([load(from), load(to)]);
  const get = (worker, path) => worker.fetch(new Request('https://sandstar.aldol.app' + path));
  for (const path of ['/healthz', '/manifest.webmanifest', '/sw.js', '/og-image.jpg']) {
   const [a, b] = await Promise.all([get(baseline, path), get(candidate, path)]);
   assert.equal(a.status, 200, path);
   assert.equal(b.status, a.status, path);
   assert.deepEqual([...b.headers], [...a.headers], path);
   assert.deepEqual(Buffer.from(await b.arrayBuffer()), Buffer.from(await a.arrayBuffer()), path);
  }
  const pages = await Promise.all([baseline, candidate].map(async worker => {
   const response = await get(worker, '/');
   assert.equal(response.status, 200);
   return response.text();
  }));
  assert.doesNotMatch(pages[0], /id="pickaxeTrace"/);
  assert.match(pages[1], /id="pickaxeTrace" hidden/);
  assert.match(pages[1], /holdProgress\+=dmg\*pickaxeTrace.multiplier\(x,y,t\)/);
  const scripts = pages.map(html => [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]));
  assert.equal(scripts[1].length, scripts[0].length);
  const touched = scripts[1].filter((script, i) => script !== scripts[0][i]);
  assert.equal(touched.length, 1);
  assert.ok(touched[0].includes('const pickaxeTrace ='));
 });
}
