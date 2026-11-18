import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import { dayKey } from "../utils/time";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const GREEN = "#12B76A";
const BLUE = "#4CC3E8";
const PURPLE = "#8B5CF6";

type Period = "today" | "week" | "month" | "quarter" | "year";

export default function ReviewScreen() {
  const tasks = useStore((s) => s.tasks);
  const pomos = useStore((s) => s.pomos);
  const blocks = useStore((s) => s.blocks);

  const [period, setPeriod] = useState<Period>("week");

  // Non-habit tasks
  const realTasks = useMemo(
    () => tasks.filter((t) => t.is_habit !== 1 && t.status !== "unwanted"),
    [tasks]
  );
  const doneTasks = useMemo(() => realTasks.filter((t) => t.status === "done"), [realTasks]);

  // Overall Task & Focus Completion Stats
  const stats = useMemo(() => {
    const totalCount = realTasks.length;
    const completedCount = doneTasks.length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Total focus duration in minutes from completed pomos
    const totalFocusMin = pomos.reduce((acc, p) => {
      const sec = p.focus_sec || (p.focus_min ? p.focus_min * 60 : 0);
      return acc + Math.round(sec / 60);
    }, 0);

    const plannedTimeMin = realTasks.reduce((acc, t) => acc + (t.estimated_min || 0), 0);
    const actualTimeMin = realTasks.reduce((acc, t) => acc + (t.actual_min || 0), 0);

    return {
      totalCount,
      completedCount,
      completionRate,
      totalFocusMin,
      plannedTimeMin,
      actualTimeMin,
    };
  }, [realTasks, doneTasks, pomos]);

  // Period stats for Task Breakdown
  const periodStats = useMemo(() => {
    const now = new Date();
    let days = 1;
    if (period === "today") days = 1;
    else if (period === "week") days = 7;
    else if (period === "month") days = 30;
    else if (period === "quarter") days = 90;
    else if (period === "year") days = 365;

    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    const cutoffEpoch = cutoff.getTime();
    const cutoffDateStr = dayKey(cutoff);
    const todayDateStr = dayKey(now);

    const tasksInWindow = realTasks.filter((t) => {
      if (t.due_date && t.due_date >= cutoffDateStr && t.due_date <= todayDateStr) return true;
      if (t.created_at && t.created_at >= cutoffEpoch && t.created_at <= now.getTime()) return true;
      return false;
    });

    const doneInWindow = tasksInWindow.filter((t) => t.status === "done");
    const openInWindow = tasksInWindow.filter((t) => t.status !== "done");

    const pomosInWindow = pomos.filter((p) => {
      const at = p.completed_at || p.started_at;
      return at >= cutoffEpoch;
    });

    const focusMin = pomosInWindow.reduce((acc, p) => {
      const sec = p.focus_sec || (p.focus_min ? p.focus_min * 60 : 0);
      return acc + Math.round(sec / 60);
    }, 0);

    const pct = tasksInWindow.length > 0 ? Math.round((doneInWindow.length / tasksInWindow.length) * 100) : 0;

    return {
      total: tasksInWindow.length,
      done: doneInWindow.length,
      open: openInWindow.length,
      focusMin,
      pct,
    };
  }, [period, realTasks, pomos]);

  // 52-week planning and focus heatmap. Tasks use their due date (or creation
  // date when undated); focus sessions use their actual completion date.
  const heatmapData = useMemo(() => {
    const now = new Date();
    const totalDays = 52 * 7;
    const start = new Date(now);
    start.setDate(now.getDate() - (totalDays - 1));

    // Map of dayKey -> activity score
    const dayScoreMap = new Map<string, number>();

    for (const t of realTasks) {
      if (t.due_date) {
        dayScoreMap.set(t.due_date, (dayScoreMap.get(t.due_date) || 0) + 1);
      } else if (t.created_at) {
        const k = dayKey(new Date(t.created_at));
        dayScoreMap.set(k, (dayScoreMap.get(k) || 0) + 1);
      }
    }

    for (const p of pomos) {
      if (p.completed_at) {
        const k = dayKey(new Date(p.completed_at));
        dayScoreMap.set(k, (dayScoreMap.get(k) || 0) + 1);
      }
    }

    const weeks: { day: string; count: number; intensity: number }[][] = [];
    let currentWeek: { day: string; count: number; intensity: number }[] = [];
    const iter = new Date(start);

    for (let i = 0; i < totalDays; i++) {
      const k = dayKey(iter);
      const count = dayScoreMap.get(k) || 0;
      let intensity = 0;
      if (count >= 4) intensity = 4;
      else if (count >= 3) intensity = 3;
      else if (count >= 2) intensity = 2;
      else if (count >= 1) intensity = 1;

      currentWeek.push({ day: k, count, intensity });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      iter.setDate(iter.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, [realTasks, pomos]);

  const heatmapEventCount = useMemo(
    () => heatmapData.flat().reduce((total, day) => total + day.count, 0),
    [heatmapData]
  );

  // Productivity Time Distribution (Scheduled Time Blocks by Kind)
  const blockDistribution = useMemo(() => {
    const distribution: Record<string, number> = {
      deep: 0,
      urgent: 0,
      batch: 0,
      maintenance: 0,
      buffer: 0,
    };
    for (const b of blocks) {
      const dur = Math.max(0, b.end_min - b.start_min);
      const type = b.type in distribution ? b.type : "batch";
      distribution[type] += dur;
    }
    const totalMin = Object.values(distribution).reduce((a, b) => a + b, 0);
    return { distribution, totalMin };
  }, [blocks]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {stats.totalCount === 0 && pomos.length === 0 ? (
          <View style={styles.emptyReview}>
            <View style={styles.emptyReviewIcon}>
              <Ionicons name="analytics-outline" size={24} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyReviewTitle}>Your review builds as you work</Text>
              <Text style={styles.emptyReviewText}>
                Complete tasks and focus sessions to reveal useful trends here.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Top Summary Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="checkmark-done-circle" size={18} color={GREEN} />
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <Text style={styles.statNumber}>
              {stats.completedCount} <Text style={styles.statSub}>/ {stats.totalCount}</Text>
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="pie-chart" size={18} color={ACCENT} />
              <Text style={styles.statLabel}>Completion</Text>
            </View>
            <Text style={styles.statNumber}>{stats.completionRate}%</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="hourglass" size={18} color={BLUE} />
              <Text style={styles.statLabel}>Focus Time</Text>
            </View>
            <Text style={styles.statNumber}>
              {stats.totalFocusMin} <Text style={styles.statSub}>min</Text>
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="speedometer" size={18} color={PURPLE} />
              <Text style={styles.statLabel}>Planned Time</Text>
            </View>
            <Text style={styles.statNumber}>
              {stats.plannedTimeMin} <Text style={styles.statSub}>min</Text>
            </Text>
          </View>
        </View>

        {/* Task Velocity & Progress Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tasks Created or Due</Text>

          {/* Period Filter Tabs */}
          <View style={styles.periodTabsRow}>
            {(["today", "week", "month", "quarter", "year"] as const).map((p) => (
              <Pressable
                key={p}
                style={[styles.periodTab, period === p && styles.periodTabActive]}
                onPress={() => setPeriod(p)}
                accessibilityRole="tab"
                accessibilityState={{ selected: period === p }}
              >
                <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
                  {p[0].toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Velocity Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${periodStats.pct}%` }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressMetaText}>
                Current completion: {periodStats.done}/{periodStats.total} ({periodStats.pct}%)
              </Text>
              <Text style={[styles.progressMetaText, { color: ACCENT, fontWeight: "700" }]}>
                {periodStats.focusMin}m focused
              </Text>
            </View>
          </View>
        </View>

        {/* 52-Week Annual Productivity Heatmap */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Planning & Focus Activity</Text>
            <Text style={styles.headerSubtitle}>52 Weeks</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.heatmapScroll}
            accessible
            accessibilityLabel={`52 week planning and focus activity, ${heatmapEventCount} total task and focus events`}
          >
            <View style={styles.heatmapGrid} importantForAccessibility="no-hide-descendants">
              {heatmapData.map((week, wIdx) => (
                <View key={wIdx} style={styles.heatmapCol}>
                  {week.map((day) => {
                    let bg = "#222222";
                    if (day.intensity === 1) bg = "rgba(250, 110, 30, 0.35)";
                    else if (day.intensity === 2) bg = "rgba(250, 110, 30, 0.6)";
                    else if (day.intensity === 3) bg = "rgba(250, 110, 30, 0.85)";
                    else if (day.intensity === 4) bg = "#FA6E1E";

                    return (
                      <View
                        key={day.day}
                        style={[styles.heatmapCell, { backgroundColor: bg }]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.heatmapLegend}>
            <Text style={styles.legendText}>Less</Text>
            <View style={[styles.legendBox, { backgroundColor: "#222222" }]} />
            <View style={[styles.legendBox, { backgroundColor: "rgba(250, 110, 30, 0.35)" }]} />
            <View style={[styles.legendBox, { backgroundColor: "rgba(250, 110, 30, 0.6)" }]} />
            <View style={[styles.legendBox, { backgroundColor: "rgba(250, 110, 30, 0.85)" }]} />
            <View style={[styles.legendBox, { backgroundColor: "#FA6E1E" }]} />
            <Text style={styles.legendText}>More</Text>
          </View>
        </View>

        {/* Time Allocation & Focus Kinds */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Scheduled Focus Allocation</Text>
            <Text style={styles.headerSubtitle}>{blockDistribution.totalMin}m total</Text>
          </View>

          <View style={styles.allocationGrid}>
            {[
              { key: "deep", label: "Deep Work", color: ACCENT },
              { key: "urgent", label: "Urgent", color: "#E5484D" },
              { key: "batch", label: "Batch Tasks", color: BLUE },
              { key: "maintenance", label: "Maintenance", color: GREEN },
              { key: "buffer", label: "Buffer", color: PURPLE },
            ].map((k) => {
              const min = blockDistribution.distribution[k.key] || 0;
              const pct = blockDistribution.totalMin > 0 ? Math.round((min / blockDistribution.totalMin) * 100) : 0;
              return (
                <View key={k.key} style={styles.allocationRow}>
                  <View style={styles.allocLeft}>
                    <View style={[styles.allocDot, { backgroundColor: k.color }]} />
                    <Text style={styles.allocLabel}>{k.label}</Text>
                  </View>
                  <View style={styles.allocBarOuter}>
                    <View style={[styles.allocBarFill, { width: `${pct}%`, backgroundColor: k.color }]} />
                  </View>
                  <Text style={styles.allocTime}>{min}m ({pct}%)</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36, gap: 16 },
  emptyReview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(250,110,30,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,110,30,0.24)",
    borderRadius: 16,
    padding: 14,
  },
  emptyReviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(250,110,30,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyReviewTitle: { color: TEXT, fontSize: 14, fontWeight: "700" },
  emptyReviewText: { color: SUB, fontSize: 13, lineHeight: 18, marginTop: 2 },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  statLabel: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
  },
  statNumber: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "700",
  },
  statSub: {
    color: SUB,
    fontSize: 14,
    fontWeight: "500",
  },

  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  headerSubtitle: {
    color: SUB,
    fontSize: 13,
    fontWeight: "500",
  },

  periodTabsRow: {
    flexDirection: "row",
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    padding: 4,
    marginBottom: 16,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  periodTabActive: {
    backgroundColor: "#262626",
  },
  periodTabText: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
  },
  periodTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  progressContainer: {
    gap: 8,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#262626",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 5,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressMetaText: {
    color: SUB,
    fontSize: 13,
    fontWeight: "500",
  },

  heatmapScroll: {
    marginVertical: 4,
  },
  heatmapGrid: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 4,
  },
  heatmapCol: {
    flexDirection: "column",
    gap: 4,
  },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 2.5,
  },
  heatmapLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 12,
  },
  legendText: {
    color: SUB,
    fontSize: 11,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },

  allocationGrid: {
    gap: 12,
  },
  allocationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  allocLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: 110,
  },
  allocDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  allocLabel: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "500",
  },
  allocBarOuter: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#262626",
    overflow: "hidden",
  },
  allocBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  allocTime: {
    color: SUB,
    fontSize: 12,
    width: 80,
    textAlign: "right",
  },
});
