import { useCallback, useRef, useState } from 'react';
import api from '@/services/api';

export function useAgent() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const activeStream = useRef(null);

  const sendMessage = useCallback(async (text, contextType = 'dashboard') => {
    if (!text.trim() || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const agentMsg = {
      id: `agent-${Date.now()}`,
      role: 'assistant',
      content: '',
      toolCalls: [],
      streaming: true,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setLoading(true);

    const token = localStorage.getItem('access_token');
    const ctrl = new AbortController();

    try {
      const res = await fetch(`${api.defaults.baseURL}/agent/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, context_type: contextType }),
        signal: ctrl.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let fullContent = '';
      let toolCalls = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          let eventType = '';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              data = line.slice(6);
            }
          }

          if (!eventType || !data) continue;

          try {
            const parsed = JSON.parse(data);

            if (eventType === 'token') {
              fullContent += parsed.text || '';
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsg.id ? { ...m, content: fullContent } : m,
                ),
              );
            } else if (eventType === 'tool_call') {
              toolCalls.push({ type: 'call', tool: parsed.tool, params: parsed.params });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsg.id ? { ...m, toolCalls: [...toolCalls] } : m,
                ),
              );
            } else if (eventType === 'tool_result') {
              toolCalls = toolCalls.map((tc) =>
                tc.tool === parsed.tool ? { ...tc, result: parsed.result } : tc,
              );
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsg.id ? { ...m, toolCalls: [...toolCalls] } : m,
                ),
              );
            } else if (eventType === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsg.id ? { ...m, streaming: false } : m,
                ),
              );
            } else if (eventType === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsg.id
                    ? { ...m, content: parsed.message || 'Error occurred', streaming: false }
                    : m,
                ),
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      activeStream.current = null;
      setLoading(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsg.id
              ? { ...m, content: 'Failed to connect. Please try again.', streaming: false }
              : m,
          ),
        );
      }
      activeStream.current = null;
      setLoading(false);
    }
  }, [loading]);

  const stopStreaming = useCallback(() => {
    if (activeStream.current) {
      activeStream.current.abort();
      activeStream.current = null;
    }
    setLoading(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  return {
    messages,
    loading,
    isOpen,
    sendMessage,
    stopStreaming,
    clearMessages,
    toggleOpen,
    setIsOpen,
  };
}
