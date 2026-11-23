// Gate 4: kitchen scene hybrid — 2.5D stills always, lazy 3D GLB highlight on desktop,
// 2.5D fallback on GLB failure (blocked / corrupted) and on mobile, cooking never blocked,
// renderer disposed when leaving the kitchen, no overflow at 390.
// Usage: node gate4-scene.cjs <url> <outdir>
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, continueWorld, log } = require('./lib.cjs');

const url = process.argv[2] || 'http://127.0.0.1:8739/';
const out = process.argv[3] || '.';
fs.mkdirSync(out, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; log(lines, `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const SAVE_KEY = 'sandstar-p1-world-v1:official-m25d';
const KT = () => window.__sandstarFarmCooking;

// New world -> save fixture with ingredients -> reopen (the game saves on unload, so edit offline).
async function openWithIngredients({ mobile, seed, route }) {
  let s = await openGame({ url, mobile });
  await newWorld(s.page, seed);
  const state = await s.context.storageState();
  await s.browser.close();
  for (const o of state.origins) for (const it of o.localStorage) if (it.name === SAVE_KEY) {
    const g = JSON.parse(it.value); Object.assign(g.livingP0.bag, { wheat: 4, carrot: 2, potato: 1, river_fish: 1 }); it.value = JSON.stringify(g);
  }
  s = await openGame({ url, mobile, storageState: state, serviceWorkers: route ? 'block' : undefined });
  s.glb = [];
  s.page.on('request', r => { if (r.url().includes('/fcb/glb/')) s.glb.push(r.url().split('/').pop()); });
  s.glbResp = [];
  s.page.on('response', r => { if (r.url().includes('/fcb/glb/')) { s.glbResp.push([r.url().split('/').pop(), r.status()]); s.glbHdr = r.headers(); } });
  if (route) await s.page.route('**/fcb/glb/**', route);
  await continueWorld(s.page);
  await s.page.waitForFunction(() => window.__sandstarTown25D.state().active, null, { timeout: 30000 });
  return s;
}
async function openKitchen(page) {
  await page.evaluate(() => window.__sandstarTown25D.move(-3.4, -4.8));
  await page.waitForTimeout(150);
  await page.click('#town25dAction');
  await page.waitForSelector('.fcb-stage', { timeout: 5000 });
  await page.waitForFunction(() => ['3d', '2.5d'].includes(window.__sandstarFarmCooking.scene().mode), null, { timeout: 25000 });
}
const scene = page => page.evaluate(() => { const s = window.__sandstarFarmCooking.scene(); delete s.manifest; return s; });
const stills = page => page.evaluate(() => {
  const st = document.querySelector('.fcb-stage'); const hero = st.querySelector('.fcb-hero-still');
  const shelf = [...st.querySelectorAll('.fcb-shelf-item img')].map(i => i.complete && i.naturalWidth > 0);
  return { heroVisible: !hero.hidden && hero.offsetParent !== null, heroLoaded: hero.complete && hero.naturalWidth > 0, shelf, tag: st.querySelector('.fcb-hero-tag').textContent, note: st.querySelector('.fcb-mode-note').textContent };
});
const stageClip = page => page.evaluate(() => { const r = document.querySelector('.fcb-stage').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });

(async () => {
  // ---------------- PC: lazy 3D
  log(lines, `== Gate 4 pc ${new Date().toISOString()} ${url}`);
  let s = await openWithIngredients({ mobile: false, seed: '11223' });
  let { page } = s;
  const manifest = await page.evaluate(() => window.__sandstarFarmCooking.scene().manifest);
  log(lines, 'manifest', manifest);
  check('pc: no GLB request before the kitchen opens (lazy)', s.glb.length === 0, s.glb.join(','));
  await openKitchen(page);
  let st = await stills(page);
  check('pc: 2.5D stills shown in the scene (hero + 4 shelf items)', st.heroLoaded && st.shelf.length === 4 && st.shelf.every(Boolean), JSON.stringify(st));
  let sc = await scene(page);
  check('pc: 3D highlight active', sc.mode === '3d' && sc.has3d && sc.models.join() === 'wheat,potato,carrot', JSON.stringify(sc));
  const totalBytes = Object.values(manifest).reduce((n, m) => n + m.bytes, 0);
  check('pc: exactly the 3 ingredient GLBs fetched, all 200', s.glb.length === 3 && s.glbResp.every(([, c]) => c === 200), JSON.stringify(s.glbResp) + ` total ${totalBytes}B`);
  // GLBs come from outside the Worker module (static assets) with the immutable model headers
  const h = s.glbHdr || {};
  check('pc: GLB response is model/gltf-binary with an immutable cache header', /model\/gltf-binary/.test(h['content-type'] || '') && /immutable/.test(h['cache-control'] || ''), JSON.stringify({ type: h['content-type'], cache: h['cache-control'] }));
  const inModule = process.env.FCB_MODULE ? require('fs').readFileSync(process.env.FCB_MODULE, 'utf8').includes('FCB_GLB=') : null;
  if (inModule !== null) check('module carries no GLB bytes (GLBs served as static assets)', inModule === false, process.env.FCB_MODULE);
  const p1 = await page.evaluate(() => window.__sandstarFarmCooking.sceneProbe());
  await page.waitForTimeout(600);
  const p2 = await page.evaluate(() => window.__sandstarFarmCooking.sceneProbe());
  check('pc: 3D model rendered (opaque pixels, context alive)', p1.opaque > 100 && !p1.contextLost, JSON.stringify(p1));
  check('pc: 3D model rotates over time', p2.yaw > p1.yaw && p2.hash !== p1.hash, `${p1.yaw.toFixed(2)}->${p2.yaw.toFixed(2)}`);
  await page.screenshot({ path: path.join(out, 'pc-scene-wheat-3d.png'), clip: await stageClip(page) });
  const hashes = { wheat: p2.hash };
  for (const id of ['potato', 'carrot']) {
    await page.click(`[data-fcb-focus="${id}"]`);
    await page.waitForTimeout(500);
    const p = await page.evaluate(() => window.__sandstarFarmCooking.sceneProbe());
    hashes[id] = p.hash;
    st = await stills(page);
    check(`pc: shelf → ${id} shown in 3D`, p.focus === id && p.opaque > 100 && st.tag.endsWith('3D') && !st.heroVisible, `${st.tag} opaque ${p.opaque}`);
    await page.screenshot({ path: path.join(out, `pc-scene-${id}-3d.png`), clip: await stageClip(page) });
  }
  check('pc: wheat/potato/carrot renders differ', new Set(Object.values(hashes)).size === 3, JSON.stringify(hashes));
  await page.click('[data-fcb-focus="fish"]');
  await page.waitForTimeout(200);
  st = await stills(page);
  const canvasHidden = await page.evaluate(() => document.querySelector('.fcb-hero-3d').hidden);
  check('pc: fish uses the P5 2D sprite (no fish GLB)', st.tag === '물고기 · 2D' && st.heroVisible && canvasHidden, st.tag);
  await page.screenshot({ path: path.join(out, 'pc-scene-fish-2d.png'), clip: await stageClip(page) });
  // cooking with the scene open: scene stays 3D, focus follows the recipe, no refetch
  await page.click('[data-fcb-cook="bread"]');
  await page.waitForTimeout(300);
  sc = await scene(page);
  let bag = await page.evaluate(() => window.__sandstarFarmCooking.state().bag);
  check('pc: cook bread with scene open -> bread +1, scene still 3D, focus wheat, no refetch', bag.bread === 1 && sc.mode === '3d' && sc.focus === 'wheat' && s.glb.length === 3 && sc.teardowns === 0, JSON.stringify({ bread: bag.bread, mode: sc.mode, focus: sc.focus, glb: s.glb.length }));
  await page.click('[data-fcb-cook="stew"]');
  await page.waitForTimeout(300);
  sc = await scene(page);
  bag = await page.evaluate(() => window.__sandstarFarmCooking.state().bag);
  check('pc: cook stew (fish sprite + potato) -> stew +1, focus potato in 3D', bag.stew === 1 && sc.mode === '3d' && sc.focus === 'potato');
  // leave the kitchen -> renderer disposed
  await page.click('#backBtn');
  await page.waitForTimeout(300);
  sc = await scene(page);
  const canvases = await page.evaluate(() => document.querySelectorAll('.fcb-hero-3d').length);
  check('pc: closing the kitchen disposes the 3D renderer', sc.mode === 'off' && !sc.has3d && canvases === 0 && sc.teardowns === 1 && sc.lastTeardown === 'closed', JSON.stringify({ mode: sc.mode, canvases, teardowns: sc.teardowns, last: sc.lastTeardown }));
  const framesAfterClose = sc.frames; await page.waitForTimeout(500);
  check('pc: no frames rendered after close', (await scene(page)).frames === framesAfterClose);
  await openKitchen(page);
  sc = await scene(page);
  check('pc: reopening the kitchen brings 3D back', sc.mode === '3d' && sc.has3d);
  await page.click('#backBtn');
  check('pc: no page/console errors, no failed requests', s.problems.length === 0, s.problems.slice(0, 5).join(' | '));
  await s.browser.close();

  // ---------------- PC: GLB blocked -> 2.5D fallback, cooking works
  for (const [label, route] of [
    ['blocked', r => r.abort()],
    ['corrupted', r => r.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.alloc(423652, 7) })],
  ]) {
    log(lines, `== Gate 4 pc fallback: GLB ${label}`);
    s = await openWithIngredients({ mobile: false, seed: '33445', route });
    page = s.page;
    await openKitchen(page);
    sc = await scene(page);
    st = await stills(page);
    check(`pc ${label}: the injected failure reached the GLB fetch`, s.glb.length >= 1, s.glb.join(','));
    check(`pc ${label}: falls back to 2.5D with a reason`, sc.mode === '2.5d' && /^glb-failed/.test(sc.reason) && !sc.has3d, sc.reason);
    check(`pc ${label}: 2.5D stills visible`, st.heroVisible && st.heroLoaded && st.shelf.every(Boolean) && st.tag === '밀 · 2.5D', st.tag);
    await page.click('[data-fcb-cook="bread"]');
    await page.waitForTimeout(300);
    bag = await page.evaluate(() => window.__sandstarFarmCooking.state().bag);
    check(`pc ${label}: cooking still works without 3D`, bag.bread === 1);
    if (label === 'blocked') await page.screenshot({ path: path.join(out, 'pc-scene-fallback-2.5d.png'), clip: await stageClip(page) });
    const unexpected = s.problems.filter(p => !/fcb\/glb|ERR_FAILED|Failed to load resource/.test(p));
    check(`pc ${label}: no errors other than the injected GLB failure`, unexpected.length === 0, unexpected.slice(0, 3).join(' | '));
    await s.browser.close();
  }

  // ---------------- mobile 390: 2.5D only
  log(lines, `== Gate 4 m390`);
  s = await openWithIngredients({ mobile: true, seed: '55667' });
  page = s.page;
  await openKitchen(page);
  await page.waitForTimeout(500);
  sc = await scene(page);
  st = await stills(page);
  check('m390: mobile stays on 2.5D (no GLB download)', sc.mode === '2.5d' && sc.reason === 'mobile' && s.glb.length === 0, JSON.stringify({ mode: sc.mode, reason: sc.reason, glb: s.glb.length }));
  check('m390: 2.5D stills shown', st.heroVisible && st.heroLoaded && st.shelf.every(Boolean), st.tag);
  await page.click('[data-fcb-focus="carrot"]');
  st = await stills(page);
  check('m390: shelf switches the 2.5D hero', st.tag === '당근 · 2.5D', st.tag);
  const ov = await page.evaluate(() => {
    const vw = innerWidth, d = document.getElementById('dialog');
    const bad = [...d.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5); }).map(el => el.className || el.tagName);
    const wrapped = [...d.querySelectorAll('.fcb-shelf-item span')].filter(sp => sp.getBoundingClientRect().height > 20).map(sp => sp.textContent);
    return { scrollW: document.documentElement.scrollWidth, dialogOverflow: d.scrollWidth - d.clientWidth, vw, bad, wrapped, pcKeys: /WASD|방향키/.test(d.innerText) };
  });
  check('m390: kitchen scene has no horizontal overflow', ov.scrollW <= ov.vw && ov.dialogOverflow <= 0 && ov.bad.length === 0, JSON.stringify(ov));
  check('m390: shelf labels stay on one line', ov.wrapped.length === 0, ov.wrapped.join(','));
  check('m390: no PC key hints', !ov.pcKeys);
  await page.screenshot({ path: path.join(out, 'm390-kitchen-scene.png') });
  await page.click('[data-fcb-cook="soup"]');
  await page.waitForTimeout(300);
  bag = await page.evaluate(() => window.__sandstarFarmCooking.state().bag);
  check('m390: cooking works on mobile', bag.soup === 1);
  check('m390: no page/console errors, no failed requests', s.problems.length === 0, s.problems.slice(0, 5).join(' | '));
  await s.browser.close();

  log(lines, `== Gate 4 total: ${pass} pass, ${fail} fail`);
  fs.writeFileSync(path.join(out, 'gate4.log'), lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { log(lines, 'ERROR ' + e.stack); fs.writeFileSync(path.join(out, 'gate4.log'), lines.join('\n') + '\n'); process.exit(2); });
