// Walk-in 3D rooms: a first-person Three.js view with five clickable stations, each opening an HTML panel docked over it.
// Classic script (works from file://). Needs window.THREE from vendor/three/three.global.js; without it, or without
// WebGL, mount() still gives a working toolbar + panel ("fallback").
//
//   Rooms.define('vision', ctx => ({ scene, bounds, colliders, spawn, stations, ... }));
//   const room = Rooms.mount({ host, track: 'vision', lang: 'pl', data, titles, panels, onOpen, onClose, onExit2d });
//   room.open('data'); room.setPanels({ data: el }); room.dispose();
//
// Panels are MOVED into the room (append), never cloned, so ids, listeners and typed values stay.
// handle.open(station) opens at once and glides the camera meanwhile (for jump links); a click on a station mesh or
// toolbar button glides first and opens on arrival.
(function () {
  'use strict';
  const STATIONS = ['brief', 'data', 'method', 'experiment', 'results'];
  const EYE = 1.65, RADIUS = 0.3, SPEED = 3.2, PITCH_MAX = Math.PI / 3, LOOK_RATE = 0.005, PR_MAX = 1.5;
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
      const g = c.getContext('webgl2') || c.getContext('webgl');
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
    // Text on a canvas sprite, 0.32 m tall, readable from across the room.
    label(text) {
      const T = window.THREE, fs = 44, pad = 22, font = `600 ${fs}px "IBM Plex Sans", system-ui, sans-serif`;
      const probe = document.createElement('canvas').getContext('2d'); probe.font = font;
      const w = Math.ceil(probe.measureText(text).width) + pad * 2, h = fs + pad * 1.4;
      const tex = kit.canvasTexture(w, h, g => {
        g.fillStyle = 'rgba(28,25,23,.86)'; const r = h / 2;
        g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
        g.font = font; g.fillStyle = '#FFD500'; g.textBaseline = 'middle'; g.fillText(text, pad, h / 2 + 2);
      });
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.scale.set(0.32 * w / h, 0.32, 1); s.renderOrder = 10; return s;
    },
  };

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
    if (live.has(host)) live.get(host).dispose();
    host.replaceChildren();
    const reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    // ---- DOM ----
    const rootEl = el('div', { class: 'room-root', 'data-room-track': track, 'data-room-status': 'loading', 'data-room-station': 'none' });
    const hint = el('p', { class: 'room-hint' }, L.hint);
    const liveEl = el('div', { class: 'room-live', 'aria-live': 'polite', role: 'status' });
    const btns = {};
    const bar = el('div', { class: 'room-toolbar', role: 'toolbar', 'aria-label': L.bar });
    for (const s of STATIONS) { btns[s] = el('button', { type: 'button', class: 'room-btn', 'data-station': s }, titles[s] || s); bar.append(btns[s]); }
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
    const handle = { open, close, setPanels, status: 'loading', dispose, _debug: { cameraPos: () => null, project: () => null, info: () => null } };
    live.set(host, handle);
    const setStatus = s => { handle.status = s; rootEl.dataset.roomStatus = s; };
    const titleOf = s => titles[s] || (g3 && g3.byKey[s] && g3.byKey[s].label) || s;

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
    if (g3) for (const s of STATIONS) if (!titles[s] && g3.byKey[s]) btns[s].textContent = g3.byKey[s].label;

    // A throw half-way (shader compile, bad spec) must not leave a WebGL context, listeners or a frame loop behind.
    function create3d(T, spec) {
      const local = { raf: 0, off: [], renderer: null, canvas: null };
      try { return build3d(T, spec, local); } catch (e) {
        cancelAnimationFrame(local.raf); local.off.forEach(f => f());
        if (local.renderer) { local.renderer.dispose(); local.renderer.forceContextLoss(); }
        if (local.canvas) local.canvas.remove();
        if (spec && spec.dispose) { try { spec.dispose(); } catch (_) { /* reported by the caller */ } }
        handle._debug = { cameraPos: () => null, project: () => null, info: () => null };
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
        const lab = kit.label(st.label || st.key);
        lab.position.set(st.anchor[0], st.anchor[1] + 0.55, st.anchor[2]);
        spec.scene.add(lab); hitKey.set(lab, st.key);
        api.byKey[st.key] = { ...st, mats, lab };
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
      const near = new T.Vector3();
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
          // Labels fade out up close, where they would cover the station itself.
          st.lab.material.opacity = Math.max(0, Math.min(1, (dist - 2.2) / 0.8));
          st.lab.visible = st.lab.material.opacity > 0.01;
        }
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
        handle._debug = { cameraPos: () => null, project: () => null, info: () => null };
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
