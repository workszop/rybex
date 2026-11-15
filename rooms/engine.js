// Walk-in 3D rooms: a first-person Three.js view with five clickable stations, each opening an HTML panel docked over it.
// Classic script (works from file://). Needs window.THREE from vendor/three/three.global.js; without it, or without
// WebGL, mount() still gives a working toolbar + panel ("fallback").
//
//   Rooms.define('vision', ctx => ({ scene, bounds, colliders, spawn, stations, ... }));
//   const room = Rooms.mount({ host, track: 'vision', lang: 'pl', data, titles, panels, onOpen, onClose, onExit2d });
//   room.open('data'); room.setPanels({ data: el }); room.dispose();
//
// Panels are MOVED into the room (append), never cloned, so ids, listeners and typed values stay.
// dispose() takes them out of the slots again and leaves them detached (not in the document) for the app to reuse.
// Titles and labels may be strings or { pl, en }.
// handle.open(station) opens at once and glides the camera meanwhile (for jump links); a click on a station mesh or
// toolbar button glides first and opens on arrival.
(function () {
  'use strict';
  const STATIONS = ['brief', 'data', 'method', 'experiment', 'results'];
  const EYE = 1.65, RADIUS = 0.3, SPEED = 3.2, PITCH_MAX = Math.PI / 3, LOOK_RATE = 0.005, PR_MAX = 1.5;
  const LABEL_PX = 34, LABEL_PX_FAR = 28; // station label height on screen (CSS px), near and far
  const TXT = {
    pl: { hint: 'Kliknijcie świecące stanowisko albo chodźcie: WASD / strzałki, przeciągnijcie, żeby się rozejrzeć.', bar: 'Stanowiska', exit: 'Widok 2D', exitTitle: 'Przełączcie na zwykły widok strony', close: 'Zamknij', prev: 'Poprzednie stanowisko', next: 'Następne stanowisko', canvas: 'Pokój 3D. Stanowiska są też dostępne z paska przycisków.', opened: 'Otwarte stanowisko: ' },
    en: { hint: 'Click a glowing station, or walk with WASD / arrows and drag to look around.', bar: 'Stations', exit: '2D view', exitTitle: 'Switch to the plain page view', close: 'Close', prev: 'Previous station', next: 'Next station', canvas: '3D room. The stations are also available from the button bar.', opened: 'Station opened: ' },
  };
  const builders = {};
  const live = new WeakMap(); // host -> handle, so a second mount into the same host disposes the first
  let uid = 0, supportedCache = null;

  function supported() {
    if (supportedCache !== null) return supportedCache;
    try {
      const c = document.createElement('canvas');
      // WebGL2 only: Three.js r170 refuses WebGL1, so offering 3D there would only end in an error and the fallback.
      const g = c.getContext('webgl2');
      supportedCache = !!g;
      const lose = g && g.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    } catch (e) { supportedCache = false; }
    return supportedCache;
  }

  // ---- kit: shared building helpers (rooms extend it) ----
  const kit = {
    canvasTexture(w, h, draw, { repeat } = {}) {
      const T = window.THREE, c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
      if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      return t;
    },
    mat(color, { rough = 0.8, metal = 0, map } = {}) {
      return new window.THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: map || null });
    },
    box(parent, [w, h, d], [x, y, z], material) {
      const m = new window.THREE.Mesh(new window.THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    },
    cyl(parent, r, h, [x, y, z], material) {
      const m = new window.THREE.Mesh(new window.THREE.CylinderGeometry(r, r, h, 24), material);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    },
    // Text on a canvas sprite (a dark pill). Starts 0.32 m tall; the engine rescales station labels every frame so
    // they keep a small, steady size on screen. userData.aspect = width / height.
    label(text) {
      const T = window.THREE, fs = 44, pad = 22, font = `600 ${fs}px "IBM Plex Sans", system-ui, sans-serif`;
      const probe = document.createElement('canvas').getContext('2d'); probe.font = font;
      const w = Math.ceil(probe.measureText(text).width) + pad * 2, h = fs + 20;
      const tex = kit.canvasTexture(w, h, g => {
        g.fillStyle = 'rgba(28,25,23,.86)'; const r = h / 2;
        g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
        g.font = font; g.fillStyle = '#FFD500'; g.textBaseline = 'middle'; g.fillText(text, pad, h / 2 + 2);
      });
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.scale.set(0.32 * w / h, 0.32, 1); s.renderOrder = 10; s.userData.aspect = w / h; return s;
    },
  };

  // ---- kit: realistic materials and building blocks (shared by the rooms) ----
  // Textures are drawn on canvases, deterministic (seeded) and cached per page: rooms share one image per kind and
  // take a clone with their own repeat via kit.tile(). Every texture is RepeatWrapping with repeat 1x1.
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const css = c => typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c;
  const shade = (c, k) => { const n = parseInt(css(c).slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const texCache = new Map(), screenCache = new WeakMap();
  const cachedTex = (key, w, h, draw) => { let t = texCache.get(key); if (!t) { t = kit.canvasTexture(w, h, draw, { repeat: [1, 1] }); texCache.set(key, t); } return t; };
  // Per-pixel grain on our own canvas (never on a canvas holding an image, so file:// stays untainted).
  function grain(g, w, h, amt, r) {
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }
  // Draw fn(x, y) at every wrapped copy that touches the tile, so blotches repeat seamlessly.
  const wrap = (w, h, x, y, rad, fn) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) if (x + ox > -rad && x + ox < w + rad && y + oy > -rad && y + oy < h + rad) fn(x + ox, y + oy); };
  function blotches(g, w, h, r, n, [r0, r1], tones) {
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, rad = r0 + r() * (r1 - r0), tone = tones[Math.floor(r() * tones.length)], a = 0.025 + r() * 0.06;
      wrap(w, h, x, y, rad, (cx, cy) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, `rgba(${tone},${a})`); gr.addColorStop(1, `rgba(${tone},0)`); g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); });
    }
  }

  const tex = {
    // Power-floated concrete: soft mottling, aggregate specks, a few hairline cracks. One tile is about 2 m.
    concrete: () => cachedTex('concrete', 512, 512, (g, w, h) => {
      const r = rng(11);
      g.fillStyle = '#8e8c87'; g.fillRect(0, 0, w, h);
      blotches(g, w, h, r, 90, [30, 130], ['52,50,46', '196,194,186', '120,110,96']);
      for (let i = 0; i < 2600; i++) { const v = r() < 0.5 ? 40 : 210; g.fillStyle = `rgba(${v},${v},${v - 6},${0.08 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 1 + r() * 1.6, 1 + r() * 1.6); }
      g.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        let x = r() * w, y = r() * h; g.strokeStyle = `rgba(40,38,34,${0.1 + r() * 0.12})`; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 14; k++) { x += (r() - 0.5) * 22; y += 4 + r() * 10; g.lineTo(x, y); } g.stroke();
      }
      grain(g, w, h, 18, r);
    }),
    // Square floor or wall tiles with grout, each tile a slightly different shade. 4x4 tiles per image.
    tiles: (color = '#9b5b45') => cachedTex('tiles:' + css(color), 512, 512, (g, w, h) => {
      const r = rng(23), n = 4, s = w / n;
      g.fillStyle = shade(color, 0.62); g.fillRect(0, 0, w, h);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g.fillStyle = shade(color, 0.9 + r() * 0.2); g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
        g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(i * s + 3, j * s + 3, s - 6, 3); g.fillRect(i * s + 3, j * s + 3, 3, s - 6);
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(i * s + 3, j * s + s - 6, s - 6, 3);
      }
      blotches(g, w, h, r, 40, [20, 70], ['40,30,25', '230,225,215']);
      grain(g, w, h, 16, r);
    }),
    // Brushed stainless: fine streaks along u.
    brushedSteel: () => cachedTex('steel', 512, 512, (g, w, h) => {
      const r = rng(31);
      g.fillStyle = '#b4b8bb'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5200; i++) {
        const y = r() * h, x = r() * w, len = 30 + r() * 260, v = r() < 0.5 ? 255 : 70;
        g.strokeStyle = `rgba(${v},${v},${v},${0.025 + r() * 0.05})`; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
        if (x + len > w) { g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + len - w, y); g.stroke(); }
      }
      blotches(g, w, h, r, 14, [40, 120], ['90,94,98', '235,238,240']);
      grain(g, w, h, 8, r);
    }),
    // Painted concrete blockwork (390x190 mm blocks): 4 blocks wide, 8 courses tall = 1.6 x 1.6 m per image.
    paintedWall: (color = '#e7e4dc') => cachedTex('wall:' + css(color), 512, 512, (g, w, h) => {
      const r = rng(41), bw = w / 4, bh = h / 8;
      g.fillStyle = css(color); g.fillRect(0, 0, w, h);
      blotches(g, w, h, r, 26, [20, 80], ['90,90,85', '255,255,255']);
      g.fillStyle = shade(color, 0.86);
      for (let row = 0; row < 8; row++) {
        g.fillRect(0, row * bh, w, 3);
        const off = row % 2 ? bw / 2 : 0;
        for (let c = 0; c <= 4; c++) g.fillRect((c * bw + off) % w - 1, row * bh, 3, bh);
      }
      g.fillStyle = 'rgba(255,255,255,.18)';
      for (let row = 0; row < 8; row++) g.fillRect(0, row * bh + 3, w, 1);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
      grain(g, w, h, 10, r);
    }),
    // Corrugated cardboard (kraft): fibres, faint flutes along v.
    cardboard: () => cachedTex('cardboard', 256, 256, (g, w, h) => {
      const r = rng(53);
      g.fillStyle = '#b48a58'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 6) { g.fillStyle = 'rgba(80,50,20,.05)'; g.fillRect(x, 0, 2, h); }
      blotches(g, w, h, r, 30, [15, 60], ['90,60,30', '220,190,140']);
      g.lineWidth = 1;
      for (let i = 0; i < 260; i++) { const x = r() * w, y = r() * h; g.strokeStyle = `rgba(70,45,20,${0.06 + r() * 0.1})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14); g.stroke(); }
      grain(g, w, h, 14, r);
    }),
    // Ribbed steel cladding (sandwich panel), ribs along v every 1/8 of the image.
    cladding: (color = '#d9dcdd') => cachedTex('clad:' + css(color), 256, 256, (g, w, h) => {
      const r = rng(61), p = w / 8;
      g.fillStyle = css(color); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        const gr = g.createLinearGradient(i * p, 0, i * p + p, 0);
        gr.addColorStop(0, 'rgba(0,0,0,.16)'); gr.addColorStop(0.18, 'rgba(255,255,255,.14)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.04)');
        g.fillStyle = gr; g.fillRect(i * p, 0, p, h);
      }
      blotches(g, w, h, r, 20, [20, 70], ['0,0,0', '255,255,255']);
      grain(g, w, h, 8, r);
    }),
    // Yellow and black hazard stripes at 45 degrees (column guards, machine edges, kerbs).
    hazard: () => cachedTex('hazard', 128, 128, (g, w, h) => {
      const r = rng(71);
      g.fillStyle = '#f2c200'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1b19';
      for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 32, 0); g.lineTo(k * 64 + 32 + h, h); g.lineTo(k * 64 + h, h); g.closePath(); g.fill(); }
      blotches(g, w, h, r, 16, [8, 30], ['60,50,30', '255,255,240']);
      grain(g, w, h, 14, r);
    }),
    // Stainless drain grating: slots across u.
    grate: () => cachedTex('grate', 128, 128, (g, w, h) => {
      g.fillStyle = '#9da2a5'; g.fillRect(0, 0, w, h); g.fillStyle = '#16191b';
      for (let x = 4; x < w; x += 16) g.fillRect(x, 6, 9, h - 12);
      g.fillStyle = 'rgba(255,255,255,.25)'; for (let x = 4; x < w; x += 16) g.fillRect(x + 9, 6, 2, h - 12);
    }),
    // A screen image: drawFn(g, w, h) draws it, texture.redraw() draws it again (for data, or an image that has
    // just loaded). Cached per drawFn.
    screen(drawFn, { w = 512, h = 320 } = {}) {
      let t = screenCache.get(drawFn);
      if (t) return t;
      const T = window.THREE, c = document.createElement('canvas'); c.width = w; c.height = h;
      t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
      t.redraw = () => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); drawFn(g, w, h, t); t.needsUpdate = true; };
      t.redraw(); screenCache.set(drawFn, t);
      return t;
    },
    // A generic hall for reflections: bright ceiling strips, walls with a light band, darker floor (cube texture).
    env: () => {
      let t = texCache.get('env');
      if (t) return t;
      const T = window.THREE, mk = draw => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d'), 128); return c; };
      const wall = mk((g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#c9cbcc'); gr.addColorStop(0.45, '#9fa3a5'); gr.addColorStop(1, '#55534f'); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.fillStyle = '#f4f6f8'; g.fillRect(10, 22, s - 20, 10); g.fillStyle = '#e8eef3'; g.fillRect(30, 40, 26, 22); g.fillRect(72, 40, 26, 22); });
      const ceil = mk((g, s) => { g.fillStyle = '#b8babb'; g.fillRect(0, 0, s, s); g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) g.fillRect(12 + i * 30, 10, 8, s - 20); });
      const floor = mk((g, s) => { g.fillStyle = '#4a4946'; g.fillRect(0, 0, s, s); });
      t = new T.CubeTexture([wall, wall, ceil, floor, wall, wall]); t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true;
      texCache.set('env', t);
      return t;
    },
    // A safety sign (ISO 7010 look): kind 'warning' (yellow triangle), 'mandatory' (blue disc), 'fire' (red
    // square), 'exit' (green), 'info' (white plate), with optional text below the pictogram.
    sign: (kind, text = '', glyph = '') => cachedTex(`sign:${kind}:${text}:${glyph}`, 256, text ? 320 : 256, (g, w, h) => {
      g.fillStyle = kind === 'exit' ? '#0b8a3e' : '#fbfaf6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
      const cx = w / 2, cy = 120;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (kind === 'warning') {
        g.fillStyle = '#1c1917'; g.beginPath(); g.moveTo(cx, 18); g.lineTo(cx + 112, 214); g.lineTo(cx - 112, 214); g.closePath(); g.fill();
        g.fillStyle = '#f7c600'; g.beginPath(); g.moveTo(cx, 42); g.lineTo(cx + 92, 202); g.lineTo(cx - 92, 202); g.closePath(); g.fill();
        g.fillStyle = '#1c1917'; g.font = '800 110px system-ui, sans-serif'; g.fillText(glyph || '!', cx, 146);
      } else if (kind === 'mandatory') {
        g.fillStyle = '#1764ad'; g.beginPath(); g.arc(cx, cy, 100, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.font = '700 96px system-ui, sans-serif'; g.fillText(glyph || 'i', cx, cy + 4);
      } else if (kind === 'fire') {
        g.fillStyle = '#c8102e'; g.fillRect(28, 20, w - 56, 200);
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, 138, 30, 62, 0, 0, Math.PI * 2); g.fill(); g.fillRect(cx - 12, 52, 24, 26); g.fillRect(cx - 12, 58, 64, 10);
      } else if (kind === 'exit') {
        g.fillStyle = '#fff'; g.font = '800 120px system-ui, sans-serif'; g.fillText(glyph || '→', cx + 50, cy);
        g.beginPath(); g.arc(cx - 60, 60, 18, 0, Math.PI * 2); g.fill(); g.lineWidth = 18; g.strokeStyle = '#fff'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx - 66, 90); g.lineTo(cx - 80, 150); g.lineTo(cx - 40, 200); g.moveTo(cx - 80, 150); g.lineTo(cx - 110, 200); g.moveTo(cx - 100, 110); g.lineTo(cx - 40, 125); g.stroke();
      } else {
        g.fillStyle = '#1c1917'; g.font = '800 120px system-ui, sans-serif'; g.fillText(glyph || '', cx, cy);
      }
      if (text) {
        g.fillStyle = kind === 'exit' ? '#fff' : '#1c1917'; let fs = 40; g.font = `700 ${fs}px system-ui, sans-serif`;
        while (g.measureText(text).width > w - 24 && fs > 18) { fs -= 2; g.font = `700 ${fs}px system-ui, sans-serif`; }
        g.fillText(text, cx, h - 50);
      }
    }),
  };

  // Planar box-projected UVs in world metres (perMetre repeats per metre), so a texture keeps its scale on every
  // face of every size. Works on any geometry with normals; call after positioning the vertices.
  function worldUV(geo, perMetre = 1, off = [0, 0, 0]) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const x = p.getX(i) + off[0], y = p.getY(i) + off[1], z = p.getZ(i) + off[2];
      let u, v;
      if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
      uv[i * 2] = u * perMetre; uv[i * 2 + 1] = v * perMetre;
    }
    geo.setAttribute('uv', new window.THREE.BufferAttribute(uv, 2));
    return geo;
  }
  // Merge indexed or non-indexed geometries (position, normal, uv) into one: one draw call for static clutter.
  function merge(geos) {
    const T = window.THREE, pos = [], nor = [], uv = [], idx = []; let base = 0;
    for (const g0 of geos) {
      const g = g0, p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
      base += p.count; g0.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    out.setIndex(base > 65535 ? new T.Uint32BufferAttribute(idx, 1) : new T.Uint16BufferAttribute(idx, 1));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }

  Object.assign(kit, {
    rng, tex, worldUV, merge,
    // A clone of a cached texture with its own repeat (clones share the image: one upload).
    tile(t, rx = 1, ry = rx) { const c = t.clone(); c.wrapS = c.wrapT = window.THREE.RepeatWrapping; c.repeat.set(rx, ry); c.needsUpdate = true; return c; },
    // Static clutter that shares a material: add boxes, cylinders or any geometry, then done() gives ONE mesh.
    // { uv: perMetre } gives world-scaled box-projected UVs; otherwise each part keeps its own 0..1 UVs.
    batch(parent, material, { uv = 0, shadow = true, receive = true } = {}) {
      const T = window.THREE, parts = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), one = new T.Vector3(1, 1, 1);
      const put = (geo, [x, y, z], [rx, ry, rz] = [0, 0, 0], s) => { geo.applyMatrix4(m4.compose(new T.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s ? new T.Vector3(...s) : one)); parts.push(geo); return api; };
      const api = {
        box: ([w, h, d], p, r) => put(new T.BoxGeometry(w, h, d), p, r),
        cyl: (rt, rb, h, p, r, seg = 16, open = false) => put(new T.CylinderGeometry(rt, rb, h, seg, 1, open), p, r),
        // A cylinder from point a to point b.
        rod(a, b, rad, seg = 10) { const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), geo = new T.CylinderGeometry(rad, rad, d.length(), seg); geo.applyMatrix4(m4.compose(A.add(B).multiplyScalar(0.5), q.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()), one)); parts.push(geo); return api; },
        add: (geo, p = [0, 0, 0], r, s) => put(geo, p, r, s),
        get count() { return parts.length; },
        done() {
          if (!parts.length) return null;
          const geo = merge(parts); if (uv) worldUV(geo, uv);
          const mesh = new T.Mesh(geo, material); mesh.castShadow = shadow; mesh.receiveShadow = receive; parent.add(mesh); return mesh;
        },
      };
      return api;
    },
    // Many copies of one geometry: list of { p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz] }.
    inst(parent, geo, material, list, { shadow = false, receive = true } = {}) {
      const T = window.THREE, im = new T.InstancedMesh(geo, material, list.length), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      list.forEach((it, i) => im.setMatrixAt(i, m4.compose(new T.Vector3(...it.p), q.setFromEuler(e.set(...(it.r || [0, 0, 0]))), new T.Vector3(...(it.s || [1, 1, 1])))));
      im.instanceMatrix.needsUpdate = true; im.castShadow = shadow; im.receiveShadow = receive; im.computeBoundingSphere(); parent.add(im); return im;
    },
    plane(parent, [w, h], [x, y, z], [rx, ry, rz], material) {
      const m = new window.THREE.Mesh(new window.THREE.PlaneGeometry(w, h), material);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.receiveShadow = true; parent.add(m); return m;
    },
    rbox(parent, [w, h, d], [x, y, z], material, radius = 0.03) {
      const T = window.THREE, m = new T.Mesh(new T.RoundedBoxGeometry(w, h, d, 3, radius), material);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    },
    // A station view that leaves room for the panel docked on the right: the station ends up left of centre
    // (shift = fraction of the viewing distance the aim point moves to the right). pos/target are [x, y, z].
    view(pos, target, shift = 0.3) {
      const dx = target[0] - pos[0], dz = target[2] - pos[2], len = Math.hypot(dx, dz) || 1;
      return { pos, target: [target[0] - dz / len * len * shift, target[1], target[2] + dx / len * len * shift] };
    },
    // Highlight by hand for non-station props (the engine already pulses station meshes): on = true, false or an
    // intensity. On a station mesh the engine's pulse overrides it every frame.
    glow(obj, on) {
      obj.traverse(o => {
        if (!o.isMesh) return;
        o.material = [].concat(o.material).map(m => {
          if (!m || !m.emissive) return m;
          // Own flag (not the engine's roomGlow): a station mesh lit by hand still gets the engine highlight.
          if (!m.userData.kitGlow) { m = m.clone(); m.userData.kitGlow = true; m.emissive.copy(m.color); if (m.map && !m.emissiveMap) m.emissiveMap = m.map; }
          m.emissiveIntensity = on === true ? 0.42 : on ? Number(on) : 0;
          return m;
        });
        if (o.material.length === 1) o.material = o.material[0];
      });
      return obj;
    },
    // A self-lit screen (unlit, not tone-mapped): mesh.userData.redraw() draws it again.
    screenPlane(parent, [w, h], [x, y, z], rotY, drawFn) {
      const T = window.THREE, px = 512, t = tex.screen(drawFn, { w: Math.round(px * Math.min(2, w / h)), h: Math.round(px * Math.min(2, w / h) * h / w) });
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, toneMapped: false }));
      m.position.set(x, y, z); m.rotation.y = rotY || 0; m.userData.redraw = t.redraw; parent.add(m); return m;
    },
    // Give every standard material under obj the shared reflection map (steel and wet floors need something to reflect).
    envAll(obj, intensity = 1) {
      const env = tex.env();
      obj.traverse(o => { for (const m of [].concat(o.material || [])) if (m.isMeshStandardMaterial && !m.envMap) { m.envMap = env; m.envMapIntensity = intensity; } });
    },
    // Common fittings for any room.
    prop: {
      // Wall-mounted extinguisher with its sign above; (x, z) on the wall face, rotY faces the room.
      extinguisher(parent, [x, z], rotY, lang = 'pl') {
        const T = window.THREE, g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
        const red = kit.mat(0xc21a1a, { rough: 0.35, metal: 0.1 }), black = kit.mat(0x1a1a1a, { rough: 0.6 });
        kit.cyl(g, 0.085, 0.5, [0, 0.95, 0.12], red);
        kit.cyl(g, 0.05, 0.1, [0, 1.25, 0.12], black);
        kit.box(g, [0.12, 0.03, 0.03], [0.03, 1.32, 0.12], black);
        kit.box(g, [0.16, 0.04, 0.06], [0, 0.82, 0.04], black);
        kit.plane(g, [0.3, 0.3], [0, 1.65, 0.012], [0, 0, 0], new T.MeshStandardMaterial({ map: tex.sign('fire'), roughness: 0.6 }));
        return g;
      },
      // Green illuminated exit sign (unlit, so it glows).
      exitSign(parent, [x, y, z], rotY, lang = 'pl') {
        const T = window.THREE, word = lang === 'en' ? 'EXIT' : 'WYJŚCIE';
        const t = cachedTex('exit:' + word, 512, 200, (g, w, h) => {
          g.fillStyle = '#0b8a3e'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 16;
          g.beginPath(); g.arc(70, 46, 15, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(64, 72); g.lineTo(52, 122); g.lineTo(84, 166); g.moveTo(52, 122); g.lineTo(26, 166); g.moveTo(34, 88); g.lineTo(92, 100); g.stroke();
          g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '800 78px system-ui, sans-serif'; g.fillText(word, 128, h / 2 + 4);
          g.font = '800 90px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('\u2192', w - 18, h / 2);
        });
        const face = new T.MeshBasicMaterial({ map: t, toneMapped: false }), body = kit.mat(0xe8e8e8, { rough: 0.5 });
        const m = new T.Mesh(new T.BoxGeometry(0.5, 0.2, 0.05), [body, body, body, body, face, body]);
        m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m); return m;
      },
      // A sign plate on a wall (use tex.sign).
      sign(parent, [w, h], [x, y, z], rotY, t) {
        return kit.plane(parent, [w, h], [x, y, z], [0, rotY, 0], new window.THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }));
      },
      // EUR pallet (1.2 x 0.8 x 0.144 m) added to a batch b, at (x, z), turned rotY (0 or PI/2).
      pallet(b, [x, z], rotY = 0) {
        const c = Math.cos(rotY), s = Math.sin(rotY), at = (lx, y, lz) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
        for (const lz of [-0.35, 0, 0.35]) b.box([1.2, 0.022, 0.1], at(0, 0.133, lz), [0, rotY, 0]);
        for (const lz of [-0.35, 0, 0.35]) b.box([1.2, 0.022, 0.1], at(0, 0.011, lz), [0, rotY, 0]);
        for (const lx of [-0.55, 0, 0.55]) for (const lz of [-0.35, 0, 0.35]) b.box([0.145, 0.078, 0.1], at(lx, 0.061, lz), [0, rotY, 0]);
        for (const lx of [-0.5, -0.25, 0.25, 0.5]) b.box([0.1, 0.022, 0.8], at(lx, 0.133, 0), [0, rotY, 0]);
      },
    },
  });

  function el(tag, attrs = {}, kids = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); }
    for (const k of [].concat(kids)) e.append(k);
    return e;
  }
  const editable = t => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

  function mount(opts) {
    const { host, track, data, onOpen, onClose, onExit2d } = opts;
    const lang = opts.lang === 'en' ? 'en' : 'pl', L = TXT[lang], id = 'room' + (++uid);
    const titles = opts.titles || {};
    // Copy may be a plain string or { pl, en }.
    const tr = v => (v && typeof v === 'object') ? (v[lang] ?? v.pl ?? v.en) : v;
    if (live.has(host)) live.get(host).dispose();
    host.replaceChildren();
    const reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    // ---- DOM ----
    const rootEl = el('div', { class: 'room-root', 'data-room-track': track, 'data-room-status': 'loading', 'data-room-station': 'none' });
    const hint = el('p', { class: 'room-hint' }, L.hint);
    const liveEl = el('div', { class: 'room-live', 'aria-live': 'polite', role: 'status' });
    const btns = {};
    const bar = el('div', { class: 'room-toolbar', role: 'toolbar', 'aria-label': L.bar });
    for (const s of STATIONS) { btns[s] = el('button', { type: 'button', class: 'room-btn', 'data-station': s }, tr(titles[s]) || s); bar.append(btns[s]); }
    const exitBtn = el('button', { type: 'button', class: 'room-btn room-2d', 'data-room-2d': true, title: L.exitTitle }, L.exit);
    bar.append(exitBtn);
    const titleEl = el('h2', { class: 'room-panel-title', id: id + '-title', tabindex: '-1' });
    const prevBtn = el('button', { type: 'button', class: 'room-icon', 'data-room-prev': true, 'aria-label': L.prev, title: L.prev }, '‹');
    const nextBtn = el('button', { type: 'button', class: 'room-icon', 'data-room-next': true, 'aria-label': L.next, title: L.next }, '›');
    const closeBtn = el('button', { type: 'button', class: 'room-icon', 'data-room-close': true, 'aria-label': L.close, title: L.close + ' (Esc)' }, '×');
    const slots = {};
    const body = el('div', { class: 'room-panel-body' });
    for (const s of STATIONS) { slots[s] = el('div', { class: 'room-slot', 'data-station': s, hidden: true }); body.append(slots[s]); }
    const head = el('header', { class: 'room-panel-head' }, [titleEl, el('div', { class: 'room-panel-nav' }, [prevBtn, nextBtn, closeBtn])]);
    const panel = el('section', { class: 'room-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': titleEl.id, hidden: true }, [head, body]);
    rootEl.append(hint, bar, panel, liveEl);
    host.append(rootEl);
    setPanels(opts.panels || {});

    let station = 'none', disposed = false, pendingOpen = 0;
    const handle = { open, close, setPanels, status: 'loading', dispose, _debug: { cameraPos: () => null, project: () => null, info: () => null, labels: () => null } };
    live.set(host, handle);
    const setStatus = s => { handle.status = s; rootEl.dataset.roomStatus = s; };
    const titleOf = s => tr(titles[s]) || (g3 && g3.byKey[s] && g3.byKey[s].label) || s;

    function show(s) {
      clearTimeout(pendingOpen);
      if (!STATIONS.includes(s)) return;
      station = s; rootEl.dataset.roomStation = s;
      for (const k of STATIONS) { slots[k].hidden = k !== s; btns[k].setAttribute('aria-pressed', String(k === s)); }
      titleEl.textContent = titleOf(s);
      panel.hidden = false; hint.classList.add('is-gone');
      liveEl.textContent = L.opened + titleOf(s);
      // Keep focus on the panel's own buttons (prev/next) or inside the shown slot; otherwise start at the title.
      const a = document.activeElement;
      if (!a || !(head.contains(a) || slots[s].contains(a))) titleEl.focus({ preventScroll: true });
      if (onOpen) onOpen(s);
    }
    function open(s) { if (!STATIONS.includes(s)) return; if (g3) g3.glideTo(s); show(s); }
    // User-initiated: glide first, open on arrival (at once when there is no 3D view).
    function visit(s) {
      clearTimeout(pendingOpen);
      if (!g3) { show(s); return; }
      const ms = g3.glideTo(s);
      if (ms <= 0) show(s); else pendingOpen = setTimeout(() => { if (!disposed) show(s); }, ms);
    }
    function close() {
      clearTimeout(pendingOpen);
      if (station === 'none') return;
      const was = station, focusBack = panel.contains(document.activeElement) || document.activeElement === document.body;
      station = 'none'; rootEl.dataset.roomStation = 'none';
      panel.hidden = true;
      for (const k of STATIONS) { slots[k].hidden = true; btns[k].setAttribute('aria-pressed', 'false'); }
      if (focusBack) btns[was].focus({ preventScroll: true });
      if (onClose) onClose();
    }
    function step(d) { if (station === 'none') return; const s = STATIONS[(STATIONS.indexOf(station) + d + STATIONS.length) % STATIONS.length]; open(s); }
    function setPanels(panels) {
      const had = panel.contains(document.activeElement);
      for (const s of STATIONS) if (panels && panels[s]) slots[s].replaceChildren(panels[s]);
      if (had && !panel.contains(document.activeElement)) titleEl.focus({ preventScroll: true });
    }

    const domOff = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); domOff.push(() => t.removeEventListener(ev, fn, o)); };
    for (const s of STATIONS) on(btns[s], 'click', () => visit(s));
    on(exitBtn, 'click', () => { if (onExit2d) onExit2d(); });
    on(prevBtn, 'click', () => step(-1));
    on(nextBtn, 'click', () => step(1));
    on(closeBtn, 'click', close);
    on(window, 'keydown', e => {
      if (e.key !== 'Escape' || station === 'none' || e.defaultPrevented) return;
      const a = document.activeElement;
      if (a && a !== document.body && !rootEl.contains(a)) return;
      e.preventDefault(); close();
    });

    // ---- 3D ----
    let g3 = null;
    try {
      const T = window.THREE, build = builders[track];
      if (!T || !build || !supported()) throw new Error(!T ? 'THREE missing' : !build ? `no room "${track}"` : 'WebGL unavailable');
      g3 = create3d(T, build({ THREE: T, kit, lang, data, reducedMotion }));
    } catch (e) {
      g3 = null;
      console.warn('Rooms: 3D view unavailable, using the panel list.', e && e.message);
      rootEl.querySelectorAll('canvas').forEach(c => c.remove());
      rootEl.classList.add('room-fallback');
      setStatus('fallback');
    }
    if (g3) setStatus('ready');
    if (g3) for (const s of STATIONS) if (!tr(titles[s]) && g3.byKey[s]) btns[s].textContent = g3.byKey[s].label;

    // A throw half-way (shader compile, bad spec) must not leave a WebGL context, listeners or a frame loop behind.
    function create3d(T, spec) {
      const local = { raf: 0, off: [], renderer: null, canvas: null };
      try { return build3d(T, spec, local); } catch (e) {
        cancelAnimationFrame(local.raf); local.off.forEach(f => f());
        if (local.renderer) { local.renderer.dispose(); local.renderer.forceContextLoss(); }
        if (local.canvas) local.canvas.remove();
        if (spec && spec.dispose) { try { spec.dispose(); } catch (_) { /* reported by the caller */ } }
        handle._debug = { cameraPos: () => null, project: () => null, info: () => null, labels: () => null };
        throw e;
      }
    }
    function build3d(T, spec, local) {
      const lon = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); local.off.push(() => t.removeEventListener(ev, fn, o)); };
      const canvas = local.canvas = el('canvas', { class: 'room-canvas', tabindex: '-1', role: 'img', 'aria-label': L.canvas });
      const renderer = local.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      const api = { byKey: {}, glideTo: () => 0, dispose: () => {} };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PR_MAX));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      rootEl.prepend(canvas);

      const scene = new T.Scene();
      scene.background = new T.Color(spec.background != null ? spec.background : 0xdfe3e6);
      if (spec.fog) scene.fog = new T.Fog(spec.fog.color, spec.fog.near, spec.fog.far);
      scene.add(spec.scene);
      const b = spec.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, span = Math.max(b.x1 - b.x0, b.z1 - b.z0);
      if (spec.lights !== 'none') {
        scene.add(new T.HemisphereLight(0xfffaf2, 0x8a8174, 1.25));
        const sun = new T.DirectionalLight(0xfff6e8, 2.2);
        sun.position.set(cx + span * 0.35, 9, cz + span * 0.25); sun.target.position.set(cx, 0, cz);
        sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
        const sc = sun.shadow.camera, half = span * 0.75; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 0.5; sc.far = 30;
        sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
        scene.add(sun, sun.target);
      }

      const camera = new T.PerspectiveCamera(60, 1, 0.05, 80);
      camera.rotation.order = 'YXZ';
      const pos = new T.Vector3(...spec.spawn.pos); let yaw = spec.spawn.yaw || 0, pitch = 0;
      const apply = () => { camera.position.copy(pos); camera.rotation.set(pitch, yaw, 0); };
      apply();

      // Stations: own glow material per mesh, floating label, key lookup from any hit object.
      const hitKey = new Map(), pickables = [];
      for (const st of spec.stations || []) {
        if (!STATIONS.includes(st.key)) continue;
        const mats = [];
        for (const m of st.meshes || []) m.traverse(o => {
          hitKey.set(o, st.key);
          if (o.isMesh && o.material && o.material.emissive && !o.material.userData.roomGlow) {
            // Glow = the material's own colour (and texture), so a lit station gets brighter without changing hue.
            o.material = o.material.clone(); o.material.userData.roomGlow = true; o.material.emissive.copy(o.material.color);
            if (o.material.map && !o.material.emissiveMap) o.material.emissiveMap = o.material.map;
            mats.push(o.material);
          }
        });
        const text = tr(st.label) || st.key;
        const lab = kit.label(text);
        lab.position.set(st.anchor[0], st.anchor[1] + 0.55, st.anchor[2]);
        spec.scene.add(lab); hitKey.set(lab, st.key);
        api.byKey[st.key] = { ...st, label: text, mats, lab };
      }
      spec.scene.traverse(o => { if (o.isMesh || o.isSprite) pickables.push(o); });

      // ---- movement, collision ----
      const cols = spec.colliders || [];
      const blocked = (x, z) => {
        if (x < b.x0 + RADIUS || x > b.x1 - RADIUS || z < b.z0 + RADIUS || z > b.z1 - RADIUS) return true;
        for (const [x0, z0, x1, z1] of cols) { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); if (dx * dx + dz * dz < RADIUS * RADIUS) return true; }
        return false;
      };
      const tryMove = (dx, dz) => {
        let moved = false;
        if (dx && !blocked(pos.x + dx, pos.z)) { pos.x += dx; moved = true; }
        if (dz && !blocked(pos.x, pos.z + dz)) { pos.z += dz; moved = true; }
        return moved;
      };
      for (const k of STATIONS) { const st = api.byKey[k]; if (st && st.view && blocked(st.view.pos[0], st.view.pos[2])) console.warn(`Rooms: "${track}" station "${k}" view position is blocked by a collider or the walls.`); }
      const keys = new Set();
      const MOVE = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
      lon(window, 'keydown', e => {
        const k = MOVE[e.key.toLowerCase()];
        if (!k || e.ctrlKey || e.metaKey || e.altKey || editable(e.target) || panel.contains(e.target) || (e.target !== document.body && !rootEl.contains(e.target) && e.target !== document.documentElement)) return;
        e.preventDefault(); keys.add(k); glide = null; clearTimeout(pendingOpen); hint.classList.add('is-gone');
      });
      lon(window, 'keyup', e => { const k = MOVE[e.key.toLowerCase()]; if (k) keys.delete(k); });
      lon(window, 'blur', () => keys.clear());

      // Glides: walk (straight line with collision) or view (fly to a station view, no collision).
      let glide = null;
      const lookAt = (from, to) => { const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
      const angDiff = (a, c) => { let d = (c - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
      api.glideTo = key => {
        const st = api.byKey[key]; if (!st) return 0;
        const [ty, tp] = lookAt(st.view.pos, st.view.target);
        const dist = pos.distanceTo(new T.Vector3(...st.view.pos));
        const dur = reducedMotion ? 0 : Math.min(1.1, 0.35 + dist / 7);
        glide = { type: 'view', t0: performance.now(), dur, from: pos.clone(), to: new T.Vector3(...st.view.pos), y0: yaw, dy: angDiff(yaw, ty), p0: pitch, p1: tp };
        if (!dur) { finishGlide(); return 0; }
        return Math.round(dur * 1000);
      };
      function finishGlide() { if (glide && glide.type === 'view') { pos.copy(glide.to); yaw = glide.y0 + glide.dy; pitch = glide.p1; } glide = null; apply(); }

      // ---- pointer: drag to look, click to pick ----
      let drag = null, hover = null;
      const ray = new T.Raycaster(), ndc = new T.Vector2(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0), hitP = new T.Vector3();
      ray.camera = camera;
      const cast = (cx, cy) => {
        const r = canvas.getBoundingClientRect();
        ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hits = ray.intersectObjects(pickables, false);
        for (const h of hits) { if (!h.object.visible) continue; let o = h.object; while (o && !hitKey.has(o)) o = o.parent; if (o) return { key: hitKey.get(o), dist: h.distance }; if (!h.object.isSprite) return { dist: h.distance }; }
        return { dist: Infinity };
      };
      lon(canvas, 'pointerdown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, id: e.pointerId }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ } });
      lon(canvas, 'pointermove', e => {
        if (drag && e.pointerId === drag.id) {
          if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
          if (drag.moved) { yaw -= (e.clientX - drag.x) * LOOK_RATE; pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch - (e.clientY - drag.y) * LOOK_RATE)); if (glide && glide.type === 'view') glide = null; clearTimeout(pendingOpen); hint.classList.add('is-gone'); }
          drag.x = e.clientX; drag.y = e.clientY; return;
        }
        if (e.pointerType === 'mouse') { const h = cast(e.clientX, e.clientY).key || null; if (h !== hover) { hover = h; canvas.style.cursor = h ? 'pointer' : ''; } }
      });
      const endDrag = e => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag; drag = null;
        if (d.moved || e.type === 'pointercancel' || performance.now() - d.t > 600) return;
        const hit = cast(e.clientX, e.clientY);
        if (hit.key) { visit(hit.key); return; }
        if (ray.ray.intersectPlane(floor, hitP) && ray.ray.origin.distanceTo(hitP) <= hit.dist + 0.05) {
          const tx = Math.max(b.x0 + RADIUS, Math.min(b.x1 - RADIUS, hitP.x)), tz = Math.max(b.z0 + RADIUS, Math.min(b.z1 - RADIUS, hitP.z));
          glide = { type: 'walk', tx, tz }; clearTimeout(pendingOpen); hint.classList.add('is-gone');
        }
      };
      lon(canvas, 'pointerup', endDrag); lon(canvas, 'pointercancel', endDrag);
      lon(canvas, 'pointerleave', () => { if (hover) { hover = null; canvas.style.cursor = ''; } });
      lon(canvas, 'webglcontextlost', e => { e.preventDefault(); toFallback('WebGL context lost'); });

      // ---- size ----
      const resize = () => {
        const w = rootEl.clientWidth, h = rootEl.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      resize();
      if (window.ResizeObserver) { const ro = new ResizeObserver(resize); ro.observe(rootEl); local.off.push(() => ro.disconnect()); } else lon(window, 'resize', resize);

      // ---- loop ----
      let last = performance.now(), clock = 0, tickBroken = false;
      const near = new T.Vector3(), fwd = new T.Vector3(), rel = new T.Vector3();
      // Labels keep a steady on-screen size: LABEL_PX tall up close, easing to LABEL_PX_FAR at a distance (cap height
      // about 14-17 px), fade out closer than ~1.5 m and hide while a panel is open (they would cover the view).
      const shown = [], scr = new T.Vector3();
      function sizeLabel(lab, hide) {
        const base = lab.userData.base || (lab.userData.base = lab.position.clone());
        lab.position.copy(base);
        rel.copy(lab.position).sub(pos);
        const depth = rel.dot(camera.getWorldDirection(fwd)), dist = rel.length(), vh = canvas.clientHeight || 1;
        const px = LABEL_PX - (LABEL_PX - LABEL_PX_FAR) * Math.max(0, Math.min(1, (depth - 3) / 11));
        const hw = Math.max(0.01, px * Math.max(depth, 0.1) * 2 * Math.tan(camera.fov * Math.PI / 360) / vh);
        lab.scale.set(hw * (lab.userData.aspect || 4), hw, 1);
        lab.material.opacity = hide ? 0 : Math.max(0, Math.min(1, (dist - 1.0) / 0.5));
        lab.visible = lab.material.opacity > 0.01;
        if (lab.visible && depth > 0.1) {
          scr.copy(base).project(camera);
          const sy = (1 - scr.y) / 2 * vh;
          shown.push({ lab, depth, x: (scr.x + 1) / 2 * canvas.clientWidth, y: sy, y0: sy, h: px, w: px * (lab.userData.aspect || 4), mPerPx: hw / px });
        }
      }
      // A farther label that would cover a nearer one moves up on screen until it clears (nearest labels stay put).
      function declutter() {
        shown.sort((a, b) => a.depth - b.depth);
        for (let i = 0; i < shown.length; i++) {
          const L = shown[i];
          for (let pass = 0; pass < 4; pass++) {
            let moved = false;
            for (let j = 0; j < i; j++) {
              const P = shown[j];
              if (Math.abs(L.x - P.x) * 2 < L.w + P.w && Math.abs(L.y - P.y) * 2 < L.h + P.h) { L.y = P.y - (L.h + P.h) / 2 - 3; moved = true; }
            }
            if (!moved) break;
          }
          if (L.y0 - L.y > 0.5) L.lab.position.y = L.lab.userData.base.y + (L.y0 - L.y) * L.mPerPx;
        }
        shown.length = 0;
      }
      function frame(now) {
        local.raf = 0; if (disposed) return;
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; clock += dt;
        if (keys.size) {
          const f = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0), s = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
          if (f || s) {
            const len = Math.hypot(f, s), sp = SPEED * dt / len, sy = Math.sin(yaw), cy = Math.cos(yaw);
            tryMove((-sy * f + cy * s) * sp, (-cy * f - sy * s) * sp);
          }
        } else if (glide && glide.type === 'walk') {
          const dx = glide.tx - pos.x, dz = glide.tz - pos.z, d = Math.hypot(dx, dz), st = Math.min(d, SPEED * dt);
          if (d < 0.02 || !tryMove(dx / d * st, dz / d * st)) glide = null;
        } else if (glide && glide.type === 'view') {
          // Wall-clock, so a slow GPU still arrives when the panel opens.
          const k = Math.min(1, Math.max(0, (now - glide.t0) / 1000 / glide.dur)), e = k * k * (3 - 2 * k);
          pos.lerpVectors(glide.from, glide.to, e); yaw = glide.y0 + glide.dy * e; pitch = glide.p0 + (glide.p1 - glide.p0) * e;
          if (k >= 1) finishGlide();
        }
        if (!(glide && glide.type === 'view') && Math.abs(pos.y - EYE) > 1e-4) pos.y += (EYE - pos.y) * Math.min(1, dt * 4);
        apply();
        // Glow: gentle pulse, brighter on hover, when near, and for the open station.
        for (const k of STATIONS) {
          const st = api.byKey[k]; if (!st) continue;
          near.set(...st.anchor);
          const dist = near.distanceTo(pos), base = reducedMotion ? 0.14 : 0.06 + 0.14 * (0.5 + 0.5 * Math.sin(clock * 2.4 + STATIONS.indexOf(k)));
          const v = k === hover || k === station ? 0.42 : dist < 2.4 ? 0.26 : base;
          for (const m of st.mats) m.emissiveIntensity = v;
          sizeLabel(st.lab, station !== 'none');
        }
        declutter();
        if (spec.tick && !tickBroken) { try { spec.tick(dt); } catch (err) { tickBroken = true; console.error('Rooms: room tick failed', err); } }
        renderer.render(scene, camera);
        if (!document.hidden) local.raf = window.requestAnimationFrame(frame);
      }
      lon(document, 'visibilitychange', () => { if (!document.hidden && !local.raf && !disposed) { last = performance.now(); local.raf = window.requestAnimationFrame(frame); } });
      frame(performance.now());

      handle._debug = {
        cameraPos: () => [pos.x, pos.y, pos.z],
        project(key) {
          const st = api.byKey[key]; if (!st) return null;
          const v = new T.Vector3(...st.anchor).project(camera), r = canvas.getBoundingClientRect();
          return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
        },
        info: () => renderer.info,
        // Station labels as drawn: projected height in CSS px, centre, and whether they show.
        labels() {
          const r = canvas.getBoundingClientRect(), up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
          return STATIONS.filter(k => api.byKey[k]).map(k => {
            const lab = api.byKey[k].lab, half = up.clone().multiplyScalar(lab.scale.y / 2);
            const a = lab.position.clone().add(half).project(camera), c = lab.position.clone().sub(half).project(camera), m = lab.position.clone().project(camera);
            const hh = Math.abs(a.y - c.y) / 2 * r.height;
            return { key: k, visible: lab.visible && lab.material.opacity > 0.01, h: +hh.toFixed(1), w: Math.round(hh * (lab.userData.aspect || 1)), x: Math.round(r.left + (m.x + 1) / 2 * r.width), y: Math.round(r.top + (1 - m.y) / 2 * r.height) };
          });
        },
      };
      api.dispose = () => {
        cancelAnimationFrame(local.raf); local.raf = 0;
        local.off.forEach(f => f()); local.off.length = 0;
        if (spec.dispose) { try { spec.dispose(); } catch (err) { console.warn('Rooms: room dispose failed', err); } }
        const seen = new Set();
        scene.traverse(o => {
          if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
          for (const m of [].concat(o.material || [])) {
            if (seen.has(m)) continue; seen.add(m);
            for (const v of Object.values(m)) if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); }
            m.dispose();
          }
        });
        renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
        handle._debug = { cameraPos: () => null, project: () => null, info: () => null, labels: () => null };
      };
      return api;
    }

    function toFallback(why) {
      if (!g3) return;
      console.warn('Rooms: switching to the panel list.', why);
      const g = g3; g3 = null; try { g.dispose(); } catch (_) { /* context already gone */ }
      rootEl.classList.add('room-fallback'); setStatus('fallback');
    }

    function dispose() {
      if (disposed) return;
      disposed = true; clearTimeout(pendingOpen);
      if (g3) { try { g3.dispose(); } catch (e) { console.warn('Rooms: dispose failed', e); } g3 = null; }
      domOff.forEach(f => f()); domOff.length = 0;
      if (live.get(host) === handle) live.delete(host);
      // The panels belong to the app: take them out of the slots first, so they survive (detached, listeners and
      // typed values intact) instead of going away with the room.
      for (const s of STATIONS) slots[s].replaceChildren();
      rootEl.remove();
      handle.status = 'disposed';
    }
    return handle;
  }

  window.Rooms = {
    STATIONS: STATIONS.slice(),
    supported,
    define(track, build) { builders[track] = build; },
    mount,
    kit,
  };
})();
