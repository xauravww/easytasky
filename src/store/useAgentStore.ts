import { create } from "zustand";
import { aiEnabled } from "../lib/aiClient";
import { runAgentTurn, type AgentMessage } from "../lib/agentActions";
import {
  appendChatMessage,
  clearChatHistory,
  createSession,
  deleteSession as deleteSessionRow,
  loadAgentSessions,
  loadChatHistory,
  pruneAgentHistory,
  reopenSession,
  replaceChatHistory,
  saveSessionTranscript,
  type AgentSession,
  type CallEntry,
} from "../lib/agentHistory";

const GREETING: AgentMessage = {
  role: "assistant",
  content: "Hi, I'm your agent. Ask me to plan, draft tasks, or estimate. Or just chat.",
};

const newSessionId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const titleFrom = (text: string | undefined | null): string | null => {
  const trimmed = (text ?? "").trim();
  return trimmed ? trimmed.slice(0, 80) : null;
};

const messagesToEntries = (messages: AgentMessage[]): CallEntry[] => {
  const list =
    messages.length && messages[0].role === "assistant" && messages[0].content === GREETING.content
      ? messages.slice(1)
      : messages;
  const now = Date.now();
  return list
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
    .map((m, i) => ({ role: m.role, content: m.content, at: now + i }));
};

const firstUserText = (messages: AgentMessage[]): string | null =>
  messages.find((m) => m.role === "user")?.content ?? null;

type AgentState = {
  hydrated: boolean;
  messages: AgentMessage[];
  busy: boolean;
  typing: boolean;
  chatSessionId: string | null;
  chatEntries: CallEntry[];
  chatTitle: string | null;
  callOpen: boolean;
  callMinimized: boolean;
  callId: string | null;
  callStartedAt: number | null;
  callEntries: CallEntry[];
  sessions: AgentSession[];
  hydrate: () => Promise<void>;
  send: (text: string, base?: AgentMessage[]) => Promise<string>;
  appendLocal: (userText: string, assistantText: string, base?: AgentMessage[]) => void;
  clearChat: () => Promise<void>;
  startCall: () => Promise<void>;
  minimizeCall: () => void;
  restoreCall: () => void;
  endCall: () => Promise<void>;
  recordCallTurn: (role: "user" | "assistant", content: string) => void;
  refreshHistory: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  resumeSession: (id: string) => Promise<void>;
};

