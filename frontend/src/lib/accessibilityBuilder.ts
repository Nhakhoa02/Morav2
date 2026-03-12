import { Floor } from './types';

/**
 * Extracts raw accessibility values from floors for the solver.
 * Values:
 * -1 = unreachable
 * 0 = land only
 * 1 = air only
 * 2 = both
 */
export function buildSolverAccessibility(
  floors: Floor[]
): number[][][] {
  return floors.map(floor => 
    floor.grid.map(row => 
      row.map(cell => cell.accessibility)
    )
  );
}
