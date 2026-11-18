import type { TimeBlock } from "../db/database";
import { dayKey } from "../utils/time";
import type { ToolCall } from "./aiClient";

// Proposals/actions for any section of EasyTasky
export type BlockProposal =
  | { kind: "addBlock"; block: Omit<TimeBlock, "id"> }
  | { kind: "updateBlock"; id: number; patch: Partial<Omit<TimeBlock, "id">> }
  | { kind: "deleteBlock"; id: number }
  | { kind: "createSection"; name: string; color?: string }
  | { kind: "deleteSection"; name: string }
  | { kind: "addTask"; task: { title: string; context?: string; energy?: string; quadrant?: string; due_date?: string; estimated_min?: number; note?: string; section_name?: string } }
  | { kind: "updateTask"; find: string; patch: Record<string, unknown> }
  | { kind: "deleteTask"; find: string }
  | { kind: "completeTask"; find: string }
  | { kind: "addSubtask"; taskFind: string; title: string }
  | { kind: "toggleSubtask"; subtaskTitle: string }
  | { kind: "addHabit"; habit: { title: string; habit_type?: string; target_value?: number; unit?: string; color?: string; freq?: string } }
  | { kind: "logHabit"; find: string; value: number }
  | { kind: "deleteHabit"; find: string }
  | { kind: "addShutdownRitual"; title: string }
  | { kind: "deleteShutdownRitual"; find: string }
  | { kind: "toggleShutdownRitual"; find: string }
  | { kind: "startFocusTimer"; taskFind?: string; durationMin?: number }
  | { kind: "stopFocusTimer"; action: "pause" | "reset" }
  | { kind: "saveDailyNote"; day?: string; content: string }
  | { kind: "updateUserProfile"; profile: string };

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
    } else if (c.name === "add_task") {
      const title = typeof c.args.title === "string" ? c.args.title.trim() : "";
      if (title) {
        proposals.push({
          kind: "addTask",
          task: {
            title,
            context: typeof c.args.context === "string" ? c.args.context.trim() : undefined,
            energy: typeof c.args.energy === "string" ? c.args.energy : undefined,
            quadrant: typeof c.args.quadrant === "string" ? c.args.quadrant : undefined,
            due_date: typeof c.args.due_date === "string" ? c.args.due_date : undefined,
            estimated_min: typeof c.args.estimated_min === "number" ? c.args.estimated_min : undefined,
            note: typeof c.args.note === "string" ? c.args.note : undefined,
            section_name: typeof c.args.section_name === "string" ? c.args.section_name.trim() : undefined,
          },
        });
      }
    } else if (c.name === "update_task") {
      const find = typeof c.args.find === "string" ? c.args.find.trim() : "";
      if (find) {
        const patch: Record<string, unknown> = {};
        if (typeof c.args.title === "string") patch.title = c.args.title;
        if (typeof c.args.status === "string") patch.status = c.args.status;
        if (typeof c.args.due_date === "string") patch.due_date = c.args.due_date;
        if (typeof c.args.energy === "string") patch.energy = c.args.energy;
        if (typeof c.args.quadrant === "string") patch.quadrant = c.args.quadrant;
        if (typeof c.args.estimated_min === "number") patch.estimated_min = c.args.estimated_min;
        if (typeof c.args.actual_min === "number") patch.actual_min = c.args.actual_min;
        if (typeof c.args.note === "string") patch.note = c.args.note;
        proposals.push({ kind: "updateTask", find, patch });
      }
    } else if (c.name === "delete_task") {
      const find = typeof c.args.find === "string" ? c.args.find.trim() : "";
      if (find) proposals.push({ kind: "deleteTask", find });
    } else if (c.name === "complete_task") {
      const find = typeof c.args.find === "string" ? c.args.find.trim() : "";
      if (find) proposals.push({ kind: "completeTask", find });
    } else if (c.name === "add_subtask") {
      const taskFind = typeof c.args.task_find === "string" ? c.args.task_find.trim() : "";
      const title = typeof c.args.title === "string" ? c.args.title.trim() : "";
      if (taskFind && title) proposals.push({ kind: "addSubtask", taskFind, title });
    } else if (c.name === "toggle_subtask") {
      const subtaskTitle = typeof c.args.subtask_title === "string" ? c.args.subtask_title.trim() : "";
      if (subtaskTitle) proposals.push({ kind: "toggleSubtask", subtaskTitle });
    } else if (c.name === "add_habit") {
      const title = typeof c.args.title === "string" ? c.args.title.trim() : "";
      if (title) {
        proposals.push({
          kind: "addHabit",
          habit: {
            title,
            habit_type: typeof c.args.habit_type === "string" ? c.args.habit_type : undefined,
            target_value: typeof c.args.target_value === "number" ? c.args.target_value : undefined,
            unit: typeof c.args.unit === "string" ? c.args.unit : undefined,
            color: typeof c.args.color === "string" ? c.args.color : undefined,
            freq: typeof c.args.freq === "string" ? c.args.freq : undefined,
          },
        });
      }
    } else if (c.name === "log_habit") {
      const find = typeof c.args.find === "string" ? c.args.find.trim() : "";
      const value = typeof c.args.value === "number" ? c.args.value : 1;
      if (find) proposals.push({ kind: "logHabit", find, value });
    } else if (c.name === "delete_habit") {
      const find = typeof c.args.find === "string" ? c.args.find.trim() : "";
      if (find) proposals.push({ kind: "deleteHabit", find });
    } else if (c.name === "add_shutdown_ritual") {
      const title = typeof c.args.title === "string" ? c.args.title.trim() : "";
      if (title) proposals.push({ kind: "addShutdownRitual", title });
    } else if (c.name === "delete_shutdown_ritual") {
      const find = typeof c.args.find === "string" ? c.args.find.trim() : "";
      if (find) proposals.push({ kind: "deleteShutdownRitual", find });
    } else if (c.name === "toggle_shutdown_ritual") {
      const find = typeof c.args.find === "string" ? c.args.find.trim() : "";
      if (find) proposals.push({ kind: "toggleShutdownRitual", find });
    } else if (c.name === "start_focus_timer") {
      const taskFind = typeof c.args.task_find === "string" ? c.args.task_find.trim() : undefined;
      const durationMin = typeof c.args.duration_min === "number" ? c.args.duration_min : undefined;
      proposals.push({ kind: "startFocusTimer", taskFind, durationMin });
    } else if (c.name === "stop_focus_timer") {
      const action = c.args.action === "reset" ? "reset" : "pause";
      proposals.push({ kind: "stopFocusTimer", action });
    } else if (c.name === "save_daily_note") {
      const content = typeof c.args.content === "string" ? c.args.content.trim() : "";
      const day = typeof c.args.day === "string" ? c.args.day.trim() : undefined;
      if (content) proposals.push({ kind: "saveDailyNote", content, day });
    } else if (c.name === "update_user_profile") {
      const profile = typeof c.args.profile === "string" ? c.args.profile.trim() : "";
      if (profile) proposals.push({ kind: "updateUserProfile", profile });
    }
  }

  if (proposals.length === 0) {
    return { proposals, note: "I could not process that action. Please check the details." };
  }
  return { proposals };
};

