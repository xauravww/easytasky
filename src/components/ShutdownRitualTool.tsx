import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import { aiJson } from "../lib/aiClient";
import { dayKey } from "../utils/time";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const RED = "#E5484D";

type Step = { id: string; label: string };

const STEPS: Step[] = [
  { id: "inbox", label: "Clear your inbox: file, do, or mark unwanted" },
  { id: "catch", label: "Capture any loose thoughts/tasks for tomorrow" },
  { id: "peak", label: "Note your most important task for tomorrow" },
  { id: "close", label: "Close your loops: reply, delegate, or defer" },
  { id: "stop", label: "Pick a hard stop time and stop" },
];

export default function ShutdownRitualTool() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [recap, setRecap] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const tasks = useStore((s) => s.tasks);
  const profile = useStore((s) => s.profile);
  const completed = STEPS.filter((s) => done[s.id]).length;

  const aiRecap = async () => {
    setWorking(true);
    setErr("");
    try {
      const todayKey = dayKey();
      const doneToday = tasks.filter((t) => t.status === "done" && t.created_at >= new Date(todayKey + "T00:00:00").getTime());
      const openNow = tasks.filter((t) => t.status !== "done" && t.status !== "habit");
      const j = await aiJson(
        "You are a gentle end-of-day coach. Write a 2-3 sentence recap of what got done, and name the single most important thing to do tomorrow.",
        `About the user: ${profile || "(none)"}\n\nCompleted today:\n${doneToday.slice(0, 15).map((t) => `- ${t.title}`).join("\n") || "(nothing recorded)"}\n\nStill open:\n${openNow.slice(0, 15).map((t) => `- ${t.title}`).join("\n") || "(none)"}\n\nReturn JSON: {"recap": string, "important_task": string}`
      );
      const recapText = typeof j.recap === "string" ? j.recap : "";
      const important = typeof j.important_task === "string" ? j.important_task : "";
      setRecap([recapText, important ? `Tomorrow's priority: ${important}` : ""].filter(Boolean).join("\n\n"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI recap failed. Configure AI in Agent settings.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        End-of-day ritual. Check each one off to close your day cleanly.
      </Text>

      <Pressable style={styles.aiBtn} onPress={aiRecap} disabled={working} accessibilityRole="button">
        <Ionicons name="sparkles" size={16} color={ACCENT} />
        <Text style={styles.aiBtnText}>{working ? "AI thinking…" : "Generate recap with AI"}</Text>
      </Pressable>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {recap ? (
        <View style={styles.recapBox}>
          <Text style={styles.recapText}>{recap}</Text>
        </View>
      ) : null}

      <View style={styles.progress}>
        <Text style={styles.progressText}>{completed}/{STEPS.length} done</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(completed / STEPS.length) * 100}%` }]} />
        </View>
      </View>

      {STEPS.map((step) => {
        const on = !!done[step.id];
        return (
          <Pressable
            key={step.id}
            style={({ pressed }) => [styles.step, on && styles.stepDone, pressed && { opacity: 0.7 }]}
            onPress={() => setDone((d) => ({ ...d, [step.id]: !d[step.id] }))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <View style={[styles.check, on && styles.checkOn]}>
              {on && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
            <Text style={[styles.stepLabel, on && styles.stepLabelDone]}>{step.label}</Text>
          </Pressable>
        );
      })}

      {completed === STEPS.length && (
        <View style={styles.done}>
          <Ionicons name="moon" size={20} color={ACCENT} />
          <Text style={styles.doneText}>Day closed. Nice work.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  hint: { color: SUB, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 14, minHeight: 48, marginBottom: 12 },
  aiBtnText: { color: ACCENT, fontSize: 15, fontWeight: "700" },
  err: { color: RED, fontSize: 13, marginBottom: 10 },
  recapBox: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 16, marginBottom: 16 },
  recapText: { color: TEXT, fontSize: 14, lineHeight: 21 },
  progress: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 16, marginBottom: 16 },
  progressText: { color: TEXT, fontSize: 14, fontWeight: "700", marginBottom: 10 },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: "#2A2A2A", overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: ACCENT, borderRadius: 4 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 16, marginBottom: 10 },
  stepDone: { borderColor: ACCENT },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "#3A3A3A", alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  stepLabel: { flex: 1, color: TEXT, fontSize: 15 },
  stepLabelDone: { color: SUB, textDecorationLine: "line-through" },
  done: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  doneText: { color: TEXT, fontSize: 14 },
});
