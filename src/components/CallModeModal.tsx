import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startVoice, stopVoice, synthesizeSpeechStream } from "../lib/talk";
import { createAudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";

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
  const onSendRef = useRef(onSend);
  const cancelledRef = useRef(false);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  // Run the bidirectional loop until the call ends.
  useEffect(() => {
    cancelledRef.current = false;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orb, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();

    const LISTEN_MS = 9000;
    const TIMEOUT_MS = 3000;

    // Native recognition: stream partial words live, then finalize on result.
    const listenOnce = () =>
      new Promise<string>((resolve, reject) => {
        let settled = false;
        const finish = (text: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          setLive("");
          resolve(text);
        };
        const fail = (message: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          setLive("");
          reject(new Error(message));
        };
        const timer = setTimeout(() => fail("No speech recognized"), LISTEN_MS);
        startVoice({
          onPartial: (text) => setLive(text),
          onResult: (text) => finish(text),
          onError: (message) => fail(message),
        }).catch((e: Error) => fail(e.message));
        // Safety: also stop after the window even if result never arrives.
        setTimeout(() => {
          if (!settled) stopVoice().catch(() => {});
        }, LISTEN_MS + TIMEOUT_MS);
      });

    const playBytes = (bytes: Uint8Array) =>
      new Promise<void>(async (resolve) => {
        const file = new File(Paths.cache, `speech-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
        try {
          const writer = file.writableStream().getWriter();
          await writer.write(bytes);
          await writer.close();
        } catch {}
        const player = createAudioPlayer(file.uri);
        playerRef.current = player;
        const timer = setTimeout(() => resolve(), 30000);
        player.addListener("playbackStatusUpdate", (s: { didJustFinish?: boolean }) => {
          if (s.didJustFinish) {
            clearTimeout(timer);
            resolve();
          }
        });
        player.play();
      });

    const speak = async (reply: string) => {
      setStatus("Speaking…");
      for await (const chunk of synthesizeSpeechStream(reply)) {
        if (cancelledRef.current) return;
        await playBytes(chunk);
      }
      try {
        playerRef.current?.release();
      } catch {}
      playerRef.current = null;
    };

    const turn = async (): Promise<boolean> => {
      if (cancelledRef.current) return false;
      setStatus("Listening…");
      setError("");
      let text = "";
      try {
        text = await listenOnce();
      } catch (e) {
        if (cancelledRef.current) return false;
        setStatus("Error");
        setError(e instanceof Error ? e.message : "Speech not recognized");
        return false;
      }
      if (cancelledRef.current || !text.trim()) return !cancelledRef.current;
      setTranscript((prev) => `${prev}\nYou: ${text.trim()}`);
      let reply = "";
      try {
        reply = await onSendRef.current(text.trim());
      } catch (e) {
        if (cancelledRef.current) return false;
        reply = e instanceof Error ? e.message : "Sorry, I couldn't respond.";
      }
      if (cancelledRef.current) return false;
      setTranscript((prev) => `${prev}\nAgent: ${reply}`);
      try {
        await speak(reply);
      } catch (e) {
        if (cancelledRef.current) return false;
        setStatus("Error");
        setError(e instanceof Error ? e.message : "Could not speak reply");
        return false;
      }
      return !cancelledRef.current;
    };

    (async () => {
      while (!cancelledRef.current) {
        const again = await turn();
        if (!again) break;
      }
    })();

    return () => {
      cancelledRef.current = true;
      loop.stop();
      stopVoice().catch(() => {});
      try {
        playerRef.current?.release();
      } catch {}
    };
  }, [orb]);

  const scale = orb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const opacity = orb.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Modal visible animationType="fade" statusBarTranslucent transparent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.title}>Agent call</Text>

        <View style={styles.orbArea}>
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
        </View>

        <Text style={styles.status}>{status}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

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
  error: { color: RED, fontSize: 14, textAlign: "center", marginTop: 8, paddingHorizontal: 16 },
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
