import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import { dayKey } from "../utils/time";

const BG = "#141414";
const CARD = "#1A1A1A";
const FIELD = "#1E1E1E";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const IDLE = "#6F6F6F";
const ACCENT = "#FA6E1E";

const TYPE_COLOR: Record<string, string> = {
  deep: "#FA6E1E",
  urgent: "#E5484D",
  batch: "#4CC3E8",
  maintenance: "#8B5CF6",
  buffer: "#12B76A",
};

const TYPE_LABEL: Record<string, string> = {
  deep: "Deep work",
  urgent: "Urgent",
  batch: "Batch",
  maintenance: "Maintenance",
  buffer: "Buffer",
};

const MINUTES = [60, 90, 120, 180];
const START_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const fmt24 = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${`${m}`.padStart(2, "0")}`;
};

export default function TimeboxTool() {
  const blocks = useStore((s) => s.blocks);
  const addBlock = useStore((s) => s.addBlock);
  const deleteBlock = useStore((s) => s.deleteBlock);

  const today = dayKey();
  const [label, setLabel] = useState("");
  const [type, setType] = useState("deep");
  const [startH, setStartH] = useState(9);
  const [minutes, setMinutes] = useState(60);

  const todays = useMemo(() => blocks.filter((b) => b.day === today).sort((a, b) => a.start_min - b.start_min), [blocks, today]);

  const submit = () => {
    const name = label.trim();
    if (!name) return;
    addBlock({ day: today, start_min: startH * 60, end_min: startH * 60 + minutes, label: name, type, buffer: type === "buffer" ? 0.2 : 0 });
    setLabel("");
  };

  const totalMin = todays.reduce((s, b) => s + (b.end_min - b.start_min), 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>{todays.length} blocks · {Math.round(totalMin / 60)}h planned</Text>
      </View>

      {/* Add form */}
      <View style={styles.panel}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="What will you do?"
          placeholderTextColor={IDLE}
          style={styles.input}
          returnKeyType="done"
        />
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.chipRow}>
          {Object.keys(TYPE_LABEL).map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, type === t && styles.chipActive]}
              onPress={() => setType(t)}
              accessibilityRole="button"
            >
              <View style={[styles.typeDot, { backgroundColor: TYPE_COLOR[t] }]} />
              <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{TYPE_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>Start</Text>
        <View style={styles.chipRow}>
          {START_HOURS.map((h) => (
            <Pressable
              key={h}
              style={[styles.chip, startH === h && styles.chipActive]}
              onPress={() => setStartH(h)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, startH === h && styles.chipTextActive]}>{h}:00</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>Length</Text>
        <View style={styles.chipRow}>
          {MINUTES.map((m) => (
            <Pressable
              key={m}
              style={[styles.chip, minutes === m && styles.chipActive]}
              onPress={() => setMinutes(m)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, minutes === m && styles.chipTextActive]}>{m}m</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={({ pressed }) => [styles.submit, pressed && { opacity: 0.85 }]} onPress={submit} accessibilityRole="button">
          <Text style={styles.submitText}>Add block</Text>
        </Pressable>
      </View>

      {/* Blocks timeline */}
      {todays.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No blocks today</Text>
          <Text style={styles.emptyHint}>Plan a time block above.</Text>
        </View>
      ) : (
        todays.map((b) => (
          <View key={b.id} style={[styles.block, { borderLeftColor: TYPE_COLOR[b.type] ?? ACCENT }]}>
            <View style={styles.blockTime}>
              <Text style={styles.blockTimeText}>{fmt24(b.start_min)}</Text>
              <Text style={styles.blockTimeEnd}>→ {fmt24(b.end_min)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockTitle} numberOfLines={2}>{b.label}</Text>
              <Text style={styles.blockType}>{TYPE_LABEL[b.type] ?? b.type}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.5 }]}
              onPress={() => deleteBlock(b.id)}
              accessibilityRole="button"
              accessibilityLabel="Delete block"
            >
              <Ionicons name="trash-outline" size={17} color={SUB} />
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  summaryRow: { marginBottom: 12 },
  summaryText: { color: SUB, fontSize: 14, fontWeight: "600" },
  panel: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 16, marginBottom: 16 },
  fieldLabel: { color: SUB, fontSize: 13, fontWeight: "600", marginTop: 10, marginBottom: 8 },
  input: { backgroundColor: FIELD, borderWidth: 1.5, borderColor: LINE, borderRadius: 12, color: TEXT, fontSize: 15, padding: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: LINE, backgroundColor: FIELD, flexDirection: "row", alignItems: "center", gap: 6 },
  chipActive: { borderColor: ACCENT, backgroundColor: "rgba(250,110,30,0.12)" },
  chipText: { color: "#D6D6D6", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: ACCENT },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  submit: { backgroundColor: ACCENT, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 16 },
  submitText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  block: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, borderLeftWidth: 4, padding: 14, marginBottom: 10 },
  blockTime: { minWidth: 64 },
  blockTimeText: { color: TEXT, fontSize: 15, fontWeight: "700" },
  blockTimeEnd: { color: IDLE, fontSize: 12, marginTop: 2 },
  blockTitle: { color: TEXT, fontSize: 15, fontWeight: "600" },
  blockType: { color: SUB, fontSize: 12, marginTop: 2 },
  ghost: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },
  emptyHint: { color: SUB, fontSize: 13, marginTop: 4 },
});
