// The cart sits on the shoulder of the path, between the west gate and the plots.
const farmCart = Object.freeze({x: 11, y: 14});
const farmBasketCrops = ['wheat', 'potato', 'carrot'];
const farmBasketPrice = farmBasketCrops.reduce((sum, crop) => sum + LIVING_CROPS[crop].price, 0);

function farmAtCart() {
  return Math.hypot(farmPlayer.x - farmCart.x, farmPlayer.y - farmCart.y) <= 2.75;
}

function farmCartLabel() {
  const bag = game.livingP0.bag;
  const missing = farmBasketCrops.filter(crop => bag[crop] < 1);
  if (missing.length) return '납품에 필요한 작물 · ' + missing.map(crop => LIVING_CROPS[crop].name).join('·');
  return '세 작물 1개씩 납품 · +' + farmBasketPrice + 'C';
}

function farmDrawCart(c) {
  const x = farmCart.x * FARM_TILE, y = farmCart.y * FARM_TILE;
  c.save();
  c.translate(x, y);
  const box = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  box(-37, 5, 80, 12, '#334c414a');
  for (const dx of [-24, 23]) {
    box(dx - 6, 4, 13, 12, '#493e36');
    box(dx - 3, 7, 7, 6, '#bd8d55');
    box(dx - 3, -40, 4, 46, '#704735');
  }
  box(-36, -12, 72, 19, '#825233');
  box(-34, -9, 68, 4, '#dbab72');
  box(-33, 0, 66, 3, '#a86f47');
  ['#e8c05e', '#bd935f', '#ec874f'].forEach((color, index) => {
    const left = -29 + index * 21;
    box(left, -17, 18, 9, '#674835');
    for (const offset of [2, 8, 12]) {
      box(left + offset, -21 + offset % 3, 5, 6, color);
      box(left + offset + 1, -23 + offset % 3, 2, 3, '#658052');
    }
  });
  for (let i = 0; i < 8; i++) {
    const left = -40 + i * 10;
    box(left + 3, -48, 10, 8, i % 2 ? '#f5ddb1' : '#689c89');
    box(left, -40, 10, 9, i % 2 ? '#fff0c9' : '#78b39c');
    box(left + 1, -31, 8, 4, i % 2 ? '#ddbb8f' : '#487e70');
  }
  c.font = 'bold 12px system-ui';
  c.textAlign = 'center';
  box(-39, -72, 78, 19, '#2d473d');
  c.fillStyle = '#fff0cc';
  c.fillText('장터 수레', 0, -58);
  c.restore();
}

function farmDrawBed(c, x, y, w, h, plot) {
  const wet = plot?.watered;
  c.fillStyle = '#46563a'; c.fillRect(x - 5, y - 3, w + 10, h + 12);
  c.fillStyle = '#725039'; c.fillRect(x - 4, y - 6, w + 8, h + 12);
  c.fillStyle = '#d6ac77'; c.fillRect(x - 4, y - 6, w + 8, 4);
  c.fillStyle = wet ? '#51382f' : '#815338'; c.fillRect(x, y, w, h);
  for (let row = 0; row < 3; row++) {
    const top = y + 4 + row * (h - 6) / 3;
    c.fillStyle = wet ? '#694a3a' : '#a87650'; c.fillRect(x + 3, top, w - 6, 21);
    c.fillStyle = wet ? '#88684e' : '#bf9369'; c.fillRect(x + 4, top, w - 8, 3);
    for (let col = 0; col < 5; col++) {
      const dx = x + 8 + col * 18 + (row % 2) * 3;
      c.fillStyle = wet ? '#95b2a6' : '#916344'; c.fillRect(dx, top + 13, 5, 2);
    }
  }
  for (const dx of [x - 4, x + w - 2]) {
    c.fillStyle = '#edc694'; c.fillRect(dx, y - 6, 6, 6); c.fillRect(dx, y + h, 6, 6);
  }
}

// Each segment is one growth stage. Only watered soil advances towards the next one.
function farmDrawProgress(c, x, y, w, plot) {
  if (!plot || plot.plantedAt === null) return;
  const fraction = plot.watered ? Math.max(0, Math.min(1,
    (game.livingP0.clock - plot.wateredAt) / livingStageSeconds(plot.crop))) : 0;
  const segment = (w - 8) / 3;
  for (let i = 0; i < 3; i++) {
    const dx = x + i * (segment + 4);
    c.fillStyle = '#4e4936'; c.fillRect(dx, y, segment, 5);
    const filled = i < plot.stage ? 1 : i === plot.stage ? fraction : 0;
    c.fillStyle = plot.stage >= 3 ? '#ffd56f' : i === plot.stage ? '#94ced0' : '#bada84';
    c.fillRect(dx, y, segment * filled, 5);
  }
}

function farmDrawGround(c, x, y, path) {
  const t = FARM_TILE, px = x * t, py = y * t;
  const seed = farmRand(x, y);
  if (path(x, y)) {
    c.fillStyle = seed > .5 ? '#ccb58a' : '#ceb88d';
    c.fillRect(px, py, t, t);
    for (const side of [-1, 1]) {
      if (path(x, y + side)) continue;
      const edge = py + (side > 0 ? t - 3 : 0);
      c.fillStyle = '#a89870'; c.fillRect(px, edge, t, 3);
      c.fillStyle = '#bfc187'; c.fillRect(px + Math.floor(seed * 19), edge, 9, 3);
    }
    const offset = Math.floor(seed * 18);
    c.fillStyle = '#b49c78'; c.fillRect(px + offset + 6, py + 12, 5, 2);
    c.fillStyle = '#e5d1a5'; c.fillRect(px + offset + 5, py + 11, 4, 2);
    return;
  }
  c.fillStyle = seed > .65 ? '#84b886' : '#8dbd8b'; c.fillRect(px, py, t, t);
  const tuft = Math.floor(seed * 16);
  c.fillStyle = '#689c71'; c.fillRect(px + tuft + 4, py + 11, 2, 4);
  c.fillRect(px + tuft + 7, py + 9, 2, 6);
  if (seed < .18) {
    for (const [dx, dy] of [[7, 10], [19, 17], [10, 24]]) {
      c.fillStyle = '#547d59'; c.fillRect(px + dx, py + dy, 2, 5);
      c.fillStyle = seed < .09 ? '#f5d494' : '#f7e9cf';
      c.fillRect(px + dx - 2, py + dy - 1, 6, 3);
    }
  }
}

