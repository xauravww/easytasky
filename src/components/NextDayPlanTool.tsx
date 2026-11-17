import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import { aiJson } from "../lib/aiClient";
import { addDays, dayKey } from "../utils/time";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const IDLE = "#6F6F6F";
const ACCENT = "#FA6E1E";
const RED = "#E5484D";

const fmtDate = (key: string) => {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

export default function NextDayPlanTool() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const profile = useStore((s) => s.profile);
  const tomorrow = dayKey(addDays(new Date(), 1));
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  const tomorrowTasks = useMemo(() => tasks.filter((t) => t.due_date === tomorrow && t.status !== "done").sort((a, b) => (a.created_at > b.created_at ? 1 : -1)), [tasks, tomorrow]);

  const submit = () => {
    const title = input.trim();
    if (!title) return;
    addTask({ title, status: "inbox", quadrant: "not_urgent_important", energy: "medium", due_date: tomorrow });
    setInput("");
  };

  const aiSuggest = async () => {
    setWorking(true);
    setErr("");
    try {
      const open = tasks.filter((t) => t.status !== "done" && t.status !== "habit");
      const overdue = open.filter((t) => t.due_date && t.due_date < dayKey());
      const j = await aiJson(
        "You help plan tomorrow. Suggest 3-5 tasks for tomorrow, prioritizing overdue and important work, and tailored to the user's preferences.",
        `About the user: ${profile || "(none)"}\n\nOpen tasks:\n${open.slice(0, 20).map((t) => `- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`).join("\n")}\n\nOverdue:\n${overdue.slice(0, 10).map((t) => `- ${t.title}`).join("\n")}\n\nReturn JSON: {"tasks": string[]}`
      );
      const list = Array.isArray(j.tasks) ? j.tasks.filter((x): x is string => typeof x === "string") : [];
      if (!list.length) throw new Error("AI returned no suggestions");
      setSuggestions(list.slice(0, 5));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI suggestion failed. Configure AI in Agent settings.");
    } finally {
      setWorking(false);
    }
  };

  const addSuggestion = (title: string) => {
    addTask({ title, status: "inbox", quadrant: "not_urgent_important", energy: "medium", due_date: tomorrow });
    setSuggestions((s) => s?.filter((x) => x !== title) ?? null);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.date}>{fmtDate(tomorrow)}</Text>
      <Text style={styles.hint}>Plan tomorrow before tomorrow comes. Add what matters most.</Text>

      <Pressable style={styles.aiBtn} onPress={aiSuggest} disabled={working} accessibilityRole="button">
        <Ionicons name="sparkles" size={16} color={ACCENT} />
        <Text style={styles.aiBtnText}>{working ? "AI thinking…" : "Suggest with AI"}</Text>
      </Pressable>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {suggestions && suggestions.length > 0 && (
        <View style={styles.suggestBox}>
          <Text style={styles.suggestTitle}>AI suggests</Text>
          {suggestions.map((title) => (
            <Pressable key={title} style={styles.suggestRow} onPress={() => addSuggestion(title)} accessibilityRole="button">
              <Text style={styles.suggestText} numberOfLines={2}>{title}</Text>
              <View style={styles.suggestAdd}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </View>
            </Pressable>
          ))}
          <Pressable style={styles.suggestDismiss} onPress={() => setSuggestions(null)} accessibilityRole="button">
            <Text style={styles.suggestDismissText}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Add a task for tomorrow"
          placeholderTextColor={IDLE}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Pressable style={styles.addBtn} onPress={submit} accessibilityRole="button" accessibilityLabel="Add task">
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {tomorrowTasks.length === 0 ? (
        <Text style={styles.empty}>No tasks planned for tomorrow yet.</Text>
      ) : (
        tomorrowTasks.map((t) => (
          <View key={t.id} style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.check, pressed && { opacity: 0.5 }]}
              onPress={() => updateTask(t.id, { status: "done" })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
            />
            <Text style={styles.title} numberOfLines={2}>{t.title}</Text>
            {t.quadrant ? <Text style={styles.q}>{t.quadrant.replace(/_/g, " ")}</Text> : null}
          </View>
        ))
      )}

      <Text style={styles.section}>Also due tomorrow</Text>
      {tasks.filter((t) => t.due_date === tomorrow && t.status === "done").length === 0 ? (
        <Text style={styles.empty}>Nothing else.</Text>
      ) : (
        tasks.filter((t) => t.due_date === tomorrow && t.status === "done").map((t) => (
          <Text key={t.id} style={styles.doneTask}>✓ {t.title}</Text>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  date: { color: TEXT, fontSize: 22, fontWeight: "700" },
  hint: { color: SUB, fontSize: 13, marginTop: 2, marginBottom: 16 },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 14, minHeight: 48, marginBottom: 12 },
  aiBtnText: { color: ACCENT, fontSize: 15, fontWeight: "700" },
  err: { color: RED, fontSize: 13, marginBottom: 10 },
  suggestBox: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 14, marginBottom: 14 },
  suggestTitle: { color: TEXT, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  suggestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  suggestText: { flex: 1, color: TEXT, fontSize: 14 },
  suggestAdd: { width: 26, height: 26, borderRadius: 13, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
  suggestDismiss: { alignItems: "center", paddingTop: 10 },
  suggestDismissText: { color: SUB, fontSize: 13, fontWeight: "600" },
  addRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  input: { flex: 1, backgroundColor: "#1E1E1E", borderWidth: 1.5, borderColor: LINE, borderRadius: 12, color: TEXT, fontSize: 15, padding: 14 },
  addBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
  empty: { color: IDLE, fontSize: 14, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 14, marginBottom: 10 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#3A3A3A" },
  title: { flex: 1, color: TEXT, fontSize: 15 },
  q: { color: SUB, fontSize: 12, textTransform: "capitalize" },
  section: { fontSize: 13, fontWeight: "700", color: SUB, letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
  doneTask: { color: SUB, fontSize: 14, paddingVertical: 4 },
});
