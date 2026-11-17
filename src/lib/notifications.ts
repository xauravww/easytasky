import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import type { Task } from "../db/database";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CHANNEL = "reminders";
const ACCENT = "#FA6E1E";
let permAsked = false;
const ids = new Map<string, string>();

const ensurePermission = async () => {
  if (permAsked) return;
  permAsked = true;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Task reminders",
    importance: AndroidImportance.HIGH,
  });
  const cur = await Notifications.getPermissionsAsync();
  if (!cur.granted) await Notifications.requestPermissionsAsync();
};

// Reminder fires at the task's remind_time (HH:MM) on the due date, falling back
// to 09:00; skip dates whose slot already passed.
const reminderDate = (due: string, remindTime?: string | null): Date | null => {
  const [y, m, d] = due.split("-").map(Number);
  let hour = 9;
  let minute = 0;
  if (remindTime) {
    const [hh, mm] = remindTime.split(":").map(Number);
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
      hour = hh;
      minute = mm;
    }
  }
  const at = new Date(y, m - 1, d, hour, minute, 0);
  return at.getTime() > Date.now() + 30_000 ? at : null;
};

// Reconcile the native schedule with the task list: cancel everything we scheduled
// before, then re-register reminders for open, dated, non-habit tasks.
export const syncTaskReminders = async (tasks: Task[]): Promise<void> => {
  try {
    await ensurePermission();
    for (const id of ids.values()) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    ids.clear();
    for (const t of tasks) {
      if (t.status === "done" || t.is_habit === 1 || !t.due_date) continue;
      const at = reminderDate(t.due_date, t.remind_time);
      if (!at) continue;
      const identifier = await Notifications.scheduleNotificationAsync({
        content: { title: "Task due", body: t.title, color: ACCENT, data: { taskId: t.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
      ids.set(t.id, identifier);
    }
  } catch (err) {
    console.warn("syncTaskReminders failed", err);
  }
};
