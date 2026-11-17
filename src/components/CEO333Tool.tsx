import React, { useMemo, useState } from "react";
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
const IDLE = "#6F6F6F";
const ACCENT = "#FA6E1E";
const RED = "#E5484D";

type PreviewBlock = { label: string; type: string; start: number; end: number };

const fmt24 = (min: number) => `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;

export default function CEO333Tool() {
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const addBlock = useStore((s) => s.addBlock);
  const profile = useStore((s) => s.profile);
  const today = dayKey();
  const [preview, setPreview] = useState<PreviewBlock[] | null>(null);
  const [added, setAdded] = useState(0);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  const open = useMemo(() => tasks.filter((t) => t.status !== "done" && t.status !== "habit"), [tasks]);
  const important = useMemo(() => open.filter((t) => t.quadrant === "urgent_important" || t.quadrant === "not_urgent_important"), [open]);
  const urgent = useMemo(() => open.filter((t) => t.quadrant === "urgent_not_important"), [open]);
  const maintenance = useMemo(() => open.filter((t) => t.quadrant === "neither"), [open]);

  // Shared scheduler: place a deep block then urgent/maintenance 30-min blocks.
  const schedule = (deepTitle: string | undefined, urgentTitles: string[], maintTitles: string[]): boolean => {
    const todayBlocks = blocks.filter((b) => b.day === today).sort((a, b) => a.start_min - b.start_min);
    const isFree = (s: number, e: number) => !todayBlocks.some((b) => s < b.end_min && e > b.start_min);
    const out: PreviewBlock[] = [];
    let start = 8 * 60;
    if (deepTitle) {
      while (start + 180 <= 22 * 60) {
        if (isFree(start, start + 180)) break;
        start += 30;
      }
      if (start + 180 <= 22 * 60) {
        out.push({ label: `Deep: ${deepTitle}`, type: "deep", start, end: start + 180 });
        start += 180;
      }
    }
    for (const title of urgentTitles.slice(0, 3)) {
      while (start + 30 <= 22 * 60 && !isFree(start, start + 30)) start += 30;
      if (start + 30 <= 22 * 60) {
        out.push({ label: title, type: "urgent", start, end: start + 30 });
        start += 30;
      }
    }
    for (const title of maintTitles.slice(0, 3)) {
      while (start + 30 <= 22 * 60 && !isFree(start, start + 30)) start += 30;
      if (start + 30 <= 22 * 60) {
        out.push({ label: title, type: "maintenance", start, end: start + 30 });
        start += 30;
      }
    }
    if (out.length === 0) {
      setPreview(null);
      setErr("Couldn't find a free slot today. Clear some blocks in Timeblocking and try again.");
      return false;
    }
    setPreview(out);
    setErr("");
    return true;
  };

  const buildPlan = () =>
    schedule(
      important[0]?.title,
      urgent.map((u) => u.title),
      maintenance.map((m) => m.title)
    );

  const aiPlan = async () => {
    setWorking(true);
    setErr("");
    try {
      const list = (titles: string[]) => (titles.length ? titles.join(", ") : "(none)");
      const j = await aiJson(
        "You plan a person's day using the 3-3-3 method: 3 hours on their single most important task, " +
          "then 3 urgent/important tasks, then 3 maintenance tasks. ONLY pick titles that appear verbatim in the tasks list provided.",
        `About the user: ${profile || "(none)"}\n\nTasks:\nImportant: ${list(important.map((t) => t.title))}\nUrgent: ${list(urgent.map((t) => t.title))}\nMaintenance: ${list(maintenance.map((t) => t.title))}\n\nReturn JSON: {"deep": string, "urgent": string[], "maintenance": string[]}`
      );
      const deep = typeof j.deep === "string" ? j.deep : undefined;
      const urgentTitles = Array.isArray(j.urgent) ? j.urgent.filter((x): x is string => typeof x === "string") : [];
      const maintTitles = Array.isArray(j.maintenance) ? j.maintenance.filter((x): x is string => typeof x === "string") : [];
      if (!deep && !urgentTitles.length && !maintTitles.length) throw new Error("AI didn't pick any tasks. Try again or use Build manually.");
      schedule(deep, urgentTitles, maintTitles);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI planning failed. Configure AI or use Build manually.");
    } finally {
      setWorking(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    for (const p of preview) {
      await addBlock({ day: today, start_min: p.start, end_min: p.end, label: p.label, type: p.type, buffer: p.type === "buffer" ? 0.2 : 0 });
    }
    setAdded(preview.length);
    setPreview(null);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        The 3-3-3 shake: 3 hours on your most important task, then 3 urgent/important tasks, then 3 maintenance tasks.
      </Text>

      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{important.length}</Text><Text style={styles.statLabel}>Important</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{urgent.length}</Text><Text style={styles.statLabel}>Urgent</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{maintenance.length}</Text><Text style={styles.statLabel}>Maintenance</Text></View>
      </View>

      {!preview && !added && (
        <>
          <Pressable style={styles.aiBtn} onPress={aiPlan} disabled={working} accessibilityRole="button">
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.aiBtnText}>{working ? "AI thinking…" : "Plan with AI"}</Text>
          </Pressable>
          <Pressable style={styles.generate} onPress={buildPlan} accessibilityRole="button">
            <Ionicons name="flash" size={18} color="#FFFFFF" />
            <Text style={styles.generateText}>Build manually</Text>
          </Pressable>
          {err ? <Text style={styles.err}>{err}</Text> : null}
        </>
      )}

      {preview && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Proposed blocks</Text>
          {preview.map((p, i) => (
            <View key={i} style={styles.previewRow}>
              <Text style={styles.previewTime}>{fmt24(p.start)}-{fmt24(p.end)}</Text>
              <Text style={styles.previewLabel} numberOfLines={1}>{p.label}</Text>
              <Text style={styles.previewType}>{p.type}</Text>
            </View>
          ))}
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={() => setPreview(null)} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.apply} onPress={apply} accessibilityRole="button">
              <Text style={styles.applyText}>Add blocks</Text>
            </Pressable>
          </View>
        </View>
      )}

      {added > 0 && (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
          <Text style={styles.doneText}>Added {added} blocks for today. See Timeblocking.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  hint: { color: SUB, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  statRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  stat: { flex: 1, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 14, alignItems: "center" },
  statNum: { color: TEXT, fontSize: 24, fontWeight: "800" },
  statLabel: { color: SUB, fontSize: 12, marginTop: 2 },
  generate: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: ACCENT, borderRadius: 14, minHeight: 52 },
  generateText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 14, minHeight: 52, marginBottom: 10 },
  aiBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  err: { color: RED, fontSize: 13, marginTop: 10 },
  preview: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 16 },
  previewTitle: { color: TEXT, fontSize: 16, fontWeight: "700", marginBottom: 12 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  previewTime: { color: SUB, fontSize: 13, fontVariant: ["tabular-nums"] },
  previewLabel: { flex: 1, color: TEXT, fontSize: 14 },
  previewType: { color: IDLE, fontSize: 12, textTransform: "capitalize" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancel: { flex: 1, borderWidth: 1.5, borderColor: LINE, borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  cancelText: { color: SUB, fontWeight: "700" },
  apply: { flex: 2, backgroundColor: ACCENT, borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  applyText: { color: "#FFFFFF", fontWeight: "700" },
  done: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  doneText: { color: TEXT, fontSize: 14 },
});
