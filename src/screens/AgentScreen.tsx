import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Markdown from "react-native-markdown-display";
import { aiEnabled, getAiConfig } from "../lib/aiClient";
import { helpText, listAgents, parseInvocation } from "../lib/agents";
import { synthesizeSpeech } from "../lib/talk";
import type { AgentMessage } from "../lib/agentActions";
import { createAudioPlayer } from "expo-audio";
import { useAgentStore } from "../store/useAgentStore";
import SettingsModal from "../components/SettingsModal";
import AgentHistoryPanel from "../components/AgentHistoryPanel";

const BG = "#141414";
const BUBBLE_ME = "#FA6E1E";
const ACCENT = "#FA6E1E";
const BUBBLE_AI = "#1E1E1E";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";

const PHASES: [number, number, number][] = [
  [0, 0.33, 0.66],
  [0.33, 0.66, 1],
  [0.66, 1, 1.33],
];

function TypingIndicator() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={[styles.bubble, styles.bubbleAi, styles.typing]}>
      {PHASES.map((phase, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: anim.interpolate({ inputRange: phase, outputRange: [0.25, 1, 0.25], extrapolate: "clamp" }),
              transform: [
                {
                  translateY: anim.interpolate({ inputRange: phase, outputRange: [0, -4, 0], extrapolate: "clamp" }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function AgentScreen() {
  const listRef = useRef<any>(null);
  const [keyboardH, setKeyboardH] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const messages = useAgentStore((s) => s.messages);
  const busy = useAgentStore((s) => s.busy);
  const typing = useAgentStore((s) => s.typing);
  const sendMessage = useAgentStore((s) => s.send);
  const appendLocal = useAgentStore((s) => s.appendLocal);
  const clearChat = useAgentStore((s) => s.clearChat);
  const sessions = useAgentStore((s) => s.sessions);
  const chatSessionId = useAgentStore((s) => s.chatSessionId);
  const refreshHistory = useAgentStore((s) => s.refreshHistory);
  const deleteSession = useAgentStore((s) => s.deleteSession);
  const resumeSession = useAgentStore((s) => s.resumeSession);
  const callOpen = useAgentStore((s) => s.callOpen);
  const callMinimized = useAgentStore((s) => s.callMinimized);
  const startCall = useAgentStore((s) => s.startCall);
  const restoreCall = useAgentStore((s) => s.restoreCall);

  const [input, setInput] = useState("");
  const [settings, setSettings] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiReady, setAiReady] = useState(aiEnabled());
  const [playingMsgIndex, setPlayingMsgIndex] = useState<number | null>(null);
  const [speakingLoadingIndex, setSpeakingLoadingIndex] = useState<number | null>(null);
  const activePlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const stopActiveAudio = () => {
    if (activePlayerRef.current) {
      try {
        activePlayerRef.current.pause();
        activePlayerRef.current.release();
      } catch {}
      activePlayerRef.current = null;
    }
    setPlayingMsgIndex(null);
    setSpeakingLoadingIndex(null);
  };

  useEffect(() => {
    return () => {
      stopActiveAudio();
    };
  }, []);

  const toggleSpeakMessage = async (index: number, content: string) => {
    // If currently playing the same message, stop it
    if (playingMsgIndex === index) {
      stopActiveAudio();
      return;
    }

    // Stop any previously playing message immediately to avoid voice collision
    stopActiveAudio();

    setSpeakingLoadingIndex(index);
    try {
      const url = await synthesizeSpeech(content);
      if (!url) {
        setSpeakingLoadingIndex(null);
        return;
      }

      const player = createAudioPlayer(url);
      activePlayerRef.current = player;
      setSpeakingLoadingIndex(null);
      setPlayingMsgIndex(index);

      player.addListener("playbackStatusUpdate", (status: { didJustFinish?: boolean }) => {
        if (status.didJustFinish) {
          try {
            player.release();
          } catch {}
          if (activePlayerRef.current === player) {
            activePlayerRef.current = null;
            setPlayingMsgIndex(null);
          }
        }
      });
      player.play();
    } catch {
      stopActiveAudio();
    }
  };

  // Show agent suggestions while typing "/" or "@".
  const invHint = input.startsWith("/") || input.startsWith("@") ? listAgents() : [];

  const submit = async (text: string, base?: AgentMessage[]) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const inv = parseInvocation(trimmed);
    if (inv && inv.token === "help") {
      appendLocal(trimmed, helpText(), base);
      setInput("");
      return;
    }
    if (inv) {
      appendLocal(
        trimmed,
        `Unknown command "/${inv.token}". Only /help is a command — otherwise just ask the agent naturally.`,
        base
      );
      setInput("");
      return;
    }

    setInput("");
    await sendMessage(trimmed, base);
  };

  const send = () => submit(input, messages);

  const copyMessage = async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
    } catch {}
  };

  // Retry: drop everything after the user prompt that produced this assistant reply
  // and re-submit that prompt.
  const retry = (idx: number) => {
    let userIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") { userIdx = i; break; }
    }
    if (userIdx === -1) return;
    const text = messages[userIdx].content;
    const base = messages.slice(0, userIdx);
    submit(text, base);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Agent</Text>
          <Text style={styles.headerSub}>{aiReady ? getAiConfig().model : "not configured"}</Text>
        </View>
        <Pressable
          style={styles.clearBtn}
          onPress={() => setHistoryOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Chat and call history"
        >
          <Ionicons name="menu" size={20} color={SUB} />
        </Pressable>
        <Pressable
          style={styles.clearBtn}
          onPress={() => setSettings(true)}
          accessibilityRole="button"
          accessibilityLabel="AI settings"
        >
          <Ionicons name="settings-outline" size={18} color={SUB} />
        </Pressable>
        {messages.length > 1 && (
          <Pressable
            style={styles.clearBtn}
            onPress={() => {
              void clearChat();
            }}
            accessibilityRole="button"
            accessibilityLabel="New chat"
          >
            <Ionicons name="add" size={22} color={SUB} />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ref={listRef}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View
            key={i}
            style={[styles.bubble, m.role === "user" ? styles.bubbleMe : styles.bubbleAi]}
          >
            {m.role === "user" ? (
              <Text style={styles.textMe}>{m.content}</Text>
            ) : (
              <>
                <Markdown style={mdStyles}>{m.content}</Markdown>
                <View style={styles.msgActions}>
                  <Pressable
                    style={styles.msgAction}
                    onPress={() => toggleSpeakMessage(i, m.content)}
                    accessibilityRole="button"
                    accessibilityLabel={playingMsgIndex === i ? "Stop speaking" : "Speak message"}
                  >
                    {speakingLoadingIndex === i ? (
                      <ActivityIndicator size={12} color={ACCENT} />
                    ) : (
                      <Ionicons
                        name={playingMsgIndex === i ? "stop-circle" : "volume-high-outline"}
                        size={15}
                        color={playingMsgIndex === i ? ACCENT : SUB}
                      />
                    )}
                    <Text
                      style={[
                        styles.msgActionText,
                        playingMsgIndex === i && { color: ACCENT, fontWeight: "700" },
                      ]}
                    >
                      {playingMsgIndex === i ? "Stop" : "Speak"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.msgAction} onPress={() => copyMessage(m.content)} accessibilityRole="button" accessibilityLabel="Copy message">
                    <Ionicons name="copy-outline" size={14} color={SUB} />
                    <Text style={styles.msgActionText}>Copy</Text>
                  </Pressable>
                  {i !== 0 && (
                    <Pressable style={styles.msgAction} onPress={() => retry(i)} disabled={busy} accessibilityRole="button" accessibilityLabel="Retry">
                      <Ionicons name="refresh" size={14} color={SUB} />
                      <Text style={styles.msgActionText}>Retry</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>
        ))}
        {typing && <TypingIndicator />}
      </ScrollView>

      {settings && <SettingsModal onClose={() => setSettings(false)} onSaved={() => setAiReady(aiEnabled())} />}
      {invHint.length > 0 && (
        <View style={styles.agentHint}>
          <Text style={styles.agentHintTitle}>Agents</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {invHint.map((a) => (
              <Pressable
                key={a.id}
                style={styles.agentChip}
                onPress={() => setInput((v) => (v.endsWith("/") || v.endsWith("@") ? v + a.id : v))}
                accessibilityRole="button"
              >
                <Text style={styles.agentChipText}>/{a.id}</Text>
                <Text style={styles.agentChipDesc}> · {a.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={[styles.inputRow, { paddingBottom: Math.max(keyboardH - 56, 8) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message the AI…"
          placeholderTextColor={SUB}
          style={styles.input}
          multiline
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <Pressable
          style={[styles.micBtn, (callOpen && callMinimized) && styles.micBtnActive]}
          onPress={() => {
            if (callOpen && callMinimized) {
              restoreCall();
            } else {
              void startCall();
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Start voice call"
        >
          <Ionicons name="call" size={20} color={(callOpen && callMinimized) ? "#FFFFFF" : ACCENT} />
        </Pressable>
        <Pressable style={[styles.sendBtn, busy && { opacity: 0.5 }]} onPress={send} disabled={busy} accessibilityRole="button" accessibilityLabel="Send">
          <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <Modal
        visible={historyOpen}
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <AgentHistoryPanel
          sessions={sessions}
          activeChatId={chatSessionId}
          onClose={() => setHistoryOpen(false)}
          onRefresh={refreshHistory}
          onDelete={deleteSession}
          onResume={(session) => resumeSession(session.id)}
        />
      </Modal>
    </View>
  );
}

const mdStyles = {
  body: { color: TEXT, fontSize: 15, lineHeight: 22 },
  heading1: { color: TEXT, fontSize: 20, fontWeight: "700", marginVertical: 6 },
  heading2: { color: TEXT, fontSize: 18, fontWeight: "700", marginVertical: 6 },
  heading3: { color: TEXT, fontSize: 16, fontWeight: "700", marginVertical: 4 },
  paragraph: { marginVertical: 4 },
  strong: { color: TEXT, fontWeight: "700" },
  em: { fontStyle: "italic" },
  s: { textDecorationLine: "line-through" },
  link: { color: BUBBLE_ME },
  code_inline: { backgroundColor: "#000000", color: "#F8F8F2", fontFamily: "monospace", paddingHorizontal: 4, borderRadius: 4 },
  code_block: { backgroundColor: "#000000", color: "#F8F8F2", fontFamily: "monospace", padding: 12, borderRadius: 8, marginVertical: 6 },
  fence: { backgroundColor: "#000000", padding: 12, borderRadius: 8, marginVertical: 6 },
  blockquote: { backgroundColor: "#1A1A1A", borderLeftWidth: 3, borderLeftColor: BUBBLE_ME, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 4 },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { flexDirection: "row", alignItems: "flex-start", marginVertical: 2 },
  hr: { backgroundColor: LINE, height: 1, marginVertical: 8 },
  table: { borderWidth: 1, borderColor: LINE },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  h1: { color: TEXT, fontSize: 26, fontWeight: "600" },
  headerSub: { color: SUB, fontSize: 12, marginTop: 2 },
  clearBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: LINE },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 8 },
  bubble: { maxWidth: "82%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  bubbleMe: { alignSelf: "flex-end", backgroundColor: BUBBLE_ME, borderTopRightRadius: 4 },
  bubbleAi: { alignSelf: "flex-start", backgroundColor: BUBBLE_AI, borderWidth: 1, borderColor: LINE, borderTopLeftRadius: 4 },
  typing: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 14 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SUB },
  textMe: { color: "#FFFFFF", fontSize: 15 },
  textAi: { color: TEXT, fontSize: 15 },
  msgActions: { flexDirection: "row", gap: 16, marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  msgAction: { flexDirection: "row", alignItems: "center", gap: 5 },
  msgActionText: { color: SUB, fontSize: 12, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  agentHint: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  agentHintTitle: { color: SUB, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  agentChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  agentChipText: { color: ACCENT, fontSize: 13, fontWeight: "700" },
  agentChipDesc: { color: SUB, fontSize: 13 },
  input: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 20,
    color: TEXT,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: BUBBLE_ME, alignItems: "center", justifyContent: "center" },
  micBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: ACCENT, alignItems: "center", justifyContent: "center" },
  micBtnActive: { backgroundColor: ACCENT },
  talkBtnOn: { backgroundColor: ACCENT },
});
