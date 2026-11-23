// 2.5D stills for the kitchen scene: renders each ingredient GLB at a fixed 3/4 view
// with the game's own inlined three.js r160 + GLTFLoader (Blender is not available
// in this environment; a Blender render can replace these PNGs at the same paths).
// Usage: node render-stills.cjs <game-url> <glb-dir> <out-dir>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [url, glbDir, outDir] = process.argv.slice(2);
const ITEMS = [['wheat', 'wheat-crop-c073.glb'], ['potato', 'potato-crop-c047.glb'], ['carrot', 'carrot-crop-carrot.glb']];
const SIZE = 192;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!(window.THREE && window.GLTFLoader));
  for (const [id, file] of ITEMS) {
    const b64 = fs.readFileSync(path.join(glbDir, file)).toString('base64');
    const res = await page.evaluate(async ({ b64, SIZE }) => {
      const T = window.THREE;
      const bin = atob(b64), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const gltf = await new Promise((ok, no) => new window.GLTFLoader().parse(buf.buffer, '', ok, no));
      const canvas = document.createElement('canvas'); canvas.width = SIZE; canvas.height = SIZE;
      const r = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setClearColor(0x000000, 0);
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight(0xfff4dc, 0x2a3a34, 1.1));
      const sun = new T.DirectionalLight(0xffe7c2, 1.8); sun.position.set(3, 5, 4); scene.add(sun);
      const model = gltf.scene;
      const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
      const s = 1.6 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(s); model.position.set(-c.x * s, -c.y * s, -c.z * s);
      const pivot = new T.Group(); pivot.add(model); pivot.rotation.y = Math.PI / 4; scene.add(pivot);
      const cam = new T.PerspectiveCamera(30, 1, 0.1, 50);
      const d = 3.6, el = 30 * Math.PI / 180; // 3/4 view: 45 deg yaw (pivot) + 30 deg elevation
      cam.position.set(0, Math.sin(el) * d, Math.cos(el) * d); cam.lookAt(0, 0, 0);
      r.render(scene, cam);
      const px = r.getContext(); const data = new Uint8Array(SIZE * SIZE * 4); px.readPixels(0, 0, SIZE, SIZE, px.RGBA, px.UNSIGNED_BYTE, data);
      let opaque = 0, x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (data[(y * SIZE + x) * 4 + 3] > 0) { opaque++; const ty = SIZE - 1 - y; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, ty); y1 = Math.max(y1, ty); }
      // crop a padded square around the object so small shelf thumbnails stay readable
      const side = Math.min(SIZE, Math.ceil(Math.max(x1 - x0 + 1, y1 - y0 + 1) * 1.12)), cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
      const sx = Math.max(0, Math.min(SIZE - side, Math.round(cx - side / 2))), sy = Math.max(0, Math.min(SIZE - side, Math.round(cy - side / 2)));
      const OUT = 128, out = document.createElement('canvas'); out.width = OUT; out.height = OUT;
      const o2 = out.getContext('2d'); o2.imageSmoothingQuality = 'high'; o2.drawImage(canvas, sx, sy, side, side, 0, 0, OUT, OUT);
      const url = out.toDataURL('image/png');
      r.dispose(); r.forceContextLoss();
      return { url, opaque, crop: [sx, sy, side] };
    }, { b64, SIZE });
    const png = Buffer.from(res.url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(outDir, `${id}-3q.png`), png);
    console.log(id, file, 'png', png.length, 'B', 'opaque px', res.opaque, '/', SIZE * SIZE, 'crop', res.crop);
  }
  console.log('errors', errors.length, errors.slice(0, 3));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
