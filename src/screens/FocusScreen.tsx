import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store/useStore";
import { dayKey } from "../utils/time";
import TimerSheet from "../components/TimerSheet";

const BG = "#000000";
const TICK = "#2C2C2C";
const ACCENT = "#FA6E1E";
const DIM = "#9C9C9C";

const TICK_COUNT = 60;
const SNAKE_LEN = 11; // lit band length (visual-only, does not affect time)
const TICK_INDICES = Array.from({ length: TICK_COUNT }, (_, i) => i);

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = `${m}`.padStart(h > 0 ? 2 : 2, "0");
  const ss = `${sec}`.padStart(2, "0");
  return h > 0 ? `${h} : ${mm} : ${ss}` : `${mm} : ${ss}`;
};

export default function FocusScreen({
  onMinimize,
  immersive = false,
  onEnterImmersive,
}: {
  onMinimize?: () => void;
  immersive?: boolean;
  onEnterImmersive?: () => void;
}) {
  const pomo = useStore((s) => s.pomo);
  const tasks = useStore((s) => s.tasks);
  const pomos = useStore((s) => s.pomos);
  const startPomo = useStore((s) => s.startPomo);
  const pausePomo = useStore((s) => s.pausePomo);
  const finishPomo = useStore((s) => s.finishPomo);
  const setMode = useStore((s) => s.setMode);
  const selectedTask = tasks.find((t) => t.id === pomo.taskId);

  // Today's completed focus time, exact to the second (TickTick-style mini counter).
  const todayFocus = useMemo(() => {
    const today = dayKey();
    const sec = pomos
      .filter((p) => p.completed_at && dayKey(new Date(p.completed_at)) === today)
      .reduce((sum, p) => sum + (p.focus_sec ?? Math.round(p.focus_min * 60)), 0);
    if (sec <= 0) return null;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
    if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
    return `${s}s`;
  }, [pomos]);

  const insets = useSafeAreaInsets();
  const lastTap = useRef(0);
  const handleDialTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      onEnterImmersive?.();
    } else {
      lastTap.current = now;
    }
  };

  const [musicOn, setMusicOn] = useState(false);
  const [tickOn, setTickOn] = useState(false);
  const [keepAwakeOn, setKeepAwakeOn] = useState(true);
  const [sheet, setSheet] = useState(false);

  const noise = useAudioPlayer(require("../../assets/rain.mp3"));
  const tickAudio = useAudioPlayer(require("../../assets/tick.wav"));

  // Keep screen awake if enabled
  useEffect(() => {
    const TAG = "focus_screen_keep_awake";
    if (keepAwakeOn) {
      void activateKeepAwakeAsync(TAG);
    } else {
      void deactivateKeepAwake(TAG);
    }
    return () => {
      void deactivateKeepAwake(TAG);
    };
  }, [keepAwakeOn]);

  useEffect(() => {
    if (musicOn) {
      // eslint-disable-next-line react-hooks/immutability
      noise.loop = true;
      noise.play();
    } else {
      noise.pause();
    }
  }, [musicOn, noise]);

  useEffect(() => {
    return () => {
      try {
        noise.pause();
      } catch {}
    };
  }, [noise]);

  // Tick-tick sound on every second when active and running
  const prevSecRef = useRef<number>(-1);
  useEffect(() => {
    if (tickOn && pomo.running) {
      if (prevSecRef.current !== pomo.left) {
        prevSecRef.current = pomo.left;
        try {
          tickAudio.seekTo(0);
          tickAudio.play();
        } catch {}
      }
    }
  }, [tickOn, pomo.running, pomo.left, tickAudio]);

  const { running, phase, left, totalSec, mode } = pomo;
  const inBreak = phase === "break";

  // The snake rotates one full lap per minute (60 ticks / 60s), independent of the
  // session length. For the stopwatch, left is elapsed seconds — each minute is a lap.
  const elapsedInSession = mode === "stopwatch" ? left : Math.max(0, totalSec - left);
  const secondOfMinute = elapsedInSession % 60;
  const totalElapsedTicks = (secondOfMinute / 60) * TICK_COUNT;

  const { width: winW } = useWindowDimensions();
  const size = Math.min(winW - 84, 276);
  const c = size / 2;
  const statusLabel =
    mode === "stopwatch"
      ? running
        ? "Stopwatch"
        : left > 0
          ? "Paused"
          : "Ready"
      : inBreak
        ? "Break"
        : running
          ? "Focusing"
          : elapsedInSession > 0
            ? "Paused"
            : "Ready";

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {immersive ? (
          <Pressable
            style={styles.minimize}
            onPress={onMinimize}
            accessibilityRole="button"
            accessibilityLabel="Exit focus timer"
          >
            <Ionicons name="chevron-down" size={26} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={styles.minimize} />
        )}
        <View style={styles.headerTitle}>
          <Text style={styles.headerText}>Focus</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.keepAwakeBtn, keepAwakeOn && styles.keepAwakeBtnActive]}
            onPress={() => setKeepAwakeOn((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={keepAwakeOn ? "Screen stays on (enabled)" : "Screen stays on (disabled)"}
          >
            <Ionicons
              name={keepAwakeOn ? "sunny" : "sunny-outline"}
              size={14}
              color={keepAwakeOn ? "#FFFFFF" : "#777777"}
            />
            <Text style={[styles.keepAwakeBtnText, keepAwakeOn && styles.keepAwakeBtnTextActive]}>
              {keepAwakeOn ? "Always On" : "Auto Off"}
            </Text>
          </Pressable>

          <Pressable style={styles.minimize} onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel="Focus settings">
            <Ionicons name="settings-outline" size={22} color="#D6D6D6" />
          </Pressable>
        </View>
      </View>

      {selectedTask && (
        <View style={styles.taskChip}>
          <Text style={styles.taskChipText} numberOfLines={1} ellipsizeMode="tail">
            {selectedTask.title}
          </Text>
        </View>
      )}

      {/* Mode switcher — locked while a session is running */}
      <View style={styles.modeRow}>
        {(["pomodoro", "stopwatch"] as const).map((m) => (
          <Pressable
            key={m}
            style={[styles.modeChip, mode === m && styles.modeChipActive]}
            onPress={() => setMode(m)}
            disabled={running}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m }}
            accessibilityLabel={`${m} mode`}
          >
            <Ionicons name={m === "pomodoro" ? "timer-outline" : "stopwatch-outline"} size={15} color={mode === m ? ACCENT : "#8A8A8A"} />
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
              {m === "pomodoro" ? "Pomodoro" : "Stopwatch"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.middle}>
        <Pressable onPress={handleDialTap} style={{ width: size, height: size }} accessibilityRole="button" accessibilityLabel="Timer">
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {TICK_INDICES.map((i) => {
              const passed = totalElapsedTicks > i;
              const dist = passed ? totalElapsedTicks - i : SNAKE_LEN;
              const opacity = passed
                ? Math.min(1, 0.55 + 0.45 * Math.pow(Math.max(0, 1 - dist / SNAKE_LEN), 1.2))
                : 0.55;
              return (
                <Rect
                  key={i}
                  x={c - 1.5}
                  y={14}
                  width={3}
                  height={16}
                  rx={1.5}
                  fill={passed ? ACCENT : TICK}
                  opacity={opacity}
                  transform={`rotate(${i * 6} ${c} ${c})`}
                />
              );
            })}
          </Svg>
          <View style={styles.dialCenter} pointerEvents="none">
            <Text style={[styles.timer, { fontSize: size * 0.185 }]}>{fmtClock(left)}</Text>
            <Text style={styles.status}>{statusLabel}</Text>
          </View>
        </Pressable>

        <View style={styles.controls}>
          <Pressable style={styles.sideBtn} onPress={() => setMusicOn((v) => !v)} accessibilityRole="button" accessibilityLabel="Toggle ambient sound">
            <Ionicons name={musicOn ? "musical-notes" : "musical-notes-outline"} size={24} color="#B8B8B8" />
          </Pressable>

          <Pressable style={styles.mainBtn} onPress={running ? pausePomo : startPomo} accessibilityRole="button">
            <Ionicons
              name={running ? "pause" : "play"}
              size={34}
              color="#FFFFFF"
              style={{ marginLeft: running ? 0 : 4 }}
            />
          </Pressable>

          <Pressable style={styles.sideBtn} onPress={finishPomo} accessibilityRole="button" accessibilityLabel="Stop session">
            <Ionicons name="stop" size={26} color="#B8B8B8" />
          </Pressable>

          {/* Tiny tick-tick sound toggle button (Item 7) */}
          <Pressable
            style={[styles.tickBtn, tickOn && styles.tickBtnActive]}
            onPress={() => setTickOn((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle tick tick sound"
          >
            <Ionicons name="timer" size={14} color={tickOn ? ACCENT : "#666666"} />
            <Text style={[styles.tickBtnText, tickOn && styles.tickBtnTextActive]}>tick</Text>
          </Pressable>
        </View>

        <Text style={styles.todayText}>
          {todayFocus ? `Today · ${todayFocus} focused` : "No focus time yet today"}
        </Text>
      </View>

      <TimerSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  minimize: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginLeft: 8,
    gap: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  keepAwakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "#161616",
  },
  keepAwakeBtnActive: {
    borderColor: ACCENT,
    backgroundColor: "rgba(250,110,30,0.18)",
  },
  keepAwakeBtnText: {
    fontSize: 11,
    color: "#777777",
    fontWeight: "600",
  },
  keepAwakeBtnTextActive: {
    color: "#FFFFFF",
  },
  headerText: { color: "#FFFFFF", fontSize: 22, fontWeight: "500" },
  taskChip: {
    alignSelf: "center",
    maxWidth: "70%",
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  taskChipText: { color: "#D6D6D6", fontSize: 12, textAlign: "center" },
  modeRow: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#141414",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#262626",
    padding: 3,
    marginBottom: 10,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
  },
  modeChipActive: { backgroundColor: "rgba(250,110,30,0.14)" },
  modeText: { color: "#8A8A8A", fontSize: 13, fontWeight: "600" },
  modeTextActive: { color: ACCENT, fontWeight: "700" },
  middle: { flex: 1, alignItems: "center", justifyContent: "center" },
  dialCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  timer: { color: "#FFFFFF", fontWeight: "300", fontVariant: ["tabular-nums"], letterSpacing: 1 },
  status: { color: DIM, fontSize: 17, marginTop: 8 },
  todayText: { color: "#7A7A7A", fontSize: 13, fontWeight: "500", marginTop: 18 },
  controls: { flexDirection: "row", alignItems: "center", gap: 28, marginTop: 36 },
  sideBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  tickBtn: {
    position: "absolute",
    right: -28,
    bottom: -18,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "#161616",
  },
  tickBtnActive: {
    borderColor: ACCENT,
    backgroundColor: "rgba(250,110,30,0.15)",
  },
  tickBtnText: {
    fontSize: 10,
    color: "#666666",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tickBtnTextActive: {
    color: ACCENT,
  },
  mainBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
});
