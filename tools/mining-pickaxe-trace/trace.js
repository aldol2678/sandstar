// P1.6-D1 prospecting state is transient and never enters the world save.
const pickaxeTrace = (() => {
 const duration = 8000;
 const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
 const hud = $('pickaxeTrace');
 let trace = null;

 function reset() {
  trace = null;
  hud.hidden = true;
 }

 function enabled() {
  return game && p && ssRegion === 'mine' && game.tool === 'pickaxe' &&
   game.worldGenVersion >= 2 && !paused && !ssM16TransitionLocked;
 }

 function current(now = performance.now()) {
  if (trace && (!enabled() || now >= trace.expires ||
      tile(trace.x, trace.y) !== trace.ore ||
      Object.prototype.hasOwnProperty.call(game.edits, key(trace.x, trace.y)))) reset();
  return trace;
 }

 function nextOre(x, y, ore) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (let ty = Math.max(0, y - 2); ty <= Math.min(WH - 6, y + 2); ty++) {
   for (let tx = Math.max(0, x - 2); tx <= Math.min(WW - 1, x + 2); tx++) {
    const distance = (tx - x) ** 2 + (ty - y) ** 2;
    if (!distance || distance > 2.25 ** 2 || distance >= nearestDistance ||
        stationGeneratedTile(tx, ty) !== undefined ||
        Object.prototype.hasOwnProperty.call(game.edits, key(tx, ty)) ||
        tile(tx, ty) !== ore) continue;
    nearest = { x: tx, y: ty };
    nearestDistance = distance;
   }
  }
  return nearest;
 }

 function onMined(x, y, ore) {
  if (!enabled()) return;
  const now = performance.now();
  // The followed ore has already been removed by the normal mining path.
  const followed = trace && now < trace.expires && trace.x === x && trace.y === y && trace.ore === ore;
  const next = nextOre(x, y, ore);
  if (!next) {
   reset();
   return;
  }
  trace = { ...next, ore, expires: now + duration, chain: followed ? Math.min(3, trace.chain + 1) : 1 };
 }

 function ratePercent() {
  const rank = game.pickaxeForge?.rank || 0;
  return 5 + Number(rank >= 7) + Number(rank >= 15) + Number(rank >= 20);
 }

 function multiplier(x, y, ore) {
  if (!trace || trace.x !== x || trace.y !== y || trace.ore !== ore || !current()) return 1;
  return 1 + ratePercent() * trace.chain / 100;
 }

 function render() {
  const hint = current();
  if (!hint) return;
  const dx = hint.x + .5 - p.x;
  const dy = hint.y + .5 - (p.y - PLAYER_CENTER_FROM_FEET);
  const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  const message = `결 읽기 ${hint.chain}/3 · ${arrows[sector]} · +${ratePercent() * hint.chain}%`;
  if (hud.textContent !== message) hud.textContent = message;
  hud.hidden = false;
  if (!visionVisible(hint.x, hint.y)) return;
  const sx = Math.round(hint.x * T - camera.x);
  const sy = Math.round(hint.y * T - camera.y);
  if (sx < -T || sy < -T || sx > viewW || sy > viewH) return;
  ctx.save();
  ctx.globalAlpha = .67 + .22 * Math.sin(performance.now() / 300);
  ctx.strokeStyle = '#9df8de';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 4, sy + 4, T - 8, T - 8);
  ctx.fillStyle = '#e1fff2';
  ctx.fillRect(sx + T / 2 - 2, sy + T / 2 - 2, 4, 4);
  ctx.restore();
 }

 function forgeNote() {
  return `<p class="venue-caption"><strong>결 읽기</strong> · 자연 광석을 캐면 주변의 같은 광석을 8초 동안 추적해요.
   표시된 광석을 이어 캐면 단계당 채굴 효율 +${ratePercent()}%, 최대 3단계까지 쌓여요.
   곡괭이 +7·+15·+20에서 단계당 효율이 올라가요.</p>`;
 }

 return { reset, onMined, multiplier, render, forgeNote };
})();
