'use client';

import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  Flame, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Activity, 
  Map, 
  ShieldAlert, 
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { OptimizationResult, Squad, SolverCellState } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface ResultsPanelProps {
  optimizationResult: OptimizationResult | null;
  simulationTime: number;
  setSimulationTime: (val: number) => void;
  activeFloorNumber: number;
  floorsCount: number;
  onPrevFloor: () => void;
  onNextFloor: () => void;
  squads: Squad[];
  rows: number;
  cols: number;
  onReset: () => void;
}

export function ResultsPanel({
  optimizationResult,
  simulationTime,
  setSimulationTime,
  activeFloorNumber,
  floorsCount,
  onPrevFloor,
  onNextFloor,
  squads,
  rows,
  cols,
  onReset
}: ResultsPanelProps) {
  if (!optimizationResult) return null;

  const currentStates = useMemo(() => {
    return optimizationResult.history[simulationTime]?.[activeFloorNumber] || [];
  }, [optimizationResult.history, simulationTime, activeFloorNumber]);

  const currentAllocations = useMemo(() => {
    return optimizationResult.allocations.filter(
      a => a.time === simulationTime && a.floor === activeFloorNumber
    );
  }, [optimizationResult.allocations, simulationTime, activeFloorNumber]);

  const timestepMetrics = useMemo(() => {
    let muCount = 0, sigmaCount = 0, kCount = 0, fCount = 0, phiCount = 0, psiCount = 0;
    
    if (currentStates.length > 0) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const state = currentStates[r]?.[c];
          if (state) {
            if (state.mu) muCount++;
            if (state.sigma) sigmaCount++;
            if (state.k) kCount++;
            if (state.f) fCount++;
            if (state.phi) phiCount++;
            if (state.psi) psiCount++;
          }
        }
      }
    }
    
    const activeUnits = currentAllocations.reduce((sum, a) => sum + a.units, 0);

    return { muCount, sigmaCount, kCount, fCount, phiCount, psiCount, activeUnits };
  }, [currentStates, currentAllocations, rows, cols]);
  
  const getSquadInitial = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase();
  };

  const getAllocationLabel = (r: number, c: number) => {
    const allocs = currentAllocations.filter(a => a.row === r && a.col === c);
    if (allocs.length === 0) return null;
    
    const squadTotals: Record<string, number> = {};
    allocs.forEach(a => {
      squadTotals[a.squadId] = (squadTotals[a.squadId] || 0) + a.units;
    });

    return Object.entries(squadTotals).map(([squadId, units]) => {
      const squad = squads.find(s => s.id === squadId);
      const squadInitial = squad ? getSquadInitial(squad.name) : '?';
      return `${units}${squadInitial}`;
    }).join('\n');
  };

  const RiskCell = ({ state, r, c }: { state: SolverCellState, r: number, c: number }) => (
    <div className="w-full h-full relative rounded-md border border-black bg-white flex items-center justify-center p-1 gap-1.5 shadow-sm transition-all">
      <div className="absolute top-0.5 left-0.5 text-[10px] text-slate-400 font-mono font-bold leading-none select-none">{r * cols + c}</div>
      <div className={cn("w-2.5 h-2.5 rounded-full transition-all shrink-0", state.mu === 1 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse" : "bg-slate-50")} title="Fire Risk (μ)" />
      <div className={cn("w-2.5 h-2.5 rounded-full transition-all shrink-0", state.sigma === 1 ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]" : "bg-slate-50")} title="Smoke Risk (σ)" />
    </div>
  );

  const StatusCell = ({ state, r, c }: { state: SolverCellState, r: number, c: number }) => {
    return (
      <div className="w-full h-full relative rounded-md border border-black bg-white p-1 flex items-center justify-center shadow-sm">
        <div className="absolute top-0.5 left-0.5 text-[10px] text-slate-400 font-mono font-bold leading-none select-none">{r * cols + c}</div>
        <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5">
          <div className={cn("rounded-full transition-all w-2 h-2 justify-self-center self-center", state.k === 1 ? "bg-zinc-900 shadow-sm" : "bg-slate-50")} title="Burnt (K)" />
          <div className={cn("rounded-full transition-all w-2 h-2 justify-self-center self-center", state.f === 1 ? "bg-zinc-500 shadow-sm" : "bg-slate-50")} title="Smoked (F)" />
          <div className={cn("rounded-full transition-all w-2 h-2 justify-self-center self-center", state.phi === 1 ? "bg-blue-500 shadow-sm" : "bg-slate-50")} title="Suppressed (Φ)" />
          <div className={cn("rounded-full transition-all w-2 h-2 justify-self-center self-center", state.psi === 1 ? "bg-emerald-500 shadow-sm" : "bg-slate-50")} title="Rescued (Ψ)" />
        </div>
      </div>
    );
  };

  const MatrixGrid = ({ type }: { type: 'risk' | 'status' | 'alloc' }) => {
    return (
      <div 
        className="grid gap-1.5 min-w-max"
        style={{ gridTemplateColumns: `repeat(${cols}, 42px)` }}
      >
        {Array(rows).fill(0).map((_, r) => 
          Array(cols).fill(0).map((_, c) => {
            const state = currentStates[r]?.[c] || { mu: 0, k: 0, phi: 0, sigma: 0, f: 0, psi: 0 };
            if (type === 'risk') {
              return (
                <div key={`risk-${r}-${c}`} className="w-[42px] h-[42px]">
                  <RiskCell r={r} c={c} state={state} />
                </div>
              );
            } else if (type === 'status') {
              return (
                <div key={`status-${r}-${c}`} className="w-[42px] h-[42px]">
                  <StatusCell r={r} c={c} state={state} />
                </div>
              );
            } else {
              const label = getAllocationLabel(r, c);
              return (
                <div
                  key={`alloc-${r}-${c}`}
                  className={cn(
                    "relative w-[42px] h-[42px] rounded-md border border-black flex items-center justify-center text-[7px] leading-tight font-black shadow-sm transition-all text-center whitespace-pre overflow-hidden",
                    label ? "bg-orange-50 border-orange-300 text-orange-700 ring-2 ring-orange-100" : "bg-white"
                  )}
                >
                  <div className="absolute top-0.5 left-0.5 text-[10px] text-slate-400 font-mono font-bold leading-none select-none">{r * cols + c}</div>
                  {label}
                </div>
              );
            }
          })
        )}
      </div>
    );
  };

  const ExpandedViewer = ({ title, type, icon: Icon }: { title: string, type: 'risk' | 'status' | 'alloc', icon: any }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-orange-500 transition-colors">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-4 border-b bg-white">
          <DialogTitle className="flex items-center gap-2 text-lg font-headline font-bold">
            <Icon className="h-5 w-5 text-orange-500" />
            {title} (Floor {activeFloorNumber}, T={simulationTime})
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 relative overflow-hidden bg-slate-200/20">
          <ScrollArea className="w-full h-full">
            <div className="flex items-center justify-center min-h-full min-w-full p-12">
              <MatrixGrid type={type} />
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <section className="bg-slate-50 p-4 lg:p-8 border-t shadow-inner min-h-screen">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Metrics Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6 border border-slate-200">
          <div className="flex items-center gap-4">
             <div className="bg-orange-100 p-3 rounded-xl">
                <TrendingUp className="text-orange-600 h-6 w-6" />
             </div>
             <div>
               <h3 className="text-lg font-headline font-bold text-slate-800 tracking-tight">Strategy Analysis</h3>
               <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Model Portfolio Objective Summary</p>
             </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'O1: Total Vulnerable Population', val: optimizationResult.metrics.o1_peopleAtRisk, color: 'text-red-600', icon: Users },
              { label: 'O2: Total Lost Value', val: optimizationResult.metrics.o2_burntCells, color: 'text-zinc-800', icon: Flame },
              { label: 'O3: Total Deployment Cost', val: `$${optimizationResult.metrics.o3_totalCost}`, color: 'text-slate-900', icon: DollarSign },
            ].map((m, i) => (
              <div key={i} className="text-center px-4 border-r last:border-none">
                <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1 justify-center mb-1">
                  <m.icon className="h-2.5 w-2.5" /> {m.label}
                </p>
                <p className={cn("text-xl font-headline font-bold", m.color)}>{m.val}</p>
              </div>
            ))}
            <div className="flex items-center justify-center">
              <Button variant="ghost" size="icon" onClick={onReset} className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white py-3 px-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-3 w-3 text-orange-500" /> Simulation Timeline
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7 rounded-full border-slate-200"
                onClick={() => setSimulationTime(Math.max(0, simulationTime - 1))}
                disabled={simulationTime === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-4 py-1 bg-orange-50 rounded-lg border border-orange-100 text-xs font-headline font-bold text-orange-600 min-w-[60px] text-center shadow-inner">
                t = {simulationTime}
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7 rounded-full border-slate-200"
                onClick={() => setSimulationTime(Math.min(optimizationResult.tValue, simulationTime + 1))}
                disabled={simulationTime === optimizationResult.tValue}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Map className="h-3 w-3 text-blue-500" /> Vertical Elevation
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7 rounded-full border-slate-200"
                onClick={onNextFloor}
                disabled={activeFloorNumber === floorsCount}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="px-4 py-1 bg-blue-50 rounded-lg border border-blue-100 text-xs font-headline font-bold text-blue-600 min-w-[100px] text-center shadow-inner">
                Floor {activeFloorNumber}
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7 rounded-full border-slate-200"
                onClick={onPrevFloor}
                disabled={activeFloorNumber === 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Timestep Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {[
            { label: 'Fire Risk Cells', val: timestepMetrics.muCount, color: 'text-red-500' },
            { label: 'Smoke Risk Cells', val: timestepMetrics.sigmaCount, color: 'text-orange-500' },
            { label: 'Cells Burnt', val: timestepMetrics.kCount, color: 'text-zinc-900' },
            { label: 'Cells Smoked', val: timestepMetrics.fCount, color: 'text-zinc-600' },
            { label: 'Cells Saved', val: timestepMetrics.phiCount, color: 'text-blue-500' },
            { label: 'Cells Rescued', val: timestepMetrics.psiCount, color: 'text-emerald-500' },
            { label: 'Tactical Allocated', val: timestepMetrics.activeUnits, color: 'text-slate-900' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-center shadow-sm">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-tighter">{stat.label}</p>
              <p className={cn("text-base font-headline font-bold", stat.color)}>{stat.val}</p>
            </div>
          ))}
        </div>

        {/* Triple Matrix Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Risk Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between bg-slate-50/30">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Hazard Prediction
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded uppercase">Instantaneous</span>
                <ExpandedViewer title="Hazard Prediction" type="risk" icon={ShieldAlert} />
              </div>
            </div>
            <div className="p-4 flex-1">
               <ScrollArea className="w-full h-[320px]">
                 <div className="flex items-center justify-center min-h-full min-w-full p-2">
                   <MatrixGrid type="risk" />
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" />
               </ScrollArea>
            </div>
          </div>

          {/* Status Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between bg-slate-50/30">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Outcome Status
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase">Instantaneous</span>
                <ExpandedViewer title="Outcome Status" type="status" icon={CheckCircle2} />
              </div>
            </div>
             <div className="p-4 flex-1">
               <ScrollArea className="w-full h-[320px]">
                 <div className="flex items-center justify-center min-h-full min-w-full p-2">
                   <MatrixGrid type="status" />
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" />
               </ScrollArea>
            </div>
          </div>

          {/* Allocation Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between bg-slate-50/30">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-orange-500" /> Tactical Deployment
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded uppercase">Instantaneous</span>
                <ExpandedViewer title="Resource Deployment" type="alloc" icon={Users} />
              </div>
            </div>
             <div className="p-4 flex-1">
               <ScrollArea className="w-full h-[320px]">
                 <div className="flex items-center justify-center min-h-full min-w-full p-2">
                   <MatrixGrid type="alloc" />
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" />
               </ScrollArea>
            </div>
          </div>
        </div>

        {/* Legend Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-2">
               <ShieldAlert className="h-3 w-3" /> Hazard Logic
             </h5>
             <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-[9px] font-bold text-slate-600 uppercase">Fire (μ)</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                  <span className="text-[9px] font-bold text-slate-600 uppercase">Smoke (σ)</span>
                </div>
             </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-2">
               <CheckCircle2 className="h-3 w-3" /> Outcome Status
             </h5>
             <div className="grid grid-cols-2 gap-2">
                {[
                  { color: 'bg-zinc-900', label: 'K: Burnt' },
                  { color: 'bg-zinc-500', label: 'F: Smoked' },
                  { color: 'bg-blue-500', label: 'Φ: Suppressed' },
                  { color: 'bg-emerald-500', label: 'Ψ: Rescued' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className={cn("w-3 h-3 rounded-full", item.color)} />
                    <span className="text-[9px] font-bold text-slate-600 uppercase">{item.label}</span>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-2">
               <Users className="h-3 w-3" /> Squad Key
             </h5>
             <div className="grid grid-cols-2 gap-2 max-h-[100px] overflow-y-auto pr-2 scrollbar-thin">
                {squads.map(s => {
                  const initial = getSquadInitial(s.name);
                  return (
                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-orange-50/50 border border-orange-100">
                       <span className="text-[10px] font-black text-orange-600 w-4">{initial}</span>
                       <span className="text-[9px] font-bold text-slate-600 uppercase truncate">{s.name}</span>
                    </div>
                  )
                })}
             </div>
          </div>
        </div>
      </div>
    </section>
  );
}