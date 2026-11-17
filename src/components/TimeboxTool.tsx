import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const DAY_START = 6 * 60; // 06:00
const DAY_END = 22 * 60; // 22:00
const HOUR_H = 56;
const GUTTER = 40; // width of the hour-label column

const TYPE_COLOR: Record<string, string> = {
  deep: "#FA6E1E",
  urgent: "#E5484D",
  batch: "#4CC3E8",
  maintenance: "#8B5CF6",
  buffer: "#12B76A",
};

const TYPE_ICON: Record<string, string> = {
  deep: "flame-outline",
  urgent: "alert-circle-outline",
  batch: "layers-outline",
  maintenance: "book-outline",
  buffer: "cafe-outline",
};

const TYPE_LABEL: Record<string, string> = {
  deep: "Deep",
  urgent: "Urgent",
  batch: "Batch",
  maintenance: "Maintain",
  buffer: "Rest",
};

const RED = "#E5484D";

const fmt24 = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${`${m}`.padStart(2, "0")}`;
};

const hours: number[] = [];
for (let h = DAY_START / 60; h < DAY_END / 60; h++) hours.push(h);

type LayoutSlot = { leftPct: number; widthPct: number };

// Greedy lane assignment (calendar/TickTick style): overlapping blocks in the
// same cluster are split into side-by-side lanes; non-overlapping clusters keep
// full width. Returns a per-id { leftPct, widthPct } layout.
const layoutBlocks = (items: { id: number; start_min: number; end_min: number }[]): Map<number, LayoutSlot> => {
  const result = new Map<number, LayoutSlot>();
  const sorted = [...items].sort((a, b) => a.start_min - b.start_min);

  const clusters: { id: number; start_min: number; end_min: number }[][] = [];
  let cur: { id: number; start_min: number; end_min: number }[] = [];
  let clusterEnd = -1;
  for (const b of sorted) {
    if (cur.length && b.start_min >= clusterEnd) {
      clusters.push(cur);
      cur = [];
      clusterEnd = -1;
    }
    cur.push(b);
    clusterEnd = Math.max(clusterEnd, b.end_min);
  }
  if (cur.length) clusters.push(cur);

  for (const cluster of clusters) {
    const lanes: number[] = [];
    const laneFor = new Map<number, number>();
    for (const b of [...cluster].sort((a, b) => a.start_min - b.start_min)) {
      let placed = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (b.start_min >= lanes[i]) { placed = i; break; }
      }
      if (placed === -1) {
        placed = lanes.length;
        lanes.push(b.end_min);
      } else {
        lanes[placed] = b.end_min;
      }
      laneFor.set(b.id, placed);
    }
    const n = lanes.length;
    const w = 100 / n;
    for (const b of cluster) {
      const lane = laneFor.get(b.id)!;
      result.set(b.id, { leftPct: lane * w + 0.5, widthPct: w - 1 });
    }
  }
  return result;
};

export default function TimeboxTool() {
  const insets = useSafeAreaInsets();
  const blocks = useStore((s) => s.blocks);
  const addBlock = useStore((s) => s.addBlock);
  const updateBlock = useStore((s) => s.updateBlock);
  const deleteBlock = useStore((s) => s.deleteBlock);

  const today = dayKey();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("deep");
  const [startTime, setStartTime] = useState(() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; });
  const [endTime, setEndTime] = useState(() => { const d = new Date(); d.setHours(10, 0, 0, 0); return d; });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // "Now" indicator: current time in minutes since midnight, refreshed each minute.
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const todays = useMemo(
    () => blocks.filter((b) => b.day === today && b.start_min >= DAY_START && b.end_min <= DAY_END).sort((a, b) => a.start_min - b.start_min),
    [blocks, today]
  );

  const totalMin = todays.reduce((s, b) => s + (b.end_min - b.start_min), 0);
  const timelineH = ((DAY_END - DAY_START) / 60) * HOUR_H;
  const selected = todays.find((b) => b.id === selectedId) ?? null;
  const layout = useMemo(() => layoutBlocks(todays), [todays]);

  const openAdd = () => {
    setEditId(null);
    setLabel("");
    setType("deep");
    const s = new Date(); s.setHours(9, 0, 0, 0);
    const e = new Date(); e.setHours(10, 0, 0, 0);
    setStartTime(s);
    setEndTime(e);
    setShowAdd(true);
  };

  const submit = () => {
    const name = label.trim();
    if (!name) return;
    const startMin = startTime.getHours() * 60 + startTime.getMinutes();
    const endMin = endTime.getHours() * 60 + endTime.getMinutes();
    if (endMin <= startMin) return;
    const next = { day: today, start_min: startMin, end_min: endMin, label: name, type, buffer: type === "buffer" ? 0.2 : 0 };
    if (editId !== null) {
      updateBlock(editId, next);
      setEditId(null);
    } else {
      addBlock(next);
    }
    setLabel("");
    setShowAdd(false);
    setSelectedId(null);
  };

  const openEdit = (b: (typeof todays)[number]) => {
    setEditId(b.id);
    setLabel(b.label);
    setType(b.type);
    const s = new Date(); s.setHours(Math.floor(b.start_min / 60), b.start_min % 60, 0, 0);
    const e = new Date(); e.setHours(Math.floor(b.end_min / 60), b.end_min % 60, 0, 0);
    setStartTime(s);
    setEndTime(e);
    setSelectedId(null);
    setShowAdd(true);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.sub}>
            {todays.length} blocks · {Math.round(totalMin / 60)}h planned
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openAdd} accessibilityRole="button">
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Block</Text>
        </Pressable>
      </View>

      {/* Timeline */}
      <ScrollView contentContainerStyle={{ height: timelineH }} style={{ flex: 1 }}>
        <View style={styles.timelineRow}>
          {/* Hour labels */}
          <View style={styles.labels}>
            {hours.map((h) => (
              <View key={h} style={{ height: HOUR_H, justifyContent: "flex-start" }}>
                <Text style={styles.hourLabel}>{h}:00</Text>
              </View>
            ))}
          </View>

          {/* Grid + blocks */}
          <View style={styles.gridArea}>
            {hours.map((h) => (
              <View key={h} style={[styles.gridlineRow, { height: HOUR_H }]} />
            ))}
            {nowMin >= DAY_START && nowMin <= DAY_END && (
              <View style={[styles.nowBar, { top: ((nowMin - DAY_START) / 60) * HOUR_H }]} pointerEvents="none" />
            )}
            {todays.map((b) => {
              const top = ((b.start_min - DAY_START) / 60) * HOUR_H;
              const height = ((b.end_min - b.start_min) / 60) * HOUR_H;
              const color = TYPE_COLOR[b.type] ?? ACCENT;
              const isSel = selectedId === b.id;
              const slot = layout.get(b.id) ?? { leftPct: 0.5, widthPct: 99 };
              return (
                <Pressable
                  key={b.id}
                  style={[styles.block, { top, height, left: `${slot.leftPct}%`, width: `${slot.widthPct}%`, backgroundColor: `${color}26`, borderLeftColor: color }, isSel && styles.blockSel]}
                  onPress={() => setSelectedId(isSel ? null : b.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select block ${b.label}`}
                >
                  <Ionicons name={TYPE_ICON[b.type] as never} size={14} color={color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.blockTitle, { color }]} numberOfLines={2}>{b.label}</Text>
                    <Text style={styles.blockTime}>{fmt24(b.start_min)} – {fmt24(b.end_min)}</Text>
                  </View>
                  {isSel && <Ionicons name="checkmark-circle" size={15} color={ACCENT} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Selection action bar */}
      {selected && (
        <View style={styles.selBar}>
          <Text style={styles.selTitle} numberOfLines={1}>{selected.label}</Text>
          <Text style={styles.selTime}>{fmt24(selected.start_min)} – {fmt24(selected.end_min)}</Text>
          <Pressable style={styles.selAction} onPress={() => openEdit(selected)} accessibilityRole="button">
            <Ionicons name="create-outline" size={16} color={ACCENT} />
            <Text style={styles.selEditText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.delBtn} onPress={() => { deleteBlock(selected.id); setSelectedId(null); }} accessibilityRole="button">
            <Ionicons name="trash-outline" size={16} color={RED} />
            <Text style={styles.delText}>Delete</Text>
          </Pressable>
        </View>
      )}

      {/* Add sheet */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.scrim}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowAdd(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetGrabber} />
            <Text style={styles.sheetTitle}>{editId !== null ? "Edit block" : "New block"}</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="What will you do?"
              placeholderTextColor={IDLE}
              style={styles.input}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.chipRow}>
              {Object.keys(TYPE_LABEL).map((t) => (
                <Pressable key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)} accessibilityRole="button">
                  <View style={[styles.typeDot, { backgroundColor: TYPE_COLOR[t] }]} />
                  <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{TYPE_LABEL[t]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Start</Text>
            <Pressable style={styles.timeRow} onPress={() => { setShowStartPicker(true); setShowEndPicker(false); }} accessibilityRole="button" accessibilityLabel="Pick start time">
              <Ionicons name="time-outline" size={18} color={ACCENT} />
              <Text style={styles.timeText}>{fmt24(startTime.getHours() * 60 + startTime.getMinutes())}</Text>
            </Pressable>
            {showStartPicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                is24Hour
                display="spinner"
                onChange={(_, d) => { if (d) setStartTime(d); setShowStartPicker(false); }}
              />
            )}
            <Text style={styles.fieldLabel}>End</Text>
            <Pressable style={styles.timeRow} onPress={() => { setShowEndPicker(true); setShowStartPicker(false); }} accessibilityRole="button" accessibilityLabel="Pick end time">
              <Ionicons name="time-outline" size={18} color={ACCENT} />
              <Text style={styles.timeText}>{fmt24(endTime.getHours() * 60 + endTime.getMinutes())}</Text>
            </Pressable>
            {showEndPicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                is24Hour
                display="spinner"
                onChange={(_, d) => { if (d) setEndTime(d); setShowEndPicker(false); }}
              />
            )}
            {endTime.getTime() <= startTime.getTime() && (
              <Text style={styles.timeWarn}>End must be after start</Text>
            )}
            <View style={styles.sheetActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAdd(false)} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submit} onPress={submit} accessibilityRole="button">
                <Text style={styles.submitText}>{editId !== null ? "Save changes" : "Add block"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  title: { color: TEXT, fontSize: 22, fontWeight: "700" },
  sub: { color: SUB, fontSize: 13, marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 },
  addBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  timelineRow: { flexDirection: "row", flex: 1 },
  labels: { width: GUTTER, paddingTop: 2 },
  hourLabel: { color: IDLE, fontSize: 11, paddingLeft: 4 },
  gridArea: { flex: 1, position: "relative" },
  gridlineRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  nowBar: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: RED,
  },
  block: {
    position: "absolute",
    borderLeftWidth: 3,
    justifyContent: "center",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
  },
  blockSel: { borderWidth: 1.5, borderColor: ACCENT },
  selBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    backgroundColor: CARD,
  },
  selTitle: { flex: 1, color: TEXT, fontSize: 14, fontWeight: "700" },
  selTime: { color: SUB, fontSize: 13 },
  selAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8 },
  selEditText: { color: ACCENT, fontSize: 14, fontWeight: "700" },
  delBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  delText: { color: RED, fontSize: 14, fontWeight: "700" },
  blockTitle: { fontSize: 13, fontWeight: "700" },
  blockTime: { color: SUB, fontSize: 11, marginTop: 1 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetGrabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: LINE, marginBottom: 12 },
  sheetTitle: { color: TEXT, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  input: { backgroundColor: FIELD, borderWidth: 1.5, borderColor: LINE, borderRadius: 12, color: TEXT, fontSize: 15, padding: 14 },
  fieldLabel: { color: SUB, fontSize: 13, fontWeight: "600", marginTop: 14, marginBottom: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: FIELD, borderWidth: 1.5, borderColor: LINE, borderRadius: 12, padding: 14 },
  timeText: { color: TEXT, fontSize: 18, fontWeight: "700" },
  timeWarn: { color: RED, fontSize: 12, marginTop: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: LINE, backgroundColor: FIELD, flexDirection: "row", alignItems: "center", gap: 6 },
  chipActive: { borderColor: ACCENT, backgroundColor: "rgba(250,110,30,0.12)" },
  chipText: { color: "#D6D6D6", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: ACCENT },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: LINE, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
  cancelText: { color: SUB, fontWeight: "700", fontSize: 15 },
  submit: { flex: 2, backgroundColor: ACCENT, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
  submitText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});
