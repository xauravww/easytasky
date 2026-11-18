import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import FocusPicker from "./FocusPicker";

const BG = "#161616";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const CHIP_BG = "#1E1E1E";

const FOCUS_OPTIONS = [15, 25, 45, 60];
const BREAK_OPTIONS = [5, 10, 15];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function TimerSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const pomo = useStore((s) => s.pomo);
  const tasks = useStore((s) => s.tasks);
  const setFocusMin = useStore((s) => s.setFocusMin);
  const setBreakMin = useStore((s) => s.setBreakMin);
  const setTaskId = useStore((s) => s.setTaskId);

  const [picker, setPicker] = useState(false);

  const selectedTask = tasks.find((t) => t.id === pomo.taskId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Focus settings</Text>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}>
            {pomo.mode === "pomodoro" && (
              <>
                <Text style={styles.sectionLabel}>Focus length</Text>
                <View style={styles.chipRow}>
                  {FOCUS_OPTIONS.map((f) => (
                    <Pressable
                      key={f}
                      style={[styles.chip, pomo.focusMin === f && styles.chipActive]}
                      onPress={() => setFocusMin(f)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, pomo.focusMin === f && styles.chipTextActive]}>{f}m</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Break length</Text>
                <View style={styles.chipRow}>
                  {BREAK_OPTIONS.map((b) => (
                    <Pressable
                      key={b}
                      style={[styles.chip, pomo.breakMin === b && styles.chipActive]}
                      onPress={() => setBreakMin(b)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, pomo.breakMin === b && styles.chipTextActive]}>{b}m</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionLabel}>Attach a task</Text>
            <Pressable style={styles.taskRow} onPress={() => setPicker(true)} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {selectedTask ? selectedTask.title : "No task"}
                </Text>
                <Text style={styles.taskSub}>Track focus against a task</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={SUB} />
            </Pressable>
          </ScrollView>
        </View>
      </View>

      <FocusPicker
        visible={picker}
        onClose={() => setPicker(false)}
        tasks={tasks.filter((t) => t.status !== "done")}
        selectedId={pomo.taskId}
        onSelect={setTaskId}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 8 },
  title: { color: TEXT, fontSize: 18, fontWeight: "700" },
  done: { color: ACCENT, fontSize: 16, fontWeight: "600" },
  content: { paddingHorizontal: 20, paddingBottom: 36 },
  sectionLabel: { color: SUB, fontSize: 13, fontWeight: "600", marginTop: 16, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    minHeight: 42,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: LINE,
    backgroundColor: CHIP_BG,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { borderColor: ACCENT, backgroundColor: "rgba(250,110,30,0.12)" },
  chipText: { color: "#D6D6D6", fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: ACCENT },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
  },
  taskTitle: { color: TEXT, fontSize: 15, fontWeight: "600" },
  taskSub: { color: SUB, fontSize: 13, marginTop: 3 },
});
