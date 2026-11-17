import { dayKey } from "./time";

// Human label for a YYYY-MM-DD due key: Today / Tomorrow / Nd overdue / Nd.
export const fmtDue = (key: string): string => {
  const today = dayKey();
  if (key === today) return "Today";
  const d = new Date(key + "T00:00:00");
  const diff = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${-diff}d overdue`;
  return `${diff}d`;
};
