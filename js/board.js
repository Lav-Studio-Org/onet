// Onet board logic, no DOM: dealing, the 2-turn path rule, hints, shuffles, gravity.
// The grid has an empty 1-cell border so paths may run around the outside of the tiles.
(() => {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const ON = (root.ON = root.ON || {});

  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function shuffleArr(a, rnd = Math.random) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  class Board {
    // rows/cols count playable cells; types = how many different faces to use
    constructor(rows, cols, faces, rnd = Math.random) {
      this.rows = rows;
      this.cols = cols;
      this.rnd = rnd;
      this.nextId = 1;
      this.grid = [];
      for (let r = 0; r < rows + 2; r++) this.grid.push(new Array(cols + 2).fill(null));
      const n = rows * cols;
      const types = [];
      for (let p = 0; p < n / 2; p++) {
        const t = faces[p % faces.length];
        types.push(t, t);
      }
      shuffleArr(types, rnd);
      let k = 0;
      for (let r = 1; r <= rows; r++)
        for (let c = 1; c <= cols; c++) this.grid[r][c] = { id: this.nextId++, type: types[k++] };
      if (!this.findMove()) this.shuffle();
    }

    at(r, c) { return this.grid[r] ? this.grid[r][c] : undefined; }
    inside(r, c) { return r >= 0 && c >= 0 && r < this.rows + 2 && c < this.cols + 2; }
    empty(r, c) { return this.inside(r, c) && this.grid[r][c] === null; }

    tiles() {
      const out = [];
      for (let r = 1; r <= this.rows; r++)
        for (let c = 1; c <= this.cols; c++) if (this.grid[r][c]) out.push({ r, c, tile: this.grid[r][c] });
      return out;
    }
    count() { return this.tiles().length; }

    // empty cells reachable in a straight line from (r,c), in all 4 directions
    ray(r, c) {
      const out = [];
      for (const [dr, dc] of DIRS) {
        let y = r + dr, x = c + dc;
        while (this.empty(y, x)) { out.push([y, x]); y += dr; x += dc; }
      }
      return out;
    }

    // straight segment between two aligned cells, endpoints excluded, all empty?
    clear(r1, c1, r2, c2) {
      if (r1 !== r2 && c1 !== c2) return false;
      const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
      let y = r1 + dr, x = c1 + dc;
      while (y !== r2 || x !== c2) {
        if (!this.empty(y, x)) return false;
        y += dr; x += dc;
      }
      return true;
    }

    // Shortest path with at most 2 turns, as corner points [[r,c],...], or null.
    path(a, b) {
      const [ar, ac] = a, [br, bc] = b;
      if (ar === br && ac === bc) return null;
      const ta = this.grid[ar][ac], tb = this.grid[br][bc];
      if (!ta || !tb || ta.type !== tb.type) return null;
      if ((ar === br || ac === bc) && this.clear(ar, ac, br, bc)) return [a, b];

      const len = (pts) => {
        let s = 0;
        for (let i = 1; i < pts.length; i++) s += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
        return s;
      };
      // one turn: corner at (ar,bc) or (br,ac)
      let best = null;
      for (const p of [[ar, bc], [br, ac]]) {
        if (this.empty(p[0], p[1]) && this.clear(ar, ac, p[0], p[1]) && this.clear(p[0], p[1], br, bc)) {
          const pts = [a, p, b];
          if (!best || len(pts) < len(best)) best = pts;
        }
      }
      if (best) return best;
      // two turns: p on a's ray, q on b's ray, p and q aligned with a clear segment between
      const ra = this.ray(ar, ac), rb = this.ray(br, bc);
      for (const p of ra) {
        for (const q of rb) {
          if (p[0] === q[0] && p[1] === q[1]) continue;
          // the a->p and q->b legs must be perpendicular to p->q, or it is not 2 turns
          const pqH = p[0] === q[0], pqV = p[1] === q[1];
          if (!pqH && !pqV) continue;
          if (pqH && (p[0] === ar || q[0] === br)) continue;
          if (pqV && (p[1] === ac || q[1] === bc)) continue;
          if (!this.clear(p[0], p[1], q[0], q[1])) continue;
          const pts = [a, p, q, b];
          if (!best || len(pts) < len(best)) best = pts;
        }
      }
      return best;
    }

    // any valid pair: { a, b, path } or null
    findMove() {
      const byType = new Map();
      for (const t of this.tiles()) {
        if (!byType.has(t.tile.type)) byType.set(t.tile.type, []);
        byType.get(t.tile.type).push([t.r, t.c]);
      }
      for (const list of byType.values()) {
        for (let i = 0; i < list.length; i++)
          for (let j = i + 1; j < list.length; j++) {
            const p = this.path(list[i], list[j]);
            if (p) return { a: list[i], b: list[j], path: p };
          }
      }
      return null;
    }

    remove(a, b) {
      this.grid[a[0]][a[1]] = null;
      this.grid[b[0]][b[1]] = null;
    }

    // Rearrange the remaining tiles over the same cells until a move exists.
    shuffle() {
      const cells = this.tiles();
      if (cells.length < 2) return;
      const objs = cells.map((t) => t.tile);
      for (let attempt = 0; attempt < 200; attempt++) {
        shuffleArr(objs, this.rnd);
        cells.forEach((cell, i) => (this.grid[cell.r][cell.c] = objs[i]));
        if (this.findMove()) return;
      }
    }

    // Slide tiles after a removal. Modes: none, down, up, left, right,
    // split (top half up / bottom half down), center (left/right halves toward the middle).
    applyGravity(mode) {
      if (!mode || mode === 'none') return;
      const R = this.rows, C = this.cols;
      const packLine = (cells) => {
        // cells: list of [r,c] in the order tiles should pack toward (first = destination end)
        const objs = cells.map(([r, c]) => this.grid[r][c]).filter(Boolean);
        cells.forEach(([r, c], i) => (this.grid[r][c] = objs[i] || null));
      };
      const col = (c, from, to) => {
        const out = [];
        const step = from <= to ? 1 : -1;
        for (let r = from; r !== to + step; r += step) out.push([r, c]);
        return out;
      };
      const row = (r, from, to) => {
        const out = [];
        const step = from <= to ? 1 : -1;
        for (let c = from; c !== to + step; c += step) out.push([r, c]);
        return out;
      };
      if (mode === 'down') for (let c = 1; c <= C; c++) packLine(col(c, R, 1));
      else if (mode === 'up') for (let c = 1; c <= C; c++) packLine(col(c, 1, R));
      else if (mode === 'left') for (let r = 1; r <= R; r++) packLine(row(r, 1, C));
      else if (mode === 'right') for (let r = 1; r <= R; r++) packLine(row(r, C, 1));
      else if (mode === 'split') {
        const mid = Math.floor(R / 2);
        for (let c = 1; c <= C; c++) { packLine(col(c, 1, mid)); packLine(col(c, R, mid + 1)); }
      } else if (mode === 'center') {
        const mid = Math.floor(C / 2);
        for (let r = 1; r <= R; r++) { packLine(row(r, mid, 1)); packLine(row(r, mid + 1, C)); }
      }
    }

    // id -> [r,c] for every tile, used to animate moves
    positions() {
      const m = new Map();
      for (const t of this.tiles()) m.set(t.tile.id, [t.r, t.c]);
      return m;
    }
  }

  ON.Board = Board;
  ON.shuffleArr = shuffleArr;
  if (typeof module !== 'undefined') module.exports = { Board, shuffleArr };
})();
