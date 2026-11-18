import type { TimeBlock } from "../db/database";
import { dayKey } from "../utils/time";
import type { ToolCall } from "./aiClient";

// A proposed change to time blocks that the user must approve before it applies.
export type BlockProposal =
  | { kind: "addBlock"; block: Omit<TimeBlock, "id"> }
  | { kind: "updateBlock"; id: number; patch: Partial<Omit<TimeBlock, "id">> }
  | { kind: "deleteBlock"; id: number }
  | { kind: "createSection"; name: string; color?: string }
  | { kind: "deleteSection"; name: string };

// ---- helpers ----
const toMin = (t: unknown): number | null => {
  if (typeof t !== "string") return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
};

const BLOCK_TYPES = ["deep", "urgent", "batch", "maintenance", "buffer"];
const DAY_START = 6 * 60;
const DAY_END = 22 * 60;

// Convert AI tool calls into block proposals the user can approve.
export const proposalsFromToolCalls = (calls: ToolCall[], blocks: TimeBlock[]): { proposals: BlockProposal[]; note?: string } => {
  const proposals: BlockProposal[] = [];
  const todayKey = dayKey();
  const todayBlocks = blocks.filter((b) => b.day === todayKey);
  const findBlock = (s: unknown): TimeBlock | undefined => {
    if (typeof s !== "string" || !s.trim()) return undefined;
    const q = s.trim().toLowerCase();
    return todayBlocks.find((b) => b.label.toLowerCase().includes(q));
  };

  for (const c of calls) {
    if (c.name === "add_block") {
      const label = typeof c.args.label === "string" ? c.args.label.trim() : "";
      const type = BLOCK_TYPES.includes(c.args.type as string) ? (c.args.type as string) : "deep";
      const start = toMin(c.args.start);
      const end = toMin(c.args.end);
      if (!label || start === null || end === null || end <= start) continue;
      if (start < DAY_START || end > DAY_END) continue;
      proposals.push({ kind: "addBlock", block: { day: todayKey, start_min: start, end_min: end, label, type, buffer: type === "buffer" ? 0.2 : 0 } });
    } else if (c.name === "update_block") {
      const target = findBlock(c.args.find);
      if (!target) continue;
      const patch: Partial<Omit<TimeBlock, "id">> = {};
      if (typeof c.args.label === "string" && c.args.label.trim()) patch.label = c.args.label.trim();
      if (BLOCK_TYPES.includes(c.args.type as string)) { patch.type = c.args.type as string; patch.buffer = c.args.type === "buffer" ? 0.2 : 0; }
      const start = toMin(c.args.start);
      const end = toMin(c.args.end);
      if (start !== null) patch.start_min = start;
      if (end !== null) patch.end_min = end;
      if (Object.keys(patch).length) proposals.push({ kind: "updateBlock", id: target.id, patch });
    } else if (c.name === "delete_block") {
      const target = findBlock(c.args.find);
      if (!target) continue;
      proposals.push({ kind: "deleteBlock", id: target.id });
    } else if (c.name === "create_section") {
      const name = typeof c.args.name === "string" ? c.args.name.trim() : "";
      const color = typeof c.args.color === "string" ? c.args.color.trim() : "#0B6E46";
      if (name) proposals.push({ kind: "createSection", name, color });
    } else if (c.name === "delete_section") {
      const name = typeof c.args.name === "string" ? c.args.name.trim() : "";
      if (name) proposals.push({ kind: "deleteSection", name });
    }
  }

  if (proposals.length === 0) {
    return { proposals, note: "I couldn't match that request to an existing time block. Try naming the block or its time." };
  }
  return { proposals };
};

export const describeProposal = (p: BlockProposal): string => {
  const fmt24 = (min: number) => `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;
  if (p.kind === "addBlock") return `Add "${p.block.label}" ${fmt24(p.block.start_min)}-${fmt24(p.block.end_min)} (${p.block.type})`;
  if (p.kind === "updateBlock") return `Edit block #${p.id}: ${Object.keys(p.patch).join(", ")}`;
  if (p.kind === "createSection") return `Create section "${p.name}"`;
  if (p.kind === "deleteSection") return `Delete section "${p.name}"`;
  return `Delete block #${p.id}`;
};

export type AgentDef = {
  id: string;
  aliases: string[];
  description: string;
};

const agents: AgentDef[] = [
  { id: "help", aliases: ["?"], description: "list commands & what the agent can do" },
];

export const listAgents = (): AgentDef[] => agents;

export const findAgent = (token: string): AgentDef | undefined =>
  agents.find((a) => a.id === token || a.aliases.includes(token));

// Parse the first token of a command string. Returns { token, rest } or null if
// it isn't a command ("/..." or "@...").
export const parseInvocation = (text: string): { token: string; rest: string } | null => {
  if (!text || (text[0] !== "/" && text[0] !== "@")) return null;
  const m = text.match(/^[/@]([A-Za-z0-9_-]+)(?:\s+(.*))?$/s);
  if (!m) return null;
  return { token: m[1].toLowerCase(), rest: (m[2] ?? "").trim() };
};

export const helpText = (): string =>
  [
    "**Agent** can change your time blocks. Ask it to add, edit, or delete blocks for today.",
    "",
    "It will show you an **Approve** / **Reject** button before anything applies to your schedule.",
    "",
    "Commands:",
    "- `/help` — this list",
    "",
    "Examples:",
    "- \"add deep work 9-11\"",
    "- \"move the admin block to 2pm\"",
    "- \"delete the lunch block\"",
  ].join("\n");
