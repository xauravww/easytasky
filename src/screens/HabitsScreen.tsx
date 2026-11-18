import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { habitStreak, useStore } from "../store/useStore";
import { addDays, dayKey } from "../utils/time";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const IDLE = "#6F6F6F";
const ACCENT = "#FA6E1E";

const PALETTE = ["#E5484D", "#D8B62E", "#4CC3E8", "#12B76A", "#8B5CF6"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function HabitsScreen() {
  const { tasks, habitChecks, addTask, deleteTask, toggleHabit } = useStore();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState<"daily" | "weekly">("daily");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [color, setColor] = useState(PALETTE[3]);

  const habits = tasks.filter((t) => t.is_habit === 1);
  const today = dayKey();
  const doneToday = habits.filter((h) => habitChecks.some((c) => c.habit_id === h.id && c.day === today)).length;

  // Last 7 days, oldest → today (TickTick-style week strip).
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(new Date(), i - 6);
        return { key: dayKey(d), label: WEEKDAYS[d.getDay()], num: d.getDate(), isToday: i === 6 };
      }),
    []
  );

  const dueToday = (h: (typeof habits)[number]) => {
    if (h.habit_freq === "weekly" && h.habit_days) {
      const allowed = h.habit_days.split(",").map(Number);
      return allowed.includes(new Date().getDay());
    }
    return true;
  };

  const scheduled = habits.filter(dueToday);
  const submit = () => {
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      status: "habit",
      is_habit: 1,
      habit_freq: freq,
      habit_days: freq === "weekly" ? days.join(",") : null,
      habit_color: color,
    });
    setTitle("");
    setAdding(false);
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Habits</Text>
          <Text style={styles.headerSub}>
            {habits.length} habits · {doneToday}/{Math.max(scheduled.length, 1)} done today
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.96 }] }]}
          onPress={() => setAdding((v) => !v)}
          accessibilityRole="button"
        >
          <Ionicons name={adding ? "close" : "add"} size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>{adding ? "Close" : "Add"}</Text>
        </Pressable>
      </View>

      {/* Week strip */}
      <View style={styles.weekStrip}>
        {week.map((d) => {
          const checkedCount = habitChecks.filter((c) => c.day === d.key).length;
          return (
            <View key={d.key} style={styles.weekDay}>
              <Text style={[styles.weekLabel, d.isToday && { color: ACCENT, fontWeight: "700" }]}>{d.label}</Text>
              <View style={[styles.weekCircle, d.isToday && styles.weekCircleToday, checkedCount > 0 && styles.weekCircleDone]}>
                {checkedCount > 0 ? (
                  <Ionicons name="checkmark" size={14} color={d.isToday ? ACCENT : "#FFFFFF"} />
                ) : (
                  <Text style={styles.weekNum}>{d.num}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Add habit — collapsed */}
      {adding && (
        <View style={styles.panel}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="New habit (e.g. Read 20 pages)"
            placeholderTextColor={IDLE}
            style={styles.input}
            returnKeyType="done"
          />
          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.chipRow}>
            {(["daily", "weekly"] as const).map((f) => (
              <Pressable
                key={f}
                style={[styles.chip, freq === f && styles.chipActive]}
                onPress={() => setFreq(f)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, freq === f && styles.chipTextActive]}>{f === "daily" ? "Daily" : "Weekly"}</Text>
              </Pressable>
            ))}
          </View>
          {freq === "weekly" && (
            <>
              <Text style={styles.fieldLabel}>Days</Text>
              <View style={styles.chipRow}>
                {WEEKDAYS.map((d, i) => (
                  <Pressable
                    key={i}
                    style={[styles.dayChip, days.includes(i) && styles.dayChipActive]}
                    onPress={() => setDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: days.includes(i) }}
                    accessibilityLabel={`Weekday ${d}`}
                  >
                    <Text style={[styles.dayChipText, days.includes(i) && { color: "#FFFFFF", fontWeight: "700" }]}>{d}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.chipRow}>
            {PALETTE.map((c) => (
              <Pressable
                key={c}
                style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
                onPress={() => setColor(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected: color === c }}
                accessibilityLabel={`Color ${c}`}
              />
            ))}
          </View>
          <Pressable style={({ pressed }) => [styles.submit, pressed && { opacity: 0.85 }]} onPress={submit} accessibilityRole="button">
            <Text style={styles.submitText}>Create habit</Text>
          </Pressable>
        </View>
      )}

      {/* Habit rows */}
      {habits.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No habits yet</Text>
          <Text style={styles.emptyHint}>Tap Add to start a streak.</Text>
        </View>
      )}
      {habits.map((h) => {
        const streak = habitStreak(habitChecks, h.id);
        const checkedToday = habitChecks.some((c) => c.habit_id === h.id && c.day === today);
        const habitColor = h.habit_color ?? ACCENT;
        return (
          <View key={h.id} style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.check, { borderColor: habitColor }, checkedToday && { backgroundColor: habitColor, borderColor: habitColor }, pressed && { opacity: 0.6 }]}
              onPress={() => toggleHabit(h.id, today)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: checkedToday }}
              accessibilityLabel={`Check in ${h.title}`}
            >
              {checkedToday && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, checkedToday && { color: SUB }]} numberOfLines={1}>
                {h.title}
              </Text>
              <View style={styles.rowSub}>
                <Ionicons name="flame" size={13} color={streak > 0 ? "#D8B62E" : SUB} />
                <Text style={styles.streakText}>{streak} day streak</Text>
                {h.habit_freq === "weekly" && h.habit_days ? (
                  <Text style={styles.freqText}>· {h.habit_days.split(",").map((d) => WEEKDAYS[Number(d)]).join(" ")}</Text>
                ) : null}
              </View>
            </View>
            {/* 7-day dots */}
            <View style={styles.dots}>
              {week.map((d) => {
                const on = habitChecks.some((c) => c.habit_id === h.id && c.day === d.key);
                return <View key={d.key} style={[styles.dot, on && { backgroundColor: habitColor }]} />;
              })}
            </View>
            <Pressable
              style={({ pressed }) => [styles.ghostIcon, pressed && { opacity: 0.5 }]}
              onPress={() => deleteTask(h.id)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${h.title}`}
            >
              <Ionicons name="trash-outline" size={17} color={SUB} />
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8, paddingBottom: 16 },
  h1: { fontSize: 30, fontWeight: "700", color: TEXT, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: SUB, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  addBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  weekDay: { alignItems: "center", gap: 6, flex: 1 },
  weekLabel: { fontSize: 12, color: SUB, fontWeight: "600" },
  weekCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  weekCircleToday: { borderColor: ACCENT, borderWidth: 2 },
  weekCircleDone: { backgroundColor: "rgba(250,110,30,0.16)", borderColor: "rgba(250,110,30,0.16)" },
  weekNum: { fontSize: 12, color: TEXT, fontWeight: "600" },
  panel: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: LINE,
  },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: SUB, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  chip: {
    minHeight: 38,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: LINE,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { borderColor: ACCENT, backgroundColor: "rgba(250,110,30,0.12)" },
  chipText: { color: "#D6D6D6", fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: ACCENT },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  dayChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  dayChipText: { color: SUB, fontSize: 13, fontWeight: "600" },
  swatch: { width: 34, height: 34, borderRadius: 17, marginRight: 10, marginBottom: 8 },
  swatchActive: { borderWidth: 3, borderColor: "#FFFFFF" },
  input: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 12,
    color: TEXT,
    fontSize: 15,
    padding: 14,
    marginBottom: 12,
  },
  submit: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "600", color: TEXT },
  rowSub: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  streakText: { fontSize: 13, color: SUB, fontWeight: "600" },
  freqText: { fontSize: 13, color: SUB },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2A2A2A" },
  ghostIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },
  emptyHint: { color: SUB, fontSize: 13, marginTop: 4 },
});
