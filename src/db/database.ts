import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { dayKey, uid } from "../utils/time";

export type Task = {
  id: string;
  title: string;
  context: string;
  energy: "low" | "medium" | "high";
  quadrant: string | null;
  status: string;
  delegate_note: string | null;
  created_at: number;
  due_date: string | null;
  estimated_min: number | null;
  actual_min: number | null;
  timebox_end: number | null;
  note: string | null;
  repeat_rule: string | null;
  is_habit: number;
  habit_freq: string | null;
  habit_days: string | null;
  habit_color: string | null;
};

export type ActivityLog = {
  id: number;
  task_id: string | null;
  action: string;
  at: number;
  minutes: number;
};

export type TimeBlock = {
  id: number;
  day: string;
  start_min: number;
  end_min: number;
  label: string;
  type: string;
  buffer: number;
};

export type PomoSession = {
  id: number;
  task_id: string | null;
  focus_min: number;
  break_min: number;
  focus_sec: number;
  break_sec: number;
  rounds: number;
  started_at: number;
  completed_at: number | null;
};

export type HabitCheck = {
  id: number;
  habit_id: string;
  day: string; // YYYY-MM-DD
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  done: number;
  sort: number;
  created_at: number;
};

export type DBData = {
  tasks: Task[];
  logs: ActivityLog[];
  blocks: TimeBlock[];
  pomos: PomoSession[];
  habitChecks: HabitCheck[];
  subtasks: Subtask[];
};

let db: SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLiteDatabase> => {
  if (db) return db;
  db = await openDatabaseAsync("easytasky.db");
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      context TEXT DEFAULT '',
      energy TEXT DEFAULT 'medium',
      quadrant TEXT,
      status TEXT DEFAULT 'inbox',
      delegate_note TEXT,
      created_at INTEGER NOT NULL,
      due_date TEXT,
      estimated_min INTEGER,
      actual_min INTEGER,
      timebox_end INTEGER,
      note TEXT,
      repeat_rule TEXT,
      is_habit INTEGER DEFAULT 0,
      habit_freq TEXT,
      habit_days TEXT,
      habit_color TEXT
    );
    CREATE TABLE IF NOT EXISTS habit_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id TEXT NOT NULL,
      day TEXT NOT NULL,
      UNIQUE(habit_id, day)
    );
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      sort INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT,
      action TEXT NOT NULL,
      at INTEGER NOT NULL,
      minutes INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS time_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      end_min INTEGER NOT NULL,
      label TEXT DEFAULT '',
      type TEXT DEFAULT 'batch',
      buffer REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT,
      focus_min INTEGER DEFAULT 25,
      break_min INTEGER DEFAULT 5,
      focus_sec INTEGER DEFAULT 0,
      break_sec INTEGER DEFAULT 0,
      rounds INTEGER DEFAULT 1,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);
  // Migration for databases created before the is_habit column existed.
  try {
    await db.execAsync("ALTER TABLE tasks ADD COLUMN is_habit INTEGER DEFAULT 0");
  } catch {}
  // Migrations for databases created before the habit columns existed.
  try {
    await db.execAsync("ALTER TABLE tasks ADD COLUMN habit_freq TEXT");
  } catch {}
  try {
    await db.execAsync("ALTER TABLE tasks ADD COLUMN habit_days TEXT");
  } catch {}
  try {
    await db.execAsync("ALTER TABLE tasks ADD COLUMN habit_color TEXT");
  } catch {}
  // Migration for databases created before the note column existed.
  try {
    await db.execAsync("ALTER TABLE tasks ADD COLUMN note TEXT");
  } catch {}
  // Migration for databases created before the repeat_rule column existed.
  try {
    await db.execAsync("ALTER TABLE tasks ADD COLUMN repeat_rule TEXT");
  } catch {}
  // Migrations for databases created before the exact-second session columns.
  try {
    await db.execAsync("ALTER TABLE pomodoro_sessions ADD COLUMN focus_sec INTEGER DEFAULT 0");
  } catch {}
  try {
    await db.execAsync("ALTER TABLE pomodoro_sessions ADD COLUMN break_sec INTEGER DEFAULT 0");
  } catch {}
  await db.execAsync("CREATE TABLE IF NOT EXISTS habit_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, habit_id TEXT NOT NULL, day TEXT NOT NULL, UNIQUE(habit_id, day))");
  await db.execAsync("CREATE TABLE IF NOT EXISTS subtasks (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, title TEXT NOT NULL, done INTEGER DEFAULT 0, sort INTEGER DEFAULT 0, created_at INTEGER NOT NULL)");
  await seedIfNeeded(db);
  return db;
};

