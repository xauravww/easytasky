import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { aiEnabled, chatStream, getAiConfig } from "../lib/aiClient";
import { findAgent, listAgents, parseInvocation, runAgent } from "../lib/agents";
import { useStore } from "../store/useStore";
import SettingsModal from "../components/SettingsModal";

const BG = "#141414";
const BUBBLE_ME = "#FA6E1E";
const ACCENT = "#FA6E1E";
const BUBBLE_AI = "#1E1E1E";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";

type Msg = { role: "user" | "assistant"; content: string };

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

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi, I'm your agent. Ask me to plan, draft tasks, or estimate — or just chat." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [settings, setSettings] = useState(false);
  const [aiReady, setAiReady] = useState(aiEnabled());

  // Show agent suggestions while typing "/" or "@".
  const invHint = input.startsWith("/") || input.startsWith("@") ? listAgents() : [];

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const inv = parseInvocation(text);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setTyping(true);
    try {
      // Custom agent invocations (/agent or @agent) run locally, no API call.
      if (inv) {
        const def = findAgent(inv.token);
        if (def) {
          const tasks = useStore.getState().tasks;
          const blocks = useStore.getState().blocks;
          const reply = await runAgent(def, {
            tasks,
            blocks,
            addTask: useStore.getState().addTask,
            addBlock: useStore.getState().addBlock,
            query: inv.rest,
            history: next.slice(0, -1),
          });
          setMessages((m) => [...m, { role: "assistant", content: reply }]);
          return;
        }
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `No agent named "/${inv.token}". Available: ${listAgents().map((a) => `/${a.id}`).join(", ") || "none yet"}.`,
          },
        ]);
        return;
      }
      if (!aiEnabled()) {
        throw new Error("AI not configured — tap the gear above to add your API settings.");
      }
      let acc = "";
      await chatStream(next, (delta) => {
        acc += delta;
      });
      setMessages((m) => [...m, { role: "assistant", content: acc }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Request failed"}` }]);
    } finally {
      setBusy(false);
      setTyping(false);
    }
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
              setMessages([{ role: "assistant", content: "Hi, I'm your agent. Ask me to plan, draft tasks, or estimate — or just chat." }]);
              setTyping(false);
              setBusy(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear chat"
          >
            <Ionicons name="trash-outline" size={18} color={SUB} />
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
              <Markdown style={mdStyles}>{m.content}</Markdown>
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
        <Pressable style={[styles.sendBtn, busy && { opacity: 0.5 }]} onPress={send} disabled={busy} accessibilityRole="button" accessibilityLabel="Send">
          <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
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
});
