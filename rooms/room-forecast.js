// Room "forecast": the finished-goods warehouse and dispatch dock at Rybex Mirszyce. Pallet racks full of boxed cans
// (cartons printed with data.products, packshots when given as data.packshots), two dock doors (one with a trailer
// docked, one half open to the yard), staged pallets in marked lanes, and the planner's corner.
// Stations: brief = dispatch clipboard at the dock, data = sales-history screen and binder, method = planner
// whiteboard, experiment = planner workstation, results = wall chart over the dock (draws data.monthly as history,
// the forecast months stay empty: they come from the experiments).
// Classic script; needs rooms/engine.js (window.Rooms) first.
(function () {
  'use strict';
  if (!window.Rooms) return;
  const W = 20, D = 14, H = 8; // x -10..10, z -7..7, roof at 8
  const BAY = 2.55, LEVELS = [0, 1.72, 3.44, 5.16], RACK_H = 6.2, RACK_D = 1.1;
  const DOORS = [3.2, 6.9], DOOR_W = 3.0, DOOR_H = 3.2;

  Rooms.define('forecast', ({ THREE: T, kit, lang, data, reducedMotion }) => {
    const tx = (pl, en) => lang === 'en' ? en : pl;
    const tex = kit.tex, g = new T.Group();
    const d = (data && data.forecast) || data || {};
    const products = (Array.isArray(d.products) ? d.products : []).map(String).filter(Boolean).slice(0, 6);
    const names = products.length ? products : [tx('Konserwy rybne', 'Canned fish')];
    const monthly = (Array.isArray(d.monthly) ? d.monthly : []).map(Number).filter(Number.isFinite);
    const usable = src => typeof src === 'string' && (location.protocol !== 'file:' || /^data:image\//.test(src));
    const shots = (Array.isArray(d.packshots) ? d.packshots : []).slice(0, names.length).map(s => usable(s) ? s : null);
    const PROD_COL = ['#b3261e', '#2f6f3a', '#c78f12', '#1f5f9e', '#7a4fa0', '#5b6770'];
    const cartonBase = cartonBaseCanvas();

    const M = {
      floor: kit.mat(0xb9bab3, { map: kit.tile(tex.concrete(), W / 2.2, D / 2.2), rough: 0.6, roughMap: [W / 3.7, D / 3.7] }), // sealed concrete, polished by the forklift lanes
      wall: kit.mat(0xf0eee8, { map: tex.paintedWall('#e4e2da'), rough: 0.9, bump: 1.2 }),
      clad: kit.mat(0xe2e5e6, { map: tex.cladding('#d6dadb'), rough: 0.6, metal: 0.15 }),
      roof: kit.mat(0xa4a9ab, { map: tex.cladding('#c4c8ca'), rough: 0.7, metal: 0.1 }),
      frame: kit.mat(0x4d5d6b, { rough: 0.5, metal: 0.35 }),
      upright: kit.mat(0x1f5f9e, { rough: 0.34, metal: 0.2 }),          // powder-coated racking
      beam: kit.mat(0xe8731c, { rough: 0.34, metal: 0.2 }),
      galv: kit.mat(0xb9bec0, { map: tex.brushedSteel(), rough: 0.5, metal: 0.6 }),
      yellow: kit.mat(0xf0bf00, { rough: 0.5 }),
      green: kit.mat(0x2f8f47, { rough: 0.55 }),
      hazard: kit.mat(0xffffff, { map: tex.hazard(), rough: 0.5 }),
      black: kit.mat(0x1d1e1f, { rough: 0.84 }),
      dark: kit.mat(0x2a2d30, { rough: 0.38 }),
      white: kit.mat(0xf2f2ef, { rough: 0.5 }),
      wood: kit.mat(0xc49a63, { map: tex.cardboard(), rough: 0.85 }),
      carton: kit.mat(0xffffff, { map: tex.cardboard(), rough: 0.85 }),
      desk: kit.mat(0xffffff, { map: tex.wood('#cdb38c'), rough: 0.55 }),
      grey: kit.mat(0x8f969b, { rough: 0.45, metal: 0.45 }),
      seat: kit.mat(0x2b2e33, { rough: 0.85 }),
      lamp: new T.MeshBasicMaterial({ color: 0xfffaf0, toneMapped: false }),
      sky: new T.MeshBasicMaterial({ color: 0xffffff, map: yardTex(), fog: false }),
      film: new T.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.15, transparent: true, opacity: 0.22, depthWrite: false }),
    };

    // ---- shell: floor, walls (blockwork below, cladding above), roof with skylights, portal frames ----
    kit.plane(g, [W, D], [0, 0, 0], [-Math.PI / 2, 0, 0], M.floor);
    const LOW = 3.6;
    const walls = kit.batch(g, M.wall, { uv: 1 / 1.6 }), clad = kit.batch(g, M.clad, { uv: 0.5 });
    walls.box([0.2, LOW, D], [-W / 2 - 0.1, LOW / 2, 0]).box([0.2, LOW, D], [W / 2 + 0.1, LOW / 2, 0]);
    clad.box([0.1, H - LOW, D], [-W / 2 - 0.05, LOW + (H - LOW) / 2, 0]).box([0.1, H - LOW, D], [W / 2 + 0.05, LOW + (H - LOW) / 2, 0]);
    // front wall (z = 7) with a personnel door at x -5..-4
    walls.box([5.0, LOW, 0.2], [-7.5, LOW / 2, D / 2 + 0.1]).box([14.0, LOW, 0.2], [3.0, LOW / 2, D / 2 + 0.1]).box([1.0, LOW - 2.1, 0.2], [-4.5, 2.1 + (LOW - 2.1) / 2, D / 2 + 0.1]);
    clad.box([W, H - LOW, 0.1], [0, LOW + (H - LOW) / 2, D / 2 + 0.05]);
    // back wall (z = -7) with the two dock openings
    let xPrev = -W / 2;
    for (const xc of DOORS) { const x0 = xc - DOOR_W / 2; walls.box([x0 - xPrev, LOW, 0.2], [(xPrev + x0) / 2, LOW / 2, -D / 2 - 0.1]); walls.box([DOOR_W, LOW - DOOR_H, 0.2], [xc, DOOR_H + (LOW - DOOR_H) / 2, -D / 2 - 0.1]); xPrev = xc + DOOR_W / 2; }
    walls.box([W / 2 - xPrev, LOW, 0.2], [(xPrev + W / 2) / 2, LOW / 2, -D / 2 - 0.1]);
    clad.box([W, H - LOW, 0.1], [0, LOW + (H - LOW) / 2, -D / 2 - 0.05]);
    walls.done(); clad.done();
    kit.batch(g, M.roof, { uv: 0.5 }).box([W + 0.6, 0.12, D + 0.6], [0, H + 0.06, 0]).done();
    const sky = kit.batch(g, M.lamp, { shadow: false, receive: false });
    for (const x of [-6, 0, 6]) sky.box([1.2, 0.02, D - 2], [x, H - 0.005, 0]);
    sky.done();
    const steel = kit.batch(g, M.frame, { uv: 1 });
    for (const x of [-7.5, -2.5, 2.5, 7.5]) {
      for (const z of [-D / 2 + 0.17, D / 2 - 0.17]) steel.box([0.3, H, 0.012], [x, H / 2, z]).box([0.012, H, 0.3], [x - 0.15, H / 2, z]).box([0.012, H, 0.3], [x + 0.15, H / 2, z]);
      steel.box([0.22, 0.6, D], [x, H - 0.35, 0]);
    }
    for (let z = -6; z <= 6; z += 3) steel.box([W, 0.16, 0.08], [0, H - 0.1, z]);
    steel.done();
    // high-bay lights: round domes on cables (instanced)
    const bayLamps = [];
    for (const x of [-7.5, -2.5, 2.5, 7.5]) for (const z of [-4.5, -1.5, 1.5, 4.5]) bayLamps.push({ p: [x + 1.25, 6.9, z] });
    kit.inst(g, new T.CylinderGeometry(0.22, 0.32, 0.25, 20), M.galv, bayLamps, { shadow: false });
    kit.inst(g, new T.CircleGeometry(0.3, 20).rotateX(Math.PI / 2), M.lamp, bayLamps.map(l => ({ p: [l.p[0], l.p[1] - 0.126, l.p[2]] })), { shadow: false });
    const cables = kit.batch(g, M.black, { shadow: false });
    bayLamps.forEach(l => cables.rod([l.p[0], l.p[1] + 0.12, l.p[2]], [l.p[0], H, l.p[2]], 0.006, 4));
    cables.done();

    // ---- floor markings: aisle lines, pedestrian walkway from the door, dock lanes, planner zone ----
    const paint = kit.batch(g, M.yellow, { shadow: false }), walkG = kit.batch(g, M.green, { shadow: false });
    const line = (b, x0, z0, x1, z1, w = 0.1) => b.box([Math.abs(x1 - x0) || w, 0.004, Math.abs(z1 - z0) || w], [(x0 + x1) / 2, 0.002, (z0 + z1) / 2]);
    line(paint, -8.75, 3.2, -8.75, -4.7); line(paint, -5.05, 3.2, -5.05, -4.7); line(paint, -7.55, 3.2, -7.55, -4.7);
    line(paint, -9.8, -5.65, 0.9, -5.65); line(paint, 8.75, -3.9, 8.75, 3.9);
    for (const xc of DOORS) { line(paint, xc - 1.35, -6.9, xc - 1.35, -3.6); line(paint, xc + 1.35, -6.9, xc + 1.35, -3.6); }
    line(paint, 1.5, -3.6, 8.6, -3.6);
    line(walkG, -5.2, 6.9, -5.2, 4.1, 0.12); line(walkG, -3.8, 6.9, -3.8, 4.1, 0.12); line(walkG, -5.2, 4.1, 9.5, 4.1, 0.12); line(walkG, -3.8, 4.9, 9.5, 4.9, 0.12);
    paint.done(); walkG.done();
    const zebra = kit.batch(g, kit.mat(0xf2f2ee, { rough: 0.6 }), { shadow: false });
    for (let k = 0; k < 6; k++) zebra.box([1.2, 0.004, 0.22], [-4.5, 0.003, 6.6 - k * 0.45]);
    zebra.done();
    // planner zone: a blue-edged rectangle, "lane" numbers at the dock
    const blueL = kit.batch(g, kit.mat(0x1f5f9e, { rough: 0.6 }), { shadow: false });
    line(blueL, 0.6, -2.0, 5.0, -2.0); line(blueL, 0.6, 3.6, 5.0, 3.6); line(blueL, 0.6, -2.0, 0.6, 3.6); line(blueL, 5.0, -2.0, 5.0, 3.6);
    blueL.done();
    DOORS.forEach((xc, i) => kit.plane(g, [0.9, 0.9], [xc, 0.004, -4.3], [-Math.PI / 2, 0, 0], new T.MeshStandardMaterial({ map: kit.canvasTexture(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#f0bf00'; c.font = '800 96px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), w / 2, h / 2 + 6); }), transparent: true, roughness: 0.6 })).castShadow = false);
    // floor wear (tyre marks of pallet trucks toward the dock), one transparent overlay
    const wear = kit.canvasTexture(1024, 717, (c, w, h) => {
      const r = kit.rng(9), X = x => (x + W / 2) * w / W, Z = z => (z + D / 2) * h / D;
      c.lineCap = 'round';
      for (let k = 0; k < 10; k++) { c.strokeStyle = `rgba(25,25,25,${0.06 + r() * 0.08})`; c.lineWidth = 5 + r() * 5; c.beginPath(); const x0 = -2 + r() * 6; c.moveTo(X(x0), Z(5)); c.bezierCurveTo(X(x0 + 1), Z(1), X(DOORS[k % 2] - 1 + r() * 2), Z(-2), X(DOORS[k % 2] - 0.6 + r() * 1.2), Z(-6.9)); c.stroke(); }
      for (const xc of DOORS) { const gr = c.createRadialGradient(X(xc), Z(-6.4), 0, X(xc), Z(-6.4), 70); gr.addColorStop(0, 'rgba(30,30,30,.2)'); gr.addColorStop(1, 'rgba(30,30,30,0)'); c.fillStyle = gr; c.fillRect(X(xc) - 70, Z(-6.4) - 70, 140, 140); }
    });
    kit.plane(g, [W, D], [0, 0.003, 0], [-Math.PI / 2, 0, 0], new T.MeshStandardMaterial({ map: wear, transparent: true, depthWrite: false, roughness: 0.4 })).renderOrder = 1;

    // ---- carton faces per product: a grid of printed cartons and a pallet label (packshot when loaded) ----
    const shotImgs = shots.map(s => s ? new Image() : null);
    const faceTex = names.map((name, i) => {
      const col = PROD_COL[i % PROD_COL.length];
      const draw = (c, w, h) => {
        c.drawImage(cartonBase, 0, 0, w, h);
        for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 4; cy++) {
          const x = cx * w / 2, y = cy * h / 4;
          c.fillStyle = 'rgba(70,45,20,.35)'; c.fillRect(x, y, w / 2, 3); c.fillRect(x, y, 3, h / 4);
          c.fillStyle = col; c.fillRect(x + 14, y + 16, w / 2 - 28, 30);
          c.fillStyle = '#fff'; c.font = '800 20px Raleway, system-ui'; c.fillText('RYBEX', x + 22, y + 39);
          c.fillStyle = '#3a2a16'; c.font = '600 15px Raleway, system-ui'; let t = name; while (c.measureText(t).width > w / 2 - 30 && t.length > 4) t = t.slice(0, -1); c.fillText(t, x + 16, y + 68);
          c.font = '600 13px Raleway, system-ui'; c.fillText(tx('24 × 170 g', '24 × 170 g'), x + 16, y + 88);
        }
        // pallet label (A5) with product, barcode and the packshot when loaded
        c.fillStyle = '#fff'; c.fillRect(w * 0.27, h * 0.36, w * 0.46, h * 0.3); c.strokeStyle = '#1c1917'; c.lineWidth = 2; c.strokeRect(w * 0.27, h * 0.36, w * 0.46, h * 0.3);
        const im = shotImgs[i];
        if (im && im.complete && im.naturalWidth) { const s = Math.min((w * 0.16) / im.naturalWidth, (h * 0.26) / im.naturalHeight); c.drawImage(im, w * 0.285, h * 0.375, im.naturalWidth * s, im.naturalHeight * s); }
        else { c.fillStyle = col; c.fillRect(w * 0.29, h * 0.39, w * 0.12, h * 0.2); }
        c.fillStyle = '#1c1917'; c.font = '800 19px Raleway, system-ui'; let t = name; while (c.measureText(t).width > w * 0.27 && t.length > 4) t = t.slice(0, -1);
        c.fillText(t.split(' ').slice(0, 2).join(' '), w * 0.46, h * 0.43); c.font = '600 16px Raleway, system-ui'; c.fillText(t.split(' ').slice(2).join(' '), w * 0.46, h * 0.475);
        for (let k = 0; k < 34; k++) { c.fillStyle = k % 3 ? '#1c1917' : '#fff'; c.fillRect(w * 0.46 + k * 3.4, h * 0.52, (k % 4) + 1, h * 0.09); }
      };
      return tex.screen(draw, { w: 512, h: 640 });
    });
    shotImgs.forEach((im, i) => { if (im) { im.onload = () => faceTex[i].redraw(); im.src = shots[i]; } });
    const sideMat = kit.mat(0xffffff, { map: kit.canvasTexture(256, 320, (c, w, h) => { c.drawImage(cartonBase, 0, 0, w, h); c.fillStyle = 'rgba(70,45,20,.35)'; for (let k = 1; k < 4; k++) c.fillRect(0, k * h / 4, w, 3); c.fillRect(w / 2, 0, 3, h); }), rough: 0.85 });
    const topMat = kit.mat(0xffffff, { map: tex.cardboard(), rough: 0.85 });
    const loadMats = faceTex.map(t => { const f = kit.mat(0xffffff, { map: t, rough: 0.8 }); return [sideMat, sideMat, topMat, topMat, f, f]; });

    // ---- racks ----
    const palletGeo = (() => { const parts = []; const b = { box: (s, p) => { const geo = new T.BoxGeometry(...s); geo.translate(...p); parts.push(geo); return b; } }; kit.prop.pallet(b, [0, 0], 0); const geo = kit.merge(parts); geo.rotateY(Math.PI / 2); return geo; })(); // 0.8 wide (x), 1.2 deep (z)
    const loadGeo = new T.BoxGeometry(1, 1, 1);
    const upr = kit.batch(g, M.upright), bm = kit.batch(g, M.beam, { shadow: false });
    const pallets = [], loads = names.map(() => []), rnd = kit.rng(41);
    let prodK = 0;
    // A run of `bays` bays; origin = centre of the front face at floor level, local +z towards the aisle.
    const rackRun = (x, z, rotY, bays, { fill = 0.85, skip = () => false } = {}) => {
      const at = kit.frameAt(x, z, rotY), L = bays * BAY, r = [0, rotY, 0];
      for (let i = 0; i <= bays; i++) {
        const lx = -L / 2 + i * BAY;
        for (const lz of [-0.05, -RACK_D + 0.05]) upr.box([0.09, RACK_H, 0.08], at(lx, RACK_H / 2, lz), r);
        for (let y = 0.4; y < RACK_H - 0.3; y += 1.1) upr.rod(at(lx, y, -0.05), at(lx, y + 0.55, -RACK_D + 0.05), 0.012, 4).rod(at(lx, y + 0.55, -RACK_D + 0.05), at(lx, y + 1.1, -0.05), 0.012, 4);
        upr.box([0.12, 0.01, RACK_D], at(lx, 0.005, -RACK_D / 2), r);
      }
      for (let i = 0; i < bays; i++) {
        const bx = -L / 2 + (i + 0.5) * BAY;
        for (const y of LEVELS.slice(1)) for (const lz of [-0.05, -RACK_D + 0.05]) bm.box([BAY - 0.09, 0.12, 0.05], at(bx, y - 0.06, lz), r);
        for (const [li, y] of LEVELS.entries()) for (const sx of [-0.84, 0, 0.84]) {
          if (rnd() > fill || skip(i, li, sx)) continue;
          const p = at(bx + sx, y, -RACK_D / 2);
          pallets.push({ p, r: [0, rotY, 0] });
          const hgt = 0.95 + rnd() * 0.25, k = prodK++ % names.length;
          loads[k].push({ p: at(bx + sx, y + 0.144 + hgt / 2, -RACK_D / 2), r: [0, rotY, 0], s: [0.8, hgt, 1.2] });
        }
      }
    };
    const RZ = -0.8; // racks along z, centred here
    rackRun(-W / 2 + RACK_D + 0.02, RZ, Math.PI / 2, 3);                       // wall run, faces +x
    rackRun(-5.2, RZ, Math.PI / 2, 3);                                          // double run, east face
    rackRun(-7.4, RZ, -Math.PI / 2, 3);                                         // double run, west face
    rackRun(-3.0, -5.85, 0, 3, { fill: 0.8 });                                   // along the back wall, faces +z
    rackRun(W / 2 - RACK_D - 0.02, 0.0, -Math.PI / 2, 3, { fill: 0.8 });         // right wall, faces -x
    upr.done(); bm.done();
    // pallets and cartons: instanced, one draw call per product
    kit.inst(g, palletGeo, M.wood, pallets, { shadow: true });
    loads.forEach((list, k) => { if (list.length) kit.inst(g, loadGeo, loadMats[k], list, { shadow: true }); });
    // rack end signs (aisle letters)
    [['A', -W / 2 + 0.6, RZ + 3.9], ['B', -6.3, RZ + 3.9]].forEach(([t, x, z]) => kit.plane(g, [0.5, 0.5], [x, 6.4, z + 0.02], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 90px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, w / 2, h / 2 + 6); }), rough: 0.5 })));
    // column guards at the rack ends (hazard)
    const guard = kit.batch(g, M.hazard, { uv: 2.5 });
    for (const x of [-5.25, -7.35, -W / 2 + RACK_D - 0.03]) guard.box([0.18, 0.4, 0.18], [x + (x < -8 ? 0 : 0), 0.2, RZ + 3 * BAY / 2 + 0.12]);
    guard.done();

    // ---- dock: door A open with a trailer docked, door B half open to the yard ----
    const dock = kit.batch(g, M.black), dSteel = kit.batch(g, M.galv, { uv: 1 });
    const sectionalTex = kit.canvasTexture(256, 256, (c, w, h) => { c.fillStyle = '#d8dcdd'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(0, y + 3, w, 2); for (let x = 0; x < w; x += 32) { c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(x, y + 10, 2, 44); } } });
    DOORS.forEach((xc, i) => {
      // rubber shelter around the opening, leveler plate, bumpers, the raised door panel under the lintel
      dock.box([0.25, DOOR_H + 0.3, 0.3], [xc - DOOR_W / 2 - 0.12, (DOOR_H + 0.3) / 2, -D / 2 + 0.15]).box([0.25, DOOR_H + 0.3, 0.3], [xc + DOOR_W / 2 + 0.12, (DOOR_H + 0.3) / 2, -D / 2 + 0.15]).box([DOOR_W + 0.5, 0.3, 0.3], [xc, DOOR_H + 0.15, -D / 2 + 0.15]);
      dock.box([0.25, 0.3, 0.14], [xc - 1.1, 0.35, -D / 2 + 0.07]).box([0.25, 0.3, 0.14], [xc + 1.1, 0.35, -D / 2 + 0.07]);
      dSteel.box([2.2, 0.03, 2.4], [xc, 0.015, -D / 2 + 1.2]);
      const open = i === 0 ? 1 : 0.62, shut = DOOR_H * (1 - open);
      kit.box(g, [DOOR_W, 0.5, 0.06], [xc, DOOR_H - 0.25, -D / 2 - 0.25], kit.mat(0xffffff, { map: kit.tile(sectionalTex, 3, 0.5), rough: 0.5, metal: 0.3 })); // rolled-up panels
      if (shut > 0.05) kit.box(g, [DOOR_W, shut, 0.05], [xc, DOOR_H - shut / 2 - 0.5, -D / 2 - 0.15], kit.mat(0xffffff, { map: kit.tile(sectionalTex, 3, shut / 1.0), rough: 0.5, metal: 0.3 }));
      // traffic light and dock number
      dock.box([0.16, 0.36, 0.1], [xc + DOOR_W / 2 + 0.45, 2.0, -D / 2 + 0.05]);
      const lit = new T.Mesh(new T.CircleGeometry(0.05, 16), new T.MeshBasicMaterial({ color: i === 0 ? 0x2fd15a : 0xd02a20, toneMapped: false }));
      lit.position.set(xc + DOOR_W / 2 + 0.45, i === 0 ? 1.91 : 2.09, -D / 2 + 0.105); g.add(lit);
      kit.plane(g, [0.9, 0.4], [xc, DOOR_H + 0.6, -D / 2 + 0.31], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(256, 112, (c, w, h) => { c.fillStyle = '#1c1917'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0bf00'; c.font = '800 60px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('DOK ', 'DOCK ') + (i + 1), w / 2, h / 2 + 4); }), rough: 0.5 }));
    });
    dock.done(); dSteel.done();
    // trailer docked at door A: interior (dark, seen from inside) with two pallets loaded
    const trailer = kit.batch(g, kit.mat(0x5d6266, { rough: 0.7, metal: 0.3 }), { shadow: false });
    const TX = DOORS[0], tz0 = -D / 2 - 0.3, TL = 6;
    trailer.box([2.5, 0.05, TL], [TX, 0.02, tz0 - TL / 2]).box([0.05, 2.7, TL], [TX - 1.25, 1.35, tz0 - TL / 2]).box([0.05, 2.7, TL], [TX + 1.25, 1.35, tz0 - TL / 2]).box([2.5, 0.05, TL], [TX, 2.7, tz0 - TL / 2]).box([2.5, 2.7, 0.05], [TX, 1.35, tz0 - TL]);
    trailer.done();
    kit.inst(g, palletGeo, M.wood, [{ p: [TX - 0.5, 0.05, tz0 - TL + 0.7], r: [0, 0, 0] }, { p: [TX + 0.5, 0.05, tz0 - TL + 0.7], r: [0, 0, 0] }], { shadow: false });
    kit.inst(g, loadGeo, loadMats[0], [{ p: [TX - 0.5, 0.05 + 0.144 + 0.55, tz0 - TL + 0.7], s: [0.8, 1.1, 1.2] }, { p: [TX + 0.5, 0.05 + 0.144 + 0.55, tz0 - TL + 0.7], s: [0.8, 1.1, 1.2] }].map(l => ({ ...l, r: [0, Math.PI, 0] })), { shadow: false });
    const tLamp = new T.PointLight(0xfff1dc, 3, 6, 2); tLamp.position.set(TX, 2.4, tz0 - 2); g.add(tLamp);
    // the yard outside door B (and the sky above the trailer)
    kit.plane(g, [40, 16], [0, 5, -D / 2 - 14], [0, 0, 0], M.sky);
    kit.plane(g, [40, 14], [0, -0.01, -D / 2 - 7], [-Math.PI / 2, 0, 0], kit.mat(0x8c8e88, { map: kit.tile(tex.concrete(), 10, 4), rough: 0.8 }));

    // ---- staged pallets in the dock lanes, wrapped in film ----
    const staged = [[DOORS[1] - 0.5, -5.1], [DOORS[1] + 0.5, -5.1], [DOORS[1] - 0.5, -4.2], [DOORS[0] + 0.6, -5.6], [5.05, -4.4]];
    const stagedLoads = names.map(() => []);
    staged.forEach(([x, z], i) => { const hgt = 1.15 + (i % 2) * 0.15; stagedLoads[i % names.length].push({ p: [x, 0.144 + hgt / 2, z], r: [0, Math.PI / 2 * (i % 2 ? 0 : 0), 0], s: [0.8, hgt, 1.2] }); });
    kit.inst(g, palletGeo, M.wood, staged.map(([x, z]) => ({ p: [x, 0, z] })), { shadow: true });
    stagedLoads.forEach((list, k) => { if (list.length) kit.inst(g, loadGeo, loadMats[k], list, { shadow: true }); });
    const film = kit.batch(g, M.film, { shadow: false, receive: false });
    staged.forEach(([x, z], i) => { const hgt = 1.15 + (i % 2) * 0.15; film.box([0.84, hgt + 0.06, 1.24], [x, 0.144 + (hgt + 0.06) / 2, z]); });
    film.done();
    // empty pallet stack and a pallet truck by the wall
    const wood = kit.batch(g, M.wood, { uv: 2 });
    for (let k = 0; k < 8; k++) kit.prop.pallet({ box: (s, p, r) => wood.box(s, [p[0], p[1] + k * 0.145, p[2]], r) }, [-0.4, -6.35], 0);
    const jack = kit.batch(g, M.yellow);
    jack.box([0.16, 0.06, 1.15], [-1.2, 0.05, -4.6]).box([0.16, 0.06, 1.15], [-0.8, 0.05, -4.6]).box([0.6, 0.35, 0.25], [-1.0, 0.2, -3.95]).rod([-1.0, 0.35, -3.9], [-1.0, 1.15, -3.45], 0.02, 8).rod([-1.2, 1.15, -3.45], [-0.8, 1.15, -3.45], 0.02, 8);
    jack.done();

    // ---- batches for the stations ----
    const desk = kit.batch(g, M.desk, { uv: 1 }), grey = kit.batch(g, M.grey), dark = kit.batch(g, M.dark), seat = kit.batch(g, M.seat), white = kit.batch(g, M.white);

    // ---- STATION brief: the dispatch stand at dock 1 with a clipboard ----
    const BX = 1.9, BZ = -4.55;
    const disp = new T.Group(); disp.position.set(BX, 0, BZ); disp.rotation.y = -0.4; g.add(disp);
    const dS = kit.batch(disp, M.galv, { uv: 1 }), dD = kit.batch(disp, M.dark);
    dS.box([0.62, 0.035, 0.5], [0, 1.1, 0], [0.6, 0, 0]).box([0.06, 0.98, 0.06], [0, 0.49, 0.05]).box([0.5, 0.03, 0.45], [0, 0.015, 0.05]).box([0.6, 0.02, 0.35], [0, 0.55, 0.05]);
    dD.box([0.22, 0.14, 0.2], [-0.18, 0.64, 0.05]).box([0.08, 0.04, 0.16], [0.2, 0.58, 0.05]);    // label printer, scanner
    dS.done(); dD.done();
    const drawClip = (c, w, h) => {
      c.fillStyle = '#8a5a2b'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 40, w - 32, h - 56);
      c.fillStyle = '#9aa0a5'; c.fillRect(w / 2 - 60, 8, 120, 46);
      c.fillStyle = '#1c1917'; c.font = '800 24px Raleway, system-ui'; c.fillText(tx('PLAN WYSYŁEK', 'DISPATCH PLAN'), 32, 90);
      c.font = '600 15px Raleway, system-ui'; c.fillStyle = '#5b5a56'; c.fillText(tx('Dok 1 · zmiana A', 'Dock 1 · shift A'), 32, 116);
      names.slice(0, 5).forEach((n, i) => { const y = 150 + i * 46; c.fillStyle = PROD_COL[i % PROD_COL.length]; c.fillRect(32, y - 16, 10, 22); c.fillStyle = '#1c1917'; c.font = '600 17px Raleway, system-ui'; let t = n; while (c.measureText(t).width > w - 150 && t.length > 4) t = t.slice(0, -1); c.fillText(t, 50, y); c.strokeStyle = '#c4c8cc'; c.lineWidth = 2; c.strokeRect(w - 80, y - 18, 40, 24); });
      c.fillStyle = '#c0392b'; c.font = '700 17px Raleway, system-ui'; c.fillText(tx('Grudzień: czy wystarczy?', 'December: enough stock?'), 32, h - 40);
    };
    const clip = kit.plane(disp, [0.33, 0.46], [0, 1.1 + 0.825 * 0.022, 0.565 * 0.022], [-Math.PI / 2 + 0.6, 0, 0], kit.mat(0xffffff, { map: tex.screen(drawClip, { w: 360, h: 504 }), rough: 0.6 }));
    clip.castShadow = false;
    kit.box(disp, [1.1, 0.26, 0.02], [0, 2.35, 0.05], kit.mat(0xffffff, { map: kit.canvasTexture(440, 104, (c, w, h) => { c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 46px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('WYSYŁKA', 'DISPATCH'), w / 2, h / 2 + 3); }), rough: 0.5 }));
    kit.batch(disp, M.galv, { shadow: false }).rod([-0.45, 2.48, 0.05], [-0.45, H, 0.05], 0.006, 4).rod([0.45, 2.48, 0.05], [0.45, H, 0.05], 0.006, 4).done();

    // ---- STATION data: sales history on a screen trolley, the sales binder on its shelf ----
    const SX = -3.05, SZ = -0.2;
    const sales = new T.Group(); sales.position.set(SX, 0, SZ); sales.rotation.y = 0.75; g.add(sales);
    const sG = kit.batch(sales, M.grey), sD = kit.batch(sales, M.dark);
    sG.box([0.9, 0.04, 0.6], [0, 0.12, 0]).box([0.08, 1.45, 0.08], [0, 0.85, -0.1]).box([0.8, 0.03, 0.4], [0, 0.85, 0.02]);
    for (const x of [-0.38, 0.38]) for (const z of [-0.24, 0.24]) sG.cyl(0.05, 0.05, 0.06, [x, 0.05, z], [0, 0, Math.PI / 2], 12);
    sD.box([1.3, 0.78, 0.06], [0, 1.72, -0.06]);
    sG.done(); sD.done();
    const drawSales = (c, w, h) => {
      c.fillStyle = '#f4f6f7'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, 54);
      c.fillStyle = '#fff'; c.font = '700 28px Raleway, system-ui'; c.fillText(tx('Historia sprzedaży · miesiące', 'Sales history · months'), 18, 37);
      const x0 = 70, y0 = h - 70, x1 = w - 24, y1 = 84;
      c.strokeStyle = '#9aa5ad'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y1); c.lineTo(x0, y0); c.lineTo(x1, y0); c.stroke();
      if (monthly.length) {
        const mx = Math.max(...monthly) * 1.1, bw = (x1 - x0) / monthly.length;
        monthly.forEach((v, i) => { const bh = (y0 - y1) * v / mx; c.fillStyle = i % 12 === 11 ? '#1f8a4c' : '#7fbf95'; c.fillRect(x0 + i * bw + 2, y0 - bh, bw - 4, bh); });
        c.fillStyle = '#5b5a56'; c.font = '600 16px Raleway, system-ui'; c.fillText(tx(`${monthly.length} mies.`, `${monthly.length} months`), x1 - 90, y0 + 26);
      } else { c.fillStyle = '#8a8d90'; c.font = '600 22px Raleway, system-ui'; c.fillText(tx('Brak danych', 'No data'), x0 + 30, (y0 + y1) / 2); }
      c.fillStyle = '#5b5a56'; c.font = '600 16px Raleway, system-ui'; names.slice(0, 4).forEach((n, i) => { c.fillStyle = PROD_COL[i % PROD_COL.length]; c.fillRect(x0 + 10 + i * 200, h - 34, 12, 12); c.fillStyle = '#3a3a3a'; let t = n; while (c.measureText(t).width > 175 && t.length > 4) t = t.slice(0, -1); c.fillText(t, x0 + 28 + i * 200, h - 23); });
    };
    const salesScreen = new T.Mesh(new T.PlaneGeometry(1.24, 0.72), new T.MeshBasicMaterial({ map: tex.screen(drawSales, { w: 1024, h: 594 }), toneMapped: false }));
    salesScreen.position.set(0, 1.72, -0.028); sales.add(salesScreen);
    // binders on the shelf
    [[0x2f8f47, -0.25], [0x2f8f47, -0.17], [0x5b6770, -0.09]].forEach(([col, x]) => kit.box(sales, [0.07, 0.31, 0.27], [x, 1.02, 0.02], kit.mat(col, { rough: 0.55 })));
    kit.plane(sales, [0.07, 0.3], [-0.25, 1.02, 0.156], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(64, 280, (c, w, h) => { c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(8, 16, w - 16, 170); c.save(); c.translate(w / 2, 100); c.rotate(-Math.PI / 2); c.fillStyle = '#1c1917'; c.font = '800 22px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('SPRZEDAŻ', 'SALES'), 0, 0); c.restore(); }), rough: 0.5 })).castShadow = false;

    // ---- STATION method: the planner's mobile whiteboard ----
    const WX = 3.5, WZ = -0.9;
    const wb = new T.Group(); wb.position.set(WX, 0, WZ); wb.rotation.y = -0.95; g.add(wb);
    const wF = kit.batch(wb, M.galv, { shadow: true });
    wF.box([1.84, 0.04, 0.04], [0, 2.02, 0]).box([1.84, 0.04, 0.04], [0, 0.88, 0]).box([0.04, 1.18, 0.04], [-0.92, 1.45, 0]).box([0.04, 1.18, 0.04], [0.92, 1.45, 0]);
    wF.box([0.05, 0.9, 0.05], [-0.92, 0.45, 0]).box([0.05, 0.9, 0.05], [0.92, 0.45, 0]).box([0.05, 0.04, 0.6], [-0.92, 0.06, 0]).box([0.05, 0.04, 0.6], [0.92, 0.06, 0]).box([0.6, 0.025, 0.07], [0.3, 0.86, 0.04]);
    for (const x of [-0.92, 0.92]) for (const z of [-0.26, 0.26]) wF.cyl(0.035, 0.035, 0.03, [x, 0.035, z], [0, 0, Math.PI / 2], 10);
    wF.done();
    const drawWb = (c, w, h) => {
      c.fillStyle = '#fbfcfc'; c.fillRect(0, 0, w, h);
      const pen = (col, lw) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = 'round'; };
      const word = (t, x, y, fs) => { c.font = `600 ${fs}px "Comic Sans MS", "Segoe Print", cursive, system-ui`; c.fillText(t, x, y); };
      pen('#1f3f8f', 4); word(tx('Prognoza na 6 miesięcy', 'A 6-month forecast'), 30, 56, 36);
      // a hand-drawn history line (shape only) and a dashed "?" ahead
      c.beginPath(); c.moveTo(40, 300); c.lineTo(40, 110); c.moveTo(40, 300); c.lineTo(w - 40, 300); c.stroke();
      pen('#1c1917', 4); c.beginPath(); [[60, 250], [110, 220], [160, 240], [210, 190], [260, 210], [310, 170], [360, 200], [410, 150], [460, 175], [510, 140]].forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
      pen('#c0221c', 4); c.setLineDash([14, 12]); c.beginPath(); c.moveTo(510, 140); c.lineTo(w - 70, 140); c.stroke(); c.setLineDash([]); word('?', w - 64, 154, 56);
      word(tx('grudzień!', 'December!'), w - 260, 110, 26);
      pen('#1f3f8f', 3); word(tx('trend? sezon? średnia?', 'trend? season? average?'), 60, 360, 28);
      pen('#2f7f3f', 3); word(tx('porównać z metodą odniesienia', 'compare with a baseline'), 60, 410, 24);
      c.fillStyle = '#ffe66b'; c.fillRect(w - 230, 330, 170, 120); c.fillStyle = '#3a3a3a'; word(tx('np. błąd < 10%?', 'e.g. error < 10%?'), w - 220, 390, 22);
    };
    kit.plane(wb, [1.8, 1.1], [0, 1.45, 0.022], [0, 0, 0], kit.mat(0xffffff, { map: tex.screen(drawWb, { w: 860, h: 526 }), rough: 0.3 })).castShadow = false;
    kit.plane(wb, [1.8, 1.1], [0, 1.45, -0.022], [0, Math.PI, 0], M.white).castShadow = false;

    // ---- STATION experiment: the planner workstation ----
    const PX = 2.3, PZ = 2.5;
    const plan = new T.Group(); plan.position.set(PX, 0, PZ); plan.rotation.y = -0.55; g.add(plan);
    const pDesk = kit.batch(plan, M.desk, { uv: 1 }), pGrey = kit.batch(plan, M.grey), pDark = kit.batch(plan, M.dark), pSeat = kit.batch(plan, M.seat);
    pDesk.box([1.6, 0.035, 0.8], [0, 0.74, 0]);
    for (const sx of [-0.74, 0.74]) pGrey.box([0.05, 0.72, 0.7], [sx, 0.36, 0]);
    pGrey.box([0.42, 0.6, 0.55], [0.5, 0.3, 0.0]);
    const drawPlan = (c, w, h) => {
      c.fillStyle = '#f4f6f7'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, 44);
      c.fillStyle = '#fff'; c.font = '700 23px Raleway, system-ui'; c.fillText(tx('Planowanie popytu', 'Demand planning'), 14, 30);
      c.fillStyle = '#1c1917'; c.font = '600 18px Raleway, system-ui'; c.fillText(tx('Produkt', 'Product'), 14, 78);
      c.fillStyle = '#fff'; c.strokeStyle = '#9aa5ad'; c.fillRect(14, 88, w - 28, 36); c.strokeRect(14, 88, w - 28, 36);
      c.fillStyle = '#3a3a3a'; c.font = '600 17px Raleway, system-ui'; let t = names[0]; while (c.measureText(t).width > w - 70 && t.length > 4) t = t.slice(0, -1); c.fillText(t + '  ▾', 24, 112);
      c.fillStyle = '#1c1917'; c.font = '600 18px Raleway, system-ui'; c.fillText(tx('Horyzont: 6 mies.', 'Horizon: 6 months'), 14, 158);
      c.fillStyle = '#c9d1d6'; c.fillRect(14, 172, w - 28, 8); c.fillStyle = '#2f8f47'; c.fillRect(14, 172, (w - 28) * 0.5, 8);
      c.fillStyle = '#2f8f47'; c.fillRect(14, h - 58, 170, 42); c.fillStyle = '#fff'; c.font = '700 19px Raleway, system-ui'; c.fillText(tx('PROGNOZUJ', 'FORECAST'), 40, h - 30);
    };
    const drawPlan2 = (c, w, h) => {
      c.fillStyle = '#1e2226'; c.fillRect(0, 0, w, h); c.fillStyle = '#7fbf95'; c.font = '700 20px ui-monospace, monospace'; c.fillText(tx('sprzedaz_historia.csv', 'sales_history.csv'), 14, 30);
      c.font = '500 15px ui-monospace, monospace';
      monthly.slice(-9).forEach((v, i) => { c.fillStyle = '#7f8b93'; c.fillText(tx('mies. ', 'month ') + String(monthly.length - 8 + i).padStart(2, '0'), 14, 62 + i * 24); c.fillStyle = '#d6dde2'; c.fillText(String(v), 150, 62 + i * 24); });
      if (!monthly.length) { c.fillStyle = '#7f8b93'; c.fillText('…', 14, 62); }
    };
    kit.prop.monitor(plan, pDark, [-0.36, 0.757, -0.2], 0.15, drawPlan, [0.56, 0.34]);
    kit.prop.monitor(plan, pDark, [0.3, 0.757, -0.2], -0.15, drawPlan2, [0.52, 0.32]);
    pDark.box([0.44, 0.02, 0.14], [-0.05, 0.768, 0.1]);
    kit.prop.chair({ dark: pSeat, metal: pGrey }, [0.6, 0.8], Math.PI - 0.6);
    pDesk.done(); pGrey.done(); pDark.done(); pSeat.done();
    kit.cyl(plan, 0.04, 0.1, [0.62, 0.8, 0.12], kit.mat(0x2f8f47, { rough: 0.4 }));
    // a low screen partition behind the planner desk and a small filing cabinet
    kit.batch(g, kit.mat(0x8a979e, { rough: 0.95 }), { uv: 1 }).box([2.0, 1.1, 0.05], [PX + 0.4, 0.55, PZ - 0.8], [0, -0.55, 0]).done();

    // ---- STATION results: the wall chart over the dock (history from data, the forecast months left empty) ----
    const CX = 5.05, CY = 5.3, CW = 6.2, CH = 2.0;
    const CZ = -D / 2 + 0.55;
    const chart = new T.Group(); chart.position.set(CX, CY, CZ); g.add(chart);
    const chartBody = kit.rbox(chart, [CW + 0.16, CH + 0.16, 0.1], [0, 0, 0], M.dark, 0.02);
    const drawChart = (c, w, h) => {
      c.fillStyle = '#f3f6f4'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, 74); c.fillStyle = '#fff'; c.font = '800 40px Raleway, system-ui'; c.fillText(tx('PROGNOZA POPYTU · WYNIKI', 'DEMAND FORECAST · RESULTS'), 28, 50);
      // empty KPI tiles: filled by the experiments, never invented here
      [tx('Błąd prognozy (MAPE)', 'Forecast error (MAPE)'), tx('Metoda odniesienia', 'Baseline'), tx('Eksperymenty', 'Experiments')].forEach((t, i) => { const x = w - 3 * 290 - 10 + i * 290; c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x, 10, 270, 54); c.fillStyle = '#d9efe0'; c.font = '600 17px Raleway, system-ui'; c.fillText(t, x + 12, 31); c.fillStyle = '#fff'; c.font = '700 22px Raleway, system-ui'; c.fillText('–', x + 12, 57); });
      const x0 = 90, x1 = w - 40, y0 = h - 60, y1 = 110, months = Math.max(monthly.length, 12), total = months + 6, sx = (x1 - x0) / (total - 1);
      c.strokeStyle = '#9aa5ad'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y1); c.lineTo(x0, y0); c.lineTo(x1, y0); c.stroke();
      // the forecast window: 6 empty months
      const fx = x0 + (months - 0.5) * sx;
      c.fillStyle = 'rgba(47,143,71,.08)'; c.fillRect(fx, y1, x1 - fx, y0 - y1);
      c.setLineDash([10, 8]); c.strokeStyle = '#2f8f47'; c.beginPath(); c.moveTo(fx, y1); c.lineTo(fx, y0); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#2f8f47'; c.font = '700 24px Raleway, system-ui'; c.fillText(tx('prognoza: 6 mies.', 'forecast: 6 months'), fx + 16, y1 + 34);
      c.font = '800 64px Raleway, system-ui'; c.fillText('?', fx + (x1 - fx) / 2 - 16, (y0 + y1) / 2 + 24);
      if (monthly.length) {
        const mn = Math.min(...monthly) * 0.85, mx = Math.max(...monthly) * 1.08, Y = v => y0 - (y0 - y1) * (v - mn) / (mx - mn);
        c.strokeStyle = '#1c1917'; c.lineWidth = 4; c.beginPath(); monthly.forEach((v, i) => i ? c.lineTo(x0 + i * sx, Y(v)) : c.moveTo(x0, Y(v))); c.stroke();
        c.fillStyle = '#1c1917'; monthly.forEach((v, i) => { c.beginPath(); c.arc(x0 + i * sx, Y(v), 5, 0, Math.PI * 2); c.fill(); });
        c.fillStyle = '#5b5a56'; c.font = '600 20px Raleway, system-ui'; c.fillText(tx('sprzedaż (historia)', 'sales (history)'), x0 + 12, y1 + 30);
      } else { c.fillStyle = '#8a8d90'; c.font = '600 26px Raleway, system-ui'; c.fillText(tx('Brak historii sprzedaży', 'No sales history'), x0 + 30, (y0 + y1) / 2); }
      c.fillStyle = '#6b6a66'; c.font = '600 18px Raleway, system-ui'; for (let i = 0; i < total; i += 3) c.fillText(String(i + 1), x0 + i * sx - 6, y0 + 28);
    };
    const chartScreen = new T.Mesh(new T.PlaneGeometry(CW, CH), new T.MeshBasicMaterial({ map: tex.screen(drawChart, { w: 1550, h: 500 }), toneMapped: false }));
    chartScreen.position.set(0, 0, 0.051); chartBody.add(chartScreen);
    const chartArm = kit.batch(g, M.galv, { shadow: false });
    chartArm.rod([CX - 2.6, CY + 1.0, CZ], [CX - 2.6, H, CZ], 0.015, 6).rod([CX + 2.6, CY + 1.0, CZ], [CX + 2.6, H, CZ], 0.015, 6);
    chartArm.done();

    // ---- fittings: extinguishers, exit sign, signs ----
    kit.prop.extinguisher(g, [-1.5, D / 2 - 0.02], Math.PI, lang);
    kit.prop.extinguisher(g, [W / 2 - 0.02, 5.2], -Math.PI / 2, lang);
    kit.prop.exitSign(g, [-4.5, 2.45, D / 2 - 0.03], Math.PI, lang);
    kit.prop.sign(g, [0.5, 0.62], [0.9, 2.4, -D / 2 + 0.01], 0, tex.sign('warning', tx('Wózki paletowe', 'Pallet trucks')));
    kit.prop.sign(g, [0.5, 0.62], [9.0, 2.4, -D / 2 + 0.01], 0, tex.sign('mandatory', tx('Kamizelka', 'Hi-vis vest'), '▲'));
    kit.plane(g, [5.0, 1.0], [-5.5, 6.9, -D / 2 + 0.02], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(1024, 205, (c, w, h) => { c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(150, h / 2, 120, 62, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1c1917'; c.font = '800 62px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RYBEX', 150, h / 2 + 4); c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '700 64px Raleway, system-ui'; c.fillText(tx('MAGAZYN WYROBÓW', 'FINISHED GOODS'), 300, h / 2 + 4); }), rough: 0.6 }));

    desk.done(); grey.done(); dark.done(); seat.done(); white.done(); wood.done();

    // ---- lights: daylight from the yard and the skylights, high bays ----
    // Key from the right of the door view (the yard side), across the aisle: cartons get a lit and a shaded face
    // and the racks throw their shadows over the floor.
    g.add(new T.HemisphereLight(0xeef3f6, 0x5f5a52, 0.5));
    const sun = new T.DirectionalLight(0xfff0d8, 3.3);
    sun.position.set(15, 11, -11); sun.target.position.set(0, 0, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 12, bottom: -12, near: 1, far: 44 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
    g.add(sun, sun.target);
    for (const [x, z] of [[-6.5, -2], [-6.5, 3.5], [0, -3], [0, 3], [6, -3], [6, 3]]) { const p = new T.PointLight(0xfff3e2, 13, 16, 1.6); p.position.set(x, 6.4, z); g.add(p); }
    kit.envAll(g, 0.8);

    // ---- motion: the dock-1 traffic light breathes (still under reduced motion) ----
    let clock = 0;
    function tick(dt) { if (reducedMotion) return; clock += dt; tLamp.intensity = 3 + Math.sin(clock * 0.8) * 0.4; }

    function yardTex() {
      return kit.canvasTexture(1536, 614, (c, w, h) => {
        const r = kit.rng(31);
        const sky = c.createLinearGradient(0, 0, 0, h * 0.7); sky.addColorStop(0, '#9ec4e3'); sky.addColorStop(1, '#eef3f5'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 8; i++) { const x = r() * w, y = 40 + r() * 150, rx = 70 + r() * 160; c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(x, y, rx, rx * 0.2, 0, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#b8b3a8'; c.fillRect(0, h * 0.55, w, h * 0.2); c.fillStyle = '#7d8286'; c.fillRect(0, h * 0.75, w, h * 0.25);
        for (let x = 40; x < w; x += 70) { c.fillStyle = '#5b6066'; c.fillRect(x, h * 0.48, 4, h * 0.27); }
        c.fillStyle = '#e8e8e8'; c.fillRect(w * 0.55, h * 0.5, 380, 120); c.fillStyle = '#1f5f9e'; c.fillRect(w * 0.55, h * 0.5, 380, 26); c.fillStyle = '#222'; c.fillRect(w * 0.55 + 40, h * 0.5 + 110, 40, 22); c.fillRect(w * 0.55 + 300, h * 0.5 + 110, 40, 22);
      });
    }

    return {
      scene: g,
      bounds: { x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2 },
      lights: 'none',
      background: 0xd4d8da,
      fog: { color: 0xd4d8da, near: 20, far: 60 },
      exposure: 1.38,
      spawn: { pos: [-4.5, 1.65, 5.4], yaw: -0.55 },
      colliders: [
        [-W / 2, RZ - 3 * BAY / 2 - 0.1, -W / 2 + RACK_D + 0.15, RZ + 3 * BAY / 2 + 0.1], // wall run
        [-7.5, RZ - 3 * BAY / 2 - 0.1, -5.1, RZ + 3 * BAY / 2 + 0.25],                  // double run
        [-3.0 - 3 * BAY / 2 - 0.1, -D / 2, -3.0 + 3 * BAY / 2 + 0.1, -5.75],             // back run
        [W / 2 - RACK_D - 0.15, -3 * BAY / 2 - 0.1, W / 2, 3 * BAY / 2 + 0.1],            // right run
        ...staged.map(([x, z]) => [x - 0.45, z - 0.65, x + 0.45, z + 0.65]),
        [-1.05, -D / 2, 0.25, -5.9], [-1.35, -5.25, -0.65, -3.3],                          // empty pallets, pallet truck
        [BX - 0.45, BZ - 0.4, BX + 0.45, BZ + 0.4],                                       // dispatch stand
        [SX - 0.55, SZ - 0.5, SX + 0.55, SZ + 0.5],                                       // sales trolley
        [WX - 0.85, WZ - 0.85, WX + 0.85, WZ + 0.85],                                     // whiteboard
        [PX - 1.1, PZ - 1.25, PX + 1.3, PZ + 1.0],                                        // planner desk, partition
        ...[-7.5, -2.5, 2.5, 7.5].flatMap(x => [[x - 0.17, -D / 2, x + 0.17, -D / 2 + 0.33], [x - 0.17, D / 2 - 0.33, x + 0.17, D / 2]]),
      ],
      stations: [
        { key: 'brief', label: { pl: 'Podkładka wysyłek', en: 'Dispatch clipboard' }, meshes: [disp], anchor: [BX, 1.2, BZ], view: kit.view([BX - 0.35, 1.65, BZ + 1.05], [BX, 1.05, BZ], 0.28) },
        { key: 'data', label: { pl: 'Historia sprzedaży', en: 'Sales history' }, meshes: [sales], anchor: [SX, 1.75, SZ], view: kit.view([SX + 1.35, 1.65, SZ + 1.3], [SX - 0.05, 1.6, SZ - 0.05], 0.28) },
        { key: 'method', label: { pl: 'Tablica planisty', en: 'Planner whiteboard' }, meshes: [wb], anchor: [WX, 1.75, WZ], view: kit.view([WX - 1.55, 1.65, WZ + 1.15], [WX, 1.45, WZ], 0.28) },
        { key: 'experiment', label: { pl: 'Stanowisko planisty', en: 'Planner workstation' }, meshes: [plan], anchor: kit.frameAt(PX, PZ, -0.55)(-0.36, 1.1, -0.18), view: kit.view([PX - 0.95, 1.65, PZ + 1.35], [PX, 1.05, PZ], 0.28) },
        { key: 'results', label: { pl: 'Wykres na ścianie', en: 'Wall chart' }, meshes: [chart], anchor: [CX - 0.6, CY + CH / 2 - 0.12, CZ + 0.06], view: kit.view([CX + 0.9, 1.65, 0.7], [CX + 0.3, CY - 0.1, CZ], 0.3) },
      ],
      tick,
      dispose() { shotImgs.forEach(im => { if (im) im.onload = null; }); },
    };

    // shared kraft carton background (drawn once into a canvas, reused by every face)
    function cartonBaseCanvas() {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320; const c = cv.getContext('2d'), r = kit.rng(77);
      c.fillStyle = '#b8895a'; c.fillRect(0, 0, 256, 320);
      for (let k = 0; k < 700; k++) { c.fillStyle = `rgba(${r() < 0.5 ? '90,60,30' : '220,190,140'},${0.08 + r() * 0.12})`; c.fillRect(r() * 256, r() * 320, 1 + r() * 2, 1 + r() * 2); }
      return cv;
    }
  });
})();
