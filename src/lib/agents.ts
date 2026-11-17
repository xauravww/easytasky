import type { Task } from "../db/database";

// Runtime context given to every agent run.
export type AgentContext = {
  tasks: Task[];
  addTask: (t: Partial<Task> & { title: string }) => Promise<void>;
  query: string; // everything after the agent token
};

export type AgentDef = {
  id: string;
  aliases: string[]; // triggers without the leading "/" or "@"
  description: string;
  run: (ctx: AgentContext) => Promise<string>;
};

// Registry of custom agents. Trigger via "/id" or "@id" in the Agent input.
// Add new agents by appending to this array.
const agents: AgentDef[] = [
  {
    id: "draft",
    aliases: ["task", "add"],
    description: "quickly add a task",
    run: async (ctx) => {
      const title = ctx.query;
      if (!title) return "Usage: /draft <task title> — e.g. `/draft call the dentist`.";
      await ctx.addTask({ title, status: "inbox", quadrant: "not_urgent_important", energy: "medium" });
      return `Added to inbox: "${title}"`;
    },
  },
];

export const listAgents = (): AgentDef[] => agents;

export const findAgent = (token: string): AgentDef | undefined =>
  agents.find((a) => a.id === token || a.aliases.includes(token));

// Parse the first token of a command string. Returns { token, rest } or null if
// it isn't an agent invocation ("/..." or "@...").
export const parseInvocation = (text: string): { token: string; rest: string } | null => {
  if (!text || (text[0] !== "/" && text[0] !== "@")) return null;
  const m = text.match(/^[/@]([A-Za-z0-9_-]+)(?:\s+(.*))?$/s);
  if (!m) return null;
  return { token: m[1].toLowerCase(), rest: (m[2] ?? "").trim() };
};

export const runAgent = async (def: AgentDef, ctx: AgentContext): Promise<string> => {
  try {
    return await def.run(ctx);
  } catch (e) {
    return `⚠️ Agent "${def.id}" failed: ${e instanceof Error ? e.message : "unknown error"}`;
  }
};
