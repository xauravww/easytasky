import { create } from "zustand";
import { getDb, loadAll } from "../db/database";
import type { ActivityLog, HabitCheck, PomoSession, Subtask, Task, TimeBlock } from "../db/database";
import { dayKey, uid } from "../utils/time";
import { syncTaskReminders } from "../lib/notifications";
import { loadAiConfig } from "../lib/aiClient";

// Next due date for a repeat rule, given today's due key ("" when none applies).
const nextDueFor = (rule: string, from: string): string | null => {
  const [y, m, d] = from.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  let next: Date;
  switch (rule) {
    case "daily":
      next = new Date(base);
      next.setDate(base.getDate() + 1);
      break;
    case "weekly":
      next = new Date(base);
      next.setDate(base.getDate() + 7);
      break;
    case "monthly":
      next = new Date(base);
      next.setMonth(base.getMonth() + 1);
      break;
    default:
      return null;
  }
  return dayKey(next);
};

export type PomoPhase = "focus" | "break";
export type PomoMode = "pomodoro" | "stopwatch";

export type PomoState = {
  mode: PomoMode;
  running: boolean;
  phase: PomoPhase;
  focusMin: number;
  breakMin: number;
  taskId: string;
  left: number; // pomodoro: remaining seconds · stopwatch: elapsed seconds
  totalSec: number; // pomodoro: current phase total (0 for stopwatch)
  rounds: number;
  accFocusSec: number;
  endAt: number | null; // pomodoro: epoch ms target for the current phase
  startAt: number | null; // stopwatch: epoch ms the count-up started/resumed from
  remainMs: number; // pomodoro remaining ms (kept across pauses)
  completing: boolean;
};

type StoreState = {
  ready: boolean;
  tasks: Task[];
  logs: ActivityLog[];
  blocks: TimeBlock[];
  pomos: PomoSession[];
  habitChecks: HabitCheck[];
  subtasks: Subtask[];
  pomo: PomoState;
  focusReq: number;
  init: () => Promise<void>;
  toggleHabit: (habitId: string, day: string) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (id: string) => Promise<void>;
  deleteSubtask: (id: string) => Promise<void>;
  setFocusMin: (n: number) => void;
  setBreakMin: (n: number) => void;
  setTaskId: (id: string) => void;
  setMode: (m: PomoMode) => void;
  startFocusFor: (taskId: string) => void;
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
  completePomo: (focusSec: number, brkSec: number, rounds: number, taskId?: string) => Promise<void>;
};

const mapRows = <T,>(rows: T[]): T[] => rows;