function farmDrawOrchardTree(c, x, y) {
  const px = x * FARM_TILE, py = y * FARM_TILE;
  c.save(); c.translate(px, py);
  const box = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  box(-13, 23, 64, 9, '#44644855');
  box(10, -14, 15, 44, '#654937'); box(13, -8, 4, 32, '#a07952');
  box(3, 25, 12, 5, '#76553e'); box(22, 26, 11, 4, '#76553e');
  const canopy = (x, y, w, h, color) => {
    box(x + 8, y, w - 16, h, color);
    box(x, y + 7, w, h - 14, color);
  };
  canopy(-24, -44, 80, 49, '#3e6550');
  canopy(-19, -56, 54, 47, '#50835d');
  canopy(13, -49, 41, 37, '#629466');
  canopy(-11, -62, 40, 27, '#76a773');
  for (const [dx, dy] of [[-12,-32],[8,-43],[31,-28],[19,-14]]) {
    box(dx, dy, 7, 6, '#bf7256'); box(dx + 1, dy, 3, 2, '#ffd29b');
    box(dx + 4, dy - 3, 3, 3, '#365c46');
  }
  c.restore();
}

function farmDrawBuilding(c, x, y, tilesWide, tilesHigh, label, color) {
  const w = tilesWide * FARM_TILE, h = tilesHigh * FARM_TILE;
  c.save(); c.translate(x * FARM_TILE, y * FARM_TILE);
  const box = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  box(10, h - 1, w + 6, 14, '#425d4566');
  box(0, 33, w, h - 33, '#d6b489');
  for (let plank = 49; plank < h - 12; plank += 15) {
    box(3, plank, w - 6, 2, '#b99470');
    box(3, plank + 2, w - 6, 1, '#e2c398');
  }
  box(0, h - 12, w, 12, '#83796a');
  for (const dx of [0, w - 8]) box(dx, 32, 8, h - 44, '#896346');
  box(w - 46, -23, 15, 49, '#936b59'); box(w - 49, -27, 21, 6, '#b8886a');
  for (let row = 0; row < 5; row++) {
    const inset = (4 - row) * 8, left = inset - 12, width = w - inset * 2 + 24;
    const top = row * 11 - 13;
    box(left, top, width, 13, color);
    box(left, top + 9, width, 3, '#704f43');
    for (let col = 10 + (row % 2) * 10; col < width - 3; col += 23) box(left + col, top + 1, 2, 7, '#805a4b');
  }
  box(-14, 41, w + 28, 8, '#6f5040'); box(-12, 40, w + 24, 3, '#d39970');
  for (const wx of [27, w - 55]) {
    box(wx - 5, 73, 36, 34, '#886646'); box(wx, 76, 26, 26, '#638986');
    box(wx + 12, 76, 3, 26, '#ecd0a1'); box(wx, 87, 26, 3, '#ecd0a1');
    box(wx - 6, 104, 38, 6, '#916243');
    for (let i = 0; i < 4; i++) {
      box(wx + i * 7, 99, 5, 5, '#537b55'); box(wx + i * 7, 97, 4, 3, '#efc687');
    }
  }
  box(w / 2 - 18, h - 57, 36, 54, '#79563e'); box(w / 2 - 13, h - 52, 26, 44, '#a17a56');
  box(w / 2 + 5, h - 27, 4, 4, '#ecd09c'); box(w / 2 - 23, h - 5, 46, 6, '#c1b59a');
  c.font = 'bold 13px system-ui'; c.textAlign = 'center';
  c.fillStyle = '#294c40'; c.fillRect(w / 2 - 43, -40, 86, 19);
  c.fillStyle = '#fff1cf'; c.fillText(label, w / 2, -26);
  c.restore();
}

function farmDrawLandForSale(c, x, y, w, h, lot) {
  c.save();
  const nearby = farmWorldNearPlot()?.id === lot.id;
  c.fillStyle = '#869a68';
  c.fillRect(x, y, w, h);
  c.strokeStyle = nearby ? '#fff0bd' : '#d6c79b';
  c.lineWidth = nearby ? 3 : 2;
  c.setLineDash([6, 4]);
  c.strokeRect(x, y, w, h);
  for (const dx of [x, x + w - 4]) {
    for (const dy of [y, y + h - 4]) {
      c.fillStyle = '#845b3c'; c.fillRect(dx, dy - 5, 4, 12);
      c.fillStyle = '#e4bf85'; c.fillRect(dx, dy - 5, 4, 3);
    }
  }
  const cx = x + w / 2, cy = y + h / 2;
  c.fillStyle = '#73543b'; c.fillRect(cx - 3, cy - 3, 6, 24);
  c.fillStyle = '#523e32'; c.fillRect(cx - 42, cy - 22, 84, 32);
  c.fillStyle = '#fff0cd'; c.font = 'bold 11px system-ui'; c.textAlign = 'center';
  c.fillText(lot.name, cx, cy - 8);
  c.fillStyle = '#ffda7d'; c.fillText(lot.price + 'C', cx, cy + 5);
  c.restore();
}
