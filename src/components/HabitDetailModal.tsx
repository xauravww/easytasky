import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Task } from "../db/database";
import { dayKey } from "../utils/time";
import { habitBestStreak, habitStreak, useStore } from "../store/useStore";

const BG = "#141414";
const CARD = "#1C1C1C";
const FIELD = "#242424";
const LINE = "#2A2A2A";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";

type Props = {
  habit: Task;
  onClose: () => void;
};

type TargetPeriod = "today" | "week" | "month" | "quarter" | "year";

export default function HabitDetailModal({ habit, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const habitChecks = useStore((s) => s.habitChecks);
  const logHabitValue = useStore((s) => s.logHabitValue);
  const toggleHabit = useStore((s) => s.toggleHabit);
  const updateTask = useStore((s) => s.updateTask);

  const [targetPeriod, setTargetPeriod] = useState<TargetPeriod>("today");
  const [editingTarget, setEditingTarget] = useState(false);
  const [customUnit, setCustomUnit] = useState(habit.habit_unit || "times");
  const [targetVal, setTargetVal] = useState(String(habit.habit_target_value || 1));

  const habitColor = habit.habit_color || ACCENT;
  const isQuantity = habit.habit_type === "quantity";
  const targetNumber = habit.habit_target_value || 1;
  const unit = habit.habit_unit || (isQuantity ? "units" : "times");

  const today = dayKey();
  const checksForHabit = useMemo(
    () => habitChecks.filter((c) => c.habit_id === habit.id),
    [habitChecks, habit.id]
  );

  const checkMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checksForHabit) {
      map.set(c.day, c.value ?? 1);
    }
    return map;
  }, [checksForHabit]);

  const currentStreak = habitStreak(habitChecks, habit.id);
  const bestStreak = habitBestStreak(habitChecks, habit.id);
  const todayValue = checkMap.get(today) || 0;

  // Save habit configuration changes
  const handleSaveConfig = async () => {
    const parsed = parseFloat(targetVal);
    await updateTask(habit.id, {
      habit_unit: customUnit.trim() || null,
      habit_target_value: isNaN(parsed) || parsed <= 0 ? 1 : parsed,
    });
    setEditingTarget(false);
  };

  // Add/log value for today
  const handleQuickAdd = async (amount: number) => {
    const next = Math.max(0, todayValue + amount);
    await logHabitValue(habit.id, today, next);
  };

  // 1-Year Heatmap Grid Calculation (Last 364 days / 52 weeks)
  const heatmapData = useMemo(() => {
    const weeks: { day: string; value: number; intensity: number }[][] = [];
    const now = new Date();
    // Align to ending today and going back 52 full weeks
    const totalDays = 52 * 7;
    const start = new Date(now);
    start.setDate(now.getDate() - (totalDays - 1));

    let currentWeek: { day: string; value: number; intensity: number }[] = [];
    const iter = new Date(start);

    for (let i = 0; i < totalDays; i++) {
      const k = dayKey(iter);
      const val = checkMap.get(k) || 0;
      let intensity = 0;
      if (val > 0) {
        if (!isQuantity) {
          intensity = 4;
        } else {
          const ratio = val / targetNumber;
          if (ratio >= 1) intensity = 4;
          else if (ratio >= 0.75) intensity = 3;
          else if (ratio >= 0.5) intensity = 2;
          else intensity = 1;
        }
      }

      currentWeek.push({ day: k, value: val, intensity });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      iter.setDate(iter.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  }, [checkMap, isQuantity, targetNumber]);

  // Target Progress by Period (Today, Week, Month, Quarter, Year)
  const targetStats = useMemo(() => {
    const now = new Date();
    let daysCount = 1;
    let actualSum = 0;
    let targetTotal = targetNumber;

    if (targetPeriod === "today") {
      daysCount = 1;
      actualSum = todayValue;
      targetTotal = targetNumber;
    } else if (targetPeriod === "week") {
      daysCount = 7;
      targetTotal = targetNumber * 7;
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        actualSum += checkMap.get(dayKey(d)) || 0;
      }
    } else if (targetPeriod === "month") {
      daysCount = 30;
      targetTotal = targetNumber * 30;
      for (let i = 0; i < 30; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        actualSum += checkMap.get(dayKey(d)) || 0;
      }
    } else if (targetPeriod === "quarter") {
      daysCount = 90;
      targetTotal = targetNumber * 90;
      for (let i = 0; i < 90; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        actualSum += checkMap.get(dayKey(d)) || 0;
      }
    } else if (targetPeriod === "year") {
      daysCount = 365;
      targetTotal = targetNumber * 365;
      for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        actualSum += checkMap.get(dayKey(d)) || 0;
      }
    }

    const pct = Math.min(100, Math.round((actualSum / Math.max(targetTotal, 1)) * 100));
    return { actualSum, targetTotal, pct, daysCount };
  }, [targetPeriod, todayValue, targetNumber, checkMap]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={onClose}>
            <Ionicons name="arrow-back" size={22} color={TEXT} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {habit.title}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isQuantity ? `Quantity Habit (${unit})` : "Check-in Habit"}
            </Text>
          </View>
          <Pressable
            style={styles.headerBtn}
            onPress={() => setEditingTarget((v) => !v)}
            accessibilityRole="button"
          >
            <Ionicons name="options-outline" size={20} color={ACCENT} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Quick Config Drawer/Panel */}
          {editingTarget && (
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>Target & Quantity Setup</Text>
              <View style={styles.configRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configLabel}>Target ({isQuantity ? "Value per Day" : "Per Day"})</Text>
                  <TextInput
                    style={styles.configInput}
                    keyboardType="numeric"
                    value={targetVal}
                    onChangeText={setTargetVal}
                    placeholder="1"
                    placeholderTextColor="#555555"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configLabel}>Unit Name</Text>
                  <TextInput
                    style={styles.configInput}
                    value={customUnit}
                    onChangeText={setCustomUnit}
                    placeholder="e.g. km, glasses, pages"
                    placeholderTextColor="#555555"
                  />
                </View>
              </View>
              <Pressable style={styles.saveConfigBtn} onPress={handleSaveConfig}>
                <Text style={styles.saveConfigBtnText}>Save Settings</Text>
              </Pressable>
            </View>
          )}

          {/* Today Action Log Card */}
          <View style={styles.todayCard}>
            <View style={styles.todayCardLeft}>
              <Text style={styles.todayCardLabel}>Today&apos;s Progress</Text>
              <Text style={styles.todayCardValue}>
                {todayValue} <Text style={{ fontSize: 16, color: SUB }}>/ {targetNumber} {unit}</Text>
              </Text>
            </View>

            {isQuantity ? (
              <View style={styles.quantityLogActions}>
                <Pressable style={styles.qtyBtn} onPress={() => handleQuickAdd(1)}>
                  <Text style={styles.qtyBtnText}>+1</Text>
                </Pressable>
                <Pressable style={styles.qtyBtn} onPress={() => handleQuickAdd(5)}>
                  <Text style={styles.qtyBtnText}>+5</Text>
                </Pressable>
                <Pressable
                  style={[styles.qtyBtn, { backgroundColor: "#2A2A2A" }]}
                  onPress={() => handleQuickAdd(-1)}
                >
                  <Text style={styles.qtyBtnText}>-1</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[
                  styles.checkBtn,
                  todayValue > 0 && { backgroundColor: habitColor, borderColor: habitColor },
                ]}
                onPress={() => toggleHabit(habit.id, today)}
              >
                <Ionicons
                  name={todayValue > 0 ? "checkmark" : "add"}
                  size={20}
                  color={todayValue > 0 ? "#FFFFFF" : SUB}
                />
                <Text
                  style={[
                    styles.checkBtnText,
                    todayValue > 0 && { color: "#FFFFFF", fontWeight: "700" },
                  ]}
                >
                  {todayValue > 0 ? "Completed" : "Mark Done"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Streak Stats Card */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <Ionicons name="flame" size={18} color="#D8B62E" />
                <Text style={styles.statLabel}>Current Streak</Text>
              </View>
              <Text style={styles.statNumber}>{currentStreak} <Text style={styles.statUnit}>days</Text></Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <Ionicons name="trophy" size={18} color="#FA6E1E" />
                <Text style={styles.statLabel}>Best Streak</Text>
              </View>
              <Text style={styles.statNumber}>{bestStreak} <Text style={styles.statUnit}>days</Text></Text>
            </View>
          </View>

          {/* Target Graph / Progress Bars (Today, Week, Month, Quarter, Year) */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Target Progress</Text>
              <View style={styles.targetPeriodRow}>
                {(["today", "week", "month", "quarter", "year"] as const).map((p) => (
                  <Pressable
                    key={p}
                    style={[styles.periodTab, targetPeriod === p && styles.periodTabActive]}
                    onPress={() => setTargetPeriod(p)}
                  >
                    <Text
                      style={[
                        styles.periodTabText,
                        targetPeriod === p && styles.periodTabTextActive,
                      ]}
                    >
                      {p[0].toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Target Progress Bar & Numerical stats */}
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${targetStats.pct}%`,
                      backgroundColor: habitColor,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabelLeft}>
                  {targetStats.actualSum} / {targetStats.targetTotal} {unit}
                </Text>
                <Text style={[styles.progressLabelRight, { color: habitColor }]}>
                  {targetStats.pct}%
                </Text>
              </View>
            </View>
          </View>

          {/* 1-Year Full Activity Heatmap */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Annual Heatmap (52 Weeks)</Text>
              <Text style={styles.heatmapCount}>{checksForHabit.length} active days</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heatmapScroll}>
              <View style={styles.heatmapContainer}>
                {heatmapData.map((weekData, wIdx) => (
                  <View key={`w_${wIdx}`} style={styles.heatmapCol}>
                    {weekData.map((cell, dIdx) => {
                      let cellBg = "#222222";
                      if (cell.intensity === 1) cellBg = "rgba(250,110,30,0.3)";
                      else if (cell.intensity === 2) cellBg = "rgba(250,110,30,0.55)";
                      else if (cell.intensity === 3) cellBg = "rgba(250,110,30,0.8)";
                      else if (cell.intensity === 4) cellBg = habitColor;

                      return (
                        <View
                          key={`c_${wIdx}_${dIdx}`}
                          style={[styles.heatmapCell, { backgroundColor: cellBg }]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.heatmapLegend}>
              <Text style={styles.legendText}>Less</Text>
              <View style={[styles.heatmapCellSmall, { backgroundColor: "#222222" }]} />
              <View style={[styles.heatmapCellSmall, { backgroundColor: "rgba(250,110,30,0.3)" }]} />
              <View style={[styles.heatmapCellSmall, { backgroundColor: "rgba(250,110,30,0.55)" }]} />
              <View style={[styles.heatmapCellSmall, { backgroundColor: "rgba(250,110,30,0.8)" }]} />
              <View style={[styles.heatmapCellSmall, { backgroundColor: habitColor }]} />
              <Text style={styles.legendText}>More</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    gap: 12,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: SUB,
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  configCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    gap: 12,
  },
  configTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
  },
  configRow: {
    flexDirection: "row",
    gap: 12,
  },
  configLabel: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  configInput: {
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT,
    fontSize: 14,
  },
  saveConfigBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  saveConfigBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
  },
  todayCardLeft: {
    gap: 4,
  },
  todayCardLabel: {
    color: SUB,
    fontSize: 13,
    fontWeight: "600",
  },
  todayCardValue: {
    color: TEXT,
    fontSize: 24,
    fontWeight: "800",
  },
  quantityLogActions: {
    flexDirection: "row",
    gap: 8,
  },
  qtyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
  },
  qtyBtnText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "700",
  },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: LINE,
  },
  checkBtnText: {
    color: SUB,
    fontSize: 14,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    gap: 8,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
  },
  statNumber: {
    color: TEXT,
    fontSize: 24,
    fontWeight: "800",
  },
  statUnit: {
    color: SUB,
    fontSize: 14,
    fontWeight: "500",
  },
  sectionBox: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
  },
  targetPeriodRow: {
    flexDirection: "row",
    backgroundColor: FIELD,
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  periodTab: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  periodTabActive: {
    backgroundColor: "#333333",
  },
  periodTabText: {
    color: SUB,
    fontSize: 11,
    fontWeight: "600",
  },
  periodTabTextActive: {
    color: TEXT,
    fontWeight: "700",
  },
  progressBarWrapper: {
    gap: 8,
    marginTop: 4,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: FIELD,
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabelLeft: {
    color: SUB,
    fontSize: 13,
    fontWeight: "600",
  },
  progressLabelRight: {
    fontSize: 14,
    fontWeight: "800",
  },
  heatmapCount: {
    color: SUB,
    fontSize: 12,
  },
  heatmapScroll: {
    marginTop: 4,
  },
  heatmapContainer: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 6,
  },
  heatmapCol: {
    flexDirection: "column",
    gap: 4,
  },
  heatmapCell: {
    width: 13,
    height: 13,
    borderRadius: 3,
  },
  heatmapLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  legendText: {
    color: SUB,
    fontSize: 11,
  },
  heatmapCellSmall: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
