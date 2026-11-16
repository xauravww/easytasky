import { create } from "zustand";
import { getDb, loadAll } from "../db/database";
import type { ActivityLog, PomoSession, Task, TimeBlock } from "../db/database";
import { uid } from "../utils/time";

export type PomoPhase = "focus" | "break";

export type PomoState = {
  running: boolean;
  phase: PomoPhase;
  focusMin: number;
  breakMin: number;
  taskId: string;
  left: number; // displayed remaining seconds
  totalSec: number; // current phase total seconds
  rounds: number;
  accFocusSec: number;
  endAt: number | null; // epoch ms target for the current phase
  remainMs: number; // remaining ms (kept across pauses)
  completing: boolean;
};

type StoreState = {
  ready: boolean;
  tasks: Task[];
  logs: ActivityLog[];
  blocks: TimeBlock[];
  pomos: PomoSession[];
  pomo: PomoState;
  init: () => Promise<void>;
  setFocusMin: (n: number) => void;
  setBreakMin: (n: number) => void;
  setTaskId: (id: string) => void;
  startPomo: () => void;
  pausePomo: () => void;
  resetPomo: () => void;
  finishPomo: () => Promise<void>;
  tickPomo: () => void;
  addTask: (t: Partial<Task> & { title: string }) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addBlock: (b: Omit<TimeBlock, "id">) => Promise<void>;
  deleteBlock: (id: number) => Promise<void>;
  addLog: (l: Omit<ActivityLog, "id">) => Promise<void>;
  completePomo: (focus: number, brk: number, rounds: number, taskId?: string) => Promise<void>;
};

const mapRows = <T,>(rows: T[]): T[] => rows;

