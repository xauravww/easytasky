import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

const DEFAULT_RITUALS = [
  "Clear your inbox: file, do, or archive tasks",
  "Review & jot down notes in Next-Day Planner",
  "Close lingering browser tabs & save work",
  "Pick a hard stop time and log off completely",
];

export default function ShutdownRitualTool() {
  const rituals = useStore((s) => s.shutdownRituals);
  const shutdownChecks = useStore((s) => s.shutdownChecks);
  const addShutdownRitual = useStore((s) => s.addShutdownRitual);
  const deleteShutdownRitual = useStore((s) => s.deleteShutdownRitual);
  const toggleShutdownCheck = useStore((s) => s.toggleShutdownCheck);
  const tasks = useStore((s) => s.tasks);
  const profile = useStore((s) => s.profile);
  const refreshAll = useStore((s) => s.refreshAll);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  const today = dayKey();

  // If DB has no rituals, seed default rituals
  React.useEffect(() => {
    if (rituals.length === 0) {
      DEFAULT_RITUALS.forEach((title) => addShutdownRitual(title));
    }
  }, [rituals.length, addShutdownRitual]);

  const [inputTitle, setInputTitle] = useState("");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [recap, setRecap] = useState<string | null>(null);

  const checkedRitualIds = useMemo(() => {
    return new Set(shutdownChecks.filter((c) => c.day === today).map((c) => c.ritual_id));
  }, [shutdownChecks, today]);

  const completedCount = rituals.filter((r) => checkedRitualIds.has(r.id)).length;

  const handleAdd = async () => {
    const clean = inputTitle.trim();
    if (!clean) return;
    await addShutdownRitual(clean);
    setInputTitle("");
  };

  const aiSuggestRituals = async () => {
    setWorking(true);
    setErr("");
    try {
      const doneToday = tasks.filter((t) => t.status === "done" && t.created_at >= new Date(today + "T00:00:00").getTime());
      const j = await aiJson(
        "You analyze the user's workflow and recommend 2-3 personalized end-of-day shutdown habits.",
        `User profile: ${profile || "(none)"}\nTasks completed today: ${doneToday.length}\n\nReturn JSON: {"recommendations": string[], "summary": string}`
      );
      const recs = Array.isArray(j.recommendations) ? j.recommendations.filter((x): x is string => typeof x === "string") : [];
      for (const r of recs) {
        if (!rituals.some((x) => x.title.toLowerCase() === r.toLowerCase())) {
          await addShutdownRitual(r);
        }
      }
      if (typeof j.summary === "string" && j.summary) {
        setRecap(j.summary);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI suggestions failed.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={rituals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>Shutdown Ritual</Text>
            <Text style={styles.hint}>
              Daily end-of-work ritual. You can manually configure or customize your rituals anytime. Checkmarks reset every day.
            </Text>

            {/* AI Suggest / Recap */}
            <Pressable style={styles.aiBtn} onPress={aiSuggestRituals} disabled={working}>
              <Ionicons name="sparkles" size={16} color={ACCENT} />
              <Text style={styles.aiBtnText}>{working ? "AI analyzing behavior…" : "AI Suggest Rituals & Recap"}</Text>
            </Pressable>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            {recap ? (
              <View style={styles.recapBox}>
                <Text style={styles.recapText}>{recap}</Text>
              </View>
            ) : null}

            {/* Progress Bar */}
            <View style={styles.progress}>
              <Text style={styles.progressText}>
                {completedCount}/{rituals.length} completed today
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${rituals.length ? (completedCount / rituals.length) * 100 : 0}%` },
                  ]}
                />
              </View>
            </View>

            {/* Add ritual row */}
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                value={inputTitle}
                onChangeText={setInputTitle}
                placeholder="Add custom shutdown ritual..."
                placeholderTextColor="#666666"
                onSubmitEditing={handleAdd}
                returnKeyType="done"
              />
              <Pressable style={styles.addBtn} onPress={handleAdd}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item: ritual }) => {
          const isDone = checkedRitualIds.has(ritual.id);
          return (
            <View style={[styles.step, isDone && styles.stepDone]}>
              <Pressable
                style={styles.checkWrapper}
                onPress={() => toggleShutdownCheck(ritual.id, today)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
              >
                <View style={[styles.check, isDone && styles.checkOn]}>
                  {isDone && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
                <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>
                  {ritual.title}
                </Text>
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => deleteShutdownRitual(ritual.id)}
                accessibilityRole="button"
                accessibilityLabel="Delete ritual"
              >
                <Ionicons name="trash-outline" size={16} color={RED} />
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          completedCount === rituals.length && rituals.length > 0 ? (
            <View style={styles.doneBanner}>
              <Ionicons name="moon" size={22} color={ACCENT} />
              <Text style={styles.doneBannerText}>All shutdown rituals complete. Have a peaceful evening!</Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 50 },
  heading: { color: TEXT, fontSize: 22, fontWeight: "700", marginBottom: 6 },
  hint: { color: SUB, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 14,
    minHeight: 46,
    marginBottom: 12,
  },
  aiBtnText: { color: ACCENT, fontSize: 14, fontWeight: "700" },
  err: { color: RED, fontSize: 13, marginBottom: 10 },
  recapBox: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    padding: 12,
    marginBottom: 14,
  },
  recapText: { color: TEXT, fontSize: 13, lineHeight: 19 },
  progress: { marginBottom: 16 },
  progressText: { color: SUB, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  progressBar: { height: 6, backgroundColor: CARD, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: ACCENT },
  addRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 12,
    color: TEXT,
    fontSize: 14,
    paddingHorizontal: 14,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    marginBottom: 10,
  },
  stepDone: { backgroundColor: "#171717", borderColor: "#202020" },
  checkWrapper: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  stepLabel: { flex: 1, color: TEXT, fontSize: 14, lineHeight: 20 },
  stepLabelDone: { color: "#666666", textDecorationLine: "line-through" },
  deleteBtn: { padding: 6 },
  doneBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(250,110,30,0.12)",
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  doneBannerText: { flex: 1, color: TEXT, fontSize: 13, fontWeight: "600" },
});
