'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowDown, Bot, User, Sparkles } from 'lucide-react';
import { Message, Citation } from '../../hooks/useChat';
import { CitationCard } from './CitationCard';

interface ChatBoxProps {
  messages: Message[];
  loading: boolean;
  onSendMessage: (content: string) => void;
  onCitationClick: (citation: Citation) => void;
}

export function ChatBox({
  messages,
  loading,
  onSendMessage,
  onCitationClick
}: ChatBoxProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Smooth scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Monitor scroll behavior to show/hide "Scroll to bottom" button
  const handleScroll = () => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const isFarUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBtn(isFarUp);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  // Helper to parse inline citation links (e.g. [1]) and format text
  const parseInline = (text: string, citations: Citation[] = []) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[\d+\])/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="px-1.5 py-0.5 rounded bg-white/10 text-violet-300 text-xs font-mono border border-white/5">
            {part.slice(1, -1)}
          </code>
        );
      }
      
      const citeMatch = part.match(/^\[(\d+)\]$/);
      if (citeMatch) {
        const citeNum = parseInt(citeMatch[1]);
        const citation = citations.find(c => c.id === citeNum);
        if (citation) {
          return (
            <button
              key={index}
              onClick={() => onCitationClick(citation)}
              className="inline-flex items-center justify-center align-top relative -top-1 px-1 h-3.5 min-w-3.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-[9px] font-bold text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition-colors mx-0.5 font-mono select-none"
              title={citation.document_name}
            >
              {citeNum}
            </button>
          );
        }
      }
      return part;
    });
  };

  // Custom Markdown parsing engine
  const renderMarkdown = (content: string, citations: Citation[] = []) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0];
        const hasLang = /^[a-zA-Z0-9+#-]+$/.test(firstLine);
        const language = hasLang ? firstLine : '';
        const code = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

        return (
          <div key={index} className="my-3 overflow-hidden rounded-xl border border-white/10 bg-black/50 font-mono text-[11px]">
            <div className="flex items-center justify-between bg-white/5 px-4 py-1.5 text-[9px] uppercase text-slate-400 font-semibold border-b border-white/5 select-none">
              <span>{language || 'code'}</span>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="hover:text-white transition-colors duration-200"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-slate-300 whitespace-pre"><code>{code}</code></pre>
          </div>
        );
      }

      return (
        <span key={index}>
          {part.split('\n').map((line, lIdx) => {
            if (line.startsWith('* ') || line.startsWith('- ')) {
              return (
                <span key={lIdx} className="block pl-4 relative my-1 text-slate-300">
                  <span className="absolute left-0.5 top-2 w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                  {parseInline(line.slice(2), citations)}
                </span>
              );
            }
            if (line.startsWith('### ')) {
              return <h4 key={lIdx} className="text-sm font-bold text-white mt-3 mb-1 block">{parseInline(line.slice(4), citations)}</h4>;
            }
            if (line.startsWith('## ')) {
              return <h3 key={lIdx} className="text-base font-bold text-white mt-4 mb-2 block">{parseInline(line.slice(3), citations)}</h3>;
            }
            if (line.startsWith('# ')) {
              return <h2 key={lIdx} className="text-lg font-bold text-white mt-5 mb-2 block">{parseInline(line.slice(2), citations)}</h2>;
            }
            if (line.trim() === '') {
              return <span key={lIdx} className="block h-2" />;
            }
            return <span key={lIdx} className="block my-1 text-slate-300 leading-relaxed">{parseInline(line, citations)}</span>;
          })}
        </span>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col relative h-full bg-black/10 select-none">
      {/* Scrollable Conversation History */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth select-text selection:bg-indigo-500/20 custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-lg mx-auto space-y-4">
            <div className="p-3 bg-violet-600/10 border border-violet-500/30 rounded-2xl animate-pulse">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Conversational Notebook Q&A
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Ask questions about your uploaded documents. OpenNotebook will retrieve relevant segments, consult its persistent memory, and provide inline-cited answers.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isAI = msg.role === 'assistant';
            const isUser = msg.role === 'user';
            
            return (
              <div
                key={msg.id}
                className={`flex gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-md ${
                    isUser
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-400 text-white shadow-indigo-900/20'
                      : 'bg-white/5 border-white/10 text-indigo-400 shadow-black/20'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Balloon */}
                <div className="space-y-2.5 min-w-0">
                  <div
                    className={`py-3 px-4 rounded-2xl border text-sm shadow-md transition-all duration-300 ${
                      isUser
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-slate-100 rounded-tr-none'
                        : 'bg-white/5 border-white/10 text-slate-300 rounded-tl-none'
                    }`}
                  >
                    {/* Render message contents or typing indicator */}
                    {!msg.content && loading ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      renderMarkdown(msg.content, msg.citations)
                    )}
                  </div>

                  {/* Message Citations Card Grid */}
                  {isAI && msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 pl-1">
                      {msg.citations.map((cite) => (
                        <CitationCard
                          key={cite.id}
                          citation={cite}
                          onClick={onCitationClick}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating scroll down shortcut */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 p-2.5 rounded-full bg-slate-900 border border-white/10 text-indigo-400 hover:text-white hover:border-indigo-400/50 shadow-xl transition-all duration-300 z-10 hover:scale-105 active:scale-95"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Prompt Form Input Area */}
      <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
        <form
          onSubmit={handleSend}
          className="max-w-3xl mx-auto flex gap-2 relative bg-white/5 border border-white/10 hover:border-white/15 focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.15)] rounded-2xl p-1.5 transition-all duration-300 backdrop-blur-md"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a research question or follow-up..."
            disabled={loading}
            className="flex-1 bg-transparent py-2.5 px-4 outline-none border-none text-sm text-white placeholder-slate-400 disabled:opacity-50 select-text"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 text-white disabled:text-slate-500 transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.2)] hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] disabled:shadow-none flex-shrink-0 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
