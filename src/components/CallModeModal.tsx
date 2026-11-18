import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startVoice, stopVoice, synthesizeSpeech, prewarmTalkSession } from "../lib/talk";
import { prewarmAiSession } from "../lib/aiClient";
import type { AgentSession } from "../lib/agentHistory";
import AgentHistoryPanel from "./AgentHistoryPanel";
import { createAudioPlayer } from "expo-audio";

const BG = "#000000";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT_ORB = "#FA6E1E";
const RED = "#E5484D";

export type CallPhase = "listening" | "thinking" | "speaking" | "error";

export type CallModeModalHandle = {
  interrupt: () => void;
};

type Props = {
  onSend: (text: string) => Promise<string>;
  onClose: () => void;
  onMinimize?: () => void;
  minimized?: boolean;
  history?: AgentSession[];
  onRecordTurn?: (role: "user" | "assistant", content: string) => void;
  onRefreshHistory?: () => Promise<void> | void;
  onDeleteHistory?: (id: string) => Promise<void> | void;
  historyDisabled?: boolean;
  onPhaseChange?: (phase: CallPhase) => void;
  elapsedSeconds?: number;
};

const PHASE_LABELS: Record<CallPhase, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Connection issue",
};

const formatDuration = (seconds: number): string => {
  const min = Math.floor(seconds / 60);
  const sec = `${seconds % 60}`.padStart(2, "0");
  return `${min}:${sec}`;
};

