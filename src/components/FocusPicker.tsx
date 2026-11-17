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

const BG = "#141414";
const SEARCH_BG = "#2E2E2E";
const CIRCLE = "#6F6F6F";
const TAB_IDLE = "#9E9E9E";
const DATE_IDLE = "#9E9E9E";
const RED = "#EA5A47";

const ENERGY_COLOR: Record<Task["energy"], string> = {
  high: "#E5484D",
  medium: "#D8B62E",
  low: "#4CC3E8",
};

const fmtDue = (key: string): string => {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

type Tab = "task" | "habit";

type Props = {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function FocusPicker({
  visible,
  onClose,
  tasks,
  selectedId,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("task");
  const [query, setQuery] = useState("");
  const [overdueOpen, setOverdueOpen] = useState(true);


  const open = useMemo(() => tasks.filter((t) => t.status !== "done" && t.status !== "habit"), [tasks]);
  const habits = useMemo(() => tasks.filter((t) => t.is_habit === 1), [tasks]);
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byTitle = (t: Task) => t.title.toLowerCase().includes(q);
    return q ? { tasks: open.filter(byTitle), habits: habits.filter(byTitle) } : { tasks: open, habits };
  }, [open, habits, query]);

  const groups = useMemo(() => {
    const today = dayKey();
    const overdue = matched.tasks.filter((t) => t.due_date && t.due_date < today);
    const todayList = matched.tasks.filter((t) => t.due_date === today);
    const upcoming = matched.tasks.filter((t) => t.due_date && t.due_date > today);
    const noDate = matched.tasks.filter((t) => !t.due_date);
    return { overdue, todayList, upcoming, noDate };
  }, [matched]);

  const pick = (id: string) => {
    onSelect(selectedId === id ? "" : id);
    onClose();
  };

  const renderRow = (t: Task, showDue: boolean) => {
    const selected = selectedId === t.id;
    return (
      <Pressable style={styles.row} onPress={() => pick(t.id)} accessibilityRole="button">
        {t.energy ? (
          <View style={[styles.energyBar, { backgroundColor: ENERGY_COLOR[t.energy] }]} />
        ) : (
          <View style={styles.energySpacer} />
        )}
        <View style={[styles.circle, selected && styles.circleActive]}>
          {selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {t.title}
        </Text>
        {showDue && t.due_date ? (
          <Text style={[styles.due, t.due_date < dayKey() && { color: RED }]}>{fmtDue(t.due_date)}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.header}>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close picker">
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
          {(["task", "habit"] as Tab[]).map((t) => (
            <Pressable key={t} style={styles.tab} onPress={() => setTab(t)} accessibilityRole="tab">
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "task" ? "Task" : "Habit"}
              </Text>
              {tab === t && <View style={styles.tabUnderline} />}
            </Pressable>
          ))}
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={TAB_IDLE} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={TAB_IDLE}
            style={styles.searchInput}
          />
        </View>

        {tab === "task" ? (
          <ScrollView contentContainerStyle={styles.list}>
            {groups.overdue.length > 0 && (
              <>
                <Pressable style={styles.sectionHead} onPress={() => setOverdueOpen((v) => !v)} accessibilityRole="button">
                  <Text style={styles.sectionText}>
                    OVERDUE{query.trim() ? "" : ` (${groups.overdue.length})`}
                  </Text>
                  <Ionicons name={overdueOpen ? "chevron-up" : "chevron-down"} size={18} color={TAB_IDLE} />
                </Pressable>
                {overdueOpen && groups.overdue.map((t) => renderRow(t, true))}
              </>
            )}

            {groups.todayList.length > 0 && (
              <>
                <Text style={styles.sectionText}>TODAY</Text>
                {groups.todayList.map((t) => renderRow(t, true))}
              </>
            )}

            {groups.upcoming.length > 0 && (
              <>
                <Text style={styles.sectionText}>UPCOMING</Text>
                {groups.upcoming.map((t) => renderRow(t, true))}
              </>
            )}

            {groups.noDate.length > 0 && (
              <>
                <Text style={styles.sectionText}>NO DATE</Text>
                {groups.noDate.map((t) => renderRow(t, false))}
              </>
            )}

            {matched.tasks.length === 0 && <Text style={styles.empty}>No matching tasks</Text>}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            <Text style={styles.sectionText}>HABITS</Text>
            {matched.habits.map((t) => renderRow(t, false))}
            {matched.habits.length === 0 && <Text style={styles.empty}>No habits yet</Text>}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 16 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  tab: { alignItems: "center", marginRight: 6 },
  tabText: { color: TAB_IDLE, fontSize: 17, fontWeight: "600" },
  tabTextActive: { color: "#FA6E1E", fontWeight: "700" },
  tabUnderline: { height: 3, borderRadius: 2, backgroundColor: "#FA6E1E", alignSelf: "stretch", marginTop: 5 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SEARCH_BG,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginHorizontal: 14,
    marginTop: 12,
  },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 15 },
  list: { paddingHorizontal: 8, paddingTop: 4 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionText: { color: "#B3B3B3", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52, gap: 12 },
  energyBar: { width: 3, height: 30, borderRadius: 2 },
  energySpacer: { width: 3, height: 30 },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
  circleActive: { borderColor: "#FA6E1E", backgroundColor: "#FA6E1E" },
  rowTitle: { flex: 1, color: "#FFFFFF", fontSize: 16 },
  due: { color: DATE_IDLE, fontSize: 13 },
  empty: { color: TAB_IDLE, fontSize: 14, textAlign: "center", paddingVertical: 20 },
});
