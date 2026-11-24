// Room "rag": the quality office at Rybex Mirszyce. Open-plan office with a ribbon of windows onto the harbour,
// carpet tiles, a suspended ceiling with LED panels, a desk pod, the procedures cabinet with PROCES-0x binders
// (data.docs), the manager's desk, a whiteboard, a knowledge terminal and a meeting table with a wall screen.
// Stations: brief = memo on the manager's desk, data = procedures cabinet, method = whiteboard,
// experiment = knowledge terminal, results = meeting-table screen.
// Classic script; needs rooms/engine.js (window.Rooms) first.
(function () {
  'use strict';
  if (!window.Rooms) return;
  const W = 9, D = 12, H = 2.85; // x -4.5..4.5, z -6..6, suspended ceiling at 2.85
  const SILL = 0.85, HEAD = 2.35;   // window ribbon in the right wall (x = 4.5)
  const BAYS = [-4.3, -1.95, 0.4, 2.75], BAY_W = 2.0;

  Rooms.define('rag', ({ THREE: T, kit, lang, data, reducedMotion }) => {
    const tx = (pl, en) => lang === 'en' ? en : pl;
    const tex = kit.tex, g = new T.Group();
    const d = (data && data.rag) || data || {};
    const docs = (Array.isArray(d.docs) ? d.docs : []).map(String).filter(Boolean).slice(0, 10);

    // ---- materials ----
    const M = {
      carpet: kit.mat(0xffffff, { map: kit.tile(tex.carpet('#56606b'), W, D), rough: 1, bump: 1.4 }),
      wall: kit.mat(0xffffff, { map: tex.plaster('#f0eee8'), rough: 0.92 }),
      accent: kit.mat(0xffffff, { map: tex.plaster('#2a5d8f'), rough: 0.9 }),
      ceiling: kit.mat(0xffffff, { map: kit.tile(tex.ceiling(), W / 1.2, D / 1.2), rough: 0.95 }),
      skirting: kit.mat(0x3b3f44, { rough: 0.6 }),
      frame: kit.mat(0x5b6066, { rough: 0.45, metal: 0.5 }),
      white: kit.mat(0xf4f4f1, { rough: 0.38 }),                        // powder-coated steel
      oak: kit.mat(0xffffff, { map: tex.wood('#c79a66'), rough: 0.5, roughMap: [1.3, 1.3] }), // lacquered veneer, worn where arms rest
      lam: kit.mat(0xe9e8e3, { rough: 0.55 }),
      grey: kit.mat(0x9aa0a5, { rough: 0.5, metal: 0.4 }),
      dark: kit.mat(0x23262a, { rough: 0.36 }),                         // monitor plastic
      fabric: kit.mat(0x3c6f8f, { rough: 0.95 }),
      seat: kit.mat(0x2b2e33, { rough: 0.85 }),
      ...kit.plantMaterials(),                                          // painted pots, veined leaves
      alu: kit.mat(0xc9ccce, { map: tex.brushedSteel(), rough: 0.38, metal: 0.75 }),
      glass: new T.MeshStandardMaterial({ color: 0xdfeaf0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
      lamp: new T.MeshBasicMaterial({ color: 0xfbfaf6, toneMapped: false }),
      paper: kit.mat(0xfbfbf8, { rough: 0.8 }),
    };

    // ---- shell ----
    kit.plane(g, [W, D], [0, 0, 0], [-Math.PI / 2, 0, 0], M.carpet);
    // ceiling slab: a thin box so it also blocks the sun from above (sunlight only enters through the windows)
    const ceil = kit.box(g, [W + 0.8, 0.04, D + 0.8], [0, H + 0.02, 0], M.ceiling); // overlaps the wall tops: no light leaks
    ceil.receiveShadow = false;
    // light panels on the 600 mm grid (UV origin at x -4.5, z -6)
    const lamp = kit.batch(g, M.lamp, { shadow: false, receive: false });
    for (const x of [-2.7, 0.3, 3.3]) for (const z of [-4.5, -2.1, 0.3, 2.7, 5.1]) lamp.box([0.58, 0.012, 0.58], [x, H - 0.006, z]);
    lamp.done();
    const walls = kit.batch(g, M.wall, { uv: 0.5 });
    walls.box([0.2, H, D], [-W / 2 - 0.1, H / 2, 0]);                                   // left
    walls.box([2.9, H, 0.2], [-3.05, H / 2, D / 2 + 0.1]).box([5.1, H, 0.2], [1.95, H / 2, D / 2 + 0.1]).box([1.0, H - 2.1, 0.2], [-1.0, 2.1 + (H - 2.1) / 2, D / 2 + 0.1]); // front with the door
    // right wall: piers between the window bays, a band below the sills and above the heads
    walls.box([0.2, SILL, D], [W / 2 + 0.1, SILL / 2, 0]).box([0.2, H - HEAD, D], [W / 2 + 0.1, HEAD + (H - HEAD) / 2, 0]);
    let zPrev = -D / 2;
    for (const zc of BAYS) { const z0 = zc - BAY_W / 2; if (z0 > zPrev) walls.box([0.2, HEAD - SILL, z0 - zPrev], [W / 2 + 0.1, (SILL + HEAD) / 2, (zPrev + z0) / 2]); zPrev = zc + BAY_W / 2; }
    walls.box([0.2, HEAD - SILL, D / 2 - zPrev], [W / 2 + 0.1, (SILL + HEAD) / 2, (zPrev + D / 2) / 2]);
    walls.done();
    kit.batch(g, M.accent, { uv: 0.5 }).box([W, H, 0.2], [0, H / 2, -D / 2 - 0.1]).done(); // back wall in Rybex blue
    const skirt = kit.batch(g, M.skirting, { shadow: false });
    skirt.box([0.02, 0.08, D], [-W / 2 + 0.01, 0.04, 0]).box([W, 0.08, 0.02], [0, 0.04, -D / 2 + 0.01]).box([0.02, 0.08, D], [W / 2 - 0.01, 0.04, 0]);
    skirt.box([2.9, 0.08, 0.02], [-3.05, 0.04, D / 2 - 0.01]).box([5.1, 0.08, 0.02], [1.95, 0.04, D / 2 - 0.01]);
    skirt.done();

    // windows: aluminium frames, a middle mullion, glass, white sills, radiators, a harbour view outside
    const wf = kit.batch(g, M.frame, { shadow: false });
    const sill = kit.batch(g, M.white, { shadow: false });
    for (const zc of BAYS) {
      const x = W / 2 + 0.02;
      wf.box([0.07, 0.06, BAY_W], [x, SILL + 0.03, zc]).box([0.07, 0.06, BAY_W], [x, HEAD - 0.03, zc]);
      wf.box([0.07, HEAD - SILL, 0.06], [x, (SILL + HEAD) / 2, zc - BAY_W / 2 + 0.03]).box([0.07, HEAD - SILL, 0.06], [x, (SILL + HEAD) / 2, zc + BAY_W / 2 - 0.03]).box([0.07, HEAD - SILL, 0.05], [x, (SILL + HEAD) / 2, zc]);
      wf.box([0.07, 0.04, BAY_W], [x, 1.95, zc]);                                        // transom (top-hung vent)
      sill.box([0.24, 0.025, BAY_W + 0.1], [W / 2 - 0.08, SILL + 0.012, zc]);
      // radiator: a white panel with fins on brackets
      sill.box([0.08, 0.5, BAY_W - 0.6], [W / 2 - 0.08, 0.42, zc]);
      for (let k = -0.6; k <= 0.6; k += 0.1) sill.box([0.09, 0.46, 0.012], [W / 2 - 0.08, 0.42, zc + k]);
      kit.plane(g, [BAY_W, HEAD - SILL], [x + 0.01, (SILL + HEAD) / 2, zc], [0, -Math.PI / 2, 0], M.glass).castShadow = false;
    }
    wf.done(); sill.done();
    // harbour view: sky, sea, quay sheds and cranes, a far shore (unlit, behind the glass)
    kit.plane(g, [40, 14], [W / 2 + 9, 2.2, -1], [0, -Math.PI / 2, 0], new T.MeshBasicMaterial({ map: harbourTex(), fog: false }));
    // venetian blinds half down in two bays
    const blindTex = kit.canvasTexture(64, 256, (c, w, h) => { c.fillStyle = '#e3e1da'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, y + 6, w, 2); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, y, w, 1); } });
    for (const [zc, drop] of [[-4.3, 0.7], [0.4, 0.45]]) {
      const bt = kit.tile(blindTex, 4, drop / 0.5);
      kit.plane(g, [BAY_W - 0.1, drop], [W / 2 - 0.04, HEAD - drop / 2 - 0.03, zc], [0, -Math.PI / 2, 0], kit.mat(0xffffff, { map: bt, rough: 0.6 })).castShadow = true;
    }

    // the door (behind the spawn) and fittings by it
    const door = kit.batch(g, M.oak, { uv: 1, shadow: false });
    door.box([0.92, 2.06, 0.04], [-1.0, 1.03, D / 2 - 0.02]);
    door.done();
    kit.batch(g, M.white, { shadow: false }).box([0.06, 2.12, 0.1], [-1.5, 1.06, D / 2 - 0.03]).box([0.06, 2.12, 0.1], [-0.5, 1.06, D / 2 - 0.03]).box([1.06, 0.06, 0.1], [-1.0, 2.12, D / 2 - 0.03]).done();
    kit.prop.exitSign(g, [-1.0, 2.45, D / 2 - 0.03], Math.PI, lang);
    kit.prop.extinguisher(g, [-W / 2 + 0.02, 4.6], Math.PI / 2, lang);

    // ---- furniture batches ----
    const oak = kit.batch(g, M.oak, { uv: 1 });
    const lam = kit.batch(g, M.lam);
    const grey = kit.batch(g, M.grey);
    const dark = kit.batch(g, M.dark);
    const seat = kit.batch(g, M.seat);
    const chair = { dark: seat, metal: grey };
    const greenB = { pot: kit.batch(g, M.pot), leaf: kit.batch(g, M.leaf, { shadow: false }) };
    // A desk: top (oak), two panel legs (grey), modesty panel. Faces +z at rotY 0, top at 0.74.
    const desk = (x, z, rotY, w = 1.4, dd = 0.75) => {
      const at = kit.frameAt(x, z, rotY), r = [0, rotY, 0];
      oak.box([w, 0.03, dd], at(0, 0.735, 0), r);
      for (const sx of [-1, 1]) grey.box([0.05, 0.72, dd - 0.1], at(sx * (w / 2 - 0.06), 0.36, 0), r);
      lam.box([w - 0.2, 0.35, 0.02], at(0, 0.5, -dd / 2 + 0.06), r);
    };
    const kb = (x, z, rotY) => { const at = kit.frameAt(x, z, rotY); dark.box([0.44, 0.02, 0.14], at(0, 0.76, 0.12), [0, rotY, 0]).box([0.06, 0.02, 0.1], at(0.32, 0.76, 0.14), [0, rotY, 0]); };

    // ---- desk pod (2 x 2), a fabric divider between the rows ----
    const POD = [0.0, -1.0];
    const drawWork = (title, rows) => (c, w, h) => {
      c.fillStyle = '#f3f5f7'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, 40);
      c.fillStyle = '#fff'; c.font = '700 22px Raleway, system-ui'; c.fillText(title, 14, 28);
      for (let i = 0; i < rows; i++) { c.fillStyle = i % 2 ? '#e4e8eb' : '#fff'; c.fillRect(14, 56 + i * 34, w - 28, 28); c.fillStyle = '#9aa5ad'; c.fillRect(24, 66 + i * 34, 120 + ((i * 53) % 140), 8); }
    };
    const podScreens = [drawWork(tx('Poczta', 'Mail'), 7), drawWork(tx('Kalendarz', 'Calendar'), 6), drawWork(tx('Raport partii', 'Batch report'), 7), drawWork(tx('Procedury', 'Procedures'), 6)];
    [[-0.6, 0.35, 0], [0.6, 0.35, 0], [-0.6, -0.35, Math.PI], [0.6, -0.35, Math.PI]].forEach(([lx, lz, rotY], i) => {
      const x = POD[0] + lx, z = POD[1] + lz;
      desk(x, z, rotY, 1.2, 0.7);
      const at = kit.frameAt(x, z, rotY);
      kit.prop.monitor(g, dark, at(0, 0.75, -0.18), rotY, podScreens[i]);
      kb(x, z, rotY);
      kit.prop.chair(chair, at(0.05, 0, 0.62), rotY + Math.PI + (i % 2 ? 0.25 : -0.3));
    });
    kit.batch(g, M.fabric, { uv: 1 }).box([2.4, 0.42, 0.04], [POD[0], 0.97, POD[1]]).done(); // divider above the desks
    // paper on desks, a mug, a desk plant
    const paper = kit.batch(g, M.paper, { shadow: false });
    paper.box([0.21, 0.004, 0.297], [POD[0] - 0.95, 0.752, POD[1] + 0.45], [0, 0.3, 0]).box([0.21, 0.004, 0.297], [POD[0] + 0.25, 0.752, POD[1] - 0.5], [0, -0.2, 0]);
    kit.cyl(g, 0.04, 0.1, [POD[0] + 1.0, 0.8, POD[1] + 0.5], kit.mat(0xc0221c, { rough: 0.4 }));

    // ---- STATION data: the procedures cabinet against the left wall (front faces +x) ----
    const cab = new T.Group(); cab.position.set(-W / 2 + 0.22, 0, -1.2); cab.rotation.y = Math.PI / 2; g.add(cab);
    const CW = 2.0, CH = 2.02, CD = 0.42, SH_Y = [0.06, 0.44, 0.82, 1.2, 1.58];
    const carc = kit.batch(cab, M.lam);
    carc.box([0.025, CH, CD], [-CW / 2, CH / 2, 0]).box([0.025, CH, CD], [CW / 2, CH / 2, 0]).box([0.025, CH, CD], [0, CH / 2, 0]);
    carc.box([CW + 0.03, 0.03, CD + 0.02], [0, CH, 0]);
    carc.box([CW, CH, 0.012], [0, CH / 2, -CD / 2 + 0.006]);
    for (const y of SH_Y) carc.box([CW, 0.025, CD], [0, y, 0]);
    carc.box([CW, 0.06, 0.02], [0, 0.03, CD / 2 - 0.01]);
    carc.done();
    // binders: instanced bodies (one colour each) and one spine strip per shelf section with the codes
    const BIN_COL = ['#1f5f9e', '#c0392b', '#2f8f47', '#e0a800', '#5b6770', '#7a4fa0'];
    const rows = [];                                                     // { y, x0, items: [{ w, color, code }] }
    const shelf = (y, x0, n, codes, palette, seed) => {
      const r = kit.rng(seed), items = [];
      for (let i = 0; i < n; i++) items.push({ w: 0.075, color: palette[codes && codes[i] ? i % palette.length : Math.floor(r() * palette.length)], code: codes ? codes[i] || null : null });
      rows.push({ y, x0, items });
    };
    // middle shelf, left section: the procedures from the data (or six unlabelled binders without data)
    shelf(SH_Y[3] + 0.0125, -CW / 2 + 0.06, Math.max(6, docs.length), docs.length ? docs : null, BIN_COL, 3);
    shelf(SH_Y[3] + 0.0125, 0.06, 7, null, ['#5b6770', '#8a949b', '#1f5f9e'], 5);
    shelf(SH_Y[2] + 0.0125, -CW / 2 + 0.06, 9, null, ['#5b6770', '#8a949b', '#1f5f9e'], 7);
    shelf(SH_Y[4] + 0.0125, 0.1, 6, null, ['#2f8f47', '#5b6770', '#c0392b'], 9);
    const binderList = [], colors = [];
    const SPINE_H = 0.31;
    for (const row of rows) {
      let x = row.x0;
      row.items.forEach(it => { it.x = x + it.w / 2; binderList.push({ p: [it.x, row.y + SPINE_H / 2, -0.02] }); colors.push(it.color); x += it.w + 0.004; });
      row.x1 = x;
    }
    const binders = kit.inst(cab, new T.BoxGeometry(0.073, SPINE_H, 0.28), kit.mat(0xffffff, { rough: 0.55 }), binderList, { shadow: true });
    colors.forEach((c, i) => binders.setColorAt(i, new T.Color(c)));
    binders.instanceColor.needsUpdate = true;
    rows.forEach(row => {
      const wM = row.x1 - row.x0, px = 1024, ph = Math.round(px * SPINE_H / wM);
      const t = kit.canvasTexture(px, ph, (c, w, h) => {
        const k = w / wM;
        row.items.forEach(it => {
          const x0 = (it.x - it.w / 2 - row.x0) * k, bw = it.w * k;
          const gr = c.createLinearGradient(x0, 0, x0 + bw, 0); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(0.25, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
          c.fillStyle = it.color; c.fillRect(x0, 0, bw, h); c.fillStyle = gr; c.fillRect(x0, 0, bw, h);
          c.fillStyle = '#fbfbf6'; c.fillRect(x0 + bw * 0.14, h * 0.07, bw * 0.72, h * 0.55);   // label window
          c.fillStyle = '#1b1d20'; c.beginPath(); c.arc(x0 + bw / 2, h * 0.8, bw * 0.2, 0, Math.PI * 2); c.fill(); // finger hole
          c.save(); c.translate(x0 + bw / 2, h * 0.07 + h * 0.275); c.rotate(-Math.PI / 2);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          if (it.code) { let fs = Math.round(bw * 0.5); c.font = `800 ${fs}px Raleway, system-ui`; while (c.measureText(it.code).width > h * 0.52 && fs > 8) { fs--; c.font = `800 ${fs}px Raleway, system-ui`; } c.fillStyle = '#16181b'; c.fillText(it.code, 0, 1); }
          else { c.fillStyle = '#b9bcbf'; c.fillRect(-h * 0.18, -bw * 0.08, h * 0.36, bw * 0.12); }
          c.restore();
        });
      });
      kit.plane(cab, [wM, SPINE_H], [row.x0 + wM / 2, row.y + SPINE_H / 2, 0.121], [0, 0, 0], kit.mat(0xffffff, { map: t, rough: 0.5 })).castShadow = false;
    });
    // archive boxes on the lowest shelves
    const arch = kit.batch(cab, kit.mat(0xffffff, { map: tex.cardboard(), rough: 0.85 }), { uv: 3 });
    for (let i = 0; i < 5; i++) arch.box([0.17, 0.32, 0.36], [-CW / 2 + 0.12 + i * 0.18, SH_Y[0] + 0.0125 + 0.16, 0]);
    for (let i = 0; i < 4; i++) arch.box([0.17, 0.32, 0.36], [0.14 + i * 0.18, SH_Y[0] + 0.0125 + 0.16, 0]);
    for (let i = 0; i < 4; i++) arch.box([0.17, 0.32, 0.36], [0.14 + i * 0.18, SH_Y[1] + 0.0125 + 0.16, 0]);
    arch.done();
    const archLab = kit.canvasTexture(512, 64, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); for (let i = 0; i < 5; i++) { const x = i * 102 + 8; c.fillStyle = '#fbfbf6'; c.fillRect(x, 8, 86, 48); c.fillStyle = '#1c1917'; c.font = '700 15px Raleway, system-ui'; c.fillText(tx('ARCHIWUM', 'ARCHIVE'), x + 6, 28); c.fillStyle = '#8a8d90'; c.fillRect(x + 6, 38, 60, 6); } });
    kit.plane(cab, [0.9, 0.11], [-CW / 2 + 0.48, SH_Y[0] + 0.25, 0.181], [0, 0, 0], new T.MeshStandardMaterial({ map: archLab, transparent: true, roughness: 0.6 })).castShadow = false;
    // header plaque on the top
    kit.plane(cab, [1.5, 0.22], [0, CH + 0.16, 0.0], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(768, 112, (c, w, h) => { c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 54px Raleway, system-ui'; c.textBaseline = 'middle'; c.fillText(tx('PROCEDURY', 'PROCEDURES'), 28, h / 2 + 3); c.font = '600 30px Raleway, system-ui'; c.fillStyle = '#cfe0f0'; c.textAlign = 'right'; c.fillText(tx('wydania aktualne', 'current issues'), w - 24, h / 2 + 3); }), rough: 0.5 })).castShadow = false;
    kit.batch(cab, M.lam, { shadow: false }).box([1.52, 0.24, 0.02], [0, CH + 0.16, -0.012]).box([0.03, 0.06, 0.03], [-0.6, CH + 0.03, -0.012]).box([0.03, 0.06, 0.03], [0.6, CH + 0.03, -0.012]).done();

    // ---- STATION brief: the manager's desk by the windows, a memo standing in a holder ----
    const mgr = new T.Group(); mgr.position.set(3.0, 0, -2.55); g.add(mgr);
    const mOak = kit.batch(mgr, M.oak, { uv: 1 }), mGrey = kit.batch(mgr, M.grey), mDark = kit.batch(mgr, M.dark), mLam = kit.batch(mgr, M.lam);
    mOak.box([1.7, 0.035, 0.85], [0, 0.74, 0]).box([0.03, 0.72, 0.8], [-0.82, 0.36, 0]);
    mLam.box([0.42, 0.62, 0.6], [0.6, 0.31, -0.05]);                              // drawer pedestal
    for (const y of [0.18, 0.38, 0.56]) mGrey.box([0.12, 0.015, 0.01], [0.6, y, 0.255]);
    mOak.box([1.5, 0.4, 0.02], [-0.1, 0.5, -0.38]);                               // modesty panel
    const mgrScreen = kit.prop.monitor(mgr, mDark, [-0.15, 0.757, -0.22], 0, drawWork(tx('Poczta · kierownik jakości', 'Mail · quality manager'), 7), [0.6, 0.35]);
    mDark.box([0.44, 0.02, 0.14], [-0.15, 0.768, 0.08]).box([0.06, 0.02, 0.1], [0.17, 0.768, 0.1]);
    mDark.box([0.17, 0.035, 0.19], [-0.66, 0.775, 0.1], [0.12, 0.4, 0]).box([0.05, 0.03, 0.2], [-0.72, 0.8, 0.12], [0.12, 0.4, 0]); // desk phone and handset
    mGrey.rod([0.72, 0.76, -0.3], [0.62, 1.15, -0.2], 0.012, 8).rod([0.62, 1.15, -0.2], [0.45, 1.12, -0.05], 0.012, 8).cyl(0.07, 0.08, 0.02, [0.72, 0.765, -0.3]); // lamp
    kit.cyl(mgr, 0.07, 0.07, [0.43, 1.08, -0.04], M.dark).rotation.z = 0.5;
    kit.prop.chair({ dark: mDark, metal: mGrey }, [-0.1, -0.75], 0);
    kit.prop.chair({ dark: mDark, metal: mGrey }, [0.45, 0.9], Math.PI - 0.35);
    // memo in an acrylic holder at the front edge, facing the room
    const drawMemo = (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, 64); c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(64, 32, 48, 20, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1c1917'; c.font = '800 21px Raleway, system-ui'; c.textAlign = 'center'; c.fillText('RYBEX', 64, 39); c.textAlign = 'left';
      c.fillStyle = '#fff'; c.font = '700 24px Raleway, system-ui'; c.fillText(tx('NOTATKA', 'MEMO'), 132, 41);
      c.fillStyle = '#1c1917'; c.font = '700 26px Raleway, system-ui'; c.fillText(tx('Pytania o procedury', 'Questions about'), 24, 112); c.fillText(tx('na zmianie', 'the procedures'), 24, 144);
      c.font = '600 18px Raleway, system-ui'; c.fillStyle = '#5b5a56'; c.fillText(tx('Od: kierownik jakości', 'From: quality manager'), 24, 182);
      c.fillStyle = '#8b8a86'; for (let i = 0; i < 9; i++) c.fillRect(24, 214 + i * 26, 250 + ((i * 41) % 70), 8);
      c.fillStyle = '#c0221c'; c.font = '700 20px Raleway, system-ui'; c.fillText(tx('PROCES-01 … 06', 'PROCES-01 … 06'), 24, h - 40);
    };
    const memo = kit.plane(mgr, [0.25, 0.34], [-0.35, 0.92, 0.33], [-0.32, -0.35, 0], kit.mat(0xffffff, { map: tex.screen(drawMemo, { w: 360, h: 490 }), rough: 0.6 }));
    memo.castShadow = false;
    kit.box(mgr, [0.27, 0.36, 0.006], [-0.35, 0.92, 0.326], new T.MeshStandardMaterial({ color: 0xe8f0f4, roughness: 0.05, transparent: true, opacity: 0.25 })).rotation.set(-0.32, -0.35, 0);
    mDark.box([0.26, 0.012, 0.08], [-0.33, 0.76, 0.38], [0, -0.35, 0]);
    // nameplate and a stack of folders
    kit.plane(mgr, [0.22, 0.06], [0.25, 0.79, 0.43], [-0.6, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(256, 70, (c, w, h) => { c.fillStyle = '#26292d'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2f2ee'; c.font = '700 22px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('Kierownik jakości', 'Quality manager'), w / 2, h / 2 + 2); }), rough: 0.4 }));
    for (let i = 0; i < 4; i++) kit.box(mgr, [0.24, 0.02, 0.32], [0.45, 0.77 + i * 0.022, 0.12], kit.mat([0x1f5f9e, 0xe0a800, 0x2f8f47, 0xc0392b][i], { rough: 0.6 })).rotation.y = (i - 1.5) * 0.06;
    mOak.done(); mGrey.done(); mDark.done(); mLam.done();
    // credenza and a plant behind the manager, by the window
    oak.box([1.4, 0.7, 0.45], [2.4, 0.35, -4.0]);
    kit.prop.plant(greenB, [4.0, -3.55], 1.35, 2);

    // ---- STATION method: whiteboard on the back wall ----
    const WBX = -2.4;
    const wb = new T.Group(); wb.position.set(WBX, 0, -D / 2 + 0.03); g.add(wb);
    const drawBoard = (c, w, h) => {
      c.fillStyle = '#fbfcfc'; c.fillRect(0, 0, w, h);
      const pen = (col, lw) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; };
      const word = (t, x, y, fs = 30) => { c.font = `600 ${fs}px "Comic Sans MS", "Segoe Print", cursive, system-ui`; c.fillText(t, x, y); };
      const boxAt = (x, y, bw, bh, t, col) => { pen(col, 4); c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + bw, y + 3); c.lineTo(x + bw - 2, y + bh); c.lineTo(x, y + bh - 2); c.closePath(); c.stroke(); word(t, x + 14, y + bh / 2 + 10, 26); };
      const arrow = (x0, y0, x1, y1, col) => { pen(col, 4); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 16 * Math.cos(a - 0.45), y1 - 16 * Math.sin(a - 0.45)); c.moveTo(x1, y1); c.lineTo(x1 - 16 * Math.cos(a + 0.45), y1 - 16 * Math.sin(a + 0.45)); c.stroke(); };
      pen('#1f3f8f', 3); word(tx('Jak asystent znajdzie odpowiedź?', 'How does the assistant find the answer?'), 40, 62, 36);
      boxAt(40, 120, 190, 76, tx('pytanie', 'question'), '#1f3f8f');
      boxAt(330, 120, 250, 76, tx('szukaj w bazie', 'search the base'), '#1f3f8f');
      boxAt(680, 120, 200, 76, tx('fragmenty', 'passages'), '#1f3f8f');
      boxAt(330, 290, 300, 76, tx('odpowiedź + źródło', 'answer + source'), '#2f7f3f');
      arrow(232, 158, 322, 158, '#1f3f8f'); arrow(582, 158, 672, 158, '#1f3f8f'); arrow(780, 200, 600, 284, '#1f3f8f');
      pen('#c0221c', 4); word(tx('ile fragmentów?', 'how many passages?'), 660, 262, 24); word('?', 900, 160, 54);
      c.beginPath(); c.ellipse(480, 330, 190, 64, -0.02, 0, Math.PI * 2); c.stroke();
      pen('#1c1917', 3); word(tx('wersja obowiązująca, nie archiwum!', 'the version in force, not the archive!'), 40, 440, 26);
      c.beginPath(); c.moveTo(40, 452); c.lineTo(520, 456); c.stroke();
      // a magnet with a printout and a sticky note
      c.fillStyle = '#fff'; c.save(); c.translate(w - 210, 300); c.rotate(0.04); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 6; c.fillRect(0, 0, 160, 200); c.shadowBlur = 0; c.fillStyle = '#9aa5ad'; for (let i = 0; i < 8; i++) c.fillRect(14, 24 + i * 20, 110 + ((i * 29) % 30), 6); c.fillStyle = '#c0221c'; c.beginPath(); c.arc(80, 4, 9, 0, Math.PI * 2); c.fill(); c.restore();
      c.fillStyle = '#ffe66b'; c.fillRect(w - 380, 380, 130, 110); c.fillStyle = '#3a3a3a'; word(tx('test: 10 pytań', 'test: 10 questions'), w - 372, 430, 18);
    };
    const wbFrame = kit.batch(wb, M.alu, { shadow: false });
    wbFrame.box([2.24, 0.03, 0.03], [0, 2.12, 0.015]).box([2.24, 0.03, 0.03], [0, 0.98, 0.015]).box([0.03, 1.17, 0.03], [-1.12, 1.55, 0.015]).box([0.03, 1.17, 0.03], [1.12, 1.55, 0.015]);
    wbFrame.box([0.9, 0.025, 0.07], [0.4, 0.96, 0.04]);                         // marker tray
    wbFrame.done();
    kit.plane(wb, [2.2, 1.12], [0, 1.55, 0.012], [0, 0, 0], kit.mat(0xffffff, { map: tex.screen(drawBoard, { w: 1024, h: 522 }), rough: 0.25 })).castShadow = false;
    [0xc0221c, 0x1f3f8f, 0x1c1917, 0x2f8f47].forEach((col, i) => { const m = kit.cyl(wb, 0.01, 0.12, [0.15 + i * 0.07, 0.985, 0.05], kit.mat(col, { rough: 0.4 })); m.rotation.z = Math.PI / 2; m.castShadow = false; });
    // flipchart easel beside it
    const fc = kit.batch(g, M.grey, { shadow: true });
    fc.rod([-4.05, 0, -5.2], [-3.95, 1.9, -5.45], 0.015, 6).rod([-3.35, 0, -5.2], [-3.45, 1.9, -5.45], 0.015, 6).rod([-3.7, 0, -5.85], [-3.7, 1.9, -5.5], 0.015, 6);
    fc.done();
    kit.plane(g, [0.68, 0.92], [-3.7, 1.42, -5.33], [-0.12, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(256, 340, (c, w, h) => { c.fillStyle = '#fdfdfb'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1f3f8f'; c.lineWidth = 4; c.font = '600 26px cursive, system-ui'; c.fillStyle = '#1f3f8f'; c.fillText(tx('Pytania zmiany B', 'Shift B questions'), 14, 40); for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(24, 84 + i * 42, 5, 0, Math.PI * 2); c.fill(); c.fillRect(40, 80 + i * 42, 120 + ((i * 47) % 60), 5); } }), rough: 0.7 })).castShadow = false;

    // ---- STATION results: meeting table with a wall screen ----
    const TVX = 0.9;
    oak.add(roundedTop(2.3, 1.05, 0.04), [TVX, 0.72, -4.55]);
    grey.cyl(0.05, 0.05, 0.7, [TVX - 0.65, 0.36, -4.55]).cyl(0.05, 0.05, 0.7, [TVX + 0.65, 0.36, -4.55]).box([0.5, 0.02, 0.5], [TVX - 0.65, 0.01, -4.55]).box([0.5, 0.02, 0.5], [TVX + 0.65, 0.01, -4.55]);
    for (const [lx, lz, ry] of [[-0.6, 0.85, Math.PI], [0.45, 0.82, Math.PI + 0.2], [-0.6, -0.8, 0], [0.55, -0.85, 0.1], [1.45, 0, -Math.PI / 2 + 0.2]]) kit.prop.chair(chair, [TVX + lx, -4.55 + lz], ry);
    dark.box([0.32, 0.02, 0.22], [TVX + 0.3, 0.75, -4.4], [0, 0.3, 0]);                       // laptop base
    dark.box([0.32, 0.22, 0.01], [TVX + 0.3 + Math.sin(0.3) * -0.11, 0.86, -4.4 - Math.cos(0.3) * 0.11], [-0.25, 0.3, 0]);
    dark.cyl(0.13, 0.15, 0.03, [TVX - 0.2, 0.755, -4.6], [0, 0, 0], 3);                     // conference phone
    const tv = new T.Group(); tv.position.set(TVX, 1.55, -D / 2 + 0.05); g.add(tv);
    const tvBody = kit.rbox(tv, [1.48, 0.86, 0.05], [0, 0, 0], M.dark, 0.012);
    const drawRes = (c, w, h) => {
      c.fillStyle = '#eef2f5'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, 74); c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(70, 37, 52, 22, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1c1917'; c.font = '800 24px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RYBEX', 70, 39); c.textAlign = 'left';
      c.fillStyle = '#fff'; c.font = '700 32px Raleway, system-ui'; c.fillText(tx('Asystent procedur · wyniki', 'Procedures assistant · results'), 140, 39);
      c.textBaseline = 'alphabetic';
      // empty KPI tiles and empty axes: filled by the experiments, never invented here
      [tx('Poprawne odpowiedzi', 'Correct answers'), tx('Ze źródłem PROCES', 'With a PROCES source'), tx('Eksperymenty', 'Experiments')].forEach((t, i) => { const x = 24 + i * 330; c.fillStyle = '#fff'; c.fillRect(x, 96, 310, 118); c.fillStyle = '#6b6a66'; c.font = '600 22px Raleway, system-ui'; c.fillText(t, x + 16, 132); c.fillStyle = '#c9d1d6'; c.font = '700 50px Raleway, system-ui'; c.fillText('–', x + 16, 194); });
      c.fillStyle = '#fff'; c.fillRect(24, 232, w - 48, h - 256);
      c.strokeStyle = '#9aa5ad'; c.lineWidth = 3; c.beginPath(); c.moveTo(80, 254); c.lineTo(80, h - 60); c.lineTo(w - 50, h - 60); c.stroke();
      c.fillStyle = '#6b6a66'; c.font = '500 24px Raleway, system-ui'; c.fillText(tx('Zapisane eksperymenty i wynik końcowy: stanowisko Wyniki.', 'Saved experiments and the final result: the Results station.'), 110, h - 110);
    };
    const tvScreen = new T.Mesh(new T.PlaneGeometry(1.42, 0.8), new T.MeshBasicMaterial({ map: tex.screen(drawRes, { w: 1024, h: 576 }), toneMapped: false }));
    tvScreen.position.set(0, 0, 0.026); tvBody.add(tvScreen);
    lam.box([1.6, 0.5, 0.42], [TVX, 0.25, -D / 2 + 0.22]);                                    // low credenza under the screen

    // ---- STATION experiment: the knowledge terminal (a kiosk with a tilted touch screen) ----
    const KX = 1.05, KZ = 2.0;
    const kiosk = new T.Group(); kiosk.position.set(KX, 0, KZ); kiosk.rotation.y = -0.62; g.add(kiosk);
    const kB = kit.batch(kiosk, M.white), kD = kit.batch(kiosk, M.dark);
    kB.box([0.6, 0.04, 0.5], [0, 0.02, 0]).box([0.3, 0.95, 0.22], [0, 0.5, -0.04]).box([0.62, 0.06, 0.34], [0, 0.98, 0.02]);
    kD.box([0.4, 0.015, 0.14], [0, 1.02, 0.1]);                                                // keyboard
    kB.done(); kD.done();
    const drawKiosk = (c, w, h) => {
      c.fillStyle = '#f5f7f9'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, 64); c.fillStyle = '#fff'; c.font = '700 28px Raleway, system-ui'; c.fillText(tx('Baza wiedzy · procedury', 'Knowledge base · procedures'), 20, 42);
      c.fillStyle = '#fff'; c.strokeStyle = '#1f5f9e'; c.lineWidth = 3; c.fillRect(20, 90, w - 40, 60); c.strokeRect(20, 90, w - 40, 60);
      c.fillStyle = '#8a949b'; c.font = '500 24px Raleway, system-ui'; c.fillText(tx('Zadajcie pytanie o procedury…', 'Ask a question about the procedures…'), 36, 128);
      c.fillStyle = '#1f5f9e'; c.fillRect(w - 110, 98, 82, 44); c.fillStyle = '#fff'; c.font = '700 20px Raleway, system-ui'; c.fillText(tx('Szukaj', 'Search'), w - 98, 127);
      c.fillStyle = '#5b5a56'; c.font = '600 20px Raleway, system-ui'; c.fillText(tx('Źródła w bazie', 'Sources in the base'), 20, 196);
      const list = docs.length ? docs : ['PROCES'];
      list.forEach((code, i) => { const x = 20 + (i % 3) * 150, y = 214 + Math.floor(i / 3) * 52; c.fillStyle = '#e1eaf2'; c.fillRect(x, y, 138, 40); c.fillStyle = '#1f3f6f'; c.font = '700 19px Raleway, system-ui'; c.fillText(code, x + 12, y + 27); });
    };
    const kMon = kit.rbox(kiosk, [0.74, 0.48, 0.04], [0, 1.42, -0.04], M.dark, 0.012);
    kMon.rotation.x = -0.28;
    const kScreen = new T.Mesh(new T.PlaneGeometry(0.7, 0.44), new T.MeshBasicMaterial({ map: tex.screen(drawKiosk, { w: 640, h: 402 }), toneMapped: false }));
    kScreen.position.set(0, 0, 0.021); kMon.add(kScreen);
    kit.plane(kiosk, [0.28, 0.5], [0, 0.55, 0.071], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(128, 228, (c, w, h) => { c.fillStyle = '#f4f4f1'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, 50); c.fillStyle = '#fff'; c.font = '800 30px Raleway, system-ui'; c.textAlign = 'center'; c.fillText('?', w / 2, 36); c.fillStyle = '#1f5f9e'; c.font = '700 17px Raleway, system-ui'; c.fillText(tx('TERMINAL', 'KNOWLEDGE'), w / 2, 100); c.fillText(tx('WIEDZY', 'TERMINAL'), w / 2, 124); }), rough: 0.5 })).castShadow = false;

    // ---- more office: plants, water cooler, printer, coat stand, clock, poster, bin ----
    kit.prop.plant(greenB, [-4.0, -5.5], 1.25, 1);
    kit.prop.plant(greenB, [4.05, 4.1], 1.15, 3);
    kit.prop.plant(greenB, [-4.0, 1.4], 0.95, 4);
    // water cooler by the left wall
    lam.box([0.32, 0.95, 0.32], [-4.2, 0.475, 3.0]);
    kit.cyl(g, 0.14, 0.38, [-4.2, 1.15, 3.0], new T.MeshStandardMaterial({ color: 0x9cc8e8, roughness: 0.1, transparent: true, opacity: 0.55 }));
    // printer on a cabinet
    lam.box([0.9, 0.7, 0.55], [-4.15, 0.35, 2.0]);
    lam.box([0.55, 0.32, 0.45], [-4.15, 0.86, 2.0]); dark.box([0.4, 0.02, 0.3], [-4.15, 1.03, 2.0]);
    // coat stand by the door
    grey.cyl(0.02, 0.02, 1.75, [0.2, 0.875, 5.6]).cyl(0.2, 0.22, 0.03, [0.2, 0.015, 5.6]);
    kit.batch(g, kit.mat(0x2a3440, { rough: 0.9 })).cyl(0.14, 0.2, 0.75, [0.2, 1.3, 5.6]).done();
    // waste bins
    dark.cyl(0.13, 0.11, 0.32, [POD[0] - 1.35, 0.16, POD[1] + 0.55], [0, 0, 0], 14).cyl(0.13, 0.11, 0.32, [3.75, 0.16, -1.95], [0, 0, 0], 14);
    // pop art and notice boards on the empty walls (front wall either side of the door, left wall by the back corner)
    kit.prop.wallArt(g, [-3.0, 1.65, D / 2], Math.PI, 'popFish', { w: 1.2, h: 1.2, seed: 8 });
    kit.prop.wallArt(g, [1.9, 1.6, D / 2], Math.PI, 'board', { w: 1.3, h: 0.95, seed: 9, lang });
    kit.prop.wallArt(g, [-W / 2, 1.65, -3.9], Math.PI / 2, 'popBurst', { w: 1.1, h: 1.1, seed: 10 });
    // wall clock above the whiteboard and a Rybex poster on the left wall
    const clock = kit.screenPlane(g, [0.34, 0.34], [-0.6, 2.4, -D / 2 + 0.02], 0, (c, w, h) => {
      c.fillStyle = '#f7f7f4'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); c.fill(); c.lineWidth = 10; c.strokeStyle = '#222'; c.stroke();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * (w / 2 - 22), h / 2 - Math.cos(a) * (w / 2 - 22)); c.lineTo(w / 2 + Math.sin(a) * (w / 2 - 44), h / 2 - Math.cos(a) * (w / 2 - 44)); c.stroke(); }
      c.lineWidth = 12; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 90, h / 2 - 40); c.stroke(); c.lineWidth = 8; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 - 30, h / 2 + 160); c.stroke();
    });
    clock.material.toneMapped = true; clock.geometry.dispose(); clock.geometry = new T.CircleGeometry(0.17, 36);
    kit.plane(g, [0.7, 1.0], [-W / 2 + 0.024, 1.6, 0.55], [0, Math.PI / 2, 0], kit.mat(0xffffff, { map: posterTex(), rough: 0.4 })).castShadow = false;
    kit.batch(g, M.frame, { shadow: false }).box([0.02, 1.04, 0.74], [-W / 2 + 0.01, 1.6, 0.55]).done();

    oak.done(); lam.done(); grey.done(); dark.done(); seat.done(); paper.done(); greenB.pot.done(); greenB.leaf.done();

    // ---- lights: daylight through the windows, LED panels ----
    g.add(new T.HemisphereLight(0xf4f6f8, 0x6b625a, 0.42));
    const sun = new T.DirectionalLight(0xfff0d8, 5.2);
    sun.position.set(14, 6.2, 1.5); sun.target.position.set(0.5, 0, -1.5);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 34 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    g.add(sun, sun.target);
    for (const [x, z] of [[-2.7, -3.3], [-2.7, 1.5], [1.8, -3.3], [1.8, 1.5]]) { const p = new T.PointLight(0xfff6ea, 4.2, 9, 1.6); p.position.set(x, H - 0.25, z); g.add(p); }
    kit.envAll(g, 0.6);

    function roundedTop(w, dd, h) {
      const s = new T.Shape(), r = dd / 2;
      s.moveTo(-w / 2 + r, -dd / 2); s.lineTo(w / 2 - r, -dd / 2); s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2); s.lineTo(-w / 2 + r, dd / 2); s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5);
      const geo = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 16 });
      geo.rotateX(-Math.PI / 2);                                                                   // lie flat; top at y = h
      kit.worldUV(geo, 1);
      return geo;
    }
    function harbourTex() {
      return kit.canvasTexture(2048, 716, (c, w, h) => {
        const r = kit.rng(17);
        kit.paint.sky(c, w, h, r, { top: '#97c0e4', horizon: '#e9f1f4', to: 0.62, clouds: 9 });
        c.fillStyle = '#9fb2bb'; c.beginPath(); c.moveTo(0, h * 0.58); for (let x = 0; x <= w; x += 64) c.lineTo(x, h * 0.58 - 10 - r() * 26); c.lineTo(w, h * 0.62); c.lineTo(0, h * 0.62); c.fill(); // far shore
        kit.paint.treeLine(c, w, h, h * 0.625, r, { rows: 1, size: 0.5, step: 0.55 });   // trees along the far shore, hazy
        const sea = c.createLinearGradient(0, h * 0.6, 0, h); sea.addColorStop(0, '#6f97ad'); sea.addColorStop(1, '#3f6a80'); c.fillStyle = sea; c.fillRect(0, h * 0.6, w, h * 0.4);
        for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(r() * w, h * 0.62 + r() * h * 0.38, 20 + r() * 50, 2); }
        // quay sheds and cranes
        for (const [x, bw, bh, col] of [[160, 360, 120, '#c9c3b8'], [600, 260, 90, '#a9b4ba'], [1300, 420, 130, '#d5d0c6'], [1780, 220, 100, '#b5b0a6']]) { c.fillStyle = col; c.fillRect(x, h * 0.62 - bh, bw, bh); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x, h * 0.62 - bh, bw, 10); }
        c.fillStyle = '#1f5f9e'; c.fillRect(1330, h * 0.62 - 104, 160, 30); c.fillStyle = '#fff'; c.font = '800 22px Raleway, system-ui'; c.fillText('RYBEX', 1370, h * 0.62 - 82);
        c.strokeStyle = '#c0392b'; c.lineWidth = 9;
        for (const x of [980, 1150]) { c.beginPath(); c.moveTo(x, h * 0.62); c.lineTo(x, h * 0.62 - 260); c.lineTo(x - 180, h * 0.62 - 230); c.moveTo(x, h * 0.62 - 240); c.lineTo(x + 60, h * 0.62 - 220); c.stroke(); }
        c.fillStyle = '#2b3a44'; c.fillRect(820, h * 0.66, 260, 34); c.fillStyle = '#e0e4e6'; c.fillRect(900, h * 0.66 - 26, 90, 26);  // a boat
      });
    }
    function posterTex() {
      return kit.canvasTexture(420, 600, (c, w, h) => {
        c.fillStyle = '#1f5f9e'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(w / 2, 150, 150, 66, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1c1917'; c.font = '800 66px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RYBEX', w / 2, 154);
        c.fillStyle = '#fff'; c.font = '700 34px Raleway, system-ui'; c.fillText(tx('Mirszyce', 'Mirszyce'), w / 2, 270);
        c.strokeStyle = '#cfe0f0'; c.lineWidth = 6; c.beginPath(); c.moveTo(80, 420); c.quadraticCurveTo(210, 340, 330, 420); c.quadraticCurveTo(210, 500, 80, 420); c.stroke();
        c.beginPath(); c.moveTo(330, 420); c.lineTo(372, 386); c.lineTo(372, 454); c.closePath(); c.stroke();
        c.fillStyle = '#cfe0f0'; c.font = '600 26px Raleway, system-ui'; c.fillText(tx('jakość z każdej puszki', 'quality in every can'), w / 2, 550);
      });
    }

    return {
      scene: g,
      bounds: { x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2 },
      lights: 'none',
      background: 0xe9ecee,
      fog: { color: 0xe9ecee, near: 14, far: 40 },
      exposure: 1.4, // an office: brighter than the halls
      spawn: { pos: [-1.0, 1.65, 4.9], yaw: -0.13 },
      colliders: [
        [POD[0] - 1.3, POD[1] - 1.25, POD[0] + 1.3, POD[1] + 1.25],          // desk pod with chairs
        [-W / 2, -2.25, -W / 2 + 0.68, -0.15],                                  // procedures cabinet
        [2.1, -3.45, 3.9, -1.55],                                               // manager desk, chairs
        [1.6, -4.3, 3.2, -3.75], [3.75, -3.8, 4.25, -3.3],                      // credenza, plant
        [TVX - 1.3, -5.5, TVX + 1.75, -3.6], [TVX - 0.8, -D / 2, TVX + 0.8, -5.55], // meeting table, credenza
        [KX - 0.35, KZ - 0.32, KX + 0.35, KZ + 0.32],                          // kiosk
        [-4.2, -5.9, -3.2, -5.0], [-4.25, -5.75, -3.75, -5.25],                // flipchart, plant
        [-W / 2, 1.6, -3.85, 3.2], [-4.25, 1.15, -3.75, 1.65],                  // printer, cooler, plant
        [-0.05, 5.35, 0.45, 5.85], [3.8, 3.85, 4.3, 4.35],                      // coat stand, plant
      ],
      stations: [
        { key: 'brief', label: { pl: 'Notatka kierownika', en: 'Manager’s memo' }, meshes: [mgr], anchor: [2.65, 1.0, -2.2], view: kit.view([2.2, 1.65, -0.85], [2.75, 0.95, -2.3], 0.3) },
        { key: 'data', label: { pl: 'Szafa z procedurami', en: 'Procedures cabinet' }, meshes: [cab], anchor: [-W / 2 + 0.4, 1.45, -1.2], view: kit.view([-1.75, 1.65, -1.05], [-W / 2 + 0.3, 1.3, -1.25], 0.3) },
        { key: 'method', label: { pl: 'Tablica', en: 'Whiteboard' }, meshes: [wb], anchor: [WBX, 1.95, -D / 2 + 0.05], view: kit.view([WBX, 1.65, -3.55], [WBX, 1.5, -D / 2], 0.3) },
        { key: 'experiment', label: { pl: 'Terminal wiedzy', en: 'Knowledge terminal' }, meshes: [kiosk], anchor: [KX, 1.3, KZ], view: kit.view([KX - 0.75, 1.65, KZ + 1.15], [KX, 1.3, KZ], 0.3) },
        { key: 'results', label: { pl: 'Ekran przy stole', en: 'Meeting screen' }, meshes: [tv], anchor: [TVX, 1.85, -D / 2 + 0.08], view: kit.view([TVX - 0.4, 1.65, -3.25], [TVX, 1.5, -D / 2], 0.28) },
      ],
      dispose() {},
    };
  });
})();