const CallModeModal = React.forwardRef<CallModeModalHandle, Props>(function CallModeModal({
  onSend,
  onClose,
  onMinimize,
  minimized = false,
  history = [],
  onRecordTurn,
  onRefreshHistory,
  onDeleteHistory,
  historyDisabled = false,
  onPhaseChange,
  elapsedSeconds = 0,
}, ref) {
  const insets = useSafeAreaInsets();
  const [orb] = useState(() => new Animated.Value(0));
  const [phase, setPhase] = useState<CallPhase>("listening");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [live, setLive] = useState("");
  const [, setDiag] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const transcriptScrollRef = useRef<any>(null);
  const onSendRef = useRef(onSend);
  const onRecordTurnRef = useRef(onRecordTurn);
  const cancelledRef = useRef(false);
  const interruptRef = useRef<(() => void) | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  useEffect(() => {
    onRecordTurnRef.current = onRecordTurn;
  }, [onRecordTurn]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  const interruptSpeaking = () => {
    if (interruptRef.current) {
      interruptRef.current();
      interruptRef.current = null;
    }
    try {
      playerRef.current?.pause();
      playerRef.current?.release();
    } catch {}
    playerRef.current = null;
    setPhase("listening");
  };

  useImperativeHandle(ref, () => ({
    interrupt: () => {
      if (phase === "speaking") interruptSpeaking();
    },
  }));

  useEffect(() => {
    cancelledRef.current = false;
    // Pre-warm connections so the first response avoids cold handshake lag
    prewarmAiSession();
    prewarmTalkSession();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orb, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();

    const queue: string[] = [];
    let processing = false;
    let wake: (() => void) | null = null;

    const wakeLoop = () => {
      if (wake) wake();
    };

    const onUtterance = (text: string) => {
      interruptSpeaking();
      queue.push(text);
      wakeLoop();
      onRecordTurnRef.current?.("user", text);
    };

    const playAudioUrl = (url: string) =>
      new Promise<void>((resolve) => {
        let finished = false;
        const done = () => {
          if (!finished) {
            finished = true;
            resolve();
          }
        };

        interruptRef.current = done;

        try {
          const player = createAudioPlayer(url);
          playerRef.current = player;
          const timer = setTimeout(() => done(), 45000);
          player.addListener("playbackStatusUpdate", (s: { didJustFinish?: boolean }) => {
            if (s.didJustFinish) {
              clearTimeout(timer);
              done();
            }
          });
          player.play();
        } catch {
          done();
        }
      });

    const speak = async (reply: string) => {
      setPhase("speaking");
      try {
        const audioUrl = await synthesizeSpeech(reply);
        if (cancelledRef.current) return;
        await playAudioUrl(audioUrl);
      } catch (err: any) {
        if (!cancelledRef.current) {
          setError(err.message || "Failed to speak response");
        }
      } finally {
        try {
          playerRef.current?.release();
        } catch {}
        playerRef.current = null;
        interruptRef.current = null;
        if (!cancelledRef.current) {
          setPhase("listening");
        }
      }
    };

    const beginListening = () => {
      if (cancelledRef.current) return;
      startVoice({
        onStart: () => setDiag("recognizer started"),
        onEnd: () => {
          setDiag((d) => `${d} → ended`);
        },
        onPartial: (text) => {
          setDiag((d) => `${d} → partial`);
          setLive(text);
          if (processing) {
            interruptSpeaking();
          }
        },
        onResult: (text) => {
          setDiag((d) => `${d} → result: "${text.slice(0, 40)}"`);
          setLive("");
          onUtterance(text);
        },
        onError: (message) => {
          setDiag((d) => `${d} → error: ${message}`);
          // On idle timeout / no-speech, recover gracefully with a short breathing pause
          if (!cancelledRef.current && !processing) {
            setTimeout(() => {
              if (!cancelledRef.current && !processing) {
                beginListening();
              }
            }, 600);
          } else if (!processing) {
            setPhase("error");
            setError(message);
          }
        },
      }).catch((e: Error) => {
        setDiag((d) => `${d} → start FAILED: ${e.message}`);
        if (!cancelledRef.current && !processing) {
          setTimeout(() => {
            if (!cancelledRef.current && !processing) {
              beginListening();
            }
          }, 1000);
        } else if (!processing) {
          setPhase("error");
          setError(e.message);
        }
      });
    };

    beginListening();

    const worker = (async () => {
      while (!cancelledRef.current) {
        if (processing) {
          await new Promise<void>((r) => {
            wake = r;
          });
          continue;
        }
        const text = queue.shift();
        if (!text) {
          await new Promise<void>((r) => {
            wake = r;
          });
          continue;
        }
        processing = true;
        // Keep listening ready after speaking
        if (cancelledRef.current) break;
        setPhase("thinking");
        setError("");
        setTranscript((prev) => `${prev}\nYou: ${text.trim()}`);
        let reply = "";
        try {
          reply = await onSendRef.current(text.trim());
        } catch (e) {
          reply = e instanceof Error ? e.message : "Sorry, I couldn't respond.";
        }
        if (cancelledRef.current) break;
        setTranscript((prev) => `${prev}\nAgent: ${reply}`);
        onRecordTurnRef.current?.("assistant", reply);
        await speak(reply);
        processing = false;
        if (!cancelledRef.current) {
          beginListening();
        }
      }
    })();
    void worker;

    return () => {
      cancelledRef.current = true;
      if (wake) wake();
      loop.stop();
      interruptSpeaking();
      stopVoice().catch(() => {});
    };
  }, [orb]);

  const scale = orb.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] });
  const opacity = orb.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });

  const phaseColor = phase === "error" ? RED : phase === "thinking" ? "#D6D6D6" : ACCENT_ORB;

  return (
    <Modal
      visible={!minimized}
      animationType="fade"
      statusBarTranslucent
      transparent
      onRequestClose={() => (historyOpen ? setHistoryOpen(false) : onClose())}
    >
      {historyOpen ? (
        <AgentHistoryPanel
          sessions={history}
          onClose={() => setHistoryOpen(false)}
          onRefresh={onRefreshHistory}
          onDelete={onDeleteHistory}
          disabled={historyDisabled}
        />
      ) : (
        <View
          style={[
            styles.root,
            { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.topHeader}>
            {onMinimize ? (
              <Pressable
                style={({ pressed }) => [styles.headerButton, pressed && styles.controlPressed]}
                onPress={onMinimize}
                accessibilityRole="button"
                accessibilityLabel="Minimize call"
              >
                <Ionicons name="remove" size={28} color={TEXT} />
              </Pressable>
            ) : (
              <View style={styles.headerButton} />
            )}

            <View style={styles.callIdentity} pointerEvents="none">
              <Text style={styles.callerName}>Agent</Text>
              <Text style={styles.callDuration}>{formatDuration(elapsedSeconds)}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.headerButton, pressed && styles.controlPressed]}
              onPress={() => setHistoryOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Conversation history"
            >
              <Ionicons name="time-outline" size={22} color={TEXT} />
            </Pressable>
          </View>

          <View style={styles.callBody}>
            <View style={styles.callStage}>
              <View style={styles.orbArea} accessibilityLabel={PHASE_LABELS[phase]}>
                <Animated.View
                  style={[
                    styles.orbHaloOuter,
                    { borderColor: phaseColor, transform: [{ scale }], opacity },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.orbHalo,
                    { backgroundColor: phaseColor, transform: [{ scale }], opacity },
                  ]}
                />
                <View style={[styles.orbCore, { backgroundColor: phaseColor, shadowColor: phaseColor }]}>
                  {phase === "error" ? (
                    <Ionicons name="alert-circle" size={46} color={BG} />
                  ) : phase === "speaking" ? (
                    <Ionicons name="volume-high" size={46} color={BG} />
                  ) : phase === "thinking" ? (
                    <Ionicons name="ellipsis-horizontal" size={46} color={BG} />
                  ) : (
                    <Ionicons name="mic" size={46} color={BG} />
                  )}
                </View>
              </View>

              <View style={styles.phaseRow}>
                <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
                <Text style={styles.phaseText}>{PHASE_LABELS[phase]}</Text>
              </View>
              {error ? (
                <Text style={styles.error} numberOfLines={2}>
                  {error}
                </Text>
              ) : null}
            </View>

            {live || transcript.trim() ? (
              <View style={styles.transcriptBox}>
                {live ? (
                  <View style={styles.liveHeader}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveLabel}>You</Text>
                  </View>
                ) : null}
                <ScrollView
                  ref={transcriptScrollRef}
                  style={styles.transcriptScroll}
                  contentContainerStyle={styles.transcriptScrollContent}
                  onContentSizeChange={() => {
                    transcriptScrollRef.current?.scrollToEnd({ animated: true });
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.transcript}>{live || transcript.trim()}</Text>
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.bottomControls}>
            <View style={styles.controlGroup}>
              <Pressable
                style={({ pressed }) => [
                  styles.callControl,
                  phase === "speaking" && styles.interruptControlActive,
                  phase !== "speaking" && styles.controlDisabled,
                  pressed && phase === "speaking" && styles.controlPressed,
                ]}
                onPress={interruptSpeaking}
                disabled={phase !== "speaking"}
                accessibilityRole="button"
                accessibilityLabel="Interrupt Agent"
                accessibilityState={{ disabled: phase !== "speaking" }}
              >
                <Ionicons
                  name="hand-right"
                  size={25}
                  color={phase === "speaking" ? ACCENT_ORB : "#666666"}
                />
              </Pressable>
              <Text style={[styles.controlLabel, phase !== "speaking" && styles.controlLabelDisabled]}>
                Interrupt
              </Text>
            </View>

            <View style={styles.controlGroup}>
              <Pressable
                style={({ pressed }) => [styles.endCall, pressed && styles.endCallPressed]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="End call"
              >
                <Ionicons
                  name="call"
                  size={28}
                  color={TEXT}
                  style={{ transform: [{ rotate: "135deg" }] }}
                />
              </Pressable>
              <Text style={styles.controlLabel}>End</Text>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
});

export default CallModeModal;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#060606",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  topHeader: {
    width: "100%",
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#282828",
    alignItems: "center",
    justifyContent: "center",
  },
  callIdentity: { minWidth: 120, alignItems: "center", justifyContent: "center" },
  callerName: { color: TEXT, fontSize: 17, lineHeight: 21, fontWeight: "700" },
  callDuration: {
    color: SUB,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  callBody: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  callStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  orbArea: { alignItems: "center", justifyContent: "center", width: 216, height: 216 },
  orbHaloOuter: {
    position: "absolute",
    width: 202,
    height: 202,
    borderRadius: 101,
    borderWidth: 2,
  },
  orbHalo: { position: "absolute", width: 172, height: 172, borderRadius: 86 },
  orbCore: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.32,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  phaseDot: { width: 7, height: 7, borderRadius: 4 },
  phaseText: { color: TEXT, fontSize: 17, lineHeight: 22, fontWeight: "600" },
  error: { color: "#FF8D90", fontSize: 13, textAlign: "center", marginTop: 10, paddingHorizontal: 16 },
  transcriptBox: {
    width: "100%",
    minHeight: 88,
    maxHeight: 172,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    overflow: "hidden",
  },
  liveHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT_ORB },
  transcriptScroll: { maxHeight: 124 },
  transcriptScrollContent: { flexGrow: 1, justifyContent: "flex-end" },
  liveLabel: { color: ACCENT_ORB, fontSize: 12, fontWeight: "700" },
  transcript: { color: "#E8E8E8", fontSize: 14, lineHeight: 21 },
  bottomControls: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 34,
    paddingTop: 12,
    paddingBottom: 4,
  },
  controlGroup: { alignItems: "center", gap: 8, minWidth: 74 },
  callControl: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  interruptControlActive: { backgroundColor: "#24150D", borderColor: "#753510" },
  controlDisabled: { opacity: 0.7 },
  controlPressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
  controlLabel: { color: "#D8D8D8", fontSize: 12, lineHeight: 16, fontWeight: "600" },
  controlLabelDisabled: { color: "#686868" },
  endCall: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: RED,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  endCallPressed: { opacity: 0.8, transform: [{ scale: 0.94 }] },
});
