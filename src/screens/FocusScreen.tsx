import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store/useStore";
import TimerSheet from "../components/TimerSheet";

const BG = "#000000";
const TICK = "#2C2C2C";
const ACCENT = "#FA6E1E";
const DIM = "#9C9C9C";

const TICK_COUNT = 60;
const SNAKE_LEN = 11; // lit band length (visual-only, does not affect time)
const TICK_INDICES = Array.from({ length: TICK_COUNT }, (_, i) => i);

const fmtClock = (s: number) =>
  `${`${Math.floor(s / 60)}`.padStart(2, "0")} : ${`${s % 60}`.padStart(2, "0")}`;

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
  const startPomo = useStore((s) => s.startPomo);
  const pausePomo = useStore((s) => s.pausePomo);
  const finishPomo = useStore((s) => s.finishPomo);
  const selectedTask = tasks.find((t) => t.id === pomo.taskId);

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
  const [sheet, setSheet] = useState(false);

  const noise = useAudioPlayer(require("../../assets/rain.mp3"));

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

  const { running, phase, left, totalSec } = pomo;
  const inBreak = phase === "break";

  // The snake rotates one full lap per minute (60 ticks / 60s), independent of the
  // session length. Seconds remain accurate (stored/engine-driven).
  const elapsedInSession = Math.max(0, totalSec - left);
  const secondOfMinute = elapsedInSession % 60;
  const totalElapsedTicks = (secondOfMinute / 60) * TICK_COUNT;

  const { width: winW } = useWindowDimensions();
  const size = Math.min(winW - 84, 276);
  const c = size / 2;
  const statusLabel = inBreak ? "Break" : running ? "Focusing" : elapsedInSession > 0 ? "Paused" : "Ready";

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
        <Pressable style={styles.minimize} onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel="Focus settings">
          <Ionicons name="settings-outline" size={22} color="#D6D6D6" />
        </Pressable>
      </View>

      {selectedTask && (
        <View style={styles.taskChip}>
          <Text style={styles.taskChipText} numberOfLines={1} ellipsizeMode="tail">
            {selectedTask.title}
          </Text>
        </View>
      )}

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
          <Pressable style={styles.sideBtn} onPress={() => setMusicOn((v) => !v)} accessibilityRole="button">
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

          <Pressable style={styles.sideBtn} onPress={finishPomo} accessibilityRole="button">
            <Ionicons name="stop" size={26} color="#B8B8B8" />
          </Pressable>
        </View>
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
    justifyContent: "center",
    gap: 4,
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
  mainBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
});