export const useAgentStore = create<AgentState>((set, get) => {
  let turnGeneration = 0;
  let activeTurnController: AbortController | null = null;

  // Chat history is stored as a session so it shows up in the same list as calls.
  const ensureChatSession = async (firstUser: string | null): Promise<string | null> => {
    const existing = get().chatSessionId;
    if (existing) return existing;
    const id = newSessionId();
    const title = titleFrom(firstUser);
    set({ chatSessionId: id, chatEntries: [], chatTitle: title });
    await createSession(id, "chat", title);
    return id;
  };

  const appendChatTurn = (role: "user" | "assistant", content: string) => {
    const { chatSessionId, chatEntries, chatTitle } = get();
    const trimmed = content.trim();
    if (!chatSessionId || !trimmed) return;
    const entries = [...chatEntries, { role, content: trimmed, at: Date.now() }];
    set({ chatEntries: entries });
    void saveSessionTranscript(chatSessionId, entries, null, chatTitle);
  };

  const resetChatEntries = (base: AgentMessage[]) => {
    const entries = messagesToEntries(base);
    set({ chatEntries: entries });
    const id = get().chatSessionId;
    if (id) void saveSessionTranscript(id, entries, null, get().chatTitle);
  };

  return {
    hydrated: false,
    messages: [GREETING],
    busy: false,
    typing: false,
    chatSessionId: null,
    chatEntries: [],
    chatTitle: null,
    callOpen: false,
    callMinimized: false,
    callId: null,
    callStartedAt: null,
    callEntries: [],
    sessions: [],

    hydrate: async () => {
      if (get().hydrated) return;
      try {
        await pruneAgentHistory();
        const [stored, sessions] = await Promise.all([loadChatHistory(), loadAgentSessions()]);
        const valid = stored.filter((m) => m.role === "user" || m.role === "assistant");
        const messages: AgentMessage[] =
          valid.length && valid[0].role === "assistant" ? valid : [GREETING, ...valid];

        let chatSessionId: string | null = null;
        let chatEntries: CallEntry[] = [];
        let chatTitle: string | null = null;
        let allSessions = sessions;

        if (messages.length > 1) {
          const active = sessions.find((s) => s.kind === "chat" && !s.ended_at);
          if (active) {
            chatSessionId = active.id;
            chatEntries = active.entries.length ? active.entries : messagesToEntries(messages);
            chatTitle = active.title;
          } else {
            chatSessionId = newSessionId();
            chatTitle = titleFrom(firstUserText(messages));
            chatEntries = messagesToEntries(messages);
            await createSession(chatSessionId, "chat", chatTitle);
            await saveSessionTranscript(chatSessionId, chatEntries, null, chatTitle);
            allSessions = await loadAgentSessions();
          }
        }

        set({
          messages,
          sessions: allSessions,
          hydrated: true,
          chatSessionId,
          chatEntries,
          chatTitle,
        });
      } catch {
        set({ hydrated: true });
      }
    },

    send: async (text, base) => {
      const trimmed = text.trim();
      if (!trimmed || get().busy) return "";
      const generation = ++turnGeneration;
      const controller = new AbortController();
      activeTurnController = controller;

      const current = base ?? get().messages;
      const next: AgentMessage[] = [...current, { role: "user", content: trimmed }];
      set({ messages: next, busy: true, typing: true });

      await ensureChatSession(firstUserText(base ?? []) ?? trimmed);
      if (generation !== turnGeneration) return "";
      if (base) resetChatEntries(base);
      appendChatTurn("user", trimmed);

      if (base) await replaceChatHistory(base);
      await appendChatMessage("user", trimmed);
      if (generation !== turnGeneration) return "";

      const finish = async (content: string) => {
        if (generation !== turnGeneration) return content;
        set((s) => ({ messages: [...s.messages, { role: "assistant", content }] }));
        appendChatTurn("assistant", content);
        await appendChatMessage("assistant", content);
        return content;
      };

      if (!aiEnabled()) {
        const content = "⚠️ AI not configured. Tap the gear to add your API settings.";
        const result = await finish(content);
        if (activeTurnController === controller) activeTurnController = null;
        if (generation === turnGeneration) set({ busy: false, typing: false });
        return result;
      }

      try {
        const content = await runAgentTurn(
          next,
          () => generation === turnGeneration,
          controller.signal
        );
        return await finish(content);
      } catch (e) {
        if (controller.signal.aborted) return "";
        return await finish(`⚠️ ${e instanceof Error ? e.message : "Request failed"}`);
      } finally {
        if (activeTurnController === controller) activeTurnController = null;
        if (generation === turnGeneration) set({ busy: false, typing: false });
        void pruneAgentHistory();
      }
    },

    appendLocal: (userText, assistantText, base) => {
      const current = base ?? get().messages;
      set({
        messages: [
          ...current,
          { role: "user", content: userText },
          { role: "assistant", content: assistantText },
        ],
      });
      void (async () => {
        await ensureChatSession(firstUserText(base ?? []) ?? userText);
        if (base) resetChatEntries(base);
        appendChatTurn("user", userText);
        appendChatTurn("assistant", assistantText);
      })();
      if (base) {
        void replaceChatHistory(base).then(() => {
          void appendChatMessage("user", userText);
          void appendChatMessage("assistant", assistantText);
        });
      } else {
        void appendChatMessage("user", userText);
        void appendChatMessage("assistant", assistantText);
      }
    },

    clearChat: async () => {
      if (get().busy) return;
      turnGeneration += 1;
      activeTurnController?.abort();
      activeTurnController = null;
      const { chatSessionId, chatEntries, chatTitle } = get();
      if (chatSessionId) {
        if (chatEntries.length) {
          await saveSessionTranscript(chatSessionId, chatEntries, Date.now(), chatTitle);
        } else {
          await deleteSessionRow(chatSessionId);
        }
      }
      await clearChatHistory();
      set({
        messages: [GREETING],
        busy: false,
        typing: false,
        chatSessionId: null,
        chatEntries: [],
        chatTitle: null,
      });
      await pruneAgentHistory();
      set({ sessions: await loadAgentSessions() });
    },

    startCall: async () => {
      if (get().callOpen) {
        set({ callMinimized: false });
        return;
      }
      const id = newSessionId();
      set({
        callOpen: true,
        callMinimized: false,
        callId: id,
        callStartedAt: Date.now(),
        callEntries: [],
      });
      try {
        await createSession(id, "call", null);
      } catch {}
    },

    minimizeCall: () => set({ callMinimized: true }),
    restoreCall: () => set({ callMinimized: false }),

    endCall: async () => {
      const { callId, callEntries } = get();
      set({
        callOpen: false,
        callMinimized: false,
        callId: null,
        callStartedAt: null,
        callEntries: [],
      });
      if (!callId) return;
      try {
        if (callEntries.length) {
          await saveSessionTranscript(callId, callEntries, Date.now(), null);
        } else {
          await deleteSessionRow(callId);
        }
        await pruneAgentHistory();
        set({ sessions: await loadAgentSessions() });
      } catch {}
    },

    recordCallTurn: (role, content) => {
      const trimmed = content.trim();
      const { callId } = get();
      if (!callId || !trimmed) return;
      const entry: CallEntry = { role, content: trimmed, at: Date.now() };
      set((s) => ({ callEntries: [...s.callEntries, entry] }));
      void saveSessionTranscript(callId, get().callEntries, null, null);
    },

    refreshHistory: async () => {
      try {
        await pruneAgentHistory();
        set({ sessions: await loadAgentSessions() });
      } catch {}
    },

    deleteSession: async (id) => {
      const deletingActiveChat = get().chatSessionId === id;
      if (deletingActiveChat && get().busy) return;
      if (deletingActiveChat) {
        turnGeneration += 1;
        activeTurnController?.abort();
        activeTurnController = null;
      }
      await deleteSessionRow(id);
      if (deletingActiveChat && get().chatSessionId === id) {
        await clearChatHistory();
        set({
          messages: [GREETING],
          busy: false,
          typing: false,
          chatSessionId: null,
          chatEntries: [],
          chatTitle: null,
        });
      }
      set({ sessions: await loadAgentSessions() });
    },

    resumeSession: async (id) => {
      if (get().busy) return;
      turnGeneration += 1;
      activeTurnController?.abort();
      activeTurnController = null;
      const { sessions, chatSessionId, chatEntries, chatTitle } = get();
      const session = sessions.find((s) => s.id === id);
      if (!session) return;

      // Archive the conversation currently on screen before switching to another one.
      if (chatSessionId && chatSessionId !== id && chatEntries.length) {
        await saveSessionTranscript(chatSessionId, chatEntries, Date.now(), chatTitle);
      }

      const title =
        session.title ?? titleFrom(session.entries.find((e) => e.role === "user")?.content);
      const entries = session.entries;
      const messages: AgentMessage[] = [
        GREETING,
        ...entries.map((e) => ({ role: e.role, content: e.content })),
      ];

      set({
        messages,
        chatSessionId: id,
        chatEntries: entries,
        chatTitle: title,
        busy: false,
        typing: false,
      });
      await replaceChatHistory(messages);
      await reopenSession(id, "chat", title);
      set({ sessions: await loadAgentSessions() });
    },
  };
});
