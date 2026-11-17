import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startVoice, stopVoice, synthesizeSpeech, prewarmTalkSession } from "../lib/talk";
import { prewarmAiSession } from "../lib/aiClient";
import { createAudioPlayer } from "expo-audio";

const BG = "#000000";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT_ORB = "#FA6E1E";
const RED = "#E5484D";

type Props = {
  onSend: (text: string) => Promise<string>;
  onClose: () => void;
};

export default function CallModeModal({ onSend, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [orb] = useState(() => new Animated.Value(0));
  const [status, setStatus] = useState("Listening…");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [live, setLive] = useState("");
  const [diag, setDiag] = useState("");
  const onSendRef = useRef(onSend);
  const cancelledRef = useRef(false);
  const interruptRef = useRef<(() => void) | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

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
    setStatus("Listening…");
  };

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
      setStatus("Speaking…");
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
          setStatus("Listening…");
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
            setStatus("Error");
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
          setStatus("Error");
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
        setStatus("Thinking…");
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

  const scale = orb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const opacity = orb.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Modal visible animationType="fade" statusBarTranslucent transparent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.title}>Agent call</Text>

        <Pressable
          style={styles.orbArea}
          onPress={() => {
            if (status === "Speaking…") {
              interruptSpeaking();
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={status === "Speaking…" ? "Tap to interrupt speaking" : "Microphone active"}
        >
          <Animated.View style={[styles.orbHalo, { transform: [{ scale }], opacity }]} />
          <View style={styles.orbCore}>
            {status === "Error" ? (
              <Ionicons name="alert-circle" size={48} color={RED} />
            ) : status === "Speaking…" ? (
              <Ionicons name="volume-high" size={48} color={BG} />
            ) : (
              <Ionicons name="mic" size={48} color={BG} />
            )}
          </View>
        </Pressable>

        <Text style={styles.status}>{status}</Text>
        {status === "Speaking…" ? (
          <Pressable style={styles.tapInterruptBtn} onPress={interruptSpeaking} accessibilityRole="button">
            <Ionicons name="hand-right" size={16} color={ACCENT_ORB} style={{ marginRight: 6 }} />
            <Text style={styles.tapInterruptText}>Tap anywhere to interrupt</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {diag ? <Text style={styles.diag}>{diag}</Text> : null}

        <View style={styles.transcriptBox}>
          {live ? (
            <Text style={styles.liveLabel}>You (live):</Text>
          ) : null}
          <Text style={styles.transcript}>
            {live ? live : transcript || "The call is live. Say something."}
          </Text>
        </View>

        <Pressable style={styles.endCall} onPress={onClose} accessibilityRole="button" accessibilityLabel="End call">
          <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "space-between", padding: 24 },
  title: { color: SUB, fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  orbArea: { alignItems: "center", justifyContent: "center", width: 220, height: 220 },
  orbHalo: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(250,110,30,0.25)" },
  orbCore: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: ACCENT_ORB,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT_ORB,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  status: { color: TEXT, fontSize: 22, fontWeight: "700" },
  tapInterruptBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(250,110,30,0.15)",
    borderWidth: 1,
    borderColor: "rgba(250,110,30,0.4)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
  },
  tapInterruptText: { color: ACCENT_ORB, fontSize: 13, fontWeight: "600" },
  error: { color: RED, fontSize: 14, textAlign: "center", marginTop: 8, paddingHorizontal: 16 },
  diag: { color: SUB, fontSize: 11, textAlign: "center", marginTop: 6, paddingHorizontal: 16 },
  transcriptBox: { alignSelf: "stretch", backgroundColor: "#111111", borderRadius: 16, padding: 16, minHeight: 130, maxHeight: 220, justifyContent: "flex-start" },
  liveLabel: { color: ACCENT_ORB, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  transcript: { color: TEXT, fontSize: 14, lineHeight: 21 },
  endCall: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: RED,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
});
