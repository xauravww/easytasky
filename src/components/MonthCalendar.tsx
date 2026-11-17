import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PomoSession, Task } from "../db/database";
import { dayKey } from "../utils/time";
import { fmtDue } from "../utils/taskFormat";

const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const IDLE = "#6F6F6F";
const ACCENT = "#FA6E1E";
const TODAY_BORDER = ACCENT;

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Props = {
  tasks: Task[];
  pomos: PomoSession[];
};

export default function MonthCalendar({ tasks, pomos }: Props) {
  const today = dayKey();
  const [anchor, setAnchor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const list = m.get(t.due_date) ?? [];
      list.push(t);
      m.set(t.due_date, list);
    }
    return m;
  }, [tasks]);

  const focusByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pomos) {
      if (!p.completed_at) continue;
      const key = dayKey(new Date(p.completed_at));
      m.set(key, (m.get(key) ?? 0) + (p.focus_sec ?? Math.round(p.focus_min * 60)));
    }
    return m;
  }, [pomos]);

  const maxFocus = Math.max(1, ...Array.from(focusByDay.values()));

  const heatColor = (sec: number): string => {
    if (sec <= 0) return "transparent";
    const t = Math.min(1, sec / maxFocus);
    return `rgba(250,110,30,${0.08 + 0.3 * t})`;
  };

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${`${month + 1}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`);
  }

  const prevMonth = () => {
    setAnchor(new Date(year, month - 1, 1));
    setSelectedKey(null);
  };
  const nextMonth = () => {
    setAnchor(new Date(year, month + 1, 1));
    setSelectedKey(null);
  };

  const selectedTasks = selectedKey ? (tasksByDay.get(selectedKey) ?? []) : [];

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>Calendar</Text>
        <View style={styles.nav}>
          <Pressable onPress={prevMonth} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={18} color={SUB} />
          </Pressable>
          <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
          <Pressable onPress={nextMonth} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={18} color={SUB} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={`${w}-${i}`} style={styles.weekLabel}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((key, i) => {
          if (!key) return <View key={`blank-${i}`} style={styles.cell} />;
          const due = tasksByDay.get(key);
          const focusSec = focusByDay.get(key) ?? 0;
          const isToday = key === today;
          const isSelected = key === selectedKey;
          return (
            <Pressable
              key={key}
              style={[styles.cell, { backgroundColor: heatColor(focusSec) }, isSelected && styles.cellSelected]}
              onPress={() => setSelectedKey(isSelected ? null : key)}
              accessibilityRole="button"
              accessibilityLabel={`${key}${due?.length ? `, ${due.length} tasks` : ""}`}
            >
              <View style={[styles.dayNumWrap, isToday && styles.dayNumToday]}>
                <Text style={[styles.dayNum, isToday && styles.dayNumTodayText]}>{Number(key.slice(-2))}</Text>
              </View>
              <View style={styles.dots}>
                {due && due.length > 0 && <View style={styles.taskDot} />}
                {focusSec > 0 && <View style={[styles.focusDot, { opacity: 0.5 + 0.5 * Math.min(1, focusSec / maxFocus) }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={styles.taskDot} /><Text style={styles.legendText}>task</Text></View>
        <View style={styles.legendItem}><View style={styles.focusDot} /><Text style={styles.legendText}>focus</Text></View>
      </View>

      {selectedKey && (
        <View style={styles.dayList}>
          <Text style={styles.dayTitle}>{fmtDue(selectedKey)}</Text>
          {selectedTasks.length === 0 ? (
            <Text style={styles.noTasks}>No tasks this day</Text>
          ) : (
            selectedTasks.map((t) => (
              <View key={t.id} style={styles.dayTaskRow}>
                <View style={[styles.miniCheck, t.status === "done" && styles.miniCheckDone]} />
                <Text style={[styles.dayTaskTitle, t.status === "done" && styles.dayTaskDone]} numberOfLines={1}>
                  {t.title}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 16, marginBottom: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },
  nav: { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  monthLabel: { color: TEXT, fontSize: 14, fontWeight: "600", minWidth: 96, textAlign: "center" },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekLabel: { flex: 1, textAlign: "center", color: SUB, fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  cellSelected: { backgroundColor: "rgba(250,110,30,0.2)" },
  dayNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dayNumToday: { backgroundColor: TODAY_BORDER },
  dayNum: { color: TEXT, fontSize: 13, fontWeight: "500" },
  dayNumTodayText: { color: "#FFFFFF", fontWeight: "700" },
  dots: { flexDirection: "row", gap: 3, height: 6, marginTop: 2 },
  taskDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  focusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4CC3E8" },
  legend: { flexDirection: "row", gap: 16, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { color: SUB, fontSize: 12 },
  dayList: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE, paddingTop: 12 },
  dayTitle: { color: ACCENT, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  noTasks: { color: IDLE, fontSize: 13 },
  dayTaskRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  miniCheck: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: IDLE },
  miniCheckDone: { backgroundColor: ACCENT, borderColor: ACCENT },
  dayTaskTitle: { flex: 1, color: TEXT, fontSize: 14 },
  dayTaskDone: { color: IDLE, textDecorationLine: "line-through" },
});
