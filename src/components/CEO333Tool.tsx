import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
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

type PlanItem = {
  id: string;
  category: "project" | "urgent" | "maintenance";
  label: string;
  minutes: number;
};

export default function CEO333Tool() {
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const addBlock = useStore((s) => s.addBlock);
  const profile = useStore((s) => s.profile);
  const today = dayKey();

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "habit" && t.status !== "unwanted"),
    [tasks]
  );
  const importantTasks = useMemo(
    () => openTasks.filter((t) => t.quadrant === "urgent_important" || t.quadrant === "not_urgent_important"),
    [openTasks]
  );
  const urgentTasks = useMemo(
    () => openTasks.filter((t) => t.quadrant === "urgent_not_important"),
    [openTasks]
  );
  const maintenanceTasks = useMemo(
    () => openTasks.filter((t) => t.quadrant === "neither"),
    [openTasks]
  );

  const [items, setItems] = useState<PlanItem[]>([
    {
      id: "p1",
      category: "project",
      label: importantTasks[0]?.title ?? "Primary Project / Deep Work",
      minutes: 180,
    },
    {
      id: "u1",
      category: "urgent",
      label: urgentTasks[0]?.title ?? "Urgent task 1",
      minutes: 30,
    },
    {
      id: "u2",
      category: "urgent",
      label: urgentTasks[1]?.title ?? "Urgent task 2",
      minutes: 30,
    },
    {
      id: "u3",
      category: "urgent",
      label: urgentTasks[2]?.title ?? "Urgent task 3",
      minutes: 30,
    },
    {
      id: "m1",
      category: "maintenance",
      label: maintenanceTasks[0]?.title ?? "Maintenance task 1",
      minutes: 30,
    },
    {
      id: "m2",
      category: "maintenance",
      label: maintenanceTasks[1]?.title ?? "Maintenance task 2",
      minutes: 30,
    },
    {
      id: "m3",
      category: "maintenance",
      label: maintenanceTasks[2]?.title ?? "Maintenance task 3",
      minutes: 30,
    },
  ]);

  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [added, setAdded] = useState(0);

  // Edit / Add modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [modalCategory, setModalCategory] = useState<"project" | "urgent" | "maintenance">("urgent");
  const [modalLabel, setModalLabel] = useState("");
  const [modalMinutes, setModalMinutes] = useState("30");

  const openEditModal = (item: PlanItem) => {
    setEditingItem(item);
    setModalCategory(item.category);
    setModalLabel(item.label);
    setModalMinutes(String(item.minutes));
    setModalVisible(true);
  };

  const openAddModal = (cat: "project" | "urgent" | "maintenance") => {
    setEditingItem(null);
    setModalCategory(cat);
    setModalLabel("");
    setModalMinutes(cat === "project" ? "180" : "30");
    setModalVisible(true);
  };

  const saveModal = () => {
    const cleanLabel = modalLabel.trim();
    if (!cleanLabel) return;
    const mins = Math.max(5, parseInt(modalMinutes, 10) || 30);
    if (editingItem) {
      setItems((prev) =>
        prev.map((it) => (it.id === editingItem.id ? { ...it, label: cleanLabel, minutes: mins, category: modalCategory } : it))
      );
    } else {
      const newItem: PlanItem = {
        id: "item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        category: modalCategory,
        label: cleanLabel,
        minutes: mins,
      };
      setItems((prev) => [...prev, newItem]);
    }
    setModalVisible(false);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const aiAutoFill = async () => {
    setWorking(true);
    setErr("");
    try {
      const list = (titles: string[]) => (titles.length ? titles.join(", ") : "(none)");
      const j = await aiJson(
        "You plan a day using the 3-3-3 method: 3 hours on one core project, 3 urgent tasks, and 3 maintenance tasks.",
        `User profile: ${profile || "(none)"}\n\nTasks:\nImportant: ${list(importantTasks.map((t) => t.title))}\nUrgent: ${list(urgentTasks.map((t) => t.title))}\nMaintenance: ${list(maintenanceTasks.map((t) => t.title))}\n\nReturn JSON: {"deep": string, "urgent": string[], "maintenance": string[]}`
      );
      const deep = typeof j.deep === "string" ? j.deep : importantTasks[0]?.title ?? "Major Project";
      const urgentTitles = Array.isArray(j.urgent) ? j.urgent.filter((x): x is string => typeof x === "string") : [];
      const maintTitles = Array.isArray(j.maintenance) ? j.maintenance.filter((x): x is string => typeof x === "string") : [];

      const newItems: PlanItem[] = [
        { id: "p1", category: "project", label: deep, minutes: 180 },
        ...urgentTitles.slice(0, 3).map((t, idx) => ({ id: `u${idx + 1}`, category: "urgent" as const, label: t, minutes: 30 })),
        ...maintTitles.slice(0, 3).map((t, idx) => ({ id: `m${idx + 1}`, category: "maintenance" as const, label: t, minutes: 30 })),
      ];
      setItems(newItems);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI suggestion failed. You can manually edit the items.");
    } finally {
      setWorking(false);
    }
  };

  const applyToTimeblocks = async () => {
    const todayBlocks = blocks.filter((b) => b.day === today).sort((a, b) => a.start_min - b.start_min);
    const isFree = (s: number, e: number) => !todayBlocks.some((b) => s < b.end_min && e > b.start_min);

    let start = 8 * 60; // 08:00
    let count = 0;

    for (const it of items) {
      while (start + it.minutes <= 24 * 60 && !isFree(start, start + it.minutes)) {
        start += 15;
      }
      if (start + it.minutes <= 24 * 60) {
        const type = it.category === "project" ? "deep" : it.category === "urgent" ? "urgent" : "maintenance";
        await addBlock({
          day: today,
          start_min: start,
          end_min: start + it.minutes,
          label: it.label,
          type,
          buffer: 0.2,
        });
        start += it.minutes;
        count++;
      }
    }
    setAdded(count);
  };

  const projectItems = items.filter((i) => i.category === "project");
  const urgentList = items.filter((i) => i.category === "urgent");
  const maintList = items.filter((i) => i.category === "maintenance");

  const sectionsData = [
    { key: "project", title: "1. Core Project (3 Hours)", items: projectItems, cat: "project" as const },
    { key: "urgent", title: "2. Urgent Tasks (3 Short)", items: urgentList, cat: "urgent" as const },
    { key: "maintenance", title: "3. Maintenance & Admin (3 Tasks)", items: maintList, cat: "maintenance" as const },
  ];

  return (
    <View style={styles.root}>
      <FlatList
        data={sectionsData}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>3-3-3 Rule Planner</Text>
            <Text style={styles.hint}>
              Spend 3 hours on one deep project, accomplish 3 urgent tasks, and clear 3 maintenance tasks. You can fully customize, edit, or delete any item below.
            </Text>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <View style={styles.topActions}>
              <Pressable style={styles.aiBtn} onPress={aiAutoFill} disabled={working}>
                <Ionicons name="sparkles" size={16} color={ACCENT} />
                <Text style={styles.aiBtnText}>{working ? "Generating…" : "AI Auto-Fill"}</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={applyToTimeblocks}>
                <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
                <Text style={styles.applyBtnText}>Send to Timeblocks</Text>
              </Pressable>
            </View>
            {added > 0 && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#12B76A" />
                <Text style={styles.successText}>Successfully added {added} time blocks for today!</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item: sec }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{sec.title}</Text>
              <Pressable
                style={styles.addMiniBtn}
                onPress={() => openAddModal(sec.cat)}
                accessibilityRole="button"
                accessibilityLabel={`Add item to ${sec.title}`}
              >
                <Ionicons name="add" size={16} color={ACCENT} />
                <Text style={styles.addMiniText}>Add</Text>
              </Pressable>
            </View>

            {sec.items.length === 0 ? (
              <Text style={styles.emptyText}>No items added yet. Tap Add to create one.</Text>
            ) : (
              sec.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLabel}>{it.label}</Text>
                    <Text style={styles.itemSub}>{it.minutes} min</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => openEditModal(it)}
                      accessibilityRole="button"
                      accessibilityLabel="Edit task"
                    >
                      <Ionicons name="pencil-outline" size={16} color={SUB} />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => deleteItem(it.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete task"
                    >
                      <Ionicons name="trash-outline" size={16} color={RED} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      />

      {/* Edit / Add Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editingItem ? "Edit 3-3-3 Task" : "Add 3-3-3 Task"}</Text>
            
            <Text style={styles.fieldLabel}>Task Title</Text>
            <TextInput
              style={styles.input}
              value={modalLabel}
              onChangeText={setModalLabel}
              placeholder="e.g. Finish quarterly report"
              placeholderTextColor={SUB}
            />

            <Text style={styles.fieldLabel}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              value={modalMinutes}
              onChangeText={setModalMinutes}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={SUB}
            />

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={saveModal}>
                <Text style={styles.modalSaveText}>Save</Text>
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
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: TEXT, fontSize: 22, fontWeight: "700", marginBottom: 6 },
  hint: { color: SUB, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  topActions: { flexDirection: "row", gap: 10, marginBottom: 16 },
  aiBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 12,
    minHeight: 44,
  },
  aiBtnText: { color: ACCENT, fontWeight: "700", fontSize: 14 },
  applyBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: ACCENT,
    borderRadius: 12,
    minHeight: 44,
  },
  applyBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  err: { color: RED, fontSize: 13, marginBottom: 10 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(18,183,106,0.15)",
    borderWidth: 1,
    borderColor: "#12B76A",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  successText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { color: TEXT, fontSize: 15, fontWeight: "700" },
  addMiniBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4 },
  addMiniText: { color: ACCENT, fontSize: 13, fontWeight: "700" },
  emptyText: { color: SUB, fontSize: 13, fontStyle: "italic", paddingVertical: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  itemLabel: { color: TEXT, fontSize: 14, fontWeight: "600" },
  itemSub: { color: SUB, fontSize: 12, marginTop: 2 },
  itemActions: { flexDirection: "row", gap: 8 },
  iconBtn: { padding: 6 },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: LINE,
  },
  modalTitle: { color: TEXT, fontSize: 17, fontWeight: "700", marginBottom: 14 },
  fieldLabel: { color: SUB, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    color: TEXT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 18 },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: { color: SUB, fontWeight: "600" },
  modalSave: {
    flex: 1,
    backgroundColor: ACCENT,
    borderRadius: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveText: { color: "#FFFFFF", fontWeight: "700" },
});
