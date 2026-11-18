import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BG = "#1E1E1E";
const LINE = "#2E2E2E";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";

type Props = {
  visible: boolean;
  initialTime?: string | null; // e.g. "09:30"
  onConfirm: (timeStr: string) => void;
  onClear?: () => void;
  onClose: () => void;
};

const parseTime = (timeStr?: string | null) => {
  if (!timeStr) return { hour: 9, min: 0 };
  const parts = timeStr.split(":");
  return {
    hour: Math.min(23, Math.max(0, parseInt(parts[0], 10) || 9)),
    min: Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0)),
  };
};

export default function CustomTimePicker({
  visible,
  initialTime,
  onConfirm,
  onClear,
  onClose,
}: Props) {
  const [prevTime, setPrevTime] = useState(initialTime);
  const [hour, setHour] = useState(() => parseTime(initialTime).hour);
  const [minute, setMinute] = useState(() => parseTime(initialTime).min);

  if (initialTime !== prevTime) {
    setPrevTime(initialTime);
    const p = parseTime(initialTime);
    setHour(p.hour);
    setMinute(p.min);
  }

  const handleHourChange = (delta: number) => {
    setHour((h) => (h + delta + 24) % 24);
  };

  const handleMinuteChange = (delta: number) => {
    setMinute((m) => (m + delta + 60) % 60);
  };

  const handleSave = () => {
    const hh = `${hour}`.padStart(2, "0");
    const mm = `${minute}`.padStart(2, "0");
    onConfirm(`${hh}:${mm}`);
  };

  const pad = (n: number) => `${n}`.padStart(2, "0");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.box}>
          <Text style={styles.title}>Select Time</Text>

          <View style={styles.pickerRow}>
            {/* Hours Column */}
            <View style={styles.column}>
              <Pressable style={styles.arrowBtn} onPress={() => handleHourChange(1)}>
                <Ionicons name="chevron-up" size={24} color={TEXT} />
              </Pressable>
              <Text style={styles.timeDigit}>{pad(hour)}</Text>
              <Pressable style={styles.arrowBtn} onPress={() => handleHourChange(-1)}>
                <Ionicons name="chevron-down" size={24} color={TEXT} />
              </Pressable>
              <Text style={styles.columnLabel}>Hours</Text>
            </View>

            <Text style={styles.colon}>:</Text>

            {/* Minutes Column */}
            <View style={styles.column}>
              <Pressable style={styles.arrowBtn} onPress={() => handleMinuteChange(5)}>
                <Ionicons name="chevron-up" size={24} color={TEXT} />
              </Pressable>
              <Text style={styles.timeDigit}>{pad(minute)}</Text>
              <Pressable style={styles.arrowBtn} onPress={() => handleMinuteChange(-5)}>
                <Ionicons name="chevron-down" size={24} color={TEXT} />
              </Pressable>
              <Text style={styles.columnLabel}>Minutes</Text>
            </View>
          </View>

          {/* Quick presets */}
          <View style={styles.presetsRow}>
            {["09:00", "12:00", "15:00", "18:00", "21:00"].map((t) => (
              <Pressable
                key={t}
                style={styles.presetChip}
                onPress={() => {
                  const [hh, mm] = t.split(":").map(Number);
                  setHour(hh);
                  setMinute(mm);
                }}
              >
                <Text style={styles.presetText}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {onClear && (
              <Pressable style={styles.clearBtn} onPress={onClear}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            )}
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={handleSave}>
              <Text style={styles.confirmText}>Set Time</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  box: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    padding: 20,
    alignItems: "center",
  },
  title: { color: TEXT, fontSize: 17, fontWeight: "700", marginBottom: 16 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  },
  column: {
    alignItems: "center",
  },
  arrowBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#292929",
  },
  timeDigit: {
    color: TEXT,
    fontSize: 34,
    fontWeight: "700",
    marginVertical: 6,
    fontVariant: ["tabular-nums"],
  },
  columnLabel: {
    color: SUB,
    fontSize: 11,
    marginTop: 4,
    textTransform: "uppercase",
  },
  colon: {
    color: ACCENT,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 20,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: 20,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#292929",
    borderWidth: 1,
    borderColor: LINE,
  },
  presetText: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  clearBtn: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444444",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { color: SUB, fontWeight: "600", fontSize: 13 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: SUB, fontWeight: "600", fontSize: 14 },
  confirmBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
