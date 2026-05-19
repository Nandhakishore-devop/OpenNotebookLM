"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { Mic, Play, Pause, FastForward, Rewind, Settings2, Download, Share2, Plus, Volume2, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function PodcastPage() {
  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-display text-3xl font-bold mb-2">Podcast Studio</h2>
          <p className="text-muted-foreground">Transform your research papers into cinematic audio experiences.</p>
        </div>
        <AnimatedButton variant="primary">
          <Plus className="w-4 h-4 mr-2" />
          New Generation
        </AnimatedButton>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
        
        {/* Main Editor Area */}
        <GlassCard className="lg:col-span-2 flex flex-col p-0 overflow-hidden relative">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-surface-hover">
            <div>
              <h3 className="font-display font-bold text-xl">The Evolution of Neural Search</h3>
              <p className="text-sm text-primary font-mono mt-1">Generated from 12 Sources • 45m duration</p>
            </div>
            <div className="flex gap-2">
              <AnimatedButton variant="outline" size="icon"><Share2 className="w-4 h-4" /></AnimatedButton>
              <AnimatedButton variant="outline" size="icon"><Download className="w-4 h-4" /></AnimatedButton>
            </div>
          </div>

          {/* Cinematic Waveform Display */}
          <div className="flex-1 bg-[#060a14] relative flex items-center justify-center border-b border-white/10 p-8 overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(192,193,255,0.15)_0%,transparent_70%)] opacity-50"></div>
            
            {/* Playback Controls Overlay */}
            <div className="absolute bottom-8 flex items-center gap-6 z-20 bg-surface/80 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="text-muted-foreground hover:text-white transition-colors"><Rewind className="w-6 h-6" /></button>
              <button className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(192,193,255,0.4)]">
                <Play className="w-6 h-6 ml-1" />
              </button>
              <button className="text-muted-foreground hover:text-white transition-colors"><FastForward className="w-6 h-6" /></button>
            </div>

            {/* Fake Waveform generated with motion */}
            <div className="flex items-center gap-1 h-32 w-full max-w-2xl z-10 relative">
              {Array.from({ length: 60 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ height: "10%" }}
                  animate={{ height: `${Math.random() * 80 + 20}%` }}
                  transition={{
                    duration: 0.5 + Math.random() * 0.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut"
                  }}
                  className="w-1.5 bg-primary/80 rounded-full"
                />
              ))}
              {/* Playhead */}
              <div className="absolute left-1/3 top-0 bottom-0 w-0.5 bg-accent shadow-[0_0_10px_rgba(76,215,246,1)] z-20"></div>
            </div>
          </div>

          {/* Script Editor */}
          <div className="h-1/3 bg-surface p-6 overflow-y-auto no-scrollbar">
            <h4 className="font-bold mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Generated Script</h4>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary font-bold">V1</div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground mb-1">Host (Alex)</p>
                  <p className="text-foreground leading-relaxed">Welcome back to another deep dive. Today we're exploring the fascinating shift in how models retrieve information. We've got 12 different papers lined up that all point to one major paradigm shift.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 text-secondary font-bold">V2</div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground mb-1">Expert (Dr. Smith)</p>
                  <p className="text-foreground leading-relaxed">Exactly. If you look at the Zoph paper from 2017, the foundational architecture was rigid. But the recent jump to dynamic vector spaces changes everything about latency.</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Sidebar Controls */}
        <div className="space-y-6 overflow-y-auto no-scrollbar pb-8">
          <GlassCard>
            <h3 className="font-bold mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4" /> Voice Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Primary Host Voice</label>
                <div className="p-3 border border-primary/30 rounded-xl bg-primary/5 flex justify-between items-center cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"><Volume2 className="w-4 h-4 text-primary" /></div>
                    <span className="font-medium text-sm">Alex (Deep, Professional)</span>
                  </div>
                  <span className="text-xs text-primary">Change</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Guest Expert Voice</label>
                <div className="p-3 border border-white/10 rounded-xl bg-white/5 flex justify-between items-center cursor-pointer hover:border-white/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center"><Volume2 className="w-4 h-4 text-secondary" /></div>
                    <span className="font-medium text-sm">Sarah (Articulate, Warm)</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Change</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="font-bold mb-4">Previous Episodes</h3>
            <div className="space-y-3">
              <div className="p-3 border border-white/5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
                <p className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">Quantum Supremacy Breakdown</p>
                <p className="text-xs text-muted-foreground">Generated Oct 12 • 28 mins</p>
              </div>
              <div className="p-3 border border-white/5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
                <p className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">History of Transformer Models</p>
                <p className="text-xs text-muted-foreground">Generated Sep 28 • 1h 12m</p>
              </div>
              <div className="p-3 border border-white/5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
                <p className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">Climate Dynamics v4</p>
                <p className="text-xs text-muted-foreground">Generated Sep 15 • 42 mins</p>
              </div>
            </div>
            <AnimatedButton variant="ghost" className="w-full mt-4 text-xs">View All Episodes</AnimatedButton>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