export const describeProposal = (p: BlockProposal): string => {
  const fmt24 = (min: number) => `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;
  if (p.kind === "addBlock") return `Add "${p.block.label}" ${fmt24(p.block.start_min)}-${fmt24(p.block.end_min)} (${p.block.type})`;
  if (p.kind === "updateBlock") return `Edit block #${p.id}: ${Object.keys(p.patch).join(", ")}`;
  if (p.kind === "createSection") return `Create section "${p.name}"`;
  if (p.kind === "deleteSection") return `Delete section "${p.name}"`;
  if (p.kind === "deleteBlock") return `Delete block #${p.id}`;
  if (p.kind === "addTask") return `Add task "${p.task.title}"`;
  if (p.kind === "updateTask") return `Update task "${p.find}"`;
  if (p.kind === "deleteTask") return `Delete task "${p.find}"`;
  if (p.kind === "completeTask") return `Complete task "${p.find}"`;
  if (p.kind === "addSubtask") return `Add subtask "${p.title}"`;
  if (p.kind === "toggleSubtask") return `Toggle subtask "${p.subtaskTitle}"`;
  if (p.kind === "addHabit") return `Add habit "${p.habit.title}"`;
  if (p.kind === "logHabit") return `Log habit "${p.find}" (${p.value})`;
  if (p.kind === "deleteHabit") return `Delete habit "${p.find}"`;
  if (p.kind === "addShutdownRitual") return `Add shutdown ritual "${p.title}"`;
  if (p.kind === "deleteShutdownRitual") return `Delete shutdown ritual "${p.find}"`;
  if (p.kind === "toggleShutdownRitual") return `Toggle shutdown ritual "${p.find}"`;
  if (p.kind === "startFocusTimer") return `Start focus timer${p.durationMin ? ` (${p.durationMin} min)` : ""}`;
  if (p.kind === "stopFocusTimer") return `${p.action === "reset" ? "Reset" : "Pause"} focus timer`;
  if (p.kind === "saveDailyNote") return `Save daily note`;
  if (p.kind === "updateUserProfile") return `Update profile`;
  return "Execute action";
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
