'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { BookOpen, FolderOpen, Loader2, Sparkles, MessageCircle } from 'lucide-react';

import { fetchNotebooks, Notebook } from '@/lib/api';
import { useChat, Citation } from '@/hooks/useChat';
import { SessionList } from '@/components/chat/SessionList';
import { ChatBox } from '@/components/chat/ChatBox';
import { SourcePreview } from '@/components/chat/SourcePreview';

const DEFAULT_WORKSPACE_ID = "92a3fcd6-ec3c-4467-b5bf-73c15320c29f";

export default function ChatPage() {
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  // 1. Fetch Notebooks using react-query
  const { data: notebooks = [], isLoading: isLoadingNotebooks } = useQuery({
    queryKey: ['notebooks', DEFAULT_WORKSPACE_ID],
    queryFn: () => fetchNotebooks(DEFAULT_WORKSPACE_ID),
  });

  // Auto-select first notebook when loaded
  useEffect(() => {
    if (notebooks.length > 0 && !selectedNotebookId) {
      setSelectedNotebookId(notebooks[0].id);
    }
  }, [notebooks, selectedNotebookId]);

  // 2. Initialize our streaming chat hook
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    messages,
    loading,
    error,
    createSession,
    deleteSession,
    sendMessage
  } = useChat(selectedNotebookId || null);

  // Handle citation clicks (open inspector)
  const handleCitationClick = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  const activeNotebook = notebooks.find(n => n.id === selectedNotebookId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden w-full bg-slate-950 text-slate-100 select-none">
      
      {/* 1. Header Bar: Notebook context picker */}
      <div className="h-14 border-b border-white/10 bg-slate-900/40 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h1 className="font-semibold tracking-wide text-sm md:text-base hidden sm:inline-block">
            Research Chat
          </h1>
          <span className="text-white/20 hidden sm:inline">|</span>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-400" />
            <select
              value={selectedNotebookId}
              onChange={(e) => {
                setSelectedNotebookId(e.target.value);
                setSelectedCitation(null);
              }}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs rounded-lg py-1 px-2.5 outline-none cursor-pointer font-medium transition-colors"
            >
              {isLoadingNotebooks ? (
                <option value="">Loading notebooks...</option>
              ) : notebooks.length === 0 ? (
                <option value="">No notebooks active</option>
              ) : (
                notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id} className="bg-slate-900 text-slate-200">
                    {nb.title || nb.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-semibold uppercase tracking-wider animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin inline-block" />
              Retrieving
            </div>
          )}
        </div>
      </div>

      {/* 2. Main content split area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Side: Sessions List history */}
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onCreateSession={createSession}
          onDeleteSession={deleteSession}
        />

        {/* Center: Conversation Window */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {error && (
            <div className="p-3 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 text-center font-medium select-text">
              {error}
            </div>
          )}

          <ChatBox
            messages={messages}
            loading={loading}
            onSendMessage={sendMessage}
            onCitationClick={handleCitationClick}
          />
        </div>

        {/* Right Side: Source Preview Drawer */}
        <AnimatePresence>
          {selectedCitation && (
            <SourcePreview
              citation={selectedCitation}
              onClose={() => setSelectedCitation(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
