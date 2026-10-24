// Difficulty table, shared by the game and scripts/test-solvable.js.
// rows x cols are for a portrait screen; on a wide screen the board is turned sideways.
(() => {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const ON = (root.ON = root.ON || {});

  const DIFFS = [
    { id: 'sm', name: 'Sangat Mudah', color: '#3fb68b', rows: 6, cols: 4, faces: 6, time: 150, hints: 5, shuffles: 5, bonus: 2, mult: 1,
      gravity: ['none', 'none', 'none', 'none', 'none'] },
    { id: 'm', name: 'Mudah', color: '#3b9ae8', rows: 8, cols: 6, faces: 12, time: 210, hints: 4, shuffles: 3, bonus: 1.5, mult: 1.5,
      gravity: ['none', 'none', 'none', 'down', 'up'] },
    { id: 's', name: 'Sedang', color: '#f2a516', rows: 10, cols: 7, faces: 18, time: 270, hints: 3, shuffles: 2, bonus: 1, mult: 2,
      gravity: ['none', 'down', 'left', 'up', 'right'] },
    { id: 'su', name: 'Sulit', color: '#f0643f', rows: 12, cols: 8, faces: 24, time: 330, hints: 2, shuffles: 2, bonus: 0.5, mult: 3,
      gravity: ['down', 'left', 'up', 'right', 'split'] },
    { id: 'ss', name: 'Sangat Sulit', color: '#b33ad6', rows: 14, cols: 9, faces: 32, time: 390, hints: 1, shuffles: 1, bonus: 0, mult: 4,
      gravity: ['left', 'down', 'center', 'right', 'split'] },
  ];
  const STAGES = 5;

  ON.DIFFS = DIFFS;
  ON.STAGES = STAGES;
  if (typeof module !== 'undefined') module.exports = { DIFFS, STAGES };
})();
