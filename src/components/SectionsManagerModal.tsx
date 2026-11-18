import React, { useState } from "react";
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
import type { Section } from "../db/database";

const BG = "#141414";
const CARD = "#1E1E1E";
const LINE = "#2A2A2A";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const RED = "#E5484D";

const PRESET_COLORS = [
  "#0B6E46", // Brand green
  "#FA6E1E", // Accent orange
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#EAB308", // Yellow
  "#14B8A6", // Teal
  "#E5484D", // Red
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SectionsManagerModal({ visible, onClose }: Props) {
  const sections = useStore((s) => s.sections);
  const tasks = useStore((s) => s.tasks);
  const addSection = useStore((s) => s.addSection);
  const updateSection = useStore((s) => s.updateSection);
  const deleteSection = useStore((s) => s.deleteSection);

  const [editingSec, setEditingSec] = useState<Section | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [showAddForm, setShowAddForm] = useState(false);

  const openAdd = () => {
    setEditingSec(null);
    setName("");
    setColor(PRESET_COLORS[0]);
    setShowAddForm(true);
  };

  const openEdit = (sec: Section) => {
    setEditingSec(sec);
    setName(sec.name);
    setColor(sec.color || PRESET_COLORS[0]);
    setShowAddForm(true);
  };

  const handleSave = async () => {
    const clean = name.trim();
    if (!clean) return;
    if (editingSec) {
      await updateSection(editingSec.id, { name: clean, color });
    } else {
      await addSection(clean, color);
    }
    setShowAddForm(false);
    setName("");
    setEditingSec(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Categories & Sections</Text>
              <Text style={styles.sub}>Organize tasks into projects, workflows, or domains</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={TEXT} />
            </Pressable>
          </View>

          {/* Form to Add or Edit */}
          {showAddForm && (
            <View style={styles.formBox}>
              <Text style={styles.formTitle}>
                {editingSec ? "Edit Category" : "New Category"}
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Category name (e.g., Work, Personal, Side Hustle)"
                placeholderTextColor="#666666"
              />
              <Text style={styles.fieldLabel}>Select Color Badge</Text>
              <View style={styles.colorPalette}>
                {PRESET_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      color === c && styles.colorDotActive,
                    ]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

              <View style={styles.formActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowAddForm(false);
                    setEditingSec(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Top Add Button */}
          {!showAddForm && (
            <Pressable style={styles.newCategoryBtn} onPress={openAdd}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.newCategoryText}>Create New Category</Text>
            </Pressable>
          )}

          {/* List of sections with task counts */}
          <FlatList
            data={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="folder-open-outline" size={32} color="#444444" />
                <Text style={styles.emptyTitle}>No categories yet</Text>
                <Text style={styles.emptySub}>
                  Create categories above or ask the AI agent to organize them for you.
                </Text>
              </View>
            }
            renderItem={({ item: sec }) => {
              const count = tasks.filter((t) => t.section_id === sec.id).length;
              return (
                <View style={styles.itemRow}>
                  <View style={[styles.badgeDot, { backgroundColor: sec.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{sec.name}</Text>
                    <Text style={styles.itemSub}>{count} tasks assigned</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable style={styles.iconBtn} onPress={() => openEdit(sec)}>
                      <Ionicons name="pencil-outline" size={18} color={SUB} />
                    </Pressable>
                    <Pressable style={styles.iconBtn} onPress={() => deleteSection(sec.id)}>
                      <Ionicons name="trash-outline" size={18} color={RED} />
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: LINE,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  title: { color: TEXT, fontSize: 18, fontWeight: "700" },
  sub: { color: SUB, fontSize: 13, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  newCategoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    minHeight: 44,
  },
  newCategoryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  formBox: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  formTitle: { color: TEXT, fontSize: 15, fontWeight: "700", marginBottom: 12 },
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
  fieldLabel: { color: SUB, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 8 },
  colorPalette: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: "#FFFFFF" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { color: SUB, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    backgroundColor: ACCENT,
    borderRadius: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "700" },
  list: { padding: 20, paddingBottom: 40 },
  empty: { alignItems: "center", paddingVertical: 36 },
  emptyTitle: { color: TEXT, fontSize: 15, fontWeight: "600", marginTop: 10 },
  emptySub: { color: SUB, fontSize: 13, textAlign: "center", marginTop: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  badgeDot: { width: 14, height: 14, borderRadius: 7 },
  itemTitle: { color: TEXT, fontSize: 15, fontWeight: "600" },
  itemSub: { color: SUB, fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: "row", gap: 8 },
  iconBtn: { padding: 6 },
});
