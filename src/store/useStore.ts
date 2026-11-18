import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDb, loadAll } from "../db/database";
import type {
  ActivityLog,
  DailyNote,
  HabitCheck,
  PomoSession,
  Section,
  ShutdownCheck,
  ShutdownRitual,
  Subtask,
  Task,
  TaskDependency,
  TimeBlock,
} from "../db/database";
import { dayKey, uid } from "../utils/time";
import { syncTaskReminders } from "../lib/notifications";
import { loadAiConfig } from "../lib/aiClient";
import { loadHeyGenKey } from "../lib/talk";

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
  sections: Section[];
  dependencies: TaskDependency[];
  dailyNotes: DailyNote[];
  shutdownRituals: ShutdownRitual[];
  shutdownChecks: ShutdownCheck[];
  pomo: PomoState;
  focusReq: number;
  taskFilter: string | null;
  sectionFilter: string | null;
  tasksReq: number;
  profile: string;
  init: () => Promise<void>;
  setProfile: (text: string) => Promise<void>;
  openTaskFilter: (q: string) => void;
  clearTaskFilter: () => void;
  setSectionFilter: (id: string | null) => void;
  toggleHabit: (habitId: string, day: string, value?: number) => Promise<void>;
  logHabitValue: (habitId: string, day: string, value: number) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (id: string) => Promise<void>;
  deleteSubtask: (id: string) => Promise<void>;
  // Sections CRUD
  addSection: (name: string, color?: string) => Promise<Section>;
  updateSection: (id: string, patch: Partial<Section>) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  // Dependencies
  addDependency: (taskId: string, dependsOnTaskId: string) => Promise<void>;
  removeDependency: (taskId: string, dependsOnTaskId: string) => Promise<void>;
  canCompleteTask: (taskId: string) => { allowed: boolean; blockingTasks: Task[] };
  // Daily Notes (Next Day Notebook)
  saveDailyNote: (day: string, content: string) => Promise<void>;
  getDailyNote: (day: string) => string;
  // Shutdown Rituals
  addShutdownRitual: (title: string) => Promise<void>;
  updateShutdownRitual: (id: string, patch: Partial<ShutdownRitual>) => Promise<void>;
  deleteShutdownRitual: (id: string) => Promise<void>;
  toggleShutdownCheck: (ritualId: string, day: string) => Promise<void>;
  // Backup / Restore
  exportDataJson: () => Promise<string>;
  importDataJson: (jsonStr: string) => Promise<{ success: boolean; error?: string }>;
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
  updateBlock: (id: number, patch: Partial<Omit<TimeBlock, "id">>) => Promise<void>;
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
  sections: [],
  dependencies: [],
  dailyNotes: [],
  shutdownRituals: [],
  shutdownChecks: [],
  focusReq: 0,
  taskFilter: null,
  sectionFilter: null,
  tasksReq: 0,
  profile: "",
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

  openTaskFilter: (q) => set({ taskFilter: q, tasksReq: get().tasksReq + 1 }),
  clearTaskFilter: () => set({ taskFilter: null }),
  setSectionFilter: (id) => set({ sectionFilter: id, tasksReq: get().tasksReq + 1 }),

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
    await loadHeyGenKey();
    let profile = "";
    try {
      profile = (await AsyncStorage.getItem("@easytasky/profile")) ?? "";
    } catch {}
    set({ ...data, ready: true, profile });
    void syncTaskReminders(get().tasks);
  },

  setProfile: async (text) => {
    set({ profile: text });
    try {
      await AsyncStorage.setItem("@easytasky/profile", text);
    } catch {}
  },

  toggleHabit: async (habitId, day, value = 1) => {
    const db = await getDb();
    const existing = get().habitChecks.find((c) => c.habit_id === habitId && c.day === day);
    if (existing) {
      await db.runAsync("DELETE FROM habit_checks WHERE habit_id = ? AND day = ?", [habitId, day]);
      set({ habitChecks: get().habitChecks.filter((c) => !(c.habit_id === habitId && c.day === day)) });
    } else {
      await db.runAsync("INSERT OR REPLACE INTO habit_checks (habit_id, day, value) VALUES (?,?,?)", [habitId, day, value]);
      const checks = await db.getAllAsync<HabitCheck>("SELECT * FROM habit_checks ORDER BY day");
      set({ habitChecks: mapRows(checks) });
    }
  },

  logHabitValue: async (habitId, day, value) => {
    const db = await getDb();
    if (value <= 0) {
      await db.runAsync("DELETE FROM habit_checks WHERE habit_id = ? AND day = ?", [habitId, day]);
      set({ habitChecks: get().habitChecks.filter((c) => !(c.habit_id === habitId && c.day === day)) });
    } else {
      await db.runAsync("INSERT OR REPLACE INTO habit_checks (habit_id, day, value) VALUES (?,?,?)", [habitId, day, value]);
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
      section_id: t.section_id ?? null,
      habit_type: t.habit_type ?? "boolean",
      habit_target_value: t.habit_target_value ?? 1,
      habit_unit: t.habit_unit ?? null,
    };
    await db.runAsync(
      `INSERT INTO tasks (id,title,context,energy,quadrant,status,delegate_note,created_at,due_date,estimated_min,actual_min,timebox_end,note,repeat_rule,remind_time,is_habit,habit_freq,habit_days,habit_color,section_id,habit_type,habit_target_value,habit_unit)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [task.id, task.title, task.context, task.energy, task.quadrant, task.status, task.delegate_note, task.created_at, task.due_date, task.estimated_min, task.actual_min, task.timebox_end, task.note, task.repeat_rule, task.remind_time, task.is_habit, task.habit_freq, task.habit_days, task.habit_color, task.section_id ?? null, task.habit_type ?? "boolean", task.habit_target_value ?? 1, task.habit_unit ?? null]
    );
    set({ tasks: [task, ...get().tasks] });
    void syncTaskReminders(get().tasks);
  },

  updateTask: async (id, patch) => {
    const db = await getDb();
    const cur = get().tasks.find((t) => t.id === id);
    if (!cur) return;

    // Prune history older than 7 days & save current state as history snapshot
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    try {
      await db.runAsync("DELETE FROM task_history WHERE updated_at < ?", [sevenDaysAgo]);
      await db.runAsync(
        "INSERT INTO task_history (task_id, snapshot, updated_at) VALUES (?, ?, ?)",
        [id, JSON.stringify(cur), now]
      );
    } catch {}

    const next = { ...cur, ...patch };
    await db.runAsync(
      `UPDATE tasks SET title=?, context=?, energy=?, quadrant=?, status=?, delegate_note=?, due_date=?, estimated_min=?, actual_min=?, timebox_end=?, note=?, repeat_rule=?, remind_time=?, is_habit=?, habit_freq=?, habit_days=?, habit_color=?, section_id=?, habit_type=?, habit_target_value=?, habit_unit=? WHERE id=?`,
      [next.title, next.context, next.energy, next.quadrant, next.status, next.delegate_note, next.due_date, next.estimated_min, next.actual_min, next.timebox_end, next.note, next.repeat_rule ?? null, next.remind_time ?? null, next.is_habit ?? 0, next.habit_freq, next.habit_days, next.habit_color, next.section_id ?? null, next.habit_type ?? "boolean", next.habit_target_value ?? 1, next.habit_unit ?? null, id]
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
    await db.runAsync("DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_task_id = ?", [id, id]);
    set({
      tasks: get().tasks.filter((t) => t.id !== id),
      habitChecks: get().habitChecks.filter((c) => c.habit_id !== id),
      subtasks: get().subtasks.filter((s) => s.task_id !== id),
      dependencies: get().dependencies.filter((d) => d.task_id !== id && d.depends_on_task_id !== id),
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

  updateBlock: async (id, patch) => {
    const db = await getDb();
    const cur = get().blocks.find((b) => b.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await db.runAsync(
      "UPDATE time_blocks SET day=?, start_min=?, end_min=?, label=?, type=?, buffer=? WHERE id=?",
      [next.day, next.start_min, next.end_min, next.label, next.type, next.buffer, id]
    );
    set({ blocks: get().blocks.map((b) => (b.id === id ? next : b)) });
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

  // ---- Sections CRUD ----
  addSection: async (name, color = "#0B6E46") => {
    const db = await getDb();
    const sec: Section = {
      id: uid(),
      name: name.trim(),
      color,
      sort: get().sections.length,
      created_at: Date.now(),
    };
    await db.runAsync("INSERT INTO sections (id, name, color, sort, created_at) VALUES (?, ?, ?, ?, ?)", [
      sec.id,
      sec.name,
      sec.color,
      sec.sort,
      sec.created_at,
    ]);
    set({ sections: [...get().sections, sec] });
    return sec;
  },

  updateSection: async (id, patch) => {
    const db = await getDb();
    const cur = get().sections.find((s) => s.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await db.runAsync("UPDATE sections SET name = ?, color = ?, sort = ? WHERE id = ?", [
      next.name,
      next.color,
      next.sort,
      id,
    ]);
    set({ sections: get().sections.map((s) => (s.id === id ? next : s)) });
  },

  deleteSection: async (id) => {
    const db = await getDb();
    await db.runAsync("DELETE FROM sections WHERE id = ?", [id]);
    await db.runAsync("UPDATE tasks SET section_id = NULL WHERE section_id = ?", [id]);
    set({
      sections: get().sections.filter((s) => s.id !== id),
      tasks: get().tasks.map((t) => (t.section_id === id ? { ...t, section_id: null } : t)),
    });
  },

  // ---- Task Dependencies ----
  addDependency: async (taskId, dependsOnTaskId) => {
    if (taskId === dependsOnTaskId) return;
    const db = await getDb();
    const id = uid();
    await db.runAsync("INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_task_id) VALUES (?, ?, ?)", [
      id,
      taskId,
      dependsOnTaskId,
    ]);
    const deps = await db.getAllAsync<TaskDependency>("SELECT * FROM task_dependencies");
    set({ dependencies: mapRows(deps) });
  },

  removeDependency: async (taskId, dependsOnTaskId) => {
    const db = await getDb();
    await db.runAsync("DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?", [
      taskId,
      dependsOnTaskId,
    ]);
    set({
      dependencies: get().dependencies.filter(
        (d) => !(d.task_id === taskId && d.depends_on_task_id === dependsOnTaskId)
      ),
    });
  },

  canCompleteTask: (taskId) => {
    const { tasks, dependencies } = get();
    const blockerDepIds = dependencies.filter((d) => d.task_id === taskId).map((d) => d.depends_on_task_id);
    if (blockerDepIds.length === 0) return { allowed: true, blockingTasks: [] };
    const blockingTasks = tasks.filter((t) => blockerDepIds.includes(t.id) && t.status !== "done");
    return {
      allowed: blockingTasks.length === 0,
      blockingTasks,
    };
  },

  // ---- Daily Notes (Next Day Notebook) ----
  saveDailyNote: async (day, content) => {
    const db = await getDb();
    const existing = get().dailyNotes.find((n) => n.day === day);
    const now = Date.now();
    if (existing) {
      await db.runAsync("UPDATE daily_notes SET content = ?, updated_at = ? WHERE day = ?", [content, now, day]);
      set({
        dailyNotes: get().dailyNotes.map((n) => (n.day === day ? { ...n, content, updated_at: now } : n)),
      });
    } else {
      const id = uid();
      await db.runAsync("INSERT INTO daily_notes (id, day, content, updated_at) VALUES (?, ?, ?, ?)", [
        id,
        day,
        content,
        now,
      ]);
      set({ dailyNotes: [{ id, day, content, updated_at: now }, ...get().dailyNotes] });
    }
  },

  getDailyNote: (day) => {
    return get().dailyNotes.find((n) => n.day === day)?.content ?? "";
  },

  // ---- Shutdown Rituals ----
  addShutdownRitual: async (title) => {
    const clean = title.trim();
    if (!clean) return;
    const db = await getDb();
    const id = uid();
    const ritual: ShutdownRitual = {
      id,
      title: clean,
      sort: get().shutdownRituals.length,
      enabled: 1,
    };
    await db.runAsync("INSERT INTO shutdown_rituals (id, title, sort, enabled) VALUES (?, ?, ?, ?)", [
      ritual.id,
      ritual.title,
      ritual.sort,
      ritual.enabled,
    ]);
    set({ shutdownRituals: [...get().shutdownRituals, ritual] });
  },

  updateShutdownRitual: async (id, patch) => {
    const db = await getDb();
    const cur = get().shutdownRituals.find((r) => r.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await db.runAsync("UPDATE shutdown_rituals SET title = ?, sort = ?, enabled = ? WHERE id = ?", [
      next.title,
      next.sort,
      next.enabled,
      id,
    ]);
    set({ shutdownRituals: get().shutdownRituals.map((r) => (r.id === id ? next : r)) });
  },

  deleteShutdownRitual: async (id) => {
    const db = await getDb();
    await db.runAsync("DELETE FROM shutdown_rituals WHERE id = ?", [id]);
    await db.runAsync("DELETE FROM shutdown_checks WHERE ritual_id = ?", [id]);
    set({
      shutdownRituals: get().shutdownRituals.filter((r) => r.id !== id),
      shutdownChecks: get().shutdownChecks.filter((c) => c.ritual_id !== id),
    });
  },

  toggleShutdownCheck: async (ritualId, day) => {
    const db = await getDb();
    const existing = get().shutdownChecks.find((c) => c.ritual_id === ritualId && c.day === day);
    if (existing) {
      await db.runAsync("DELETE FROM shutdown_checks WHERE ritual_id = ? AND day = ?", [ritualId, day]);
      set({ shutdownChecks: get().shutdownChecks.filter((c) => !(c.ritual_id === ritualId && c.day === day)) });
    } else {
      await db.runAsync("INSERT OR IGNORE INTO shutdown_checks (ritual_id, day) VALUES (?, ?)", [ritualId, day]);
      const checks = await db.getAllAsync<ShutdownCheck>("SELECT * FROM shutdown_checks ORDER BY day");
      set({ shutdownChecks: mapRows(checks) });
    }
  },

  // ---- Backup & Restore ----
  exportDataJson: async () => {
    const state = get();
    const dump = {
      version: 2,
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
      logs: state.logs,
      blocks: state.blocks,
      pomos: state.pomos,
      habitChecks: state.habitChecks,
      subtasks: state.subtasks,
      sections: state.sections,
      dependencies: state.dependencies,
      dailyNotes: state.dailyNotes,
      shutdownRituals: state.shutdownRituals,
      shutdownChecks: state.shutdownChecks,
      profile: state.profile,
    };
    return JSON.stringify(dump, null, 2);
  },

  importDataJson: async (jsonStr) => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== "object") {
        return { success: false, error: "Invalid backup JSON format." };
      }
      const db = await getDb();
      // Clear and re-populate
      await db.execAsync(`
        DELETE FROM tasks;
        DELETE FROM habit_checks;
        DELETE FROM subtasks;
        DELETE FROM activity_log;
        DELETE FROM time_blocks;
        DELETE FROM pomodoro_sessions;
        DELETE FROM sections;
        DELETE FROM task_dependencies;
        DELETE FROM daily_notes;
        DELETE FROM shutdown_rituals;
        DELETE FROM shutdown_checks;
      `);

      if (Array.isArray(data.tasks)) {
        for (const t of data.tasks) {
          await db.runAsync(
            `INSERT INTO tasks (id,title,context,energy,quadrant,status,delegate_note,created_at,due_date,estimated_min,actual_min,timebox_end,note,repeat_rule,remind_time,is_habit,habit_freq,habit_days,habit_color,section_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [t.id, t.title, t.context ?? "", t.energy ?? "medium", t.quadrant ?? null, t.status ?? "inbox", t.delegate_note ?? null, t.created_at ?? Date.now(), t.due_date ?? null, t.estimated_min ?? null, t.actual_min ?? null, t.timebox_end ?? null, t.note ?? null, t.repeat_rule ?? null, t.remind_time ?? null, t.is_habit ?? 0, t.habit_freq ?? null, t.habit_days ?? null, t.habit_color ?? null, t.section_id ?? null]
          );
        }
      }
      if (Array.isArray(data.subtasks)) {
        for (const s of data.subtasks) {
          await db.runAsync("INSERT INTO subtasks (id,task_id,title,done,sort,created_at) VALUES (?,?,?,?,?,?)", [
            s.id, s.task_id, s.title, s.done ?? 0, s.sort ?? 0, s.created_at ?? Date.now()
          ]);
        }
      }
      if (Array.isArray(data.habitChecks)) {
        for (const h of data.habitChecks) {
          await db.runAsync("INSERT OR IGNORE INTO habit_checks (habit_id, day) VALUES (?,?)", [h.habit_id, h.day]);
        }
      }
      if (Array.isArray(data.blocks)) {
        for (const b of data.blocks) {
          await db.runAsync(
            "INSERT INTO time_blocks (day,start_min,end_min,label,type,buffer) VALUES (?,?,?,?,?,?)",
            [b.day, b.start_min, b.end_min, b.label, b.type, b.buffer ?? 0]
          );
        }
      }
      if (Array.isArray(data.sections)) {
        for (const sec of data.sections) {
          await db.runAsync("INSERT INTO sections (id, name, color, sort, created_at) VALUES (?, ?, ?, ?, ?)", [
            sec.id, sec.name, sec.color ?? "#0B6E46", sec.sort ?? 0, sec.created_at ?? Date.now()
          ]);
        }
      }
      if (Array.isArray(data.dependencies)) {
        for (const dep of data.dependencies) {
          await db.runAsync("INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_task_id) VALUES (?, ?, ?)", [
            dep.id ?? uid(), dep.task_id, dep.depends_on_task_id
          ]);
        }
      }
      if (Array.isArray(data.dailyNotes)) {
        for (const dn of data.dailyNotes) {
          await db.runAsync("INSERT INTO daily_notes (id, day, content, updated_at) VALUES (?, ?, ?, ?)", [
            dn.id ?? uid(), dn.day, dn.content, dn.updated_at ?? Date.now()
          ]);
        }
      }
      if (Array.isArray(data.shutdownRituals)) {
        for (const sr of data.shutdownRituals) {
          await db.runAsync("INSERT INTO shutdown_rituals (id, title, sort, enabled) VALUES (?, ?, ?, ?)", [
            sr.id, sr.title, sr.sort ?? 0, sr.enabled ?? 1
          ]);
        }
      }
      if (Array.isArray(data.shutdownChecks)) {
        for (const sc of data.shutdownChecks) {
          await db.runAsync("INSERT OR IGNORE INTO shutdown_checks (ritual_id, day) VALUES (?, ?)", [
            sc.ritual_id, sc.day
          ]);
        }
      }

      await get().init();
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
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

// Current streak and best (longest) streak for a habit.
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

// Best (all-time longest) streak for a habit.
export const habitBestStreak = (checks: HabitCheck[], habitId: string): number => {
  const sortedDays = Array.from(new Set(checks.filter((c) => c.habit_id === habitId).map((c) => c.day))).sort();
  if (sortedDays.length === 0) return 0;
  let best = 1;
  let current = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const next = new Date(sortedDays[i]);
    const diffDays = Math.round((next.getTime() - prev.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
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
