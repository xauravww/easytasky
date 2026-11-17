import type { Task, TimeBlock } from "../db/database";
import { aiChatSystem, aiEnabled } from "./aiClient";
import { dayKey } from "../utils/time";

// Runtime context given to every agent run.
export type AgentContext = {
  tasks: Task[];
  blocks: TimeBlock[];
  addTask: (t: Partial<Task> & { title: string }) => Promise<void>;
  addBlock: (b: Omit<TimeBlock, "id">) => Promise<void>;
  query: string; // everything after the agent token
  history: { role: "user" | "assistant"; content: string }[]; // prior conversation (excludes this invocation)
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
    id: "help",
    aliases: ["?"],
    description: "list agents & usage",
    run: async (ctx) => {
      const lines = agents.filter((a) => a.id !== "help").map((a) => `- \`/${a.id}\` (${a.aliases.join(", ")}): ${a.description}`);
      return [
        "**Agents** run locally on a slash/at trigger — no API call needed.",
        "",
        ...lines,
        "",
        "Try: `/help`, `/draft buy groceries`, `@draft review PR`.",
      ].join("\n");
    },
  },
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
  {
    id: "timeblock",
    aliases: ["schedule"],
    description: "plan time blocks with AI",
    run: async (ctx) => {
      if (!aiEnabled()) return "AI isn't configured — tap the gear in Agent to add your API settings, then try again.";
      if (!ctx.query) return "Usage: /timeblock <your day plan> — e.g. `/timeblock deep work 9-11, admin 2-3`.";
      const fmt24 = (min: number) => `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;
      const todayKey = dayKey();
      const existing = ctx.blocks.filter((b) => b.day === todayKey).sort((a, b) => a.start_min - b.start_min);
      const existingDesc = existing.length
        ? existing.map((b) => `  ${fmt24(b.start_min)}–${fmt24(b.end_min)} ${b.label} (${b.type})`).join("\n")
        : "  (no blocks yet)";

      const system =
        "You are a time-planning assistant. Given a day's plan, produce a JSON array of time blocks. " +
        "Each block: {label: string, type: one of \"deep\"|\"urgent\"|\"batch\"|\"maintenance\"|\"buffer\", start: \"HH:MM\" 24h, end: \"HH:MM\" 24h}. " +
        "Clamp times to 06:00-22:00, avoid overlapping the existing blocks, keep 2-6 blocks. Respond with JSON only.";
      const transcript = ctx.history
        .slice(-6)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      const user = `Existing blocks today:\n${existingDesc}\n\n${transcript ? `Recent conversation:\n${transcript}\n\n` : ""}Plan: ${ctx.query}`;
      const raw = await aiChatSystem(system, user);
      let list: { label?: string; type?: string; start?: string; end?: string }[] = [];
      try {
        const parsed = JSON.parse(raw);
        list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.blocks) ? parsed.blocks : [];
      } catch {
        const m = raw.match(/\[[\s\S]*\]/);
        if (m) {
          try { list = JSON.parse(m[0]); } catch { return "The AI didn't return a valid plan. Try again."; }
        } else {
          return "The AI didn't return a valid plan. Try again.";
        }
      }
      const toMin = (t: string) => {
        const parts = t.split(":").map(Number);
        return parts[0] * 60 + (parts[1] ?? 0);
      };
      let added = 0;
      const accepted: [number, number][] = existing.map((b) => [b.start_min, b.end_min]);
      const overlaps = (s: number, e: number) =>
        accepted.some(([as, ae]) => s < ae && e > as);
      for (const b of list) {
        const label = (b.label ?? "").toString().trim();
        const type = ["deep", "urgent", "batch", "maintenance", "buffer"].includes(b.type ?? "") ? b.type! : "deep";
        const start = toMin((b.start ?? "").toString());
        const end = toMin((b.end ?? "").toString());
        if (!label || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
        if (start < 360 || end > 1320 || overlaps(start, end)) continue;
        await ctx.addBlock({ day: dayKey(), start_min: start, end_min: end, label, type, buffer: type === "buffer" ? 0.2 : 0 });
        accepted.push([start, end]);
        added++;
      }
      return added > 0
        ? `Added ${added} time block${added > 1 ? "s" : ""} for today.`
        : "Couldn't add any blocks — check your plan phrasing.";
    },
  },
  {
    id: "blocks",
    aliases: ["timeblocks", "schedule-view"],
    description: "show today's time blocks",
    run: async (ctx) => {
      const fmt24 = (min: number) => `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;
      const todayKey = dayKey();
      const existing = ctx.blocks.filter((b) => b.day === todayKey).sort((a, b) => a.start_min - b.start_min);
      if (!existing.length) return "No time blocks today. Try `/timeblock <plan>` to create some.";
      return existing.map((b) => `- ${fmt24(b.start_min)}–${fmt24(b.end_min)} — **${b.label}** (${b.type})`).join("\n");
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
