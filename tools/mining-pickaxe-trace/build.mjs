// Build locally from an exact Worker baseline. Only the embedded HTML changes.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

const [from, to, ...extra] = process.argv.slice(2);
if (!from || !to || extra.length || resolve(from) === resolve(to)) {
 throw new Error('Usage: node tools/mining-pickaxe-trace/build.mjs <baseline Worker> <candidate Worker>');
}

function sha256(data) {
 return createHash('sha256').update(data).digest('hex');
}

function replaceOnce(source, anchor, replacement) {
 const first = source.indexOf(anchor);
 if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) {
  throw new Error(`Expected one occurrence of ${anchor}`);
 }
 return source.slice(0, first) + replacement + source.slice(first + anchor.length);
}

const baselines = new Map([
 ['7da5888cd96d8b99b624e06d59a5492b29b3b67b442bc421f5e72ebc6a4ba5c3', 'v41'],
 ['3b36af90b2bb9525b574f4d2c49132d4f943139db1592fd27c31ed1e37d683ff', 'v41 + farm/cooking #13'],
]);
const worker = readFileSync(from, 'utf8');
const baseline = baselines.get(sha256(worker));
if (!baseline) throw new Error('Unrecognized Worker SHA-256');

const marker = 'const HTML=';
const start = worker.indexOf(marker) + marker.length;
const after = worker.indexOf(';\nconst OG_IMAGE_B64=', start);
if (worker[start] !== '"' || after < start || worker[after - 1] !== '"') {
 throw new Error('Expected the v41 HTML constant');
}
let html = JSON.parse(worker.slice(start, after));
const logic = readFileSync(new URL('./trace.js', import.meta.url), 'utf8');
const css = `<style>
.mine-direct-area { position: relative }
#pickaxeTrace {
 position: absolute; z-index: 2; bottom: calc(100% + 6px); left: 50%;
 transform: translateX(-50%); box-sizing: border-box; width: max-content;
 max-width: 135px; padding: 4px 6px; border: 1px solid #99dccb;
 border-radius: 7px; background: #17313bf5; color: #e0fff2;
 font-size: 11px; text-align: center; pointer-events: none;
}
</style>`;

html = replaceOnce(html, '</head>', css + '\n</head>');
html = replaceOnce(html, '<div class="mine-direct-area">',
 '<div class="mine-direct-area"><div id="pickaxeTrace" hidden></div>');
html = replaceOnce(html, 'function mineSpark(', logic + '\nfunction mineSpark(');
html = replaceOnce(html, ' const xpEligible=blockXpEligible(x,y,t);',
 ' const xpEligible=blockXpEligible(x,y,t);\n const traceSource=ssRegion===\'mine\'&&game.tool===\'pickaxe\'&&ORES.has(t)&&\n  stationGeneratedTile(x,y)===undefined&&!Object.prototype.hasOwnProperty.call(game.edits,key(x,y));');
html = replaceOnce(html, ' if(xpEligible&&blockExperience(t)>0',
 ' if(!secondary&&traceSource)pickaxeTrace.onMined(x,y,t);\n if(xpEligible&&blockExperience(t)>0');
html = replaceOnce(html, 'holdProgress+=dmg;', 'holdProgress+=dmg*pickaxeTrace.multiplier(x,y,t);');
html = replaceOnce(html, 'drawMiningPixels();drawFloatTexts();drawVisibilityMask();',
 'drawMiningPixels();drawFloatTexts();pickaxeTrace.render();drawVisibilityMask();');
html = replaceOnce(html, 'function spawnPlayer(){', 'function spawnPlayer(){pickaxeTrace.reset();');
html = replaceOnce(html, 'game.storyM1.region=target;ssRegion=target;',
 'game.storyM1.region=target;ssRegion=target;pickaxeTrace.reset();');
html = replaceOnce(html, "if(section==='pickaxe')content=forgeMarketPanel();",
 "if(section==='pickaxe')content=forgeMarketPanel()+pickaxeTrace.forgeNote();");

for (const [i, script] of [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].entries()) {
 new Script(script[1], { filename: `embedded-${i}.js` });
}
const candidate = worker.slice(0, start) + JSON.stringify(html) + worker.slice(after);
writeFileSync(to, candidate, { flag: 'wx' });
console.log(`${baseline} → ${sha256(candidate)} · ${Buffer.byteLength(candidate)} bytes`);
