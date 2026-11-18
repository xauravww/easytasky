import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CallModeModal from "./CallModeModal";
import type { CallModeModalHandle, CallPhase } from "./CallModeModal";
import { useAgentStore } from "../store/useAgentStore";

const ACCENT = "#FA6E1E";
const RED = "#E5484D";

const PHASE_LABELS: Record<CallPhase, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Issue",
};

const formatDuration = (seconds: number): string => {
  const min = Math.floor(seconds / 60);
  const sec = `${seconds % 60}`.padStart(2, "0");
  return `${min}:${sec}`;
};

// Lives above the tab switcher so an in-progress call (and its voice session)
// survives navigation between screens.
export default function AgentCallHost() {
  const insets = useSafeAreaInsets();
  const callRef = useRef<CallModeModalHandle>(null);
  const [phase, setPhase] = useState<CallPhase>("listening");
  const [clock, setClock] = useState(() => Date.now());
  const callOpen = useAgentStore((s) => s.callOpen);
  const callMinimized = useAgentStore((s) => s.callMinimized);
  const callStartedAt = useAgentStore((s) => s.callStartedAt);
  const sessions = useAgentStore((s) => s.sessions);
  const busy = useAgentStore((s) => s.busy);
  const send = useAgentStore((s) => s.send);
  const endCall = useAgentStore((s) => s.endCall);
  const minimizeCall = useAgentStore((s) => s.minimizeCall);
  const restoreCall = useAgentStore((s) => s.restoreCall);
  const recordCallTurn = useAgentStore((s) => s.recordCallTurn);
  const refreshHistory = useAgentStore((s) => s.refreshHistory);
  const deleteSession = useAgentStore((s) => s.deleteSession);

  useEffect(() => {
    if (!callStartedAt) return;
    const timer = setInterval(() => {
      setClock(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [callStartedAt]);

  const elapsedSeconds = callStartedAt
    ? Math.max(0, Math.floor((clock - callStartedAt) / 1000))
    : 0;
  const phaseColor = phase === "error" ? RED : phase === "thinking" ? "#AFAFAF" : ACCENT;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {callOpen && callMinimized ? (
        <View
          style={[
            styles.bar,
            phase === "speaking" && styles.barSpeaking,
            { top: insets.top + 8 },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
            onPress={restoreCall}
            accessibilityRole="button"
            accessibilityLabel="Open Agent"
          >
            <View style={styles.avatar}>
              <Ionicons
                name={phase === "speaking" ? "volume-high" : "person"}
                size={19}
                color="#FFFFFF"
              />
              <View style={[styles.statusDot, { backgroundColor: phaseColor }]} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.agentName}>Agent</Text>
              <View style={styles.metaRow}>
                <Text style={styles.duration}>{formatDuration(elapsedSeconds)}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.phase} numberOfLines={1}>
                  {PHASE_LABELS[phase]}
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.miniControl,
              phase === "speaking" && styles.interruptActive,
              phase !== "speaking" && styles.miniControlDisabled,
              pressed && phase === "speaking" && styles.pressed,
            ]}
            onPress={() => callRef.current?.interrupt()}
            disabled={phase !== "speaking"}
            accessibilityRole="button"
            accessibilityLabel="Interrupt Agent"
            accessibilityState={{ disabled: phase !== "speaking" }}
          >
            <Ionicons
              name="hand-right"
              size={20}
              color={phase === "speaking" ? ACCENT : "#666666"}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.hangup, pressed && styles.pressed]}
            onPress={endCall}
            accessibilityRole="button"
            accessibilityLabel="End call"
          >
            <Ionicons
              name="call"
              size={21}
              color="#FFFFFF"
              style={{ transform: [{ rotate: "135deg" }] }}
            />
          </Pressable>
        </View>
      ) : null}

      {callOpen ? (
        <CallModeModal
          ref={callRef}
          minimized={callMinimized}
          elapsedSeconds={elapsedSeconds}
          onSend={send}
          onClose={endCall}
          onMinimize={minimizeCall}
          onPhaseChange={setPhase}
          history={sessions}
          onRecordTurn={recordCallTurn}
          onRefreshHistory={refreshHistory}
          onDeleteHistory={deleteSession}
          historyDisabled={busy}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#303030",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    zIndex: 50,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.48,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
  },
  barSpeaking: { borderColor: "#6D3313", backgroundColor: "#1B1511" },
  summary: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2C1A10",
    borderWidth: 1,
    borderColor: "#6C3416",
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    position: "absolute",
    right: -1,
    bottom: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#171717",
  },
  summaryText: { flex: 1, minWidth: 0 },
  agentName: { color: "#FFFFFF", fontSize: 15, lineHeight: 19, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  duration: {
    color: "#B8B8B8",
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#666666" },
  phase: { color: "#B8B8B8", fontSize: 12, lineHeight: 16, flexShrink: 1 },
  miniControl: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#222222",
    borderWidth: 1,
    borderColor: "#343434",
    alignItems: "center",
    justifyContent: "center",
  },
  interruptActive: { backgroundColor: "#2B190E", borderColor: "#7B3914" },
  miniControlDisabled: { opacity: 0.72 },
  hangup: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.95 }] },
});
