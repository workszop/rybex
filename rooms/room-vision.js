// Room "vision": Rybex production hall, line 2. Cans leave the seamer on a conveyor, pass under the inspection camera
// gantry, a pusher kicks some into the reject bin, the rest go on to the basket loader.
// Stations: brief = memo board by the door, data = inspection monitor (data.photos), method = QA desk,
// experiment = camera control console, results = wall screen.
// Classic script; needs rooms/engine.js (window.Rooms) first.
(function () {
  'use strict';
  if (!window.Rooms) return;
  const W = 18, D = 12, H = 6.5; // hall: x -9..9, z -6..6, roof at 6.5
  const BELT_Z = -0.6, BELT_Y = 0.95, BELT_X0 = -9, BELT_X1 = 6.7, PUSH_X = 0.4, CAN_R = 0.037, CAN_H = 0.105;

  Rooms.define('vision', ({ THREE: T, kit, lang, data, reducedMotion }) => {
    const tx = (pl, en) => lang === 'en' ? en : pl;
    const tex = kit.tex, g = new T.Group();
    const d = (data && data.vision) || data || {};
    const brand = (d.brand || 'Rybex').toUpperCase();
    // On file:// only data: URLs can go into a WebGL texture (a file image would taint the canvas).
    const usable = src => typeof src === 'string' && (location.protocol !== 'file:' || /^data:image\//.test(src));
    const pick = dd => (Array.isArray(dd.photos) ? dd.photos : []).filter(usable).slice(0, 6);
    let photos = pick(d);

    // ---- materials ----
    const M = {
      floor: kit.mat(0xb3b8ae, { map: kit.tile(tex.concrete(), W / 2.2, D / 2.2), rough: 0.58, roughMap: [W / 3.7, D / 3.7] }), // sealed concrete: worn matt, glossier where it is wiped
      wall: kit.mat(0xf3f1ea, { map: tex.paintedWall('#eceae3'), rough: 0.9, bump: 1.2 }),
      plinth: kit.mat(0x5b6a62, { rough: 0.5 }),
      clad: kit.mat(0xe2e5e6, { map: tex.cladding('#d9dcdd'), rough: 0.6, metal: 0.15 }),
      roof: kit.mat(0x9da3a6, { map: tex.cladding('#c4c8ca'), rough: 0.7, metal: 0.1 }),
      frame: kit.mat(0x4d5d6b, { rough: 0.5, metal: 0.35 }),
      stainless: kit.mat(0xe4e7ea, { map: tex.brushedSteel(), rough: 0.42, metal: 0.75, roughMap: [0.8, 0.8] }),
      galv: kit.mat(0xb9bec0, { map: tex.brushedSteel(), rough: 0.55, metal: 0.7 }),
      yellow: kit.mat(0xe2b300, { rough: 0.8 }),                       // floor paint: matt, worn
      paintY: kit.mat(0xf0bf00, { rough: 0.3 }),                       // glossy machine enamel
      hazard: kit.mat(0xffffff, { map: tex.hazard(), rough: 0.5 }),
      black: kit.mat(0x1d1e1f, { rough: 0.82 }),                       // rubber, cable sheath: broad dull highlight
      darkPlastic: kit.mat(0x2a2d30, { rough: 0.38 }),
      blue: kit.mat(0x1f5f9e, { rough: 0.32, metal: 0.1 }),
      red: kit.mat(0xc0221c, { rough: 0.3 }),
      green: kit.mat(0x2f8f47, { rough: 0.45 }),
      grate: kit.mat(0xffffff, { map: tex.grate(), rough: 0.35, metal: 0.7 }),
      cardboard: kit.mat(0xffffff, { map: tex.cardboard(), rough: 0.85 }),
      wood: kit.mat(0xc49a63, { map: tex.cardboard(), rough: 0.85 }),
      glass: new T.MeshStandardMaterial({ color: 0xdfe9ef, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false }),
      strip: new T.MeshStandardMaterial({ color: 0xcfe0e6, roughness: 0.2, transparent: true, opacity: 0.45, depthWrite: false, side: T.DoubleSide }),
      lamp: new T.MeshBasicMaterial({ color: 0xfff7e6, toneMapped: false }),
      sky: new T.MeshBasicMaterial({ color: 0xffffff, map: skyTex() }),
    };
    function skyTex() {
      return kit.canvasTexture(512, 256, (c, w, h) => {
        const r = kit.rng(5);
        kit.paint.sky(c, w, h, r, { top: '#a9cce8', horizon: '#eef4f7', to: 0.9, clouds: 3 });
        kit.paint.treeLine(c, w, h, h * 1.04, r, { rows: 2, size: 0.8 });   // treetops beyond the yard
        c.fillStyle = 'rgba(120,130,135,.5)'; c.fillRect(0, h * 0.9, w, h * 0.1); // the yard roofs in front
      });
    }

    // ---- shell: floor, walls, roof, structure ----
    const floor = kit.plane(g, [W, D], [0, 0, 0], [-Math.PI / 2, 0, 0], M.floor);
    floor.receiveShadow = true;
    const walls = kit.batch(g, M.wall, { uv: 1 / 1.6, shadow: false });
    const clad = kit.batch(g, M.clad, { uv: 0.5, shadow: false });
    const plinth = kit.batch(g, M.plinth, { shadow: false });
    const LOW = 3; // painted blockwork up to 3 m, cladding above
    // back (z = -6) and right (x = 9): plain
    walls.box([W, LOW, 0.2], [0, LOW / 2, -D / 2 - 0.1]); clad.box([W, H - LOW, 0.1], [0, LOW + (H - LOW) / 2, -D / 2 - 0.05]);
    walls.box([0.2, LOW, D], [W / 2 + 0.1, LOW / 2, 0]); clad.box([0.1, H - LOW, D], [W / 2 + 0.05, LOW + (H - LOW) / 2, 0]);
    // front (z = 6) with the door at x -3.6..-2.4
    walls.box([5.4, LOW, 0.2], [-6.3, LOW / 2, D / 2 + 0.1]); walls.box([11.4, LOW, 0.2], [3.3, LOW / 2, D / 2 + 0.1]); walls.box([1.2, LOW - 2.2, 0.2], [-3, 2.2 + (LOW - 2.2) / 2, D / 2 + 0.1]);
    clad.box([W, H - LOW, 0.1], [0, LOW + (H - LOW) / 2, D / 2 + 0.05]);
    // left (x = -9) with the belt opening from the filling room at z -1.1..-0.1, up to 1.7 m
    walls.box([0.2, LOW, 4.9], [-W / 2 - 0.1, LOW / 2, -3.55]); walls.box([0.2, LOW, 6.1], [-W / 2 - 0.1, LOW / 2, 2.95]); walls.box([0.2, LOW - 1.7, 1.0], [-W / 2 - 0.1, 1.7 + (LOW - 1.7) / 2, -0.6]);
    clad.box([0.1, H - LOW, D], [-W / 2 - 0.05, LOW + (H - LOW) / 2, 0]);
    // hygienic coving: a dark band at the foot of every wall
    plinth.box([W, 0.15, 0.03], [0, 0.075, -D / 2 + 0.015]); plinth.box([0.03, 0.15, D], [W / 2 - 0.015, 0.075, 0]);
    plinth.box([5.4, 0.15, 0.03], [-6.3, 0.075, D / 2 - 0.015]); plinth.box([11.4, 0.15, 0.03], [3.3, 0.075, D / 2 - 0.015]);
    plinth.box([0.03, 0.15, 4.9], [-W / 2 + 0.015, 0.075, -3.55]); plinth.box([0.03, 0.15, 6.1], [-W / 2 + 0.015, 0.075, 2.95]);
    // wall/cladding joint: a galvanised flashing strip
    const galv = kit.batch(g, M.galv, { uv: 1, shadow: false });
    galv.box([W, 0.06, 0.06], [0, LOW, -D / 2 + 0.03]); galv.box([0.06, 0.06, D], [W / 2 - 0.03, LOW, 0]); galv.box([W, 0.06, 0.06], [0, LOW, D / 2 - 0.03]); galv.box([0.06, 0.06, D], [-W / 2 + 0.03, LOW, 0]);
    // roof underside with three skylight strips
    kit.batch(g, M.roof, { uv: 0.5, shadow: false }).box([W, 0.1, D], [0, H + 0.05, 0]).done();
    const lamp = kit.batch(g, M.lamp, { shadow: false, receive: false });
    for (const x of [-4.5, 0, 4.5]) lamp.box([1.1, 0.02, D - 2], [x, H - 0.005, 0]);
    // steel portal frames across the hall every 3 m: columns at both long walls, a rafter, purlins along x
    const steel = kit.batch(g, M.frame, { uv: 1 });
    for (const x of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]) {
      for (const z of [-D / 2 + 0.17, D / 2 - 0.17]) { steel.box([0.3, H, 0.012], [x, H / 2, z]); steel.box([0.012, H, 0.3], [x - 0.15, H / 2, z]); steel.box([0.012, H, 0.3], [x + 0.15, H / 2, z]); }
      steel.box([0.2, 0.5, D], [x, H - 0.3, 0]).box([0.02, 0.012, D], [x, H - 0.56, 0]);
    }
    for (let z = -5; z <= 5; z += 2.5) steel.box([W, 0.14, 0.07], [0, H - 0.08, z]);
    // column guards: hazard-striped sleeves
    const haz = kit.batch(g, M.hazard, { uv: 2.5, shadow: false });
    for (const x of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]) for (const z of [-D / 2 + 0.25, D / 2 - 0.25]) haz.box([0.42, 0.9, 0.36], [x, 0.45, z]);
    // windows high in both long walls, sky behind
    const winFrame = kit.batch(g, M.galv, { shadow: false });
    const sky = kit.batch(g, M.sky, { shadow: false, receive: false });
    for (const z of [-3, 0, 3]) for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.01);
      sky.add(new T.PlaneGeometry(2.4, 1.2), [x, 4.6, z], [0, -sx * Math.PI / 2, 0]);
      for (const dz of [-1.2, -0.4, 0.4, 1.2]) winFrame.box([0.08, 1.26, 0.06], [x - sx * 0.03, 4.6, z + dz]);
      winFrame.box([0.08, 0.06, 2.46], [x - sx * 0.03, 4.0, z]).box([0.08, 0.06, 2.46], [x - sx * 0.03, 5.2, z]);
    }

    // the door: steel leaf with a vision panel and a push bar, in a frame
    const door = kit.batch(g, M.galv, { uv: 1, shadow: false });
    door.box([1.2, 2.2, 0.05], [-3, 1.1, D / 2 - 0.02]).box([0.08, 2.26, 0.12], [-3.64, 1.13, D / 2 - 0.02]).box([0.08, 2.26, 0.12], [-2.36, 1.13, D / 2 - 0.02]).box([1.36, 0.08, 0.12], [-3, 2.24, D / 2 - 0.02]);
    door.box([0.9, 0.04, 0.05], [-3, 1.05, D / 2 - 0.1]).box([0.04, 0.04, 0.06], [-3.42, 1.05, D / 2 - 0.07]).box([0.04, 0.04, 0.06], [-2.58, 1.05, D / 2 - 0.07]);
    door.done();
    kit.box(g, [0.3, 0.5, 0.06], [-3.2, 1.65, D / 2 - 0.02], new T.MeshStandardMaterial({ color: 0x9fb4c0, roughness: 0.05, metalness: 0.3 })).castShadow = false;
    kit.box(g, [1.2, 0.25, 0.055], [-3, 0.125, D / 2 - 0.02], M.stainless).castShadow = false; // kick plate

    // ---- floor markings, drains ----
    const paint = kit.batch(g, M.yellow, { shadow: false });
    const line = (x0, z0, x1, z1) => paint.box([Math.abs(x1 - x0) || 0.1, 0.004, Math.abs(z1 - z0) || 0.1], [(x0 + x1) / 2, 0.002, (z0 + z1) / 2]);
    line(-8.4, 0.35, 7.9, 0.35); line(-8.4, -1.55, 7.9, -1.55);            // keep-clear lines along the conveyor
    line(-8.4, 0.35, -8.4, -1.55); line(7.9, 0.35, 7.9, -1.55);
    line(-4.0, 5.95, -4.0, 1.4); line(-2.0, 5.95, -2.0, 1.4);              // walkway from the door
    line(-8.6, 1.4, 8.6, 1.4);                                              // cross aisle
    line(4.75, -2.6, 4.75, -5.6); line(7.25, -2.6, 7.25, -5.6); line(4.75, -2.6, 7.25, -2.6); // QA bay
    const hatch = kit.batch(g, M.hazard, { uv: 1.2, shadow: false });
    hatch.box([2.6, 0.004, 0.5], [-6.6, 0.002, 0.65]);                     // keep-out zone in front of the seamer
    paint.done(); hatch.done();
    // a strip drain along the near side of the conveyor and two gully gratings
    const grate = kit.batch(g, M.grate, { uv: 3, shadow: false });
    grate.box([12, 0.006, 0.16], [-1.5, 0.003, 0.08]); grate.box([0.4, 0.006, 0.4], [-5.2, 0.003, 3.2]); grate.box([0.4, 0.006, 0.4], [6.5, 0.003, -3.0]);
    grate.done();

    // ---- the conveyor ----
    const beltTex = kit.canvasTexture(256, 64, (c, w, h) => {
      c.fillStyle = '#3b4044'; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) { c.fillStyle = '#2a2e31'; c.fillRect(x, 0, 2, h); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x + 2, 0, 1, h); }
      for (let y = 8; y < h; y += 16) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, y, w, 1); }
    }, { repeat: [(BELT_X1 - BELT_X0) / 0.8, 1] });
    const beltMat = kit.mat(0xffffff, { map: beltTex, rough: 0.88 });
    const belt = kit.box(g, [BELT_X1 - BELT_X0, 0.02, 0.3], [(BELT_X0 + BELT_X1) / 2, BELT_Y - 0.01, BELT_Z], beltMat);
    belt.castShadow = false;
    const conv = kit.batch(g, M.stainless, { uv: 1 });
    const LEN = BELT_X1 - BELT_X0, CX = (BELT_X0 + BELT_X1) / 2;
    conv.rbox([LEN, 0.14, 0.03], [CX, BELT_Y - 0.06, BELT_Z - 0.18], undefined, 0.008).rbox([LEN, 0.14, 0.03], [CX, BELT_Y - 0.06, BELT_Z + 0.18], undefined, 0.008);
    for (const sz of [-1, 1]) {                                      // guide rails on posts
      conv.box([LEN, 0.018, 0.018], [CX, BELT_Y + 0.07, BELT_Z + sz * 0.065]);
      for (let x = BELT_X0 + 0.5; x < BELT_X1; x += 1.0) conv.box([0.015, 0.1, 0.015], [x, BELT_Y + 0.03, BELT_Z + sz * 0.17]).box([0.015, 0.015, 0.1], [x, BELT_Y + 0.07, BELT_Z + sz * 0.12]);
    }
    for (let x = BELT_X0 + 0.6; x < BELT_X1; x += 1.5) {             // legs, cross bars, feet
      for (const sz of [-1, 1]) conv.box([0.05, BELT_Y - 0.12, 0.05], [x, (BELT_Y - 0.12) / 2, BELT_Z + sz * 0.17]).cyl(0.04, 0.05, 0.03, [x, 0.015, BELT_Z + sz * 0.17]);
      conv.box([0.04, 0.04, 0.34], [x, 0.25, BELT_Z]).box([0.04, 0.04, 0.34], [x, BELT_Y - 0.16, BELT_Z]);
    }
    // a motor and gearbox under the far end
    kit.cyl(g, 0.09, 0.3, [BELT_X1 - 0.5, BELT_Y - 0.22, BELT_Z + 0.33], M.blue).rotation.x = Math.PI / 2;
    conv.box([0.2, 0.2, 0.18], [BELT_X1 - 0.5, BELT_Y - 0.22, BELT_Z + 0.12]);
    // strip curtain where the belt comes in from the filling room
    const strips = kit.batch(g, M.strip, { shadow: false, receive: false });
    for (let z = -1.08; z <= -0.12; z += 0.2) strips.add(new T.PlaneGeometry(0.2, 1.7), [-W / 2 + 0.02, 0.85, z], [0, Math.PI / 2 + 0.06, 0]);
    strips.done();

    // ---- the seamer: stainless base, turret behind a polycarbonate guard, lid stack, HMI and a signal tower ----
    const SX = -6.6;
    conv.rbox([1.8, 1.0, 1.1], [SX, 0.5, BELT_Z], undefined, 0.025);  // base cabinet
    conv.rbox([1.9, 0.05, 1.2], [SX, 1.02, BELT_Z], undefined, 0.012); // table top
    // how it is built: the guard is polycarbonate in a stainless frame; the base has two service doors with
    // handles, and a louvre next to the main motor
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.45, 0.45]) conv.box([0.03, 0.85, 0.03], [SX + 0.1 + dx, 1.48, BELT_Z + dz]);
    for (const dz of [-0.45, 0.45]) conv.box([1.23, 0.03, 0.03], [SX + 0.1, 1.905, BELT_Z + dz]);
    for (const dx of [-0.6, 0.6]) conv.box([0.03, 0.03, 0.9], [SX + 0.1 + dx, 1.905, BELT_Z]);
    const fit = kit.batch(g, M.black, { shadow: false });
    for (const dx of [-0.25, 0.35, 0.87]) fit.box([0.008, 0.9, 0.006], [SX + dx, 0.5, BELT_Z + 0.551]);
    for (const dx of [0.29, 0.41]) fit.box([0.02, 0.16, 0.025], [SX + dx, 0.62, BELT_Z + 0.562]);
    for (let i = 0; i < 6; i++) fit.box([0.34, 0.012, 0.012], [SX + 0.6, 0.2 + i * 0.03, BELT_Z + 0.553], [0.5, 0, 0]);
    fit.box([0.5, 0.008, 0.006], [BELT_X1 + 0.35, 0.9, BELT_Z + 0.602]).box([0.008, 0.86, 0.006], [BELT_X1 + 0.35, 0.47, BELT_Z + 0.602]); // loader doors
    fit.done();
    conv.cyl(0.33, 0.36, 0.7, [SX + 0.25, 1.4, BELT_Z]);              // seaming turret
    conv.cyl(0.42, 0.42, 0.12, [SX + 0.25, 1.81, BELT_Z]);
    conv.cyl(0.07, 0.07, 0.9, [SX - 0.45, 1.5, BELT_Z - 0.2]);        // lid stack column
    conv.box([0.18, 0.5, 0.18], [SX + 0.25, 2.12, BELT_Z]);           // drive head
    kit.box(g, [1.2, 0.85, 0.9], [SX + 0.1, 1.48, BELT_Z], M.glass).castShadow = false;
    const lids = kit.batch(g, M.galv, { shadow: false });
    for (let i = 0; i < 18; i++) lids.cyl(0.04, 0.04, 0.008, [SX - 0.45, 1.1 + i * 0.012, BELT_Z - 0.2], [0, 0, 0], 16);
    kit.cyl(g, 0.16, 0.42, [SX - 0.55, 0.5, BELT_Z + 0.58], M.blue).rotation.z = Math.PI / 2; // main motor
    conv.box([0.06, 0.6, 0.06], [SX + 0.8, 1.35, BELT_Z + 0.58]);    // HMI arm
    kit.rbox(g, [0.36, 0.28, 0.06], [SX + 0.8, 1.72, BELT_Z + 0.6], M.darkPlastic, 0.012);
    kit.screenPlane(g, [0.31, 0.22], [SX + 0.8, 1.72, BELT_Z + 0.632], 0, (c, w, h) => {
      c.fillStyle = '#0f2233'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, 54);
      c.fillStyle = '#fff'; c.font = '700 34px Raleway, system-ui'; c.fillText(tx('ZAMYKARKA L2', 'SEAMER L2'), 18, 38);
      c.font = '600 30px Raleway, system-ui'; c.fillStyle = '#cfe3f1';
      [[tx('Wydajność', 'Rate'), '240/min'], [tx('Licznik', 'Count'), '41 862'], [tx('Stan', 'State'), 'RUN']].forEach(([k, v], i) => { c.fillText(k, 18, 110 + i * 56); c.fillText(v, w - 200, 110 + i * 56); });
    });
    // signal tower (green lit)
    conv.cyl(0.015, 0.015, 0.3, [SX - 0.75, 1.2, BELT_Z + 0.45]);
    const tower = [[0x2fd15a, true], [0xf0b400, false], [0xd02a20, false]];
    tower.forEach(([c, on], i) => { const m = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.07, 16), on ? new T.MeshBasicMaterial({ color: c }) : kit.mat(c, { rough: 0.3 })); m.position.set(SX - 0.75, 1.39 + i * 0.075, BELT_Z + 0.45); g.add(m); });
    // basket loader at the end of the line
    conv.rbox([0.8, 1.3, 1.2], [BELT_X1 + 0.35, 0.65, BELT_Z], undefined, 0.025);
    for (const dx of [-0.34, 0.34]) for (const dz of [-0.49, 0.49]) conv.box([0.025, 0.4, 0.025], [BELT_X1 + 0.35 + dx, 1.5, BELT_Z + dz]);
    kit.box(g, [0.7, 0.4, 1.0], [BELT_X1 + 0.35, 1.5, BELT_Z], M.glass).castShadow = false;
    kit.box(g, [0.82, 0.06, 0.16], [BELT_X1 + 0.35, 1.3, BELT_Z + 0.55], M.hazard);
    // a stainless pipe pair along the back wall, dropping to the seamer
    for (const [y, r] of [[4.35, 0.045], [4.5, 0.03]]) {
      conv.rod([-W / 2, y, -D / 2 + 0.35], [W / 2, y, -D / 2 + 0.35], r, 12);
      for (let x = -8; x <= 8; x += 2) conv.box([0.05, 0.2, 0.05], [x, y + 0.1, -D / 2 + 0.3]);
    }
    conv.rod([SX + 0.25, 4.35, -D / 2 + 0.35], [SX + 0.25, 4.35, BELT_Z], 0.045, 12).rod([SX + 0.25, 4.35, BELT_Z], [SX + 0.25, 2.37, BELT_Z], 0.045, 12);
    // hand-wash basin and dispenser by the door
    conv.box([0.6, 0.25, 0.45], [0.2, 0.95, D / 2 - 0.25]).box([0.04, 0.85, 0.04], [0.2, 0.42, D / 2 - 0.25]).rod([0.2, 1.08, D / 2 - 0.08], [0.2, 1.2, D / 2 - 0.25], 0.012, 8);
    kit.box(g, [0.14, 0.26, 0.1], [0.65, 1.35, D / 2 - 0.05], kit.mat(0xf2f2f2, { rough: 0.4 }));

    // ---- camera gantry over the belt ----
    const GX = -1.8;
    const alu = kit.batch(g, M.paintY);
    for (const x of [GX - 0.4, GX + 0.4]) for (const z of [BELT_Z - 0.48, BELT_Z + 0.48]) alu.rbox([0.08, 2.2, 0.08], [x, 1.1, z], undefined, 0.01).box([0.22, 0.02, 0.22], [x, 0.01, z]);
    alu.rbox([0.08, 0.08, 1.04], [GX - 0.4, 2.2, BELT_Z], undefined, 0.01).rbox([0.08, 0.08, 1.04], [GX + 0.4, 2.2, BELT_Z], undefined, 0.01).rbox([0.88, 0.08, 0.08], [GX, 2.2, BELT_Z - 0.48], undefined, 0.01).rbox([0.88, 0.08, 0.08], [GX, 2.2, BELT_Z + 0.48], undefined, 0.01);
    alu.box([0.08, 0.06, 1.04], [GX, 1.62, BELT_Z]);
    alu.done();
    // inspection hood over the belt (dark inside) with a ring light and two cameras
    kit.box(g, [0.7, 0.03, 0.6], [GX, 1.32, BELT_Z], M.stainless);
    kit.box(g, [0.7, 0.3, 0.03], [GX, 1.17, BELT_Z - 0.3], M.stainless); kit.box(g, [0.7, 0.3, 0.03], [GX, 1.17, BELT_Z + 0.3], M.stainless);
    const ring = new T.Mesh(new T.TorusGeometry(0.11, 0.018, 10, 36), new T.MeshBasicMaterial({ color: 0xeaf6ff }));
    ring.rotation.x = Math.PI / 2; ring.position.set(GX, 1.3, BELT_Z); g.add(ring);
    const cam = kit.batch(g, M.black);
    cam.box([0.12, 0.2, 0.12], [GX, 1.48, BELT_Z]).cyl(0.035, 0.035, 0.08, [GX, 1.36, BELT_Z]);
    cam.box([0.18, 0.1, 0.1], [GX + 0.18, 1.9, BELT_Z + 0.46], [0.5, 0, 0]).cyl(0.03, 0.03, 0.07, [GX + 0.18, 1.86, BELT_Z + 0.52], [Math.PI / 2 + 0.5, 0, 0]);
    // cable from the camera to the console, in a drag chain along the gantry and down
    // camera cables: up to the beam, down the near leg, then along the floor under a cable cover to the console
    const LX = GX + 0.44, LZ = BELT_Z + 0.48;
    cam.rod([GX, 1.58, BELT_Z], [GX, 2.26, BELT_Z], 0.012, 6).rod([GX, 2.26, BELT_Z], [LX, 2.26, LZ], 0.012, 6).rod([LX, 2.26, LZ], [LX, 0.03, LZ], 0.014, 6);
    cam.rod([GX, 2.26, BELT_Z], [GX, 4.0, BELT_Z], 0.02, 6).rod([GX + 0.05, 2.26, BELT_Z], [GX + 0.05, 4.0, BELT_Z], 0.014, 6); // power and data from the overhead tray
    kit.batch(g, M.hazard, { uv: 4, shadow: false }).box([0.12, 0.03, 1.0], [LX, 0.015, LZ + 0.5]).box([Math.abs(-0.9 - LX), 0.03, 0.12], [(LX - 0.9) / 2, 0.015, LZ + 1.0]).done();
    // light-barrier trigger on the belt rail
    cam.box([0.05, 0.08, 0.05], [GX - 0.6, BELT_Y + 0.1, BELT_Z + 0.2]).box([0.05, 0.08, 0.05], [GX - 0.6, BELT_Y + 0.1, BELT_Z - 0.2]);
    cam.done();
    // the light barrier's beam across the belt: a can breaking it triggers the camera
    kit.batch(g, new T.MeshBasicMaterial({ color: 0xff3524 }), { shadow: false, receive: false }).rod([GX - 0.6, BELT_Y + 0.1, BELT_Z - 0.175], [GX - 0.6, BELT_Y + 0.1, BELT_Z + 0.175], 0.003, 5).done();
    // the pusher that rejects cans, and the reject bin
    conv.box([0.16, 0.16, 0.2], [PUSH_X, BELT_Y + 0.12, BELT_Z - 0.32]);
    const pusher = kit.box(g, [0.12, 0.08, 0.04], [PUSH_X, BELT_Y + 0.05, BELT_Z - 0.2], M.red);
    conv.box([0.4, 0.02, 0.5], [PUSH_X, BELT_Y - 0.1, BELT_Z + 0.43], [0.45, 0, 0]); // chute
    const binMat = kit.mat(0x2b62a8, { rough: 0.36 });
    const bin = kit.batch(g, binMat);
    bin.box([0.7, 0.05, 0.6], [PUSH_X, 0.12, 0.3]).rbox([0.7, 0.62, 0.04], [PUSH_X, 0.43, 0.02], undefined, 0.012).rbox([0.7, 0.62, 0.04], [PUSH_X, 0.43, 0.58], undefined, 0.012).rbox([0.04, 0.62, 0.6], [PUSH_X - 0.33, 0.43, 0.3], undefined, 0.012).rbox([0.04, 0.62, 0.6], [PUSH_X + 0.33, 0.43, 0.3], undefined, 0.012);
    bin.rbox([0.76, 0.035, 0.66], [PUSH_X, 0.745, 0.3], undefined, 0.012); // rolled rim
    for (const x of [-0.28, 0.28]) for (const z of [0.06, 0.54]) bin.cyl(0.035, 0.035, 0.04, [PUSH_X + x, 0.04, z], [Math.PI / 2, 0, 0]);
    bin.done();
    kit.prop.sign(g, [0.36, 0.22], [PUSH_X, 0.55, 0.605], 0, signTex(tx('ODRZUT', 'REJECTS'), '#c0221c'));

    // ---- cans: instanced, label texture from the brand ----
    const labelTex = kit.canvasTexture(512, 128, (c, w, h) => {
      c.fillStyle = '#c9cdd0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f6fb2'; c.fillRect(0, 22, w, 84); c.fillStyle = '#fff'; c.fillRect(0, 68, w, 4);
      for (let i = 0; i < 2; i++) {
        const x = 64 + i * 256; c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(x, 44, 44, 17, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1c1917'; c.font = '800 20px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(brand.slice(0, 8), x, 45);
        c.fillStyle = '#dfe9f2'; c.beginPath(); c.ellipse(x + 120, 88, 46, 9, 0, 0, Math.PI * 2); c.fill();
      }
    });
    const canMats = [kit.mat(0xffffff, { map: labelTex, rough: 0.35, metal: 0.4 }), M.galv, M.galv];
    const canGeo = new T.CylinderGeometry(CAN_R, CAN_R, CAN_H, 20);
    const SPACING = 0.24, N = Math.floor((BELT_X1 - (SX + 0.9)) / SPACING);
    const START = SX + 0.9 - 0.15, END = BELT_X1 + 0.1;
    const cans = new T.InstancedMesh(canGeo, canMats, N + 8);
    cans.castShadow = true; cans.receiveShadow = true; g.add(cans);
    // Every 7th can is "flagged" and gets pushed into the bin. Stacked rejected cans lie in the bin.
    const state = Array.from({ length: N }, (_, i) => ({ x: START + i * SPACING, bad: i % 7 === 3, push: 0 }));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1);
    const binned = [[-0.15, 0.2, 0.2, 1.4], [0.05, 0.25, 0.35, 0.3], [0.18, 0.18, 0.3, 2.1], [-0.05, 0.2, 0.45, 1.0], [0.12, 0.3, 0.15, 0.6], [-0.2, 0.27, 0.36, 2.6], [0.0, 0.33, 0.25, 1.8], [0.2, 0.26, 0.48, 0.9]];
    binned.forEach(([x, y, z, rz], i) => cans.setMatrixAt(N + i, m4.compose(v.set(PUSH_X + x, y, z), q.setFromEuler(e.set(Math.PI / 2, 0, rz)), one)));
    const placeCans = () => {
      state.forEach((s, i) => cans.setMatrixAt(i, m4.compose(v.set(s.x, BELT_Y + CAN_H / 2, BELT_Z + s.push * 0.42), q.set(0, 0, 0, 1), s.push > 0.6 ? v.clone().set(1, 1 - (s.push - 0.6) * 2.2, 1) : one)));
      cans.instanceMatrix.needsUpdate = true;
    };
    placeCans(); cans.computeBoundingSphere();
    // cans stacked on a tray at the QA desk and a pallet of empty cans by the seamer (static instances)
    const extra = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) extra.push({ p: [6.15 + i * 0.09, 0.958 + CAN_H / 2, -5.2 + j * 0.09] });
    kit.inst(g, canGeo, canMats, extra);

    // ---- pallets, crates, cartons ----
    const wood = kit.batch(g, M.wood, { uv: 2 });
    const cart = kit.batch(g, M.cardboard, { uv: 1.5 });
    const cartonPrint = kit.mat(0xffffff, { map: cartonTex(), rough: 0.85 });
    const print = kit.batch(g, cartonPrint, { shadow: false });
    const stack = (x, z, layers) => {
      kit.prop.pallet(wood, [x, z]);
      for (let l = 0; l < layers; l++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const bx = x - 0.4 + i * 0.4, bz = z - 0.2 + j * 0.4, by = 0.144 + 0.15 + l * 0.3;
        cart.box([0.39, 0.29, 0.39], [bx, by, bz]);
        if (j === 1) print.add(new T.PlaneGeometry(0.3, 0.2), [bx, by, bz + 0.196]);
      }
    };
    stack(-7.9, -4.9, 4); stack(-6.5, -4.9, 3); stack(-7.9, -3.7, 2);
    kit.prop.pallet(wood, [-5.1, -5.2]);
    // blue plastic crates by the seamer
    const crates = kit.batch(g, kit.mat(0x2a6cb5, { rough: 0.4 }));
    for (let i = 0; i < 5; i++) crates.box([0.6, 0.3, 0.4], [-8.4, 0.15 + i * 0.31, 2.2]);
    for (let i = 0; i < 3; i++) crates.box([0.6, 0.3, 0.4], [-8.4, 0.15 + i * 0.31, 2.7]);
    crates.done(); cart.done(); print.done();

    // ---- utilities on the walls: cable tray, line control cabinet, hose reel, signs ----
    const tray = kit.batch(g, M.galv, { shadow: false });
    for (const [x0, x1, z] of [[-W / 2, W / 2, -D / 2 + 0.3]]) {
      tray.box([x1 - x0, 0.01, 0.3], [(x0 + x1) / 2, 4.0, z]).box([x1 - x0, 0.08, 0.01], [(x0 + x1) / 2, 4.04, z - 0.15]).box([x1 - x0, 0.08, 0.01], [(x0 + x1) / 2, 4.04, z + 0.15]);
      for (let x = x0 + 0.75; x < x1; x += 1.5) tray.box([0.04, 0.04, 0.32], [x, 3.98, z]);
    }
    tray.box([0.3, 0.01, D], [W / 2 - 0.3, 4.0, 0]).box([0.01, 0.08, D], [W / 2 - 0.15, 4.04, 0]).box([0.01, 0.08, D], [W / 2 - 0.45, 4.04, 0]);
    tray.box([0.25, 3.3, 0.06], [-6.0, 1.75, D / 2 - 0.05]); // vertical cable ladder above the cabinet
    tray.done();
    const cables = kit.batch(g, M.black, { shadow: false });
    for (const dz of [-0.08, -0.02, 0.05, 0.1]) cables.rod([-W / 2, 4.03, -D / 2 + 0.3 + dz], [W / 2, 4.03, -D / 2 + 0.3 + dz], 0.016, 6);
    for (const dx of [-0.06, 0.04]) cables.rod([W / 2 - 0.3 + dx, 4.03, -D / 2], [W / 2 - 0.3 + dx, 4.03, D / 2], 0.018, 6);
    cables.done();
    // line control cabinet on the front wall, left of the door
    const cabMat = kit.mat(0xd7d9d6, { rough: 0.38, metal: 0.15 });
    kit.rbox(g, [1.6, 2.0, 0.5], [-6.0, 1.0, D / 2 - 0.25], cabMat, 0.02);
    const handles = kit.batch(g, M.black, { shadow: false });
    handles.box([0.02, 1.96, 0.01], [-6.0, 1.0, D / 2 - 0.505]).box([0.03, 0.18, 0.03], [-6.15, 1.1, D / 2 - 0.52]).box([0.03, 0.18, 0.03], [-5.85, 1.1, D / 2 - 0.52]);
    handles.done();
    kit.prop.sign(g, [0.22, 0.22], [-6.4, 1.75, D / 2 - 0.505], Math.PI, tex.sign('warning', '', '⚡'));
    // hose reel for wash-down (the line is cleaned every shift)
    const reel = new T.Group(); reel.position.set(W / 2 - 0.2, 1.3, 2.6); reel.rotation.y = -Math.PI / 2; g.add(reel);
    const reelRing = new T.Mesh(new T.TorusGeometry(0.3, 0.025, 8, 32), M.red); reelRing.position.z = 0.1; reel.add(reelRing);
    for (let k = 0; k < 5; k++) { const coil = new T.Mesh(new T.TorusGeometry(0.235 + k * 0.012, 0.012, 6, 32), M.black); coil.position.z = 0.07 - k * 0.03; reel.add(coil); }
    kit.cyl(reel, 0.32, 0.03, [0, 0, -0.1], M.red).rotation.x = Math.PI / 2;
    kit.cyl(reel, 0.22, 0.18, [0, 0, 0], kit.mat(0x2b3138, { rough: 0.6 })).rotation.x = Math.PI / 2;
    // fire extinguishers, exit sign, safety signs, the line banner
    kit.prop.extinguisher(g, [-0.5, D / 2 - 0.02], Math.PI, lang);
    kit.prop.extinguisher(g, [W / 2 - 0.02, -2.5], -Math.PI / 2, lang);
    kit.prop.exitSign(g, [-3, 2.45, D / 2 - 0.03], Math.PI, lang);
    kit.prop.sign(g, [0.42, 0.52], [-4.3, 1.7, D / 2 - 0.01], Math.PI, tex.sign('mandatory', tx('Czepek', 'Hairnet'), '◒'));
    kit.prop.sign(g, [0.42, 0.52], [-1.0, 1.7, D / 2 - 0.01], Math.PI, tex.sign('mandatory', tx('Myj ręce', 'Wash hands'), '✋'));
    kit.prop.sign(g, [0.5, 0.62], [2.8, 2.2, -D / 2 + 0.01], 0, tex.sign('mandatory', tx('Ochronniki słuchu', 'Ear protection'), '◡'));
    kit.prop.sign(g, [0.5, 0.62], [7.5, 2.2, -D / 2 + 0.01], 0, tex.sign('warning', tx('Ruchome części', 'Moving parts')));
    kit.prop.sign(g, [0.5, 0.62], [-3.0, 2.2, -D / 2 + 0.01], 0, tex.sign('warning', tx('Wózki widłowe', 'Forklifts')));
    kit.plane(g, [5.6, 1.1], [1.5, 4.95, -D / 2 + 0.42], [0, 0, 0], kit.mat(0xffffff, { map: bannerTex(), rough: 0.6 }));
    kit.plane(g, [1.2, 0.9], [W / 2 - 0.02, 2.0, -0.6], [0, -Math.PI / 2, 0], kit.mat(0xffffff, { map: lineBoardTex(), rough: 0.6 }));
    // wall clock above the screen
    const clock = kit.screenPlane(g, [0.42, 0.42], [-4.6, 3.6, -D / 2 + 0.03], 0, (c, w, h) => {
      c.fillStyle = '#f7f7f4'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); c.fill(); c.lineWidth = 10; c.strokeStyle = '#222'; c.stroke();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * (w / 2 - 22), h / 2 - Math.cos(a) * (w / 2 - 22)); c.lineTo(w / 2 + Math.sin(a) * (w / 2 - 44), h / 2 - Math.cos(a) * (w / 2 - 44)); c.stroke(); }
      c.lineWidth = 12; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 70, h / 2 + 70); c.stroke(); c.lineWidth = 8; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 - 20, h / 2 - 170); c.stroke();
    });
    clock.material.toneMapped = true;
    // round clock face
    clock.geometry.dispose(); clock.geometry = new T.CircleGeometry(0.21, 40);

    // ---- light fittings: hanging linear high-bays ----
    const housings = kit.batch(g, M.galv, { shadow: false });
    const tubes = kit.batch(g, M.lamp, { shadow: false, receive: false });
    for (const x of [-6, -3, 0, 3, 6]) for (const z of [-3.6, 0.6, 3.8]) {
      housings.box([1.5, 0.07, 0.22], [x, 4.6, z]).rod([x - 0.6, 4.63, z], [x - 0.6, H, z], 0.004, 4).rod([x + 0.6, 4.63, z], [x + 0.6, H, z], 0.004, 4);
      tubes.box([1.42, 0.01, 0.16], [x, 4.562, z]);
    }
    housings.done(); tubes.done(); lamp.done(); sky.done(); winFrame.done();

    // ---- STATION brief: mobile memo board by the door ----
    const board = new T.Group(); board.position.set(-4.75, 0, 1.65); board.rotation.y = 0.5; g.add(board);
    const boardFrame = kit.batch(board, M.galv);
    boardFrame.box([0.04, 1.85, 0.04], [-0.66, 0.93, 0]).box([0.04, 1.85, 0.04], [0.66, 0.93, 0]).box([0.06, 0.04, 0.6], [-0.66, 0.06, 0]).box([0.06, 0.04, 0.6], [0.66, 0.06, 0]).box([1.32, 0.03, 0.03], [0, 0.5, 0]);
    for (const x of [-0.66, 0.66]) for (const z of [-0.26, 0.26]) boardFrame.cyl(0.035, 0.035, 0.03, [x, 0.035, z], [0, 0, Math.PI / 2]);
    boardFrame.done();
    const memoImgs = [];
    const drawMemo = (c, w, h) => {
      c.fillStyle = '#f6f7f5'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#b8bec2'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10); c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h);
      // A4 memo, pinned
      c.save(); c.translate(40, 40); c.rotate(-0.02);
      c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 8; c.fillRect(0, 0, 300, 420); c.shadowBlur = 0;
      c.fillStyle = '#1f6fb2'; c.fillRect(0, 0, 300, 46); c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(54, 23, 40, 15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1c1917'; c.font = '800 17px Raleway, system-ui'; c.textAlign = 'center'; c.fillText(brand, 54, 29); c.textAlign = 'left';
      c.fillStyle = '#fff'; c.font = '700 18px Raleway, system-ui'; c.fillText(tx('NOTATKA', 'MEMO'), 110, 30);
      c.fillStyle = '#1c1917'; c.font = '700 22px Raleway, system-ui'; c.fillText(tx('Linia 2: kontrola', 'Line 2: inspection'), 18, 82); c.fillText(tx('wizyjna puszek', 'of the cans'), 18, 108);
      c.fillStyle = '#6b6a66'; for (let i = 0; i < 11; i++) c.fillRect(18, 136 + i * 24, 230 + ((i * 37) % 50), 7);
      c.fillStyle = '#c0221c'; c.beginPath(); c.arc(150, 6, 9, 0, Math.PI * 2); c.fill();
      c.restore();
      // a photo of a can, pinned, and two sticky notes
      c.save(); c.translate(380, 50); c.rotate(0.03);
      c.fillStyle = '#fff'; c.fillRect(0, 0, 190, 230);
      const im = memoImgs[0];
      if (im && im.complete && im.naturalWidth) c.drawImage(im, 8, 8, 174, 214);
      else { c.fillStyle = '#d9dcde'; c.fillRect(8, 8, 174, 214); c.fillStyle = '#1f6fb2'; c.fillRect(55, 60, 80, 110); }
      c.fillStyle = '#2f8f47'; c.beginPath(); c.arc(95, 4, 8, 0, Math.PI * 2); c.fill();
      c.restore();
      c.fillStyle = '#ffe66b'; c.fillRect(390, 310, 150, 130); c.fillStyle = '#9fd7f0'; c.fillRect(600, 60, 130, 120);
      c.fillStyle = '#3a3a3a'; c.font = '600 22px Raleway, system-ui';
      c.fillText(tx('np. cel: 9 z 10', 'e.g. goal: 9 of 10'), 402, 352); c.fillText(tx('wadliwych', 'bad cans'), 402, 380); c.fillText(tx('odrzuconych', 'rejected'), 402, 408);
      c.fillText(tx('Zmiana B', 'Shift B'), 612, 100); c.fillText('06:00', 612, 130);
      c.strokeStyle = '#1f6fb2'; c.lineWidth = 4; c.beginPath(); c.moveTo(600, 300); c.bezierCurveTo(660, 250, 720, 360, 760, 290); c.stroke();
      c.fillStyle = '#1f6fb2'; c.font = '600 28px Raleway, system-ui'; c.fillText('L2 → QA', 600, 440);
    };
    const memoTex = tex.screen(drawMemo, { w: 800, h: 512 });
    const loadMemo = () => { memoImgs.forEach(im => { im.onload = null; }); memoImgs.length = 0; if (photos[0]) { const im = new Image(); im.onload = () => memoTex.redraw(); im.src = photos[0]; memoImgs.push(im); } };
    loadMemo();
    kit.box(board, [1.34, 0.87, 0.03], [0, 1.3, 0], M.galv);
    const boardFace = kit.plane(board, [1.3, 0.83], [0, 1.3, 0.016], [0, 0, 0], kit.mat(0xffffff, { map: memoTex, rough: 0.35 }));

    // ---- STATION data: inspection monitor on a stand beside the gantry ----
    const mon = new T.Group(); mon.position.set(-2.75, 0, 0.6); mon.rotation.y = 0; g.add(mon);
    const monStand = kit.batch(mon, M.stainless);
    monStand.box([0.06, 1.3, 0.06], [0, 0.65, -0.05]).box([0.5, 0.03, 0.5], [0, 0.015, -0.05]).box([0.12, 0.12, 0.06], [0, 1.4, -0.06]);
    monStand.done();
    let photoImgs = [];
    const drawMon = (c, w, h) => {
      c.fillStyle = '#0d1419'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#16232d'; c.fillRect(0, 0, w, 44);
      c.fillStyle = '#e6eef3'; c.font = '700 24px Raleway, system-ui'; c.fillText(tx('KAMERA 1 · INSPEKCJA PUSZEK', 'CAMERA 1 · CAN INSPECTION'), 16, 30);
      c.fillStyle = '#2fd15a'; c.beginPath(); c.arc(w - 70, 22, 8, 0, Math.PI * 2); c.fill(); c.fillStyle = '#9fb3c0'; c.font = '600 18px Raleway, system-ui'; c.fillText('LIVE', w - 56, 28);
      const cols = 3, rows = 2, pad = 12, cw = (w - pad * (cols + 1)) / cols, ch = (h - 44 - 40 - pad * (rows + 1)) / rows;
      for (let i = 0; i < 6; i++) {
        const x = pad + (i % cols) * (cw + pad), y = 44 + pad + Math.floor(i / cols) * (ch + pad);
        c.fillStyle = '#1d2a33'; c.fillRect(x, y, cw, ch);
        const im = photoImgs[i];
        if (im && im.complete && im.naturalWidth) { const s = Math.min(cw / im.naturalWidth, ch / im.naturalHeight), iw = im.naturalWidth * s, ih = im.naturalHeight * s; c.drawImage(im, x + (cw - iw) / 2, y + (ch - ih) / 2, iw, ih); }
        else { c.strokeStyle = '#3c4f5c'; c.lineWidth = 3; c.strokeRect(x + cw / 2 - 30, y + 20, 60, ch - 40); }
        c.fillStyle = 'rgba(13,20,25,.75)'; c.fillRect(x, y + ch - 24, cw, 24); c.fillStyle = '#c9d6de'; c.font = '600 16px Raleway, system-ui'; c.fillText(`IMG ${String(i + 1).padStart(3, '0')}`, x + 8, y + ch - 7);
      }
      c.fillStyle = '#9fb3c0'; c.font = '600 18px Raleway, system-ui';
      c.fillText(photos.length ? tx(`${photos.length} zdjęć z linii`, `${photos.length} photos from the line`) : tx('Brak podglądu', 'No preview'), 16, h - 14);
    };
    const monTex = tex.screen(drawMon, { w: 640, h: 420 });
    // onload before src, so a cached image never fires before the handler.
    const loadMon = () => { photoImgs.forEach(im => { im.onload = null; }); photoImgs = photos.map(src => { const im = new Image(); im.onload = () => monTex.redraw(); im.src = src; return im; }); };
    loadMon();
    // The app's photos arrive after the mount (synthetic cans first, the real set once loaded): swap them in.
    function setData(nd) {
      const next = pick((nd && nd.vision) || nd || {});
      if (next.length === photos.length && next.every((u, i) => u === photos[i])) return;
      photos = next; loadMon(); loadMemo(); monTex.redraw(); memoTex.redraw();
    }
    const monHousing = kit.rbox(mon, [0.72, 0.5, 0.07], [0, 1.6, 0], M.stainless, 0.018);
    const monScreen = new T.Mesh(new T.PlaneGeometry(0.64, 0.42), new T.MeshBasicMaterial({ map: monTex, toneMapped: false }));
    monScreen.position.set(0, 0, 0.036); monHousing.add(monScreen);

    // ---- STATION experiment: camera control console (stainless pedestal, sloped HMI, e-stop) ----
    const con = new T.Group(); con.position.set(-0.9, 0, 0.85); con.rotation.y = -0.35; g.add(con);
    const conBase = kit.batch(con, M.stainless);
    conBase.box([0.14, 0.95, 0.14], [0, 0.475, 0]).box([0.5, 0.03, 0.4], [0, 0.015, 0]);
    conBase.done();
    const conBody = kit.rbox(con, [0.7, 0.42, 0.34], [0, 1.12, 0], M.stainless, 0.025);
    conBody.rotation.x = -0.45;
    const drawHmi = (c, w, h) => {
      c.fillStyle = '#eef2f4'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f6fb2'; c.fillRect(0, 0, w, 48);
      c.fillStyle = '#fff'; c.font = '700 26px Raleway, system-ui'; c.fillText(tx('KAMERA 1 · USTAWIENIA', 'CAMERA 1 · SETTINGS'), 16, 33);
      const rows = [[tx('Ekspozycja', 'Exposure'), 0.55], [tx('Oświetlenie', 'Lighting'), 0.7], [tx('Ostrość', 'Focus'), 0.4]];
      rows.forEach(([k, val], i) => { const y = 92 + i * 62; c.fillStyle = '#1c1917'; c.font = '600 22px Raleway, system-ui'; c.fillText(k, 16, y); c.fillStyle = '#c9d1d6'; c.fillRect(16, y + 14, w - 32, 10); c.fillStyle = '#1f6fb2'; c.fillRect(16, y + 14, (w - 32) * val, 10); c.beginPath(); c.arc(16 + (w - 32) * val, y + 19, 12, 0, Math.PI * 2); c.fill(); });
      c.fillStyle = '#2f8f47'; c.fillRect(16, h - 62, 160, 46); c.fillStyle = '#fff'; c.font = '700 22px Raleway, system-ui'; c.fillText('START', 56, h - 32);
      c.fillStyle = '#6b6a66'; c.fillRect(w - 176, h - 62, 160, 46); c.fillStyle = '#fff'; c.fillText(tx('TEST', 'TEST'), w - 126, h - 32);
    };
    const hmi = new T.Mesh(new T.PlaneGeometry(0.46, 0.3), new T.MeshBasicMaterial({ map: tex.screen(drawHmi, { w: 512, h: 334 }), toneMapped: false }));
    hmi.position.set(-0.06, 0.02, 0.171); conBody.add(hmi);
    const estop = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.03, 20), M.red); estop.rotation.x = Math.PI / 2; estop.position.set(0.27, 0.1, 0.18); conBody.add(estop);
    const ring2 = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.01, 20), M.paintY); ring2.rotation.x = Math.PI / 2; ring2.position.set(0.27, 0.1, 0.172); conBody.add(ring2);
    for (const [y, col] of [[0, 0x2fd15a], [-0.09, 0xf0f0f0]]) { const b = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.02, 14), kit.mat(col, { rough: 0.3 })); b.rotation.x = Math.PI / 2; b.position.set(0.27, y - 0.02, 0.18); conBody.add(b); }

    // ---- STATION method: QA bench in its bay at the back wall ----
    const qa = new T.Group(); qa.position.set(6.0, 0, -5.4); g.add(qa);
    const qaSteel = kit.batch(qa, M.stainless, { uv: 1 });
    qaSteel.box([2.0, 0.04, 0.75], [0, 0.93, 0]);
    for (const x of [-0.95, 0.95]) for (const z of [-0.33, 0.33]) qaSteel.box([0.04, 0.91, 0.04], [x, 0.455, z]);
    qaSteel.box([1.94, 0.02, 0.68], [0, 0.2, 0]);                     // undershelf
    qaSteel.box([1.2, 0.45, 0.3], [-0.3, 2.05, -0.22]);                // wall cupboard
    qaSteel.box([0.6, 0.02, 0.3], [0.65, 1.6, -0.22]).box([0.6, 0.02, 0.3], [0.65, 1.95, -0.22]); // sample shelves
    qaSteel.done();
    const qaTop = kit.box(qa, [2.0, 0.008, 0.75], [0, 0.954, 0], kit.mat(0xeef0ef, { rough: 0.3 }));
    // monitor, keyboard, a can gauge, a lamp, a binder, a stool
    const qaMon = kit.rbox(qa, [0.58, 0.36, 0.04], [-0.35, 1.32, -0.2], M.darkPlastic, 0.01);
    const drawQa = (c, w, h) => {
      c.fillStyle = '#f4f6f7'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, 44);
      c.fillStyle = '#fff'; c.font = '700 24px Raleway, system-ui'; c.fillText(tx('KONTROLA JAKOŚCI · L2', 'QUALITY CONTROL · L2'), 14, 30);
      c.fillStyle = '#1c1917'; c.font = '600 20px Raleway, system-ui';
      [tx('Oznaczone zdjęcia', 'Labelled photos'), tx('Rundy nauki', 'Training rounds'), tx('Wytrenowany model', 'Trained model')].forEach((t, i) => { c.fillStyle = '#dfe5e8'; c.fillRect(14, 64 + i * 70, w - 28, 56); c.fillStyle = '#1c1917'; c.fillText(t, 28, 98 + i * 70); });
    };
    const qaScreen = new T.Mesh(new T.PlaneGeometry(0.54, 0.32), new T.MeshBasicMaterial({ map: tex.screen(drawQa, { w: 540, h: 320 }), toneMapped: false }));
    qaScreen.position.set(0, 0, 0.021); qaMon.add(qaScreen);
    const qaBits = kit.batch(qa, M.darkPlastic, { shadow: false });
    qaBits.box([0.06, 0.18, 0.04], [-0.35, 1.05, -0.24]).box([0.25, 0.015, 0.18], [-0.35, 0.965, -0.24]).box([0.44, 0.02, 0.15], [-0.35, 0.968, 0.1]);
    qaBits.box([0.08, 0.3, 0.24], [0.62, 1.11, -0.15]).box([0.05, 0.01, 0.22], [0.25, 0.962, 0.1]); // binder, caliper case
    qaBits.rod([0.85, 0.96, -0.25], [0.85, 1.45, -0.1], 0.012, 6).rod([0.85, 1.45, -0.1], [0.62, 1.42, 0.05], 0.012, 6);
    qaBits.done();
    kit.cyl(qa, 0.06, 0.05, [0.62, 1.4, 0.06], kit.mat(0x2f8f47, { rough: 0.4 }));
    const stool = kit.batch(qa, M.black);
    stool.cyl(0.18, 0.18, 0.05, [-0.2, 0.65, 0.75]).cyl(0.025, 0.025, 0.6, [-0.2, 0.33, 0.75]).cyl(0.22, 0.22, 0.03, [-0.2, 0.03, 0.75]);
    stool.done();
    // hanging bay sign, so the QA bay reads from across the hall
    const qaSign = kit.box(qa, [1.4, 0.36, 0.03], [0.3, 2.7, 0.5], kit.mat(0xffffff, { map: kit.canvasTexture(512, 132, (c, w, h) => { c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 54px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('KONTROLA JAKOŚCI', 'QUALITY CONTROL'), w / 2, h / 2 + 3); }), rough: 0.5 }));
    kit.batch(qa, M.galv, { shadow: false }).rod([-0.3, 2.88, 0.5], [-0.3, H, 0.5], 0.006, 4).rod([0.9, 2.88, 0.5], [0.9, H, 0.5], 0.006, 4).done();
    kit.plane(qa, [0.42, 0.56], [0.7, 1.75, -0.374], [0, 0, 0], kit.mat(0xffffff, { map: chartTex(), rough: 0.6 }));

    // ---- STATION results: big wall screen on the back wall ----
    const scrX = -6.0, scrY = 3.1;
    const scrFrame = kit.rbox(g, [2.5, 1.46, 0.1], [scrX, scrY, -D / 2 + 0.07], M.stainless, 0.02);
    const drawRes = (c, w, h) => {
      c.fillStyle = '#eef2f4'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f6fb2'; c.fillRect(0, 0, w, 92); c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(96, 46, 70, 30, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1c1917'; c.font = '800 34px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(brand, 96, 48); c.textAlign = 'left';
      c.fillStyle = '#fff'; c.font = '700 40px Raleway, system-ui'; c.fillText(tx('Linia 2 · kontrola wizyjna', 'Line 2 · vision inspection'), 190, 48);
      c.textBaseline = 'alphabetic';
      // three empty KPI tiles and an empty chart: filled by the experiments, never invented here
      const tiles = [tx('Odrzucone wadliwe', 'Bad cans rejected'), tx('Fałszywe odrzuty', 'False rejects'), tx('Eksperymenty', 'Experiments')];
      tiles.forEach((t, i) => { const x = 30 + i * 330; c.fillStyle = '#fff'; c.fillRect(x, 120, 310, 130); c.fillStyle = '#6b6a66'; c.font = '600 24px Raleway, system-ui'; c.fillText(t, x + 18, 160); c.fillStyle = '#c9d1d6'; c.font = '700 56px Raleway, system-ui'; c.fillText('–', x + 18, 228); });
      c.fillStyle = '#fff'; c.fillRect(30, 272, w - 60, h - 300);
      c.strokeStyle = '#9aa5ad'; c.lineWidth = 3; c.beginPath(); c.moveTo(90, 300); c.lineTo(90, h - 60); c.lineTo(w - 60, h - 60); c.stroke();
      c.setLineDash([12, 10]); c.strokeStyle = '#2f8f47'; c.beginPath(); c.moveTo(90, 340); c.lineTo(w - 60, 340); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#2f8f47'; c.font = '600 24px Raleway, system-ui'; c.fillText(tx('np. cel: 9 z 10 wadliwych', 'e.g. goal: 9 of 10 bad cans'), w - 330, 330);
      c.fillStyle = '#6b6a66'; c.font = '500 26px Raleway, system-ui'; c.fillText(tx('Zapisane eksperymenty i wynik końcowy: stanowisko Wyniki.', 'Saved experiments and the final result: the Results station.'), 120, h - 120);
    };
    const resScreen = new T.Mesh(new T.PlaneGeometry(2.32, 1.29), new T.MeshBasicMaterial({ map: tex.screen(drawRes, { w: 1024, h: 572 }), toneMapped: false }));
    resScreen.position.set(0, 0, 0.051); scrFrame.add(resScreen);
    kit.box(g, [0.1, 0.5, 0.1], [scrX, scrY + 0.95, -D / 2 + 0.08], M.galv).castShadow = false;

    // ---- more of the hall: roller shutter to dispatch, sauce tanks, overhead tray to the gantry, floor wear ----
    const shutterTex = kit.canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#c7ccce'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, y + 2, w, 2); c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, y + 10, w, 6); }
    });
    kit.box(g, [2.7, 3.4, 0.06], [0, 1.7, -D / 2 + 0.04], kit.mat(0xffffff, { map: kit.tile(shutterTex, 1, 3.4 / 1.0), rough: 0.45, metal: 0.4 })).castShadow = false;
    const jamb = kit.batch(g, M.hazard, { uv: 3 });
    jamb.box([0.16, 3.5, 0.16], [-1.43, 1.75, -D / 2 + 0.1]).box([0.16, 3.5, 0.16], [1.43, 1.75, -D / 2 + 0.1]).box([3.0, 0.3, 0.3], [0, 3.6, -D / 2 + 0.15]);
    for (const x of [-1.25, 1.25]) jamb.cyl(0.08, 0.08, 1.0, [x, 0.5, -D / 2 + 0.6]);
    jamb.done();
    const tanks = kit.batch(g, M.stainless, { uv: 0 });
    for (const [x, z, r, h] of [[2.6, -4.7, 0.55, 1.7], [3.85, -4.95, 0.4, 1.4]]) {
      tanks.cyl(r, r, h, [x, 0.55 + h / 2, z], [0, 0, 0], 32).add(new T.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), [x, 0.55 + h, z], [0, 0, 0], [1, 0.3, 1]);
      tanks.cyl(r * 0.6, 0.06, 0.25, [x, 0.42, z], [0, 0, 0], 24);
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; tanks.box([0.05, 0.55, 0.05], [x + Math.cos(a) * r * 0.85, 0.275, z + Math.sin(a) * r * 0.85]); }
      tanks.box([0.12, 0.25, 0.03], [x, 0.55 + h * 0.6, z + r + 0.02]);       // nameplate
      tanks.rod([x, 0.3, z], [x, 0.3, BELT_Z - 0.6], 0.025, 8);
    }
    tanks.rod([2.6, 0.55 + 1.7 + 0.15, -4.7], [2.6, 4.35, -4.7], 0.03, 8);
    tanks.done();
    kit.plane(g, [0.5, 0.18], [2.6, 1.5, -4.7 + 0.56], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(256, 92, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1c1917'; c.lineWidth = 5; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = '#b3261e'; c.font = '800 30px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('SOS POMIDOROWY', 'TOMATO SAUCE'), w / 2, h / 2 + 2); }), rough: 0.6 }));
    const otray = kit.batch(g, M.galv, { shadow: false });
    otray.box([0.3, 0.01, D / 2 + BELT_Z + 0.3], [GX, 4.0, (-D / 2 + BELT_Z) / 2 + 0.15]).box([0.01, 0.08, D / 2 + BELT_Z], [GX - 0.15, 4.04, (-D / 2 + BELT_Z) / 2]).box([0.01, 0.08, D / 2 + BELT_Z], [GX + 0.15, 4.04, (-D / 2 + BELT_Z) / 2]);
    for (let z = -5; z <= -1; z += 1.5) otray.rod([GX - 0.15, 4.0, z], [GX - 0.15, H, z], 0.008, 4).rod([GX + 0.15, 4.0, z], [GX + 0.15, H, z], 0.008, 4);
    otray.done();
    // floor wear: forklift tyre marks, damp patches by the drains and the seamer (one transparent overlay)
    const wear = kit.canvasTexture(1024, 683, (c, w, h) => {
      const r = kit.rng(5), sx = w / W, sz = h / D, X = x => (x + W / 2) * sx, Z = z => (z + D / 2) * sz;
      const patch = (x, z, rx, rz, a) => { const gr = c.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), rx * sx); gr.addColorStop(0, `rgba(34,38,34,${a * 1.6})`); gr.addColorStop(1, 'rgba(40,44,40,0)'); c.save(); c.translate(X(x), Z(z)); c.scale(1, rz / rx); c.translate(-X(x), -Z(z)); c.fillStyle = gr; c.fillRect(X(x) - rx * sx, Z(z) - rx * sx, rx * sx * 2, rx * sx * 2); c.restore(); };
      patch(-6.6, 0.2, 1.6, 1.0, 0.35); patch(-2.5, 0.1, 1.2, 0.5, 0.22); patch(-5.2, 3.2, 0.8, 0.8, 0.3); patch(0.5, 0.2, 1.0, 0.6, 0.25); patch(6.5, -3.0, 0.9, 0.9, 0.28); patch(2.6, -4.0, 1.0, 0.8, 0.22);
      c.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        c.strokeStyle = `rgba(25,25,25,${0.08 + r() * 0.1})`; c.lineWidth = 6 + r() * 6; c.beginPath();
        const z0 = 2.2 + r() * 1.5; c.moveTo(X(-8.5), Z(z0)); c.bezierCurveTo(X(-3), Z(z0 + (r() - 0.5) * 1.2), X(2), Z(z0 + (r() - 0.5) * 1.5), X(8.5), Z(z0 - 0.5 - r() * 3)); c.stroke();
      }
      for (let k = 0; k < 4; k++) { c.strokeStyle = `rgba(25,25,25,${0.05 + r() * 0.05})`; c.lineWidth = 7; c.beginPath(); const x0 = -0.6 + r() * 1.2; c.moveTo(X(x0), Z(-5.5)); c.bezierCurveTo(X(x0 + 0.5), Z(-3.5), X(x0 - 0.5), Z(-2.4), X(x0 + 2.5 + r()), Z(-1.9)); c.stroke(); }
    });
    wear.wrapS = wear.wrapT = T.ClampToEdgeWrapping;
    const wearMat = new T.MeshStandardMaterial({ map: wear, transparent: true, depthWrite: false, roughness: 0.25, metalness: 0 });
    const wearMesh = kit.plane(g, [W, D], [0, 0.003, 0], [-Math.PI / 2, 0, 0], wearMat); wearMesh.renderOrder = 1;

    // ---- infeed stock at the right: pallets of empty cans in stretch film, a pallet jack, a waste bin ----
    const canSide = kit.canvasTexture(256, 64, (c, w, h) => { c.fillStyle = '#6f7478'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { const gr = c.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#7d8286'); gr.addColorStop(0.35, '#e9ecee'); gr.addColorStop(0.7, '#a9aeb2'); gr.addColorStop(1, '#5d6266'); c.fillStyle = gr; c.fillRect(x + 1, 4, 14, h - 8); } });
    const canTop = kit.canvasTexture(256, 256, (c, w, h) => { c.fillStyle = '#55595c'; c.fillRect(0, 0, w, h); for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) { c.fillStyle = '#c4c8cb'; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#8b9094'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.stroke(); } });
    const tierSide = kit.mat(0xffffff, { map: kit.tile(canSide, 7, 1), rough: 0.35, metal: 0.5 }), tierTop = kit.mat(0xffffff, { map: kit.tile(canTop, 4.7, 3.1), rough: 0.35, metal: 0.5 });
    const tierMats = [tierSide, tierSide, tierTop, tierSide, tierSide, tierSide];
    const sheets = kit.batch(g, M.cardboard, { uv: 2, shadow: false });
    const film = kit.batch(g, new T.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.15, transparent: true, opacity: 0.18, depthWrite: false }), { shadow: false, receive: false });
    for (const [x, z, n] of [[7.7, 3.1, 5], [7.7, 4.6, 4], [6.2, 5.3, 3]]) {
      kit.prop.pallet(wood, [x, z], Math.PI / 2);
      for (let l = 0; l < n; l++) { const y = 0.144 + 0.006 + l * 0.125; sheets.box([0.8, 0.006, 1.2], [x, y, z]); const t = new T.Mesh(new T.BoxGeometry(0.8, 0.115, 1.2), tierMats); t.position.set(x, y + 0.064, z); t.castShadow = t.receiveShadow = true; g.add(t); }
      film.box([0.84, n * 0.125 + 0.04, 1.24], [x, 0.144 + (n * 0.125 + 0.04) / 2, z]);
    }
    sheets.done(); film.done();
    const jack = kit.batch(g, M.paintY);
    jack.box([0.16, 0.06, 1.15], [6.0, 0.05, 3.6]).box([0.16, 0.06, 1.15], [6.4, 0.05, 3.6]).box([0.6, 0.35, 0.25], [6.2, 0.2, 4.25]).rod([6.2, 0.35, 4.3], [6.2, 1.15, 4.75], 0.02, 8).rod([6.0, 1.15, 4.75], [6.4, 1.15, 4.75], 0.02, 8);
    jack.done();
    kit.cyl(g, 0.1, 0.06, [6.2, 0.06, 4.33], M.black).rotation.z = Math.PI / 2;
    const wbin = kit.batch(g, kit.mat(0x2f6f3a, { rough: 0.5 }));
    wbin.cyl(0.3, 0.27, 0.85, [8.4, 0.425, 0.9], [0, 0, 0], 20);
    wbin.done();
    kit.cyl(g, 0.32, 0.05, [8.4, 0.875, 0.9], M.paintY);

    // ---- lights ----
    // Key: daylight from the window side (left of the door view), low enough to model the machines and lay their
    // shadows across the floor towards the viewer's right. Fill: a weak sky/floor bounce plus the hall reflections.
    g.add(new T.HemisphereLight(0xeaf1f6, 0x6a6257, 0.5));
    const sun = new T.DirectionalLight(0xfff0d8, 3.6);
    sun.position.set(-10.5, 9.5, 4.5); sun.target.position.set(1, 0, -0.8);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 34 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    g.add(sun, sun.target);
    for (const [x, z] of [[-5, 2.5], [2.5, 2.5], [-5, -3.2], [3, -3.2]]) { const p = new T.PointLight(0xfff3e2, 11, 14, 1.6); p.position.set(x, 4.4, z); g.add(p); }
    const ringLight = new T.PointLight(0xe8f4ff, 1.2, 1.6, 2); ringLight.position.set(GX, 1.2, BELT_Z); g.add(ringLight);

    wood.done(); conv.done(); lids.done(); galv.done(); walls.done(); clad.done(); plinth.done(); steel.done(); haz.done();
    kit.envAll(g, 1.0);
    M.glass.envMapIntensity = 3; // thin and mostly clear: what shows is the reflection

    // ---- small canvas textures used above ----
    function signTex(text, color) {
      return kit.canvasTexture(256, 160, (c, w, h) => { c.fillStyle = color; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 50px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2); });
    }
    function cartonTex() {
      return kit.canvasTexture(256, 170, (c, w, h) => {
        c.fillStyle = '#b48a58'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f4f86'; c.font = '800 46px Raleway, system-ui'; c.textAlign = 'center'; c.fillText(brand, w / 2, 70);
        c.font = '600 22px Raleway, system-ui'; c.fillText(tx('PUSZKI 48 SZT.', 'CANS 48 PCS'), w / 2, 110); c.fillRect(30, 130, w - 60, 4); c.font = '600 18px Raleway, system-ui'; c.fillText('↑ ↑   ' + tx('GÓRA', 'THIS SIDE UP'), w / 2, 160);
      });
    }
    function bannerTex() {
      return kit.canvasTexture(1024, 200, (c, w, h) => {
        c.fillStyle = '#1f6fb2'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(150, h / 2, 120, 62, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1c1917'; c.font = '800 64px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(brand, 150, h / 2 + 4);
        c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '700 70px Raleway, system-ui'; c.fillText(tx('LINIA 2 · KONSERWY', 'LINE 2 · CANNING'), 310, h / 2 + 4);
      });
    }
    function lineBoardTex() {
      return kit.canvasTexture(400, 300, (c, w, h) => {
        c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f8f47'; c.fillRect(0, 0, w, 50);
        c.fillStyle = '#fff'; c.font = '700 26px Raleway, system-ui'; c.fillText(tx('TABLICA ZMIANY · L2', 'SHIFT BOARD · L2'), 14, 34);
        c.fillStyle = '#1c1917'; c.font = '600 20px Raleway, system-ui';
        [tx('Bezpieczeństwo', 'Safety'), tx('Jakość', 'Quality'), tx('Wydajność', 'Output'), tx('Ludzie', 'People')].forEach((t, i) => { c.fillText(t, 14, 90 + i * 52); c.fillStyle = i === 1 ? '#f0b400' : '#2f8f47'; c.beginPath(); c.arc(w - 40, 84 + i * 52, 14, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1c1917'; });
      });
    }
    function chartTex() {
      return kit.canvasTexture(240, 320, (c, w, h) => {
        c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1917'; c.font = '700 18px Raleway, system-ui'; c.fillText(tx('Wady zamknięcia', 'Seam defects'), 12, 28);
        const names = tx(['wgniecenie', 'nieczytelny kod', 'zła etykieta', 'rdza'], ['dent', 'unreadable code', 'wrong label', 'rust']);
        names.forEach((t, i) => { c.fillStyle = '#d9dcde'; c.fillRect(12, 50 + i * 66, w - 24, 56); c.fillStyle = '#1c1917'; c.font = '600 15px Raleway, system-ui'; c.fillText(t, 22, 84 + i * 66); });
      });
    }

    // ---- motion: belt, cans, pusher (all still under reduced motion) ----
    const SPEED = 0.32;
    let pushT = -1;
    function tick(dt) {
      if (reducedMotion) return;
      beltTex.offset.x -= dt * SPEED / 0.8;
      let pushing = false;
      for (const s of state) {
        if (s.push > 0) { s.push = Math.min(1.05, s.push + dt * 2.4); pushing = true; if (s.push >= 1.05) { s.push = 0; s.x = START; } continue; }
        s.x += dt * SPEED;
        if (s.bad && s.x >= PUSH_X && s.x - dt * SPEED < PUSH_X) { s.push = 0.001; pushT = 0; }
        if (s.x > END) s.x -= (END - START);
      }
      if (pushT >= 0) { pushT += dt; pusher.position.z = BELT_Z - 0.2 + Math.sin(Math.min(1, pushT / 0.4) * Math.PI) * 0.3; if (pushT > 0.4) pushT = -1; }
      placeCans();
    }

    const view = (pos, target) => ({ pos: [pos[0], 1.65, pos[1]], target });
    return {
      scene: g,
      bounds: { x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2 },
      lights: 'none',
      background: 0xcfd4d6,
      fog: { color: 0xcfd4d6, near: 16, far: 46 },
      spawn: { pos: [-3, 1.65, 5.5], yaw: -0.14 },
      colliders: [
        [BELT_X0, BELT_Z - 0.6, BELT_X1 + 0.75, BELT_Z + 0.6],   // conveyor, gantry, seamer guard, loader
        [SX - 1.0, BELT_Z - 0.65, SX + 1.0, BELT_Z + 0.85],     // seamer
        [PUSH_X - 0.4, -0.05, PUSH_X + 0.4, 0.65],                // reject bin
        [-5.3, 1.3, -4.2, 2.0],                                   // memo board
        [-3.05, 0.3, -2.45, 0.85],                                // monitor stand
        [-1.2, 0.6, -0.6, 1.1],                                   // console
        [4.9, -D / 2, 7.1, -4.9], [5.5, -4.9, 6.1, -4.4],         // QA bench, stool
        [-8.6, -D / 2, -5.8, -3.2], [-5.7, -5.7, -4.5, -4.7],      // pallets
        [-8.8, 1.9, -8.0, 3.0],                                   // crates
        [-6.8, D / 2 - 0.5, -5.2, D / 2],                         // control cabinet
        [-0.1, D / 2 - 0.5, 0.5, D / 2],                          // basin
        [2.0, -5.3, 4.3, -4.1],                                   // sauce tanks
        [7.1, 2.3, 8.3, 5.3], [5.6, 4.6, 6.8, 6], [5.8, 2.95, 6.6, 4.9], [8.05, 0.55, 8.75, 1.25], // can pallets, jack, waste bin
        [-1.4, -5.75, -1.1, -5.3], [1.1, -5.75, 1.4, -5.3],        // shutter bollards
        ...[-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].flatMap(x => [[x - 0.21, -D / 2, x + 0.21, -D / 2 + 0.43], [x - 0.21, D / 2 - 0.43, x + 0.21, D / 2]]), // columns
      ],
      contacts: [
        { c: [CX, BELT_Z], s: [LEN, 0.5], k: 0.42 },                                              // under the conveyor
        { c: [SX, BELT_Z], s: [1.8, 1.1], k: 0.62 }, { c: [BELT_X1 + 0.35, BELT_Z], s: [0.8, 1.2], k: 0.62 }, // seamer, loader
        ...[-0.4, 0.4].flatMap(dx => [-0.48, 0.48].map(dz => ({ c: [GX + dx, BELT_Z + dz], s: [0.22, 0.22], k: 0.5, m: 0.1 }))), // gantry feet
        { c: [PUSH_X, 0.3], s: [0.7, 0.6], k: 0.6 },                                              // reject bin
        { c: [-4.75, 1.65], s: [1.36, 0.6], r: 0.5, k: 0.34 },                                    // memo board
        { c: [-2.75, 0.55], s: [0.5, 0.5], k: 0.55 }, { c: [-0.9, 0.85], s: [0.5, 0.4], r: -0.35, k: 0.55 }, // monitor stand, console
        { c: [6.0, -5.4], s: [2.0, 0.75], k: 0.4 }, { c: [5.8, -4.65], s: [0.44, 0.44], k: 0.5 }, // QA bench, stool
        ...[[-7.9, -4.9], [-6.5, -4.9], [-7.9, -3.7], [-5.1, -5.2]].map(c => ({ c, s: [1.2, 0.8], k: 0.6 })), // pallets
        { c: [-8.4, 2.45], s: [0.6, 0.9], k: 0.6 }, { c: [-6.0, D / 2 - 0.25], s: [1.6, 0.5], k: 0.6 }, // crates, control cabinet
        { c: [2.6, -4.7], s: [1.0, 1.0], k: 0.45 }, { c: [3.85, -4.95], s: [0.75, 0.75], k: 0.45 }, // sauce tanks
        ...[[7.7, 3.1], [7.7, 4.6], [6.2, 5.3]].map(c => ({ c, s: [0.8, 1.2], k: 0.6 })),         // can pallets
        { c: [6.2, 3.7], s: [0.56, 1.3], k: 0.32 }, { c: [8.4, 0.9], s: [0.54, 0.54], k: 0.55 },  // pallet jack, waste bin
        ...[-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].flatMap(x => [-D / 2 + 0.25, D / 2 - 0.25].map(z => ({ c: [x, z], s: [0.42, 0.36], k: 0.5 }))), // columns
      ],
      stations: [
        { key: 'brief', label: { pl: 'Tablica z notatką', en: 'Memo board' }, meshes: [board], anchor: [-4.75, 1.3, 1.65], view: kit.view([-4.75 + Math.sin(0.5) * 1.6, 1.65, 1.65 + Math.cos(0.5) * 1.6], [-4.75, 1.3, 1.65]) },
        { key: 'data', label: { pl: 'Monitor inspekcji', en: 'Inspection monitor' }, meshes: [mon], anchor: [-2.75, 1.6, 0.6], view: kit.view([-2.75, 1.65, 1.95], [-2.75, 1.55, 0.6]) },
        { key: 'method', label: { pl: 'Biurko jakości', en: 'QA desk' }, meshes: [qa], anchor: [6.3, 2.7, -4.9], view: kit.view([6.0, 1.65, -3.3], [6.0, 1.15, -5.4]) },
        { key: 'experiment', label: { pl: 'Konsola kamery', en: 'Camera console' }, meshes: [con], anchor: [-0.9, 1.14, 0.87], view: kit.view([-0.9 - Math.sin(0.35) * 1.3, 1.65, 0.85 + Math.cos(0.35) * 1.3], [-0.9, 1.1, 0.85]) },
        { key: 'results', label: { pl: 'Ekran wyników', en: 'Results screen' }, meshes: [scrFrame], anchor: [scrX, scrY + 0.55, -D / 2 + 0.12], view: kit.view([scrX + 0.8, 1.65, -3.0], [scrX, scrY - 0.05, -D / 2], 0.25) },
      ],
      tick,
      setData,
      debug: () => ({ photos: photos.slice() }),
      dispose() { photoImgs.forEach(im => { im.onload = null; }); memoImgs.forEach(im => { im.onload = null; }); },
    };
  });
})();
