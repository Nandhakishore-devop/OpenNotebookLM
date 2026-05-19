"use client";

import { useState, useRef, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { 
  FileText, Search, Folder, Plus, Bot, ArrowUpRight, 
  Paperclip, Mic, Send, Network, Loader2, Sparkles, X, LayoutTemplate
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDocuments, uploadDocument, Document } from "@/lib/api";

export default function WorkspacePage() {
  const queryClient = useQueryClient();
  const [isTyping, setIsTyping] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For demo purposes, we will use a hardcoded default workspace_id, but usually this comes from router/props.
  const DEFAULT_WORKSPACE_ID = "default_workspace_id";

  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['documents'],
    queryFn: () => fetchDocuments(),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(file, DEFAULT_WORKSPACE_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error) => {
      console.error("Upload failed", error);
      // Fallback: invalidate anyway so we get any server updates
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  useEffect(() => {
    // Auto-resize textarea
    const handleInput = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    };
    
    const ta = textareaRef.current;
    if (ta) ta.addEventListener('input', handleInput);
    return () => { if (ta) ta.removeEventListener('input', handleInput); };
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden w-full bg-background relative selection:bg-primary/30 selection:text-primary">
      
      {/* Left Pane: Document Explorer */}
      <div className="w-[300px] flex-shrink-0 border-r border-white/10 bg-surface/30 backdrop-blur-md flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-display font-semibold">Active Sources</h3>
          <AnimatedButton variant="ghost" size="icon" className="h-8 w-8 text-primary">
            <Plus className="w-4 h-4" />
          </AnimatedButton>
        </div>

        <div className="p-4 flex-1 overflow-y-auto no-scrollbar space-y-6">
          {/* Folders */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors rounded-lg hover:bg-white/5">
              <Folder className="w-4 h-4" /> Quantum Mechanics
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors rounded-lg hover:bg-white/5">
              <Folder className="w-4 h-4" /> Lab Notes 2024
            </div>
          </div>

          {/* Files */}
          <div>
            <div className="text-xs font-mono text-muted-foreground mb-3 px-2 uppercase tracking-wider">Vectorized Documents</div>
            <div className="space-y-2">
              {isLoadingDocuments ? (
                <div className="text-center text-xs text-muted-foreground py-4">Loading...</div>
              ) : documents.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-4">No documents yet.</div>
              ) : (
                documents.map((doc: Document) => (
                  <div key={doc.id} className="flex items-start gap-3 p-3 rounded-xl border border-transparent hover:bg-white/5 cursor-pointer transition-all group">
                    <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-muted-foreground truncate group-hover:text-foreground transition-colors">{doc.file_name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-white/10 text-muted-foreground uppercase">{doc.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="p-4 border-t border-white/10">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer transition-all",
              uploadMutation.isPending ? "border-primary/50 bg-primary/10" : "hover:border-primary/50 hover:bg-primary/5"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-surface border border-white/10 flex items-center justify-center mx-auto mb-2">
              {uploadMutation.isPending ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <Plus className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {uploadMutation.isPending ? "Uploading..." : "Drop files or click to add"}
            </span>
          </div>
        </div>
      </div>

      {/* Center Pane: AI Chat */}
      <div className="flex-1 flex flex-col relative bg-gradient-to-b from-transparent to-surface/20 min-w-0">
        
        {/* Header Controls */}
        <div className="absolute top-0 inset-x-0 p-4 flex justify-end z-20 pointer-events-none">
          <div className="pointer-events-auto flex gap-2">
            <AnimatedButton 
              variant="outline" 
              size="sm" 
              className={cn("h-8 bg-surface backdrop-blur-md", showGraph && "border-primary text-primary")}
              onClick={() => setShowGraph(!showGraph)}
            >
              <Network className="w-4 h-4 mr-2" />
              Graph View
            </AnimatedButton>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 pt-16 pb-40 space-y-8 scroll-smooth">
          
          <div className="max-w-3xl mx-auto flex gap-4">
            <div className="w-10 h-10 rounded-full flex-shrink-0 bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(192,193,255,0.2)]">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <GlassCard className="rounded-tl-none p-5 max-w-[85%] border-primary/20" hoverEffect={false}>
              <p className="text-[15px] leading-relaxed text-foreground/90">
                I've fully ingested the <span className="text-primary font-medium">Schrödinger Wave</span> documents. 
                The vectors have been mapped and the knowledge graph is ready. 
                <br/><br/>
                I notice a significant contradiction between Chapter 4 and your Lab Notes regarding the measurement problem. How would you like to explore this?
              </p>
            </GlassCard>
          </div>

          <div className="max-w-3xl mx-auto flex gap-4 flex-row-reverse">
            <div className="w-10 h-10 rounded-full flex-shrink-0 border border-white/10 overflow-hidden">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOUGMDJ6qCRZjYEyz3UTTpLJMFJCHxh62pB8ZY9BFwguOM5ynLuFPOxP_DsoXJVSi5uOZNrxP0mBTH-FECu6qxtxYvTP-BJGZvC_JWH7-hr2Sri-qH0XysODmZwDgzL3kgygpderG7VwCvG9fs8_xDShaHpkD0kSkxxc1kx7dXeStdkfkaQaj1VYwTFpTEXEQjwZbCW9ZyOI-BKVdXiAep68fE_nMt4plDsY44OL0PgXdDtuD-zwntQHcG9e5JzXPARThJzG8YFVAS" alt="User" />
            </div>
            <div className="bg-surface-hover border border-white/10 rounded-2xl rounded-tr-none p-5 max-w-[85%]">
              <p className="text-[15px] leading-relaxed text-foreground">
                Summarize the contradiction specifically focusing on the collapse mechanisms proposed. Include citations.
              </p>
            </div>
          </div>

          <div className="max-w-3xl mx-auto flex gap-4">
            <div className="w-10 h-10 rounded-full flex-shrink-0 bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(192,193,255,0.2)]">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <GlassCard className="rounded-tl-none p-5 max-w-[85%] border-primary/20" hoverEffect={false}>
              <p className="text-[15px] leading-relaxed text-foreground/90 mb-4">
                Based on the sources, the core contradiction lies in whether the wave collapse is a physical mechanism or an epistemological update:
                <br/><br/>
                1. <span className="text-foreground font-medium">Chapter 4 (Source)</span> argues for objective collapse models, suggesting a physical threshold based on mass-energy density 
                <span className="inline-flex items-center justify-center bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded ml-1 cursor-pointer hover:bg-primary hover:text-[#0b1326] transition-colors">[1]</span>.
                <br/><br/>
                2. <span className="text-foreground font-medium">Your Lab Notes</span> lean heavily towards the Copenhagen interpretation, treating the collapse entirely as an update in the observer's knowledge 
                <span className="inline-flex items-center justify-center bg-accent/20 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded ml-1 cursor-pointer hover:bg-accent hover:text-[#0b1326] transition-colors">[2]</span>.
              </p>
              
              {/* Citations block */}
              <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-black/20 border border-white/5 hover:border-primary/30 cursor-pointer transition-colors group">
                  <div className="text-[10px] font-mono text-primary mb-1">[1] Schrodinger_Wave.pdf</div>
                  <p className="text-xs text-muted-foreground line-clamp-2 group-hover:text-foreground transition-colors">"...the state vector undergoes a physical reduction governed by non-linear stochastic processes..."</p>
                </div>
                <div className="p-3 rounded-lg bg-black/20 border border-white/5 hover:border-accent/30 cursor-pointer transition-colors group">
                  <div className="text-[10px] font-mono text-accent mb-1">[2] Lab Notes 2024</div>
                  <p className="text-xs text-muted-foreground line-clamp-2 group-hover:text-foreground transition-colors">"...if we treat ψ purely as probability, the measurement problem disappears into epistemology."</p>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Typing Indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-3xl mx-auto flex gap-4"
              >
                <div className="w-10 h-10 rounded-full flex-shrink-0 bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="glass rounded-2xl rounded-tl-none py-4 px-6 flex items-center gap-2">
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity }} className="w-2 h-2 rounded-full bg-primary/60" />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, delay: 0.2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-primary/60" />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, delay: 0.4, repeat: Infinity }} className="w-2 h-2 rounded-full bg-primary/60" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 inset-x-0 p-4 md:p-8 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute -top-12 left-0 flex gap-2 overflow-x-auto no-scrollbar w-full pb-2 mask-linear-fade">
              <button className="whitespace-nowrap px-4 py-1.5 rounded-full bg-surface border border-white/5 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                Explain the stochastic processes
              </button>
              <button className="whitespace-nowrap px-4 py-1.5 rounded-full bg-surface border border-white/5 text-xs text-muted-foreground hover:text-accent hover:border-accent/30 transition-all">
                Contrast with Many-Worlds
              </button>
            </div>

            <div className="glass rounded-[24px] p-2 flex items-end gap-2 border-white/20 shadow-2xl focus-within:border-primary/50 transition-colors bg-surface/80">
              <button className="p-3 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5 mb-0.5">
                <Paperclip className="w-5 h-5" />
              </button>
              
              <textarea
                ref={textareaRef}
                placeholder="Ask your AI research assistant..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] resize-none py-3.5 max-h-[200px] outline-none text-foreground placeholder:text-muted-foreground no-scrollbar"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setIsTyping(true);
                    setTimeout(() => setIsTyping(false), 3000);
                  }
                }}
              />

              <div className="flex gap-1 mb-0.5 pr-1">
                <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5 hidden sm:block">
                  <Mic className="w-5 h-5" />
                </button>
                <AnimatedButton variant="primary" size="icon" className="w-10 h-10 rounded-[14px]">
                  <Send className="w-4 h-4 ml-0.5" />
                </AnimatedButton>
              </div>
            </div>
            <div className="text-center mt-2">
              <span className="text-[10px] text-muted-foreground font-mono">OpenNotebook OS - GPT-4o Enhanced Mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Graph / Details Panel */}
      <AnimatePresence>
        {showGraph && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 350, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 border-l border-white/10 bg-surface/30 backdrop-blur-md hidden xl:flex flex-col relative"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" /> Semantic Graph
              </h3>
              <button onClick={() => setShowGraph(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 relative overflow-hidden bg-[#060a14] flex items-center justify-center group cursor-pointer">
              {/* Fake Interactive Graph */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(192,193,255,0.1)_0%,transparent_70%)]"></div>
              
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }} className="relative w-full h-full flex items-center justify-center">
                {/* Central Node */}
                <div className="absolute w-12 h-12 bg-primary/20 border border-primary rounded-full flex items-center justify-center z-20 shadow-[0_0_30px_rgba(192,193,255,0.4)]">
                  <span className="text-xs font-bold text-primary">Wave</span>
                </div>

                {/* Satellite Nodes */}
                <div className="absolute w-8 h-8 bg-accent/20 border border-accent rounded-full flex items-center justify-center translate-x-20 -translate-y-20">
                  <span className="text-[10px] font-bold text-accent">Collapse</span>
                </div>
                <div className="absolute w-6 h-6 bg-secondary/20 border border-secondary rounded-full flex items-center justify-center -translate-x-24 -translate-y-10">
                  <span className="text-[8px] font-bold text-secondary">Bohr</span>
                </div>
                <div className="absolute w-10 h-10 bg-white/10 border border-white/30 rounded-full flex items-center justify-center translate-x-10 translate-y-24">
                  <span className="text-[10px] font-bold text-white/80">Objective</span>
                </div>

                {/* Connecting Lines (SVG) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' }}>
                  <line x1="50%" y1="50%" x2="calc(50% + 5rem)" y2="calc(50% - 5rem)" stroke="rgba(76,215,246,0.3)" strokeWidth="1" />
                  <line x1="50%" y1="50%" x2="calc(50% - 6rem)" y2="calc(50% - 2.5rem)" stroke="rgba(221,183,255,0.3)" strokeWidth="1" />
                  <line x1="50%" y1="50%" x2="calc(50% + 2.5rem)" y2="calc(50% + 6rem)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
                </svg>
              </motion.div>

              <div className="absolute bottom-4 inset-x-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs font-mono bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur">Click to expand graph</span>
              </div>
            </div>

            <div className="h-1/3 border-t border-white/10 p-4 bg-surface-container overflow-y-auto no-scrollbar">
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-primary">
                <Sparkles className="w-3 h-3" /> Auto-Generated Summary
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                The nodes indicate a strong semantic cluster around the measurement problem, drawing primarily from 14 citations across 3 documents. The "Objective" node represents the highest divergence from the central consensus.
              </p>
              <AnimatedButton variant="outline" size="sm" className="w-full text-xs">
                Export Analysis
              </AnimatedButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
