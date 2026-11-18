import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  SectionList,
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
const ACCENT = "#FA6E1E";
const ON_ACCENT = "#FFFFFF";

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

type FocusSection = {
  title: string;
  data: Task[];
  showDue: boolean;
  collapsible?: boolean;
};

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
  const [visibleCount, setVisibleCount] = useState(60);

  const open = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "habit" && t.status !== "unwanted"),
    [tasks]
  );
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

  const taskSections = useMemo<FocusSection[]>(() => {
    const source: FocusSection[] = [
      {
        title: `OVERDUE${query.trim() ? "" : ` (${groups.overdue.length})`}`,
        data: overdueOpen ? groups.overdue : [],
        showDue: true,
        collapsible: true,
      },
      { title: "TODAY", data: groups.todayList, showDue: true },
      { title: "UPCOMING", data: groups.upcoming, showDue: true },
      { title: "NO DATE", data: groups.noDate, showDue: false },
    ];
    let remaining = visibleCount;
    return source
      .map((section) => {
        const data = section.data.slice(0, Math.max(0, remaining));
        remaining -= data.length;
        return { ...section, data };
      })
      .filter((section) => section.collapsible ? groups.overdue.length > 0 : section.data.length > 0);
  }, [groups, overdueOpen, query, visibleCount]);

  const pick = (id: string) => {
    onSelect(selectedId === id ? "" : id);
    onClose();
  };

  const renderRow = (t: Task, showDue: boolean) => {
    const selected = selectedId === t.id;
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => pick(t.id)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${t.title}${t.due_date ? `, due ${fmtDue(t.due_date)}` : ""}`}
      >
        {t.energy ? (
          <View style={[styles.energyBar, { backgroundColor: ENERGY_COLOR[t.energy] }]} />
        ) : (
          <View style={styles.energySpacer} />
        )}
        <View style={[styles.circle, selected && styles.circleActive]}>
          {selected && <Ionicons name="checkmark" size={16} color={ON_ACCENT} />}
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
            <Pressable
              key={t}
              style={styles.tab}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
            >
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
          <SectionList
            sections={taskSections}
            keyExtractor={(item) => item.id}
            style={styles.listView}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            initialNumToRender={16}
            maxToRenderPerBatch={12}
            windowSize={7}
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (visibleCount < matched.tasks.length) {
                setVisibleCount((count) => Math.min(count + 60, matched.tasks.length));
              }
            }}
            renderSectionHeader={({ section }) =>
              section.collapsible ? (
                <Pressable
                  style={styles.sectionHead}
                  onPress={() => setOverdueOpen((value) => !value)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: overdueOpen }}
                >
                  <Text style={styles.sectionText}>{section.title}</Text>
                  <Ionicons name={overdueOpen ? "chevron-up" : "chevron-down"} size={18} color={TAB_IDLE} />
                </Pressable>
              ) : (
                <Text style={styles.sectionText}>{section.title}</Text>
              )
            }
            renderItem={({ item, section }) => renderRow(item, section.showDue)}
            ListEmptyComponent={<Text style={styles.empty}>No matching tasks</Text>}
          />
        ) : (
          <FlatList
            data={matched.habits.slice(0, visibleCount)}
            keyExtractor={(item) => item.id}
            style={styles.listView}
            contentContainerStyle={styles.list}
            initialNumToRender={16}
            maxToRenderPerBatch={12}
            windowSize={7}
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (visibleCount < matched.habits.length) {
                setVisibleCount((count) => Math.min(count + 60, matched.habits.length));
              }
            }}
            ListHeaderComponent={<Text style={styles.sectionText}>HABITS</Text>}
            renderItem={({ item }) => renderRow(item, false)}
            ListEmptyComponent={<Text style={styles.empty}>No habits yet</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 16 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tab: { minHeight: 44, alignItems: "center", justifyContent: "center", marginRight: 6 },
  tabText: { color: TAB_IDLE, fontSize: 17, fontWeight: "600" },
  tabTextActive: { color: ACCENT, fontWeight: "700" },
  tabUnderline: { height: 3, borderRadius: 2, backgroundColor: ACCENT, alignSelf: "stretch", marginTop: 5 },
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
  listView: { flex: 1 },
  list: { flexGrow: 1, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 20 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionText: { color: "#B3B3B3", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52, gap: 12 },
  rowPressed: { opacity: 0.72 },
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
  circleActive: { borderColor: ACCENT, backgroundColor: ACCENT },
  rowTitle: { flex: 1, color: "#FFFFFF", fontSize: 16 },
  due: { color: DATE_IDLE, fontSize: 13 },
  empty: { color: TAB_IDLE, fontSize: 14, textAlign: "center", paddingVertical: 20 },
});
