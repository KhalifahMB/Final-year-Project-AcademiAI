import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { agentApi } from '@/services/api';
import { applyAiFilters } from '@/lib/agentFilters';

const DEFAULT_SETTINGS = {
  enabled: true,
  default_agent: '',
  tone: 'balanced',
  filters: { ableism: true, reading_order: true },
  reminders_enabled: true,
};

function loadLocalPreference() {
  try {
    const saved = JSON.parse(
      localStorage.getItem('academiai:agent-settings') || '{}',
    );
    return saved;
  } catch {
    return {};
  }
}

export function useAgent() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState([]);
  const [defaultKey, setDefaultKey] = useState('');
  const [agentKey, setAgentKey] = useState('');
  const [settings, setSettings] = useState({
    ...DEFAULT_SETTINGS,
    ...loadLocalPreference(),
  });
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const activeStream = useRef(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Boot: pull identities + persisted settings + session history once.
  useEffect(() => {
    let cancelled = false;
    if (typeof agentApi?.identities !== 'function') return undefined;
    Promise.all([agentApi.identities(), agentApi.listSessions()])
      .then(([identityPayload, sessionPayload]) => {
        if (cancelled) return;
        const list = sessionPayload?.results || sessionPayload || [];
        const serverSettings = identityPayload?.settings || null;
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...settingsRef.current,
          ...(serverSettings || {}),
          filters: {
            ...DEFAULT_SETTINGS.filters,
            ...(serverSettings?.filters || {}),
          },
        };
        setAgents(identityPayload?.agents || []);
        setDefaultKey(identityPayload?.default_key || '');
        const preferred = serverSettings?.default_agent || settingsRef.current.default_agent;
        setAgentKey(
          preferred ||
            identityPayload?.default_key ||
            (identityPayload?.agents || [])[0]?.key ||
            '',
        );
        settingsRef.current = mergedSettings;
        setSettings(mergedSettings);
        setSessions(list);
        if (list[0]) setActiveSessionId(list[0].id);
      })
      .catch(() => {
        /* keep local defaults when the API is unavailable or mocked */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cross-instance sync: any AgentSettings panel (e.g. in Profile) broadcasts
  // changes; keep this instance's state in step without re-broadcasting.
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail;
      if (!detail || typeof detail !== 'object') return;
      setSettings((prev) => {
        const patch = detail.patch || {};
        return {
          ...prev,
          ...('enabled' in detail ? { enabled: detail.enabled } : {}),
          ...patch,
          filters: { ...prev.filters, ...(patch.filters || {}) },
        };
      });
    };
    window.addEventListener('academiai:agent-settings-changed', handler);
    return () =>
      window.removeEventListener('academiai:agent-settings-changed', handler);
  }, []);

  const identity = useMemo(
    () => agents.find((a) => a.key === agentKey) || agents[0],
    [agents, agentKey],
  );

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  const refreshSessions = useCallback(async () => {
    if (typeof agentApi?.listSessions !== 'function') return;
    try {
      const payload = await agentApi.listSessions();
      const list = payload?.results || payload || [];
      setSessions(list);
      return list;
    } catch {
      return null;
    }
  }, []);

  const saveSettings = useCallback(
    (patch = {}) => {
      const next = {
        ...settingsRef.current,
        ...patch,
        filters: {
          ...(settingsRef.current.filters || {}),
          ...(patch.filters || {}),
        },
      };
      settingsRef.current = next;
      setSettings(next);
      localStorage.setItem('academiai:agent-settings', JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent('academiai:agent-settings-changed', {
          detail: { enabled: next.enabled, patch },
        }),
      );
      if (typeof agentApi?.updateSettings === 'function') {
        agentApi
          .updateSettings({
            enabled: next.enabled,
            default_agent: next.default_agent || agentKey,
            tone: next.tone,
            filters: next.filters,
            reminders_enabled: next.reminders_enabled,
          })
          .catch(() => {});
      }
    },
    [agentKey],
  );

  const setAgent = useCallback(
    (key) => {
      setAgentKey(key);
      saveSettings({ default_agent: key });
    },
    [saveSettings],
  );

  const createSession = useCallback(
    async (title, contextType) => {
      if (typeof agentApi?.createSession !== 'function') return null;
      try {
        const session = await agentApi.createSession({
          title: title?.slice(0, 60) || 'New conversation',
          agent_key: agentKey || defaultKey,
          context_type: contextType,
        });
        setActiveSessionId(session.id);
        refreshSessions();
        return session;
      } catch {
        return null;
      }
    },
    [agentKey, defaultKey, refreshSessions],
  );

  const selectSession = useCallback(async (id) => {
    if (typeof agentApi?.getSession !== 'function') return;
    setLoading(true);
    try {
      const session = await agentApi.getSession(id);
      const history = session.recent_messages || [];
      const restored = history.map((m, i) => ({
        id: `hist-${id}-${i}`,
        role: m.role,
        content: m.content,
        toolCalls: [],
        timestamp: new Date().toISOString(),
      }));
      if (session.agent_key) setAgentKey(session.agent_key);
      setActiveSessionId(id);
      setMessages(restored);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(
    async (id) => {
      if (typeof agentApi?.deleteSession !== 'function') return;
      try {
        await agentApi.deleteSession(id);
        if (id === activeSessionId) {
          setActiveSessionId(null);
          setMessages([]);
        }
        refreshSessions();
      } catch {
        /* ignore */
      }
    },
    [activeSessionId, refreshSessions],
  );

  const renameSession = useCallback(async (id, title) => {
    if (typeof agentApi?.renameSession !== 'function') return;
    try {
      const updated = await agentApi.renameSession(id, title);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: updated.title || title } : s)),
      );
      return updated;
    } catch {
      return null;
    }
  }, []);

  const sendMessage = useCallback(
    async (text, contextType = 'dashboard') => {
      if (!text.trim() || loading) return;
      const filters =
        settingsRef.current.filters || DEFAULT_SETTINGS.filters;

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

      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await createSession(text, contextType);
        if (created) sessionId = created.id;
      }

      const ctrl = agentApi?.stream?.(
        {
          message: text,
          contextType,
          sessionId,
          agent: agentKey || defaultKey,
        },
        {
          onToken: (parsed) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMsg.id
                  ? {
                      ...m,
                      raw: (m.raw || '') + (parsed.text || ''),
                      content: applyAiFilters(
                        (m.raw || '') + (parsed.text || ''),
                        filters,
                      ),
                    }
                  : m,
              ),
            );
          },
          onToolCall: (parsed) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMsg.id
                  ? {
                      ...m,
                      toolCalls: [
                        ...m.toolCalls,
                        { type: 'call', tool: parsed.tool, params: parsed.params },
                      ],
                    }
                  : m,
              ),
            );
          },
          onToolResult: (parsed) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMsg.id
                  ? {
                      ...m,
                      toolCalls: m.toolCalls.map((tc) =>
                        tc.tool === parsed.tool
                          ? { ...tc, result: parsed.result }
                          : tc,
                      ),
                    }
                  : m,
              ),
            );
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMsg.id ? { ...m, streaming: false } : m,
              ),
            );
            setActiveSessionId(sessionId || activeSessionId);
            refreshSessions();
            setLoading(false);
            activeStream.current = null;
          },
          onError: (err) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMsg.id
                  ? {
                      ...m,
                      content:
                        err?.message === 'Stream failed'
                          ? 'Failed to connect. Please try again.'
                          : err?.message || 'Failed to connect. Please try again.',
                      streaming: false,
                    }
                  : m,
              ),
            );
            setLoading(false);
            activeStream.current = null;
          },
        },
      );
      if (ctrl) activeStream.current = ctrl;
      else {
        setLoading(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsg.id
              ? { ...m, content: 'Failed to connect. Please try again.', streaming: false }
              : m,
          ),
        );
      }
    },
    [activeSessionId, agentKey, createSession, defaultKey, loading, refreshSessions],
  );

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
    setActiveSessionId(null);
  }, []);

  const newConversation = useCallback(
    async (contextType = 'dashboard') => {
      await createSession('New conversation', contextType);
      setMessages([]);
    },
    [createSession],
  );

  const toggleOpen = useCallback(() => setIsOpen((v) => !v), []);
  const setEnabled = useCallback(
    (enabled) => saveSettings({ enabled }),
    [saveSettings],
  );

  return {
    messages,
    loading,
    isOpen,
    agents,
    defaultKey,
    agentKey,
    setAgent,
    identity,
    settings,
    saveSettings,
    setEnabled,
    sessions,
    activeSession,
    activeSessionId,
    refreshSessions,
    selectSession,
    deleteSession,
    renameSession,
    newConversation,
    sendMessage,
    stopStreaming,
    clearMessages,
    toggleOpen,
    setIsOpen,
  };
}