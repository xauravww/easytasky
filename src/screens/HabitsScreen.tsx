import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { habitStreak, useStore } from "../store/useStore";
import { addDays, dayKey } from "../utils/time";
import type { Task } from "../db/database";
import HabitDetailModal from "../components/HabitDetailModal";
import HabitQuantityModal from "../components/HabitQuantityModal";
import { readableTextOn } from "../components/ui";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const IDLE = "#9C9C9C";
const ACCENT = "#FA6E1E";
const ON_ACCENT = "#FFFFFF";

const PALETTE = ["#E5484D", "#D8B62E", "#4CC3E8", "#12B76A", "#8B5CF6"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function HabitsScreen() {
  const { tasks, habitChecks, addTask, deleteTask, toggleHabit, logHabitValue, refreshAll } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshError("");
    try {
      await refreshAll();
    } catch {
      setRefreshError("Couldn’t refresh habits. Tap to try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState<"daily" | "weekly">("daily");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [color, setColor] = useState(PALETTE[3]);
  const [habitType, setHabitType] = useState<"boolean" | "quantity">("boolean");
  const [targetValue, setTargetValue] = useState("1");
  const [unit, setUnit] = useState("times");
  const [submitting, setSubmitting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);
  const [selectedHabit, setSelectedHabit] = useState<Task | null>(null);
  const [qtyModalHabit, setQtyModalHabit] = useState<{ habit: Task; currentVal: number } | null>(null);

  const habits = tasks.filter((t) => t.is_habit === 1);
  const today = dayKey();

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
  const doneToday = scheduled.filter((habit) => {
    const check = habitChecks.find((item) => item.habit_id === habit.id && item.day === today);
    if (!check) return false;
    const target = check.target_value ?? habit.habit_target_value ?? 1;
    return habit.habit_type === "quantity" || target > 1 ? (check.value ?? 1) >= target : true;
  }).length;
  const visibleHabits = habits.slice(0, visibleCount);

  const submit = async () => {
    if (!title.trim() || submitting) return;
    const num = parseFloat(targetValue);
    const validNum = isNaN(num) || num <= 0 ? 1 : num;
    const finalType = validNum > 1 || habitType === "quantity" ? "quantity" : "boolean";
    setSubmitting(true);
    try {
      await addTask({
        title: title.trim(),
        status: "habit",
        is_habit: 1,
        habit_freq: freq,
        habit_days: freq === "weekly" ? days.join(",") : null,
        habit_color: color,
        habit_type: finalType,
        habit_target_value: validNum,
        habit_unit: finalType === "quantity" ? unit.trim() || "times" : "times",
      });
      setTitle("");
      setAdding(false);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (habit: Task) => {
    Alert.alert(
      "Delete habit?",
      `“${habit.title}” and its check-in history will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteTask(habit.id);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={visibleHabits}
        keyExtractor={(item) => item.id}
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (visibleCount < habits.length) {
            setVisibleCount((count) => Math.min(count + 40, habits.length));
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        ListHeaderComponent={
          <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Habits</Text>
          <Text style={styles.headerSub}>
            {habits.length} habits · {scheduled.length ? `${doneToday}/${scheduled.length} done today` : "none scheduled today"}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.headerIconBtn, pressed && styles.controlPressed]}
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh habits"
          accessibilityState={{ busy: refreshing }}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <Ionicons name="refresh" size={19} color={SUB} />
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.controlPressed]}
          onPress={() => setAdding((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={adding ? "Close new habit form" : "Add habit"}
          accessibilityState={{ expanded: adding }}
        >
          <Ionicons name={adding ? "close" : "add"} size={20} color={ON_ACCENT} />
          <Text style={styles.addBtnText}>{adding ? "Close" : "Add"}</Text>
        </Pressable>
      </View>

      {refreshError ? (
        <Pressable
          style={styles.inlineError}
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel="Habit refresh failed. Retry"
        >
          <Ionicons name="warning-outline" size={16} color="#FF8D90" />
          <Text style={styles.inlineErrorText}>{refreshError}</Text>
        </Pressable>
      ) : null}

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
          <Text style={styles.fieldLabel}>Habit Type</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, habitType === "boolean" && styles.chipActive]}
              onPress={() => setHabitType("boolean")}
              accessibilityRole="radio"
              accessibilityState={{ selected: habitType === "boolean" }}
            >
              <Text style={[styles.chipText, habitType === "boolean" && styles.chipTextActive]}>
                Only Do (Check-in)
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, habitType === "quantity" && styles.chipActive]}
              onPress={() => setHabitType("quantity")}
              accessibilityRole="radio"
              accessibilityState={{ selected: habitType === "quantity" }}
            >
              <Text style={[styles.chipText, habitType === "quantity" && styles.chipTextActive]}>
                Quantity Based
              </Text>
            </Pressable>
          </View>

          {habitType === "quantity" && (
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Daily Target</Text>
                <TextInput
                  value={targetValue}
                  onChangeText={setTargetValue}
                  placeholder="e.g. 8"
                  placeholderTextColor={IDLE}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Custom Unit</Text>
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="e.g. glasses, km, pages"
                  placeholderTextColor={IDLE}
                  style={styles.input}
                />
              </View>
            </View>
          )}

          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.chipRow}>
            {(["daily", "weekly"] as const).map((f) => (
              <Pressable
                key={f}
                style={[styles.chip, freq === f && styles.chipActive]}
                onPress={() => setFreq(f)}
                accessibilityRole="radio"
                accessibilityState={{ selected: freq === f }}
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
                    <Text style={[styles.dayChipText, days.includes(i) && styles.dayChipTextActive]}>{d}</Text>
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
          <Pressable
            style={({ pressed }) => [
              styles.submit,
              (!title.trim() || submitting) && styles.disabled,
              pressed && !!title.trim() && !submitting && styles.controlPressed,
            ]}
            onPress={submit}
            disabled={!title.trim() || submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !title.trim(), busy: submitting }}
          >
            <Text style={styles.submitText}>{submitting ? "Creating…" : "Create habit"}</Text>
          </Pressable>
        </View>
      )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="flame-outline" size={26} color={ACCENT} />
            </View>
            <Text style={styles.emptyTitle}>Build one repeatable win</Text>
            <Text style={styles.emptyHint}>Start small. A habit you can repeat beats a perfect plan.</Text>
            <Pressable
              style={({ pressed }) => [styles.emptyAction, pressed && styles.controlPressed]}
              onPress={() => setAdding(true)}
              accessibilityRole="button"
            >
              <Text style={styles.emptyActionText}>Add your first habit</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: h }) => {
          const streak = habitStreak(habitChecks, h.id);
          const todayCheck = habitChecks.find((c) => c.habit_id === h.id && c.day === today);
          const checkedToday = !!todayCheck;
          const habitColor = h.habit_color ?? ACCENT;
          const configuredTarget = h.habit_target_value ?? 1;
          const targetValNum = todayCheck?.target_value ?? configuredTarget;
          const isQty = h.habit_type === "quantity" || targetValNum > 1;
          const currentQty = todayCheck?.value ?? (checkedToday ? 1 : 0);
          const completedToday = isQty ? currentQty >= targetValNum : checkedToday;

          const handleCheckPress = () => {
            if (isQty) {
              setQtyModalHabit({ habit: h, currentVal: currentQty });
            } else {
              void toggleHabit(h.id, today);
            }
          };

          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              onPress={() => setSelectedHabit(h)}
              accessibilityRole="button"
              accessibilityLabel={`${h.title}, ${streak} day streak${isQty ? `, ${currentQty} of ${targetValNum} ${h.habit_unit || "times"}` : completedToday ? ", completed today" : ", not completed today"}`}
            >
              <Pressable
                style={({ pressed }) => [styles.checkTouch, pressed && { opacity: 0.6 }]}
                onPress={(event) => {
                  event.stopPropagation();
                  handleCheckPress();
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: completedToday }}
                accessibilityLabel={`Check in ${h.title}`}
              >
                <View
                  style={[
                    styles.check,
                    { borderColor: habitColor },
                    completedToday && { backgroundColor: habitColor, borderColor: habitColor },
                  ]}
                >
                  {completedToday ? (
                    <Ionicons name="checkmark" size={16} color={readableTextOn(habitColor)} />
                  ) : null}
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, completedToday && { color: SUB }]} numberOfLines={1}>
                  {h.title}
                </Text>
                <View style={styles.rowSub}>
                  <Ionicons name="flame" size={13} color={streak > 0 ? "#D8B62E" : SUB} />
                  <Text style={styles.streakText}>{streak} day streak</Text>
                  {isQty ? (
                    <Text style={[styles.freqText, { color: ACCENT, fontWeight: "600" }]}>
                      · {currentQty}/{targetValNum} {h.habit_unit || "times"}
                    </Text>
                  ) : null}
                  {h.habit_freq === "weekly" && h.habit_days ? (
                    <Text style={styles.freqText}>
                      · {h.habit_days.split(",").map((d) => WEEKDAYS[Number(d)]).join(" ")}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View
                style={styles.dots}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                {week.map((d) => {
                  const on = habitChecks.some((c) => c.habit_id === h.id && c.day === d.key);
                  return <View key={d.key} style={[styles.dot, on && { backgroundColor: habitColor }]} />;
                })}
              </View>
              <Pressable
                style={({ pressed }) => [styles.ghostIcon, pressed && { opacity: 0.5 }]}
                onPress={(event) => {
                  event.stopPropagation();
                  confirmDelete(h);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${h.title}`}
              >
                <Ionicons name="trash-outline" size={17} color={SUB} />
              </Pressable>
            </Pressable>
          );
        }}
      />

    {selectedHabit && (
      <HabitDetailModal
        habit={selectedHabit}
        onClose={() => setSelectedHabit(null)}
      />
    )}

    {qtyModalHabit && (
      <HabitQuantityModal
        habit={qtyModalHabit.habit}
        currentValue={qtyModalHabit.currentVal}
        onSave={async (val) => {
          await logHabitValue(qtyModalHabit.habit.id, today, val);
        }}
        onClose={() => setQtyModalHabit(null)}
      />
    )}
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
  addBtnText: { color: ON_ACCENT, fontWeight: "800", fontSize: 14 },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  controlPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  inlineError: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "rgba(229,72,77,0.1)",
    borderWidth: 1,
    borderColor: "rgba(229,72,77,0.25)",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inlineErrorText: { flex: 1, color: "#FFB3B5", fontSize: 13, lineHeight: 18 },
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
  dayChipTextActive: { color: ON_ACCENT, fontWeight: "800" },
  swatch: { width: 44, height: 44, borderRadius: 22, marginRight: 10, marginBottom: 8 },
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
  submitText: { color: ON_ACCENT, fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.42 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 64, paddingVertical: 8 },
  checkTouch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
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
  ghostIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 44 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(250,110,30,0.1)",
    borderWidth: 1,
    borderColor: "rgba(250,110,30,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { color: TEXT, fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyHint: { color: SUB, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: "center" },
  emptyAction: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(250,110,30,0.12)",
    borderWidth: 1,
    borderColor: "rgba(250,110,30,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 18,
  },
  emptyActionText: { color: ACCENT, fontSize: 14, fontWeight: "700" },
});
