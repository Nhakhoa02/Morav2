import { CellData } from './types';

export function propagateIncident(
  grid: CellData[][],
  type: 'fire' | 'smoke',
  maxTime: number = 20
): CellData[][] {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
  const rows = grid.length;
  const cols = grid[0].length;

  const key = type === 'fire' ? 'fireTime' : 'smokeTime';

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  const queue: { r: number, c: number, t: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = newGrid[r][c][key];
      if (val >= 0) {
        queue.push({ r, c, t: val });
      }
    }
  }

  queue.sort((a, b) => a.t - b.t);

  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { r, c, t } = queue.shift()!;
    const posKey = `${r},${c}`;
    if (visited.has(posKey)) continue;
    visited.add(posKey);

    if (t >= maxTime) continue;

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;

      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        if (newGrid[nr][nc].accessibility >= 0) { 
          const currentVal = newGrid[nr][nc][key];
          if (currentVal === -1 || currentVal > t + 1) {
            newGrid[nr][nc][key] = t + 1;
            queue.push({ r: nr, c: nc, t: t + 1 });
          }
        }
      }
    }
    queue.sort((a, b) => a.t - b.t);
  }

  return newGrid;
}
