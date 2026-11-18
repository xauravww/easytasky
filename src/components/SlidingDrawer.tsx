import React, { useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

const BG = "#141414";
const CARD = "#1E1E1E";
const LINE = "#282828";
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
  const [isOpen, setIsOpen] = useState(false);

  // Position of drawer slide (-DRAWER_WIDTH is offscreen, 0 is fully open)
  const [drawerX] = useState(() => new Animated.Value(-DRAWER_WIDTH));

  // Draggable handle vertical offset (from bottom)
  const [handleY] = useState(() => new Animated.Value(260));

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
      toValue: -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  };

  // Pan responder for dragging the handle up and down
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderMove: (_, gestureState) => {
        // Move handle vertically within screen bounds
        const newY = Math.max(120, Math.min(SCREEN_HEIGHT - 200, 260 - gestureState.dy));
        handleY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          // If tap, open drawer
          openDrawer();
        }
      },
    })
  );

  // Menu items: strictly excludes bottom tab options (Tasks, Agent, Focus, Habits, Extras)
  const drawerItems: {
    key: DrawerOptionKey;
    icon: string;
    label: string;
    desc: string;
  }[] = [
    {
      key: "sections",
      icon: "folder-open-outline",
      label: "Categories & Sections",
      desc: "Create and organize task categories",
    },
    {
      key: "archived",
      icon: "archive-outline",
      label: "Archived Tasks",
      desc: "Search, filter, or restore discarded tasks",
    },
    {
      key: "backup",
      icon: "cloud-upload-outline",
      label: "Backup & Restore",
      desc: "Save to Google Drive, GitHub or JSON",
    },
    {
      key: "nextday",
      icon: "journal-outline",
      label: "Next-Day Notebook",
      desc: "Rough plans & agent preferences",
    },
    {
      key: "shutdown",
      icon: "moon-outline",
      label: "Shutdown Ritual",
      desc: "Daily end-of-day checklist",
    },
    {
      key: "settings",
      icon: "settings-outline",
      label: "Settings & AI Profile",
      desc: "Configure API keys and model",
    },
  ];

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
            accessibilityLabel="Open sidebar drawer"
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
                  paddingTop: insets.top + 16,
                  paddingBottom: insets.bottom + 20,
                  transform: [{ translateX: drawerX }],
                },
              ]}
            >
              <View style={styles.drawerHeader}>
                <View style={styles.drawerLogoBox}>
                  <Ionicons name="layers" size={20} color={ACCENT} />
                  <Text style={styles.drawerHeaderTitle}>EasyTasky Menu</Text>
                </View>
                <Pressable onPress={closeDrawer} style={styles.closeDrawerBtn}>
                  <Ionicons name="close" size={20} color={SUB} />
                </Pressable>
              </View>

              <View style={styles.drawerItemsList}>
                {drawerItems.map((item) => (
                  <Pressable
                    key={item.key}
                    style={({ pressed }) => [styles.drawerItem, pressed && styles.drawerItemPressed]}
                    onPress={() => {
                      closeDrawer();
                      onSelectOption(item.key);
                    }}
                    accessibilityRole="button"
                  >
                    <View style={styles.itemIconBox}>
                      <Ionicons name={item.icon as never} size={20} color={ACCENT} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      <Text style={styles.itemDesc}>{item.desc}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#444444" />
                  </Pressable>
                ))}
              </View>

              <View style={styles.drawerFooter}>
                <Text style={styles.drawerFooterText}>EasyTasky v2.0 · Pro Productivity</Text>
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
    zIndex: 9999,
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
    width: DRAWER_WIDTH,
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
    marginBottom: 20,
    paddingBottom: 14,
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
    fontSize: 18,
    fontWeight: "700",
  },
  closeDrawerBtn: {
    padding: 4,
  },
  drawerItemsList: {
    flex: 1,
    gap: 8,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: LINE,
  },
  drawerItemPressed: {
    backgroundColor: "#262626",
  },
  itemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(250,110,30,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "600",
  },
  itemDesc: {
    color: SUB,
    fontSize: 11,
    marginTop: 2,
  },
  drawerFooter: {
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    alignItems: "center",
  },
  drawerFooterText: {
    color: "#555555",
    fontSize: 11,
  },
});
