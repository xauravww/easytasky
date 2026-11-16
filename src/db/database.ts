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
  is_habit: number;
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
  rounds: number;
  started_at: number;
  completed_at: number | null;
};

export type DBData = {
  tasks: Task[];
  logs: ActivityLog[];
  blocks: TimeBlock[];
  pomos: PomoSession[];
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
      is_habit INTEGER DEFAULT 0
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
      rounds INTEGER DEFAULT 1,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);
  // Migration for databases created before the is_habit column existed.
  try {
    await db.execAsync("ALTER TABLE tasks ADD COLUMN is_habit INTEGER DEFAULT 0");
  } catch {}
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
      `INSERT INTO tasks (id,title,context,energy,quadrant,status,delegate_note,created_at,due_date,estimated_min,actual_min,timebox_end,is_habit)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
        t.is_habit ?? 0,
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
    "INSERT INTO pomodoro_sessions (task_id,focus_min,break_min,rounds,started_at,completed_at) VALUES (?,?,?,?,?,?)",
    [null, 25, 5, 2, now - 3600000, now]
  );
};

export const loadAll = async (d: SQLiteDatabase): Promise<DBData> => {
  const [tasks, logs, blocks, pomos] = await Promise.all([
    d.getAllAsync<Task>("SELECT * FROM tasks ORDER BY created_at DESC"),
    d.getAllAsync<ActivityLog>("SELECT * FROM activity_log ORDER BY at"),
    d.getAllAsync<TimeBlock>("SELECT * FROM time_blocks ORDER BY day, start_min"),
    d.getAllAsync<PomoSession>("SELECT * FROM pomodoro_sessions ORDER BY started_at"),
  ]);
  return { tasks, logs, blocks, pomos };
};
