import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Task } from "../db/database";

const CARD = "#1E1E1E";
const LINE = "#2A2A2A";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";

type Props = {
  habit: Task;
  currentValue: number;
  onSave: (val: number) => Promise<void>;
  onClose: () => void;
};

export default function HabitQuantityModal({ habit, currentValue, onSave, onClose }: Props) {
  const [val, setVal] = useState(String(currentValue > 0 ? currentValue : (habit.habit_target_value || 1)));
  const habitColor = habit.habit_color || ACCENT;
  const target = habit.habit_target_value || 1;
  const unit = habit.habit_unit || "times";

  const handleSave = async (amount?: number) => {
    const toSave = amount !== undefined ? amount : parseFloat(val);
    await onSave(isNaN(toSave) || toSave < 0 ? 0 : toSave);
    onClose();
  };

  const handleAdjust = (delta: number) => {
    const curr = parseFloat(val) || 0;
    const next = Math.max(0, curr + delta);
    setVal(String(next));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{habit.title}</Text>
              <Text style={styles.subtitle}>
                Target: {target} {unit}/day · Currently: {currentValue} {unit}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={20} color={SUB} />
            </Pressable>
          </View>

          <View style={styles.inputContainer}>
            <Pressable style={styles.adjustBtn} onPress={() => handleAdjust(-1)}>
              <Ionicons name="remove" size={20} color={TEXT} />
            </Pressable>
            <TextInput
              style={styles.input}
              value={val}
              onChangeText={setVal}
              keyboardType="numeric"
              selectTextOnFocus
              autoFocus
            />
            <Pressable style={styles.adjustBtn} onPress={() => handleAdjust(1)}>
              <Ionicons name="add" size={20} color={TEXT} />
            </Pressable>
          </View>
          <Text style={styles.unitHint}>{unit}</Text>

          <View style={styles.quickRow}>
            {[1, Math.max(1, target), Math.max(1, target * 2)].map((q, idx) => (
              <Pressable
                key={idx}
                style={[styles.quickChip, parseFloat(val) === q && { borderColor: habitColor }]}
                onPress={() => setVal(String(q))}
              >
                <Text style={styles.quickChipText}>{q} {unit}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            {currentValue > 0 && (
              <Pressable
                style={styles.clearBtn}
                onPress={() => handleSave(0)}
                accessibilityRole="button"
              >
                <Text style={styles.clearBtnText}>Reset to 0</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.saveBtn, { backgroundColor: habitColor }]}
              onPress={() => handleSave()}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: SUB,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginVertical: 12,
  },
  adjustBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    width: 100,
    height: 52,
    backgroundColor: "#141414",
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 14,
    color: TEXT,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  unitHint: {
    color: SUB,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#262626",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  quickChipText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  clearBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    color: SUB,
    fontSize: 14,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 2,
    height: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
