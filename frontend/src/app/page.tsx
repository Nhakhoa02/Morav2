
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Floor, GridLayer, Squad, CellData, OptimizationResult, SolverCellState, AccessibilityType } from '@/lib/types';
import { propagateIncident } from '@/lib/propagation';
import { AppHeader } from '@/components/app-header';
import { SidebarConfig } from '@/components/sidebar-config';
import { GridEditor } from '@/components/grid-editor';
import { ResultsPanel } from '@/components/results-panel';
import { runOptimization } from '@/lib/api';

const INITIAL_CELL: CellData = {
  accessibility: -1, // -1: unreachable
  fireTime: -1,
  smokeTime: -1,
  population: 0,
  value: 0,
  minSuppression: 0
};

const INITIAL_SQUADS: Squad[] = [
  { id: 's1', name: 'Land Squad A', suppressionRate: 2,  rescueRate: 0, cost: 5,   inventory: [4, 4, 4], accessibilityType: 0 },
  { id: 's2', name: 'Air Squad B', suppressionRate: 5,  rescueRate: 0, cost: 15,  inventory: [3, 2, 4], accessibilityType: 1 },
  { id: 's3', name: 'Elite Squad C', suppressionRate: 10, rescueRate: 0, cost: 20,  inventory: [0, 0, 1], accessibilityType: 2 },
  { id: 's4', name: 'Rescue Squad D', suppressionRate: 0,  rescueRate: 2, cost: 5,   inventory: [4, 4, 4], accessibilityType: 0 },
  { id: 's5', name: 'Rescue Squad E', suppressionRate: 0,  rescueRate: 5, cost: 15,  inventory: [3, 2, 4], accessibilityType: 0 },
  { id: 's6', name: 'Rescue Squad F', suppressionRate: 0,  rescueRate: 10, cost: 20, inventory: [0, 0, 1], accessibilityType: 0 },
];

