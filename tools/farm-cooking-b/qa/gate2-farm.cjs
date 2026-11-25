// Gate 2: farm loop — wheat/potato/carrot plant -> water -> grow -> harvest in farm_01,
// 3 distinct stage sprites, inventory, save survives reload. PC 1280x800 and mobile 390x844.
// Usage: node gate2-farm.cjs <url> <outdir>
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, continueWorld, enterFarm, log } = require('./lib.cjs');

const url = process.argv[2] || 'http://127.0.0.1:8739/';
const out = process.argv[3] || '.';
fs.mkdirSync(out, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; log(lines, `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const PLOTS = { wheat: { id: 'plot:34', x: 18, y: 15 }, potato: { id: 'plot:37', x: 24, y: 15 }, carrot: { id: 'plot:40', x: 30, y: 15 } };

async function plotPixels(page, plot) {
  // hash of the plot's on-canvas pixels (sprite layer), computed with the game's own camera formula
  return page.evaluate(({ x, y }) => {
    const cv = document.getElementById('farmWorldCanvas'); const r = cv.getBoundingClientRect();
    const dpr = cv.width / r.width, t = 32, W = r.width, H = r.height;
    const p = window.__sandstarFarmWorld.state().player;
    const camX = Math.max(0, Math.min(Math.max(0, 46 * t - W), p.x * t - W * .5));
    const camY = Math.max(0, Math.min(Math.max(0, 32 * t - H), p.y * t - H * .51));
    const px = (x - 1.6) * t - camX, py = (y - 1.4) * t - camY;
    const d = cv.getContext('2d').getImageData(Math.round(px * dpr), Math.round(py * dpr), Math.round(3.2 * t * dpr), Math.round(2.8 * t * dpr)).data;
    let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
    return { hash: h.toString(16), clip: { x: Math.max(0, r.left + px - 8), y: Math.max(0, r.top + py - 30), width: 3.2 * t + 16, height: 2.8 * t + 38 } };
  }, plot);
}

async function runLoop(page, tag, crop, stageSeconds) {
  const plot = PLOTS[crop];
  const moved = await page.evaluate(({ x, y }) => window.__sandstarFarmWorld.testMove(x, y + 2.2), plot);
  check(`${tag} ${crop}: walk next to ${plot.id}`, moved);
  await page.click(`[data-farm-seed="${crop}"]`);
  const before = await page.evaluate(() => window.__sandstarFarmCooking.state());
  const label0 = (await page.textContent('#farmWorldAction')).trim();
  await page.click('#farmWorldAction'); // plant
  let s = await page.evaluate(() => window.__sandstarFarmCooking.state());
  let pl = s.plots[plot.id];
  check(`${tag} ${crop}: plant (button "${label0}")`, pl.crop === crop && pl.stage === 1 && !pl.watered && s.bag['seed_' + crop] === before.bag['seed_' + crop] - 1, JSON.stringify(pl));
  await page.waitForTimeout(120);
  const px1 = await plotPixels(page, plot);
  await page.screenshot({ path: path.join(out, `${tag}-${crop}-s1.png`), clip: px1.clip });
  // dry soil does not grow
  await page.evaluate(sec => window.__sandstarFarmCooking.advance(sec), stageSeconds * 3);
  s = await page.evaluate(() => window.__sandstarFarmCooking.state());
  check(`${tag} ${crop}: dry plot stays at stage 1 after ${stageSeconds * 3}s`, s.plots[plot.id].stage === 1 && !s.plots[plot.id].watered);
  // engine refuses harvest before stage 3, with a reason
  const early = await page.evaluate(id => { const L = window.__SANDSTAR_LIVING_P11__; const st = L.getState(); return L.applyPure(st, { id: 'qa-early-' + Math.random(), type: 'plot.harvest', target: id }, { x: Number(id.split(':')[1]), y: 76, groundY: 76, inv: {}, coins: 0 }); }, plot.id);
  check(`${tag} ${crop}: early harvest refused`, early.ok === false && /1\/3/.test(early.reason), early.reason);
  for (const next of [2, 3]) {
    const lw = (await page.textContent('#farmWorldAction')).trim();
    await page.click('#farmWorldAction'); // water
    s = await page.evaluate(() => window.__sandstarFarmCooking.state());
    check(`${tag} ${crop}: water at stage ${next - 1} (button "${lw}")`, s.plots[plot.id].watered === true && s.plots[plot.id].stage === next - 1);
    await page.evaluate(sec => window.__sandstarFarmCooking.advance(sec), stageSeconds - 1);
    s = await page.evaluate(() => window.__sandstarFarmCooking.state());
    check(`${tag} ${crop}: still stage ${next - 1} at ${stageSeconds - 1}s`, s.plots[plot.id].stage === next - 1);
    await page.evaluate(() => window.__sandstarFarmCooking.advance(1.01));
    s = await page.evaluate(() => window.__sandstarFarmCooking.state());
    check(`${tag} ${crop}: stage ${next} after ${stageSeconds}s watered, soil dry again`, s.plots[plot.id].stage === next && !s.plots[plot.id].watered);
    await page.waitForTimeout(150);
    const pxN = await plotPixels(page, plot);
    await page.screenshot({ path: path.join(out, `${tag}-${crop}-s${next}.png`), clip: pxN.clip });
    if (next === 2) px1.s2 = pxN.hash; else px1.s3 = pxN.hash;
  }
  check(`${tag} ${crop}: 3 stage renders differ`, new Set([px1.hash, px1.s2, px1.s3]).size === 3, `${px1.hash}/${px1.s2}/${px1.s3}`);
  const lh = (await page.textContent('#farmWorldAction')).trim();
  const mid = await page.evaluate(() => window.__sandstarFarmCooking.state());
  await page.click('#farmWorldAction'); // harvest
  s = await page.evaluate(() => window.__sandstarFarmCooking.state());
  check(`${tag} ${crop}: harvest (button "${lh}") -> +3 ${crop}, +1 seed, plot empty, counted`,
    s.bag[crop] === mid.bag[crop] + 3 && s.bag['seed_' + crop] === mid.bag['seed_' + crop] + 1 && s.plots[plot.id].plantedAt === null && s.plots[plot.id].stage === 0 && s.counts.harvested[crop] === mid.counts.harvested[crop] + 1,
    `bag ${crop} ${mid.bag[crop]}->${s.bag[crop]}, harvested ${s.counts.harvested[crop]}`);
  // v41 HUD: "🧺 밀 3 · 감자 0 · 당근 0"; v44 compact HUD: "🧺 3·0·0" with the names in title/aria-label
  const hud = await page.evaluate(() => { const el = document.getElementById('farmWorldHarvest'); return el.textContent + ' | ' + (el.title || ''); });
  check(`${tag} ${crop}: HUD shows crop count`, hud.includes(`${LIVING_NAME[crop]} ${s.bag[crop]}`), hud);
}
const LIVING_NAME = { wheat: '밀', potato: '감자', carrot: '당근' };

(async () => {
  for (const mobile of [false, true]) {
    const tag = mobile ? 'm390' : 'pc';
    log(lines, `== Gate 2 ${tag} ${new Date().toISOString()} ${url}`);
    const { browser, context, page, problems } = await openGame({ url, mobile });
    await newWorld(page, mobile ? '24680' : '12345');
    const gateLabel = await enterFarm(page);
    check(`${tag}: enter farm_01 from village gate ("${gateLabel.trim()}")`, (await page.evaluate(() => window.__sandstarFarmWorld.state().active)));
    const ready = await page.evaluate(() => window.__sandstarFarmCooking.sprites().filter(id => id.startsWith('crop_')).map(id => [id, window.__sandstarFarmCooking.spriteReady(id)]));
    await page.waitForTimeout(300);
    const ready2 = await page.evaluate(() => window.__sandstarFarmCooking.sprites().filter(id => id.startsWith('crop_')).every(id => window.__sandstarFarmCooking.spriteReady(id)));
    check(`${tag}: 9 P3 crop sprites decoded`, ready.length === 9 && ready2);
    const stageSec = await page.evaluate(() => window.__sandstarFarmCooking.stageSeconds());
    log(lines, 'stageSeconds', stageSec, 'energy', await page.evaluate(() => window.__sandstarFarmCooking.energy()));
    for (const crop of ['wheat', 'potato', 'carrot']) await runLoop(page, tag, crop, stageSec[crop]);
    const energy = await page.evaluate(() => window.__sandstarFarmCooking.state().energy);
    log(lines, `${tag}: energy after 3 cycles (with regen during skipped time)`, energy);
    // leave one plot mid-growth to prove the in-progress state also persists
    await page.evaluate(() => window.__sandstarFarmWorld.testMove(18, 17.2));
    await page.click('[data-farm-seed="wheat"]');
    await page.click('#farmWorldAction'); await page.click('#farmWorldAction'); // plant + water
    await page.evaluate(() => window.__sandstarFarmCooking.advance(30)); // -> stage 2 dry
    await page.click('#farmWorldAction'); // water again (stage 2 watered)
    const beforeReload = await page.evaluate(() => window.__sandstarFarmCooking.state());
    if (mobile) {
      const ov = await page.evaluate(() => {
        const vw = window.innerWidth; const root = document.getElementById('farmWorldRoot');
        const bad = [...root.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && el.offsetParent !== null && (r.right > vw + 0.5 || r.left < -0.5); }).map(el => el.id || el.className);
        const text = root.innerText;
        return { scrollW: document.documentElement.scrollWidth, vw, bad, pcKeys: /WASD|방향키|\bE 작업|\bE\b 이용/.test(text) };
      });
      check(`${tag}: farm HUD no horizontal overflow at 390`, ov.scrollW <= ov.vw && ov.bad.length === 0, JSON.stringify(ov));
      check(`${tag}: no PC key hints visible on mobile farm`, !ov.pcKeys);
    }
    await page.screenshot({ path: path.join(out, `${tag}-farm-overview.png`) });
    // reload -> continue
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await continueWorld(page);
    await page.waitForFunction(() => window.__sandstarFarmWorld.state().active, null, { timeout: 30000 }).catch(() => {});
    const after = await page.evaluate(() => window.__sandstarFarmCooking.state());
    const keep = o => JSON.stringify({ bag: o.bag, counts: o.counts, plots: Object.fromEntries(Object.entries(o.plots).map(([k, v]) => [k, { crop: v.crop, stage: v.stage, watered: v.watered }])) });
    check(`${tag}: reload + continue keeps bag/counts/plots`, keep(after) === keep(beforeReload), keep(after));
    check(`${tag}: continue resumes in farm_01`, await page.evaluate(() => window.__sandstarFarmWorld.state().active));
    check(`${tag}: wheat/potato/carrot all in bag after reload`, after.bag.wheat >= 3 && after.bag.potato >= 3 && after.bag.carrot >= 3, JSON.stringify({ w: after.bag.wheat, p: after.bag.potato, c: after.bag.carrot }));
    await page.screenshot({ path: path.join(out, `${tag}-after-reload.png`) });
    check(`${tag}: no page/console errors, no failed requests`, problems.length === 0, problems.slice(0, 5).join(' | '));
    if (process.argv.includes('--cart')) {
      await require('../../farm-market/check-cart.cjs').checkCart(page);
      check(tag + ': basket sale, rollback, reload and missing crops', true);
    }
    await browser.close();
  }
  log(lines, `== Gate 2 total: ${pass} pass, ${fail} fail`);
  fs.writeFileSync(path.join(out, 'gate2.log'), lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { log(lines, 'ERROR ' + e.stack); fs.writeFileSync(path.join(out, 'gate2.log'), lines.join('\n') + '\n'); process.exit(2); });
