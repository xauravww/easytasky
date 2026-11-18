import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
import { COLORS } from "./src/components/ui";
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
import UpdateBanner from "./src/components/UpdateBanner";
import AgentCallHost from "./src/components/AgentCallHost";
import { useAgentStore } from "./src/store/useAgentStore";
import AppStartupState from "./src/components/AppStartupState";

type TabKey = "tasks" | "chat" | "focus" | "habits" | "extras";

const ACCENT = "#FA6E1E";
const SUB = "#9C9C9C";

const TABS: { key: TabKey; icon: string; activeIcon: string; label: string }[] = [
  { key: "tasks", icon: "checkbox-outline", activeIcon: "checkbox", label: "Tasks" },
  { key: "chat", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses", label: "Agent" },
  { key: "focus", icon: "timer-outline", activeIcon: "timer", label: "Focus" },
  { key: "habits", icon: "flame-outline", activeIcon: "flame", label: "Habits" },
  { key: "extras", icon: "grid-outline", activeIcon: "grid", label: "Extras" },
];

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [tab, setTab] = useState<TabKey>("tasks");
  const [focusImmersive, setFocusImmersive] = useState(false);
  const [fade] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);

  // Drawer options modal state
  const [activeModal, setActiveModal] = useState<DrawerOptionKey | null>(null);

  useEffect(() => {
    let active = true;
    void init()
      .then(() => useAgentStore.getState().hydrate())
      .catch((error) => {
        if (!active) return;
        setInitError(error instanceof Error ? error.message : "The workspace could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [init, initAttempt]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

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
    if (reduceMotion) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!ready) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeModal) {
        setActiveModal(null);
        return true;
      }
      if (focusImmersive) {
        setFocusImmersive(false);
        return true;
      }
      if (tab !== "tasks") {
        setFocusImmersive(false);
        setTab("tasks");
        if (reduceMotion) {
          fade.setValue(1);
        } else {
          fade.setValue(0);
          Animated.timing(fade, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [activeModal, fade, focusImmersive, ready, reduceMotion, tab]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" animated={!reduceMotion} />
      <NavigationBar style="dark" hidden={focusImmersive} />
      {!ready ? (
        <AppStartupState
          error={initError}
          onRetry={() => {
            setInitError(null);
            setInitAttempt((attempt) => attempt + 1);
          }}
        />
      ) : (
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
              {TABS.map((t) => {
                const selected = tab === t.key;
                return (
                <Pressable
                  key={t.key}
                  style={({ pressed }) => [
                    styles.tab,
                    selected && styles.tabSelected,
                    pressed && styles.tabPressed,
                  ]}
                  onPress={() => switchTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityLabel={t.label}
                  accessibilityState={{ selected }}
                >
                  <Ionicons
                    name={(selected ? t.activeIcon : t.icon) as never}
                    size={21}
                    color={selected ? ACCENT : SUB}
                  />
                  <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{t.label}</Text>
                </Pressable>
                );
              })}
            </View>

            {tab === "tasks" ? (
              <SlidingDrawer onSelectOption={(opt) => setActiveModal(opt)} />
            ) : null}

            {/* In-App Auto-Update Banner */}
            <UpdateBanner />

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
                    <Pressable
                      onPress={() => setActiveModal(null)}
                      style={styles.modalCloseBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Close archived tasks"
                    >
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
                    <Pressable
                      onPress={() => setActiveModal(null)}
                      style={styles.modalCloseBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Close next-day notebook"
                    >
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
                    <Pressable
                      onPress={() => setActiveModal(null)}
                      style={styles.modalCloseBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Close shutdown ritual"
                    >
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
      )}
      {ready ? <AgentCallHost /> : null}
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
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 8,
    gap: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    gap: 3,
    borderRadius: 14,
  },
  tabSelected: { backgroundColor: "rgba(250,110,30,0.1)" },
  tabPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  tabLabel: { fontSize: 11, lineHeight: 14, color: SUB, fontWeight: "600" },
  tabLabelSelected: { color: ACCENT, fontWeight: "800" },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
});
