// Plays through stages in a real browser and saves screenshots.
// Usage: python3 -m http.server 8123 & node scripts/smoke.js http://localhost:8123/ out-dir
const { chromium } = require('playwright');
const [url, out = '.'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const run = async (name, viewport, fn) => {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 600 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    p.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
    await p.addInitScript(() => localStorage.setItem('onet-profile-v1', JSON.stringify({ seenHelp: true })));
    await p.goto(url);
    await p.waitForTimeout(400);
    await fn(p);
    await ctx.close();
  };
  const clearStage = async (p) => {
    for (let i = 0; i < 200; i++) {
      const ok = await p.evaluate(() => { const G = window.__onet.G; if (!G.running || G.busy) return 'wait'; return window.__onet.playOne(); });
      if (ok === false) break;
      await p.waitForTimeout(ok === 'wait' ? 120 : 260);
      if (await p.evaluate(() => !window.__onet.G.running)) break;
    }
  };
  await run('phone', { width: 390, height: 844 }, async (p) => {
    await p.screenshot({ path: `${out}/m-home.png` });
    for (const i of [0, 2, 4]) {
      await p.evaluate((i) => window.__onet.start(i), i);
      await p.waitForTimeout(1300);
      await p.screenshot({ path: `${out}/m-play-${i}.png` });
      const geo = await p.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom, innerWidth, innerHeight]; });
      if (geo[0] < 0 || geo[1] > geo[4] || geo[3] > geo[5]) errors.push(`board overflows on diff ${i}: ${geo}`);
      // tap two tiles through real pointer events
      const m = await p.evaluate(() => { const G = window.__onet.G; const mv = G.board.findMove(); return [G.board.at(...mv.a).id, G.board.at(...mv.b).id]; });
      await p.click(`.tile[data-id="${m[0]}"]`); await p.waitForTimeout(150);
      await p.click(`.tile[data-id="${m[1]}"]`); await p.waitForTimeout(100);
      await p.screenshot({ path: `${out}/m-match-${i}.png` });
      await p.waitForTimeout(400);
      if (await p.evaluate(() => window.__onet.G.score) <= 0) errors.push(`real taps did not score on diff ${i}`);
      await clearStage(p);
      await p.waitForTimeout(1800);
      await p.screenshot({ path: `${out}/m-clear-${i}.png` });
      if (!(await p.isVisible('#modal-clear.show'))) errors.push(`stage clear modal missing on diff ${i}`);
      await p.click('#btn-next');
      await p.waitForTimeout(1300);
      await p.screenshot({ path: `${out}/m-stage2-${i}.png` });
      await clearStage(p); // stage 2 (gravity on medium/hard)
      await p.waitForTimeout(1500);
      if (!(await p.isVisible('#modal-clear.show'))) errors.push(`stage 2 clear missing on diff ${i}`);
      await p.click('#btn-clear-home');
      await p.waitForTimeout(300);
    }
    // time up + revive + refill
    await p.evaluate(() => window.__onet.start(1));
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__onet.setTime(0.3));
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/m-timeup.png` });
    await p.click('#btn-revive');
    await p.waitForTimeout(3600);
    await p.screenshot({ path: `${out}/m-ad.png` });
    await p.click('.ad-close');
    await p.waitForTimeout(500);
    if (Math.round(await p.evaluate(() => window.__onet.G.timeLeft)) < 28) errors.push('revive did not add time');
    for (let k = 0; k < 4; k++) { await p.click('#btn-hint'); await p.waitForTimeout(100); await p.evaluate(() => window.__onet.playOne()); await p.waitForTimeout(350); }
    await p.click('#btn-hint'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/m-refill.png` });
    await p.click('#btn-refill-no');
    await p.click('#btn-pause'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/m-pause.png` });
    await p.click('#btn-quit'); await p.waitForTimeout(300);
    await p.click('#btn-help'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/m-help.png` });
  });
  await run('desktop', { width: 1366, height: 768 }, async (p) => {
    await p.screenshot({ path: `${out}/d-home.png` });
    await p.evaluate(() => window.__onet.start(4));
    await p.waitForTimeout(1300);
    await p.screenshot({ path: `${out}/d-play-4.png` });
    await clearStage(p);
    await p.waitForTimeout(1500);
    if (!(await p.isVisible('#modal-clear.show'))) errors.push('desktop clear missing');
  });
  await run('small', { width: 360, height: 640 }, async (p) => {
    await p.screenshot({ path: `${out}/s-home.png` });
    await p.evaluate(() => window.__onet.start(4));
    await p.waitForTimeout(1300);
    await p.screenshot({ path: `${out}/s-play-4.png` });
  });
  await b.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'smoke OK');
  process.exit(errors.length ? 1 : 0);
})();
