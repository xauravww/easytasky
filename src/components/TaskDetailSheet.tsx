import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import type { Task } from "../db/database";
import { fmtDue } from "../utils/taskFormat";
import { addDays, dayKey, parseDay } from "../utils/time";
import { useStore } from "../store/useStore";
import CustomTimePicker from "./CustomTimePicker";
import SearchablePickerModal from "./SearchablePickerModal";

const SHEET = "#1A1A1A";
const FIELD_BG = "#1E1E1E";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const IDLE = "#6F6F6F";
const ACCENT = "#FA6E1E";
const TEAL = "#3ECF8E";
const RED = "#E5484D";

const ENERGY_COLOR: Record<Task["energy"], string> = {
  high: RED,
  medium: "#E0A93B",
  low: "#4CC3E8",
};

const QUADRANTS = [
  { key: "urgent_important", label: "Do" },
  { key: "not_urgent_important", label: "Schedule" },
  { key: "urgent_not_important", label: "Delegate" },
  { key: "neither", label: "Eliminate" },
] as const;

const QUICK_DATES = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "Next week", offset: 7 },
] as const;

type Props = {
  task: Task;
  onClose: () => void;
};

export default function TaskDetailSheet({ task, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const {
    tasks,
    subtasks,
    dependencies,
    sections,
    updateTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    startFocusFor,
    addDependency,
    removeDependency,
    canCompleteTask,
  } = useStore();

  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");
  const [quadrant, setQuadrant] = useState(task.quadrant ?? "not_urgent_important");
  const [energy, setEnergy] = useState<Task["energy"]>(task.energy);
  const [repeatRule, setRepeatRule] = useState(task.repeat_rule ?? null);
  const [dueDate, setDueDate] = useState(task.due_date ?? null);
  const [remindTime, setRemindTime] = useState(task.remind_time ?? null);
  const [sectionId, setSectionId] = useState(task.section_id ?? null);
  const [subInput, setSubInput] = useState("");
  const [editingNote, setEditingNote] = useState(!task.note);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);

  // Dependency system
  const taskDeps = dependencies.filter((d) => d.task_id === task.id);
  const blockerTasks = tasks.filter(
    (t) => t.status !== "unwanted" && taskDeps.some((d) => d.depends_on_task_id === t.id)
  );

  // Eligible tasks to depend on (not self, not habits)
  const candidateDeps = tasks.filter(
    (t) => t.id !== task.id && !t.is_habit && t.status !== "unwanted"
  );

  const mine = subtasks.filter((s) => s.task_id === task.id);
  const doneCount = mine.filter((s) => s.done).length;

  const saveMeta = () => {
    const trimmed = title.trim();
    updateTask(task.id, {
      title: trimmed || task.title,
      note: note.trim() || null,
      quadrant,
      energy,
      repeat_rule: repeatRule,
      due_date: dueDate,
      remind_time: remindTime,
      section_id: sectionId,
    });
  };

  const setTaskDueDate = (date: Date) => {
    const nextDueDate = dayKey(date);
    setDueDate(nextDueDate);
    setShowDatePicker(false);
    void updateTask(task.id, { due_date: nextDueDate });
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (event.type === "dismissed" || !date) return;
    setTaskDueDate(date);
  };

  const clearScheduleDate = () => {
    setDueDate(null);
    setRemindTime(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    void updateTask(task.id, { due_date: null, remind_time: null });
  };

  const submitSub = () => {
    if (!subInput.trim()) return;
    addSubtask(task.id, subInput);
    setSubInput("");
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.scrim} behavior="padding">
        <Pressable style={{ flex: 1 }} onPress={() => { saveMeta(); onClose(); }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.grabber} />

          <TextInput
            value={title}
            onChangeText={setTitle}
            onEndEditing={saveMeta}
            placeholder="Task title"
            placeholderTextColor={IDLE}
            style={styles.titleInput}
            multiline
          />

          {(dueDate || task.actual_min || mine.length > 0) && (
            <View style={styles.metaRow}>
              {dueDate && (
                <View style={styles.metaChip}>
                  <Ionicons name="calendar-outline" size={13} color={dueDate < dayKey() ? RED : SUB} />
                  <Text style={styles.metaText}>
                    {fmtDue(dueDate)}{remindTime ? ` · ${remindTime}` : ""}
                  </Text>
                </View>
              )}
              {!!task.actual_min && (
                <View style={styles.metaChip}>
                  <Ionicons name="timer-outline" size={13} color={SUB} />
                  <Text style={styles.metaText}>{task.actual_min}m focused</Text>
                </View>
              )}
              {mine.length > 0 && (
                <View style={styles.metaChip}>
                  <Ionicons name="list-outline" size={13} color={SUB} />
                  <Text style={styles.metaText}>
                    {doneCount}/{mine.length} subtasks
                  </Text>
                </View>
              )}
            </View>
          )}

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.labelRow}>
              <Text style={styles.label}>Notes</Text>
              {task.note ? (
                <Pressable onPress={() => setEditingNote((v) => !v)} accessibilityRole="button" accessibilityLabel="Toggle note editing">
                  <Ionicons name={editingNote ? "eye-outline" : "create-outline"} size={16} color={SUB} />
                </Pressable>
              ) : null}
            </View>
            {editingNote ? (
              <TextInput
                value={note}
                onChangeText={setNote}
                onEndEditing={() => { saveMeta(); setEditingNote(!note.trim()); }}
                placeholder="Add details… (markdown supported)"
                placeholderTextColor={IDLE}
                style={styles.noteInput}
                multiline
              />
            ) : (
              <Pressable onPress={() => setEditingNote(true)} style={styles.notePreview} accessibilityRole="button">
                <Markdown style={mdStyles}>{note || "Add details…"}</Markdown>
              </Pressable>
            )}

            <Text style={styles.label}>Subtasks</Text>
            {mine.map((s) => (
              <View key={s.id} style={styles.subRow}>
                <Pressable
                  style={({ pressed }) => [styles.subCheck, s.done ? styles.subCheckDone : null, pressed && { opacity: 0.6 }]}
                  onPress={() => toggleSubtask(s.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!s.done }}
                  accessibilityLabel={`Toggle ${s.title}`}
                >
                  {s.done ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
                </Pressable>
                <Text style={[styles.subTitle, s.done ? { color: SUB, textDecorationLine: "line-through" } : null]} numberOfLines={2}>
                  {s.title}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.subDelete, pressed && { opacity: 0.5 }]}
                  onPress={() => deleteSubtask(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${s.title}`}
                >
                  <Ionicons name="close" size={16} color={IDLE} />
                </Pressable>
              </View>
            ))}
            <View style={styles.subAddRow}>
              <TextInput
                value={subInput}
                onChangeText={setSubInput}
                onSubmitEditing={submitSub}
                placeholder="Add subtask…"
                placeholderTextColor={IDLE}
                style={styles.subAddInput}
                returnKeyType="done"
              />
              <Pressable style={({ pressed }) => [styles.subAddBtn, pressed && { opacity: 0.7 }]} onPress={submitSub} accessibilityRole="button" accessibilityLabel="Add subtask">
                <Ionicons name="add" size={18} color={ACCENT} />
              </Pressable>
            </View>

            <Text style={styles.label}>Priority</Text>
            <View style={styles.chipRow}>
              {QUADRANTS.map((q) => (
                <Pressable
                  key={q.key}
                  style={[styles.chip, quadrant === q.key && styles.chipActive]}
                  onPress={() => { setQuadrant(q.key); updateTask(task.id, { quadrant: q.key }); }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, quadrant === q.key && styles.chipTextActive]}>{q.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Effort</Text>
            <View style={styles.chipRow}>
              {(["low", "medium", "high"] as const).map((e) => (
                <Pressable
                  key={e}
                  style={[styles.chip, energy === e && styles.chipActive]}
                  onPress={() => { setEnergy(e); updateTask(task.id, { energy: e }); }}
                  accessibilityRole="button"
                >
                  <View style={[styles.energyDot, { backgroundColor: ENERGY_COLOR[e] }]} />
                  <Text style={[styles.chipText, energy === e && styles.chipTextActive]}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Schedule</Text>
            <View style={styles.scheduleCard}>
              <Pressable
                style={({ pressed }) => [styles.scheduleRow, pressed && styles.scheduleRowPressed]}
                onPress={() => setShowDatePicker((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={dueDate ? `Change due date, currently ${fmtDue(dueDate)}` : "Add due date"}
              >
                <View style={styles.scheduleIcon}>
                  <Ionicons name="calendar-outline" size={18} color={dueDate ? ACCENT : SUB} />
                </View>
                <View style={styles.scheduleCopy}>
                  <Text style={styles.scheduleTitle}>Date</Text>
                  <Text style={[styles.scheduleValue, dueDate && styles.scheduleValueActive]}>
                    {dueDate ? fmtDue(dueDate) : "Add due date"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={IDLE} />
              </Pressable>

              {showDatePicker ? (
                <View style={styles.datePickerWrap}>
                  <DateTimePicker
                    value={dueDate ? parseDay(dueDate) : new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "compact" : "default"}
                    themeVariant="dark"
                    onChange={handleDateChange}
                  />
                </View>
              ) : null}

              <View style={styles.scheduleDivider} />

              <Pressable
                style={({ pressed }) => [styles.scheduleRow, pressed && styles.scheduleRowPressed]}
                onPress={() => {
                  if (dueDate) setShowTimePicker(true);
                  else setShowDatePicker(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  dueDate
                    ? remindTime
                      ? `Change reminder time, currently ${remindTime}`
                      : "Add reminder time"
                    : "Add a due date before setting reminder time"
                }
              >
                <View style={styles.scheduleIcon}>
                  <Ionicons name="time-outline" size={18} color={remindTime ? ACCENT : SUB} />
                </View>
                <View style={styles.scheduleCopy}>
                  <Text style={styles.scheduleTitle}>Time</Text>
                  <Text style={[styles.scheduleValue, remindTime && styles.scheduleValueActive]}>
                    {remindTime ?? (dueDate ? "Add reminder time" : "Add a date first")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={IDLE} />
              </Pressable>
            </View>

            <View style={styles.quickDateRow}>
              {QUICK_DATES.map((option) => {
                const date = addDays(new Date(), option.offset);
                const selected = dueDate === dayKey(date);
                return (
                  <Pressable
                    key={option.label}
                    style={[styles.quickDateChip, selected && styles.quickDateChipActive]}
                    onPress={() => setTaskDueDate(date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.quickDateText, selected && styles.quickDateTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
              {remindTime ? (
                <Pressable
                  style={styles.quickDateChip}
                  onPress={() => {
                    setRemindTime(null);
                    void updateTask(task.id, { remind_time: null });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear reminder time"
                >
                  <Text style={styles.quickDateText}>Clear time</Text>
                </Pressable>
              ) : null}
              {dueDate ? (
                <Pressable
                  style={styles.quickDateChip}
                  onPress={clearScheduleDate}
                  accessibilityRole="button"
                  accessibilityLabel="Clear due date and reminder time"
                >
                  <Text style={styles.quickDateText}>Clear date</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.label}>Repeat</Text>
            <View style={styles.chipRow}>
              {([null, "daily", "weekly", "monthly"] as const).map((r) => (
                <Pressable
                  key={r ?? "none"}
                  style={[styles.chip, repeatRule === r && styles.chipActive]}
                  onPress={() => { setRepeatRule(r); updateTask(task.id, { repeat_rule: r }); }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, repeatRule === r && styles.chipTextActive]}>
                    {r === null ? "None" : r[0].toUpperCase() + r.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Section / Category selector with Searchable Picker */}
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, sectionId !== null && styles.chipActive]}
                onPress={() => setShowCategoryPicker(true)}
                accessibilityRole="button"
              >
                {(() => {
                  const currentSec = sections.find((s) => s.id === sectionId);
                  if (currentSec) {
                    return (
                      <>
                        <View style={[styles.energyDot, { backgroundColor: currentSec.color }]} />
                        <Text style={[styles.chipText, styles.chipTextActive]}>
                          {currentSec.name}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={ACCENT} style={{ marginLeft: 4 }} />
                      </>
                    );
                  }
                  return (
                    <>
                      <Ionicons name="folder-outline" size={15} color={SUB} />
                      <Text style={styles.chipText}>Select Category</Text>
                      <Ionicons name="chevron-down" size={14} color={SUB} style={{ marginLeft: 4 }} />
                    </>
                  );
                })()}
              </Pressable>

              {sectionId !== null && (
                <Pressable
                  style={styles.chip}
                  onPress={() => {
                    setSectionId(null);
                    updateTask(task.id, { section_id: null });
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons name="close-circle" size={15} color={SUB} />
                  <Text style={styles.chipText}>Clear</Text>
                </Pressable>
              )}
            </View>

            {/* Task Dependency System with Searchable Picker */}
            <Text style={styles.label}>Dependencies (Prerequisites)</Text>
            {blockerTasks.length > 0 ? (
              <View style={styles.depList}>
                {blockerTasks.map((dep) => (
                  <View key={dep.id} style={styles.depItem}>
                    <Ionicons
                      name={dep.status === "done" ? "checkmark-circle" : "alert-circle"}
                      size={16}
                      color={dep.status === "done" ? TEAL : RED}
                    />
                    <Text
                      style={[
                        styles.depTitle,
                        dep.status === "done" && { textDecorationLine: "line-through", color: SUB },
                      ]}
                      numberOfLines={1}
                    >
                      {dep.title}
                    </Text>
                    <Pressable
                      onPress={() => removeDependency(task.id, dep.id)}
                      style={{ padding: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel="Remove dependency"
                    >
                      <Ionicons name="close" size={16} color={SUB} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.depEmptyText}>No prerequisite dependencies set.</Text>
            )}

            {/* Add Dependency Search Button */}
            <View style={{ marginTop: 8 }}>
              <Pressable
                style={styles.chip}
                onPress={() => setShowDependencyPicker(true)}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle-outline" size={16} color={ACCENT} />
                <Text style={[styles.chipText, { color: ACCENT, fontWeight: "700" }]}>
                  Add Prerequisite Dependency…
                </Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
              onPress={() => { saveMeta(); startFocusFor(task.id); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel="Start focus session for this task"
            >
              <Ionicons name="play-circle-outline" size={22} color={ACCENT} />
              <Text style={[styles.actionText, { color: ACCENT, fontWeight: "700" }]}>Start focus</Text>
            </Pressable>
            <Pressable
              style={styles.actionRow}
              onPress={() => {
                if (task.status !== "done") {
                  const check = canCompleteTask(task.id);
                  if (!check.allowed) {
                    Alert.alert(
                      "Task Blocked",
                      `You cannot complete this task until its prerequisite tasks are finished:\n\n• ${check.blockingTasks.map((t) => t.title).join("\n• ")}`
                    );
                    return;
                  }
                }
                updateTask(task.id, { status: task.status === "done" ? "inbox" : "done" });
                onClose();
              }}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-circle-outline" size={22} color={task.status === "done" ? IDLE : TEAL} />
              <Text style={styles.actionText}>{task.status === "done" ? "Reopen task" : "Mark done"}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
              onPress={() => {
                void updateTask(task.id, { status: "unwanted" });
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Archive ${task.title}`}
            >
              <Ionicons name="archive-outline" size={22} color={SUB} />
              <Text style={[styles.actionText, { color: SUB }]}>Archive task</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CustomTimePicker
        visible={showTimePicker}
        initialTime={remindTime}
        onConfirm={(timeStr) => {
          setRemindTime(timeStr);
          updateTask(task.id, { remind_time: timeStr });
          setShowTimePicker(false);
        }}
        onClear={() => {
          setRemindTime(null);
          updateTask(task.id, { remind_time: null });
          setShowTimePicker(false);
        }}
        onClose={() => setShowTimePicker(false)}
      />

      {/* Category Searchable Picker */}
      <SearchablePickerModal
        visible={showCategoryPicker}
        title="Select Category"
        placeholder="Search categories..."
        items={sections.map((s) => ({
          id: s.id,
          title: s.name,
          color: s.color,
        }))}
        selectedId={sectionId}
        onSelect={(item) => {
          const newId = item ? item.id : null;
          setSectionId(newId);
          updateTask(task.id, { section_id: newId });
        }}
        onClose={() => setShowCategoryPicker(false)}
      />

      {/* Dependency Searchable Picker */}
      <SearchablePickerModal
        visible={showDependencyPicker}
        title="Add Prerequisite Dependency"
        placeholder="Search tasks..."
        items={candidateDeps
          .filter((c) => !blockerTasks.some((b) => b.id === c.id))
          .map((c) => ({
            id: c.id,
            title: c.title,
            subtitle: c.due_date ? `Due: ${c.due_date}` : undefined,
            icon: c.status === "done" ? "checkmark-circle-outline" : "ellipse-outline",
          }))}
        selectedId={null}
        allowClear={false}
        onSelect={(item) => {
          if (item) {
            addDependency(task.id, item.id);
          }
        }}
        onClose={() => setShowDependencyPicker(false)}
      />
    </Modal>
  );
}

const mdStyles = {
  body: { color: TEXT, fontSize: 15, lineHeight: 22 },
  heading1: { color: TEXT, fontSize: 20, fontWeight: "700", marginVertical: 6 },
  heading2: { color: TEXT, fontSize: 18, fontWeight: "700", marginVertical: 6 },
  heading3: { color: TEXT, fontSize: 16, fontWeight: "700", marginVertical: 4 },
  paragraph: { marginVertical: 4 },
  strong: { color: TEXT, fontWeight: "700" },
  em: { fontStyle: "italic" },
  s: { textDecorationLine: "line-through" },
  link: { color: ACCENT },
  code_inline: { backgroundColor: "#000000", color: "#F8F8F2", fontFamily: "monospace", paddingHorizontal: 4, borderRadius: 4 },
  code_block: { backgroundColor: "#000000", color: "#F8F8F2", fontFamily: "monospace", padding: 12, borderRadius: 8, marginVertical: 6 },
  fence: { backgroundColor: "#000000", padding: 12, borderRadius: 8, marginVertical: 6 },
  blockquote: { backgroundColor: "#1E1E1E", borderLeftWidth: 3, borderLeftColor: ACCENT, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 4 },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { flexDirection: "row", alignItems: "flex-start", marginVertical: 2 },
  hr: { backgroundColor: LINE, height: 1, marginVertical: 8 },
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: SHEET,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: LINE, marginTop: 10 },
  titleInput: {
    color: TEXT,
    fontSize: 19,
    fontWeight: "700",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: FIELD_BG, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  metaText: { color: SUB, fontSize: 12, fontWeight: "600" },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  label: { color: SUB, fontSize: 13, fontWeight: "600", marginTop: 14, marginBottom: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  notePreview: { backgroundColor: FIELD_BG, borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 14, minHeight: 60 },
  noteInput: {
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    color: TEXT,
    fontSize: 15,
    lineHeight: 21,
    padding: 14,
    minHeight: 76,
    textAlignVertical: "top",
    marginTop: 8,
  },
  subRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  subCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: IDLE,
    alignItems: "center",
    justifyContent: "center",
  },
  subCheckDone: { backgroundColor: TEAL, borderColor: TEAL },
  subTitle: { flex: 1, color: TEXT, fontSize: 15 },
  subDelete: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  subAddRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  subAddInput: {
    flex: 1,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    color: TEXT,
    fontSize: 15,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  subAddBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: ACCENT, alignItems: "center", justifyContent: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: LINE,
    backgroundColor: FIELD_BG,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipActive: { borderColor: ACCENT, backgroundColor: "rgba(250,110,30,0.12)" },
  chipText: { color: "#D6D6D6", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: ACCENT },
  energyDot: { width: 8, height: 8, borderRadius: 4 },
  scheduleCard: {
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    overflow: "hidden",
  },
  scheduleRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
  },
  scheduleRowPressed: { backgroundColor: "#242424" },
  scheduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#252525",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleCopy: { flex: 1 },
  scheduleTitle: { color: SUB, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  scheduleValue: { color: "#D6D6D6", fontSize: 15, lineHeight: 20, fontWeight: "600", marginTop: 1 },
  scheduleValueActive: { color: TEXT },
  scheduleDivider: { height: StyleSheet.hairlineWidth, backgroundColor: LINE, marginLeft: 59 },
  datePickerWrap: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  quickDateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  quickDateChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: FIELD_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  quickDateChipActive: { borderColor: ACCENT, backgroundColor: "rgba(250,110,30,0.12)" },
  quickDateText: { color: SUB, fontSize: 12, fontWeight: "700" },
  quickDateTextActive: { color: ACCENT },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: LINE, marginVertical: 14 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13 },
  actionText: { color: TEXT, fontSize: 16 },
  depList: { gap: 8, marginBottom: 8 },
  depItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: FIELD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  depTitle: { flex: 1, color: TEXT, fontSize: 13 },
  depEmptyText: { color: SUB, fontSize: 12, fontStyle: "italic", marginBottom: 6 },
});
