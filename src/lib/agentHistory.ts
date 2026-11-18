import { getDb } from "../db/database";
import type { AgentMessage } from "./agentActions";

// Retention policy: keep conversations usable without letting the DB grow forever.
const CHAT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const CHAT_MAX_MESSAGES = 300;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_MAX_COUNT = 50;

export type CallEntry = { role: "user" | "assistant"; content: string; at: number };
export type SessionKind = "chat" | "call";

export type AgentSession = {
  id: string;
  kind: SessionKind;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  entries: CallEntry[];
};

const ensureTables = async () => {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS call_sessions (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'call',
      title TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      transcript TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages (created_at);
    CREATE INDEX IF NOT EXISTS idx_call_sessions_started ON call_sessions (started_at);
  `);
  // Migrations for sessions created before chat history was unified with calls.
  try {
    await db.execAsync("ALTER TABLE call_sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'call'");
  } catch {}
  try {
    await db.execAsync("ALTER TABLE call_sessions ADD COLUMN title TEXT");
  } catch {}
  return db;
};

export const pruneAgentHistory = async (): Promise<void> => {
  try {
    const db = await ensureTables();
    await db.runAsync("DELETE FROM agent_messages WHERE created_at < ?", [
      Date.now() - CHAT_MAX_AGE_MS,
    ]);
    await db.runAsync(
      "DELETE FROM agent_messages WHERE id NOT IN (SELECT id FROM agent_messages ORDER BY id DESC LIMIT ?)",
      [CHAT_MAX_MESSAGES]
    );
    await db.runAsync("DELETE FROM call_sessions WHERE started_at < ?", [
      Date.now() - SESSION_MAX_AGE_MS,
    ]);
    await db.runAsync(
      "DELETE FROM call_sessions WHERE id NOT IN (SELECT id FROM call_sessions ORDER BY started_at DESC LIMIT ?)",
      [SESSION_MAX_COUNT]
    );
  } catch {}
};

export const loadChatHistory = async (): Promise<AgentMessage[]> => {
  try {
    const db = await ensureTables();
    return await db.getAllAsync<AgentMessage>(
      "SELECT role, content FROM (SELECT id, role, content FROM agent_messages ORDER BY id DESC LIMIT ?) ORDER BY id ASC",
      [CHAT_MAX_MESSAGES]
    );
  } catch {
    return [];
  }
};

export const appendChatMessage = async (role: "user" | "assistant", content: string): Promise<void> => {
  try {
    const db = await ensureTables();
    await db.runAsync(
      "INSERT INTO agent_messages (role, content, created_at) VALUES (?, ?, ?)",
      [role, content, Date.now()]
    );
  } catch {}
};

export const clearChatHistory = async (): Promise<void> => {
  try {
    const db = await ensureTables();
    await db.runAsync("DELETE FROM agent_messages");
  } catch {}
};

// Used when a reply is retried: everything after the re-sent prompt is dropped.
export const replaceChatHistory = async (messages: AgentMessage[]): Promise<void> => {
  try {
    const db = await ensureTables();
    await db.runAsync("DELETE FROM agent_messages");
    const now = Date.now();
    for (let i = 0; i < messages.length; i++) {
      await db.runAsync(
        "INSERT INTO agent_messages (role, content, created_at) VALUES (?, ?, ?)",
        [messages[i].role, messages[i].content, now + i]
      );
    }
  } catch {}
};

export const loadAgentSessions = async (): Promise<AgentSession[]> => {
  try {
    const db = await ensureTables();
    const rows = await db.getAllAsync<{
      id: string;
      kind: string | null;
      title: string | null;
      started_at: number;
      ended_at: number | null;
      transcript: string;
    }>("SELECT * FROM call_sessions ORDER BY started_at DESC LIMIT ?", [SESSION_MAX_COUNT]);
    return rows.map((r) => {
      let entries: CallEntry[] = [];
      try {
        const parsed = JSON.parse(r.transcript);
        if (Array.isArray(parsed)) entries = parsed;
      } catch {}
      return {
        id: r.id,
        kind: r.kind === "chat" ? "chat" : "call",
        title: r.title ?? null,
        started_at: r.started_at,
        ended_at: r.ended_at,
        entries,
      };
    });
  } catch {
    return [];
  }
};

export const createSession = async (
  id: string,
  kind: SessionKind,
  title: string | null
): Promise<void> => {
  try {
    const db = await ensureTables();
    await db.runAsync(
      "INSERT OR REPLACE INTO call_sessions (id, kind, title, started_at, ended_at, transcript) VALUES (?, ?, ?, ?, NULL, '[]')",
      [id, kind, title, Date.now()]
    );
  } catch {}
};

export const saveSessionTranscript = async (
  id: string,
  entries: CallEntry[],
  endedAt: number | null,
  title: string | null
): Promise<void> => {
  try {
    const db = await ensureTables();
    await db.runAsync(
      "UPDATE call_sessions SET transcript = ?, ended_at = COALESCE(?, ended_at), title = COALESCE(?, title) WHERE id = ?",
      [JSON.stringify(entries), endedAt, title, id]
    );
  } catch {}
};

export const reopenSession = async (
  id: string,
  kind: SessionKind,
  title: string | null
): Promise<void> => {
  try {
    const db = await ensureTables();
    await db.runAsync(
      "UPDATE call_sessions SET ended_at = NULL, kind = ?, title = COALESCE(?, title) WHERE id = ?",
      [kind, title, id]
    );
  } catch {}
};

export const deleteSession = async (id: string): Promise<void> => {
  try {
    const db = await ensureTables();
    await db.runAsync("DELETE FROM call_sessions WHERE id = ?", [id]);
  } catch {}
};
