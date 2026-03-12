
import React from 'react';
import { 
  Users, 
  Settings2, 
  Plus, 
  Trash2, 
  GripVertical, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Activity,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Squad, AccessibilityType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SidebarConfigProps {
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;
  onStartResizing: (e: React.MouseEvent) => void;
  isResizing: boolean;
  squads: Squad[];
  onAddSquad: () => void;
  onUpdateSquad: (id: string, updates: Partial<Squad>) => void;
  onDeleteSquad: (id: string) => void;
  rows: number;
  setRows: (val: number) => void;
  cols: number;
  setCols: (val: number) => void;
  onResizeGrid: () => void;
  simulationSteps: number;
  setSimulationSteps: (val: number) => void;
  totalBudget: number;
  setTotalBudget: (val: number) => void;
}

export function SidebarConfig({
  sidebarWidth,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  onStartResizing,
  isResizing,
  squads,
  onAddSquad,
  onUpdateSquad,
  onDeleteSquad,
  rows,
  setRows,
  cols,
  setCols,
  onResizeGrid,
  simulationSteps,
  setSimulationSteps,
  totalBudget,
  setTotalBudget,
}: SidebarConfigProps) {
  return (
    <aside 
      style={{ width: isSidebarCollapsed ? '48px' : `${sidebarWidth}px` }}
      className="border-r bg-white overflow-hidden flex flex-col shadow-sm shrink-0 relative z-20 h-full transition-all duration-300"
    >
      <div className="absolute top-2 right-2 z-30">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-600 shadow-sm border"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!isSidebarCollapsed && (
        <Tabs defaultValue="squads" className="h-full overflow-hidden">
          <div className="px-3 pt-2 shrink-0 pr-10">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100">
              <TabsTrigger value="squads" className="font-medium text-xs">Squads</TabsTrigger>
              <TabsTrigger value="model" className="font-medium text-xs">Settings</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="squads" className="flex-1 flex flex-col overflow-hidden m-0 mt-0">
            <div className="p-2 px-3 flex justify-between items-center bg-white border-b shrink-0">
              <h3 className="text-[10px] uppercase tracking-wider font-headline font-bold text-slate-400 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-orange-500" /> Response Teams
              </h3>
              <Button variant="ghost" size="icon" onClick={onAddSquad} className="h-7 w-7 hover:bg-orange-50 text-orange-600">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="p-3 pb-20">
                <Accordion type="multiple" defaultValue={squads.length > 0 ? [squads[0].id] : []} className="space-y-3">
                  {squads.map(squad => (
                    <AccordionItem 
                      key={squad.id} 
                      value={squad.id} 
                      className="border rounded-lg bg-white shadow-sm overflow-hidden border-slate-200"
                    >
                      <div className="flex items-center px-3 hover:bg-slate-50/50 transition-colors">
                        <AccordionTrigger className="flex-1 hover:no-underline py-3">
                          <div className="flex items-center gap-3 text-left">
                            <div className="bg-orange-100 p-1.5 rounded-md">
                              <Shield className="h-3.5 w-3.5 text-orange-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">
                              {squad.name}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSquad(squad.id);
                          }} 
                          className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 ml-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <AccordionContent className="px-3 pb-4 pt-1 space-y-4 border-t bg-slate-50/30">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-400">Team Name</Label>
                          <Input 
                            value={squad.name} 
                            onFocus={e => e.target.select()}
                            onChange={e => onUpdateSquad(squad.id, { name: e.target.value })}
                            className="h-8 text-xs font-bold bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Suppression Rate</Label>
                            <Input 
                              type="number" 
                              min={0}
                              value={squad.suppressionRate} 
                              onFocus={e => e.target.select()}
                              onChange={e => onUpdateSquad(squad.id, { suppressionRate: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                              className="h-8 text-xs font-bold bg-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Rescue Rate</Label>
                            <Input 
                              type="number" 
                              min={0}
                              value={squad.rescueRate} 
                              onFocus={e => e.target.select()}
                              onChange={e => onUpdateSquad(squad.id, { rescueRate: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                              className="h-8 text-xs font-bold bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <DollarSign className="h-2.5 w-2.5" /> Deployment Cost
                            </Label>
                            <Input 
                              type="number" 
                              min={0}
                              value={squad.cost} 
                              onFocus={e => e.target.select()}
                              onChange={e => onUpdateSquad(squad.id, { cost: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                              className="h-8 text-xs font-bold bg-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Access Type</Label>
                            <select 
                              className="w-full text-xs p-2 h-8 rounded-md border border-slate-200 bg-white font-medium"
                              value={squad.accessibilityType}
                              onChange={e => onUpdateSquad(squad.id, { accessibilityType: Number(e.target.value) as AccessibilityType })}
                            >
                              <option value={0}>Land Only</option>
                              <option value={1}>Air Only</option>
                              <option value={2}>Dual (Both)</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> Number of Availability Schedule
                          </Label>
                          <div className="bg-white border rounded-md p-2 space-y-2 shadow-inner">
                            {Array.from({ length: simulationSteps }).map((_, t) => (
                              <div key={t} className="flex items-center justify-between gap-3">
                                <span className="text-[10px] font-bold text-slate-400 min-w-[20px]">T{t}</span>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-7 text-[10px] font-bold"
                                  value={squad.inventory[t] ?? 0}
                                  onFocus={e => e.target.select()}
                                  onChange={(e) => {
                                    const newInv = [...squad.inventory];
                                    newInv[t] = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    onUpdateSquad(squad.id, { inventory: newInv });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                {squads.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 opacity-50">
                    <Users className="h-10 w-10 text-slate-300" />
                    <p className="text-xs font-medium text-slate-500">No response squads defined</p>
                    <Button variant="outline" size="sm" onClick={onAddSquad} className="h-8 text-[10px] font-bold">
                      Add First Squad
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="model" className="flex-1 flex flex-col overflow-hidden m-0 mt-0">
            <div className="p-2 px-3 bg-white border-b shrink-0">
              <h3 className="text-[10px] uppercase tracking-wider font-headline font-bold text-slate-400 flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5 text-orange-500" /> Configuration
              </h3>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="p-3 space-y-6 pb-20">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-orange-500" /> Grid Geometry
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase">Rows</Label>
                      <Input 
                        type="number" 
                        min={1}
                        value={rows} 
                        onFocus={e => e.target.select()}
                        onChange={e => setRows(Math.max(1, parseInt(e.target.value, 10) || 1))} 
                        className="h-9 font-medium" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase">Cols</Label>
                      <Input 
                        type="number" 
                        min={1}
                        value={cols} 
                        onFocus={e => e.target.select()}
                        onChange={e => setCols(Math.max(1, parseInt(e.target.value, 10) || 1))} 
                        className="h-9 font-medium" 
                      />
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onResizeGrid} 
                    className="w-full h-9 text-xs font-bold border-orange-200 text-orange-600 hover:bg-orange-50"
                  >
                    Update Grid Size
                  </Button>
                </div>
                
                <Separator className="opacity-50" />
                
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-orange-500" /> Simulation
                  </h3>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Total Budget ($)</Label>
                    <Input 
                      type="number" 
                      min={0} 
                      value={totalBudget}
                      onFocus={e => e.target.select()}
                      onChange={e => setTotalBudget(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="h-9 font-bold" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Time Steps (T)</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      value={simulationSteps}
                      onFocus={e => e.target.select()}
                      onChange={e => setSimulationSteps(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="h-9 font-bold" 
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}

      {isSidebarCollapsed && (
        <div className="flex-1 flex flex-col items-center pt-14 gap-4">
          <Users className="h-5 w-5 text-slate-300" />
          <Settings2 className="h-5 w-5 text-slate-300" />
        </div>
      )}

      {!isSidebarCollapsed && (
        <div 
          className={cn(
            "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-orange-400 active:bg-orange-600 transition-colors flex items-center justify-center group",
            isResizing && "bg-orange-500"
          )}
          onMouseDown={onStartResizing}
        >
          <div className="hidden group-hover:flex items-center justify-center bg-white border border-slate-200 shadow-sm rounded-full w-4 h-8 -mr-1">
            <GripVertical className="h-3 w-3 text-slate-400" />
          </div>
        </div>
      )}
    </aside>
  );
}