export default function PyrePlanPage() {
  const { toast } = useToast();
  const resultsRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [simulationSteps, setSimulationSteps] = useState(3);

  const [floors, setFloors] = useState<Floor[]>([
    {
      id: 'f1',
      floorNumber: 1,
      grid: Array(5).fill(null).map(() =>
        Array(5).fill(null).map(() => ({ ...INITIAL_CELL }))
      )
    }
  ]);

  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<GridLayer>('accessibility');
  const [squads, setSquads] = useState<Squad[]>(INITIAL_SQUADS);
  const [isSolving, setIsSolving] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [simulationTime, setSimulationTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [brushValue, setBrushValue] = useState<number>(1);

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [totalBudget, setTotalBudget] = useState(300);

  const activeFloor = floors[activeFloorIndex];

  // Map internal state to solver-friendly JSON for Export/Sample
  const solverJsonData = useMemo(() => {
    return {
      num_floors: floors.length,
      grid_size: [rows, cols],
      resources: squads.map(s => s.name),
      suppression_rates: squads.map(s => s.suppressionRate),
      rescue_rates: squads.map(s => s.rescueRate),
      squad_costs: squads.map(s => s.cost),
      inventory: squads.map(s => s.inventory),
      smoke_map: floors.map(f => f.grid.map(row => row.map(c => c.smokeTime))),
      fire_map: floors.map(f => f.grid.map(row => row.map(c => c.fireTime))),
      population_map: floors.map(f => f.grid.map(row => row.map(c => c.population))),
      accessibility: floors.map(f => f.grid.map(row => row.map(c => c.accessibility))),
      min_suppression_required: floors.map(f => f.grid.map(row => row.map(c => c.minSuppression))),
      value_map: floors.map(f => f.grid.map(row => row.map(c => c.value))),
      total_budget: totalBudget,
      M: squads.map(s => s.accessibilityType),
      Tset: Array.from({ length: simulationSteps }, (_, i) => i),
    };
  }, [floors, rows, cols, squads, totalBudget, simulationSteps]);

  useEffect(() => {
    if (optimizationResult && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [optimizationResult]);

  const handleSetLayer = (layer: GridLayer) => {
    setActiveLayer(layer);
    if (layer === 'accessibility') {
      setBrushValue(1);
    }
  };

  const handleResizeGrid = () => {
    setFloors(prev => prev.map(floor => {
      const newGrid = Array(rows).fill(null).map((_, r) =>
        Array(cols).fill(null).map((_, c) => {
          if (r < floor.grid.length && c < floor.grid[r].length) {
            return { ...floor.grid[r][c] };
          }
          return { ...INITIAL_CELL };
        })
      );
      return { ...floor, grid: newGrid };
    }));
    toast({ title: "Grid Resized", description: `Map size updated to ${rows}×${cols}` });
  };

  const addFloor = () => {
    const lastFloor = floors[floors.length - 1];
    const newGrid = Array(rows).fill(null).map((_, r) =>
      Array(cols).fill(null).map((_, c) => ({
        ...INITIAL_CELL,
        accessibility: lastFloor.grid[r]?.[c]?.accessibility ?? -1
      }))
    );

    const nextNum = floors.length + 1;
    setFloors([
      ...floors,
      { id: `f${Date.now()}`, floorNumber: nextNum, grid: newGrid }
    ]);
    setActiveFloorIndex(floors.length);
  };

  const removeFloor = (index: number) => {
    if (floors.length === 1) return;
    const newFloors = floors
      .filter((_, i) => i !== index)
      .map((f, i) => ({ ...f, floorNumber: i + 1 }));
    setFloors(newFloors);
    setActiveFloorIndex(Math.max(0, index - 1));
  };

  const updateCell = (r: number, c: number, value?: number) => {
    setFloors(prev => {
      const newFloors = [...prev];
      const floor = { ...newFloors[activeFloorIndex] };
      const currentCell = floor.grid[r][c];

      const newGrid = floor.grid.map(row => row.map(cell => ({ ...cell })));
      const targetValue = value !== undefined ? value : brushValue;

      if (activeLayer !== 'accessibility' && currentCell.accessibility === -1) {
        return prev;
      }

      const getVal = (l: GridLayer, cell: CellData) => {
        switch (l) {
          case 'accessibility': return cell.accessibility;
          case 'fire': return cell.fireTime;
          case 'smoke': return cell.smokeTime;
          case 'population': return cell.population;
          case 'value': return cell.value;
          case 'minSuppression': return cell.minSuppression;
        }
      };

      const isSameValue = getVal(activeLayer, currentCell) === targetValue;

      if (isSameValue) {
        switch (activeLayer) {
          case 'accessibility': newGrid[r][c].accessibility = -1; break;
          case 'fire': newGrid[r][c].fireTime = -1; break;
          case 'smoke': newGrid[r][c].smokeTime = -1; break;
          case 'population': newGrid[r][c].population = 0; break;
          case 'value': newGrid[r][c].value = 0; break;
          case 'minSuppression': newGrid[r][c].minSuppression = 0; break;
        }
      } else {
        switch (activeLayer) {
          case 'accessibility': newGrid[r][c].accessibility = Math.max(-1, Math.min(2, targetValue)); break;
          case 'fire': newGrid[r][c].fireTime = targetValue; break;
          case 'smoke': newGrid[r][c].smokeTime = targetValue; break;
          case 'population': newGrid[r][c].population = Math.max(0, targetValue); break;
          case 'value': newGrid[r][c].value = Math.max(0, targetValue); break;
          case 'minSuppression': newGrid[r][c].minSuppression = Math.max(0, targetValue); break;
        }
      }

      floor.grid = newGrid;
      newFloors[activeFloorIndex] = floor;
      return newFloors;
    });
  };

  const handleLoadData = (data: any) => {
    if (!data) return;
    try {
      // Map back from solver-style JSON to App state
      const numFloors = data.num_floors || 1;
      const [r, c] = data.grid_size || [5, 5];
      const budget = data.total_budget || 300;
      const tSet = data.Tset || [0, 1, 2];
      
      setRows(r);
      setCols(c);
      setTotalBudget(budget);
      setSimulationSteps(tSet.length);

      // Build Squads
      const newSquads: Squad[] = (data.resources || []).map((name: string, i: number) => ({
        id: `s-${i}-${Date.now()}`,
        name,
        suppressionRate: data.suppression_rates?.[i] ?? 0,
        rescueRate: data.rescue_rates?.[i] ?? 0,
        cost: data.squad_costs?.[i] ?? 0,
        inventory: data.inventory?.[i] ?? new Array(tSet.length).fill(1),
        accessibilityType: (data.M?.[i] ?? 0) as AccessibilityType
      }));
      setSquads(newSquads);

      // Build Floors
      const newFloors: Floor[] = [];
      for (let fi = 0; fi < numFloors; fi++) {
        const grid: CellData[][] = Array(r).fill(null).map((_, rowIdx) =>
          Array(c).fill(null).map((_, colIdx) => ({
            accessibility: data.accessibility?.[fi]?.[rowIdx]?.[colIdx] ?? -1,
            fireTime: data.fire_map?.[fi]?.[rowIdx]?.[colIdx] ?? -1,
            smokeTime: data.smoke_map?.[fi]?.[rowIdx]?.[colIdx] ?? -1,
            population: data.population_map?.[fi]?.[rowIdx]?.[colIdx] ?? 0,
            value: data.value_map?.[fi]?.[rowIdx]?.[colIdx] ?? 0,
            minSuppression: data.min_suppression_required?.[fi]?.[rowIdx]?.[colIdx] ?? 0,
          }))
        );
        newFloors.push({
          id: `f-${fi}-${Date.now()}`,
          floorNumber: fi + 1,
          grid
        });
      }
      setFloors(newFloors);
      setActiveFloorIndex(0);
      setOptimizationResult(null);

    } catch (e) {
      console.error("Load failed", e);
      toast({ title: "Load Error", description: "JSON structure is incompatible with current model.", variant: "destructive" });
    }
  };

  const runOptimizer = async () => {
    const names = squads.map(s => s.name.trim());
    if (names.some(n => !n)) {
      toast({ title: "Validation Error", description: "All squads must have a name", variant: "destructive" });
      return;
    }
    if (new Set(names).size !== squads.length) {
      toast({ title: "Validation Error", description: "Squad names must be unique", variant: "destructive" });
      return;
    }

    setIsSolving(true);

    const processedFloors = floors.map(f => ({
      ...f,
      grid: propagateIncident(propagateIncident(f.grid, 'fire'), 'smoke')
    }));
    setFloors(processedFloors);

    try {
      const payload = {
        num_floors: processedFloors.length,
        grid_size: [rows, cols],
        resources: squads.map(s => s.name.trim()),
        suppression_rates: squads.map(s => Number(s.suppressionRate) || 0),
        rescue_rates: squads.map(s => Number(s.rescueRate) || 0),
        squad_costs: squads.map(s => Number(s.cost) || 0),
        inventory: squads.map(s => {
          const arr = new Array(simulationSteps).fill(0);
          for (let t = 0; t < simulationSteps; t++) {
            arr[t] = Number(s.inventory[t] ?? 0);
          }
          return arr;
        }),
        smoke_map: processedFloors.map(f =>
          f.grid.map(row => row.map(cell => Number(cell.smokeTime) ?? -1))
        ),
        fire_map: processedFloors.map(f =>
          f.grid.map(row => row.map(cell => Number(cell.fireTime) ?? -1))
        ),
        population_map: processedFloors.map(f =>
          f.grid.map(row => row.map(cell => Number(cell.population) ?? 0))
        ),
        accessibility: processedFloors.map(f =>
          f.grid.map(row => row.map(cell => Number(cell.accessibility) ?? -1))
        ),
        min_suppression_required: processedFloors.map(f =>
          f.grid.map(row => row.map(cell => Number(cell.minSuppression) ?? 0))
        ),
        value_map: processedFloors.map(f =>
          f.grid.map(row => row.map(cell => Number(cell.value) ?? 0))
        ),
        total_budget: Number(totalBudget) || 0,
        M: squads.map(s => Number(s.accessibilityType) || 0),
        Tset: Array.from({ length: simulationSteps }, (_, i) => i),
      };

      const backendResult = await runOptimization(payload);

      const solverResult: OptimizationResult = {
        tValue: simulationSteps - 1,
        metrics: {
          o1_peopleAtRisk: backendResult.O1 || 0,
          o2_burntCells: backendResult.O2 || 0,
          o3_totalCost: backendResult.O3 || 0,
        },
        history: {},
        allocations: [],
      };

      const timesDict = backendResult.times || {};
      Object.keys(timesDict).forEach(timeKey => {
        const t = parseInt(timeKey, 10);
        const timeData = timesDict[timeKey];
        solverResult.history[t] = {};

        for (let fi = 0; fi < processedFloors.length; fi++) {
          const floorNumber = processedFloors[fi].floorNumber;
          const stateGrid: SolverCellState[][] = Array(rows).fill(null).map(() =>
            Array(cols).fill({ mu: 0, k: 0, phi: 0, sigma: 0, f: 0, psi: 0 })
          );

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              stateGrid[r][c] = {
                mu: timeData.mu?.[fi]?.[r]?.[c] || 0,
                k: timeData.k?.[fi]?.[r]?.[c] || 0,
                phi: timeData.phi?.[fi]?.[r]?.[c] || 0,
                sigma: timeData.sigma?.[fi]?.[r]?.[c] || 0,
                f: timeData.f?.[fi]?.[r]?.[c] || 0,
                psi: timeData.psi?.[fi]?.[r]?.[c] || 0,
              };
            }
          }
          solverResult.history[t][floorNumber] = stateGrid;

          if (timeData.allocation) {
            Object.entries(timeData.allocation).forEach(([resourceName, floorsArr]: [string, any]) => {
              const squad = squads.find(s => s.name === resourceName);
              const squadId = squad?.id || resourceName;
              const floorMatrix = floorsArr[fi];
              if (floorMatrix) {
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < cols; c++) {
                    const units = floorMatrix[r]?.[c] || 0;
                    if (units > 0) {
                      solverResult.allocations.push({
                        time: t,
                        floor: floorNumber,
                        row: r,
                        col: c,
                        squadId,
                        units,
                        action: squad && squad.suppressionRate > squad.rescueRate ? 'suppression' : 'rescue',
                      });
                    }
                  }
                }
              }
            });
          }
        }
      });

      setOptimizationResult(solverResult);
      toast({ title: "Optimization Successful", description: "Strategic response plan generated." });
    } catch (error: any) {
      toast({
        title: "Optimization Failed",
        description: error.message || "Solver encountered an error.",
        variant: "destructive"
      });
    } finally {
      setIsSolving(false);
      setSimulationTime(0);
    }
  };

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(260, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const getCellColor = (cell: CellData, r: number, c: number) => {
    if (activeLayer === 'accessibility') {
      if (cell.accessibility === 0) return 'bg-indigo-400 border-indigo-600 shadow-sm text-white font-bold ring-1 ring-indigo-200';
      if (cell.accessibility === 1) return 'bg-indigo-700 border-indigo-900 shadow-md text-white font-bold ring-2 ring-indigo-300';
      if (cell.accessibility === 2) return 'bg-indigo-950 border-black shadow-lg text-white font-bold ring-2 ring-indigo-500';
      return 'bg-slate-100 border-slate-200';
    }
    if (activeLayer === 'fire'  && cell.fireTime  !== -1) return 'bg-orange-500 text-white';
    if (activeLayer === 'smoke' && cell.smokeTime !== -1) return 'bg-zinc-400 text-white';
    if (activeLayer === 'population'   && cell.population > 0)     return 'bg-emerald-100 border-emerald-300';
    if (activeLayer === 'value'        && cell.value > 0)          return 'bg-amber-100 border-amber-300';
    if (activeLayer === 'minSuppression' && cell.minSuppression > 0) return 'bg-rose-100 border-rose-300';

    return cell.accessibility >= 0 ? 'bg-white' : 'bg-slate-100';
  };

  const getCellLabel = (cell: CellData) => {
    switch (activeLayer) {
      case 'accessibility':   return ''; // Clean visual-first look
      case 'fire':            return cell.fireTime === -1 ? '' : cell.fireTime;
      case 'smoke':           return cell.smokeTime === -1 ? '' : cell.smokeTime;
      case 'population':      return cell.population || '';
      case 'value':           return cell.value || '';
      case 'minSuppression':  return cell.minSuppression || '';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-body overflow-y-auto">
      <AppHeader 
        isSolving={isSolving} 
        onRunOptimizer={runOptimizer} 
        currentData={solverJsonData}
        onLoadData={handleLoadData}
      />

      <div className="flex h-[calc(100vh-64px)] border-b bg-white relative overflow-hidden shrink-0">
        <SidebarConfig
          sidebarWidth={sidebarWidth}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          onStartResizing={startResizing}
          isResizing={isResizing}
          squads={squads}
          onAddSquad={() => setSquads([
            ...squads,
            {
              id: `s${Date.now()}`,
              name: `Squad ${squads.length + 1}`,
              suppressionRate: 1,
              rescueRate: 1,
              cost: 10,
              inventory: new Array(simulationSteps).fill(1),
              accessibilityType: 0
            }
          ])}
          onUpdateSquad={(id, updates) => setSquads(squads.map(s => s.id === id ? { ...s, ...updates } : s))}
          onDeleteSquad={(id) => setSquads(squads.filter(s => s.id !== id))}
          rows={rows}
          setRows={setRows}
          cols={cols}
          setCols={setCols}
          onResizeGrid={handleResizeGrid}
          simulationSteps={simulationSteps}
          setSimulationSteps={setSimulationSteps}
          totalBudget={totalBudget}
          setTotalBudget={setTotalBudget}
        />

        <main className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden min-w-0">
          <GridEditor
            activeFloor={activeFloor}
            activeFloorIndex={activeFloorIndex}
            floorsCount={floors.length}
            activeLayer={activeLayer}
            setActiveLayer={handleSetLayer}
            brushValue={brushValue}
            setBrushValue={setBrushValue}
            onNextFloor={() => setActiveFloorIndex(Math.min(floors.length - 1, activeFloorIndex + 1))}
            onPrevFloor={() => setActiveFloorIndex(Math.max(0, activeFloorIndex - 1))}
            onAddFloor={addFloor}
            onRemoveFloor={removeFloor}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            onUpdateCell={updateCell}
            getCellColor={getCellColor}
            getCellLabel={getCellLabel}
            rows={rows}
            cols={cols}
            optimizationResult={optimizationResult}
          />
        </main>
      </div>

      <div ref={resultsRef}>
        {optimizationResult && (
          <ResultsPanel
            optimizationResult={optimizationResult}
            simulationTime={simulationTime}
            setSimulationTime={setSimulationTime}
            activeFloorNumber={activeFloor.floorNumber}
            floorsCount={floors.length}
            onPrevFloor={() => setActiveFloorIndex(Math.max(0, activeFloorIndex - 1))}
            onNextFloor={() => setActiveFloorIndex(Math.min(floors.length - 1, activeFloorIndex + 1))}
            squads={squads}
            rows={rows}
            cols={cols}
            onReset={() => setOptimizationResult(null)}
          />
        )}
      </div>
    </div>
  );
}
