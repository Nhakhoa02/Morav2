
import React, { useState } from 'react';
import { Flame, Play, Zap, Info, Database, FileJson, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface AppHeaderProps {
  isSolving: boolean;
  onRunOptimizer: () => void;
  currentData: any;
  onLoadData: (data: any) => void;
}

export function AppHeader({ isSolving, onRunOptimizer, currentData, onLoadData }: AppHeaderProps) {
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCopySample = () => {
    const sample = JSON.stringify(currentData, null, 2);
    navigator.clipboard.writeText(sample);
    setIsCopied(true);
    setTimeout(() => setIsOfCopy(false), 2000);
    toast({ title: "Copied to Clipboard", description: "Solver-ready JSON structure is ready." });
  };

  const setIsOfCopy = (val: boolean) => setIsCopied(val);

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      onLoadData(parsed);
      setIsOpen(false);
      setJsonInput('');
      toast({ title: "Configuration Loaded", description: "Model state updated from Solver JSON." });
    } catch (e) {
      toast({ 
        title: "Invalid JSON", 
        description: "Please check your JSON format and try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <header className="brand-gradient p-4 text-white flex justify-between items-center shadow-lg z-30 shrink-0">
      <div className="flex items-center gap-3">
        <div className="bg-white p-2 rounded-xl shadow-inner">
          <Flame className="text-orange-600 h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-headline font-bold tracking-tight">PyrePlan</h1>
          <p className="text-xs opacity-80 font-medium">MILP Fire Response Optimization</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 border-none text-white font-medium">
              <Database className="h-4 w-4 mr-2" /> Input JSON
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-orange-500" />
                Solver Configuration
              </DialogTitle>
              <DialogDescription>
                Import/Export building maps and squad settings using the MILP solver JSON structure.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 space-y-4 overflow-hidden py-4 flex flex-col">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Solver JSON Schema</span>
                <Button variant="outline" size="sm" onClick={handleCopySample} className="h-7 text-[10px] font-bold">
                  {isCopied ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                  Copy Current as Sample
                </Button>
              </div>
              <Textarea 
                placeholder="Paste your solver-style JSON here..." 
                className="flex-1 font-mono text-[10px] min-h-[300px] resize-none bg-slate-50 border-slate-200"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleApplyJson}
                disabled={!jsonInput.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                Apply Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 border-none text-white font-medium">
                <Info className="h-4 w-4 mr-2" /> Docs
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Read model specifications and rules</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button 
          onClick={onRunOptimizer} 
          disabled={isSolving} 
          className="bg-white text-orange-600 hover:bg-slate-100 font-bold px-6 shadow-md border-none"
        >
          {isSolving ? <Zap className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          {isSolving ? 'Solving MILP...' : 'Run Optimization'}
        </Button>
      </div>
    </header>
  );
}
