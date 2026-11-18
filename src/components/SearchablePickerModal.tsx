import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SearchPickerItem = {
  id: string;
  title: string;
  subtitle?: string;
  color?: string;
  icon?: string;
};

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  items: SearchPickerItem[];
  selectedId: string | null;
  onSelect: (item: SearchPickerItem | null) => void;
  onClose: () => void;
  allowClear?: boolean;
  clearLabel?: string;
};

const BG = "#181818";
const FIELD = "#222222";
const LINE = "#2A2A2A";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";

export default function SearchablePickerModal({
  visible,
  title,
  placeholder = "Search...",
  items,
  selectedId,
  onSelect,
  onClose,
  allowClear = true,
  clearLabel = "None",
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        (it.subtitle && it.subtitle.toLowerCase().includes(q))
    );
  }, [items, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.handle} />
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close picker"
            >
              <Ionicons name="close" size={22} color={SUB} />
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={SUB} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor={SUB}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={Platform.OS !== "web"}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={16} color={SUB} />
              </Pressable>
            )}
          </View>

          {/* Items Virtualized FlatList */}
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListHeaderComponent={
              allowClear ? (
                <Pressable
                  style={[styles.itemRow, selectedId === null && styles.itemRowActive]}
                  onPress={() => {
                    onSelect(null);
                    onClose();
                  }}
                >
                  <View style={styles.itemLeft}>
                    <View style={[styles.clearDot, selectedId === null && styles.clearDotActive]} />
                    <Text style={[styles.itemTitle, selectedId === null && styles.itemTitleActive]}>
                      {clearLabel}
                    </Text>
                  </View>
                  {selectedId === null && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </Pressable>
              ) : undefined
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No results found for &quot;{query}&quot;</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = selectedId === item.id;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.itemRow,
                    isSelected && styles.itemRowActive,
                    pressed && styles.itemRowPressed,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <View style={styles.itemLeft}>
                    {item.color ? (
                      <View style={[styles.itemDot, { backgroundColor: item.color }]} />
                    ) : item.icon ? (
                      <Ionicons name={item.icon as never} size={16} color={SUB} style={{ marginRight: 6 }} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.itemTitle, isSelected && styles.itemTitleActive]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {isSelected && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
    maxHeight: "80%",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3A3A3A",
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    padding: 0,
  },
  list: {
    maxHeight: 340,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  itemRowActive: {
    backgroundColor: "#222222",
  },
  itemRowPressed: {
    backgroundColor: "#202020",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  itemDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  clearDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: SUB,
  },
  clearDotActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  itemTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "500",
  },
  itemTitleActive: {
    color: ACCENT,
    fontWeight: "700",
  },
  itemSubtitle: {
    color: SUB,
    fontSize: 12,
    marginTop: 2,
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: SUB,
    fontSize: 13,
  },
});
