// Plays every difficulty and stage many times with a bot that picks random valid moves,
// exactly like the game does: remove pair, apply that stage's gravity, auto-shuffle when stuck.
// Fails if a board ever has tiles left but no move after the auto-shuffle.
// Usage: node scripts/test-solvable.js [gamesPerStage=300]
const { Board } = require('../js/board.js');
const { DIFFS, STAGES } = require('../js/levels.js');

const GAMES = +process.argv[2] || 300;
const FACE_COUNT = 38;

// small seeded RNG so a failure can be replayed
function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function allMoves(b) {
  const out = [];
  const t = b.tiles();
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++) {
      if (t[i].tile.type !== t[j].tile.type) continue;
      const a = [t[i].r, t[i].c], c = [t[j].r, t[j].c];
      if (b.path(a, c)) out.push([a, c]);
    }
  return out;
}

let boards = 0, autoShuffles = 0, failures = 0;
const t0 = Date.now();
for (const d of DIFFS) {
  for (let stage = 0; stage < STAGES; stage++) {
    const gravity = d.gravity[stage];
    let stageShuffles = 0;
    for (const turned of [false, true]) {
      for (let g = 0; g < GAMES / 2; g++) {
        const seed = (d.id.charCodeAt(0) * 7919 + stage * 104729 + g * 31 + (turned ? 1 : 0)) >>> 0;
        const rnd = rng(seed);
        const faces = Array.from({ length: FACE_COUNT }, (_, i) => i).sort(() => rnd() - 0.5).slice(0, d.faces);
        const b = new Board(turned ? d.cols : d.rows, turned ? d.rows : d.cols, faces, rnd);
        boards++;
        if (!b.findMove()) { failures++; console.log(`FAIL deal ${d.id} stage ${stage + 1} seed ${seed}`); continue; }
        let steps = 0;
        while (b.count() > 0) {
          const moves = allMoves(b);
          if (!moves.length) {
            autoShuffles++; stageShuffles++;
            b.shuffle();
            if (!b.findMove()) { failures++; console.log(`FAIL stuck ${d.id} stage ${stage + 1} seed ${seed}, ${b.count()} tiles left`); break; }
            continue;
          }
          const [a, c] = moves[Math.floor(rnd() * moves.length)];
          b.remove(a, c);
          b.applyGravity(gravity);
          if (++steps > 1000) { failures++; console.log(`FAIL loop ${d.id} ${stage + 1} ${seed}`); break; }
        }
      }
    }
    console.log(`${d.name.padEnd(13)} babak ${stage + 1} (${gravity.padEnd(6)}): ${GAMES} games ok, auto-shuffle ${stageShuffles}x`);
  }
}
// The shuffle fallback must give a valid move on any layout, however sparse or scattered.
let forced = 0;
for (let i = 0; i < 20000; i++) {
  const rnd = rng(900000 + i);
  const rows = 2 + Math.floor(rnd() * 13), cols = 2 * (1 + Math.floor(rnd() * 5));
  const b = new Board(rows, cols, [0, 1, 2, 3, 4, 5, 6], rnd);
  // remove random pairs of the same face so counts stay even
  const keep = rnd();
  const byType = {};
  for (const t of b.tiles()) (byType[t.tile.type] = byType[t.tile.type] || []).push([t.r, t.c]);
  for (const list of Object.values(byType))
    for (let k = 0; k + 1 < list.length; k += 2) if (rnd() > keep) b.remove(list[k], list[k + 1]);
  if (b.count() < 2) continue;
  const pq = b.forcePair();
  forced++;
  if (!b.path(pq[0], pq[1])) { failures++; console.log(`FAIL forcePair layout ${i}`); }
}
console.log(`forcePair fallback: ${forced} random layouts, all gave a valid move` + (failures ? ' (see failures)' : ''));

console.log(`\n${boards} boards played to the end, ${autoShuffles} auto-shuffles, ${failures} failures (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failures ? 1 : 0);
