import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useStore } from "../store/useStore";
import { fmtDue } from "../utils/taskFormat";
import { dayKey } from "../utils/time";
import type { Task } from "../db/database";
import TaskDetailSheet from "./TaskDetailSheet";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const IDLE = "#6F6F6F";

const RED = "#E5484D";
const AMBER = "#D8B62E";
const BLUE = "#4CC3E8";
const GRAY = "#8A8A8A";

const QUADRANTS = [
  { key: "urgent_important", label: "Do", hint: "Do it now", color: RED, icon: "flash" },
  { key: "not_urgent_important", label: "Schedule", hint: "Plan a time", color: AMBER, icon: "calendar" },
  { key: "urgent_not_important", label: "Delegate", hint: "Hand it off", color: BLUE, icon: "people" },
  { key: "neither", label: "Let go", hint: "Skip it", color: GRAY, icon: "trash" },
] as const;

export default function EisenhowerMatrixTool() {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const today = dayKey();
  const [editing, setEditing] = useState<Task | null>(null);

  const open = useMemo(() => tasks.filter((t) => t.status !== "done" && t.status !== "habit"), [tasks]);

  const markDone = (id: string) => {
    updateTask(id, { status: "done" });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>Tap a task to edit it or move it to another box. The check mark completes it.</Text>
      <View style={styles.grid}>
        {QUADRANTS.map((q) => {
          const items = open.filter((t) => t.quadrant === q.key);
          return (
            <View key={q.key} style={styles.cell}>
              <View style={[styles.cellHead, { borderLeftColor: q.color }]}>
                <Text style={[styles.cellLabel, { color: q.color }]}>{q.label}</Text>
                <Text style={styles.cellHint}>{q.hint}</Text>
                {items.length > 0 && <Text style={styles.count}>{items.length}</Text>}
              </View>
              {items.length === 0 ? (
                <Text style={styles.empty}>Nothing here</Text>
              ) : (
                items.map((t) => (
                  <Pressable
                    key={t.id}
                    style={({ pressed }) => [styles.taskRow, pressed && { backgroundColor: "#1E1E1E" }]}
                    onPress={() => setEditing(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${t.title}`}
                  >
                    <Pressable
                      style={({ pressed }) => [styles.check, { borderColor: q.color }, pressed && { opacity: 0.5 }]}
                      onPress={() => markDone(t.id)}
                      hitSlop={8}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: false }}
                      accessibilityLabel={`Complete ${t.title}`}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle} numberOfLines={2}>{t.title}</Text>
                      {t.due_date ? (
                        <Text style={[styles.due, t.due_date < today && { color: RED }]}>{fmtDue(t.due_date)}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          );
        })}
      </View>

      {editing && <TaskDetailSheet task={editing} onClose={() => setEditing(null)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  hint: { color: SUB, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  grid: { gap: 14 },
  cell: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    minHeight: 200,
  },
  cellHead: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 10,
    borderLeftWidth: 4,
    paddingLeft: 10,
    marginBottom: 12,
  },
  cellLabel: { fontSize: 20, fontWeight: "800" },
  cellHint: { fontSize: 13, color: SUB },
  count: { marginLeft: "auto", color: IDLE, fontSize: 16, fontWeight: "700" },
  empty: { color: IDLE, fontSize: 14, paddingVertical: 12 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  taskTitle: { color: TEXT, fontSize: 15, lineHeight: 20 },
  due: { color: IDLE, fontSize: 13, marginTop: 2 },
});
