// Onet: screens, input, timer, scoring and effects on top of ON.Board.
(() => {
  'use strict';
  const ON = window.ON;
  const { Board, Sfx, Music, Ads, FACES, faceSVG, shuffleArr } = ON;
  const $ = (id) => document.getElementById(id);
  const ic = (id, acc) => `<svg class="ic"${acc ? ` style="--acc:${acc}"` : ''}><use href="#i-${id}"/></svg>`;

  const { DIFFS, STAGES } = ON;
  const COMBO_WINDOW = 3500;
  const REVIVE_SECONDS = 30;
  const GRAVITY_TEXT = {
    down: 'Gambar turun ke bawah', up: 'Gambar naik ke atas', left: 'Gambar bergeser ke kiri', right: 'Gambar bergeser ke kanan',
    split: 'Gambar menjauh dari tengah', center: 'Gambar merapat ke tengah',
  };
  const GRAVITY_SHORT = { down: 'Turun', up: 'Naik', left: 'Ke kiri', right: 'Ke kanan', split: 'Menjauh', center: 'Merapat' };
  // arrow showing which way tiles slide after a match
  function gravIcon(mode) {
    const p = {
      up: 'M12 19.5V5M6 10.5l6-6 6 6', down: 'M12 4.5V19M6 13.5l6 6 6-6',
      left: 'M19.5 12H5M10.5 6l-6 6 6 6', right: 'M4.5 12H19M13.5 6l6 6-6 6',
      split: 'M12 10V3.5M8 7l4-4 4 4M12 14v6.5M8 17l4 4 4-4', center: 'M2.5 12H9M5.5 8l4 4-4 4M21.5 12H15M18.5 8l-4 4 4 4',
    }[mode];
    return `<svg class="ic" viewBox="0 0 24 24"><path d="${p}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  // a face per difficulty for its badge on the home screen
  const DIFF_FACE = ['bunga', 'ikan', 'kucing', 'roket', 'mahkota'];
  const faceIndex = (id) => FACES.findIndex((f) => f.id === id);

  // ---------- Profile (saved in the browser) ----------
  const KEY = 'onet-profile-v1';
  const profile = (ON.profile = Object.assign(
    { sound: true, music: true, vibe: true, best: {}, stagesPlayed: 0, games: 0, seenHelp: false, noAds: false },
    (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })()
  ));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* private mode */ } };
  const bestOf = (d) => (profile.best[d.id] = profile.best[d.id] || { score: 0, cleared: 0 });
  ON.track = (name, data) => { if (window.__onetDebug) console.log('[track]', name, data || ''); };

  // ---------- State ----------
  const G = {
    diff: null, stage: 0, score: 0, stageScore: 0, board: null,
    timeLeft: 0, timeTotal: 0, hints: 0, shuffles: 0,
    sel: null, combo: 0, lastMatchAt: 0, revived: false,
    running: false, paused: false, busy: false, turned: false, intro: false,
    els: new Map(), geo: null, hintIds: null,
  };

  const boardEl = $('board'), tilesEl = $('tiles'), linesEl = $('lines'), fxEl = $('fx');

  // ---------- Screens & modals ----------
  function openModal(id) { document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')); $(id).classList.add('show'); }
  function closeModals() { document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')); }
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { Sfx.click(); closeModals(); }));
  document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('pointerdown', (e) => {
    if (e.target === o && o.querySelector('.x-btn')) closeModals();
  }));

  function showHome() {
    stopTimer();
    G.running = false;
    closeModals();
    document.body.classList.add('at-home');
    document.body.classList.remove('paused');
    renderHome();
  }

  function renderHome() {
    $('diff-list').innerHTML = DIFFS.map((d, i) => {
      const b = bestOf(d);
      const bars = Array.from({ length: 5 }, (_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
      const slides = d.gravity.some((g) => g !== 'none');
      const played = b.score > 0 || b.cleared > 0;
      const segs = Array.from({ length: STAGES }, (_, k) => `<i class="${k < b.cleared ? 'on' : ''}"></i>`).join('');
      const right = !played
        ? `<span class="fresh">Belum<br>dimainkan</span>`
        : `<span class="best">Terbaik<b>${b.score.toLocaleString('id-ID')}</b></span>
           <span class="stage-prog" aria-label="${b.cleared} dari ${STAGES} babak tamat"><span class="segs">${segs}</span>${b.cleared >= STAGES ? `${ic('check')}Tamat` : `${b.cleared}/${STAGES}`}</span>`;
      return `<button class="diff" data-i="${i}" style="--c:${d.color}">
        <span class="badge">${faceSVG(faceIndex(DIFF_FACE[i]))}</span>
        <span><div class="name">${d.name}</div>
          <div class="meta"><span class="bars" aria-hidden="true">${bars}</span><span>${d.cols}×${d.rows} · ${fmt(d.time)}</span>${slides ? `<span class="slide-tag">${gravIcon('down')}geser</span>` : ''}</div></span>
        <span class="right">${right}</span>
      </button>`;
    }).join('');
  }
  $('diff-list').addEventListener('click', (e) => {
    const b = e.target.closest('.diff');
    if (!b) return;
    Sfx.unlock();
    Sfx.click();
    const i = +b.dataset.i, cleared = bestOf(DIFFS[i]).cleared;
    if (cleared > 0 && cleared < STAGES) offerContinue(i, cleared);
    else startGame(i, 0);
  });

  // pick up at the first stage not yet cleared, or start over
  let contDiff = 0, contStage = 0;
  function offerContinue(i, cleared) {
    const d = DIFFS[i];
    contDiff = i;
    contStage = cleared;
    $('cont-ic').innerHTML = faceSVG(faceIndex(DIFF_FACE[i]));
    $('cont-ic').style.background = d.color;
    $('cont-title').textContent = d.name;
    $('cont-sub').textContent = `Kamu sudah menamatkan ${cleared} dari ${STAGES} babak. Skor dihitung dari babak yang kamu mulai.`;
    $('cont-cta').textContent = `Lanjut babak ${cleared + 1}`;
    openModal('modal-continue');
  }
  $('btn-cont').addEventListener('click', () => { Sfx.click(); closeModals(); startGame(contDiff, contStage); });
  $('btn-cont-new').addEventListener('click', () => { Sfx.click(); closeModals(); startGame(contDiff, 0); });

  function renderLogo() {
    // two pairs; the outer pair is joined by a 2-turn line, like a real move
    const [a, b] = shuffleArr(FACES.map((_, i) => i)).slice(0, 2);
    $('logo-tiles').innerHTML = [a, b, b, a].map((f) => `<span class="tile">${faceSVG(f)}</span>`).join('') +
      `<svg class="joiner" viewBox="0 0 232 30" preserveAspectRatio="none"><path d="M26 30V6h180v24" fill="none" stroke="#ffd23f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 9"/></svg>`;
  }

  // ---------- Settings ----------
  const TOGGLES = [
    { key: 'sound', label: 'Efek suara', icon: 'sound', acc: '#9ef0d8' },
    { key: 'music', label: 'Musik', icon: 'music', acc: '#9ef0d8' },
    { key: 'vibe', label: 'Getar', icon: 'vibe', acc: '#9ef0d8' },
  ];
  function renderToggles(el) {
    el.innerHTML = TOGGLES.map((t) => `<button class="toggle ${profile[t.key] ? 'on' : ''}" data-k="${t.key}">${ic(t.icon, t.acc)}<span>${t.label}</span><i class="switch"></i></button>`).join('');
  }
  function onToggle(e) {
    const b = e.target.closest('.toggle');
    if (!b) return;
    const k = b.dataset.k;
    profile[k] = !profile[k];
    save();
    applyAudio();
    b.classList.toggle('on', profile[k]);
    Sfx.click();
  }
  $('settings-toggles').addEventListener('click', onToggle);
  $('pause-toggles').addEventListener('click', onToggle);
  function applyAudio() {
    Sfx.configure({ sound: profile.sound, music: profile.music });
    if (profile.music && Sfx.ac) Music.start();
  }
  $('btn-settings').addEventListener('click', () => { Sfx.unlock(); Sfx.click(); renderToggles($('settings-toggles')); openModal('modal-settings'); });

  // ---------- Help ----------
  function demo(kind) {
    const t = (x, y, f) => `<rect x="${x}" y="${y}" width="18" height="20" rx="4" fill="#fff7e8" stroke="#d8b98a" stroke-width="2"/>` +
      (f ? `<circle cx="${x + 9}" cy="${y + 10}" r="5" fill="${f}"/>` : '');
    const line = (d) => `<path d="${d}" fill="none" stroke="#ff7a59" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (kind === 1) return `<svg class="demo" viewBox="0 0 92 64">${t(10, 22, '#ef4444')}${t(32, 22, '#3b82f6')}${t(64, 22, '#ef4444')}${line('M28 32h36')}</svg>`;
    if (kind === 2) return `<svg class="demo" viewBox="0 0 92 64">${t(8, 6, '#a855f7')}${t(30, 6, '#22c55e')}${t(30, 38, '#f59e0b')}${t(64, 38, '#a855f7')}${line('M17 26v6h0v20h47')}</svg>`;
    return `<svg class="demo" viewBox="0 0 92 64">${t(14, 22, '#f59e0b')}${t(36, 22, '#3b82f6')}${t(58, 22, '#f59e0b')}${line('M23 22V8h44v14')}</svg>`;
  }
  $('howto').innerHTML = [
    [1, 'Ketuk dua gambar yang <b>sama</b>. Kalau bisa disambung garis, keduanya hilang.'],
    [2, 'Garisnya boleh belok <b>paling banyak 2 kali</b> dan tidak boleh menembus gambar lain.'],
    [3, 'Garis boleh lewat <b>pinggir luar papan</b>. Habiskan semua gambar sebelum waktu habis!'],
  ].map(([k, txt]) => `<div class="step">${demo(k)}<p>${txt}</p></div>`).join('') +
    `<div class="step"><svg class="demo" viewBox="0 0 92 64"><g transform="translate(14 20)" style="color:#2b1d33;--acc:#ffd23f"><use href="#i-bulb" width="26" height="26"/></g><g transform="translate(52 20)" style="color:#2b1d33"><use href="#i-shuffle" width="26" height="26"/></g></svg><p><b>Petunjuk</b> menunjukkan satu pasangan. <b>Acak</b> mengocok ulang gambar. Sambung beruntun cepat untuk <b>combo</b>!</p></div>`;
  $('btn-help').addEventListener('click', () => { Sfx.unlock(); Sfx.click(); openModal('modal-help'); });

  // ---------- Game flow ----------
  function startGame(i, stage = 0) {
    G.diff = DIFFS[i];
    G.stage = stage;
    G.score = 0;
    profile.games++;
    save();
    document.body.classList.remove('at-home');
    $('hud-diff').textContent = G.diff.name;
    $('hud-diff').style.setProperty('--chip', G.diff.color);
    applyAudio();
    ON.track('game_start', { diff: G.diff.id, stage: G.stage + 1 });
    startStage();
    if (!profile.seenHelp) {
      profile.seenHelp = true;
      save();
      pause(false);
      openModal('modal-help');
      $('modal-help').addEventListener('transitionend', function once() {
        if (!$('modal-help').classList.contains('show')) { $('modal-help').removeEventListener('transitionend', once); resume(); }
      });
    }
  }

  function startStage() {
    const d = G.diff;
    closeModals();
    clearLines();
    G.sel = null;
    G.hintIds = null;
    G.combo = 0;
    G.lastMatchAt = 0;
    G.revived = false;
    G.stageScore = 0;
    G.hints = d.hints;
    G.shuffles = d.shuffles;
    G.timeTotal = Math.round(d.time * (1 - 0.06 * G.stage));
    G.timeLeft = G.timeTotal;
    G.gravity = d.gravity[G.stage];

    // turn the board sideways on wide screens
    const st = $('stage');
    G.turned = st.clientWidth > st.clientHeight * 1.05;
    const rows = G.turned ? d.cols : d.rows;
    const cols = G.turned ? d.rows : d.cols;

    const faces = shuffleArr(FACES.map((_, k) => k)).slice(0, d.faces);
    G.board = new Board(rows, cols, faces);
    buildTiles(true);
    $('hud-stage').textContent = `Babak ${G.stage + 1}/${STAGES}`;
    const grav = $('hud-grav');
    grav.hidden = G.gravity === 'none';
    grav.innerHTML = G.gravity === 'none' ? '' : `${gravIcon(G.gravity)}${GRAVITY_SHORT[G.gravity]}`;
    grav.title = GRAVITY_TEXT[G.gravity] || '';
    updateHud();
    G.running = true;
    G.paused = true; // the clock waits for the intro banner
    document.body.classList.remove('paused');
    startTimer();
    showIntro();
  }

  // Stage intro: stage number and, for sliding stages, which way tiles move.
  // The timer starts only when it goes away, so no seconds are lost reading it.
  let introT = 0;
  function showIntro() {
    const g = G.gravity;
    $('banner-kicker').textContent = `${G.diff.name} · Babak ${G.stage + 1} dari ${STAGES}`;
    $('banner-title').textContent = G.stage === STAGES - 1 ? 'Babak terakhir!' : g === 'none' ? 'Sambungkan semuanya!' : 'Awas, gambar bergeser';
    $('banner-rule').innerHTML = g === 'none'
      ? `${ic('clock', '#9ef0d8')}<span>${fmt(G.timeTotal)} untuk ${G.board.count()} gambar</span>`
      : `<span class="arrow">${gravIcon(g)}</span><span>${GRAVITY_TEXT[g]} setiap kali sepasang hilang</span>`;
    $('banner').classList.add('show');
    G.intro = true;
    clearTimeout(introT);
    introT = setTimeout(endIntro, g === 'none' ? 1600 : 2600);
  }
  function endIntro() {
    if (!G.intro) return;
    G.intro = false;
    clearTimeout(introT);
    $('banner').classList.remove('show');
    // stay paused if a menu (pause, first-time help) is open on top
    if (G.running && !document.querySelector('.overlay.show')) { G.paused = false; lastT = performance.now(); }
  }
  $('banner').addEventListener('pointerdown', (e) => { e.preventDefault(); endIntro(); });

  // ---------- Layout ----------
  function layout() {
    if (!G.board) return;
    const st = $('stage');
    const W = st.clientWidth, H = st.clientHeight;
    const R = G.board.rows, C = G.board.cols;
    const ratio = 0.84; // tile width / height
    let sx = Math.min(W / (C + 0.9), (H / (R + 0.9)) * ratio, 72);
    sx = Math.floor(sx);
    const sy = Math.floor(sx / ratio);
    const gap = Math.max(2, Math.round(sx * 0.06));
    const pad = Math.round(sx * 0.45);
    G.geo = { sx, sy, pad, gap };
    boardEl.style.width = `${C * sx + pad * 2}px`;
    boardEl.style.height = `${R * sy + pad * 2}px`;
    boardEl.style.setProperty('--tw', `${sx - gap}px`);
    boardEl.style.setProperty('--th', `${sy - gap}px`);
    linesEl.setAttribute('viewBox', `0 0 ${C * sx + pad * 2} ${R * sy + pad * 2}`);
    placeAll();
  }
  // centre of a cell (r,c), border cells included
  function center(r, c) {
    const { sx, sy, pad, gap } = G.geo;
    return [pad + (c - 1) * sx + sx / 2, pad + (r - 1) * sy + sy / 2 - gap / 2];
  }
  function place(el, r, c) {
    const { sx, sy, pad, gap } = G.geo;
    el.style.transform = `translate(${pad + (c - 1) * sx + gap / 2}px, ${pad + (r - 1) * sy}px)`;
  }
  function placeAll() {
    for (const [id, [r, c]] of G.board.positions()) {
      const el = G.els.get(id);
      if (el) place(el, r, c);
    }
  }

  function buildTiles(deal) {
    tilesEl.innerHTML = '';
    G.els.clear();
    layout();
    for (const { r, c, tile } of G.board.tiles()) {
      const el = document.createElement('button');
      el.className = 'tile' + (deal ? ' enter' : '');
      el.dataset.id = tile.id;
      el.setAttribute('aria-label', FACES[tile.type].id);
      el.innerHTML = faceSVG(tile.type);
      if (deal) el.style.animationDelay = `${(r + c) * 22}ms`;
      place(el, r, c);
      tilesEl.appendChild(el);
      G.els.set(tile.id, el);
    }
    if (deal) setTimeout(() => G.els.forEach((el) => el.classList.remove('enter')), 1200);
  }

  let resizeT = 0;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layout, 80); });

  // ---------- Input ----------
  tilesEl.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.tile');
    if (!el || !G.running || G.paused || G.busy) return;
    e.preventDefault();
    Sfx.unlock();
    tap(+el.dataset.id);
  });

  let blockedTips = 0;
  function posOf(id) {
    for (const { r, c, tile } of G.board.tiles()) if (tile.id === id) return [r, c];
    return null;
  }

  function tap(id) {
    const el = G.els.get(id);
    if (!el || el.classList.contains('gone')) return;
    if (G.sel === null) { select(id); return; }
    if (G.sel === id) { G.els.get(id).classList.remove('sel'); G.sel = null; Sfx.deselect(); return; }
    const a = posOf(G.sel), b = posOf(id);
    const ta = G.board.at(...a), tb = G.board.at(...b);
    const path = G.board.path(a, b);
    if (path) { match(G.sel, id, a, b, path); return; }
    const prev = G.els.get(G.sel);
    prev.classList.remove('sel');
    if (ta.type === tb.type) {
      // right picture, blocked path
      for (const x of [prev, el]) { x.classList.remove('bad'); void x.offsetWidth; x.classList.add('bad'); }
      Sfx.wrong();
      buzz(30);
      G.combo = 0;
      if (blockedTips < 3) { blockedTips++; toast('Jalurnya terhalang. Garis maksimal 2 belokan dan tidak menembus gambar.', 2600); }
    }
    select(id);
  }

  function select(id) {
    G.sel = id;
    G.els.get(id).classList.add('sel');
    Sfx.select();
  }

  function match(idA, idB, a, b, path) {
    const now = performance.now();
    G.combo = now - G.lastMatchAt < COMBO_WINDOW ? G.combo + 1 : 1;
    G.lastMatchAt = now;
    const turns = path.length - 2;
    const pts = Math.round((10 + turns * 5) * G.diff.mult * Math.min(G.combo, 10));
    G.score += pts;
    G.stageScore += pts;
    G.timeLeft = Math.min(G.timeTotal, G.timeLeft + G.diff.bonus);
    G.sel = null;
    clearHint();

    drawLine(path);
    const [x1, y1] = center(...a), [x2, y2] = center(...b);
    const elA = G.els.get(idA), elB = G.els.get(idB);
    for (const el of [elA, elB]) { el.classList.remove('sel'); el.classList.add('gone'); }
    sparks(x1, y1); sparks(x2, y2);
    floater((x1 + x2) / 2, (y1 + y2) / 2, `+${pts}`);
    Sfx.match(G.combo);
    if (G.combo >= 2) { Sfx.combo(G.combo); showCombo(G.combo); }
    buzz(12);

    G.board.remove(a, b);
    G.busy = true;
    setTimeout(() => {
      elA.remove(); elB.remove();
      G.els.delete(idA); G.els.delete(idB);
      if (G.gravity !== 'none') {
        const before = G.board.positions();
        G.board.applyGravity(G.gravity);
        const after = G.board.positions();
        let moved = false;
        for (const [id, p] of after) if (before.get(id)[0] !== p[0] || before.get(id)[1] !== p[1]) moved = true;
        if (moved) { placeAll(); Sfx.slide(); }
      }
      G.busy = false;
      updateHud();
      afterMove();
    }, 230);
    updateHud();
  }

  function afterMove() {
    if (!G.running) return;
    if (G.board.count() === 0) { stageClear(); return; }
    if (!G.board.findMove()) {
      toast('Tidak ada pasangan tersisa, gambar diacak gratis');
      doShuffle();
    }
  }

  // ---------- Power-ups ----------
  function clearHint() {
    if (!G.hintIds) return;
    G.hintIds.forEach((id) => G.els.get(id) && G.els.get(id).classList.remove('hint'));
    G.hintIds = null;
  }

  $('btn-hint').addEventListener('click', () => {
    if (!G.running || G.paused || G.busy) return;
    if (G.hintIds) return;
    if (G.hints <= 0) { offerRefill('hint'); return; }
    const m = G.board.findMove();
    if (!m) return;
    G.hints--;
    G.hintIds = [G.board.at(...m.a).id, G.board.at(...m.b).id];
    G.hintIds.forEach((id) => G.els.get(id).classList.add('hint'));
    Sfx.hint();
    updateHud();
  });

  $('btn-shuffle').addEventListener('click', () => {
    if (!G.running || G.paused || G.busy) return;
    if (G.shuffles <= 0) { offerRefill('shuffle'); return; }
    G.shuffles--;
    doShuffle();
    updateHud();
  });

  function doShuffle() {
    clearHint();
    if (G.sel !== null && G.els.get(G.sel)) G.els.get(G.sel).classList.remove('sel');
    G.sel = null;
    G.board.shuffle();
    boardEl.classList.add('board-shuffling');
    placeAll();
    Sfx.shuffle();
    G.busy = true;
    setTimeout(() => { boardEl.classList.remove('board-shuffling'); G.busy = false; }, 480);
  }

  let refillKind = null;
  function offerRefill(kind) {
    refillKind = kind;
    pause(false);
    const hint = kind === 'hint';
    $('refill-ic').innerHTML = hint ? ic('bulb', '#ffd23f') : ic('shuffle');
    $('refill-title').textContent = hint ? 'Petunjuk habis' : 'Jatah acak habis';
    $('refill-sub').textContent = hint ? 'Tonton iklan singkat untuk dapat 2 petunjuk lagi.' : 'Tonton iklan singkat untuk dapat 1 kali acak lagi.';
    $('refill-cta').textContent = hint ? 'Tonton iklan, +2 petunjuk' : 'Tonton iklan, +1 acak';
    openModal('modal-refill');
  }
  $('btn-refill').addEventListener('click', async () => {
    closeModals();
    const ok = await Ads.rewarded(refillKind === 'hint' ? 'hint_refill' : 'shuffle_refill');
    if (ok) {
      if (refillKind === 'hint') G.hints += 2; else G.shuffles += 1;
      Sfx.revive();
      toast(refillKind === 'hint' ? '+2 petunjuk' : '+1 acak');
    }
    updateHud();
    resume();
  });
  $('btn-refill-no').addEventListener('click', () => { Sfx.click(); closeModals(); resume(); });

  // ---------- Timer ----------
  let raf = 0, lastT = 0, lastTick = -1;
  function startTimer() {
    cancelAnimationFrame(raf);
    lastT = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.25, (t - lastT) / 1000);
      lastT = t;
      if (G.running && !G.paused) {
        G.timeLeft -= dt;
        const s = Math.ceil(G.timeLeft);
        if (s <= 10 && s > 0 && s !== lastTick) { lastTick = s; Sfx.tick(); }
        if (G.timeLeft <= 0) { G.timeLeft = 0; updateTime(); timeUp(); return; }
        updateTime();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  function stopTimer() { cancelAnimationFrame(raf); }

  function fmt(s) {
    s = Math.max(0, Math.ceil(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function updateTime() {
    const f = Math.max(0, G.timeLeft / G.timeTotal);
    $('timefill').style.transform = `scaleX(${f})`;
    const low = G.timeLeft <= 15;
    $('timebar').classList.toggle('low', low);
    $('hud-time').classList.toggle('low', low);
    $('hud-time').textContent = fmt(G.timeLeft);
  }

  let shownScore = 0;
  function updateHud() {
    updateTime();
    const sc = $('hud-score');
    if (G.score !== shownScore) {
      shownScore = G.score;
      sc.classList.add('bump');
      setTimeout(() => sc.classList.remove('bump'), 120);
    }
    sc.textContent = G.score.toLocaleString('id-ID');
    $('hud-pairs').textContent = G.board ? G.board.count() / 2 : 0;
    setCount($('hint-count'), G.hints);
    setCount($('shuffle-count'), G.shuffles);
  }
  function setCount(el, n) {
    // out of stock: the badge turns into a green "watch an ad" badge
    el.classList.toggle('ad', n <= 0);
    el.innerHTML = n > 0 ? String(n) : ic('video', '#bbf7d0');
  }

  // ---------- Pause ----------
  function pause(withMenu = true) {
    if (!G.running) return;
    G.paused = true;
    if (G.intro) { G.intro = false; clearTimeout(introT); $('banner').classList.remove('show'); }
    if (withMenu) {
      document.body.classList.add('paused');
      $('pause-info').textContent = `${G.diff.name} · Babak ${G.stage + 1}/${STAGES} · sisa ${fmt(G.timeLeft)}`;
      renderToggles($('pause-toggles'));
      openModal('modal-pause');
    }
  }
  function resume() {
    if (!G.running) return;
    G.paused = false;
    document.body.classList.remove('paused');
    closeModals();
    lastT = performance.now();
  }
  $('btn-pause').addEventListener('click', () => { Sfx.click(); pause(); });
  $('btn-resume').addEventListener('click', () => { Sfx.click(); resume(); });
  $('btn-restart').addEventListener('click', () => { Sfx.click(); G.score -= G.stageScore; startStage(); });
  $('btn-quit').addEventListener('click', () => { Sfx.click(); finishGame(false, true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.running && !G.paused) pause(); Music.stop(); }
    else if (profile.music && Sfx.ac) Music.start();
  });

  // ---------- Stage end ----------
  function stageClear() {
    G.running = false;
    stopTimer();
    profile.stagesPlayed++;
    const timeBonus = Math.ceil(G.timeLeft) * 5 * G.diff.mult;
    G.score += timeBonus;
    const f = G.timeLeft / G.timeTotal;
    let stars = f >= 0.5 ? 3 : f >= 0.25 ? 2 : 1;
    if (G.revived) stars = 1;
    const b = bestOf(G.diff);
    b.cleared = Math.max(b.cleared, G.stage + 1);
    save();
    updateHud();
    Sfx.clear();

    if (G.stage + 1 >= STAGES) {
      setTimeout(() => finishGame(true), 600);
      return;
    }
    $('clear-tally').innerHTML = `
      <div><span>Skor babak</span><b>${G.stageScore.toLocaleString('id-ID')}</b></div>
      <div><span>Bonus waktu (${fmt(G.timeLeft)})</span><b>+${timeBonus.toLocaleString('id-ID')}</b></div>
      <div class="total"><span>Total skor</span><b>${G.score.toLocaleString('id-ID')}</b></div>`;
    const starEl = $('clear-stars');
    starEl.innerHTML = [0, 1, 2].map(() => ic('star')).join('');
    setTimeout(() => openModal('modal-clear'), 500);
    [...starEl.children].forEach((s, i) => {
      if (i < stars) setTimeout(() => { s.classList.add('on'); Sfx.star(i); }, 900 + i * 260);
    });
    if (stars === 3) setTimeout(() => confetti(40), 1700);
    const next = G.diff.gravity[G.stage + 1];
    $('btn-next').innerHTML = `${ic('play')}Babak ${G.stage + 2}${next !== 'none' ? ' · ' + GRAVITY_TEXT[next].replace('Gambar ', '') : ''}`;
  }
  $('btn-next').addEventListener('click', async () => {
    Sfx.click();
    closeModals();
    await Ads.stageEnded(profile.stagesPlayed);
    G.stage++;
    startStage();
  });
  $('btn-clear-home').addEventListener('click', () => { Sfx.click(); finishGame(false, true); });

  function timeUp() {
    G.paused = true;
    clearHint();
    Sfx.over();
    buzz([40, 60, 40]);
    const total = G.board.rows * G.board.cols, done = total - G.board.count();
    const cheer = done / total >= 0.6 ? 'Sedikit lagi!' : done / total >= 0.3 ? 'Sudah lumayan jauh!' : 'Ayo, kamu pasti bisa!';
    $('timeup-info').textContent = `Sudah ${done} dari ${total} gambar dipasangkan. ${cheer}`;
    $('timeup-prog').style.transform = `scaleX(${done / total})`;
    $('btn-revive').style.display = G.revived ? 'none' : '';
    openModal('modal-timeup');
  }
  $('btn-revive').addEventListener('click', async () => {
    closeModals();
    const ok = await Ads.rewarded('time_revive');
    if (!ok) { openModal('modal-timeup'); return; }
    G.revived = true;
    G.timeTotal = Math.max(G.timeTotal, REVIVE_SECONDS);
    G.timeLeft = REVIVE_SECONDS;
    Sfx.revive();
    toast(`+${REVIVE_SECONDS} detik! Ayo habiskan`);
    G.paused = false;
    startTimer();
  });
  $('btn-giveup').addEventListener('click', () => { Sfx.click(); profile.stagesPlayed++; finishGame(false); });

  function finishGame(won, quiet) {
    G.running = false;
    stopTimer();
    const b = bestOf(G.diff);
    const isBest = G.score > b.score;
    if (isBest) b.score = G.score;
    save();
    ON.track('game_end', { diff: G.diff.id, won, score: G.score, stage: G.stage + 1 });
    if (quiet) { showHome(); return; }
    $('over-ic').className = 'big-ic' + (won ? ' win' : ' warn');
    $('over-ic').innerHTML = won ? ic('trophy', '#ffd23f') : ic('clock', '#ffb4a8');
    $('over-title').textContent = won ? 'Tamat! Hebat!' : 'Permainan selesai';
    $('over-sub').textContent = won
      ? `Kamu menamatkan semua babak ${G.diff.name}.`
      : `${G.diff.name}, berhenti di babak ${G.stage + 1}.`;
    $('over-score').textContent = G.score.toLocaleString('id-ID');
    const bestEl = $('over-best');
    bestEl.className = 'best' + (isBest && G.score > 0 ? ' new' : '');
    bestEl.textContent = isBest && G.score > 0 ? 'Rekor baru!' : `Rekor: ${b.score.toLocaleString('id-ID')}`;
    if (won) Sfx.clear();
    openModal('modal-over');
    if (won || (isBest && G.score > 0)) setTimeout(() => confetti(won ? 90 : 50), 300);
  }
  $('btn-again').addEventListener('click', () => { Sfx.click(); startGame(DIFFS.indexOf(G.diff), 0); });
  $('btn-over-home').addEventListener('click', () => { Sfx.click(); showHome(); });
  $('btn-share').addEventListener('click', async () => {
    const text = `Aku dapat skor ${G.score.toLocaleString('id-ID')} di Onet (${G.diff.name})! Coba kalahkan:`;
    const url = location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ title: 'Onet', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Teks disalin, tinggal tempel!'); }
    } catch { /* cancelled */ }
  });

  // ---------- Effects ----------
  function drawLine(path) {
    const pts = path.map(([r, c]) => center(r, c));
    const d = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L');
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    const w = Math.max(3, G.geo.sx * 0.11);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = `<path class="link glow fade" d="${d}" stroke-width="${w * 2.6}"/><path class="link core fade" d="${d}" stroke-width="${w}" style="--len:${len.toFixed(0)}"/>` +
      pts.filter((_, i) => i > 0 && i < pts.length - 1).map(([x, y]) => `<circle class="link fade" cx="${x}" cy="${y}" r="${w * 0.9}" style="fill:#ffd23f"/>`).join('');
    linesEl.appendChild(g);
    setTimeout(() => g.remove(), 560);
  }
  function clearLines() { linesEl.innerHTML = ''; fxEl.innerHTML = ''; }

  const SPARK_COLORS = ['#ffd23f', '#ff7a59', '#9ef0d8', '#ffffff', '#f9a8d4'];
  function sparks(x, y) {
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
      const dist = G.geo.sx * (0.7 + Math.random() * 0.6);
      s.style.cssText = `left:${x}px;top:${y}px;background:${SPARK_COLORS[i % SPARK_COLORS.length]};--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist}px`;
      fxEl.appendChild(s);
      setTimeout(() => s.remove(), 650);
    }
  }
  function floater(x, y, text) {
    const f = document.createElement('div');
    f.className = 'floater';
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    fxEl.appendChild(f);
    setTimeout(() => f.remove(), 850);
  }
  let comboT = 0;
  function showCombo(n) {
    const el = $('combo');
    el.textContent = `Combo x${n}!`;
    el.classList.add('show');
    clearTimeout(comboT);
    comboT = setTimeout(() => el.classList.remove('show'), 1100);
  }
  // CSS-only confetti; skipped for people who asked for less motion
  const CONFETTI = ['#ffd23f', '#ff7a59', '#9ef0d8', '#f9a8d4', '#60a5fa', '#a3e635'];
  function confetti(n) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      const w = 6 + Math.random() * 6;
      c.style.cssText = `left:${Math.random() * 100}%;width:${w}px;height:${w * (Math.random() < 0.5 ? 0.45 : 1)}px;` +
        `background:${CONFETTI[i % CONFETTI.length]};border-radius:${Math.random() < 0.3 ? '50%' : '2px'};` +
        `animation-delay:${Math.random() * 0.4}s;animation-duration:${1.8 + Math.random() * 1.4}s;--sway:${(Math.random() - 0.5) * 160}px;--spin:${Math.random() * 900 - 450}deg`;
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3800);
  }

  let toastT = 0;
  function toast(msg, ms = 1800) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), ms);
  }
  function buzz(p) { if (profile.vibe && navigator.vibrate) try { navigator.vibrate(p); } catch { /* ignore */ } }

  // ---------- Boot ----------
  addEventListener('pointerdown', () => { Sfx.unlock(); applyAudio(); }, { once: true });
  renderLogo();
  renderHome();
  setInterval(() => { if (document.body.classList.contains('at-home')) renderLogo(); }, 6000);

  // test hook (used by scripts/smoke.js)
  window.__onet = {
    G, DIFFS,
    start: (i, stage = 0) => startGame(i, stage),
    skipIntro: () => endIntro(),
    // play the next available pair through the real tap handler
    playOne() {
      const m = G.board.findMove();
      if (!m) return false;
      tap(G.board.at(...m.a).id);
      tap(G.board.at(...m.b).id);
      return true;
    },
    setTime(s) { G.timeLeft = s; },
  };
})();
