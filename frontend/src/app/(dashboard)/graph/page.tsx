"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { Network, Plus, Search, Filter, ZoomIn, ZoomOut, Maximize, MousePointer2 } from "lucide-react";
import { GlowInput } from "@/components/ui/GlowInput";
import { motion } from "framer-motion";

export default function GraphPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background relative selection:bg-primary/30 selection:text-primary">
      
      {/* Graph Canvas */}
      <div className="flex-1 relative bg-[#060a14] cursor-grab active:cursor-grabbing overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        
        {/* Glow behind graph */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(192,193,255,0.1)_0%,transparent_50%)] pointer-events-none"></div>

        {/* Floating Controls Overlay */}
        <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-none z-20">
          <div className="pointer-events-auto flex items-center gap-4">
            <h2 className="font-display text-2xl font-bold flex items-center gap-2">
              <Network className="w-6 h-6 text-primary" /> Global Knowledge Graph
            </h2>
            <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-mono font-bold">1,420 Nodes</div>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <div className="w-64">
              <GlowInput placeholder="Search nodes..." icon={<Search className="w-4 h-4" />} className="h-10 bg-surface/80 backdrop-blur-md" />
            </div>
            <AnimatedButton variant="outline" size="icon" className="h-10 w-10 bg-surface/80 backdrop-blur-md">
              <Filter className="w-4 h-4" />
            </AnimatedButton>
          </div>
        </div>

        <div className="absolute bottom-8 right-8 flex flex-col gap-2 pointer-events-auto z-20">
          <div className="glass p-1 rounded-xl flex flex-col gap-1">
            <button className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"><ZoomIn className="w-5 h-5" /></button>
            <div className="h-px bg-white/10 w-full"></div>
            <button className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"><ZoomOut className="w-5 h-5" /></button>
          </div>
          <div className="glass p-1 rounded-xl">
            <button className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"><Maximize className="w-5 h-5" /></button>
          </div>
        </div>

        {/* The Graph Simulation (Visual only for mockup) */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, type: "spring", bounce: 0.4 }}
        >
          {/* Central Cluster */}
          <div className="relative">
            {/* SVG Lines */}
            <svg className="absolute inset-0 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 overflow-visible" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.2))' }}>
              <line x1="400" y1="400" x2="600" y2="250" stroke="rgba(192,193,255,0.4)" strokeWidth="2" />
              <line x1="400" y1="400" x2="200" y2="300" stroke="rgba(192,193,255,0.4)" strokeWidth="2" />
              <line x1="400" y1="400" x2="450" y2="600" stroke="rgba(192,193,255,0.4)" strokeWidth="2" />
              <line x1="600" y1="250" x2="700" y2="150" stroke="rgba(76,215,246,0.3)" strokeWidth="1" />
              <line x1="600" y1="250" x2="650" y2="350" stroke="rgba(76,215,246,0.3)" strokeWidth="1" />
              <line x1="200" y1="300" x2="100" y2="200" stroke="rgba(221,183,255,0.3)" strokeWidth="1" />
              <line x1="200" y1="300" x2="150" y2="450" stroke="rgba(221,183,255,0.3)" strokeWidth="1" />
            </svg>

            {/* Nodes */}
            <motion.div 
              whileHover={{ scale: 1.1 }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center shadow-[0_0_40px_rgba(192,193,255,0.5)] cursor-pointer backdrop-blur-md"
            >
              <span className="text-sm font-bold text-primary">Neural Arch</span>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.1 }}
              className="absolute z-10 translate-x-[180px] -translate-y-[170px] w-16 h-16 rounded-full bg-accent/20 border border-accent flex items-center justify-center shadow-[0_0_20px_rgba(76,215,246,0.3)] cursor-pointer backdrop-blur-md"
            >
              <span className="text-xs font-bold text-accent">Transformers</span>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.1 }}
              className="absolute z-10 -translate-x-[220px] -translate-y-[120px] w-14 h-14 rounded-full bg-secondary/20 border border-secondary flex items-center justify-center shadow-[0_0_20px_rgba(221,183,255,0.3)] cursor-pointer backdrop-blur-md"
            >
              <span className="text-[10px] font-bold text-secondary">Optimization</span>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.1 }}
              className="absolute z-10 translate-x-[30px] translate-y-[180px] w-12 h-12 rounded-full bg-white/10 border border-white/30 flex items-center justify-center cursor-pointer backdrop-blur-md"
            >
              <span className="text-[10px] font-bold text-white/80">Pruning</span>
            </motion.div>
            
            {/* Expanded Node Mockup */}
            <div className="absolute z-30 translate-x-[220px] -translate-y-[280px] w-64 glass p-4 rounded-xl border-accent/40 shadow-2xl">
              <div className="flex items-center gap-2 mb-2 text-accent">
                <Network className="w-4 h-4" />
                <h4 className="font-bold text-sm">Transformers</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Self-attention mechanisms foundational to modern LLMs. Highly connected to "Optimization".</p>
              <div className="space-y-1">
                <div className="text-[10px] bg-white/5 px-2 py-1 rounded flex justify-between"><span>Incoming Edges</span> <span className="font-mono text-primary">24</span></div>
                <div className="text-[10px] bg-white/5 px-2 py-1 rounded flex justify-between"><span>Outgoing Edges</span> <span className="font-mono text-accent">12</span></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[350px] flex-shrink-0 border-l border-white/10 bg-surface/40 backdrop-blur-md hidden xl:flex flex-col z-30">
        <div className="p-6 border-b border-white/10">
          <h3 className="font-display font-bold text-lg mb-1">Graph Inspector</h3>
          <p className="text-sm text-muted-foreground">Select a node or edge to view details.</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
          <GlassCard glowColor="primary" hoverEffect={false}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-sm">Global Metrics</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider mb-1">Nodes</p>
                <p className="text-xl font-display font-bold">1,420</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider mb-1">Edges</p>
                <p className="text-xl font-display font-bold">8,341</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider mb-1">Density</p>
                <p className="text-xl font-display font-bold">0.004</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider mb-1">Clusters</p>
                <p className="text-xl font-display font-bold">12</p>
              </div>
            </div>
          </GlassCard>

          <div>
            <h4 className="font-bold text-sm mb-3">Dominant Clusters</h4>
            <div className="space-y-2">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-sm font-medium">Neural Architecture</span>
                </div>
                <span className="text-xs text-muted-foreground">42%</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent"></div>
                  <span className="text-sm font-medium">Quantum Computing</span>
                </div>
                <span className="text-xs text-muted-foreground">28%</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary"></div>
                  <span className="text-sm font-medium">Bio-Informatics</span>
                </div>
                <span className="text-xs text-muted-foreground">15%</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><MousePointer2 className="w-4 h-4 text-primary" /> Selection Mode</h4>
            <div className="grid grid-cols-2 gap-2">
              <button className="py-2 text-xs font-medium bg-primary/20 text-primary border border-primary/30 rounded-lg">Single Node</button>
              <button className="py-2 text-xs font-medium bg-surface hover:bg-white/10 border border-white/10 rounded-lg transition-colors">Cluster</button>
              <button className="py-2 text-xs font-medium bg-surface hover:bg-white/10 border border-white/10 rounded-lg transition-colors">Path Finder</button>
              <button className="py-2 text-xs font-medium bg-surface hover:bg-white/10 border border-white/10 rounded-lg transition-colors">Expand</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
