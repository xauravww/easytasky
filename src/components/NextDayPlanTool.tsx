import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import { addDays, dayKey } from "../utils/time";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const ON_ACCENT = "#FFFFFF";

const fmtDateDisplay = (key: string) => {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export default function NextDayPlanTool() {
  const [dayOffset, setDayOffset] = useState(1); // default 1 = tomorrow
  const selectedDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);
  const currentKey = useMemo(() => dayKey(selectedDate), [selectedDate]);

  const saveDailyNote = useStore((s) => s.saveDailyNote);
  const getDailyNote = useStore((s) => s.getDailyNote);
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const addShutdownRitual = useStore((s) => s.addShutdownRitual);
  const shutdownRituals = useStore((s) => s.shutdownRituals);

  const [prevKey, setPrevKey] = useState(currentKey);
  const [noteText, setNoteText] = useState(() => getDailyNote(currentKey));
  const [savedStatus, setSavedStatus] = useState("");
  const [taskInput, setTaskInput] = useState("");

  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setNoteText(getDailyNote(currentKey));
    setSavedStatus("");
  }

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    saveDailyNote(currentKey, text);
    setSavedStatus("Saved automatically");
    setTimeout(() => setSavedStatus(""), 2000);
  };

  const handleAddTask = () => {
    const clean = taskInput.trim();
    if (!clean) return;
    addTask({
      title: clean,
      due_date: currentKey,
      status: "inbox",
      quadrant: "not_urgent_important",
    });
    setTaskInput("");
  };

  // Sync to Shutdown Ritual as an item to complete
  const syncToShutdownRitual = async () => {
    const ritualTitle = `Review Next-Day Plan (${fmtDateDisplay(currentKey)})`;
    const exists = shutdownRituals.some((r) => r.title.toLowerCase().includes("next-day"));
    if (!exists) {
      await addShutdownRitual(ritualTitle);
    }
    setSavedStatus("Synced to Shutdown Ritual checklist!");
    setTimeout(() => setSavedStatus(""), 3000);
  };

  const plannedTasks = tasks.filter(
    (t) => t.due_date === currentKey && t.status !== "done" && t.status !== "unwanted"
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Date switcher header */}
        <View style={styles.dateBar}>
          <Pressable
            style={styles.navBtn}
            onPress={() => setDayOffset((d) => d - 1)}
            accessibilityRole="button"
            accessibilityLabel="Previous date"
          >
            <Ionicons name="chevron-back" size={20} color={TEXT} />
          </Pressable>
          <View style={styles.dateCenter}>
            <Text style={styles.dateTitle}>{fmtDateDisplay(currentKey)}</Text>
            <Text style={styles.dateSub}>
              {dayOffset === 1
                ? "Tomorrow"
                : dayOffset === 0
                ? "Today"
                : dayOffset > 1
                ? `In ${dayOffset} days`
                : `${Math.abs(dayOffset)} days ago`}
            </Text>
          </View>
          <Pressable
            style={styles.navBtn}
            onPress={() => setDayOffset((d) => d + 1)}
            accessibilityRole="button"
            accessibilityLabel="Next date"
          >
            <Ionicons name="chevron-forward" size={20} color={TEXT} />
          </Pressable>
        </View>

        {/* AI Agent Learning Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="bulb-outline" size={18} color={ACCENT} />
          <Text style={styles.infoText}>
            <Text style={{ fontWeight: "700", color: TEXT }}>Agent Reference Journal: </Text>
            Write rough notes, intentions, or priorities. The AI agent refers to these plans when suggesting tasks, preparing your schedule, and adapting to your workflow.
          </Text>
        </View>

        {/* Notebook paper container */}
        <View style={styles.notebookContainer}>
          <View style={styles.notebookHeader}>
            <Ionicons name="journal-outline" size={18} color={ACCENT} />
            <Text style={styles.notebookHeaderTitle}>Next-Day Notebook</Text>
            {savedStatus ? <Text style={styles.savedStatus}>{savedStatus}</Text> : null}
          </View>
          <TextInput
            style={styles.notebookInput}
            value={noteText}
            onChangeText={handleNoteChange}
            multiline
            placeholder="Write roughly what you plan for this day... e.g.
- Morning deep work on client proposal
- Need 30 min to review emails
- Evening gym session"
            placeholderTextColor={SUB}
            textAlignVertical="top"
          />
        </View>

        {/* Sync action */}
        <Pressable style={styles.syncBtn} onPress={syncToShutdownRitual}>
          <Ionicons name="sync-outline" size={18} color="#FFFFFF" />
          <Text style={styles.syncBtnText}>Add &quot;Review Next-Day Plan&quot; to Shutdown Ritual</Text>
        </Pressable>

        {/* Specific quick task additions for this day */}
        <View style={styles.tasksSection}>
          <Text style={styles.sectionTitle}>Tasks Due On {fmtDateDisplay(currentKey)}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.taskInput}
              value={taskInput}
              onChangeText={setTaskInput}
              placeholder="Add specific task..."
              placeholderTextColor={SUB}
              onSubmitEditing={handleAddTask}
              returnKeyType="done"
            />
            <Pressable style={styles.addBtn} onPress={handleAddTask}>
              <Ionicons name="add" size={20} color={ON_ACCENT} />
            </Pressable>
          </View>

          {plannedTasks.length === 0 ? (
            <Text style={styles.emptyTasks}>No explicit tasks due on this date yet.</Text>
          ) : (
            plannedTasks.map((t) => (
              <View key={t.id} style={styles.taskItem}>
                <Ionicons name="ellipse-outline" size={14} color={ACCENT} />
                <Text style={styles.taskItemTitle}>{t.title}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 50 },
  dateBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 14,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222222",
  },
  dateCenter: { alignItems: "center" },
  dateTitle: { color: TEXT, fontSize: 17, fontWeight: "700" },
  dateSub: { color: ACCENT, fontSize: 12, marginTop: 2, fontWeight: "600" },
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(250,110,30,0.1)",
    borderWidth: 1,
    borderColor: "rgba(250,110,30,0.25)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { flex: 1, color: SUB, fontSize: 13, lineHeight: 18 },
  notebookContainer: {
    backgroundColor: "#1C1C1C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    minHeight: 220,
    marginBottom: 14,
  },
  notebookHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    paddingBottom: 10,
    marginBottom: 10,
  },
  notebookHeaderTitle: { color: TEXT, fontSize: 15, fontWeight: "700", flex: 1 },
  savedStatus: { color: "#12B76A", fontSize: 11, fontWeight: "600" },
  notebookInput: {
    color: TEXT,
    fontSize: 15,
    lineHeight: 24,
    minHeight: 160,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#222222",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    minHeight: 46,
    marginBottom: 20,
  },
  syncBtnText: { color: TEXT, fontSize: 13, fontWeight: "600" },
  tasksSection: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
  },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: "700", marginBottom: 12 },
  inputRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  taskInput: {
    flex: 1,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    color: TEXT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTasks: { color: SUB, fontSize: 13, fontStyle: "italic", paddingVertical: 8 },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  taskItemTitle: { color: TEXT, fontSize: 14 },
});
