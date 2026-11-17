import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import { aiJson } from "../lib/aiClient";
import { fmtDue } from "../utils/taskFormat";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const IDLE = "#6F6F6F";
const ACCENT = "#FA6E1E";
const RED = "#E5484D";

export default function UnwantedInboxTool() {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const unwanted = useMemo(() => tasks.filter((t) => t.status === "unwanted"), [tasks]);
  const inbox = useMemo(() => tasks.filter((t) => t.status === "inbox"), [tasks]);
  const [restoreIds, setRestoreIds] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  const aiReview = async () => {
    setWorking(true);
    setErr("");
    try {
      const j = await aiJson(
        "You review tasks a user marked as unwanted. Recommend which (if any) are actually worth restoring by matching their title.",
        `Unwanted tasks:\n${unwanted.map((t) => `- ${t.title}`).join("\n") || "(none)"}\n\nReturn JSON: {"restore": string[]} (titles to restore)`
      );
      const list = Array.isArray(j.restore) ? j.restore.filter((x): x is string => typeof x === "string") : [];
      const matched = new Set(unwanted.filter((t) => list.some((title) => t.title.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(t.title.toLowerCase()))).map((t) => t.id));
      setRestoreIds(matched);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI review failed. Configure AI in Agent settings.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Tasks you marked as unwanted land here. You can restore one to your inbox or delete it for good.
      </Text>

      {unwanted.length > 0 && (
        <>
          <Pressable style={styles.aiBtn} onPress={aiReview} disabled={working} accessibilityRole="button">
            <Ionicons name="sparkles" size={16} color={ACCENT} />
            <Text style={styles.aiBtnText}>{working ? "AI thinking…" : "AI review"}</Text>
          </Pressable>
          {err ? <Text style={styles.err}>{err}</Text> : null}
          {restoreIds.size > 0 ? <Text style={styles.aiHint}>AI suggests restoring the highlighted tasks.</Text> : null}
        </>
      )}

      <Text style={styles.section}>Unwanted ({unwanted.length})</Text>
      {unwanted.length === 0 ? (
        <Text style={styles.empty}>Nothing here. Mark a task unwanted from its editor menu.</Text>
      ) : (
        unwanted.map((t) => (
          <View key={t.id} style={[styles.row, restoreIds.has(t.id) && styles.rowSuggested]}>
            {restoreIds.has(t.id) && <View style={styles.suggestBadge}><Text style={styles.suggestBadgeText}>restore</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{t.title}</Text>
              {t.due_date ? <Text style={styles.due}>Due {fmtDue(t.due_date)}</Text> : null}
            </View>
            <Pressable style={styles.iconBtn} onPress={() => updateTask(t.id, { status: "inbox" })} accessibilityRole="button" accessibilityLabel="Restore to inbox">
              <Ionicons name="refresh" size={18} color={ACCENT} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => deleteTask(t.id)} accessibilityRole="button" accessibilityLabel="Delete forever">
              <Ionicons name="trash-outline" size={18} color={RED} />
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.section}>Inbox ({inbox.length})</Text>
      {inbox.length === 0 ? (
        <Text style={styles.empty}>Your inbox is empty.</Text>
      ) : (
        inbox.map((t) => (
          <Pressable key={t.id} style={styles.inboxRow} onPress={() => updateTask(t.id, { status: "unwanted" })} accessibilityRole="button" accessibilityLabel={`Mark unwanted ${t.title}`}>
            <Text style={styles.inboxTitle} numberOfLines={1}>{t.title}</Text>
            <Text style={styles.mark}>Mark unwanted</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  hint: { color: SUB, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 14, minHeight: 48, marginBottom: 10 },
  aiBtnText: { color: ACCENT, fontSize: 15, fontWeight: "700" },
  err: { color: RED, fontSize: 13, marginBottom: 10 },
  aiHint: { color: SUB, fontSize: 13, marginBottom: 12 },
  rowSuggested: { borderColor: ACCENT },
  suggestBadge: { alignSelf: "flex-start", backgroundColor: "rgba(250,110,30,0.15)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  suggestBadgeText: { color: ACCENT, fontSize: 11, fontWeight: "700" },
  section: { fontSize: 13, fontWeight: "700", color: SUB, letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  empty: { color: IDLE, fontSize: 14, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 14, marginBottom: 10 },
  title: { color: TEXT, fontSize: 15, fontWeight: "600" },
  due: { color: SUB, fontSize: 12, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  inboxRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  inboxTitle: { flex: 1, color: TEXT, fontSize: 15 },
  mark: { color: SUB, fontSize: 13, fontWeight: "600" },
});
