"use client";

import { Bell, Search, Sun, Moon } from "lucide-react";
import { GlowInput } from "../ui/GlowInput";

export function TopNav() {
  return (
    <header className="fixed top-0 right-0 w-[calc(100%-280px)] h-16 bg-surface/40 backdrop-blur-[20px] border-b border-white/10 flex items-center justify-between px-8 z-40">
      <div className="w-full max-w-md">
        <GlowInput
          placeholder="Search knowledge graph or ask AI..."
          icon={<Search className="w-4 h-4" />}
          className="h-10 bg-surface/30 rounded-full"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
          <Moon className="w-5 h-5" />
        </button>
        
        <div className="w-px h-6 bg-white/10 mx-2"></div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-foreground">Dr. Aris</span>
            <span className="text-xs text-muted-foreground">Lead Researcher</span>
          </div>
          <div className="w-10 h-10 rounded-full border border-primary/30 overflow-hidden shadow-[0_0_15px_rgba(192,193,255,0.2)]">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOUGMDJ6qCRZjYEyz3UTTpLJMFJCHxh62pB8ZY9BFwguOM5ynLuFPOxP_DsoXJVSi5uOZNrxP0mBTH-FECu6qxtxYvTP-BJGZvC_JWH7-hr2Sri-qH0XysODmZwDgzL3kgygpderG7VwCvG9fs8_xDShaHpkD0kSkxxc1kx7dXeStdkfkaQaj1VYwTFpTEXEQjwZbCW9ZyOI-BKVdXiAep68fE_nMt4plDsY44OL0PgXdDtuD-zwntQHcG9e5JzXPARThJzG8YFVAS" 
              alt="User" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
