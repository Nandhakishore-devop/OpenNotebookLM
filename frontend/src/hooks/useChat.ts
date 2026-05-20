import { useState, useEffect, useCallback } from 'react';
import { consumeStream, StreamEvent } from '../lib/streaming';

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:8000/api/v1`;
  }
  return 'http://localhost:8000/api/v1';
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || getApiBaseUrl();

export interface Citation {
  id: number;
  document_name: string;
  page_number?: number;
  timestamp?: string;
  chunk_preview: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  created_at?: string;
}

export interface ChatSession {
  id: string;
  notebook_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useChat(notebookId: string | null) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load chat sessions for the active notebook
  const loadSessions = useCallback(async () => {
    if (!notebookId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/chat/notebook/${notebookId}/sessions`);
      if (!res.ok) throw new Error("Failed to load chat history");
      const data = await res.json();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load chat session list");
    }
  }, [notebookId, activeSessionId]);

  // Load messages for the active session
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/chat/${sessionId}/history`);
      if (!res.ok) throw new Error("Failed to retrieve chat messages");
      const data = await res.json();
      setMessages(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync sessions when notebook changes
  useEffect(() => {
    if (notebookId) {
      setActiveSessionId(null);
      setMessages([]);
      loadSessions();
    } else {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [notebookId]);

  // Sync messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId, loadMessages]);

  // Create a new session
  const createSession = async () => {
    if (!notebookId) return null;
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/chat/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebook_id: notebookId, title: "New Chat" })
      });
      if (!res.ok) throw new Error("Failed to initialize session");
      const session = await res.json();
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
      return session.id;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start new chat");
      return null;
    }
  };

  // Delete a session
  const deleteSession = async (sessionId: string) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/chat/${sessionId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to close chat session");
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to delete conversation session");
    }
  };

  // Send message with streaming response
  const sendMessage = async (content: string) => {
    if (!notebookId) return;
    
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession();
      if (!sessionId) return;
    }

    // 1. Add user message
    const tempUserMsgId = `temp-user-${Date.now()}`;
    const userMsg: Message = {
      id: tempUserMsgId,
      role: 'user',
      content
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    // 2. Add assistant response placeholder
    const tempAiMsgId = `temp-ai-${Date.now()}`;
    const assistantMsg: Message = {
      id: tempAiMsgId,
      role: 'assistant',
      content: '',
      citations: []
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await fetch(`${API_BASE_URL}/chat/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content })
      });

      if (!res.ok) throw new Error("Failed to send message to system");

      await consumeStream(res, (event: StreamEvent) => {
        if (event.type === 'token') {
          setMessages(prev => prev.map(m => {
            if (m.id === tempAiMsgId) {
              return { ...m, content: m.content + event.content };
            }
            return m;
          }));
        } else if (event.type === 'citations') {
          setMessages(prev => prev.map(m => {
            if (m.id === tempAiMsgId) {
              return { ...m, citations: event.content };
            }
            return m;
          }));
        } else if (event.type === 'error') {
          setError(event.content);
        } else if (event.type === 'done') {
          setLoading(false);
          loadSessions(); // Reload sessions to sync updated titles
        }
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to retrieve streaming response");
      setMessages(prev => prev.filter(m => m.id !== tempAiMsgId));
      setLoading(false);
    }
  };

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    messages,
    loading,
    error,
    createSession,
    deleteSession,
    sendMessage
  };
}
