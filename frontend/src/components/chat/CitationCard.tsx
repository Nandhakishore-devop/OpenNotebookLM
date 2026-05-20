'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import { Citation } from '../../hooks/useChat';

interface CitationCardProps {
  citation: Citation;
  onClick: (citation: Citation) => void;
}

export function CitationCard({ citation, onClick }: CitationCardProps) {
  const sourceLabel = citation.document_name + 
    (citation.page_number ? ` (Page ${citation.page_number})` : '') +
    (citation.timestamp ? ` (Time ${citation.timestamp})` : '');

  return (
    <button
      onClick={() => onClick(citation)}
      className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-300 transition-all duration-300 select-none text-left cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
    >
      <BookOpen className="w-3 h-3 text-indigo-400" />
      <span className="font-semibold text-[10px] text-indigo-300 mr-0.5">[{citation.id}]</span>
      <span className="truncate max-w-[120px] font-medium">{citation.document_name}</span>
    </button>
  );
}
