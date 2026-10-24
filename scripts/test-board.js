// Checks Board.path against a brute-force turn-counting BFS on random boards.
const { Board } = require('../js/board.js');
function bfsTurns(b, a, t) {
  const H = b.rows + 2, W = b.cols + 2, D = [[-1,0],[1,0],[0,-1],[0,1]];
  const best = new Map(); const q = [];
  for (let d = 0; d < 4; d++) q.push([a[0], a[1], d, 0]);
  while (q.length) {
    const [r, c, d, k] = q.shift();
    for (let nd = 0; nd < 4; nd++) {
      const nk = k + (nd === d ? 0 : 1);
      if (nk > 2 + 0) continue;
      const y = r + D[nd][0], x = c + D[nd][1];
      if (y < 0 || x < 0 || y >= H || x >= W) continue;
      if (y === t[0] && x === t[1]) return true;
      if (b.grid[y][x]) continue;
      const key = y * 100 + x * 4 + nd;
      if (best.has(key) && best.get(key) <= nk) continue;
      best.set(key, nk); q.push([y, x, nd, nk]);
    }
  }
  return false;
}
// first step from a counts direction choice as free (k starts 0 for each initial dir)
let checked = 0, bad = 0;
for (let it = 0; it < 300; it++) {
  const b = new Board(6 + (it % 5), 4 + (it % 6), [0,1,2,3,4,5,6,7]);
  // knock out random tiles to open paths
  for (const t of b.tiles()) if (Math.random() < 0.45) b.grid[t.r][t.c] = null;
  const tiles = b.tiles();
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
    if (tiles[i].tile.type !== tiles[j].tile.type) continue;
    const A = [tiles[i].r, tiles[i].c], B = [tiles[j].r, tiles[j].c];
    const p = !!b.path(A, B), e = bfsTurns(b, A, B);
    checked++; if (p !== e) { bad++; if (bad < 5) console.log('mismatch', A, B, p, e); }
  }
}
// gravity keeps tile count
const g = new Board(8, 6, [0,1,2,3,4,5]);
for (const m of ['down','up','left','right','split','center']) { const n = g.count(); g.remove(...[g.tiles()[0], g.tiles()[1]].map(t=>[t.r,t.c])); g.applyGravity(m); if (g.count() !== n - 2) { bad++; console.log('gravity', m); } }
console.log(`checked ${checked} pairs, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
