import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store/useStore";
import { dayKey } from "../utils/time";
import { fmtDue } from "../utils/taskFormat";
import type { Task } from "../db/database";
import { aiEnabled, parseTaskToForm } from "../lib/aiClient";
import TaskDetailSheet from "../components/TaskDetailSheet";

const BG = "#141414";
const SEARCH_BG = "#2E2E2E";
const CIRCLE = "#6F6F6F";
const TAB_IDLE = "#9E9E9E";
const RED = "#EA5A47";
const ACCENT = "#FA6E1E";
const AMBER = "#E0A93B";
const SHEET = "#1A1A1A";
const LINE = "#262626";

const ENERGY_COLOR: Record<Task["energy"], string> = {
  high: RED,
  medium: AMBER,
  low: "#4CC3E8",
};

const QUADRANTS = [
  { key: "urgent_important", label: "Do" },
  { key: "not_urgent_important", label: "Schedule" },
  { key: "urgent_not_important", label: "Delegate" },
  { key: "neither", label: "Eliminate" },
] as const;

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const {
    tasks,
    sections,
    addTask,
    updateTask,
    taskFilter,
    clearTaskFilter,
    sectionFilter,
    setSectionFilter,
    canCompleteTask,
  } = useStore();

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [quadrant, setQuadrant] = useState("urgent_important");
  const [energy, setEnergy] = useState<Task["energy"]>("medium");
  const [editing, setEditing] = useState<Task | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseErr, setParseErr] = useState("");

  const open = useMemo(() => tasks.filter((t) => t.status !== "done" && t.status !== "habit"), [tasks]);
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = q ? open.filter((t) => t.title.toLowerCase().includes(q)) : open;
    if (taskFilter) base = base.filter((t) => t.quadrant === taskFilter);
    if (sectionFilter) base = base.filter((t) => t.section_id === sectionFilter);
    return base;
  }, [open, query, taskFilter, sectionFilter]);

  const handleCheckTask = (t: Task) => {
    const check = canCompleteTask(t.id);
    if (!check.allowed) {
      Alert.alert(
        "Task Blocked",
        `You cannot complete this task until its prerequisite tasks are finished:\n\n• ${check.blockingTasks.map((b) => b.title).join("\n• ")}`
      );
      return;
    }
    updateTask(t.id, { status: "done" });
  };

  const groups = useMemo(() => {
    const today = dayKey();
    return {
      overdue: matched.filter((t) => t.due_date && t.due_date < today),
      todayList: matched.filter((t) => t.due_date === today),
      upcoming: matched.filter((t) => t.due_date && t.due_date > today),
      noDate: matched.filter((t) => !t.due_date),
    };
  }, [matched]);

  const suggested = title.trim() ? (() => {
    const words = title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const done = tasks.filter((t) => t.status === "done" && t.actual_min);
    const matches = words.length ? done.filter((t) => words.some((w) => t.title.toLowerCase().includes(w))) : [];
    if (!matches.length) return null;
    const avg = matches.reduce((s, t) => s + (t.actual_min || 0), 0) / matches.length;
    return Math.round(avg * 1.25);
  })() : null;

  const submit = () => {
    if (!title.trim()) return;
    addTask({ title: title.trim(), quadrant, energy, status: "inbox", due_date: dayKey(), estimated_min: suggested });
    setTitle("");
    setAdding(false);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
  };

  const runParse = async () => {
    if (!title.trim()) return;
    setParsing(true);
    setParseErr("");
    try {
      const p = await parseTaskToForm(title);
      setTitle(p.title);
      setQuadrant(p.quadrant);
      setEnergy(p.energy);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "AI parse failed");
    } finally {
      setParsing(false);
    }
  };

  const renderRow = (t: Task, showDue: boolean) => {
    return (
      <Pressable
        key={t.id}
        style={styles.row}
        onPress={() => openEdit(t)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${t.title}`}
      >
        <View style={[styles.energyBar, { backgroundColor: ENERGY_COLOR[t.energy] }]} />
        <Pressable
          style={({ pressed }) => [styles.circle, pressed && { opacity: 0.5 }]}
          onPress={() => handleCheckTask(t)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          accessibilityLabel={`Complete ${t.title}`}
        />
        <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
        {showDue && t.due_date ? (
          <Text style={[styles.due, t.due_date < dayKey() && { color: RED }]}>{fmtDue(t.due_date)}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        {taskFilter && (
          <Pressable style={styles.filterChip} onPress={clearTaskFilter} accessibilityRole="button" accessibilityLabel="Clear filter">
            <Ionicons name="filter" size={14} color={ACCENT} />
            <Text style={styles.filterText}>Showing: {taskFilter}</Text>
            <Ionicons name="close-circle" size={16} color={TAB_IDLE} />
          </Pressable>
        )}

        {/* Active Category Indicator (Filtered from Sidebar Drawer) */}
        {sectionFilter && (() => {
          const activeSec = sections.find((s) => s.id === sectionFilter);
          return (
            <Pressable
              style={styles.filterChip}
              onPress={() => setSectionFilter(null)}
              accessibilityRole="button"
              accessibilityLabel="Clear category filter"
            >
              <View style={[styles.sectionChipDot, { backgroundColor: activeSec?.color || ACCENT }]} />
              <Text style={styles.filterText}>Category: {activeSec?.name || "Filtered"}</Text>
              <Ionicons name="close-circle" size={16} color={TAB_IDLE} />
            </Pressable>
          );
        })()}

        {groups.overdue.length > 0 && (
          <>
            <Text style={styles.sectionText}>OVERDUE ({groups.overdue.length})</Text>
            {groups.overdue.map((t) => renderRow(t, true))}
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
        {matched.length === 0 && <Text style={styles.empty}>No matching tasks</Text>}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="Add task">
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={styles.scrim}>
          <Pressable style={{ flex: 1 }} onPress={() => setAdding(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.sheetTitle}>New task</Text>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What do you need to do?"
                placeholderTextColor={TAB_IDLE}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.chipRow}>
                {QUADRANTS.map((q) => (
                  <Pressable
                    key={q.key}
                    style={[styles.chip, quadrant === q.key && styles.chipActive]}
                    onPress={() => setQuadrant(q.key)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipText, quadrant === q.key && styles.chipTextActive]}>{q.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Effort</Text>
              <View style={styles.chipRow}>
                {(["low", "medium", "high"] as const).map((e) => (
                  <Pressable
                    key={e}
                    style={[styles.chip, energy === e && styles.chipActive]}
                    onPress={() => setEnergy(e)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipText, energy === e && styles.chipTextActive]}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              {aiEnabled() && (
                <Pressable style={styles.parseBtn} onPress={runParse} disabled={parsing} accessibilityRole="button">
                  <Ionicons name="sparkles-outline" size={16} color={ACCENT} />
                  <Text style={styles.parseBtnText}>{parsing ? "Parsing…" : "Parse with AI"}</Text>
                </Pressable>
              )}
              {parseErr ? <Text style={styles.parseErr}>{parseErr}</Text> : null}
              {suggested ? (
                <Text style={styles.estimate}>~{suggested} min. Based on similar past tasks, plus 25% extra time</Text>
              ) : null}
              <Pressable style={styles.submit} onPress={submit} accessibilityRole="button">
                <Text style={styles.submitText}>Add to inbox</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {editing && <TaskDetailSheet task={editing} onClose={() => setEditing(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: SEARCH_BG, borderRadius: 14, paddingHorizontal: 14, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 15 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(250,110,30,0.12)",
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  sectionChipsScroll: { marginBottom: 12 },
  sectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#202020",
    borderWidth: 1,
    borderColor: LINE,
    marginRight: 8,
  },
  sectionChipActive: {
    borderColor: ACCENT,
    backgroundColor: "rgba(250,110,30,0.15)",
  },
  sectionChipDot: { width: 8, height: 8, borderRadius: 4 },
  sectionChipText: { color: TAB_IDLE, fontSize: 13, fontWeight: "600" },
  sectionChipTextActive: { color: ACCENT, fontWeight: "700" },
  filterText: { color: ACCENT, fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: "#1A1A1A", borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 16, marginBottom: 12 },
  input: { backgroundColor: "#1E1E1E", borderWidth: 1.5, borderColor: LINE, borderRadius: 12, color: "#FFFFFF", fontSize: 15, padding: 14, marginBottom: 12 },
  fieldLabel: { color: TAB_IDLE, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  chip: { minHeight: 40, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: LINE, backgroundColor: "#1E1E1E", alignItems: "center", justifyContent: "center", marginRight: 8, marginBottom: 8 },
  chipActive: { borderColor: ACCENT, backgroundColor: "rgba(250,110,30,0.12)" },
  chipText: { color: "#D6D6D6", fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: ACCENT },
  estimate: { color: ACCENT, fontSize: 13, fontWeight: "600", marginBottom: 12 },
  parseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 12, paddingVertical: 12, marginBottom: 10 },
  parseBtnText: { color: ACCENT, fontSize: 15, fontWeight: "700" },
  parseErr: { color: RED, fontSize: 13, marginBottom: 10 },
  submit: { backgroundColor: ACCENT, borderRadius: 12, alignItems: "center", paddingVertical: 14 },
  submitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  sectionText: { color: "#B3B3B3", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: 6, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52, gap: 12 },
  energyBar: { width: 3, height: 30, borderRadius: 2 },
  circle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: CIRCLE, alignItems: "center", justifyContent: "center" },
  rowTitle: { flex: 1, color: "#FFFFFF", fontSize: 16 },
  due: { color: "#9E9E9E", fontSize: 13 },
  empty: { color: TAB_IDLE, fontSize: 15, textAlign: "center", paddingVertical: 28 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: SHEET, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: "88%" },
  sheetContent: { paddingBottom: 8 },
  sheetTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", paddingBottom: 8, textAlign: "center" },
  editDivider: { height: StyleSheet.hairlineWidth, backgroundColor: LINE, marginVertical: 14 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  sheetRowText: { color: "#FFFFFF", fontSize: 16 },
  sheetCancel: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE, paddingTop: 14, alignItems: "center" },
  sheetCancelText: { color: TAB_IDLE, fontSize: 16, fontWeight: "600" },
});