export const useStore = create<StoreState>((set, get) => ({
  ready: false,
  tasks: [],
  logs: [],
  blocks: [],
  pomos: [],
  pomo: {
    running: false,
    phase: "focus",
    focusMin: 25,
    breakMin: 5,
    taskId: "",
    left: 1500,
    totalSec: 1500,
    rounds: 0,
    accFocusSec: 0,
    endAt: null,
    remainMs: 1500 * 1000,
    completing: false,
  },

  setFocusMin: (n) => {
    const p = get().pomo;
    if (!p.running && p.phase === "focus") {
      set({
        pomo: {
          ...p,
          focusMin: n,
          left: n * 60,
          totalSec: n * 60,
          remainMs: n * 60 * 1000,
        },
      });
    } else {
      set({ pomo: { ...p, focusMin: n } });
    }
  },

  setBreakMin: (n) => set({ pomo: { ...get().pomo, breakMin: n } }),

  setTaskId: (id) => set({ pomo: { ...get().pomo, taskId: id } }),

  startPomo: () => {
    const p = get().pomo;
    if (p.running) return;
    set({ pomo: { ...p, running: true, endAt: Date.now() + p.remainMs } });
  },

  pausePomo: () => {
    const p = get().pomo;
    if (!p.running) return;
    const remainMs = Math.max(0, (p.endAt ?? 0) - Date.now());
    set({ pomo: { ...p, running: false, remainMs, endAt: null } });
  },

  resetPomo: () =>
    set((state) => {
      const f = state.pomo.focusMin;
      return {
        pomo: {
          ...state.pomo,
          running: false,
          phase: "focus",
          left: f * 60,
          totalSec: f * 60,
          remainMs: f * 60 * 1000,
          rounds: 0,
          accFocusSec: 0,
          endAt: null,
          completing: false,
        },
      };
    }),

  finishPomo: async () => {
    const p = get().pomo;
    const minutes = Math.round(p.accFocusSec / 60);
    if (minutes > 0 || p.rounds > 0) {
      await get().completePomo(p.focusMin, p.breakMin, Math.max(p.rounds, 1), p.taskId || undefined);
    }
    get().resetPomo();
  },

  tickPomo: () => {
    const p = get().pomo;
    if (!p.running) return;
    const remain = Math.max(0, Math.round(((p.endAt ?? 0) - Date.now()) / 1000));
    if (remain === p.left && remain > 0) return;
    if (remain <= 0 && !p.completing) {
      const next = { ...p, completing: true };
      if (next.phase === "focus") {
        next.accFocusSec += next.focusMin * 60;
        next.rounds += 1;
        next.phase = "break";
        next.left = next.breakMin * 60;
        next.totalSec = next.breakMin * 60;
        next.remainMs = next.breakMin * 1000;
      } else {
        next.phase = "focus";
        next.left = next.focusMin * 60;
        next.totalSec = next.focusMin * 60;
        next.remainMs = next.focusMin * 1000;
      }
      next.endAt = Date.now() + next.remainMs;
      set({ pomo: next });
      setTimeout(() => set((s) => ({ pomo: { ...s.pomo, completing: false } })), 60);
      return;
    }
    if (remain !== p.left) {
      set({ pomo: { ...p, left: remain } });
    }
  },

  init: async () => {
    const db = await getDb();
    const data = await loadAll(db);
    set({ ...data, ready: true });
  },

  addTask: async (t) => {
    const db = await getDb();
    const task: Task = {
      id: uid(),
      title: t.title,
      context: t.context ?? "",
      energy: t.energy ?? "medium",
      quadrant: t.quadrant ?? null,
      status: t.status ?? "inbox",
      delegate_note: t.delegate_note ?? null,
      created_at: Date.now(),
      due_date: t.due_date ?? null,
      estimated_min: t.estimated_min ?? null,
      actual_min: null,
      timebox_end: t.timebox_end ?? null,
      is_habit: t.is_habit ?? 0,
    };
    await db.runAsync(
      `INSERT INTO tasks (id,title,context,energy,quadrant,status,delegate_note,created_at,due_date,estimated_min,actual_min,timebox_end,is_habit)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [task.id, task.title, task.context, task.energy, task.quadrant, task.status, task.delegate_note, task.created_at, task.due_date, task.estimated_min, task.actual_min, task.timebox_end, task.is_habit]
    );
    set({ tasks: [task, ...get().tasks] });
  },

  updateTask: async (id, patch) => {
    const db = await getDb();
    const cur = get().tasks.find((t) => t.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await db.runAsync(
      `UPDATE tasks SET title=?, context=?, energy=?, quadrant=?, status=?, delegate_note=?, due_date=?, estimated_min=?, actual_min=?, timebox_end=?, is_habit=? WHERE id=?`,
      [next.title, next.context, next.energy, next.quadrant, next.status, next.delegate_note, next.due_date, next.estimated_min, next.actual_min, next.timebox_end, next.is_habit ?? 0, id]
    );
    set({ tasks: get().tasks.map((t) => (t.id === id ? next : t)) });
  },

  deleteTask: async (id) => {
    const db = await getDb();
    await db.runAsync("DELETE FROM tasks WHERE id = ?", [id]);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  },

  addBlock: async (b) => {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO time_blocks (day,start_min,end_min,label,type,buffer) VALUES (?,?,?,?,?,?)",
      [b.day, b.start_min, b.end_min, b.label, b.type, b.buffer]
    );
    const blocks = await db.getAllAsync<TimeBlock>("SELECT * FROM time_blocks ORDER BY day, start_min");
    set({ blocks: mapRows(blocks) });
  },

  deleteBlock: async (id) => {
    const db = await getDb();
    await db.runAsync("DELETE FROM time_blocks WHERE id = ?", [id]);
    set({ blocks: get().blocks.filter((b) => b.id !== id) });
  },

  addLog: async (l) => {
    const db = await getDb();
    await db.runAsync("INSERT INTO activity_log (task_id,action,at,minutes) VALUES (?,?,?,?)", [
      l.task_id ?? null,
      l.action,
      l.at,
      l.minutes ?? 0,
    ]);
    const logs = await db.getAllAsync<ActivityLog>("SELECT * FROM activity_log ORDER BY at");
    set({ logs: mapRows(logs) });
  },

  completePomo: async (focus, brk, rounds, taskId) => {
    const db = await getDb();
    const at = Date.now();
    await db.runAsync(
      "INSERT INTO pomodoro_sessions (task_id,focus_min,break_min,rounds,started_at,completed_at) VALUES (?,?,?,?,?,?)",
      [taskId ?? null, focus, brk, rounds, at, at]
    );
    if (taskId) {
      const t = get().tasks.find((x) => x.id === taskId);
      if (t) {
        const prev = t.actual_min ?? 0;
        await get().updateTask(taskId, { actual_min: prev + focus * rounds });
      }
    }
    const pomos = await db.getAllAsync<PomoSession>("SELECT * FROM pomodoro_sessions ORDER BY started_at");
    set({ pomos: mapRows(pomos) });
  },
}));

// Background Pomodoro engine: keeps the timer ticking (and accurate) even when the
// Focus screen is unmounted (e.g. the user switches tabs). Runs continuously.
setInterval(() => {
  useStore.getState().tickPomo();
}, 250);

// ---- Derived analytics ----

// Peak-time detection: aggregate activity minutes by hour of day, return the top
// contiguous productive windows across the whole history.
export const getPeakHours = (logs: ActivityLog[]): { hour: number; minutes: number }[] => {
  const byHour = new Map<number, number>();
  for (const l of logs) {
    const h = new Date(l.at).getHours();
    byHour.set(h, (byHour.get(h) ?? 0) + (l.minutes || 0));
  }
  const arr = Array.from(byHour.entries())
    .map(([hour, minutes]) => ({ hour, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
  return arr.slice(0, 5);
};

// Reference-based estimate: find previously completed tasks whose title shares a
// keyword, average their actual minutes, then add a 25% buffer.
export const estimateForTitle = (tasks: Task[], title: string): number | null => {
  const words = title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  if (words.length === 0) return null;
  const completed = tasks.filter((t) => t.status === "done" && t.actual_min);
  const matches = completed.filter((t) => words.some((w) => t.title.toLowerCase().includes(w)));
  if (matches.length === 0) return null;
  const avg = matches.reduce((s, t) => s + (t.actual_min || 0), 0) / matches.length;
  return Math.round(avg * 1.25);
};

// Daily audit aggregate: minutes of logged activity per day for the last `days`.
export const auditByDay = (logs: ActivityLog[], days = 7): { day: string; minutes: number }[] => {
  const out: { day: string; minutes: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
    const minutes = logs
      .filter((l) => new Date(l.at).toDateString() === d.toDateString())
      .reduce((s, l) => s + (l.minutes || 0), 0);
    out.push({ day: key, minutes });
  }
  return out;
};
