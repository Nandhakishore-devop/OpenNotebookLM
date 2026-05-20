"use client";

import { useState, useRef, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { 
  FileText, Search, Folder, Plus, Bot, ArrowUpRight, 
  Paperclip, Mic, Send, Network, Loader2, Sparkles, X, LayoutTemplate,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchDocuments, 
  uploadDocument, 
  deleteDocument,
  fetchNotebooks, 
  createNotebook, 
  deleteNotebook,
  queryNotebook, 
  Document, 
  Notebook 
} from "@/lib/api";

interface Message {
  id: string;
  sender: 'bot' | 'user';
  content: string;
  citations?: { id: number; source: string; snippet: string }[];
}

export default function WorkspacePage() {
  const queryClient = useQueryClient();
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>("");
  const [isTyping, setIsTyping] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notebook creation state
  const [showNewNotebookModal, setShowNewNotebookModal] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");

  // Pasted text source state
  const [showPasteTextModal, setShowPasteTextModal] = useState(false);
  const [pasteTextTitle, setPasteTextTitle] = useState("");
  const [pasteTextContent, setPasteTextContent] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      content: "Welcome to OpenNotebook! Please select or create a notebook, upload documents or submit website/YouTube URLs, and start querying your research corpus."
    }
  ]);

  const DEFAULT_WORKSPACE_ID = "92a3fcd6-ec3c-4467-b5bf-73c15320c29f";

  // Fetch Notebooks
  const { data: notebooks = [], isLoading: isLoadingNotebooks, refetch: refetchNotebooks } = useQuery({
    queryKey: ['notebooks', DEFAULT_WORKSPACE_ID],
    queryFn: () => fetchNotebooks(DEFAULT_WORKSPACE_ID),
  });

  // Auto-select first notebook
  useEffect(() => {
    if (notebooks.length > 0 && !selectedNotebookId) {
      setSelectedNotebookId(notebooks[0].id);
    }
  }, [notebooks, selectedNotebookId]);

  // Fetch Documents
  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['documents', selectedNotebookId],
    queryFn: () => selectedNotebookId ? fetchDocuments(selectedNotebookId) : Promise.resolve([]),
    enabled: !!selectedNotebookId,
    refetchInterval: (query) => {
      const docs = query.state.data as Document[] | undefined;
      const hasPendingOrProcessing = docs?.some(
        doc => doc.status === 'pending' || doc.status === 'processing'
      );
      return hasPendingOrProcessing ? 1500 : false;
    }
  });

  // Check if any document is currently in progress of parsing or chunking
  const hasInProgressDocuments = documents.some(
    (doc: Document) => doc.status === "pending" || doc.status === "processing"
  );

  // Upload Document
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(file, selectedNotebookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', selectedNotebookId] });
    },
    onError: (error) => {
      console.error("Upload failed", error);
      queryClient.invalidateQueries({ queryKey: ['documents', selectedNotebookId] });
    }
  });

  // Delete Document
  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', selectedNotebookId] });
    },
    onError: (error) => {
      console.error("Delete failed", error);
    }
  });

  // Delete Notebook
  const deleteNotebookMutation = useMutation({
    mutationFn: (notebookId: string) => deleteNotebook(notebookId),
    onSuccess: () => {
      refetchNotebooks().then((res) => {
        const updatedNotebooks = res.data || [];
        if (updatedNotebooks.length > 0) {
          setSelectedNotebookId(updatedNotebooks[0].id);
        } else {
          setSelectedNotebookId("");
        }
      });
    },
    onError: (error) => {
      console.error("Delete notebook failed", error);
    }
  });

  // Create Notebook
  const createNotebookMutation = useMutation({
    mutationFn: (name: string) => createNotebook(name, DEFAULT_WORKSPACE_ID),
    onSuccess: (newNotebook) => {
      refetchNotebooks().then(() => {
        setSelectedNotebookId(newNotebook.id);
      });
      setShowNewNotebookModal(false);
      setNewNotebookName("");
    },
    onError: (error) => {
      console.error("Failed to create notebook", error);
    }
  });

  const handleCreateNotebook = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNotebookName.trim()) {
      createNotebookMutation.mutate(newNotebookName.trim());
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !selectedNotebookId) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: text
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = 'auto';
    }

    setIsTyping(true);

    try {
      // Query the backend RAG pipeline
      const data = await queryNotebook(selectedNotebookId, text);
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        content: data.response,
        citations: data.citations && data.citations.length > 0 ? data.citations : undefined
      }]);
    } catch (err) {
      console.error("Query failed", err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        content: "Sorry, I encountered an error communicating with the research engine. Please try again."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedNotebookId) {
      uploadMutation.mutate(file);
    }
  };

  const handlePasteTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteTextContent.trim() || !selectedNotebookId) return;

    // Create a virtual text file from the pasted content
    const title = pasteTextTitle.trim() || `Pasted Content (${new Date().toLocaleDateString()})`;
    const file = new File([pasteTextContent], `${title}.txt`, { type: 'text/plain' });

    uploadMutation.mutate(file);

    // Reset state & close modal
    setPasteTextTitle("");
    setPasteTextContent("");
    setShowPasteTextModal(false);
  };

  useEffect(() => {
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

  const activeNotebook = notebooks.find(n => n.id === selectedNotebookId);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden w-full bg-background relative selection:bg-primary/30 selection:text-primary">
      
      {/* Left Pane: Document Explorer */}
      <div className="w-[300px] flex-shrink-0 border-r border-white/10 bg-surface/30 backdrop-blur-md flex flex-col hidden lg:flex">
        
        {/* Notebook Selector Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm">Notebooks</h3>
          <AnimatedButton 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-primary"
            onClick={() => setShowNewNotebookModal(true)}
          >
            <Plus className="w-4 h-4" />
          </AnimatedButton>
        </div>

        {/* Notebook List */}
        <div className="px-3 pt-3 max-h-40 overflow-y-auto no-scrollbar border-b border-white/5 pb-2">
          {isLoadingNotebooks ? (
            <div className="text-center text-xs text-muted-foreground py-2 animate-pulse">Loading notebooks...</div>
          ) : notebooks.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-2">No notebooks found.</div>
          ) : (
            <div className="space-y-1">
              {notebooks.map((notebook) => (
                <div
                  key={notebook.id}
                  onClick={() => {
                    setSelectedNotebookId(notebook.id);
                    setMessages([
                      {
                        id: 'welcome',
                        sender: 'bot',
                        content: `Switched to Notebook: ${notebook.title}. Ask anything about the active sources in this notebook.`
                      }
                    ]);
                  }}
                  className={cn(
                    "w-full text-left flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg transition-all cursor-pointer group",
                    selectedNotebookId === notebook.id 
                      ? "bg-primary/10 border-l-2 border-primary text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{notebook.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete the notebook "${notebook.title}"? This will delete all its sources and chat history.`)) {
                        deleteNotebookMutation.mutate(notebook.id);
                      }
                    }}
                    className="text-muted-foreground hover:text-red-400 p-1 rounded transition-all opacity-0 group-hover:opacity-100 hover:bg-white/5 flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents list */}
        <div className="p-4 flex-1 overflow-y-auto no-scrollbar space-y-6">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground mb-3 px-2 uppercase tracking-wider">Vectorized Sources</div>
            <div className="space-y-2">
              {isLoadingDocuments ? (
                <div className="text-center text-xs text-muted-foreground py-4">Loading sources...</div>
              ) : documents.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-4">No vectorized sources in this notebook.</div>
              ) : (
                documents.map((doc: Document) => (
                  <div key={doc.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-white/5 bg-black/10 hover:bg-white/5 cursor-pointer transition-all group">
                    <div className="flex items-start gap-3 overflow-hidden">
                      <FileText className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-muted-foreground truncate group-hover:text-foreground transition-colors">{doc.title || doc.file_name}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-white/10 text-muted-foreground uppercase">{doc.status}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">{doc.file_type}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete "${doc.title || doc.file_name}"?`)) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      className="text-muted-foreground hover:text-red-400 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-white/5 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
            disabled={!selectedNotebookId}
          />
          <div 
            onClick={() => selectedNotebookId && fileInputRef.current?.click()}
            className={cn(
              "border border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer transition-all",
              !selectedNotebookId && "opacity-50 cursor-not-allowed",
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
            <span className="text-xs text-muted-foreground block">
              {uploadMutation.isPending ? "Uploading..." : "Click to upload PDF, Word, Audio..."}
            </span>
          </div>

          <button
            onClick={() => selectedNotebookId && setShowPasteTextModal(true)}
            disabled={!selectedNotebookId}
            className={cn(
              "w-full mt-3 py-2.5 px-4 text-xs font-semibold rounded-xl border border-white/10 hover:border-primary/30 hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex items-center justify-center gap-2",
              !selectedNotebookId && "opacity-50 cursor-not-allowed"
            )}
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            Paste text content directly
          </button>
        </div>
      </div>

      {/* Center Pane: AI Chat */}
      <div className="flex-1 flex flex-col relative bg-gradient-to-b from-transparent to-surface/20 min-w-0">
        
        {/* Header Controls */}
        <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-20 pointer-events-none">
          <div className="pointer-events-auto bg-surface/50 border border-white/10 backdrop-blur-md rounded-lg px-3 py-1.5 text-xs text-muted-foreground font-mono">
            Active: <span className="text-primary font-bold">{activeNotebook?.title || "None selected"}</span>
          </div>
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
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "max-w-3xl mx-auto flex gap-4",
                msg.sender === 'user' && "flex-row-reverse"
              )}
            >
              {msg.sender === 'bot' ? (
                <div className="w-10 h-10 rounded-full flex-shrink-0 bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(192,193,255,0.2)]">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full flex-shrink-0 bg-secondary/20 border border-secondary/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-secondary">U</span>
                </div>
              )}

              {msg.sender === 'bot' ? (
                <GlassCard className="rounded-tl-none p-5 max-w-[85%] border-primary/20" hoverEffect={false}>
                  <div className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {msg.citations.map((cite) => (
                        <div key={cite.id} className="p-3 rounded-lg bg-black/20 border border-white/5 hover:border-primary/30 cursor-pointer transition-colors group">
                          <div className="text-[10px] font-mono text-primary mb-1">[{cite.id}] {cite.source}</div>
                          <p className="text-xs text-muted-foreground line-clamp-2 group-hover:text-foreground transition-colors">{cite.snippet}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              ) : (
                <div className="bg-surface-hover border border-white/10 rounded-2xl rounded-tr-none p-5 max-w-[85%]">
                  <p className="text-[15px] leading-relaxed text-foreground">
                    {msg.content}
                  </p>
                </div>
              )}
            </div>
          ))}

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
            <div className="glass rounded-[24px] p-2 flex items-end gap-2 border-white/20 shadow-2xl focus-within:border-primary/50 transition-colors bg-surface/80">
              <button 
                onClick={() => selectedNotebookId && fileInputRef.current?.click()}
                className="p-3 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5 mb-0.5"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={selectedNotebookId ? "Ask your research assistant..." : "Please select a notebook first..."}
                disabled={!selectedNotebookId}
                className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] resize-none py-3.5 max-h-[200px] outline-none text-foreground placeholder:text-muted-foreground no-scrollbar"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(inputValue);
                  }
                }}
              />

              <div className="flex gap-1 mb-0.5 pr-1">
                <AnimatedButton 
                  variant="primary" 
                  size="icon" 
                  className="w-10 h-10 rounded-[14px]"
                  disabled={!selectedNotebookId || !inputValue.trim()}
                  onClick={() => handleSendMessage(inputValue)}
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </AnimatedButton>
              </div>
            </div>
            <div className="text-center mt-2">
              <span className="text-[10px] text-muted-foreground font-mono">OpenNotebook Engine</span>
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
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(192,193,255,0.1)_0%,transparent_70%)]"></div>
              
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }} className="relative w-full h-full flex items-center justify-center">
                {/* Central Node */}
                <div className="absolute w-12 h-12 bg-primary/20 border border-primary rounded-full flex items-center justify-center z-20 shadow-[0_0_30px_rgba(192,193,255,0.4)]">
                  <span className="text-xs font-bold text-primary">Core</span>
                </div>

                {/* Satellite Nodes */}
                <div className="absolute w-8 h-8 bg-accent/20 border border-accent rounded-full flex items-center justify-center translate-x-20 -translate-y-20">
                  <span className="text-[10px] font-bold text-accent">Concept</span>
                </div>
                <div className="absolute w-6 h-6 bg-secondary/20 border border-secondary rounded-full flex items-center justify-center -translate-x-24 -translate-y-10">
                  <span className="text-[8px] font-bold text-secondary">Topic</span>
                </div>
                <div className="absolute w-10 h-10 bg-white/10 border border-white/30 rounded-full flex items-center justify-center translate-x-10 translate-y-24">
                  <span className="text-[10px] font-bold text-white/80">Entity</span>
                </div>

                {/* Connecting Lines (SVG) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' }}>
                  <line x1="50%" y1="50%" x2="calc(50% + 5rem)" y2="calc(50% - 5rem)" stroke="rgba(76,215,246,0.3)" strokeWidth="1" />
                  <line x1="50%" y1="50%" x2="calc(50% - 6rem)" y2="calc(50% - 2.5rem)" stroke="rgba(221,183,255,0.3)" strokeWidth="1" />
                  <line x1="50%" y1="50%" x2="calc(50% + 2.5rem)" y2="calc(50% + 6rem)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
                </svg>
              </motion.div>
            </div>

            <div className="h-1/3 border-t border-white/10 p-4 bg-surface-container overflow-y-auto no-scrollbar">
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-primary">
                <Sparkles className="w-3 h-3" /> Auto-Generated Summary
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {documents.length > 0 
                  ? `Knowledge base compiled across ${documents.length} sources. Semantic graph model is constructed and fully indexable.`
                  : "Upload research documents or input website links to see automatic summarization and concept associations here."
                }
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Notebook Modal */}
      <AnimatePresence>
        {showNewNotebookModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-surface-container border border-white/10 rounded-2xl p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowNewNotebookModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="font-display text-lg font-bold mb-4 text-foreground">Create New Notebook</h3>
              <form onSubmit={handleCreateNotebook} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Notebook Name</label>
                  <input
                    type="text"
                    value={newNotebookName}
                    onChange={(e) => setNewNotebookName(e.target.value)}
                    placeholder="E.g., Quantum Computing Notes"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <AnimatedButton 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowNewNotebookModal(false)}
                  >
                    Cancel
                  </AnimatedButton>
                  <AnimatedButton 
                    type="submit" 
                    variant="primary"
                    disabled={createNotebookMutation.isPending || !newNotebookName.trim()}
                  >
                    {createNotebookMutation.isPending ? "Creating..." : "Create"}
                  </AnimatedButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Paste Text Modal */}
      <AnimatePresence>
        {showPasteTextModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-surface-container border border-white/10 rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]"
            >
              <button 
                onClick={() => setShowPasteTextModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="font-display text-lg font-bold mb-4 text-foreground">Paste Text Source</h3>
              <form onSubmit={handlePasteTextSubmit} className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Source Title</label>
                  <input
                    type="text"
                    value={pasteTextTitle}
                    onChange={(e) => setPasteTextTitle(e.target.value)}
                    placeholder="E.g., Lakhs of lines transcripts"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex-1 flex flex-col overflow-hidden">
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Content</label>
                  <textarea
                    value={pasteTextContent}
                    onChange={(e) => setPasteTextContent(e.target.value)}
                    placeholder="Paste your content here... (Supports lakhs of lines)"
                    className="flex-1 min-h-[300px] w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none font-mono overflow-y-auto no-scrollbar"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <AnimatedButton 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowPasteTextModal(false)}
                  >
                    Cancel
                  </AnimatedButton>
                  <AnimatedButton 
                    type="submit" 
                    variant="primary"
                    disabled={uploadMutation.isPending || !pasteTextContent.trim()}
                  >
                    {uploadMutation.isPending ? "Ingesting..." : "Import Source"}
                  </AnimatedButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