const seedIfNeeded = async (d: SQLiteDatabase): Promise<void> => {
  const row = await d.getFirstAsync<{ n: number }>("SELECT COUNT(*) as n FROM tasks");
  if (row && row.n > 0) return;

  const now = Date.now();
  const today = dayKey();
  const mkTask = (t: Partial<Task> & { title: string }) =>
    d.runAsync(
      `INSERT INTO tasks (id,title,context,energy,quadrant,status,delegate_note,created_at,due_date,estimated_min,actual_min,timebox_end,note,is_habit,habit_freq,habit_days,habit_color)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        t.title,
        t.context ?? "",
        t.energy ?? "medium",
        t.quadrant ?? null,
        t.status ?? "inbox",
        t.delegate_note ?? null,
        t.created_at ?? now,
        t.due_date ?? today,
        t.estimated_min ?? null,
        t.actual_min ?? null,
        t.timebox_end ?? null,
        t.note ?? null,
        t.is_habit ?? 0,
        t.habit_freq ?? null,
        t.habit_days ?? null,
        t.habit_color ?? null,
      ]
    );

  // A realistic set of tasks across quadrants / statuses.
  await mkTask({ title: "Finish investor deck", context: "desk / laptop", energy: "high", quadrant: "urgent_important", status: "planned", estimated_min: 180, due_date: today });
  await mkTask({ title: "Reply to client emails", context: "phone", energy: "low", quadrant: "urgent_not_important", status: "inbox", estimated_min: 45 });
  await mkTask({ title: "Read product book ch.4", context: "sofa", energy: "medium", quadrant: "not_urgent_important", status: "planned", estimated_min: 60 });
  await mkTask({ title: "Clean up inbox / junk", context: "desk", energy: "low", quadrant: "neither", status: "inbox", estimated_min: 20 });
  await mkTask({ title: "Book dentist appointment", context: "phone", energy: "low", quadrant: "urgent_not_important", status: "delegated", delegate_note: "Ask assistant to do this — 70% done is fine", estimated_min: 15 });
  await mkTask({ title: "Organize project folder", context: "desk", energy: "low", quadrant: "neither", status: "unwanted", estimated_min: 30 });

  // Time blocks for today, including a 20% buffer block.
  const blocks: [number, number, string, string, number][] = [
    [9, 12, "Deep work — investor deck", "deep", 0.2],
    [12, 13, "Lunch break", "buffer", 0],
    [13, 14, "Urgent admin (email/dentist)", "urgent", 0.2],
    [14, 15, "Reading + learning", "maintenance", 0.2],
    [15, 16, "Batch: life admin", "batch", 0.2],
  ];
  for (const [s, e, label, type, buffer] of blocks) {
    await d.runAsync(
      "INSERT INTO time_blocks (day,start_min,end_min,label,type,buffer) VALUES (?,?,?,?,?,?)",
      [today, s, e, label, type, buffer]
    );
  }

  // Activity logs across the last 7 days with a realistic time-of-day distribution
  // so the audit + peak-time view has something meaningful to show.
  const actions = ["started", "completed", "blocked", "diverted"];
  for (let day = 6; day >= 0; day--) {
    const dayDate = new Date(now - day * 86400000);
    const key = dayKey(dayDate);
    // Stronger presence 9-11am and 3-4pm (simulated peak windows).
    const peakHours = [9, 10, 11, 15, 16];
    for (let h = 8; h <= 20; h++) {
      const isPeak = peakHours.includes(h);
      const count = isPeak ? 3 : 1;
      for (let k = 0; k < count; k++) {
        const at = new Date(dayDate);
        at.setHours(h, (k * 20 + 5) % 60, 0, 0);
        await d.runAsync(
          "INSERT INTO activity_log (task_id,action,at,minutes) VALUES (?,?,?,?)",
          [null, actions[Math.floor(Math.random() * actions.length)], at.getTime(), 5 + Math.floor(Math.random() * 45)]
        );
      }
    }
    void key;
  }

  // A completed pomodoro session for the focus tab.
  await d.runAsync(
    "INSERT INTO pomodoro_sessions (task_id,focus_min,break_min,focus_sec,break_sec,rounds,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?)",
    [null, 25, 5, 1500, 300, 2, now - 3600000, now]
  );

  // Habits (is_habit tasks) + a few days of check-ins so streaks render on first run.
  const habits: [string, string, string][] = [
    ["Apply to jobs", "#E5484D", "weekly"],
    ["Upsolving DSA", "#4CC3E8", "daily"],
    ["Audiobook", "#D8B62E", "daily"],
    ["Daily Vocab/phrase Counts", "#12B76A", "daily"],
    ["Daily Coding", "#8B5CF6", "daily"],
  ];
  const habitIds: string[] = [];
  for (const [title, color, freq] of habits) {
    const id = uid();
    habitIds.push(id);
    await d.runAsync(
      `INSERT INTO tasks (id,title,context,energy,quadrant,status,delegate_note,created_at,due_date,estimated_min,actual_min,timebox_end,note,is_habit,habit_freq,habit_days,habit_color)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, title, "", "medium", null, "habit", null, now, null, null, null, null, null, 1, freq, null, color]
    );
  }
  // Give the first three habits check-ins across the last 5 days (streaks of 3-5).
  const seedStreaks: [number, number][] = [[1, 5], [2, 4], [3, 3]];
  for (const [idx, streakLen] of seedStreaks) {
    for (let back = 0; back < streakLen; back++) {
      const d2 = new Date(now - back * 86400000);
      await d.runAsync("INSERT OR IGNORE INTO habit_checks (habit_id, day) VALUES (?,?)", [habitIds[idx], dayKey(d2)]);
    }
  }
};

export const loadAll = async (d: SQLiteDatabase): Promise<DBData> => {
  const [tasks, logs, blocks, pomos, habitChecks, subtasks] = await Promise.all([
    d.getAllAsync<Task>("SELECT * FROM tasks ORDER BY created_at DESC"),
    d.getAllAsync<ActivityLog>("SELECT * FROM activity_log ORDER BY at"),
    d.getAllAsync<TimeBlock>("SELECT * FROM time_blocks ORDER BY day, start_min"),
    d.getAllAsync<PomoSession>("SELECT * FROM pomodoro_sessions ORDER BY started_at"),
    d.getAllAsync<HabitCheck>("SELECT * FROM habit_checks ORDER BY day"),
    d.getAllAsync<Subtask>("SELECT * FROM subtasks ORDER BY sort, created_at"),
  ]);
  return { tasks, logs, blocks, pomos, habitChecks, subtasks };
};
