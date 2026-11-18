import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store/useStore";
import { dayKey } from "../utils/time";
import { fmtDue } from "../utils/taskFormat";
import type { Task } from "../db/database";
import { aiEnabled, parseTaskToForm } from "../lib/aiClient";
import TaskDetailSheet from "../components/TaskDetailSheet";
import SearchablePickerModal from "../components/SearchablePickerModal";

const BG = "#141414";
const SEARCH_BG = "#2E2E2E";
const CIRCLE = "#6F6F6F";
const TAB_IDLE = "#9E9E9E";
const RED = "#EA5A47";
const ACCENT = "#FA6E1E";
const ON_ACCENT = "#FFFFFF";
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

type TaskSection = {
  title: string;
  data: Task[];
  showDue: boolean;
};

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
    refreshAll,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshError("");
    try {
      await refreshAll();
    } catch {
      setRefreshError("Couldn’t refresh tasks. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [quadrant, setQuadrant] = useState("urgent_important");
  const [energy, setEnergy] = useState<Task["energy"]>("medium");
  const [addingSectionId, setAddingSectionId] = useState<string | null>(null);
  const [showAddCategoryPicker, setShowAddCategoryPicker] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseErr, setParseErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(80);

  // Priority & Effort quick filter buttons
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [effortFilter, setEffortFilter] = useState<Task["energy"] | null>(null);

  const open = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "habit" && t.status !== "unwanted"),
    [tasks]
  );
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = q ? open.filter((t) => t.title.toLowerCase().includes(q)) : open;
    if (taskFilter) base = base.filter((t) => t.quadrant === taskFilter);
    if (sectionFilter) base = base.filter((t) => t.section_id === sectionFilter);
    if (priorityFilter) base = base.filter((t) => t.quadrant === priorityFilter);
    if (effortFilter) base = base.filter((t) => t.energy === effortFilter);
    return base;
  }, [open, query, taskFilter, sectionFilter, priorityFilter, effortFilter]);

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

  const taskSections = useMemo<TaskSection[]>(() => {
    const sections: TaskSection[] = [
      { title: `OVERDUE (${groups.overdue.length})`, data: groups.overdue, showDue: true },
      { title: "TODAY", data: groups.todayList, showDue: true },
      { title: "UPCOMING", data: groups.upcoming, showDue: true },
      { title: "NO DATE", data: groups.noDate, showDue: false },
    ];
    let remaining = visibleLimit;
    return sections
      .map((section) => {
        const data = section.data.slice(0, Math.max(0, remaining));
        remaining -= data.length;
        return { ...section, data };
      })
      .filter((section) => section.data.length > 0);
  }, [groups, visibleLimit]);

  const suggested = title.trim() ? (() => {
    const words = title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const done = tasks.filter((t) => t.status === "done" && t.actual_min);
    const matches = words.length ? done.filter((t) => words.some((w) => t.title.toLowerCase().includes(w))) : [];
    if (!matches.length) return null;
    const avg = matches.reduce((s, t) => s + (t.actual_min || 0), 0) / matches.length;
    return Math.round(avg * 1.25);
  })() : null;

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addTask({
        title: title.trim(),
        quadrant,
        energy,
        status: "inbox",
        due_date: dayKey(),
        estimated_min: suggested,
        section_id: addingSectionId || sectionFilter || undefined,
      });
      setTitle("");
      setAddingSectionId(null);
      setAdding(false);
    } catch {
      Alert.alert("Task not saved", "EasyTasky couldn’t save this task. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const clearAllFilters = () => {
    setQuery("");
    setPriorityFilter(null);
    setEffortFilter(null);
    clearTaskFilter();
    setSectionFilter(null);
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
        style={styles.row}
        onPress={() => openEdit(t)}
        accessibilityRole="button"
        accessibilityLabel={`${t.title}, ${t.energy} effort${t.due_date ? `, due ${fmtDue(t.due_date)}` : ", no due date"}`}
      >
        <View style={[styles.energyBar, { backgroundColor: ENERGY_COLOR[t.energy] }]} />
        <Pressable
          style={({ pressed }) => [styles.circleTouch, pressed && { opacity: 0.5 }]}
          onPress={(event) => {
            event.stopPropagation();
            handleCheckTask(t);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          accessibilityLabel={`Complete ${t.title}`}
        >
          <View style={styles.circle} />
        </Pressable>
        <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
        {showDue && t.due_date ? (
          <Text style={[styles.due, t.due_date < dayKey() && { color: RED }]}>{fmtDue(t.due_date)}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <SectionList
        sections={taskSections}
        keyExtractor={(item) => item.id}
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        initialNumToRender={16}
        maxToRenderPerBatch={12}
        windowSize={7}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (visibleLimit < matched.length) {
            setVisibleLimit((limit) => Math.min(limit + 80, matched.length));
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
          <View>
            <Text style={styles.h1}>Tasks</Text>
            <Text style={styles.headerSub}>{open.length} open · {matched.length} shown</Text>
          </View>
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={TAB_IDLE} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks..."
            placeholderTextColor={TAB_IDLE}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable
              style={styles.searchAction}
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear task search"
            >
              <Ionicons name="close-circle" size={18} color={TAB_IDLE} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.searchAction}
              onPress={onRefresh}
              disabled={refreshing}
              accessibilityRole="button"
              accessibilityLabel="Refresh tasks"
              accessibilityState={{ busy: refreshing }}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Ionicons name="refresh" size={18} color={TAB_IDLE} />
              )}
            </Pressable>
          )}
        </View>

        {refreshError ? (
          <Pressable
            style={styles.inlineError}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="Task refresh failed. Retry"
          >
            <Ionicons name="warning-outline" size={16} color="#FF8D90" />
            <Text style={styles.inlineErrorText}>{refreshError}</Text>
          </Pressable>
        ) : null}

        {/* Quick Filter Bar (Priority & Effort with colored badges) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickFilterScroll}
          contentContainerStyle={styles.quickFilterContent}
        >
          {/* Priority Quick Filters */}
          <Pressable
            style={[
              styles.smallFilterBtn,
              priorityFilter === "urgent_important" && styles.smallFilterBtnActive,
            ]}
            onPress={() =>
              setPriorityFilter(priorityFilter === "urgent_important" ? null : "urgent_important")
            }
            accessibilityRole="button"
            accessibilityState={{ selected: priorityFilter === "urgent_important" }}
          >
            <View style={[styles.filterColorDot, { backgroundColor: RED }]} />
            <Text
              style={[
                styles.smallFilterBtnText,
                priorityFilter === "urgent_important" && styles.smallFilterBtnTextActive,
              ]}
            >
              Do (Urgent)
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.smallFilterBtn,
              priorityFilter === "not_urgent_important" && styles.smallFilterBtnActive,
            ]}
            onPress={() =>
              setPriorityFilter(priorityFilter === "not_urgent_important" ? null : "not_urgent_important")
            }
            accessibilityRole="button"
            accessibilityState={{ selected: priorityFilter === "not_urgent_important" }}
          >
            <View style={[styles.filterColorDot, { backgroundColor: "#3B82F6" }]} />
            <Text
              style={[
                styles.smallFilterBtnText,
                priorityFilter === "not_urgent_important" && styles.smallFilterBtnTextActive,
              ]}
            >
              Schedule
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.smallFilterBtn,
              priorityFilter === "urgent_not_important" && styles.smallFilterBtnActive,
            ]}
            onPress={() =>
              setPriorityFilter(priorityFilter === "urgent_not_important" ? null : "urgent_not_important")
            }
            accessibilityRole="button"
            accessibilityState={{ selected: priorityFilter === "urgent_not_important" }}
          >
            <View style={[styles.filterColorDot, { backgroundColor: AMBER }]} />
            <Text
              style={[
                styles.smallFilterBtnText,
                priorityFilter === "urgent_not_important" && styles.smallFilterBtnTextActive,
              ]}
            >
              Delegate
            </Text>
          </Pressable>

          {/* Effort Quick Filters */}
          <Pressable
            style={[
              styles.smallFilterBtn,
              effortFilter === "high" && styles.smallFilterBtnActive,
            ]}
            onPress={() => setEffortFilter(effortFilter === "high" ? null : "high")}
            accessibilityRole="button"
            accessibilityState={{ selected: effortFilter === "high" }}
          >
            <View style={[styles.filterColorDot, { backgroundColor: RED }]} />
            <Text
              style={[
                styles.smallFilterBtnText,
                effortFilter === "high" && styles.smallFilterBtnTextActive,
              ]}
            >
              High Effort
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.smallFilterBtn,
              effortFilter === "medium" && styles.smallFilterBtnActive,
            ]}
            onPress={() => setEffortFilter(effortFilter === "medium" ? null : "medium")}
            accessibilityRole="button"
            accessibilityState={{ selected: effortFilter === "medium" }}
          >
            <View style={[styles.filterColorDot, { backgroundColor: AMBER }]} />
            <Text
              style={[
                styles.smallFilterBtnText,
                effortFilter === "medium" && styles.smallFilterBtnTextActive,
              ]}
            >
              Med Effort
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.smallFilterBtn,
              effortFilter === "low" && styles.smallFilterBtnActive,
            ]}
            onPress={() => setEffortFilter(effortFilter === "low" ? null : "low")}
            accessibilityRole="button"
            accessibilityState={{ selected: effortFilter === "low" }}
          >
            <View style={[styles.filterColorDot, { backgroundColor: "#4CC3E8" }]} />
            <Text
              style={[
                styles.smallFilterBtnText,
                effortFilter === "low" && styles.smallFilterBtnTextActive,
              ]}
            >
              Low Effort
            </Text>
          </Pressable>

          {(priorityFilter || effortFilter) && (
            <Pressable
              style={styles.clearAllFilterBtn}
              onPress={() => {
                setPriorityFilter(null);
                setEffortFilter(null);
              }}
            >
              <Ionicons name="close-circle" size={14} color={TAB_IDLE} />
              <Text style={styles.clearAllFilterText}>Clear</Text>
            </Pressable>
          )}
        </ScrollView>

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

          </>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionText}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => renderRow(item, section.showDue)}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={open.length === 0 ? "checkmark-done" : "search-outline"}
                size={28}
                color={ACCENT}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {open.length === 0 ? "Your task list is clear" : query ? `No match for “${query}”` : "No tasks fit these filters"}
            </Text>
            <Text style={styles.emptyHint}>
              {open.length === 0
                ? "Capture the next thing that deserves your attention."
                : "Adjust or clear the filters to bring tasks back into view."}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyAction, pressed && styles.controlPressed]}
              onPress={() => (open.length === 0 ? setAdding(true) : clearAllFilters())}
              accessibilityRole="button"
            >
              <Text style={styles.emptyActionText}>
                {open.length === 0 ? "Add a task" : "Clear filters"}
              </Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          visibleLimit < matched.length ? (
            <Text style={styles.loadingMore}>Loading more tasks…</Text>
          ) : undefined
        }
      />

      <Pressable style={styles.fab} onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="Add task">
        <Ionicons name="add" size={28} color={ON_ACCENT} />
      </Pressable>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView
          style={styles.scrim}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setAdding(false)}
            accessibilityRole="button"
            accessibilityLabel="Close new task"
          />
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
                    accessibilityRole="radio"
                    accessibilityState={{ selected: quadrant === q.key }}
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
                    accessibilityRole="radio"
                    accessibilityState={{ selected: energy === e }}
                  >
                    <Text style={[styles.chipText, energy === e && styles.chipTextActive]}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Dynamic Category Selector */}
              {sections.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <View style={styles.chipRow}>
                    <Pressable
                      style={[styles.chip, addingSectionId !== null && styles.chipActive]}
                      onPress={() => setShowAddCategoryPicker(true)}
                      accessibilityRole="button"
                    >
                      {(() => {
                        const targetId = addingSectionId || sectionFilter;
                        const currentSec = sections.find((s) => s.id === targetId);
                        if (currentSec) {
                          return (
                            <>
                              <View style={[styles.sectionChipDot, { backgroundColor: currentSec.color }]} />
                              <Text style={[styles.chipText, styles.chipTextActive]}>
                                {currentSec.name}
                              </Text>
                              <Ionicons name="chevron-down" size={14} color={ACCENT} style={{ marginLeft: 4 }} />
                            </>
                          );
                        }
                        return (
                          <>
                            <Ionicons name="folder-outline" size={15} color={TAB_IDLE} />
                            <Text style={styles.chipText}>Select Category</Text>
                            <Ionicons name="chevron-down" size={14} color={TAB_IDLE} style={{ marginLeft: 4 }} />
                          </>
                        );
                      })()}
                    </Pressable>

                    {addingSectionId !== null && (
                      <Pressable
                        style={styles.chip}
                        onPress={() => setAddingSectionId(null)}
                        accessibilityRole="button"
                      >
                        <Ionicons name="close-circle" size={15} color={TAB_IDLE} />
                        <Text style={styles.chipText}>Clear</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
              {aiEnabled() && (
                <Pressable
                  style={[styles.parseBtn, parsing && styles.disabled]}
                  onPress={runParse}
                  disabled={parsing}
                  accessibilityRole="button"
                  accessibilityState={{ busy: parsing }}
                >
                  <Ionicons name="sparkles-outline" size={16} color={ACCENT} />
                  <Text style={styles.parseBtnText}>{parsing ? "Parsing…" : "Parse with AI"}</Text>
                </Pressable>
              )}
              {parseErr ? <Text style={styles.parseErr}>{parseErr}</Text> : null}
              {suggested ? (
                <Text style={styles.estimate}>~{suggested} min. Based on similar past tasks, plus 25% extra time</Text>
              ) : null}
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
                <Text style={styles.submitText}>{submitting ? "Adding…" : "Add to inbox"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {editing && <TaskDetailSheet task={editing} onClose={() => setEditing(null)} />}

      {/* Add Task Category Searchable Picker */}
      <SearchablePickerModal
        visible={showAddCategoryPicker}
        title="Select Category"
        placeholder="Search categories..."
        items={sections.map((s) => ({
          id: s.id,
          title: s.name,
          color: s.color,
        }))}
        selectedId={addingSectionId || sectionFilter}
        onSelect={(item) => {
          setAddingSectionId(item ? item.id : null);
        }}
        onClose={() => setShowAddCategoryPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
    paddingBottom: 14,
  },
  h1: { color: "#FFFFFF", fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
  headerSub: { color: TAB_IDLE, fontSize: 14, lineHeight: 19, marginTop: 1 },
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
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: SEARCH_BG, borderRadius: 14, paddingLeft: 14, paddingRight: 4, height: 48, marginBottom: 8 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 15 },
  searchAction: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
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
    marginBottom: 10,
  },
  inlineErrorText: { flex: 1, color: "#FFB3B5", fontSize: 13, lineHeight: 18 },
  quickFilterScroll: { marginBottom: 12 },
  quickFilterContent: { gap: 8, alignItems: "center" },
  smallFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: LINE,
  },
  smallFilterBtnActive: {
    backgroundColor: "#2A2A2A",
    borderColor: ACCENT,
  },
  filterColorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  smallFilterBtnText: {
    color: TAB_IDLE,
    fontSize: 13,
    fontWeight: "600",
  },
  smallFilterBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  clearAllFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    minHeight: 44,
  },
  clearAllFilterText: {
    color: TAB_IDLE,
    fontSize: 12,
  },
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
  submit: { backgroundColor: ACCENT, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 48 },
  submitText: { color: ON_ACCENT, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.42 },
  controlPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  sectionText: { color: "#B3B3B3", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: 6, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 58, gap: 8 },
  energyBar: { width: 3, height: 30, borderRadius: 2 },
  circleTouch: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  circle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: CIRCLE, alignItems: "center", justifyContent: "center" },
  rowTitle: { flex: 1, color: "#FFFFFF", fontSize: 16 },
  due: { color: "#9E9E9E", fontSize: 13 },
  emptyState: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 44 },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: "rgba(250,110,30,0.1)",
    borderWidth: 1,
    borderColor: "rgba(250,110,30,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyHint: { color: TAB_IDLE, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 6 },
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
  loadingMore: { color: TAB_IDLE, fontSize: 13, textAlign: "center", paddingVertical: 16 },
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
