// Room "complaints": customer service at Rybex Mirszyce. A pod of agent desks with headsets, acoustic baffles under
// the ceiling, inbox trays and pigeonholes for incoming complaints, a retention-sample shelf with cans of every
// batch, a cork pinboard, the team lead's desk and a case board with one column per complaint category.
// Stations: brief = pinboard, data = inbox trays, method = team-lead desk, experiment = classifier workstation,
// results = case board (data.categories as columns, no counts: those come from the experiments).
// Classic script; needs rooms/engine.js (window.Rooms) first.
(function () {
  'use strict';
  if (!window.Rooms) return;
  const W = 11, D = 9, H = 2.8; // x -5.5..5.5, z -4.5..4.5

  Rooms.define('complaints', ({ THREE: T, kit, lang, data, reducedMotion }) => {
    const tx = (pl, en) => lang === 'en' ? en : pl;
    const tex = kit.tex, g = new T.Group();
    const d = (data && data.complaints) || data || {};
    const cats = (Array.isArray(d.categories) ? d.categories : []).map(String).filter(Boolean).slice(0, 6);
    const CAT_COL = ['#c0392b', '#e08a00', '#7a4fa0', '#1f6fb2', '#2f8f47', '#5b6770'];

    const M = {
      floor: kit.mat(0xffffff, { map: kit.tile(tex.vinyl('#bdb7ab'), W / 2, D / 2), rough: 0.56, roughMap: [W / 2.7, D / 2.7] }), // polished vinyl, scuffed on the walkways
      wall: kit.mat(0xffffff, { map: tex.plaster('#f2f0ea'), rough: 0.92 }),
      accent: kit.mat(0xffffff, { map: tex.plaster('#f1d57a'), rough: 0.9 }),
      ceiling: kit.mat(0xffffff, { map: kit.tile(tex.ceiling(), W / 1.2, D / 1.2), rough: 0.95 }),
      skirting: kit.mat(0x5d5a52, { rough: 0.6 }),
      desk: kit.mat(0xffffff, { map: tex.wood('#d8c3a0'), rough: 0.5, roughMap: [1.3, 1.3] }),
      white: kit.mat(0xf3f3f0, { rough: 0.38 }),
      grey: kit.mat(0x8f969b, { rough: 0.45, metal: 0.45 }),
      dark: kit.mat(0x24272b, { rough: 0.36 }),
      seat: kit.mat(0x2e4a5f, { rough: 0.85 }),
      feltY: kit.mat(0xe6b422, { rough: 0.98 }),
      feltG: kit.mat(0x6f7a80, { rough: 0.98 }),
      shelf: kit.mat(0xb7bcc0, { rough: 0.4, metal: 0.6 }),
      cork: kit.mat(0xffffff, { map: tex.cork(), rough: 0.95 }),
      oak: kit.mat(0xffffff, { map: tex.wood('#b8875a'), rough: 0.6 }),
      ...kit.plantMaterials(),                                          // painted pots, veined leaves
      paper: kit.mat(0xfafaf6, { rough: 0.8 }),
      kraft: kit.mat(0xd9c39a, { rough: 0.85 }),
      lamp: new T.MeshBasicMaterial({ color: 0xfffaf0, toneMapped: false }),
      glass: new T.MeshStandardMaterial({ color: 0xdfeaf0, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false }),
    };

    // ---- shell ----
    kit.plane(g, [W, D], [0, 0, 0], [-Math.PI / 2, 0, 0], M.floor);
    kit.box(g, [W + 0.8, 0.04, D + 0.8], [0, H + 0.02, 0], M.ceiling).receiveShadow = false;
    const walls = kit.batch(g, M.wall, { uv: 0.5 });
    // left wall (x = -5.5) with two windows (sill 0.95, head 2.2) at z -2 and 1.4
    const WIN = [[-2.0, 1.8], [1.4, 1.8]];
    walls.box([0.2, 0.95, D], [-W / 2 - 0.1, 0.475, 0]).box([0.2, H - 2.2, D], [-W / 2 - 0.1, 2.2 + (H - 2.2) / 2, 0]);
    walls.box([0.2, 1.25, 1.6], [-W / 2 - 0.1, 1.575, -3.7]).box([0.2, 1.25, 1.6], [-W / 2 - 0.1, 1.575, -0.3]).box([0.2, 1.25, 2.2], [-W / 2 - 0.1, 1.575, 3.4]);
    walls.box([0.2, H, D], [W / 2 + 0.1, H / 2, 0]);                                        // right
    walls.box([6.0, H, 0.2], [-2.5, H / 2, D / 2 + 0.1]).box([4.0, H, 0.2], [3.5, H / 2, D / 2 + 0.1]).box([1.0, H - 2.1, 0.2], [1.0, 2.1 + (H - 2.1) / 2, D / 2 + 0.1]); // front, door at x 0.5..1.5
    walls.done();
    kit.batch(g, M.accent, { uv: 0.5 }).box([W, H, 0.2], [0, H / 2, -D / 2 - 0.1]).done();     // back wall, Rybex yellow
    const skirt = kit.batch(g, M.skirting, { shadow: false });
    skirt.box([0.02, 0.1, D], [-W / 2 + 0.01, 0.05, 0]).box([W, 0.1, 0.02], [0, 0.05, -D / 2 + 0.01]).box([0.02, 0.1, D], [W / 2 - 0.01, 0.05, 0]);
    skirt.done();
    const wf = kit.batch(g, M.grey, { shadow: false });
    const blindTex = kit.canvasTexture(64, 256, (c, w, h) => { c.fillStyle = '#d9dcdc'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, y + 6, w, 2); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, y, w, 1); } });
    for (const [z, w] of WIN) {
      const x = -W / 2 - 0.02;
      wf.box([0.07, 0.05, w], [x, 0.97, z]).box([0.07, 0.05, w], [x, 2.18, z]).box([0.07, 1.25, 0.05], [x, 1.575, z - w / 2]).box([0.07, 1.25, 0.05], [x, 1.575, z + w / 2]).box([0.07, 1.25, 0.04], [x, 1.575, z]);
      kit.plane(g, [w, 1.25], [x - 0.01, 1.575, z], [0, Math.PI / 2, 0], M.glass).castShadow = false;
      kit.plane(g, [w - 0.08, 0.55], [x + 0.06, 1.88, z], [0, Math.PI / 2, 0], kit.mat(0xffffff, { map: kit.tile(blindTex, 4, 1.1), rough: 0.6 })).castShadow = true;
      wf.box([0.22, 0.03, w + 0.1], [x + 0.13, 0.96, z]);
    }
    wf.done();
    kit.plane(g, [30, 10], [-W / 2 - 8, 2, 0], [0, Math.PI / 2, 0], new T.MeshBasicMaterial({ map: yardTex(), fog: false }));
    // the door frame behind the spawn
    kit.batch(g, M.white, { shadow: false }).box([0.06, 2.12, 0.1], [0.5, 1.06, D / 2 - 0.03]).box([0.06, 2.12, 0.1], [1.5, 1.06, D / 2 - 0.03]).box([1.06, 0.06, 0.1], [1.0, 2.12, D / 2 - 0.03]).done();
    kit.box(g, [0.92, 2.06, 0.04], [1.0, 1.03, D / 2 - 0.02], M.oak).castShadow = false;
    kit.prop.exitSign(g, [1.0, 2.45, D / 2 - 0.03], Math.PI, lang);
    kit.prop.extinguisher(g, [W / 2 - 0.02, 3.2], -Math.PI / 2, lang);

    // ---- acoustic baffles and linear pendants ----
    const baffY = kit.batch(g, M.feltY, { shadow: false }), baffG = kit.batch(g, M.feltG, { shadow: false });
    for (let i = 0; i < 5; i++) (i % 2 ? baffY : baffG).box([6.0, 0.24, 0.04], [-0.8, H - 0.15, -3.75 + i * 0.95]);
    baffY.done(); baffG.done();
    const pend = kit.batch(g, M.dark, { shadow: false }), tube = kit.batch(g, M.lamp, { shadow: false, receive: false });
    for (const [x, z] of [[-2.8, -2.75], [0.9, -2.75], [-2.8, 0.1], [0.9, 0.1], [3.9, -1.3]]) {
      pend.box([1.6, 0.06, 0.08], [x, 2.25, z]).rod([x - 0.6, 2.28, z], [x - 0.6, H, z], 0.004, 4).rod([x + 0.6, 2.28, z], [x + 0.6, H, z], 0.004, 4);
      tube.box([1.56, 0.01, 0.06], [x, 2.218, z]);
    }
    pend.done(); tube.done();

    // ---- batches ----
    const desk = kit.batch(g, M.desk, { uv: 1 });
    const white = kit.batch(g, M.white);
    const grey = kit.batch(g, M.grey);
    const dark = kit.batch(g, M.dark);
    const seat = kit.batch(g, M.seat);
    const paper = kit.batch(g, M.paper, { shadow: false });
    const chair = { dark: seat, metal: grey };
    const greenB = { pot: kit.batch(g, M.pot), leaf: kit.batch(g, M.leaf, { shadow: false }) };
    const deskAt = (x, z, rotY, w = 1.2, dd = 0.7, b = desk) => {
      const at = kit.frameAt(x, z, rotY), r = [0, rotY, 0];
      b.box([w, 0.03, dd], at(0, 0.735, 0), r);
      for (const sx of [-1, 1]) grey.box([0.05, 0.72, 0.05], at(sx * (w / 2 - 0.06), 0.36, dd / 2 - 0.08), r).box([0.05, 0.72, 0.05], at(sx * (w / 2 - 0.06), 0.36, -dd / 2 + 0.08), r).box([0.05, 0.05, dd - 0.1], at(sx * (w / 2 - 0.06), 0.06, 0), r);
    };
    // headset lying on a desk: band (half torus) and two ear cups, plus the boom
    const headset = (x, z, rotY) => {
      const at = kit.frameAt(x, z, rotY), band = new T.TorusGeometry(0.085, 0.008, 6, 16, Math.PI);
      band.rotateX(-Math.PI / 2 + 0.25); band.rotateY(rotY);
      dark.add(band, at(0, 0.765, 0));
      dark.cyl(0.035, 0.035, 0.02, at(-0.085, 0.765, 0)).cyl(0.035, 0.035, 0.02, at(0.085, 0.765, 0)).rod(at(-0.085, 0.77, 0), at(-0.02, 0.765, 0.13), 0.004, 4);
    };
    const screenOf = (title, rows, col = '#b8860b') => (c, w, h) => {
      c.fillStyle = '#f5f6f7'; c.fillRect(0, 0, w, h); c.fillStyle = col; c.fillRect(0, 0, w, 40);
      c.fillStyle = '#fff'; c.font = '700 22px Raleway, system-ui'; c.fillText(title, 14, 28);
      for (let i = 0; i < rows; i++) { c.fillStyle = i % 2 ? '#eceef0' : '#fff'; c.fillRect(14, 54 + i * 32, w - 28, 26); c.fillStyle = '#9aa5ad'; c.fillRect(24, 63 + i * 32, 90 + ((i * 61) % 160), 8); c.fillStyle = CAT_COL[i % CAT_COL.length]; c.fillRect(w - 80, 60 + i * 32, 46, 14); }
    };

    // ---- agent pod: 3 + 3 desks back to back, a yellow felt divider ----
    const POD = [-0.7, 0.9];
    const podScreens = [tx('Skrzynka zgłoszeń', 'Complaints inbox'), tx('Rejestr reklamacji', 'Complaints register'), tx('Odpowiedzi', 'Replies'), tx('Skrzynka zgłoszeń', 'Complaints inbox'), tx('Klienci', 'Customers'), tx('Rejestr reklamacji', 'Complaints register')];
    let si = 0;
    for (const side of [1, -1]) for (const lx of [-1.25, 0, 1.25]) {
      const x = POD[0] + lx, z = POD[1] + side * 0.38, rotY = side > 0 ? 0 : Math.PI;
      deskAt(x, z, rotY);
      const at = kit.frameAt(x, z, rotY);
      kit.prop.monitor(g, dark, at(0, 0.75, -0.16), rotY, screenOf(podScreens[si], 6));
      dark.box([0.42, 0.02, 0.13], at(0, 0.76, 0.1), [0, rotY, 0]);
      headset(...at(0.4, 0, 0.05).filter((_, i) => i !== 1), rotY + 0.4);
      paper.box([0.21, 0.004, 0.297], at(-0.38, 0.752, 0.08), [0, rotY + 0.15, 0]);
      kit.prop.chair(chair, at(0.05, 0, 0.6), rotY + Math.PI + (si % 2 ? 0.2 : -0.25));
      si++;
    }
    kit.batch(g, M.feltY, { uv: 1 }).box([3.8, 0.5, 0.05], [POD[0], 1.0, POD[1]]).done();

    // ---- STATION experiment: the classifier workstation (two screens, a headset, a test-station sign) ----
    const CX = 3.0, CZ = -1.0;
    const cls = new T.Group(); cls.position.set(CX, 0, CZ); cls.rotation.y = -0.3; g.add(cls);
    const cDesk = kit.batch(cls, M.desk, { uv: 1 }), cDark = kit.batch(cls, M.dark), cGrey = kit.batch(cls, M.grey);
    cDesk.box([1.5, 0.03, 0.75], [0, 0.735, 0]);
    for (const sx of [-0.68, 0.68]) cGrey.box([0.05, 0.72, 0.65], [sx, 0.36, 0]);
    const drawCls = (c, w, h) => {
      c.fillStyle = '#f6f6f3'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1917'; c.fillRect(0, 0, w, 46);
      c.fillStyle = '#ffd500'; c.font = '700 24px Raleway, system-ui'; c.fillText(tx('Klasyfikator zgłoszeń', 'Complaint classifier'), 14, 31);
      c.fillStyle = '#fff'; c.fillRect(14, 60, w - 28, 120); c.strokeStyle = '#cfd4d8'; c.strokeRect(14, 60, w - 28, 120);
      c.fillStyle = '#8a949b'; for (let i = 0; i < 4; i++) c.fillRect(26, 78 + i * 24, w - 90 - ((i * 47) % 120), 8);
      c.fillStyle = '#5b5a56'; c.font = '600 18px Raleway, system-ui'; c.fillText(tx('Kategoria:', 'Category:'), 14, 210);
      const list = cats.length ? cats : [tx('kategoria', 'category')];
      let x = 14, y = 226;
      list.forEach((t, i) => { c.font = '600 16px Raleway, system-ui'; const tw = c.measureText(t).width + 22; if (x + tw > w - 10) { x = 14; y += 40; } c.fillStyle = '#fff'; c.strokeStyle = CAT_COL[i % CAT_COL.length]; c.lineWidth = 3; c.fillRect(x, y, tw, 30); c.strokeRect(x, y, tw, 30); c.fillStyle = '#1c1917'; c.fillText(t, x + 11, y + 21); x += tw + 8; });
    };
    const drawRules = (c, w, h) => {
      c.fillStyle = '#1e2226'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd500'; c.font = '700 22px ui-monospace, monospace'; c.fillText(tx('reguły.txt', 'rules.txt'), 14, 30);
      c.font = '500 17px ui-monospace, monospace';
      const list = cats.length ? cats : ['…'];
      list.forEach((t, i) => { c.fillStyle = CAT_COL[i % CAT_COL.length]; c.fillText(`${t}:`, 14, 66 + i * 34); c.fillStyle = '#7f8b93'; c.fillRect(24 + Math.min(220, c.measureText(t).width + 16), 56 + i * 34, 140, 8); });
    };
    kit.prop.monitor(cls, cDark, [-0.33, 0.75, -0.18], 0.12, drawCls, [0.56, 0.36]);
    kit.prop.monitor(cls, cDark, [0.33, 0.75, -0.18], -0.12, drawRules, [0.52, 0.33]);
    cDark.box([0.44, 0.02, 0.14], [0, 0.76, 0.12]);
    const clsAnchor = kit.frameAt(CX, CZ, -0.3)(-0.33, 1.1, -0.16);                        // the classifier screen
    cDesk.done(); cDark.done(); cGrey.done();
    const hb = kit.batch(cls, M.dark); { const band = new T.TorusGeometry(0.085, 0.008, 6, 16, Math.PI); band.rotateX(-Math.PI / 2 + 0.25); hb.add(band, [0.55, 0.765, 0.1]).cyl(0.035, 0.035, 0.02, [0.465, 0.765, 0.1]).cyl(0.035, 0.035, 0.02, [0.635, 0.765, 0.1]); } hb.done();
    // a hanging sign over the test station
    kit.box(cls, [0.72, 0.19, 0.02], [0, 2.2, -0.25], kit.mat(0xffffff, { map: kit.canvasTexture(384, 102, (c, w, h) => { c.fillStyle = '#1c1917'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd500'; c.font = '800 34px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('STANOWISKO TESTOWE', 'TEST STATION'), w / 2, h / 2 + 2); }), rough: 0.5 }));
    kit.batch(cls, M.grey, { shadow: false }).rod([-0.3, 2.29, -0.25], [-0.3, H, -0.25], 0.004, 4).rod([0.3, 2.29, -0.25], [0.3, H, -0.25], 0.004, 4).done();
    { const cs = { dark: kit.batch(cls, M.seat), metal: kit.batch(cls, M.grey) }; kit.prop.chair(cs, [0.55, 0.72], Math.PI - 0.5); cs.dark.done(); cs.metal.done(); }

    // ---- STATION data: inbox trays and pigeonholes on the back wall ----
    const IX = 1.9;
    const inbox = new T.Group(); inbox.position.set(IX, 0, -D / 2 + 0.25); g.add(inbox);
    const iW = kit.batch(inbox, M.white), iG = kit.batch(inbox, M.grey), iP = kit.batch(inbox, M.paper, { shadow: false }), iK = kit.batch(inbox, M.kraft, { shadow: false });
    iW.box([1.5, 0.9, 0.48], [0, 0.45, 0]);                                                     // low cabinet
    for (const x of [-0.37, 0.37]) iG.box([0.14, 0.015, 0.01], [x, 0.62, 0.245]);
    iW.box([0.012, 0.88, 0.005], [0, 0.45, 0.242]);
    // three-tier letter trays (smoked plastic), papers and envelopes in them
    const trayMat = new T.MeshStandardMaterial({ color: 0x3b4a55, roughness: 0.25, transparent: true, opacity: 0.75 });
    const tray = kit.batch(inbox, trayMat);
    for (const tx0 of [-0.42, 0.12]) for (let k = 0; k < 3; k++) {
      const y = 0.92 + k * 0.1;
      tray.box([0.27, 0.008, 0.35], [tx0, y, 0.02]).box([0.008, 0.06, 0.35], [tx0 - 0.135, y + 0.03, 0.02]).box([0.008, 0.06, 0.35], [tx0 + 0.135, y + 0.03, 0.02]).box([0.27, 0.06, 0.008], [tx0, y + 0.03, -0.155]);
      for (let p = 0; p < 2 + ((k + (tx0 > 0 ? 1 : 0)) % 3); p++) (p % 2 ? iK : iP).box([0.23, 0.004, 0.31], [tx0 + (p - 1) * 0.006, y + 0.008 + p * 0.006, 0.03 + (p % 2) * 0.01], [0, (p - 1) * 0.05, 0]);
    }
    tray.done();
    // tray labels
    const trayLab = kit.canvasTexture(512, 64, (c, w, h) => { c.fillStyle = '#fff'; const labs = [tx('NOWE', 'NEW'), tx('W TOKU', 'IN PROGRESS')]; labs.forEach((t, i) => { c.fillStyle = '#fff'; c.fillRect(i * 256 + 40, 10, 176, 44); c.fillStyle = '#1c1917'; c.font = '700 24px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, i * 256 + 128, 33); }); });
    kit.plane(inbox, [0.82, 0.05], [-0.15, 0.885, 0.2], [0, 0, 0], new T.MeshBasicMaterial({ map: trayLab, transparent: true })).castShadow = false;
    // pigeonhole rack on the wall above: 4 x 3 cells with envelopes
    const PH = [1.42, 0.74], cellW = PH[0] / 4, cellH = PH[1] / 3, PY = 1.32;
    const ph = kit.batch(inbox, M.oak, { uv: 1 });
    ph.box([PH[0], PH[1], 0.02], [0, PY + PH[1] / 2, -0.2]);
    for (let i = 0; i <= 4; i++) ph.box([0.018, PH[1], 0.3], [-PH[0] / 2 + i * cellW, PY + PH[1] / 2, -0.06]);
    for (let j = 0; j <= 3; j++) ph.box([PH[0] + 0.018, 0.018, 0.3], [0, PY + j * cellH, -0.06]);
    ph.done();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const n = (i * 3 + j * 5) % 4;
      for (let k = 0; k < n; k++) ((i + j + k) % 3 ? iP : iK).box([cellW - 0.06, 0.11, 0.004], [-PH[0] / 2 + (i + 0.5) * cellW, PY + j * cellH + 0.065, -0.17 + k * 0.03], [-0.15 - k * 0.06, 0, 0]);
    }
    iW.done(); iG.done(); iP.done(); iK.done();
    kit.plane(inbox, [1.4, 0.2], [0, PY + PH[1] + 0.16, -0.2], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(700, 100, (c, w, h) => { c.fillStyle = '#1c1917'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd500'; c.font = '800 46px Raleway, system-ui'; c.textBaseline = 'middle'; c.fillText(tx('SKRZYNKA REKLAMACJI', 'COMPLAINTS INBOX'), 24, h / 2 + 3); }), rough: 0.5 })).castShadow = false;
    // pigeonhole name tags
    kit.plane(inbox, [PH[0], 0.035], [0, PY + 0.012, 0.096], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(1024, 26, (c, w, h) => { c.fillStyle = '#f1efe8'; c.fillRect(0, 0, w, h); c.font = '700 17px Raleway, system-ui'; c.textBaseline = 'middle'; c.textAlign = 'center'; const labs = cats.length ? cats : ['', '', '', '']; for (let i = 0; i < 4; i++) { c.fillStyle = CAT_COL[i % CAT_COL.length]; c.fillRect(i * 256 + 8, 5, 10, 16); c.fillStyle = '#1c1917'; let t = labs[i] || ''; while (t && c.measureText(t).width > 220) t = t.slice(0, -1); c.fillText(t, i * 256 + 136, 14); } }), rough: 0.6 })).castShadow = false;

    // ---- STATION results: the case board, one column per category ----
    const BX = -1.0, BW = 3.1, BH = 1.3, BY = 1.45;
    const board = new T.Group(); board.position.set(BX, 0, -D / 2 + 0.03); g.add(board);
    const drawCases = (c, w, h) => {
      c.fillStyle = '#fbfcfc'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1c1917'; c.font = '800 34px Raleway, system-ui'; c.fillText(tx('TABLICA SPRAW · KATEGORIE', 'CASE BOARD · CATEGORIES'), 24, 48);
      // results corner: empty tiles, filled by the experiments, never invented here
      const tiles = [tx('Trafność kategorii', 'Category accuracy'), tx('Bezpieczeństwo żywności', 'Food safety caught')];
      tiles.forEach((t, i) => { const x = w - 520 + i * 256; c.fillStyle = '#eef1f3'; c.fillRect(x, 14, 240, 70); c.fillStyle = '#6b6a66'; c.font = '600 17px Raleway, system-ui'; c.fillText(t, x + 12, 38); c.fillStyle = '#b9c2c8'; c.font = '700 28px Raleway, system-ui'; c.fillText('–', x + 12, 72); });
      const list = cats.length ? cats : [tx('Kategoria', 'Category')];
      const n = list.length, x0 = 24, cw = (w - 48) / n, top = 104;
      list.forEach((t, i) => {
        const x = x0 + i * cw;
        c.fillStyle = CAT_COL[i % CAT_COL.length]; c.fillRect(x + 4, top, cw - 8, 50);
        c.fillStyle = '#fff'; let fs = 22; c.font = `700 ${fs}px Raleway, system-ui`; while (c.measureText(t).width > cw - 24 && fs > 12) { fs--; c.font = `700 ${fs}px Raleway, system-ui`; } c.fillText(t, x + 14, top + 33);
        c.strokeStyle = '#d3d8dc'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + cw, top); c.lineTo(x + cw, h - 20); c.stroke();
        c.setLineDash([8, 6]); c.strokeStyle = '#c4cacf';
        for (let k = 0; k < 3; k++) c.strokeRect(x + 14, top + 70 + k * 92, cw - 28, 76);
        c.setLineDash([]);
      });
      c.fillStyle = '#8a8d90'; c.font = '500 20px Raleway, system-ui'; c.fillText(tx('Zgłoszenia trafią tu po klasyfikacji.', 'Complaints land here once classified.'), 24, h - 24);
    };
    const bFrame = kit.batch(board, M.grey, { shadow: false });
    bFrame.box([BW + 0.04, 0.03, 0.03], [0, BY + BH / 2 + 0.015, 0.015]).box([BW + 0.04, 0.03, 0.03], [0, BY - BH / 2 - 0.015, 0.015]).box([0.03, BH + 0.06, 0.03], [-BW / 2 - 0.015, BY, 0.015]).box([0.03, BH + 0.06, 0.03], [BW / 2 + 0.015, BY, 0.015]).box([1.0, 0.025, 0.07], [0.6, BY - BH / 2 - 0.04, 0.04]);
    bFrame.done();
    kit.plane(board, [BW, BH], [0, BY, 0.012], [0, 0, 0], kit.mat(0xffffff, { map: tex.screen(drawCases, { w: 1240, h: 520 }), rough: 0.65 })).castShadow = false;
    // magnets in the column heads
    const mag = kit.batch(board, M.dark, { shadow: false });
    (cats.length ? cats : [0]).forEach((_, i, a) => mag.cyl(0.018, 0.018, 0.012, [-BW / 2 + (i + 0.5) * (BW / a.length), BY + BH / 2 - 0.28, 0.02], [Math.PI / 2, 0, 0], 10));
    mag.done();

    // ---- STATION brief: the cork pinboard on the back wall ----
    const PX = -4.2;
    const pin = new T.Group(); pin.position.set(PX, 0, -D / 2 + 0.03); g.add(pin);
    const drawPin = (c, w, h) => {
      const note = (x, y, ww, hh, rot, fill, draw) => { c.save(); c.translate(x, y); c.rotate(rot); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 6; c.shadowOffsetY = 2; c.fillStyle = fill; c.fillRect(0, 0, ww, hh); c.shadowColor = 'transparent'; draw(ww, hh); c.restore(); };
      const pinAt = (x, y, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2); c.fill(); };
      note(30, 26, 250, 330, -0.03, '#fff', (ww) => {
        c.fillStyle = '#e6b422'; c.fillRect(0, 0, ww, 44); c.fillStyle = '#1c1917'; c.font = '800 18px Raleway, system-ui'; c.fillText('RYBEX · ' + tx('NOTATKA', 'MEMO'), 12, 29);
        c.font = '700 18px Raleway, system-ui'; c.fillText(tx('Reklamacje:', 'Complaints:'), 12, 78); c.fillText(tx('sortowanie zgłoszeń', 'sorting the reports'), 12, 101);
        c.font = '600 14px Raleway, system-ui'; c.fillStyle = '#5b5a56'; c.fillText(tx('Od: obsługa klienta', 'From: customer service'), 12, 128);
        c.fillStyle = '#9a9994'; for (let i = 0; i < 7; i++) c.fillRect(12, 150 + i * 22, 190 + ((i * 37) % 40), 6);
        pinAt(ww / 2, 10, '#c0392b');
      });
      note(310, 40, 160, 120, 0.05, '#ffe66b', () => { c.fillStyle = '#3a3a3a'; c.font = '600 17px Raleway, system-ui'; c.fillText(tx('np. cel: 9 na 10', 'e.g. goal: 9 in 10'), 12, 34); c.fillText(tx('kategorii', 'categories'), 12, 58); c.fillText(tx('trafnych', 'right'), 12, 82); pinAt(80, 8, '#1f6fb2'); });
      note(300, 190, 180, 150, -0.04, '#fff', () => { c.fillStyle = '#c9cdd0'; c.fillRect(10, 10, 160, 110); c.fillStyle = '#1f6fb2'; c.fillRect(60, 30, 60, 76); c.fillStyle = '#ffd500'; c.beginPath(); c.ellipse(90, 52, 20, 9, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#7a1d14'; c.lineWidth = 4; c.beginPath(); c.moveTo(60, 74); c.quadraticCurveTo(70, 82, 64, 96); c.stroke(); c.fillStyle = '#3a3a3a'; c.font = '600 14px Raleway, system-ui'; c.fillText(tx('wgniecenie?', 'dent?'), 12, 140); pinAt(90, 6, '#2f8f47'); });
      note(510, 30, 210, 150, 0.02, '#f4f8fb', () => { c.fillStyle = '#1c1917'; c.font = '700 15px Raleway, system-ui'; c.fillText(tx('Bezpieczeństwo żywności', 'Food safety'), 10, 26); c.fillStyle = '#c0392b'; c.font = '700 15px Raleway, system-ui'; c.fillText(tx('zapach · wybrzuszenie · syk', 'smell · bulging · hiss'), 10, 52); c.fillStyle = '#5b5a56'; c.font = '600 14px Raleway, system-ui'; c.fillText(tx('zawsze do działu jakości', 'always to quality'), 10, 78); c.fillStyle = '#9a9994'; for (let i = 0; i < 2; i++) c.fillRect(10, 98 + i * 20, 170, 6); pinAt(105, 6, '#c0392b'); });
      note(520, 210, 200, 140, -0.05, '#9fd7f0', () => { c.fillStyle = '#1c1917'; c.font = '600 16px Raleway, system-ui'; c.fillText(tx('Dyżur: zmiana A', 'Duty: shift A'), 12, 30); c.fillText('8:00–16:00', 12, 56); c.fillStyle = '#5b5a56'; c.fillText(tx('tel. 214', 'ext. 214'), 12, 86); pinAt(100, 6, '#e08a00'); });
    };
    const pFrame = kit.batch(pin, M.oak, { uv: 1, shadow: false });
    pFrame.box([1.64, 0.04, 0.03], [0, 2.03, 0.015]).box([1.64, 0.04, 0.03], [0, 0.99, 0.015]).box([0.04, 1.08, 0.03], [-0.8, 1.51, 0.015]).box([0.04, 1.08, 0.03], [0.8, 1.51, 0.015]);
    pFrame.done();
    kit.plane(pin, [1.56, 1.0], [0, 1.51, 0.01], [0, 0, 0], M.cork).castShadow = false;
    const pinTex = tex.screen(drawPin, { w: 760, h: 380 });
    const pinNotes = kit.plane(pin, [1.5, 0.75], [0, 1.53, 0.014], [0, 0, 0], new T.MeshStandardMaterial({ map: pinTex, transparent: true, roughness: 0.7 }));
    pinNotes.castShadow = false;

    // ---- STATION method: the team lead's desk (left side), a category guide on a stand ----
    const LX = -4.35, LZ = -1.45;
    const lead = new T.Group(); lead.position.set(LX, 0, LZ); lead.rotation.y = Math.PI / 2; g.add(lead);
    const lDesk = kit.batch(lead, M.oak, { uv: 1 }), lDark = kit.batch(lead, M.dark), lGrey = kit.batch(lead, M.grey), lWhite = kit.batch(lead, M.white);
    lDesk.box([1.6, 0.035, 0.8], [0, 0.74, 0]);
    lWhite.box([0.42, 0.62, 0.62], [0.55, 0.31, -0.02]).box([0.025, 0.72, 0.75], [-0.77, 0.36, 0]);
    lDesk.box([1.4, 0.35, 0.02], [-0.1, 0.52, -0.37]);
    kit.prop.monitor(lead, lDark, [-0.2, 0.757, -0.2], 0, screenOf(tx('Zespół · kolejka', 'Team · queue'), 7), [0.6, 0.35]);
    lDark.box([0.44, 0.02, 0.14], [-0.2, 0.768, 0.1]);
    { const band = new T.TorusGeometry(0.085, 0.008, 6, 16, Math.PI); band.rotateX(-Math.PI / 2 + 0.25); lDark.add(band, [0.3, 0.765, 0.15]).cyl(0.035, 0.035, 0.02, [0.215, 0.765, 0.15]).cyl(0.035, 0.035, 0.02, [0.385, 0.765, 0.15]); }
    // binder PROCES-04 and a guide on a stand
    kit.box(lead, [0.07, 0.31, 0.27], [-0.68, 0.91, -0.15], kit.mat(0xe08a00, { rough: 0.55 }));
    const guide = (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1917'; c.fillRect(0, 0, w, 50);
      c.fillStyle = '#ffd500'; c.font = '800 22px Raleway, system-ui'; c.fillText(tx('JAK KATEGORYZUJEMY', 'HOW WE CATEGORISE'), 14, 33);
      const list = cats.length ? cats : [tx('kategoria', 'category')];
      list.forEach((t, i) => { const y = 74 + i * 52; c.fillStyle = CAT_COL[i % CAT_COL.length]; c.fillRect(14, y, 12, 38); c.fillStyle = '#1c1917'; c.font = '700 19px Raleway, system-ui'; c.fillText(t, 36, y + 18); c.fillStyle = '#9a9994'; c.fillRect(36, y + 28, 150 + ((i * 41) % 60), 5); });
      c.fillStyle = '#c0392b'; c.font = '700 16px Raleway, system-ui'; c.fillText('PROCES-04', 14, h - 18);
    };
    kit.plane(lead, [0.3, 0.4], [0.25, 0.97, 0.12], [-0.3, -0.3, 0], kit.mat(0xffffff, { map: tex.screen(guide, { w: 300, h: 400 }), rough: 0.5 })).castShadow = false;
    lDark.box([0.3, 0.012, 0.1], [0.25, 0.76, 0.2], [0, -0.3, 0]);
    // desk sign
    kit.plane(lead, [0.24, 0.065], [-0.2, 0.79, 0.37], [-0.6, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(256, 70, (c, w, h) => { c.fillStyle = '#26292d'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2f2ee'; c.font = '700 22px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('Lider zespołu', 'Team lead'), w / 2, h / 2 + 2); }), rough: 0.4 }));
    kit.prop.chair({ dark: lDark, metal: lGrey }, [-0.15, -0.72], 0);
    lDesk.done(); lDark.done(); lGrey.done(); lWhite.done();
    // a flag stand / screen partition behind the lead desk
    // hanging sign over the team lead's desk, so it reads from across the room
    kit.box(lead, [0.95, 0.22, 0.02], [0, 2.15, -0.1], kit.mat(0xffffff, { map: kit.canvasTexture(420, 98, (c, w, h) => { c.fillStyle = '#2f3438'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd500'; c.font = '800 38px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('LIDER ZESPOŁU', 'TEAM LEAD'), w / 2, h / 2 + 2); }), rough: 0.5 }));
    kit.batch(lead, M.grey, { shadow: false }).rod([-0.4, 2.26, -0.1], [-0.4, H, -0.1], 0.004, 4).rod([0.4, 2.26, -0.1], [0.4, H, -0.1], 0.004, 4).done();

    // ---- retention-sample shelf (back wall, right): cans of each batch, kept for checks ----
    const RX = 4.15, RZ = -D / 2 + 0.25;
    const rs = kit.batch(g, M.shelf);
    const RW = 2.0, RD = 0.4, levels = [0.15, 0.55, 0.95, 1.35, 1.75];
    for (const sx of [-RW / 2, RW / 2]) for (const sz of [-RD / 2, RD / 2]) rs.box([0.035, 2.0, 0.035], [RX + sx, 1.0, RZ + sz]);
    for (const y of levels) rs.box([RW, 0.02, RD], [RX, y, RZ]).box([RW, 0.04, 0.012], [RX, y + 0.01, RZ + RD / 2]);
    rs.done();
    const canGeo = new T.CylinderGeometry(0.037, 0.037, 0.105, 18);
    const PRODUCT_LAB = [['#b3261e', '#ffd500'], ['#2f6f3a', '#f2f2ee'], ['#d0a020', '#1c1917'], ['#1f5f9e', '#ffd500']];
    PRODUCT_LAB.forEach(([bg, fg], pi) => {
      const lab = kit.canvasTexture(256, 64, (c, w, h) => { c.fillStyle = '#c9cdd0'; c.fillRect(0, 0, w, h); c.fillStyle = bg; c.fillRect(0, 10, w, 44); c.fillStyle = fg; c.font = '800 18px Raleway, system-ui'; c.fillText('RYBEX', 18, 38); c.fillText('RYBEX', 146, 38); });
      const list = [];
      levels.slice(1).forEach((y, li) => { for (let k = 0; k < 6; k++) { const idx = li * 24 + pi * 6 + k; const x = RX - RW / 2 + 0.08 + ((pi * 6 + k) % 24) * 0.078; if (x > RX + RW / 2 - 0.05) continue; list.push({ p: [x, y + 0.01 + 0.0525, RZ + 0.05 - (idx % 2) * 0.09] }); } });
      kit.inst(g, canGeo, [kit.mat(0xffffff, { map: lab, rough: 0.35, metal: 0.4 }), M.grey, M.grey], list, { shadow: false });
    });
    // batch tags on the shelf lips
    const tags = kit.canvasTexture(1024, 48, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); for (let i = 0; i < 6; i++) { c.fillStyle = '#fbfbf6'; c.fillRect(i * 170 + 10, 4, 140, 40); c.fillStyle = '#1c1917'; c.font = '700 20px ui-monospace, monospace'; c.fillText(`RYB-26${(10 + i * 3) % 100}`.slice(0, 9), i * 170 + 18, 31); } });
    for (const y of levels.slice(1)) kit.plane(g, [RW - 0.05, 0.035], [RX, y + 0.012, RZ + RD / 2 + 0.008], [0, 0, 0], new T.MeshStandardMaterial({ map: tags, transparent: true, roughness: 0.6 })).castShadow = false;
    kit.plane(g, [1.6, 0.22], [RX, 2.2, -D / 2 + 0.02], [0, 0, 0], kit.mat(0xffffff, { map: kit.canvasTexture(720, 100, (c, w, h) => { c.fillStyle = '#2f3438'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 40px Raleway, system-ui'; c.textBaseline = 'middle'; c.fillText(tx('PRÓBKI ARCHIWALNE', 'RETENTION SAMPLES'), 22, h / 2 + 3); }), rough: 0.5 })).castShadow = false;

    // ---- more of the room: plants, water dispenser, printer, a wallboard over the pod, a clock ----
    kit.prop.plant(greenB, [-5.0, -4.0], 1.3, 5);
    kit.prop.plant(greenB, [5.0, 1.0], 1.1, 6);
    kit.prop.plant(greenB, [-5.0, 3.9], 1.0, 7);
    white.box([0.34, 1.0, 0.34], [5.15, 0.5, 2.3]);
    kit.cyl(g, 0.15, 0.4, [5.15, 1.2, 2.3], new T.MeshStandardMaterial({ color: 0x9cc8e8, roughness: 0.1, transparent: true, opacity: 0.55 }));
    white.box([0.9, 0.75, 0.6], [-4.95, 0.375, 2.5]).box([0.6, 0.3, 0.5], [-4.95, 0.9, 2.5]);
    dark.box([0.45, 0.02, 0.32], [-4.95, 1.06, 2.5]);
    // pop art and notice boards on the empty walls (right wall, and the front wall either side of the door)
    kit.prop.wallArt(g, [W / 2, 1.65, -3.0], -Math.PI / 2, 'popFish', { w: 1.1, h: 1.1, seed: 2 });
    kit.prop.wallArt(g, [W / 2, 1.6, -1.15], -Math.PI / 2, 'board', { w: 1.2, h: 0.9, seed: 3, lang });
    kit.prop.wallArt(g, [-2.6, 1.65, D / 2], Math.PI, 'popBurst', { w: 1.5, h: 1.05, seed: 4 });
    kit.prop.wallArt(g, [3.6, 1.6, D / 2], Math.PI, 'board', { w: 1.3, h: 0.95, seed: 5, lang });
    // wallboard on the left wall: shift, opening hours, no counts
    kit.rbox(g, [0.06, 0.66, 1.16], [-W / 2 + 0.03, 1.95, 0.0], M.dark, 0.012);
    kit.screenPlane(g, [1.1, 0.6], [-W / 2 + 0.065, 1.95, 0.0], Math.PI / 2, (c, w, h) => {
      c.fillStyle = '#16191c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd500'; c.font = '800 44px Raleway, system-ui'; c.fillText(tx('OBSŁUGA KLIENTA', 'CUSTOMER SERVICE'), 30, 70);
      c.fillStyle = '#cfd6db'; c.font = '600 32px Raleway, system-ui'; c.fillText(tx('Pn–Pt 8:00–16:00', 'Mon–Fri 8:00–16:00'), 30, 140); c.fillText(tx('Infolinia: wew. 214', 'Hotline: ext. 214'), 30, 190);
      c.fillStyle = '#2fd15a'; c.beginPath(); c.arc(w - 60, 60, 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7f8b93'; c.font = '600 26px Raleway, system-ui'; c.fillText(tx('Kanały: e-mail · telefon · formularz', 'Channels: e-mail · phone · form'), 30, h - 50);
    });
    const clock = kit.screenPlane(g, [0.32, 0.32], [0.6, 2.35, -D / 2 + 0.02], 0, (c, w, h) => {
      c.fillStyle = '#f7f7f4'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); c.fill(); c.lineWidth = 10; c.strokeStyle = '#222'; c.stroke();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * (w / 2 - 22), h / 2 - Math.cos(a) * (w / 2 - 22)); c.lineTo(w / 2 + Math.sin(a) * (w / 2 - 44), h / 2 - Math.cos(a) * (w / 2 - 44)); c.stroke(); }
      c.lineWidth = 12; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 - 80, h / 2 + 50); c.stroke(); c.lineWidth = 8; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 40, h / 2 - 160); c.stroke();
    });
    clock.material.toneMapped = true; clock.geometry.dispose(); clock.geometry = new T.CircleGeometry(0.16, 36);
    // parcels of returned cans waiting by the inbox (a returned pallet's samples)
    const box = kit.batch(g, kit.mat(0xffffff, { map: tex.cardboard(), rough: 0.85 }), { uv: 2.5 });
    box.box([0.4, 0.3, 0.3], [3.0, 0.15, -3.95], [0, 0.2, 0]).box([0.36, 0.26, 0.3], [3.05, 0.43, -3.9], [0, -0.1, 0]).box([0.45, 0.32, 0.35], [0.6, 0.16, -4.05], [0, 0.05, 0]);
    box.done();
    kit.plane(g, [0.3, 0.12], [3.0, 0.2, -3.79], [0, 0.2, 0], kit.mat(0xffffff, { map: kit.canvasTexture(256, 100, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0392b'; c.font = '800 34px Raleway, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx('ZWROT', 'RETURN'), w / 2, h / 2 + 2); }), rough: 0.6 })).castShadow = false;

    desk.done(); white.done(); grey.done(); dark.done(); seat.done(); paper.done(); greenB.pot.done(); greenB.leaf.done();

    // ---- lights ----
    g.add(new T.HemisphereLight(0xf6f4ee, 0x6d665a, 0.42));
    const sun = new T.DirectionalLight(0xfff2de, 3.6);
    sun.position.set(-14, 6, 2); sun.target.position.set(0, 0, -0.5);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 34 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    g.add(sun, sun.target);
    for (const [x, z] of [[-2.8, -2.75], [0.9, -2.75], [-2.8, 0.1], [0.9, 0.1], [3.9, -1.3]]) { const p = new T.PointLight(0xfff4e4, 3.2, 8, 1.6); p.position.set(x, 2.1, z); g.add(p); }
    kit.envAll(g, 0.6);

    function yardTex() {
      return kit.canvasTexture(1536, 512, (c, w, h) => {
        const r = kit.rng(29);
        kit.paint.sky(c, w, h, r, { top: '#a1c4e0', to: 0.55 });
        kit.paint.treeLine(c, w, h, h * 0.66, r, { rows: 3, size: 1.1 });   // a tree line behind the yard, the factory stands in front of it
        const fx = w * 0.26, fw = w * 0.42;
        c.fillStyle = '#d4cfc5'; c.fillRect(fx, h * 0.35, fw, h * 0.31); c.fillStyle = 'rgba(0,0,0,.08)'; for (let x = fx; x < fx + fw; x += 48) c.fillRect(x, h * 0.35, 3, h * 0.31);   // the factory across the yard
        c.fillStyle = '#1f6fb2'; c.fillRect(w * 0.3, h * 0.38, 300, 46); c.fillStyle = '#fff'; c.font = '800 32px Raleway, system-ui'; c.fillText('RYBEX', w * 0.3 + 20, h * 0.38 + 34);
        c.fillStyle = '#7d8286'; c.fillRect(0, h * 0.65, w, h * 0.35);
        for (let i = 0; i < 7; i++) { const x = 80 + r() * (w - 200); c.fillStyle = ['#c0392b', '#e8e8e8', '#2b3a44', '#1f5f9e'][i % 4]; c.fillRect(x, h * 0.6, 110, 40); c.fillStyle = '#222'; c.fillRect(x + 12, h * 0.6 + 34, 20, 12); c.fillRect(x + 78, h * 0.6 + 34, 20, 12); }
      });
    }

    return {
      scene: g,
      bounds: { x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2 },
      lights: 'none',
      background: 0xeceae4,
      fog: { color: 0xeceae4, near: 14, far: 40 },
      exposure: 1.32,
      spawn: { pos: [1.0, 1.65, 3.65], yaw: 0.2 },
      colliders: [
        [POD[0] - 1.95, POD[1] - 1.25, POD[0] + 1.95, POD[1] + 1.25],          // agent pod with chairs
        [CX - 0.95, CZ - 0.8, CX + 0.9, CZ + 1.0],                               // classifier workstation
        [IX - 0.8, -D / 2, IX + 0.8, -D / 2 + 0.52],                             // inbox cabinet
        [RX - 1.05, -D / 2, RX + 1.05, -D / 2 + 0.48],                           // retention shelf
        [-W / 2, LZ - 0.85, LX + 0.5, LZ + 0.85],                                // team lead desk and chair
        [2.75, -4.15, 3.3, -3.7], [0.35, -4.25, 0.85, -3.85],                   // returned parcels
        [-W / 2, -4.3, -4.7, -3.7], [4.7, 0.7, W / 2, 1.3], [-W / 2, 3.6, -4.7, 4.2], // plants
        [4.95, 2.1, W / 2, 2.5], [-W / 2, 2.15, -4.45, 2.85],                    // water, printer
      ],
      stations: [
        { key: 'brief', label: { pl: 'Tablica korkowa', en: 'Pinboard' }, meshes: [pin], anchor: [PX, 1.75, -D / 2 + 0.06], view: kit.view([PX + 0.75, 1.65, -2.75], [PX, 1.5, -D / 2], 0.25) },
        { key: 'data', label: { pl: 'Skrzynka reklamacji', en: 'Complaints inbox' }, meshes: [inbox], anchor: [IX, 1.8, -D / 2 + 0.12], view: kit.view([IX - 0.45, 1.65, -1.95], [IX, 1.3, -D / 2], 0.28) },
        { key: 'method', label: { pl: 'Biurko lidera zespołu', en: 'Team lead desk' }, meshes: [lead], anchor: [LX - 0.1, 2.12, LZ], view: kit.view([LX + 1.6, 1.65, LZ + 0.35], [LX, 0.95, LZ], 0.3) },
        { key: 'experiment', label: { pl: 'Klasyfikator zgłoszeń', en: 'Complaint classifier' }, meshes: [cls], anchor: clsAnchor, view: kit.view([CX - 0.3, 1.65, CZ + 1.55], [CX, 1.05, CZ], 0.3) },
        { key: 'results', label: { pl: 'Tablica spraw', en: 'Case board' }, meshes: [board], anchor: [BX, BY + 0.45, -D / 2 + 0.06], view: kit.view([BX + 0.35, 1.65, -0.95], [BX, BY, -D / 2], 0.24) },
      ],
      dispose() {},
    };
  });
})();
