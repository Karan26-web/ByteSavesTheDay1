"use strict";
/* ============================================================
   debug.js — screenwise debug overlay for Byte Saves The Day
   ------------------------------------------------------------
   Everything in the game is positioned in BOARD % of a 16:9
   1920×1080 design (#board). This overlay makes that coordinate
   system visible so you can place pods / Byte / tiles by eye.

   USAGE
     1) Add to index.html just before </body>:
          <script src="debug.js"></script>
     2) In the browser:
          press  D     → toggle the whole overlay
          press  G     → toggle the tile grid
          press  C     → toggle crosshair + live readout
          press  B     → toggle bounding boxes for game objects
          click board  → log {leftPct, topPct} (and copy to clipboard)

   Nothing here mutates game state — it only reads layout. Safe to
   ship; it stays dormant until you press a key (or set ?debug=1).
   ============================================================ */
(function () {
  const q = (s, r = document) => r.querySelector(s);

  // ----- design constants (mirror script.js so the grid lines up) -----
  const DESIGN_W = 1920, DESIGN_H = 1080;
  const PATH_X = 50.13;                                   // centre pathway (board %)
  const COL_STEP = 6.52;                                  // grass column width (board %)
  const TILE_TOPS = [16.9, 29.5, 42.0, 54.3, 66.7, 79.0]; // grass row centres (board %)

  const board = q('#board');
  const stage = q('#stage');
  if (!board) { console.warn('[debug] #board not found — load this after the game markup.'); return; }

  // ----- state -----
  const state = { on: false, grid: true, cross: true, boxes: true };

  // ----- root overlay (board child → scales with the board, percent units map 1:1) -----
  const root = document.createElement('div');
  root.id = 'debugOverlay';
  Object.assign(root.style, {
    position: 'absolute', inset: '0', zIndex: '500',
    pointerEvents: 'none', display: 'none', overflow: 'hidden',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  });
  board.appendChild(root);

  // grid layer (vertical grass columns + horizontal tile rows + centre pathway)
  const grid = document.createElement('div');
  Object.assign(grid.style, { position: 'absolute', inset: '0' });
  root.appendChild(grid);

  function buildGrid() {
    grid.innerHTML = '';
    const mk = (css) => { const d = document.createElement('div');
      Object.assign(d.style, { position: 'absolute' }, css); grid.appendChild(d); return d; };
    const label = (x, y, txt, color) => {
      const t = mk({ left: x, top: y, color, fontSize: '10px', fontWeight: '700',
        textShadow: '0 1px 2px rgba(0,0,0,.8)', transform: 'translate(-50%,-50%)',
        whiteSpace: 'nowrap' });
      t.textContent = txt;
    };
    // vertical grass columns, stepping out from the pathway both ways
    for (let i = -7; i <= 7; i++) {
      const x = PATH_X + i * COL_STEP;
      if (x < 0 || x > 100) continue;
      const isPath = i === 0;
      mk({ left: x + '%', top: 0, width: isPath ? '2px' : '1px', height: '100%',
        background: isPath ? 'rgba(255,80,80,.55)' : 'rgba(120,210,255,.30)' });
      label(x + '%', '2%', isPath ? `path ${x.toFixed(1)}` : (i > 0 ? '+' : '') + i,
        isPath ? '#ff9090' : '#9fe0ff');
    }
    // horizontal tile rows
    TILE_TOPS.forEach((y, r) => {
      mk({ left: 0, top: y + '%', width: '100%', height: '1px', background: 'rgba(146,230,70,.35)' });
      label('3%', y + '%', `row ${r} · ${y}%`, '#bff58a');
    });
    // 10% reference ticks down the left edge
    for (let p = 0; p <= 100; p += 10) {
      mk({ left: 0, top: p + '%', width: '6px', height: '1px', background: 'rgba(255,255,255,.5)' });
    }
  }

  // crosshair + readout (follows the mouse; shows board % and design px)
  const vline = document.createElement('div');
  const hline = document.createElement('div');
  [vline, hline].forEach(l => Object.assign(l.style, { position: 'absolute',
    background: 'rgba(255,226,72,.8)', display: 'none' }));
  vline.style.width = '1px'; vline.style.height = '100%'; vline.style.top = '0';
  hline.style.height = '1px'; hline.style.width = '100%'; hline.style.left = '0';
  root.append(vline, hline);

  const readout = document.createElement('div');
  Object.assign(readout.style, {
    position: 'fixed', zIndex: '501', padding: '6px 9px', borderRadius: '7px',
    background: 'rgba(8,16,12,.86)', color: '#d7ffe0', fontSize: '12px',
    lineHeight: '1.45', pointerEvents: 'none', display: 'none', whiteSpace: 'pre',
    boxShadow: '0 4px 14px rgba(0,0,0,.4)', border: '1px solid rgba(120,210,255,.35)',
  });
  document.body.appendChild(readout);

  // bounding-box layer for the live game objects
  const boxLayer = document.createElement('div');
  Object.assign(boxLayer.style, { position: 'absolute', inset: '0' });
  root.appendChild(boxLayer);

  /** convert a clientX/clientY to board % */
  function toBoardPct(clientX, clientY) {
    const b = board.getBoundingClientRect();
    return {
      leftPct: ((clientX - b.left) / b.width) * 100,
      topPct: ((clientY - b.top) / b.height) * 100,
      px: ((clientX - b.left) / b.width) * DESIGN_W,
      py: ((clientY - b.top) / b.height) * DESIGN_H,
    };
  }

  /** draw an outline + label over each tracked element, in board % */
  function drawBoxes() {
    boxLayer.innerHTML = '';
    if (!state.boxes) return;
    const b = board.getBoundingClientRect();
    const targets = [
      ['#byte', '#4ad0ff', 'byte'],
      ['#tile', '#ffe14d', 'tile'],
      ...[...board.querySelectorAll('.pod')].map((_, i) => [`.pod:nth-of-type(${i + 1})`, '#ff7ad0', 'pod']),
    ];
    targets.forEach(([sel, color, name]) => {
      const el = board.querySelector(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'absolute', border: `1px dashed ${color}`,
        left: ((r.left - b.left) / b.width) * 100 + '%',
        top: ((r.top - b.top) / b.height) * 100 + '%',
        width: (r.width / b.width) * 100 + '%',
        height: (r.height / b.height) * 100 + '%',
      });
      const cxPct = ((r.left - b.left + r.width / 2) / b.width) * 100;
      const cyPct = ((r.top - b.top + r.height / 2) / b.height) * 100;
      const tag = document.createElement('div');
      Object.assign(tag.style, { position: 'absolute', left: '0', top: '-14px',
        color, fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap',
        textShadow: '0 1px 2px rgba(0,0,0,.8)' });
      tag.textContent = `${name} ⌖${cxPct.toFixed(1)},${cyPct.toFixed(1)}`;
      box.appendChild(tag);
      boxLayer.appendChild(box);
    });
  }

  // keep boxes fresh while visible (positions animate)
  let raf = 0;
  function loop() { if (state.on) { drawBoxes(); raf = requestAnimationFrame(loop); } }

  // ----- visibility -----
  function apply() {
    root.style.display = state.on ? 'block' : 'none';
    grid.style.display = state.grid ? 'block' : 'none';
    vline.style.display = hline.style.display = (state.on && state.cross) ? 'block' : 'none';
    if (state.on) { buildGrid(); cancelAnimationFrame(raf); loop(); }
    else { cancelAnimationFrame(raf); readout.style.display = 'none'; }
  }

  // ----- input -----
  function onMove(e) {
    if (!state.on || !state.cross) return;
    const b = board.getBoundingClientRect();
    const insideX = e.clientX - b.left, insideY = e.clientY - b.top;
    vline.style.left = (insideX / b.width) * 100 + '%';
    hline.style.top = (insideY / b.height) * 100 + '%';
    const c = toBoardPct(e.clientX, e.clientY);
    readout.style.display = 'block';
    readout.style.left = Math.min(e.clientX + 14, window.innerWidth - 170) + 'px';
    readout.style.top = Math.min(e.clientY + 14, window.innerHeight - 70) + 'px';
    readout.textContent =
      `left: ${c.leftPct.toFixed(2)}%   top: ${c.topPct.toFixed(2)}%\n` +
      `px:   ${Math.round(c.px)} , ${Math.round(c.py)}  (of ${DESIGN_W}×${DESIGN_H})\n` +
      `col:  ${((c.leftPct - PATH_X) / COL_STEP).toFixed(2)} tiles from path`;
  }

  function onClick(e) {
    if (!state.on) return;
    const c = toBoardPct(e.clientX, e.clientY);
    const snippet = `{ leftPct: ${c.leftPct.toFixed(2)}, topPct: ${c.topPct.toFixed(2)} }`;
    console.log('[debug] board position:', snippet,
      `| design px ${Math.round(c.px)},${Math.round(c.py)}`,
      `| ${((c.leftPct - PATH_X) / COL_STEP).toFixed(2)} tiles from path`);
    if (navigator.clipboard) navigator.clipboard.writeText(snippet).catch(() => {});
    flash(e.clientX, e.clientY);
  }

  function flash(clientX, clientY) {
    const b = board.getBoundingClientRect();
    const dot = document.createElement('div');
    Object.assign(dot.style, { position: 'absolute', width: '10px', height: '10px',
      borderRadius: '50%', background: 'rgba(255,226,72,.9)',
      boxShadow: '0 0 10px 3px rgba(255,226,72,.7)', transform: 'translate(-50%,-50%)',
      left: ((clientX - b.left) / b.width) * 100 + '%',
      top: ((clientY - b.top) / b.height) * 100 + '%',
      transition: 'opacity .6s ease, transform .6s ease' });
    root.appendChild(dot);
    requestAnimationFrame(() => { dot.style.opacity = '0'; dot.style.transform = 'translate(-50%,-50%) scale(2.4)'; });
    setTimeout(() => dot.remove(), 650);
  }

  document.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'd') { state.on = !state.on; apply(); printHelp(); }
    else if (k === 'g' && state.on) { state.grid = !state.grid; apply(); }
    else if (k === 'c' && state.on) { state.cross = !state.cross; apply(); }
    else if (k === 'b' && state.on) { state.boxes = !state.boxes; drawBoxes(); }
  });
  window.addEventListener('mousemove', onMove);
  // capture phase so we read the click even though overlay layers are pointer-events:none
  window.addEventListener('click', onClick, true);
  window.addEventListener('resize', () => { if (state.on) buildGrid(); });

  function printHelp() {
    if (!state.on) return;
    console.log('%c[debug] overlay ON', 'color:#7ee04d;font-weight:700',
      '\n  D = toggle overlay   G = grid   C = crosshair   B = boxes' +
      '\n  click the board to log + copy { leftPct, topPct }');
  }

  // expose a tiny handle for the console
  window.debugScreen = {
    toggle: () => { state.on = !state.on; apply(); printHelp(); },
    at: (clientX, clientY) => toBoardPct(clientX, clientY),
    state,
  };

  // auto-enable with ?debug=1
  if (/[?&]debug=1\b/.test(location.search)) { state.on = true; apply(); printHelp(); }

  // ============================================================
  // Level-jump widget — small floating panel to hop straight onto any screen.
  // Toggle with the ⚑ tab (or press L). Calls window.game.jumpToLevel(idx).
  // ============================================================
  const jump = document.createElement('div');
  Object.assign(jump.style, {
    position: 'fixed', right: '10px', bottom: '10px', zIndex: '600',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', userSelect: 'none',
  });
  document.body.appendChild(jump);

  const tab = document.createElement('button');
  tab.textContent = '⚑ levels';
  Object.assign(tab.style, {
    font: '600 12px ui-monospace, monospace', color: '#08110c', cursor: 'pointer',
    border: 'none', borderRadius: '8px', padding: '6px 10px',
    background: 'linear-gradient(#ffe14d,#f5c518)', boxShadow: '0 3px 8px rgba(0,0,0,.35)',
  });
  jump.appendChild(tab);

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    display: 'none', marginBottom: '6px', padding: '8px', borderRadius: '10px',
    background: 'rgba(8,16,12,.92)', border: '1px solid rgba(120,210,255,.35)',
    boxShadow: '0 6px 18px rgba(0,0,0,.45)', width: '168px',
  });
  jump.insertBefore(panel, tab);

  function startGame() {
    // hide the PLAY gate + unlock audio so a jump works straight from the title screen
    const ss = q('#startScreen'); if (ss) ss.classList.add('hide');
    if (window.audio) { try { window.audio.resume(); window.audio.startTheme(); } catch (e) {} }
  }

  function buildPanel() {
    panel.innerHTML = '';
    const g = window.game;
    const title = document.createElement('div');
    title.textContent = 'Jump to screen';
    Object.assign(title.style, { color: '#9fe0ff', fontSize: '11px', fontWeight: '700', marginBottom: '6px' });
    panel.appendChild(title);

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px' });
    panel.appendChild(row);

    const n = g ? g.levels.length : 9;     // levels[0]=tutorial, rest=puzzle
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.textContent = 'L' + (i + 1);       // user-facing Level number (1-based)
      Object.assign(b.style, mkBtnStyle(g && g.level === i));
      b.onclick = () => { startGame(); window.game && window.game.jumpToLevel(i); setTimeout(buildPanel, 60); };
      row.appendChild(b);
    }

    const extra = document.createElement('div');
    Object.assign(extra.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' });
    panel.appendChild(extra);
    const mk = (label, fn) => { const b = document.createElement('button');
      b.textContent = label; Object.assign(b.style, mkBtnStyle(false)); b.onclick = fn; extra.appendChild(b); };
    mk('Win 🏆', () => { startGame(); window.game && window.game.win(); });
    mk('Restart', () => { startGame(); window.game && window.game.restart(); setTimeout(buildPanel, 60); });
  }

  function mkBtnStyle(active) {
    return {
      font: '600 12px ui-monospace, monospace', cursor: 'pointer', padding: '6px 0',
      borderRadius: '6px', border: '1px solid rgba(120,210,255,.3)',
      color: active ? '#08110c' : '#d7ffe0',
      background: active ? 'linear-gradient(#7ee04d,#39c44a)' : 'rgba(255,255,255,.06)',
    };
  }

  function togglePanel() {
    const show = panel.style.display === 'none';
    if (show) buildPanel();
    panel.style.display = show ? 'block' : 'none';
  }
  tab.onclick = togglePanel;
  document.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key.toLowerCase() === 'l') togglePanel();
  });

  console.log('%c[debug] loaded — press D for the screen debug overlay, L for the level jumper', 'color:#9fe0ff');
})();
