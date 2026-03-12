
import React from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2, Layers, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Floor, GridLayer, CellData, OptimizationResult } from '@/lib/types';

interface GridEditorProps {
  activeFloor: Floor;
  activeFloorIndex: number;
  floorsCount: number;
  activeLayer: GridLayer;
  setActiveLayer: (layer: GridLayer) => void;
  brushValue: number;
  setBrushValue: (val: number) => void;
  onPrevFloor: () => void;
  onNextFloor: () => void;
  onAddFloor: () => void;
  onRemoveFloor: (index: number) => void;
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  onUpdateCell: (r: number, c: number) => void;
  getCellColor: (cell: CellData, r: number, c: number) => string;
  getCellLabel: (cell: CellData, r: number, c: number) => string | number | null;
  rows: number;
  cols: number;
  optimizationResult: OptimizationResult | null;
}

export function GridEditor({
  activeFloor,
  activeFloorIndex,
  floorsCount,
  activeLayer,
  setActiveLayer,
  brushValue,
  setBrushValue,
  onPrevFloor,
  onNextFloor,
  onAddFloor,
  onRemoveFloor,
  isDragging,
  setIsDragging,
  onUpdateCell,
  getCellColor,
  getCellLabel,
  cols,
  optimizationResult
}: GridEditorProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-2 px-3 flex justify-between items-center bg-white border-b shrink-0">
        <div className="flex items-center gap-2">
          {!optimizationResult ? (
            <div className="flex bg-slate-50 p-1 rounded-lg border">
              {['accessibility', 'fire', 'smoke', 'population', 'value', 'minSuppression'].map(layer => (
                <Button
                  key={layer}
                  variant={activeLayer === layer ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveLayer(layer as GridLayer)}
                  className={`text-[9px] px-2 h-6 font-bold uppercase tracking-tight transition-all ${activeLayer === layer ? 'bg-white text-orange-600 shadow-sm border border-orange-100' : 'text-slate-400 hover:text-orange-400'}`}
                >
                  {layer}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-lg border border-orange-100">
               <PlayCircle className="h-3.5 w-3.5 text-orange-600" />
               <span className="text-[10px] font-bold text-orange-700 uppercase tracking-tight">Solver Visualization Active</span>
            </div>
          )}
          
          <div className="h-6 w-px bg-slate-200 mx-1" />
          
          {!optimizationResult && (
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border">
               <Label className="text-[9px] px-2 font-bold text-slate-400 uppercase">Brush</Label>
               <Input 
                type="number" 
                min={activeLayer === 'accessibility' ? -1 : 0}
                max={activeLayer === 'accessibility' ? 2 : undefined}
                value={brushValue} 
                onFocus={e => e.target.select()}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '') {
                    setBrushValue(0);
                  } else {
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) {
                      let finalNum = num;
                      if (activeLayer === 'accessibility') {
                        finalNum = Math.max(-1, Math.min(2, num));
                      } else {
                        finalNum = Math.max(0, num);
                      }
                      setBrushValue(finalNum);
                    }
                  }
                }}
                className="h-6 w-16 text-xs font-bold border-none bg-transparent focus-visible:ring-0"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={onNextFloor}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <div className="px-2 text-[10px] font-headline font-bold min-w-[50px] text-center text-slate-700">
              Floor {activeFloor.floorNumber}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={onPrevFloor}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
          {!optimizationResult && (
            <>
              <Button variant="outline" size="sm" onClick={onAddFloor} className="h-7 text-[10px] font-bold border-slate-200">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
              {floorsCount > 1 && (
                <Button variant="outline" size="sm" onClick={() => onRemoveFloor(activeFloorIndex)} className="h-7 text-[10px] font-bold border-slate-200 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-200/30 p-8 scrollbar-thin">
        <div className="min-h-full min-w-full flex">
          <div className="relative p-10 bg-white rounded-xl shadow-xl border m-auto">
            <div 
              className="grid gap-2"
              style={{ 
                gridTemplateColumns: `repeat(${cols}, 48px)`,
                userSelect: 'none'
              }}
              onMouseLeave={() => setIsDragging(false)}
            >
              {activeFloor.grid.map((row, r) => (
                row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    onMouseDown={() => {
                      if (!optimizationResult) {
                        setIsDragging(true);
                        onUpdateCell(r, c);
                      }
                    }}
                    onMouseEnter={() => {
                      if (isDragging && !optimizationResult) onUpdateCell(r, c);
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    className={`
                      w-12 h-12 rounded-lg border flex items-center justify-center text-[10px] font-bold transition-all duration-200
                      ${getCellColor(cell, r, c)}
                      ${optimizationResult ? 'cursor-default' : 'cursor-crosshair hover:scale-105 hover:z-10 hover:shadow-lg'}
                    `}
                  >
                    {getCellLabel(cell, r, c)}
                  </div>
                ))
              ))}
            </div>
            
            {!optimizationResult && (
              <div className="absolute top-3 left-3 bg-orange-50/90 backdrop-blur-sm border border-orange-100 px-2 py-0.5 rounded-md flex items-center gap-1.5 pointer-events-none">
                <Layers className="text-orange-500 h-2.5 w-2.5" />
                <span className="text-[8px] font-bold text-orange-700 uppercase tracking-widest">{activeLayer}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