export const useStore = create<StoreState>((set, get) => ({
  ready: false,
  tasks: [],
  logs: [],
  blocks: [],
  pomos: [],
  habitChecks: [],
  subtasks: [],
  focusReq: 0,
  pomo: {
    mode: "pomodoro" as PomoMode,
    running: false,
    phase: "focus" as PomoPhase,
    focusMin: 25,
    breakMin: 5,
    taskId: "",
    left: 1500,
    totalSec: 1500,
    rounds: 0,
    accFocusSec: 0,
    endAt: null,
    startAt: null,
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

  setMode: (m) => {
    const p = get().pomo;
    if (p.running || p.mode === m) return;
    set({
      pomo: {
        ...p,
        mode: m,
        phase: "focus",
        left: m === "pomodoro" ? p.focusMin * 60 : 0,
        totalSec: m === "pomodoro" ? p.focusMin * 60 : 0,
        remainMs: m === "pomodoro" ? p.focusMin * 60 * 1000 : 0,
        rounds: 0,
        accFocusSec: 0,
        endAt: null,
        startAt: null,
        completing: false,
      },
    });
  },

  // Cross-screen trigger: attach the task, bump focusReq so the App shell switches
  // to the immersive Focus screen, and start the timer if idle.
  startFocusFor: (taskId) => {
    const p = get().pomo;
    set({ pomo: { ...p, taskId }, focusReq: get().focusReq + 1 });
    if (!p.running) get().startPomo();
  },

  startPomo: () => {
    const p = get().pomo;
    if (p.running) return;
    if (p.mode === "stopwatch") {
      set({ pomo: { ...p, running: true, startAt: Date.now() - p.left * 1000, endAt: null } });
      return;
    }
    set({ pomo: { ...p, running: true, endAt: Date.now() + p.remainMs } });
  },

  pausePomo: () => {
    const p = get().pomo;
    if (!p.running) return;
    if (p.mode === "stopwatch") {
      const elapsed = Math.max(0, Math.round((Date.now() - (p.startAt ?? Date.now())) / 1000));
      set({ pomo: { ...p, running: false, left: elapsed, startAt: null } });
      return;
    }
    const remainMs = Math.max(0, (p.endAt ?? 0) - Date.now());
    set({ pomo: { ...p, running: false, remainMs, endAt: null } });
  },

  resetPomo: () =>
    set((state) => {
      const f = state.pomo.focusMin;
      const stopwatch = state.pomo.mode === "stopwatch";
      return {
        pomo: {
          ...state.pomo,
          running: false,
          phase: "focus",
          left: stopwatch ? 0 : f * 60,
          totalSec: stopwatch ? 0 : f * 60,
          remainMs: stopwatch ? 0 : f * 60 * 1000,
          rounds: 0,
          accFocusSec: 0,
          endAt: null,
          startAt: null,
          completing: false,
        },
      };
    }),

  finishPomo: async () => {
    const p = get().pomo;
    if (p.mode === "stopwatch") {
      // Exact seconds — even a few seconds of focus gets logged.
      if (p.left > 0) {
        await get().completePomo(p.left, 0, 1, p.taskId || undefined);
      }
      get().resetPomo();
      return;
    }
    const focusSec = p.accFocusSec + (p.phase === "focus" ? Math.max(0, p.totalSec - p.left) : 0);
    if (focusSec > 0 || p.rounds > 0) {
      await get().completePomo(focusSec, 0, Math.max(p.rounds, 1), p.taskId || undefined);
    }
    get().resetPomo();
  },

  tickPomo: () => {
    const p = get().pomo;
    if (!p.running) return;
    if (p.mode === "stopwatch") {
      const elapsed = Math.max(0, Math.round((Date.now() - (p.startAt ?? Date.now())) / 1000));
      if (elapsed !== p.left) set({ pomo: { ...p, left: elapsed } });
      return;
    }
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
    await loadAiConfig();
    set({ ...data, ready: true });
    void syncTaskReminders(get().tasks);
  },

  toggleHabit: async (habitId, day) => {
    const db = await getDb();
    const existing = get().habitChecks.find((c) => c.habit_id === habitId && c.day === day);
    if (existing) {
      await db.runAsync("DELETE FROM habit_checks WHERE habit_id = ? AND day = ?", [habitId, day]);
      set({ habitChecks: get().habitChecks.filter((c) => !(c.habit_id === habitId && c.day === day)) });
    } else {
      await db.runAsync("INSERT OR IGNORE INTO habit_checks (habit_id, day) VALUES (?,?)", [habitId, day]);
      const checks = await db.getAllAsync<HabitCheck>("SELECT * FROM habit_checks ORDER BY day");
      set({ habitChecks: mapRows(checks) });
    }
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
      note: t.note ?? null,
      repeat_rule: t.repeat_rule ?? null,
      remind_time: t.remind_time ?? null,
      is_habit: t.is_habit ?? 0,
      habit_freq: t.habit_freq ?? null,
      habit_days: t.habit_days ?? null,
      habit_color: t.habit_color ?? null,
    };
    await db.runAsync(
      `INSERT INTO tasks (id,title,context,energy,quadrant,status,delegate_note,created_at,due_date,estimated_min,actual_min,timebox_end,note,repeat_rule,remind_time,is_habit,habit_freq,habit_days,habit_color)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [task.id, task.title, task.context, task.energy, task.quadrant, task.status, task.delegate_note, task.created_at, task.due_date, task.estimated_min, task.actual_min, task.timebox_end, task.note, task.repeat_rule, task.remind_time, task.is_habit, task.habit_freq, task.habit_days, task.habit_color]
    );
    set({ tasks: [task, ...get().tasks] });
    void syncTaskReminders(get().tasks);
  },

  updateTask: async (id, patch) => {
    const db = await getDb();
    const cur = get().tasks.find((t) => t.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await db.runAsync(
      `UPDATE tasks SET title=?, context=?, energy=?, quadrant=?, status=?, delegate_note=?, due_date=?, estimated_min=?, actual_min=?, timebox_end=?, note=?, repeat_rule=?, remind_time=?, is_habit=?, habit_freq=?, habit_days=?, habit_color=? WHERE id=?`,
      [next.title, next.context, next.energy, next.quadrant, next.status, next.delegate_note, next.due_date, next.estimated_min, next.actual_min, next.timebox_end, next.note, next.repeat_rule ?? null, next.remind_time ?? null, next.is_habit ?? 0, next.habit_freq, next.habit_days, next.habit_color, id]
    );
    set({ tasks: get().tasks.map((t) => (t.id === id ? next : t)) });
    void syncTaskReminders(get().tasks);

    // Recurring: completing an open, repeating task spawns the next instance.
    if (next.status === "done" && cur.status !== "done" && next.repeat_rule && next.due_date) {
      const nextDue = nextDueFor(next.repeat_rule, next.due_date);
      if (nextDue) {
        const repeat: Task = {
          id: uid(),
          title: next.title,
          context: next.context,
          energy: next.energy,
          quadrant: next.quadrant,
          status: "inbox",
          delegate_note: next.delegate_note,
          created_at: Date.now(),
          due_date: nextDue,
          estimated_min: next.estimated_min,
          actual_min: null,
          timebox_end: null,
          note: next.note,
          repeat_rule: next.repeat_rule,
          remind_time: next.remind_time,
          is_habit: 0,
          habit_freq: null,
          habit_days: null,
          habit_color: null,
        };
        await db.runAsync(
          `INSERT INTO tasks (id,title,context,energy,quadrant,status,delegate_note,created_at,due_date,estimated_min,actual_min,timebox_end,note,repeat_rule,remind_time,is_habit,habit_freq,habit_days,habit_color)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [repeat.id, repeat.title, repeat.context, repeat.energy, repeat.quadrant, repeat.status, repeat.delegate_note, repeat.created_at, repeat.due_date, repeat.estimated_min, repeat.actual_min, repeat.timebox_end, repeat.note, repeat.repeat_rule, repeat.remind_time, repeat.is_habit, repeat.habit_freq, repeat.habit_days, repeat.habit_color]
        );
        set({ tasks: [repeat, ...get().tasks] });
        void syncTaskReminders(get().tasks);
      }
    }
  },

  deleteTask: async (id) => {
    const db = await getDb();
    await db.runAsync("DELETE FROM tasks WHERE id = ?", [id]);
    await db.runAsync("DELETE FROM habit_checks WHERE habit_id = ?", [id]);
    await db.runAsync("DELETE FROM subtasks WHERE task_id = ?", [id]);
    set({
      tasks: get().tasks.filter((t) => t.id !== id),
      habitChecks: get().habitChecks.filter((c) => c.habit_id !== id),
      subtasks: get().subtasks.filter((s) => s.task_id !== id),
    });
    void syncTaskReminders(get().tasks);
  },

  addSubtask: async (taskId, title) => {
    const db = await getDb();
    const st: Subtask = {
      id: uid(),
      task_id: taskId,
      title: title.trim(),
      done: 0,
      sort: get().subtasks.filter((s) => s.task_id === taskId).length,
      created_at: Date.now(),
    };
    if (!st.title) return;
    await db.runAsync("INSERT INTO subtasks (id,task_id,title,done,sort,created_at) VALUES (?,?,?,?,?,?)", [
      st.id, st.task_id, st.title, st.done, st.sort, st.created_at,
    ]);
    set({ subtasks: [...get().subtasks, st] });
  },

  toggleSubtask: async (id) => {
    const db = await getDb();
    const cur = get().subtasks.find((s) => s.id === id);
    if (!cur) return;
    const done = cur.done ? 0 : 1;
    await db.runAsync("UPDATE subtasks SET done=? WHERE id=?", [done, id]);
    set({ subtasks: get().subtasks.map((s) => (s.id === id ? { ...s, done } : s)) });
  },

  deleteSubtask: async (id) => {
    const db = await getDb();
    await db.runAsync("DELETE FROM subtasks WHERE id=?", [id]);
    set({ subtasks: get().subtasks.filter((s) => s.id !== id) });
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

  completePomo: async (focusSec, brkSec, rounds, taskId) => {
    const db = await getDb();
    const at = Date.now();
    await db.runAsync(
      "INSERT INTO pomodoro_sessions (task_id,focus_min,break_min,focus_sec,break_sec,rounds,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?)",
      [taskId ?? null, Math.round(focusSec / 60), Math.round(brkSec / 60), Math.round(focusSec), Math.round(brkSec), rounds, at, at]
    );
    if (taskId) {
      const t = get().tasks.find((x) => x.id === taskId);
      if (t) {
        const prev = t.actual_min ?? 0;
        await get().updateTask(taskId, { actual_min: prev + Math.round(focusSec / 60) });
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

// Current streak for a habit: consecutive checked days ending today (or yesterday
// if today is not yet checked — the streak survives until the day actually passes).
export const habitStreak = (checks: HabitCheck[], habitId: string): number => {
  const days = new Set(checks.filter((c) => c.habit_id === habitId).map((c) => c.day));
  const cur = new Date();
  if (!days.has(dayKey(cur))) {
    cur.setDate(cur.getDate() - 1);
    if (!days.has(dayKey(cur))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cur))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
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
