'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { ChatSession } from '../../hooks/useChat';

interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
}

export function SessionList({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession
}: SessionListProps) {
  return (
    <div className="flex flex-col h-full w-64 border-r border-white/10 bg-black/40 backdrop-blur-md p-4">
      {/* New Chat Button */}
      <button
        onClick={onCreateSession}
        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-white/10 hover:scale-[1.02] active:scale-[0.98] mb-6"
      >
        <Plus className="w-4 h-4" />
        New Chat
      </button>

      {/* History Label */}
      <div className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Conversations
      </div>

      {/* Sessions Scrollable Area */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
        <AnimatePresence initial={false}>
          {sessions.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8 px-4 border border-dashed border-white/5 rounded-xl">
              No sessions yet.
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`group relative flex items-center justify-between gap-2 p-3 rounded-xl cursor-pointer border transition-all duration-300 ${
                    isActive
                      ? 'bg-white/10 border-white/20 text-white shadow-inner shadow-white/5'
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-400'}`} />
                    <span className="text-sm truncate font-medium">
                      {session.title || 'New Chat'}
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
