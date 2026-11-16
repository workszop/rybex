// Room "maint": the machine room behind line 2. Two horizontal retorts (one with a basket of cans waiting at its
// door), the steam boiler, insulated steam pipework with flanges and valves, the sensor cabinet with blinking LEDs.
// Stations: brief = shift log, data = sensor cabinet, method = engineer desk, experiment = maintenance console,
// results = trend screen (draws data.series, vibration in mm/s, with the PROCES-05 alarm line at 4 mm/s).
// Classic script; needs rooms/engine.js (window.Rooms) first.
(function () {
  'use strict';
  if (!window.Rooms) return;
  const W = 14, D = 10, H = 5; // x -7..7, z -5..5, ceiling at 5
  const ALARM = 4; // mm/s, the PROCES-05 vibration rule used in the workshop

  Rooms.define('maint', ({ THREE: T, kit, lang, data, reducedMotion }) => {
    const tx = (pl, en) => lang === 'en' ? en : pl;
    const tex = kit.tex, g = new T.Group();
    const d = (data && data.maint) || data || {};
    const series = (Array.isArray(d.series) ? d.series : []).map(Number).filter(Number.isFinite);

    // ---- materials ----
    const M = {
      floor: kit.mat(0xffffff, { map: kit.tile(tex.tiles('#a65d42'), W / 0.6, D / 0.6), rough: 0.62, roughMap: [W / 3.1, D / 3.1], bump: 1.5 }), // quarry tiles: recessed grout, glossier where hosed down
      wallLow: kit.mat(0xffffff, { map: tex.paintedWall('#c9d3c8'), rough: 0.6, bump: 1.2 }),   // washable gloss dado
      wallUp: kit.mat(0xffffff, { map: tex.paintedWall('#ecebe5'), rough: 0.9, bump: 1.2 }),
      ceiling: kit.mat(0xb9b8b3, { map: tex.concrete(), rough: 0.95 }),
      plinth: kit.mat(0x4a524c, { rough: 0.6 }),
      steel: kit.mat(0xd9dde0, { map: tex.brushedSteel(), rough: 0.4, metal: 0.78, roughMap: [0.8, 0.8] }),
      clad: kit.mat(0xe2e5e7, { map: tex.brushedSteel(), rough: 0.38, metal: 0.75 }),
      galv: kit.mat(0xb9bec0, { map: tex.brushedSteel(), rough: 0.5, metal: 0.6 }),
      paintBlue: kit.mat(0x2d5f8f, { rough: 0.34, metal: 0.15 }),      // machine enamel: sharp highlight
      paintGrey: kit.mat(0x6c757b, { rough: 0.55, metal: 0.3 }),
      pipeRed: kit.mat(0xb3261e, { rough: 0.45, metal: 0.2 }),
      pipeGreen: kit.mat(0x3f7f4c, { rough: 0.5, metal: 0.2 }),
      pipeBlue: kit.mat(0x2c6cb0, { rough: 0.5, metal: 0.2 }),
      yellow: kit.mat(0xf0bf00, { rough: 0.45 }),
      hazard: kit.mat(0xffffff, { map: tex.hazard(), rough: 0.5 }),
      black: kit.mat(0x1d1e1f, { rough: 0.84 }),                       // rubber: broad dull highlight
      dark: kit.mat(0x2a2d30, { rough: 0.38 }),
      cabinet: kit.mat(0xd5d7d2, { rough: 0.36, metal: 0.15 }),
      wood: kit.mat(0xb08a5e, { map: tex.cardboard(), rough: 0.7 }),
      grate: kit.mat(0xffffff, { map: tex.grate(), rough: 0.35, metal: 0.7 }),
      glass: new T.MeshStandardMaterial({ color: 0xcfdde5, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }),
      lamp: new T.MeshBasicMaterial({ color: 0xfffaf0, toneMapped: false }),
      sky: new T.MeshBasicMaterial({ map: kit.canvasTexture(512, 256, (c, w, h) => { const r = kit.rng(7); kit.paint.sky(c, w, h, r, { top: '#b4d3ec', horizon: '#eef3f5', to: 0.9, clouds: 3 }); kit.paint.treeLine(c, w, h, h * 1.04, r, { rows: 2, size: 0.8 }); c.fillStyle = 'rgba(110,120,125,.45)'; c.fillRect(0, h * 0.92, w, h * 0.08); }) }),
    };

    // ---- shell ----
    kit.plane(g, [W, D], [0, 0, 0], [-Math.PI / 2, 0, 0], M.floor);
    const low = kit.batch(g, M.wallLow, { uv: 1 / 1.6, shadow: false }), up = kit.batch(g, M.wallUp, { uv: 1 / 1.6, shadow: false });
    const LOW = 2.0;
    const wall = (b, [w, h, dd], p) => b.box([w, h, dd], p);
    // back z=-5, right x=7: plain; front z=5: door at x -5.1..-3.9; left x=-7: windows high up
    wall(low, [W, LOW, 0.2], [0, LOW / 2, -D / 2 - 0.1]); wall(up, [W, H - LOW, 0.2], [0, LOW + (H - LOW) / 2, -D / 2 - 0.1]);
    wall(low, [0.2, LOW, D], [W / 2 + 0.1, LOW / 2, 0]); wall(up, [0.2, H - LOW, D], [W / 2 + 0.1, LOW + (H - LOW) / 2, 0]);
    wall(low, [1.9, LOW, 0.2], [-6.05, LOW / 2, D / 2 + 0.1]); wall(low, [10.9, LOW, 0.2], [1.55, LOW / 2, D / 2 + 0.1]);
    wall(up, [1.9, H - LOW, 0.2], [-6.05, LOW + (H - LOW) / 2, D / 2 + 0.1]); wall(up, [10.9, H - LOW, 0.2], [1.55, LOW + (H - LOW) / 2, D / 2 + 0.1]);
    wall(up, [1.2, H - 2.2, 0.2], [-4.5, 2.2 + (H - 2.2) / 2, D / 2 + 0.1]);
    wall(low, [0.2, LOW, D], [-W / 2 - 0.1, LOW / 2, 0]);
    up.box([0.2, 1.0, D], [-W / 2 - 0.1, 2.5, 0]).box([0.2, H - 4.2, D], [-W / 2 - 0.1, 4.2 + (H - 4.2) / 2, 0]);
    for (const z of [-4.6, -1.3, 1.7, 4.6]) up.box([0.2, 1.2, z === -4.6 || z === 4.6 ? 0.8 : 1.0], [-W / 2 - 0.1, 3.6, z]);
    low.done(); up.done();
    // windows between the piers on the left wall
    const sky = kit.batch(g, M.sky, { shadow: false, receive: false }), frames = kit.batch(g, M.galv, { shadow: false });
    for (const [z0, z1] of [[-4.2, -1.8], [-0.8, 1.2], [2.2, 4.2]]) {
      const zc = (z0 + z1) / 2, w = z1 - z0;
      sky.add(new T.PlaneGeometry(w, 1.2), [-W / 2 - 0.05, 3.6, zc], [0, Math.PI / 2, 0]);
      frames.box([0.08, 0.06, w], [-W / 2 + 0.02, 3.0, zc]).box([0.08, 0.06, w], [-W / 2 + 0.02, 4.2, zc]).box([0.08, 1.2, 0.05], [-W / 2 + 0.02, 3.6, zc]);
      frames.box([0.25, 0.04, w], [-W / 2 + 0.1, 2.99, zc]); // sill
    }
    // ceiling slab with downstand beams
    const ceil = kit.batch(g, M.ceiling, { uv: 0.4, shadow: false });
    ceil.box([W, 0.2, D], [0, H + 0.1, 0]);
    for (const x of [-3.5, 0, 3.5]) ceil.box([0.35, 0.45, D], [x, H - 0.22, 0]);
    ceil.done();
    const plinth = kit.batch(g, M.plinth, { shadow: false });
    plinth.box([W, 0.12, 0.02], [0, 0.06, -D / 2 + 0.01]).box([0.02, 0.12, D], [W / 2 - 0.01, 0.06, 0]).box([0.02, 0.12, D], [-W / 2 + 0.01, 0.06, 0]);
    plinth.box([1.9, 0.12, 0.02], [-6.05, 0.06, D / 2 - 0.01]).box([10.9, 0.12, 0.02], [1.55, 0.06, D / 2 - 0.01]);
    plinth.done();
    // the door (steel, closed) behind the spawn point
    kit.box(g, [1.0, 2.1, 0.05], [-4.5, 1.05, D / 2 - 0.01], M.paintGrey).castShadow = false;
    kit.box(g, [0.18, 0.03, 0.05], [-4.15, 1.05, D / 2 - 0.05], M.black).castShadow = false;

    // ---- floor: drains, painted safety lines ----
    const paint = kit.batch(g, M.yellow, { shadow: false });
    const line = (x0, z0, x1, z1) => paint.box([Math.abs(x1 - x0) || 0.08, 0.004, Math.abs(z1 - z0) || 0.08], [(x0 + x1) / 2, 0.002, (z0 + z1) / 2]);
    line(-6.8, -1.0, 1.2, -1.0); line(1.2, -1.0, 1.2, -4.9);                 // retort zone
    line(2.2, -4.9, 2.2, -1.9); line(2.2, -1.9, 6.9, -1.9);                  // boiler zone
    line(-5.2, 4.9, -5.2, 1.6); line(-3.8, 4.9, -3.8, 1.6);                  // walkway from the door
    paint.done();
    kit.batch(g, M.hazard, { uv: 1.5, shadow: false }).box([0.5, 0.004, 1.6], [-0.75, 0.002, -2.95]).done(); // in front of the retort doors
    const drains = kit.batch(g, M.grate, { uv: 2.5, shadow: false });
    drains.box([0.35, 0.006, 0.35], [-0.2, 0.003, -0.6]).box([0.35, 0.006, 0.35], [2.6, 0.003, -1.4]).box([4.5, 0.006, 0.15], [-4.0, 0.003, -0.8]);
    drains.done();

    // ---- the two retorts: horizontal shells on saddles, quick-open doors facing the room ----
    const RX0 = -6.4, RX1 = -1.7, RR = 0.75, RY = 1.4;
    const shells = kit.batch(g, M.steel, { uv: 0 });
    const saddles = kit.batch(g, M.paintBlue, { uv: 1 });
    const reds = kit.batch(g, M.pipeRed, { shadow: false });
    const blacks = kit.batch(g, M.black, { shadow: false });
    const dialFaces = [];
    for (const z of [-3.95, -2.0]) {
      shells.cyl(RR, RR, RX1 - RX0, [(RX0 + RX1) / 2, RY, z], [0, 0, Math.PI / 2], 40);
      const dome = new T.SphereGeometry(RR, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      shells.add(dome, [RX0, RY, z], [0, 0, Math.PI / 2], [1, 0.35, 1]);
      // door: thick disc, clamp ring, hinge post, handwheel
      shells.cyl(RR + 0.06, RR + 0.06, 0.12, [RX1 + 0.06, RY, z], [0, 0, Math.PI / 2], 40);
      shells.add(new T.TorusGeometry(RR + 0.05, 0.05, 10, 40), [RX1 + 0.01, RY, z], [0, Math.PI / 2, 0]);
      shells.cyl(0.5, 0.5, 0.08, [RX1 + 0.16, RY, z], [0, 0, Math.PI / 2], 32);
      shells.box([0.12, 1.2, 0.12], [RX1 + 0.1, RY, z + RR + 0.1]);
      reds.add(new T.TorusGeometry(0.2, 0.02, 8, 28), [RX1 + 0.32, RY, z], [0, Math.PI / 2, 0]);
      for (let k = 0; k < 3; k++) reds.box([0.02, 0.4, 0.02], [RX1 + 0.32, RY, z], [k * Math.PI / 3, 0, 0]);
      reds.cyl(0.03, 0.03, 0.16, [RX1 + 0.25, RY, z], [0, 0, Math.PI / 2]);
      // reinforcing rings and saddles
      for (const x of [RX0 + 0.6, (RX0 + RX1) / 2, RX1 - 0.5]) shells.add(new T.TorusGeometry(RR + 0.01, 0.025, 6, 40), [x, RY, z], [0, Math.PI / 2, 0]);
      for (const x of [RX0 + 0.8, RX1 - 0.8]) saddles.box([0.25, RY - 0.25, 1.2], [x, (RY - 0.25) / 2, z]).box([0.4, 0.05, 1.3], [x, 0.025, z]);
      // nozzles on top: steam inlet, vent, safety valve
      for (const [x, r, h] of [[-5.0, 0.07, 0.4], [-3.8, 0.05, 0.3], [-2.6, 0.06, 0.35]]) shells.cyl(r, r, h, [x, RY + RR + h / 2 - 0.05, z]).cyl(r + 0.05, r + 0.05, 0.03, [x, RY + RR + h - 0.05, z]);
      // gauges on the door end, a thermometer pocket, the chart recorder box beside the door
      dialFaces.push({ p: [RX1 - 0.2, RY + 0.55, z + 0.45], r: [0, Math.PI / 2, 0], s: 0.09 }, { p: [RX1 - 0.2, RY + 0.55, z - 0.45], r: [0, Math.PI / 2, 0], s: 0.09 });
      shells.cyl(0.1, 0.1, 0.05, [RX1 - 0.23, RY + 0.55, z + 0.45], [0, 0, Math.PI / 2]).cyl(0.1, 0.1, 0.05, [RX1 - 0.23, RY + 0.55, z - 0.45], [0, 0, Math.PI / 2]);
      // floor rails for the baskets, into the retort
      for (const dz of [-0.3, 0.3]) shells.box([2.2, 0.04, 0.05], [RX1 + 1.0, 0.02, z + dz]);
    }
    // chart recorder on a post between the retort doors
    blacks.box([0.06, 1.5, 0.06], [-1.2, 0.75, -3.0]);
    kit.box(g, [0.12, 0.48, 0.44], [-1.2, 1.7, -3.0], M.cabinet);
    dialFaces.push({ p: [-1.135, 1.7, -3.0], r: [0, Math.PI / 2, 0], s: 0.19, chart: true });

    // a loaded basket of cans on its trolley, waiting at retort 2
    const basket = kit.batch(g, M.galv, { shadow: true });
    const BX = -0.55, BZ = -2.0;
    basket.box([0.95, 0.05, 0.95], [BX, 0.2, BZ]);
    for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) basket.box([0.04, 1.0, 0.04], [BX + x, 0.7, BZ + z]).cyl(0.05, 0.05, 0.05, [BX + x, 0.05, BZ + z], [Math.PI / 2, 0, 0]);
    for (let y = 0.35; y <= 1.15; y += 0.2) { basket.box([0.95, 0.015, 0.015], [BX, y, BZ - 0.47]).box([0.95, 0.015, 0.015], [BX, y, BZ + 0.47]).box([0.015, 0.015, 0.95], [BX - 0.47, y, BZ]).box([0.015, 0.015, 0.95], [BX + 0.47, y, BZ]); }
    basket.done();
    const lidTex = kit.canvasTexture(64, 64, (c, w, h) => { c.fillStyle = '#c7cbce'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8d9296'; c.lineWidth = 4; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); c.stroke(); });
    const lids = [];
    for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) lids.push({ p: [BX - 0.4 + i * 0.08, 1.06, BZ - 0.4 + j * 0.08] });
    kit.inst(g, new T.CylinderGeometry(0.037, 0.037, 0.105, 14), [kit.mat(0x9ea6ad, { rough: 0.35, metal: 0.6 }), kit.mat(0xffffff, { map: lidTex, rough: 0.3, metal: 0.6 }), M.galv], lids);
    kit.box(g, [0.9, 0.85, 0.9], [BX, 0.65, BZ], kit.mat(0x5e6b78, { rough: 0.6, metal: 0.3 })).castShadow = false; // the cans below, seen through the cage

    // ---- the boiler: insulated shell on a skid, burner at the front, flue up through the ceiling ----
    const BOX0 = 3.3, BOX1 = 6.3, BOZ = -3.55, BOR = 0.95, BOY = 1.35;
    const clad = kit.batch(g, M.clad, { uv: 0 });
    clad.cyl(BOR, BOR, BOX1 - BOX0, [(BOX0 + BOX1) / 2, BOY, BOZ], [0, 0, Math.PI / 2], 40);
    clad.cyl(BOR * 0.98, BOR * 0.98, 0.1, [BOX1 + 0.05, BOY, BOZ], [0, 0, Math.PI / 2], 40);
    for (let x = BOX0 + 0.3; x < BOX1; x += 0.6) clad.add(new T.TorusGeometry(BOR + 0.008, 0.012, 6, 40), [x, BOY, BOZ], [0, Math.PI / 2, 0]);
    clad.cyl(0.26, 0.26, H - (BOY + BOR) + 0.2, [5.7, BOY + BOR + (H - BOY - BOR) / 2, BOZ]);  // flue
    for (const y of [3.0, 4.2]) clad.cyl(0.29, 0.29, 0.04, [5.7, y, BOZ]);
    clad.done();
    const skid = kit.batch(g, M.paintGrey, { uv: 1 });
    skid.box([3.4, 0.2, 1.5], [(BOX0 + BOX1) / 2, 0.1, BOZ]);
    for (const x of [BOX0 + 0.5, BOX1 - 0.5]) skid.box([0.3, BOY - 0.6, 1.0], [x, 0.2 + (BOY - 0.6) / 2, BOZ]);
    skid.box([0.25, 0.9, 1.1], [BOX0 - 0.13, BOY, BOZ]);                       // front plate
    skid.done();
    // burner: blue housing with a blower motor and a gas train
    const burner = kit.batch(g, M.paintBlue, { uv: 1 });
    burner.box([0.6, 0.7, 0.7], [BOX0 - 0.55, BOY, BOZ]).cyl(0.22, 0.22, 0.4, [BOX0 - 0.6, BOY + 0.5, BOZ], [Math.PI / 2, 0, 0]);
    burner.done();
    const gas = kit.batch(g, M.yellow, { shadow: false });
    gas.rod([BOX0 - 0.8, BOY - 0.1, BOZ - 0.35], [BOX0 - 0.8, BOY - 0.1, BOZ - 1.05], 0.035, 10).rod([BOX0 - 0.8, BOY - 0.1, BOZ - 1.05], [BOX0 + 0.4, BOY - 0.1, BOZ - 1.05], 0.035, 10).rod([BOX0 + 0.4, BOY - 0.1, BOZ - 1.05], [BOX0 + 0.4, H, BOZ - 1.05], 0.035, 10);
    gas.box([0.12, 0.14, 0.14], [BOX0 - 0.8, BOY - 0.1, BOZ - 0.7]);
    gas.done();
    // water level glass and gauges on the front plate
    kit.box(g, [0.04, 0.5, 0.04], [BOX0 - 0.27, BOY + 0.15, BOZ + 0.45], M.glass).castShadow = false;
    dialFaces.push({ p: [BOX0 - 0.28, BOY + 0.32, BOZ - 0.35], r: [0, -Math.PI / 2, 0], s: 0.1 });
    shells.cyl(0.11, 0.11, 0.05, [BOX0 - 0.26, BOY + 0.32, BOZ - 0.35], [0, 0, Math.PI / 2]);
    // safety valves on the top
    for (const x of [4.0, 4.5]) shells.cyl(0.06, 0.06, 0.35, [x, BOY + BOR + 0.15, BOZ]).cyl(0.04, 0.04, 0.3, [x + 0.12, BOY + BOR + 0.35, BOZ], [0, 0, Math.PI / 2]);

    // ---- pipework: insulated steam header, coloured service lines, flanges, valves ----
    const flanges = [], FL = new T.CylinderGeometry(0.11, 0.11, 0.035, 16);
    const flAt = (p, axis) => flanges.push({ p, r: axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0] });
    const valve = (p, axis) => {
      shells.box([0.16, 0.16, 0.16], p);
      const up = [p[0], p[1] + 0.28, p[2]];
      shells.cyl(0.015, 0.015, 0.25, [p[0], p[1] + 0.15, p[2]]);
      reds.add(new T.TorusGeometry(0.12, 0.015, 8, 24), up, [Math.PI / 2, 0, 0]);
      reds.box([0.24, 0.015, 0.015], up).box([0.015, 0.015, 0.24], up);
      flAt([axis === 'x' ? p[0] - 0.1 : p[0], p[1], axis === 'z' ? p[2] - 0.1 : p[2]], axis); flAt([axis === 'x' ? p[0] + 0.1 : p[0], p[1], axis === 'z' ? p[2] + 0.1 : p[2]], axis);
    };
    const HY = 3.8, HZ = -4.6;
    const steamPipe = kit.batch(g, M.clad, { uv: 0, shadow: true }); // insulated: aluminium cladding
    steamPipe.rod([-5.6, HY, HZ], [5.0, HY, HZ], 0.13, 20);                            // header
    steamPipe.rod([5.0, HY, HZ], [5.0, HY, BOZ], 0.13, 20).rod([5.0, HY, BOZ], [5.0, BOY + BOR, BOZ], 0.13, 20); // riser from the boiler
    for (let x = -5; x <= 4; x += 1.5) flAt([x, HY, HZ], 'x');
    valve([5.0, 3.1, BOZ], 'y');
    // drops to the retorts: along z to above each shell, then down to the inlet nozzle
    for (const z of [-3.95, -2.0]) {
      steamPipe.rod([-5.0, HY, HZ], [-5.0, HY, z], 0.08, 14).rod([-5.0, HY, z], [-5.0, RY + RR + 0.35, z], 0.08, 14);
      valve([-5.0, 2.95, z], 'y');
      flAt([-5.0, RY + RR + 0.37, z], 'y');
    }
    // header supports from the ceiling
    for (let x = -5.2; x <= 4.6; x += 1.6) blacks.rod([x, HY + 0.13, HZ], [x, H, HZ], 0.012, 6).box([0.05, 0.03, 0.34], [x, HY - 0.15, HZ]);
    steamPipe.done();
    // service lines along the back wall: feed water (green), compressed air (blue), condensate (red band)
    const green = kit.batch(g, M.pipeGreen, { shadow: false }), blue = kit.batch(g, M.pipeBlue, { shadow: false });
    green.rod([-6.9, 3.2, -4.85], [6.9, 3.2, -4.85], 0.05, 12).rod([6.2, 3.2, -4.85], [6.2, 3.2, BOZ], 0.04, 10).rod([6.2, 3.2, BOZ], [6.2, BOY + 0.5, BOZ], 0.04, 10);
    blue.rod([-6.9, 2.95, -4.85], [6.9, 2.95, -4.85], 0.035, 10).rod([-1.4, 2.95, -4.85], [-1.4, 2.95, -3.5], 0.025, 8).rod([-1.4, 2.95, -3.5], [-1.4, 1.95, -3.5], 0.025, 8);
    for (let x = -6.2; x <= 6.4; x += 1.6) { flAt([x, 3.2, -4.85], 'x'); blacks.box([0.04, 0.5, 0.2], [x + 0.3, 3.05, -4.9]); }
    // condensate return from the retorts to a floor drain
    reds.rod([RX1 - 0.4, 0.3, -2.0], [RX1 - 0.4, 0.3, -1.0], 0.03, 8).rod([RX1 - 0.4, 0.3, -3.95], [RX1 - 0.4, 0.3, -2.0], 0.03, 8).rod([RX1 - 0.4, RY - RR + 0.05, -2.0], [RX1 - 0.4, 0.3, -2.0], 0.03, 8);
    green.done(); blue.done();
    kit.inst(g, FL, M.steel, flanges);
    // pipe markers with flow arrows
    const marker = (text, color) => kit.canvasTexture(256, 64, (c, w, h) => { c.fillStyle = color; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 34px Raleway, system-ui'; c.textBaseline = 'middle'; c.fillText(text + '  →', 14, h / 2 + 2); });
    kit.plane(g, [0.6, 0.15], [-1.5, HY, HZ + 0.14], [0, 0, 0], kit.mat(0xffffff, { map: marker(tx('PARA', 'STEAM'), '#b3261e'), rough: 0.5 }));
    kit.plane(g, [0.5, 0.12], [1.0, 3.2, -4.79], [0, 0, 0], kit.mat(0xffffff, { map: marker(tx('WODA', 'WATER'), '#3f7f4c'), rough: 0.5 }));
    kit.plane(g, [0.5, 0.12], [3.0, 2.95, -4.81], [0, 0, 0], kit.mat(0xffffff, { map: marker(tx('POWIETRZE', 'AIR'), '#2c6cb0'), rough: 0.5 }));

    // ---- other plant: water softener tanks, chemical drums, air receiver, cable tray ----
    const blueTank = kit.mat(0x2a5d9a, { rough: 0.35 });
    kit.cyl(g, 0.3, 1.6, [-6.4, 0.8, 2.4], blueTank); kit.cyl(g, 0.3, 1.6, [-6.4, 0.8, 1.6], blueTank);
    kit.cyl(g, 0.38, 1.0, [-6.4, 0.5, 3.4], kit.mat(0xe9ecec, { rough: 0.5 }));
    const drums = kit.batch(g, kit.mat(0x2b62a8, { rough: 0.45 }));
    for (const [x, z] of [[-5.4, 1.4], [-5.4, 0.8]]) drums.cyl(0.29, 0.29, 0.88, [x, 0.44, z], [0, 0, 0], 20);
    drums.done();
    const recv = kit.batch(g, kit.mat(0x9aa2a8, { rough: 0.4, metal: 0.5 }));
    recv.cyl(0.4, 0.4, 1.5, [1.6, 1.05, 4.4], [0, 0, 0], 28).add(new T.SphereGeometry(0.4, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), [1.6, 1.8, 4.4], [0, 0, 0], [1, 0.45, 1]).add(new T.SphereGeometry(0.4, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), [1.6, 0.3, 4.4], [Math.PI, 0, 0], [1, 0.45, 1]);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.5; recv.box([0.05, 0.3, 0.05], [1.6 + Math.cos(a) * 0.3, 0.15, 4.4 + Math.sin(a) * 0.3]); }
    recv.done();
    dialFaces.push({ p: [1.6, 1.5, 4.4 - 0.43], r: [0, Math.PI, 0], s: 0.07 });
    kit.plane(g, [0.7, 0.9], [-0.2, 1.55, D / 2 - 0.01], [0, Math.PI, 0], kit.mat(0xffffff, { map: kit.canvasTexture(280, 360, (c, w, h) => {
      c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h); c.fillStyle = '#2d5f8f'; c.fillRect(0, 0, w, 54); c.fillStyle = '#fff'; c.font = '800 26px Raleway, system-ui'; c.fillText(tx('INSTRUKCJA BHP', 'SAFETY RULES'), 14, 36);
      c.fillStyle = '#1c1917'; c.font = '600 17px Raleway, system-ui'; tx(['1. Ochronniki słuchu', '2. Blokada LOTO przed', '   otwarciem retorty', '3. Gorące rury: rękawice', '4. Wpis do dziennika'], ['1. Ear protection', '2. LOTO before opening', '   a retort', '3. Hot pipes: gloves', '4. Write it in the log']).forEach((t, i) => c.fillText(t, 14, 92 + i * 30));
    }), rough: 0.7 }));
    kit.rbox(g, [0.9, 0.7, 0.6], [2.6, 0.35, 4.5], kit.mat(0x2e8b57, { rough: 0.4 }), 0.025);
    const tray = kit.batch(g, M.galv, { shadow: false });
    tray.box([0.3, 0.01, D], [W / 2 - 0.3, 4.3, 0]).box([0.01, 0.08, D], [W / 2 - 0.15, 4.34, 0]).box([0.01, 0.08, D], [W / 2 - 0.45, 4.34, 0]);
    tray.box([W, 0.01, 0.3], [0, 4.45, D / 2 - 0.3]);
    tray.done();
    blacks.rod([W / 2 - 0.3, 4.33, -D / 2], [W / 2 - 0.3, 4.33, D / 2], 0.02, 6).rod([W / 2 - 0.25, 4.33, -D / 2], [W / 2 - 0.25, 4.33, D / 2], 0.015, 6);

    // ---- light fittings: twin-tube battens ----
    const housings = kit.batch(g, M.galv, { shadow: false }), tubes = kit.batch(g, M.lamp, { shadow: false, receive: false });
    for (const x of [-5.2, -1.75, 1.75, 5.2]) for (const z of [-2.6, 0.6, 3.4]) {
      housings.box([1.55, 0.05, 0.16], [x, 4.3, z]).rod([x - 0.6, 4.33, z], [x - 0.6, H, z], 0.005, 4).rod([x + 0.6, 4.33, z], [x + 0.6, H, z], 0.005, 4);
      tubes.cyl(0.018, 0.018, 1.5, [x, 4.255, z - 0.04], [0, 0, Math.PI / 2], 8).cyl(0.018, 0.018, 1.5, [x, 4.255, z + 0.04], [0, 0, Math.PI / 2], 8);
    }
    housings.done(); tubes.done(); sky.done(); frames.done();

    // ---- signs, extinguishers, first aid, exit ----
    kit.prop.exitSign(g, [-4.5, 2.4, D / 2 - 0.03], Math.PI, lang);
    kit.prop.extinguisher(g, [-3.4, D / 2 - 0.02], Math.PI, lang);
    kit.prop.extinguisher(g, [W / 2 - 0.02, -2.6], -Math.PI / 2, lang);
    kit.prop.sign(g, [0.42, 0.52], [-1.0, 2.35, -D / 2 + 0.01], 0, tex.sign('warning', tx('Gorące powierzchnie', 'Hot surfaces'), '♨'));
    kit.prop.sign(g, [0.42, 0.52], [-0.4, 2.35, -D / 2 + 0.01], 0, tex.sign('mandatory', tx('Ochronniki słuchu', 'Ear protection'), '◡'));
    kit.prop.sign(g, [0.42, 0.52], [3.0, 2.35, -1.89], 0, tex.sign('warning', tx('Wysokie ciśnienie', 'High pressure')));
    kit.prop.sign(g, [0.42, 0.52], [-6.98, 1.6, -0.2], Math.PI / 2, tex.sign('warning', tx('Chemikalia', 'Chemicals')));
    kit.box(g, [0.36, 0.3, 0.12], [-2.6, 1.6, D / 2 - 0.07], kit.mat(0x1f8a4c, { rough: 0.5 }));
    kit.prop.sign(g, [0.2, 0.2], [-2.6, 1.6, D / 2 - 0.135], Math.PI, tex.sign('info', '', '+'));
    const rsign = (t, x, z) => kit.prop.sign(g, [0.6, 0.18], [x, 2.4, z], 0, kit.canvasTexture(320, 96, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1c1917'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = '#1c1917'; c.font = '800 44px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, w / 2, h / 2 + 2); }));
    rsign('RETORTA 1', -3.9, -4.98); rsign('KOCIOŁ K-1', 4.8, -4.98);

    // gauge and chart faces (one batch per texture)
    const dialTex = kit.canvasTexture(128, 128, (c, w, h) => {
      c.fillStyle = '#f6f6f2'; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 2;
      for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.75 + i * Math.PI * 0.15; c.beginPath(); c.moveTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); c.lineTo(64 + Math.cos(a) * 42, 64 + Math.sin(a) * 42); c.stroke(); }
      c.strokeStyle = '#c0221c'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 52, Math.PI * 0.05, Math.PI * 0.25); c.stroke();
      c.strokeStyle = '#111'; c.lineWidth = 4; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.cos(-0.4) * 46, 64 + Math.sin(-0.4) * 46); c.stroke();
      c.fillStyle = '#111'; c.font = '700 14px Raleway, system-ui'; c.textAlign = 'center'; c.fillText('bar', 64, 98);
    });
    const chartFace = kit.canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#fbf7f0'; c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(200,60,60,.35)'; c.lineWidth = 1;
      for (let r = 20; r < 126; r += 15) { c.beginPath(); c.arc(128, 128, r, 0, Math.PI * 2); c.stroke(); }
      for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126); c.stroke(); }
      c.strokeStyle = '#7a2fb8'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 200; i++) { const a = i / 200 * Math.PI * 1.6, r = 40 + (i > 20 && i < 150 ? 70 : 20 + i * 0.2) + Math.sin(i * 0.5) * 2; const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    });
    const dials = kit.batch(g, new T.MeshStandardMaterial({ map: dialTex, roughness: 0.3 }), { shadow: false });
    const charts = kit.batch(g, new T.MeshStandardMaterial({ map: chartFace, roughness: 0.4 }), { shadow: false });
    for (const f of dialFaces) (f.chart ? charts : dials).add(new T.CircleGeometry(f.s, 28), f.p, f.r);
    dials.done(); charts.done();

    // ---- STATION brief: shift log on a standing desk near the door ----
    const lect = new T.Group(); lect.position.set(-2.9, 0, 0.45); lect.rotation.y = -0.43; g.add(lect);
    const lectB = kit.batch(lect, M.paintGrey);
    lectB.box([0.08, 1.0, 0.08], [0, 0.5, 0]).box([0.5, 0.03, 0.4], [0, 0.015, 0]).box([0.62, 0.08, 0.46], [0, 1.04, 0], [0.25, 0, 0]);
    lectB.done();
    const drawLog = (c, w, h) => {
      c.fillStyle = '#2b3a55'; c.fillRect(0, 0, w, h);
      for (const [x0] of [[16], [w / 2 + 4]]) {
        c.fillStyle = '#fbf8ef'; c.fillRect(x0, 14, w / 2 - 20, h - 28); c.fillStyle = '#8fb0d6';
        for (let y = 70; y < h - 20; y += 26) c.fillRect(x0 + 8, y, w / 2 - 36, 1.5);
        c.fillStyle = '#d23a3a'; c.fillRect(x0 + 52, 20, 1.5, h - 40);
      }
      c.fillStyle = '#1c1917'; c.font = '700 22px Raleway, system-ui'; c.fillText(tx('DZIENNIK ZMIANY', 'SHIFT LOG'), 28, 48); c.fillText(tx('Retorty · kocioł', 'Retorts · boiler'), w / 2 + 16, 48);
      c.font = 'italic 500 18px Georgia, serif'; c.fillStyle = '#23407a';
      const lines = tx(['06:00 przejęcie zmiany', '06:40 R2 załadunek kosza', '07:15 kocioł 9,8 bar OK', '08:05 R1 drgania wyższe?', '08:30 zgłoszono do UR'], ['06:00 shift handover', '06:40 R2 basket loaded', '07:15 boiler 9.8 bar OK', '08:05 R1 vibration up?', '08:30 reported to maint.']);
      lines.forEach((t, i) => c.fillText(t, i < 3 ? 76 : w / 2 + 64, 92 + (i < 3 ? i : i - 3) * 52));
    };
    const logFace = new T.Mesh(new T.PlaneGeometry(0.56, 0.4), kit.mat(0xffffff, { map: tex.screen(drawLog, { w: 640, h: 456 }), rough: 0.7 }));
    logFace.rotation.x = -Math.PI / 2 + 0.25; logFace.position.set(0, 1.088, 0.004); lect.add(logFace);
    kit.cyl(lect, 0.006, 0.14, [0.22, 1.11, 0.05], kit.mat(0x1f4fb0, { rough: 0.4 })).rotation.z = 1.3;

    // ---- STATION data: sensor cabinet on the right wall, LEDs blinking ----
    const cab = new T.Group(); cab.position.set(6.62, 0, -1.2); cab.rotation.y = -Math.PI / 2; g.add(cab);
    const cabBody = kit.rbox(cab, [1.2, 2.0, 0.5], [0, 1.1, 0], M.cabinet, 0.02);
    kit.box(cab, [1.24, 0.1, 0.54], [0, 0.05, 0], M.black).castShadow = false;
    const cabFront = kit.batch(cab, M.black, { shadow: false });
    cabFront.box([0.02, 1.9, 0.02], [0, 1.1, 0.255]).box([0.03, 0.2, 0.04], [-0.08, 1.15, 0.27]).box([0.03, 0.2, 0.04], [0.08, 1.15, 0.27]);
    cabFront.rod([0, 2.1, 0], [0, 4.3, 0], 0.05, 10).rod([0.3, 2.1, 0], [0.3, 4.3, 0], 0.03, 8);       // conduits up to the tray
    cabFront.done();
    kit.box(cab, [0.5, 0.6, 0.01], [-0.3, 1.45, 0.28], M.glass).castShadow = false;
    kit.batch(cab, M.dark, { shadow: false }).box([0.54, 0.03, 0.03], [-0.3, 1.765, 0.27]).box([0.54, 0.03, 0.03], [-0.3, 1.135, 0.27]).box([0.03, 0.66, 0.03], [-0.565, 1.45, 0.27]).box([0.03, 0.66, 0.03], [-0.035, 1.45, 0.27]).done();
    // DIN rail modules behind the window
    const din = kit.batch(cab, kit.mat(0xe7e6e1, { rough: 0.6 }), { shadow: false });
    din.box([0.48, 0.58, 0.004], [-0.3, 1.45, 0.252]);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) din.box([0.05, 0.16, 0.02], [-0.47 + i * 0.068, 1.32 + r * 0.26, 0.262]);
    din.done();
    // LED field and a small status display on the right door
    const ledList = [];
    for (let r = 0; r < 6; r++) for (let i = 0; i < 5; i++) ledList.push({ p: [0.15 + i * 0.075, 1.25 + r * 0.075, 0.262], r: [Math.PI / 2, 0, 0] });
    const leds = kit.inst(cab, new T.CylinderGeometry(0.014, 0.014, 0.012, 10), new T.MeshBasicMaterial({ color: 0xffffff }), ledList);
    const LED_ON = [new T.Color(0x35e06a), new T.Color(0xffb020), new T.Color(0xff3b30)], LED_OFF = new T.Color(0x1d2b22);
    const ledState = ledList.map((_, i) => ({ c: i % 11 === 4 ? 1 : i % 17 === 9 ? 2 : 0, rate: 0.6 + ((i * 37) % 11) / 6, ph: (i * 1.7) % 6.28, steady: i % 3 !== 0 }));
    const setLeds = t => { ledState.forEach((s, i) => leds.setColorAt(i, s.steady || reducedMotion || Math.sin(t * s.rate * 3 + s.ph) > -0.2 ? LED_ON[s.c] : LED_OFF)); leds.instanceColor.needsUpdate = true; };
    setLeds(0);
    const drawCab = (c, w, h) => {
      c.fillStyle = '#0d1a14'; c.fillRect(0, 0, w, h); c.fillStyle = '#35e06a'; c.font = '700 26px ui-monospace, monospace';
      c.fillText(tx('CZUJNIKI', 'SENSORS'), 14, 34);
      c.font = '600 22px ui-monospace, monospace'; c.fillStyle = '#9fe3b5';
      [tx('TEMP  °C', 'TEMP  °C'), tx('CIŚN  bar', 'PRES  bar'), tx('DRGANIA mm/s', 'VIBR  mm/s')].forEach((t, i) => c.fillText(t, 14, 76 + i * 34));
      c.fillStyle = '#35e06a'; c.fillText(tx('zapis co 1 min', 'logged every 1 min'), 14, h - 16);
    };
    const cabScreen = new T.Mesh(new T.PlaneGeometry(0.34, 0.22), new T.MeshBasicMaterial({ map: tex.screen(drawCab, { w: 340, h: 220 }), toneMapped: false }));
    cabScreen.position.set(0.3, 1.82, 0.256); cab.add(cabScreen);
    kit.prop.sign(cab, [0.2, 0.2], [-0.35, 1.9, 0.257], 0, tex.sign('warning', '', '⚡'));
    kit.plane(cab, [0.5, 0.1], [-0.25, 2.03, 0.257], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(256, 52, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1917'; c.font = '700 26px Raleway, system-ui'; c.textBaseline = 'middle'; c.fillText(tx('SZAFA CZUJNIKÓW S-2', 'SENSOR CABINET S-2'), 8, h / 2); }), rough: 0.6 }));
    // sensor cables from the cabinet to the retorts and the boiler, along the tray
    blacks.rod([6.62, 4.3, -1.2], [6.62, 4.3, -4.0], 0.015, 6).rod([6.62, 4.3, -4.0], [-5.6, 4.3, -4.0], 0.015, 6);

    // ---- STATION method: engineer desk on the right wall, with drawings and a hard hat ----
    const desk = new T.Group(); desk.position.set(6.55, 0, 3.0); desk.rotation.y = -Math.PI / 2; g.add(desk);
    const deskTop = kit.rbox(desk, [1.6, 0.04, 0.8], [0, 0.74, 0], M.wood, 0.008);
    const deskLegs = kit.batch(desk, M.paintGrey);
    for (const x of [-0.75, 0.75]) deskLegs.box([0.05, 0.72, 0.7], [x, 0.36, 0]);
    deskLegs.box([0.4, 0.6, 0.6], [0.5, 0.42, 0]);                            // drawer unit
    deskLegs.box([1.4, 0.03, 0.3], [0, 1.6, -0.25]);                          // shelf
    deskLegs.done();
    const deskMon = kit.rbox(desk, [0.6, 0.38, 0.04], [-0.25, 1.1, -0.2], M.dark, 0.01);
    const drawEng = (c, w, h) => {
      c.fillStyle = '#f2f5f7'; c.fillRect(0, 0, w, h); c.fillStyle = '#2d5f8f'; c.fillRect(0, 0, w, 42);
      c.fillStyle = '#fff'; c.font = '700 22px Raleway, system-ui'; c.fillText(tx('UTRZYMANIE RUCHU · PLAN', 'MAINTENANCE · PLAN'), 12, 28);
      c.fillStyle = '#1c1917'; c.font = '600 19px Raleway, system-ui';
      [tx('Które czujniki?', 'Which sensors?'), tx('Jaki próg alarmu?', 'Which alarm threshold?'), tx('Ile minut wcześniej?', 'How many minutes ahead?')].forEach((t, i) => { c.fillStyle = '#dfe6ec'; c.fillRect(12, 58 + i * 64, w - 24, 52); c.fillStyle = '#1c1917'; c.fillText(t, 24, 90 + i * 64); });
    };
    const engScreen = new T.Mesh(new T.PlaneGeometry(0.56, 0.34), new T.MeshBasicMaterial({ map: tex.screen(drawEng, { w: 560, h: 340 }), toneMapped: false }));
    engScreen.position.set(0, 0, 0.021); deskMon.add(engScreen);
    const deskBits = kit.batch(desk, M.dark, { shadow: false });
    deskBits.box([0.06, 0.2, 0.04], [-0.25, 0.86, -0.22]).box([0.25, 0.015, 0.18], [-0.25, 0.765, -0.22]).box([0.44, 0.02, 0.15], [-0.25, 0.77, 0.12]);
    for (let i = 0; i < 7; i++) deskBits.box([0.06, 0.3, 0.24], [-0.6 + i * 0.075, 1.77, -0.27]);
    deskBits.done();
    kit.plane(desk, [0.42, 0.3], [0.35, 0.765, 0.1], [-Math.PI / 2, 0, 0.12], kit.mat(0xffffff, { map: pidTex(), rough: 0.8 }));
    const hat = new T.Mesh(new T.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat(0xf4f4f0, { rough: 0.35 }));
    hat.position.set(0.55, 0.76, -0.2); hat.castShadow = true; desk.add(hat);
    kit.cyl(desk, 0.04, 0.1, [0.15, 0.81, -0.1], kit.mat(0x1f6fb2, { rough: 0.4 }));
    kit.plane(desk, [0.84, 0.6], [0.0, 1.35, -0.398], [0, 0, 0], kit.mat(0xffffff, { map: pidTex(true), rough: 0.8 }));
    const chair = kit.batch(desk, M.black);
    chair.box([0.45, 0.06, 0.45], [-0.1, 0.48, 0.65]).box([0.45, 0.5, 0.06], [-0.1, 0.78, 0.88]).cyl(0.03, 0.03, 0.42, [-0.1, 0.24, 0.65]).cyl(0.25, 0.25, 0.03, [-0.1, 0.03, 0.65]);
    chair.done();
    // red tool chest between the cabinet and the desk
    const tools = kit.batch(g, kit.mat(0xb8231b, { rough: 0.4, metal: 0.2 }));
    tools.box([0.5, 1.0, 0.75], [6.7, 0.5, 1.0]);
    tools.done();
    const drawerLines = kit.batch(g, M.galv, { shadow: false });
    for (let y = 0.2; y < 1.0; y += 0.15) drawerLines.box([0.01, 0.02, 0.5], [6.445, y, 1.0]);
    drawerLines.done();

    // lockout-tagout board and a wall clock on the right wall
    kit.plane(g, [0.8, 0.6], [W / 2 - 0.01, 1.5, 0.0], [0, -Math.PI / 2, 0], kit.mat(0xffffff, { map: kit.canvasTexture(320, 240, (c, w, h) => {
      c.fillStyle = '#c0221c'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 30px Raleway, system-ui'; c.textAlign = 'center'; c.fillText(tx('BLOKADA LOTO', 'LOCKOUT LOTO'), w / 2, 40);
      for (let i = 0; i < 6; i++) { const x = 40 + i * 48; c.fillStyle = '#f0bf00'; c.fillRect(x - 14, 90, 28, 34); c.strokeStyle = '#ddd'; c.lineWidth = 6; c.beginPath(); c.arc(x, 90, 10, Math.PI, 0); c.stroke(); c.fillStyle = '#fff'; c.fillRect(x - 16, 150, 32, 60); }
    }), rough: 0.6 }));
    const clockFace = kit.screenPlane(g, [0.36, 0.36], [W / 2 - 0.02, 2.6, 3.0], -Math.PI / 2, (c, w, h) => {
      c.fillStyle = '#f7f7f4'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); c.fill(); c.lineWidth = 10; c.strokeStyle = '#222'; c.stroke();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * (w / 2 - 22), h / 2 - Math.cos(a) * (w / 2 - 22)); c.lineTo(w / 2 + Math.sin(a) * (w / 2 - 44), h / 2 - Math.cos(a) * (w / 2 - 44)); c.stroke(); }
      c.lineWidth = 12; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 - 80, h / 2 + 40); c.stroke(); c.lineWidth = 8; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 40, h / 2 - 160); c.stroke();
    });
    clockFace.material.toneMapped = true; clockFace.geometry.dispose(); clockFace.geometry = new T.CircleGeometry(0.18, 36);

    // ---- STATION experiment: maintenance console in front of the retorts ----
    const con = new T.Group(); con.position.set(0.5, 0, -0.25); con.rotation.y = -0.88; g.add(con);
    const conB = kit.batch(con, M.cabinet);
    conB.box([0.7, 1.0, 0.45], [0, 0.5, 0]);
    conB.done();
    const conTop = kit.rbox(con, [0.76, 0.32, 0.5], [0, 1.12, 0.02], M.cabinet, 0.025);
    conTop.rotation.x = -0.5;
    const drawCon = (c, w, h) => {
      c.fillStyle = '#e9eef1'; c.fillRect(0, 0, w, h); c.fillStyle = '#2d5f8f'; c.fillRect(0, 0, w, 46);
      c.fillStyle = '#fff'; c.font = '700 24px Raleway, system-ui'; c.fillText(tx('KONSOLA UR · MODEL AWARII', 'MAINTENANCE · FAILURE MODEL'), 14, 31);
      const sens = [tx('temperatura', 'temperature'), tx('ciśnienie', 'pressure'), tx('drgania', 'vibration')];
      sens.forEach((t, i) => { const y = 84 + i * 50; c.fillStyle = '#c9d2d8'; c.fillRect(16, y - 20, 34, 30); c.fillStyle = '#1c1917'; c.font = '600 22px Raleway, system-ui'; c.fillText(t, 62, y + 2); });
      c.fillStyle = '#2f8f47'; c.fillRect(16, h - 60, 170, 44); c.fillStyle = '#fff'; c.font = '700 22px Raleway, system-ui'; c.fillText(tx('URUCHOM', 'RUN'), 50, h - 31);
    };
    const conScreen = new T.Mesh(new T.PlaneGeometry(0.5, 0.27), new T.MeshBasicMaterial({ map: tex.screen(drawCon, { w: 512, h: 276 }), toneMapped: false }));
    conScreen.position.set(-0.08, 0, 0.251); conTop.add(conScreen);
    const est = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.03, 20), M.pipeRed); est.rotation.x = Math.PI / 2; est.position.set(0.28, 0.06, 0.26); conTop.add(est);
    const estRing = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.01, 20), M.yellow); estRing.rotation.x = Math.PI / 2; estRing.position.set(0.28, 0.06, 0.252); conTop.add(estRing);
    // signal tower on the console
    const tower = [[0x2fd15a, true], [0xf0b400, false], [0xd02a20, false]];
    tower.forEach(([c, on], i) => { const m = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.06, 14), on ? new T.MeshBasicMaterial({ color: c }) : kit.mat(c, { rough: 0.3 })); m.position.set(0.28, 1.36 + i * 0.065, -0.15); con.add(m); });
    kit.cyl(con, 0.012, 0.12, [0.28, 1.27, -0.15], M.dark);

    // ---- STATION results: trend screen on the back wall ----
    const TX = 1.6, TY = 2.1;
    const trendFrame = kit.rbox(g, [1.9, 1.15, 0.08], [TX, TY, -D / 2 + 0.05], M.steel, 0.02);
    const drawTrend = (c, w, h) => {
      c.fillStyle = '#0d151b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e6eef3'; c.font = '700 34px Raleway, system-ui'; c.fillText(tx('Drgania · retorta', 'Vibration · retort'), 30, 52);
      c.fillStyle = '#9fb3c0'; c.font = '500 22px Raleway, system-ui'; c.fillText('mm/s', 30, 86);
      const x0 = 70, x1 = w - 30, y0 = h - 50, y1 = 110;
      const hi = Math.max(ALARM * 1.4, ...series), lo = 0, sy = v => y0 - (v - lo) / (hi - lo) * (y0 - y1);
      c.strokeStyle = '#2b3b46'; c.lineWidth = 1;
      for (let v = 0; v <= hi; v += 1) { c.beginPath(); c.moveTo(x0, sy(v)); c.lineTo(x1, sy(v)); c.stroke(); c.fillStyle = '#6f8593'; c.font = '500 18px Raleway, system-ui'; c.fillText(String(v), 36, sy(v) + 6); }
      c.setLineDash([14, 10]); c.strokeStyle = '#ff5a4f'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, sy(ALARM)); c.lineTo(x1, sy(ALARM)); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ff8a80'; c.font = '600 20px Raleway, system-ui'; c.fillText(tx(`PROCES-05: alarm > ${ALARM} mm/s`, `PROCES-05: alarm > ${ALARM} mm/s`), x0 + 12, sy(ALARM) - 10); // left end: the series is low there, its end is at the right
      if (series.length > 1) {
        c.strokeStyle = '#4fc3f7'; c.lineWidth = 3; c.beginPath();
        series.forEach((v, i) => { const x = x0 + i / (series.length - 1) * (x1 - x0); i ? c.lineTo(x, sy(v)) : c.moveTo(x, sy(v)); });
        c.stroke();
        const last = series[series.length - 1]; c.fillStyle = last > ALARM ? '#ff5a4f' : '#4fc3f7';
        c.beginPath(); c.arc(x1, sy(last), 7, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = '#6f8593'; c.font = '500 26px Raleway, system-ui'; c.fillText(tx('Brak odczytów', 'No readings yet'), x0 + 30, (y0 + y1) / 2);
      }
    };
    const trendScreen = new T.Mesh(new T.PlaneGeometry(1.8, 1.05), new T.MeshBasicMaterial({ map: tex.screen(drawTrend, { w: 900, h: 525 }), toneMapped: false }));
    trendScreen.position.set(0, 0, 0.041); trendFrame.add(trendScreen);

    // ---- lights ----
    // Key from the far left of the door view, so the retorts and consoles are modelled and their shadows come
    // forward across the tiles; weak fill, the hall reflections do the rest.
    g.add(new T.HemisphereLight(0xf1f4f6, 0x6d5f55, 0.45));
    const sun = new T.DirectionalLight(0xfff0d8, 3.0);
    sun.position.set(-9, 9, -7.5); sun.target.position.set(0.5, 0, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 34 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    g.add(sun, sun.target);
    for (const [x, z] of [[-4, 1.5], [2.5, 1.5], [-3.5, -2.5], [3, -2.6]]) { const p = new T.PointLight(0xfff3e2, 6.5, 11, 1.6); p.position.set(x, 4.0, z); g.add(p); }

    shells.done(); saddles.done(); reds.done(); blacks.done();
    kit.envAll(g, 0.9);

    function pidTex(wall) {
      return kit.canvasTexture(wall ? 420 : 300, 300, (c, w, h) => {
        c.fillStyle = wall ? '#eef3f8' : '#f7f7f2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2d5f8f'; c.lineWidth = 3; c.strokeRect(8, 8, w - 16, h - 16);
        c.lineWidth = 2; c.strokeStyle = '#1c1917';
        c.strokeRect(30, 90, 90, 60); c.strokeRect(w - 130, 90, 90, 60); c.beginPath(); c.moveTo(120, 120); c.lineTo(w - 130, 120); c.moveTo(75, 90); c.lineTo(75, 40); c.lineTo(w - 85, 40); c.lineTo(w - 85, 90); c.stroke();
        c.beginPath(); c.arc(w / 2, 120, 14, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#1c1917'; c.font = '600 16px Raleway, system-ui'; c.fillText(tx('R-1', 'R-1'), 60, 125); c.fillText('K-1', w - 100, 125); c.fillText('P&ID', 20, h - 20);
        c.fillStyle = '#6b6a66'; for (let i = 0; i < 4; i++) c.fillRect(30, 190 + i * 18, w - 60 - i * 30, 5);
      });
    }

    let clock = 0;
    function tick(dt) {
      if (reducedMotion) return;
      clock += dt; setLeds(clock);
    }

    return {
      scene: g,
      bounds: { x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2 },
      lights: 'none',
      background: 0xc9cdcc,
      fog: { color: 0xc9cdcc, near: 12, far: 34 },
      spawn: { pos: [-4.5, 1.65, 3.9], yaw: -0.87 },
      colliders: [
        [RX0 - 0.35, -4.8, RX1 + 0.45, -1.15],                  // retorts with doors
        [-1.6, -4.9, 0.0, -1.4],                                // basket, recorder post
        [BOX0 - 1.0, -4.7, BOX1 + 0.2, -2.4],                   // boiler and burner
        [-3.2, 0.15, -2.6, 0.75],                               // shift log stand
        [6.3, -1.85, 7, -0.55],                                 // sensor cabinet
        [5.4, 2.1, 7, 3.9],                                     // desk and chair
        [6.4, 0.6, 7, 1.4],                                     // tool chest
        [0.1, -0.65, 0.9, 0.15],                                // console
        [-6.8, 1.2, -5.0, 3.9],                                 // tanks and drums
        [1.1, 3.9, 3.2, 5],                                     // air receiver, compressor
      ],
      stations: [
        { key: 'brief', label: { pl: 'Dziennik zmiany', en: 'Shift log' }, meshes: [lect], anchor: [-2.9, 1.1, 0.45], view: kit.view([-2.9 - Math.sin(0.43) * 1.25, 1.65, 0.45 + Math.cos(0.43) * 1.25], [-2.9, 1.05, 0.45], 0.25) },
        { key: 'data', label: { pl: 'Szafa czujników', en: 'Sensor cabinet' }, meshes: [cab], anchor: [6.36, 1.45, -1.2], view: kit.view([4.3, 1.65, -1.2], [6.36, 1.4, -1.2]) },
        { key: 'method', label: { pl: 'Biurko inżyniera', en: "Engineer's desk" }, meshes: [desk], anchor: [6.35, 1.1, 3.25], view: kit.view([4.75, 1.65, 3.0], [6.55, 1.0, 3.0]) },
        { key: 'experiment', label: { pl: 'Konsola utrzymania ruchu', en: 'Maintenance console' }, meshes: [con], anchor: [0.5, 1.15, -0.25], view: kit.view([0.5 - Math.sin(0.88) * 1.4, 1.65, -0.25 + Math.cos(0.88) * 1.4], [0.5, 1.1, -0.25]) },
        { key: 'results', label: { pl: 'Ekran trendu', en: 'Trend screen' }, meshes: [trendFrame], anchor: [TX, TY + 0.42, -D / 2 + 0.1], view: kit.view([TX + 0.2, 1.65, -2.6], [TX, TY - 0.05, -D / 2], 0.25) },
      ],
      tick,
    };
  });
})();
