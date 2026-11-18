import React, { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
import { COLORS, Spinner } from "./src/components/ui";
import { useStore } from "./src/store/useStore";
import TasksScreen from "./src/screens/TasksScreen";
import AgentScreen from "./src/screens/AgentScreen";
import FocusScreen from "./src/screens/FocusScreen";
import ExtrasScreen from "./src/screens/ExtrasScreen";
import HabitsScreen from "./src/screens/HabitsScreen";
import SlidingDrawer, { type DrawerOptionKey } from "./src/components/SlidingDrawer";
import SectionsManagerModal from "./src/components/SectionsManagerModal";
import BackupRestoreModal from "./src/components/BackupRestoreModal";
import SettingsModal from "./src/components/SettingsModal";
import NextDayPlanTool from "./src/components/NextDayPlanTool";
import ShutdownRitualTool from "./src/components/ShutdownRitualTool";
import ArchivedTasksTool from "./src/components/ArchivedTasksTool";


type TabKey = "tasks" | "chat" | "focus" | "habits" | "extras";

const ACCENT = "#FA6E1E";
const SUB = "#9C9C9C";

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: "tasks", icon: "checkbox-outline", label: "Tasks" },
  { key: "chat", icon: "chatbubble-ellipses-outline", label: "Agent" },
  { key: "focus", icon: "timer-outline", label: "Focus" },
  { key: "habits", icon: "flame-outline", label: "Habits" },
  { key: "extras", icon: "grid-outline", label: "Extras" },
];

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [tab, setTab] = useState<TabKey>("tasks");
  const [focusImmersive, setFocusImmersive] = useState(false);
  const [fade] = useState(() => new Animated.Value(1));

  // Drawer options modal state
  const [activeModal, setActiveModal] = useState<DrawerOptionKey | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  // "Start focus" from anywhere (e.g. task detail) → jump to immersive Focus.
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.focusReq !== prev.focusReq && s.focusReq > 0) {
          setTab("focus");
          setFocusImmersive(true);
        }
      }),
    []
  );

  // Filtered task drill-down (e.g. Eisenhower "View all") → jump to Tasks.
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.tasksReq !== prev.tasksReq && s.tasksReq > 0) {
          setTab("tasks");
          setFocusImmersive(false);
        }
      }),
    []
  );

  const switchTab = (next: TabKey) => {
    if (next === tab) return;
    setFocusImmersive(false);
    setTab(next);
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <Spinner />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={focusImmersive ? "light" : "dark"} />
      <NavigationBar style={focusImmersive ? "dark" : "light"} hidden={focusImmersive} />
      <View style={[styles.container, focusImmersive && styles.focusShell]}>
        {tab === "focus" && focusImmersive ? (
          <Animated.View style={[{ flex: 1 }, { opacity: fade }]}>
            <FocusScreen immersive onMinimize={() => setFocusImmersive(false)} />
          </Animated.View>
        ) : (
          <SafeAreaView style={styles.container}>
            <Animated.View style={[{ flex: 1 }, { opacity: fade }]}>
              {tab === "tasks" && <TasksScreen />}
              {tab === "chat" && <AgentScreen />}
              {tab === "focus" && <FocusScreen onEnterImmersive={() => setFocusImmersive(true)} />}
              {tab === "habits" && <HabitsScreen />}
              {tab === "extras" && <ExtrasScreen />}
            </Animated.View>
            <View style={styles.tabbar}>
              {TABS.map((t) => (
                <Pressable key={t.key} style={styles.tab} onPress={() => switchTab(t.key)}>
                  <Ionicons
                    name={t.icon as never}
                    size={20}
                    color={tab === t.key ? ACCENT : SUB}
                  />
                  <Text style={[styles.tabLabel, tab === t.key && { color: ACCENT, fontWeight: "700" }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Draggable Sliding Drawer Handle (Item 1) */}
            <SlidingDrawer onSelectOption={(opt) => setActiveModal(opt)} />

            {/* Drawer Sub-Modals */}
            <SectionsManagerModal
              visible={activeModal === "sections"}
              onClose={() => setActiveModal(null)}
            />
            <BackupRestoreModal
              visible={activeModal === "backup"}
              onClose={() => setActiveModal(null)}
            />
            {activeModal === "settings" && (
              <SettingsModal
                onClose={() => setActiveModal(null)}
                onSaved={() => setActiveModal(null)}
              />
            )}
            {activeModal === "archived" && (
              <View style={StyleSheet.absoluteFill}>
                <SafeAreaView style={{ flex: 1, backgroundColor: "#141414" }}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalHeaderTitle}>Archived Tasks</Text>
                    <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                      <Ionicons name="close" size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  <ArchivedTasksTool />
                </SafeAreaView>
              </View>
            )}
            {activeModal === "nextday" && (
              <View style={StyleSheet.absoluteFill}>
                <SafeAreaView style={{ flex: 1, backgroundColor: "#141414" }}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalHeaderTitle}>Next-Day Notebook</Text>
                    <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                      <Ionicons name="close" size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  <NextDayPlanTool />
                </SafeAreaView>
              </View>
            )}
            {activeModal === "shutdown" && (
              <View style={StyleSheet.absoluteFill}>
                <SafeAreaView style={{ flex: 1, backgroundColor: "#141414" }}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalHeaderTitle}>Shutdown Ritual</Text>
                    <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                      <Ionicons name="close" size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  <ShutdownRitualTool />
                </SafeAreaView>
              </View>
            )}
          </SafeAreaView>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  focusShell: { backgroundColor: "#000000" },
  tabbar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#262626",
    backgroundColor: "#0D0D0D",
    paddingTop: 6,
    paddingBottom: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48, gap: 2 },
  tabLabel: { fontSize: 10, color: SUB },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#282828",
  },
  modalHeaderTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
});
