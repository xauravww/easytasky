import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Markdown from "react-native-markdown-display";
import { aiEnabled, chatWithTools, getAiConfig } from "../lib/aiClient";
import { helpText, listAgents, parseInvocation, proposalsFromToolCalls } from "../lib/agents";
import type { BlockProposal } from "../lib/agents";
import { synthesizeSpeech } from "../lib/talk";
import { useAudioPlayer } from "expo-audio";
import CallModeModal from "../components/CallModeModal";
import { useStore } from "../store/useStore";
import { dayKey } from "../utils/time";
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
    { role: "assistant", content: "Hi, I'm your agent. Ask me to plan, draft tasks, or estimate. Or just chat." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [settings, setSettings] = useState(false);
  const [aiReady, setAiReady] = useState(aiEnabled());
  const [callOpen, setCallOpen] = useState(false);
  const [speechUrl, setSpeechUrl] = useState<string | null>(null);
  const player = useAudioPlayer(speechUrl ? { uri: speechUrl } : undefined);

  useEffect(() => {
    if (speechUrl && player) {
      try {
        player.replace({ uri: speechUrl });
        player.play();
      } catch {}
    }
  }, [speechUrl, player]);

  const maybeSpeak = async (content: string) => {
    try {
      const url = await synthesizeSpeech(content);
      setSpeechUrl(url);
    } catch {
      // silent — speech is optional
    }
  };

  // Show agent suggestions while typing "/" or "@".
  const invHint = input.startsWith("/") || input.startsWith("@") ? listAgents() : [];

  const buildContext = (): string => {
    const state = useStore.getState();
    const today = dayKey();
    const fmt24 = (min: number) => `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;
    const openTasks = state.tasks.filter((t) => t.status !== "done" && t.status !== "habit");
    const todayBlocks = state.blocks.filter((b) => b.day === today).sort((a, b) => a.start_min - b.start_min);
    const habits = state.tasks.filter((t) => t.is_habit === 1);
    const sections = state.sections;

    const parts: string[] = [];
    parts.push("This is the user's CURRENT ACTUAL data in EasyTasky. You have full access and direct control over all of it.");
    if (state.profile.trim()) {
      parts.push(`About the user (their own words):\n${state.profile.trim()}`);
    }
    if (sections.length) {
      parts.push(`Categories / Sections:\n${sections.map((s) => `- ${s.name}`).join("\n")}`);
    }
    if (openTasks.length) {
      const shown = openTasks.slice(0, 20).map((t) => `- [${t.status}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}${t.quadrant ? ` (${t.quadrant})` : ""}`);
      parts.push(`Open tasks:\n${shown.join("\n")}`);
    }
    if (habits.length) {
      const shownHabits = habits.map((h) => {
        const check = state.habitChecks.find((c) => c.habit_id === h.id && c.day === today);
        const val = check?.value ?? (check ? 1 : 0);
        return `- ${h.title} (type: ${h.habit_type || "boolean"}, today: ${val}/${h.habit_target_value || 1} ${h.habit_unit || "times"})`;
      });
      parts.push(`Habits:\n${shownHabits.join("\n")}`);
    }
    if (todayBlocks.length) {
      const shown = todayBlocks.map((b) => `- ${fmt24(b.start_min)}-${fmt24(b.end_min)} ${b.label} (${b.type})`);
      parts.push(`Today's time blocks:\n${shown.join("\n")}`);
    } else {
      parts.push("Today's time blocks: (none)");
    }
    const note = state.getDailyNote(today);
    if (note.trim()) {
      parts.push(`Today's note/journal:\n${note.trim()}`);
    }
    return parts.join("\n\n");
  };

  const executeProposals = async (proposals: BlockProposal[]): Promise<string> => {
    const state = useStore.getState();
    const applied: string[] = [];
    const fmt24 = (min: number) => `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;
    const today = dayKey();

    for (const p of proposals) {
      if (p.kind === "addBlock") {
        await state.addBlock(p.block);
        applied.push(`added time block "${p.block.label}" ${fmt24(p.block.start_min)}-${fmt24(p.block.end_min)}`);
      } else if (p.kind === "updateBlock") {
        const b = state.blocks.find((x) => x.id === p.id);
        await state.updateBlock(p.id, p.patch);
        applied.push(`updated time block "${b?.label ?? "#" + p.id}"`);
      } else if (p.kind === "deleteBlock") {
        const b = state.blocks.find((x) => x.id === p.id);
        await state.deleteBlock(p.id);
        applied.push(`removed time block "${b?.label ?? "#" + p.id}"`);
      } else if (p.kind === "createSection") {
        await state.addSection(p.name, p.color);
        applied.push(`created category "${p.name}"`);
      } else if (p.kind === "deleteSection") {
        const sec = state.sections.find((s) => s.name.toLowerCase() === p.name.toLowerCase());
        if (sec) {
          await state.deleteSection(sec.id);
          applied.push(`deleted category "${p.name}"`);
        }
      } else if (p.kind === "addTask") {
        let secId: string | undefined;
        if (p.task.section_name) {
          const sec = state.sections.find((s) => s.name.toLowerCase() === p.task.section_name?.toLowerCase());
          if (sec) secId = sec.id;
        }
        await state.addTask({
          title: p.task.title,
          context: p.task.context,
          energy: p.task.energy as any,
          quadrant: p.task.quadrant as any,
          due_date: p.task.due_date,
          estimated_min: p.task.estimated_min,
          note: p.task.note,
          section_id: secId,
        });
        applied.push(`created task "${p.task.title}"`);
      } else if (p.kind === "updateTask") {
        const t = state.tasks.find((x) => x.title.toLowerCase().includes(p.find.toLowerCase()));
        if (t) {
          await state.updateTask(t.id, p.patch as any);
          applied.push(`updated task "${t.title}"`);
        }
      } else if (p.kind === "deleteTask") {
        const t = state.tasks.find((x) => x.title.toLowerCase().includes(p.find.toLowerCase()));
        if (t) {
          await state.deleteTask(t.id);
          applied.push(`deleted task "${t.title}"`);
        }
      } else if (p.kind === "completeTask") {
        const t = state.tasks.find((x) => x.title.toLowerCase().includes(p.find.toLowerCase()));
        if (t) {
          await state.updateTask(t.id, { status: "done" });
          applied.push(`completed task "${t.title}"`);
        }
      } else if (p.kind === "addSubtask") {
        const t = state.tasks.find((x) => x.title.toLowerCase().includes(p.taskFind.toLowerCase()));
        if (t) {
          await state.addSubtask(t.id, p.title);
          applied.push(`added subtask "${p.title}" to "${t.title}"`);
        }
      } else if (p.kind === "toggleSubtask") {
        const st = state.subtasks.find((s) => s.title.toLowerCase().includes(p.subtaskTitle.toLowerCase()));
        if (st) {
          await state.toggleSubtask(st.id);
          applied.push(`toggled subtask "${st.title}"`);
        }
      } else if (p.kind === "addHabit") {
        const isQ = p.habit.habit_type === "quantity" || (p.habit.target_value ?? 1) > 1;
        await state.addTask({
          title: p.habit.title,
          status: "habit",
          is_habit: 1,
          habit_type: isQ ? "quantity" : "boolean",
          habit_target_value: p.habit.target_value ?? 1,
          habit_unit: p.habit.unit ?? (isQ ? "times" : undefined),
          habit_color: p.habit.color ?? "#FA6E1E",
          habit_freq: p.habit.freq ?? "daily",
        });
        applied.push(`created habit "${p.habit.title}"`);
      } else if (p.kind === "logHabit") {
        const h = state.tasks.find((x) => x.is_habit === 1 && x.title.toLowerCase().includes(p.find.toLowerCase()));
        if (h) {
          await state.logHabitValue(h.id, today, p.value);
          applied.push(`logged ${p.value} for habit "${h.title}"`);
        }
      } else if (p.kind === "saveDailyNote") {
        const noteDay = p.day || today;
        await state.saveDailyNote(noteDay, p.content);
        applied.push(`saved daily note for ${noteDay}`);
      } else if (p.kind === "updateUserProfile") {
        await state.setProfile(p.profile);
        applied.push(`updated your profile information`);
      }
    }

    if (!applied.length) {
      return "Haanji, ho gaya!";
    }
    if (applied.length === 1) {
      return `Ho gaya! ${applied[0]} kar diya.`;
    }
    return `Bilkul ho gaya! Ye sab nipta diya:\n${applied.map((a) => `• ${a}`).join("\n")}`;
  };

  const submit = async (text: string, base: Msg[]) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const inv = parseInvocation(trimmed);
    if (inv && inv.token === "help") {
      setMessages([...base, { role: "user", content: trimmed }, { role: "assistant", content: helpText() }]);
      setInput("");
      return;
    }
    if (inv) {
      setMessages([
        ...base,
        { role: "user", content: trimmed },
        { role: "assistant", content: `Unknown command "/${inv.token}". Only /help is a command — otherwise just ask the agent naturally.` },
      ]);
      setInput("");
      return;
    }

    const next: Msg[] = [...base, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setTyping(true);
    try {
      if (!aiEnabled()) {
        throw new Error("AI not configured. Tap the gear above to add your API settings.");
      }
      const reply = await chatWithTools(next, buildContext());
      if (reply.toolCalls && reply.toolCalls.length) {
        const { proposals, note } = proposalsFromToolCalls(reply.toolCalls, useStore.getState().blocks);
        if (proposals.length) {
          const appliedSummary = await executeProposals(proposals);
          const fullContent = `${appliedSummary}${note ? `\n\n${note}` : ""}`;
          setMessages((m) => [...m, { role: "assistant", content: fullContent }]);
          void maybeSpeak(fullContent);
        } else {
          const content = note ?? "I couldn't plan that change.";
          setMessages((m) => [...m, { role: "assistant", content }]);
          void maybeSpeak(content);
        }
      } else {
        const content = reply.text ?? "";
        setMessages((m) => [...m, { role: "assistant", content }]);
        void maybeSpeak(content);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Request failed"}` }]);
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };

  const send = () => submit(input, messages);

  const handleCallResult = useCallback(async (text: string): Promise<string> => {
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    try {
      const reply = await chatWithTools(next, buildContext());
      if (reply.toolCalls && reply.toolCalls.length) {
        const { proposals, note } = proposalsFromToolCalls(reply.toolCalls, useStore.getState().blocks);
        if (proposals.length) {
          const appliedSummary = await executeProposals(proposals);
          const content = `${appliedSummary}${note ? `\n\n${note}` : ""}`;
          setMessages((m) => [...m, { role: "assistant", content }]);
          return content;
        }
        const content = note ?? "I couldn't act on that.";
        setMessages((m) => [...m, { role: "assistant", content }]);
        return content;
      }
      const content = reply.text ?? "";
      setMessages((m) => [...m, { role: "assistant", content }]);
      return content;
    } catch (e) {
      const content = e instanceof Error ? e.message : "Request failed";
      setMessages((m) => [...m, { role: "assistant", content }]);
      return content;
    }
  }, [messages]);

  const handleCallClose = useCallback(() => {
    setCallOpen(false);
  }, []);

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
              setMessages([{ role: "assistant", content: "Hi, I'm your agent. Ask me to plan, draft tasks, or estimate. Or just chat." }]);
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
              <>
                <Markdown style={mdStyles}>{m.content}</Markdown>
                <View style={styles.msgActions}>
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
          style={styles.micBtn}
          onPress={() => setCallOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Start voice call"
        >
          <Ionicons name="call" size={20} color={ACCENT} />
        </Pressable>
        <Pressable style={[styles.sendBtn, busy && { opacity: 0.5 }]} onPress={send} disabled={busy} accessibilityRole="button" accessibilityLabel="Send">
          <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
      {callOpen && <CallModeModal onSend={handleCallResult} onClose={handleCallClose} />}
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
  talkBtnOn: { backgroundColor: ACCENT },
});
