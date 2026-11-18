import React, { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store/useStore";
import type { Section } from "../db/database";

const BG = "#141414";
const CARD = "#1C1C1C";
const FIELD = "#242424";
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

type SortMode = "name_asc" | "name_desc" | "tasks_count" | "created";

type Props = {
  onBack?: () => void;
};

export default function CategoriesScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const sections = useStore((s) => s.sections);
  const tasks = useStore((s) => s.tasks);
  const addSection = useStore((s) => s.addSection);
  const updateSection = useStore((s) => s.updateSection);
  const deleteSection = useStore((s) => s.deleteSection);

  // Search & Filters & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name_asc");
  const [selectedColorFilter, setSelectedColorFilter] = useState<string | null>(null);

  // CRUD Form State
  const [editingSec, setEditingSec] = useState<Section | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [showAddForm, setShowAddForm] = useState(false);

  // Compute Task Count Map
  const taskCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks) {
      if (t.section_id) {
        map[t.section_id] = (map[t.section_id] || 0) + 1;
      }
    }
    return map;
  }, [tasks]);

  // Filtered & Sorted sections
  const filteredSections = useMemo(() => {
    let result = [...sections];

    // Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((sec) => sec.name.toLowerCase().includes(q));
    }

    // Color filter
    if (selectedColorFilter) {
      result = result.filter((sec) => sec.color === selectedColorFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortMode === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortMode === "name_desc") {
        return b.name.localeCompare(a.name);
      }
      if (sortMode === "tasks_count") {
        const countA = taskCountMap[a.id] || 0;
        const countB = taskCountMap[b.id] || 0;
        return countB - countA;
      }
      // "created"
      return a.id.localeCompare(b.id);
    });

    return result;
  }, [sections, searchQuery, selectedColorFilter, sortMode, taskCountMap]);

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

  const handleDelete = async (id: string) => {
    await deleteSection(id);
    if (editingSec?.id === id) {
      setShowAddForm(false);
      setEditingSec(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <Pressable style={styles.headerBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={TEXT} />
          </Pressable>
        ) : (
          <View style={styles.headerIcon}>
            <Ionicons name="folder-outline" size={20} color={ACCENT} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Categories & Sections</Text>
          <Text style={styles.headerSubtitle}>
            {sections.length} categories · {tasks.length} total tasks
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
          onPress={openAdd}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.newBtnText}>Add</Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={SUB} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor="#555555"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={SUB} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Sort & Color Filter Bar */}
      <View style={styles.filtersBar}>
        {/* Sort Chips */}
        <Pressable
          style={[styles.filterChip, sortMode === "name_asc" && styles.filterChipActive]}
          onPress={() => setSortMode("name_asc")}
        >
          <Text style={[styles.filterChipText, sortMode === "name_asc" && styles.filterChipTextActive]}>
            A-Z
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterChip, sortMode === "name_desc" && styles.filterChipActive]}
          onPress={() => setSortMode("name_desc")}
        >
          <Text style={[styles.filterChipText, sortMode === "name_desc" && styles.filterChipTextActive]}>
            Z-A
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterChip, sortMode === "tasks_count" && styles.filterChipActive]}
          onPress={() => setSortMode("tasks_count")}
        >
          <Ionicons
            name="layers-outline"
            size={12}
            color={sortMode === "tasks_count" ? "#FFFFFF" : SUB}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.filterChipText, sortMode === "tasks_count" && styles.filterChipTextActive]}>
            Most Tasks
          </Text>
        </Pressable>

        {/* Color Palette Filter */}
        <View style={styles.colorFilterRow}>
          {selectedColorFilter && (
            <Pressable
              style={styles.clearColorFilter}
              onPress={() => setSelectedColorFilter(null)}
            >
              <Text style={styles.clearColorText}>Clear color</Text>
            </Pressable>
          )}
          {PRESET_COLORS.slice(0, 5).map((c) => (
            <Pressable
              key={c}
              style={[
                styles.colorDotBtn,
                { backgroundColor: c },
                selectedColorFilter === c && styles.colorDotBtnActive,
              ]}
              onPress={() => setSelectedColorFilter(selectedColorFilter === c ? null : c)}
            />
          ))}
        </View>
      </View>

      {/* Add / Edit Form Modal or Inline Drawer */}
      {showAddForm && (
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editingSec ? "Edit Category" : "New Category"}</Text>
            <Pressable onPress={() => setShowAddForm(false)}>
              <Ionicons name="close" size={20} color={SUB} />
            </Pressable>
          </View>

          <TextInput
            style={styles.formInput}
            placeholder="Category name (e.g. Work, Health, EasyTasky)"
            placeholderTextColor="#555555"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={styles.colorPickerLabel}>Accent Color</Text>
          <View style={styles.colorsGrid}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.colorOption,
                  { backgroundColor: c },
                  color === c && styles.colorOptionSelected,
                ]}
                onPress={() => setColor(c)}
              >
                {color === c && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </Pressable>
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

            <Pressable
              style={[styles.saveBtn, !name.trim() && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.saveBtnText}>{editingSec ? "Save Changes" : "Create Category"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Categories Virtualized List */}
      <FlatList
        data={filteredSections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={40} color="#333333" />
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedColorFilter ? "No matching categories" : "No categories yet"}
            </Text>
            <Text style={styles.emptyDesc}>
              {searchQuery || selectedColorFilter
                ? "Try clearing your search query or color filters."
                : "Create categories to organize your tasks into distinct focus areas."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const count = taskCountMap[item.id] || 0;
          return (
            <View style={styles.categoryCard}>
              <View style={styles.categoryCardLeft}>
                <View style={[styles.categoryColorBar, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.categoryTaskCount}>
                    {count} {count === 1 ? "task" : "tasks"}
                  </Text>
                </View>
              </View>

              <View style={styles.categoryActions}>
                <Pressable
                  style={styles.iconActionBtn}
                  onPress={() => openEdit(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit category"
                >
                  <Ionicons name="pencil-outline" size={17} color={SUB} />
                </Pressable>

                <Pressable
                  style={styles.iconActionBtn}
                  onPress={() => handleDelete(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete category"
                >
                  <Ionicons name="trash-outline" size={17} color={RED} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    gap: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: SUB,
    fontSize: 12,
    marginTop: 2,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FIELD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    padding: 0,
  },
  filtersBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: LINE,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: "#2E2E2E",
    borderColor: ACCENT,
  },
  filterChipText: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: TEXT,
    fontWeight: "700",
  },
  colorFilterRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  },
  clearColorFilter: {
    marginRight: 4,
  },
  clearColorText: {
    color: SUB,
    fontSize: 11,
  },
  colorDotBtn: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorDotBtnActive: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  formContainer: {
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  formTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
  },
  formInput: {
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT,
    fontSize: 14,
    marginBottom: 12,
  },
  colorPickerLabel: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  colorsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  colorOptionSelected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: FIELD,
  },
  cancelBtnText: {
    color: SUB,
    fontSize: 13,
    fontWeight: "600",
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 8,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
  },
  categoryCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  categoryColorBar: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  categoryName: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "600",
  },
  categoryTaskCount: {
    color: SUB,
    fontSize: 12,
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconActionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: FIELD,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyDesc: {
    color: SUB,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
