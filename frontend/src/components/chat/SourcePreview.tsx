'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Calendar, Clock } from 'lucide-react';
import { Citation } from '../../hooks/useChat';

interface SourcePreviewProps {
  citation: Citation | null;
  onClose: () => void;
}

export function SourcePreview({ citation, onClose }: SourcePreviewProps) {
  if (!citation) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 h-full w-80 md:w-96 bg-slate-900/95 border-l border-white/10 backdrop-blur-xl shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white text-sm truncate max-w-[200px]">
            Source Context
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {/* Source metadata details */}
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
          <div>
            <span className="text-xs text-slate-400 block mb-0.5">Document</span>
            <span className="text-sm font-medium text-slate-100 break-all">
              {citation.document_name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
            {citation.page_number && (
              <div>
                <span className="text-[10px] text-slate-400 block">Page / Slide</span>
                <span className="text-xs font-semibold text-slate-200">
                  {citation.page_number}
                </span>
              </div>
            )}
            {citation.timestamp && (
              <div>
                <span className="text-[10px] text-slate-400 block">Timestamp</span>
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-400 inline" />
                  {citation.timestamp}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Full Text Preview */}
        <div>
          <span className="text-xs text-slate-400 block mb-2 font-semibold uppercase tracking-wider">
            Context Content
          </span>
          <div className="p-4 bg-black/40 border border-white/5 rounded-xl text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-wrap select-text selection:bg-indigo-500/30">
            {citation.chunk_preview}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
