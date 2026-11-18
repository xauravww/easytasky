import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store/useStore";

const BG = "#141414";
const CARD = "#1C1C1C";
const LINE = "#242424";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";

export type DrawerOptionKey =
  | "sections"
  | "archived"
  | "backup"
  | "nextday"
  | "shutdown"
  | "settings";

type Props = {
  onSelectOption: (key: DrawerOptionKey) => void;
};

export default function SlidingDrawer({ onSelectOption }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.78, 300);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerX] = useState(() => new Animated.Value(-drawerWidth));
  const [handleY] = useState(() => new Animated.Value(260));

  const sections = useStore((s) => s.sections);
  const sectionFilter = useStore((s) => s.sectionFilter);
  const setSectionFilter = useStore((s) => s.setSectionFilter);
  const tasks = useStore((s) => s.tasks);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.name.toLowerCase().includes(q));
  }, [sections, search]);

  useEffect(() => {
    if (!isOpen) drawerX.setValue(-drawerWidth);
  }, [drawerWidth, drawerX, isOpen]);

  useEffect(() => {
    const maxBottom = Math.max(96, height - 180);
    handleY.stopAnimation((value) => {
      const clamped = Math.max(96, Math.min(maxBottom, value));
      if (clamped !== value) handleY.setValue(clamped);
    });
  }, [handleY, height]);

  const openDrawer = () => {
    setIsOpen(true);
    Animated.spring(drawerX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerX, {
      toValue: -drawerWidth,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  };

  // Pan responder for dragging the handle up and down
  const panResponder = useMemo(() => {
    let handleStartY = 260;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        handleY.stopAnimation((value) => {
          handleStartY = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const maxBottom = Math.max(96, height - 180);
        const newY = Math.max(
          96,
          Math.min(maxBottom, handleStartY - gestureState.dy)
        );
        handleY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          setIsOpen(true);
          Animated.spring(drawerX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    });
  }, [drawerX, handleY, height]);

  const handleSelectCategory = (catId: string | null) => {
    setSectionFilter(catId);
    closeDrawer();
  };

  return (
    <>
      {/* Floating draggable/rotatable handle on screen edge */}
      {!isOpen && (
        <Animated.View
          style={[styles.floatingHandleWrapper, { bottom: handleY }]}
          {...panResponder.panHandlers}
        >
          <Pressable
            style={styles.floatingHandle}
            onPress={openDrawer}
            accessibilityRole="button"
            accessibilityLabel="Open categories drawer"
          >
            {/* Rotated triangle / arrow icon indicator */}
            <View style={styles.arrowIconBox}>
              <Ionicons name="caret-forward" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.handleIndicatorGrip}>
              <View style={styles.gripDot} />
              <View style={styles.gripDot} />
              <View style={styles.gripDot} />
            </View>
          </Pressable>
        </Animated.View>
      )}

      {/* Slide-out modal drawer */}
      {isOpen && (
        <Modal transparent visible={isOpen} onRequestClose={closeDrawer} animationType="none">
          <View style={styles.drawerOverlay}>
            <Pressable style={styles.scrim} onPress={closeDrawer} />

            <Animated.View
              style={[
                styles.drawerContent,
                {
                  width: drawerWidth,
                  paddingTop: insets.top + 16,
                  paddingBottom: insets.bottom + 16,
                  transform: [{ translateX: drawerX }],
                },
              ]}
            >
              {/* Header */}
              <View style={styles.drawerHeader}>
                <View style={styles.drawerLogoBox}>
                  <Ionicons name="folder-outline" size={18} color={ACCENT} />
                  <Text style={styles.drawerHeaderTitle}>Categories</Text>
                </View>
                <Pressable
                  onPress={closeDrawer}
                  style={styles.closeDrawerBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close categories drawer"
                >
                  <Ionicons name="close" size={20} color={SUB} />
                </Pressable>
              </View>

              {/* Search Filter for Categories */}
              <View style={styles.searchRow}>
                <Ionicons name="search" size={15} color={SUB} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Filter categories…"
                  placeholderTextColor={SUB}
                  clearButtonMode="while-editing"
                />
                {search.length > 0 && (
                  <Pressable
                    onPress={() => setSearch("")}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Clear category search"
                  >
                    <Ionicons name="close-circle" size={16} color={SUB} />
                  </Pressable>
                )}
              </View>

              {/* Clean Categories List */}
              <View style={styles.categoriesSection}>
                {/* "All Tasks" option */}
                {!search && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.categoryRow,
                      sectionFilter === null && styles.categoryRowActive,
                      pressed && styles.categoryRowPressed,
                    ]}
                    onPress={() => handleSelectCategory(null)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sectionFilter === null }}
                    accessibilityLabel="All tasks"
                  >
                    <View style={styles.categoryLeft}>
                      <View style={[styles.categoryDot, { backgroundColor: ACCENT }]} />
                      <Text
                        style={[
                          styles.categoryName,
                          sectionFilter === null && styles.categoryNameActive,
                        ]}
                      >
                        All Tasks
                      </Text>
                    </View>
                    <Text style={styles.categoryCount}>
                      {tasks.filter((t) => t.status !== "done" && t.status !== "habit" && t.status !== "unwanted").length}
                    </Text>
                  </Pressable>
                )}

                <FlatList
                  data={filteredSections}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={12}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  getItemLayout={(_, index) => ({
                    length: 44,
                    offset: 44 * index,
                    index,
                  })}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingVertical: 4 }}
                  ListEmptyComponent={
                    <View style={styles.emptyCategories}>
                      <Text style={styles.emptyCategoriesText}>
                        {search ? "No matching categories" : "No custom categories yet."}
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const count = tasks.filter(
                      (t) =>
                        t.section_id === item.id &&
                        t.status !== "done" &&
                        t.status !== "habit" &&
                        t.status !== "unwanted"
                    ).length;
                    const isSelected = sectionFilter === item.id;
                    return (
                      <Pressable
                        style={({ pressed }) => [
                          styles.categoryRow,
                          isSelected && styles.categoryRowActive,
                          pressed && styles.categoryRowPressed,
                        ]}
                        onPress={() => handleSelectCategory(isSelected ? null : item.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${item.name}, ${count} open tasks`}
                      >
                        <View style={styles.categoryLeft}>
                          <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                          <Text
                            style={[
                              styles.categoryName,
                              isSelected && styles.categoryNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </View>
                        <Text style={styles.categoryCount}>{count}</Text>
                      </Pressable>
                    );
                  }}
                />
              </View>

              {/* Quick Manage Categories Action */}
              <Pressable
                style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  closeDrawer();
                  onSelectOption("sections");
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
                <Text style={styles.manageBtnText}>Edit / Add Categories</Text>
              </Pressable>

              {/* Footer with App Settings option */}
              <View style={styles.drawerFooter}>
                <Pressable
                  style={({ pressed }) => [styles.settingsRow, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    closeDrawer();
                    onSelectOption("settings");
                  }}
                >
                  <Ionicons name="settings-outline" size={18} color={SUB} />
                  <Text style={styles.settingsRowText}>All Settings & Backups</Text>
                  <Ionicons name="chevron-forward" size={14} color="#444444" />
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  floatingHandleWrapper: {
    position: "absolute",
    left: 0,
    zIndex: 40,
  },
  floatingHandle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1C",
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    paddingVertical: 10,
    paddingLeft: 4,
    paddingRight: 8,
    borderWidth: 1.5,
    borderLeftWidth: 0,
    borderColor: ACCENT,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
    gap: 4,
  },
  arrowIconBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  handleIndicatorGrip: {
    gap: 3,
    alignItems: "center",
  },
  gripDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: SUB,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  drawerContent: {
    backgroundColor: BG,
    borderRightWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 16,
    height: "100%",
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  drawerLogoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  drawerHeaderTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "700",
  },
  closeDrawerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 10,
    height: 36,
    marginBottom: 12,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 13,
    paddingVertical: 0,
    height: "100%",
  },
  categoriesSection: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  categoryRowActive: {
    backgroundColor: CARD,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  categoryRowPressed: {
    backgroundColor: "#202020",
  },
  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  categoryDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  categoryName: {
    color: SUB,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  categoryNameActive: {
    color: TEXT,
    fontWeight: "700",
  },
  categoryCount: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyCategories: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyCategoriesText: {
    color: SUB,
    fontSize: 13,
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    backgroundColor: CARD,
    marginBottom: 12,
  },
  manageBtnText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "600",
  },
  drawerFooter: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  settingsRowText: {
    color: SUB,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
});
