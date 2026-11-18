import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import type { Task } from "../db/database";
import { fmtDue } from "../utils/taskFormat";
import { dayKey } from "../utils/time";
import { useStore } from "../store/useStore";
import CustomTimePicker from "./CustomTimePicker";

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
    deleteTask,
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
  const [remindTime, setRemindTime] = useState(task.remind_time ?? null);
  const [sectionId, setSectionId] = useState(task.section_id ?? null);
  const [subInput, setSubInput] = useState("");
  const [editingNote, setEditingNote] = useState(!task.note);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Dependency system
  const taskDeps = dependencies.filter((d) => d.task_id === task.id);
  const blockerTasks = tasks.filter((t) => taskDeps.some((d) => d.depends_on_task_id === t.id));

  // Eligible tasks to depend on (not self, not habits)
  const candidateDeps = tasks.filter((t) => t.id !== task.id && !t.is_habit);

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
      remind_time: remindTime,
      section_id: sectionId,
    });
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

          {(task.due_date || task.actual_min) && (
            <View style={styles.metaRow}>
              {task.due_date && (
                <View style={styles.metaChip}>
                  <Ionicons name="calendar-outline" size={13} color={task.due_date && task.due_date < dayKey() ? RED : SUB} />
                  <Text style={styles.metaText}>{fmtDue(task.due_date)}</Text>
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

            {/* Section / Category selector */}
            {sections.length > 0 && (
              <>
                <Text style={styles.label}>Category</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, sectionId === null && styles.chipActive]}
                    onPress={() => { setSectionId(null); updateTask(task.id, { section_id: null }); }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipText, sectionId === null && styles.chipTextActive]}>None</Text>
                  </Pressable>
                  {sections.map((sec) => (
                    <Pressable
                      key={sec.id}
                      style={[styles.chip, sectionId === sec.id && styles.chipActive]}
                      onPress={() => { setSectionId(sec.id); updateTask(task.id, { section_id: sec.id }); }}
                      accessibilityRole="button"
                    >
                      <View style={[styles.energyDot, { backgroundColor: sec.color }]} />
                      <Text style={[styles.chipText, sectionId === sec.id && styles.chipTextActive]}>
                        {sec.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Custom Time Picker Remind Setting (Item 16) */}
            {task.due_date && (
              <>
                <Text style={styles.label}>Reminder Time</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, remindTime !== null && styles.chipActive]}
                    onPress={() => setShowTimePicker(true)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="time-outline" size={15} color={remindTime ? ACCENT : SUB} />
                    <Text style={[styles.chipText, remindTime !== null && styles.chipTextActive]}>
                      {remindTime ? remindTime : "Set Custom Time"}
                    </Text>
                  </Pressable>
                  {remindTime !== null && (
                    <Pressable
                      style={styles.chip}
                      onPress={() => {
                        setRemindTime(null);
                        updateTask(task.id, { remind_time: null });
                      }}
                      accessibilityRole="button"
                    >
                      <Ionicons name="close-circle" size={15} color={SUB} />
                      <Text style={styles.chipText}>Clear</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {/* Task Dependency System (Item 17) */}
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

            {/* Add dependency picker */}
            {candidateDeps.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={styles.chipRow}>
                  {candidateDeps
                    .filter((c) => !blockerTasks.some((b) => b.id === c.id))
                    .slice(0, 8)
                    .map((c) => (
                      <Pressable
                        key={c.id}
                        style={styles.chip}
                        onPress={() => addDependency(task.id, c.id)}
                        accessibilityRole="button"
                      >
                        <Ionicons name="link-outline" size={13} color={SUB} />
                        <Text style={styles.chipText} numberOfLines={1}>
                          + Depends on: {c.title}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </ScrollView>
            )}

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
              onPress={() => { deleteTask(task.id); onClose(); }}
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={22} color={RED} />
              <Text style={[styles.actionText, { color: RED }]}>Delete task</Text>
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
