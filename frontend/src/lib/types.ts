export type GridLayer = 'accessibility' | 'fire' | 'smoke' | 'population' | 'value' | 'minSuppression';

export interface CellData {
  accessibility: number; // -1: unreachable, 0: land, 1: air, 2: both
  fireTime: number; // -1: none, 0..T: reach time
  smokeTime: number; // -1: none, 0..T: reach time
  population: number;
  value: number;
  minSuppression: number;
}

export interface Floor {
  id: string;
  floorNumber: number;
  grid: CellData[][];
}

export type AccessibilityType = 0 | 1 | 2; // 0: land, 1: air, 2: both

export interface Squad {
  id: string;
  name: string;
  suppressionRate: number;
  rescueRate: number;
  cost: number;
  inventory: number[]; // Index by time step
  accessibilityType: AccessibilityType;
}

export interface ResourceAllocation {
  time: number;
  floor: number;
  row: number;
  col: number;
  squadId: string;
  units: number;
  action: 'suppression' | 'rescue';
}

/**
 * Detailed binary states from the MILP solver
 */
export interface SolverCellState {
  mu: number;    // High-risk (fire)
  k: number;     // Burnt
  phi: number;   // Fire treated (suppressed)
  sigma: number; // Smoke-risk
  f: number;     // Smoked
  psi: number;   // Smoke treated (rescued)
}

export interface OptimizationResult {
  tValue: number;
  metrics: {
    o1_peopleAtRisk: number;
    o2_burntCells: number;
    o3_totalCost: number;
  };
  // History of binary states per time/floor/cell
  history: {
    [time: number]: {
      [floorNumber: number]: SolverCellState[][];
    }
  };
  allocations: ResourceAllocation[];
}
