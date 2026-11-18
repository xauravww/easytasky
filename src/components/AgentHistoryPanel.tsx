import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AgentSession } from "../lib/agentHistory";

const BG = "#000000";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";

const fmtWhen = (ms: number): string => {
  const d = new Date(ms);
  const now = new Date();
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `Today · ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${time}`;
};

type Props = {
  sessions: AgentSession[];
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onResume?: (session: AgentSession) => Promise<void> | void;
  activeChatId?: string | null;
};

export default function AgentHistoryPanel({
  sessions,
  onClose,
  onRefresh,
  onDelete,
  onResume,
  activeChatId,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void onRefresh?.();
  }, [onRefresh]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  // With onResume (main chat screen) a tap reopens the conversation directly,
  // ChatGPT-style. Otherwise it opens the read-only transcript.
  const handleRowPress = async (session: AgentSession) => {
    if (onResume) {
      await onResume(session);
      onClose();
      return;
    }
    setSelectedId(session.id);
  };

  const deleteSelected = async () => {
    if (!selected) return;
    await onDelete?.(selected.id);
    setSelectedId(null);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        {selected ? (
          <Pressable
            style={styles.circleBtn}
            onPress={() => setSelectedId(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to history"
          >
            <Ionicons name="arrow-back" size={20} color={TEXT} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <Text style={styles.title}>{selected ? "Transcript" : "History"}</Text>
        <Pressable
          style={styles.circleBtn}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close history"
        >
          <Ionicons name="close" size={20} color={TEXT} />
        </Pressable>
      </View>

      {selected ? (
        <>
          <View style={styles.metaRow}>
            <View style={[styles.badge, selected.kind === "chat" ? styles.badgeChat : styles.badgeCall]}>
              <Ionicons
                name={selected.kind === "chat" ? "chatbubble-ellipses" : "call"}
                size={11}
                color={TEXT}
              />
              <Text style={styles.badgeText}>{selected.kind === "chat" ? "CHAT" : "CALL"}</Text>
            </View>
            <Text style={styles.metaText}>
              {fmtWhen(selected.started_at)} · {selected.entries.length} messages
            </Text>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {selected.entries.length ? (
              selected.entries.map((entry, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    entry.role === "user" ? styles.bubbleMe : styles.bubbleAi,
                  ]}
                >
                  <Text style={styles.role}>{entry.role === "user" ? "You" : "Agent"}</Text>
                  <Text style={styles.text}>{entry.content}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No transcript for this session.</Text>
            )}
          </ScrollView>
          {onResume ? (
            <Pressable
              style={styles.continueBtn}
              onPress={async () => {
                await onResume(selected);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Continue this chat"
            >
              <Ionicons name="arrow-forward-circle" size={18} color="#FFFFFF" />
              <Text style={styles.continueText}>Continue chat</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.deleteBtn}
            onPress={deleteSelected}
            accessibilityRole="button"
            accessibilityLabel="Delete this session"
          >
            <Ionicons name="trash-outline" size={16} color={TEXT} />
            <Text style={styles.deleteText}>Delete this session</Text>
          </Pressable>
        </>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sessions.length ? (
            sessions.map((session) => {
              const preview =
                session.title ||
                session.entries.find((e) => e.role === "user")?.content ||
                (session.kind === "call" ? "Voice call" : "Chat");
              const isActive = session.kind === "chat" && session.id === activeChatId && !session.ended_at;
              return (
                <Pressable
                  key={session.id}
                  style={styles.row}
                  onPress={() => handleRowPress(session)}
                  accessibilityRole="button"
                >
                  <View style={styles.rowIcon}>
                    <Ionicons
                      name={session.kind === "chat" ? "chatbubble-ellipses" : "call"}
                      size={16}
                      color={ACCENT}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.when}>{fmtWhen(session.started_at)}</Text>
                      {isActive ? <Text style={styles.activeTag}>ACTIVE</Text> : null}
                    </View>
                    <Text style={styles.preview} numberOfLines={2}>
                      {preview}
                    </Text>
                    <Text style={styles.count}>
                      {session.kind === "chat" ? "Chat" : "Call"} · {session.entries.length} messages
                    </Text>
                  </View>
                  <Pressable
                    style={styles.viewBtn}
                    onPress={() => setSelectedId(session.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="View transcript"
                  >
                    <Ionicons name="document-text-outline" size={18} color={SUB} />
                  </Pressable>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.empty}>
              Nothing here yet. Your chats and calls will appear in this history.
            </Text>
          )}
          <Text style={styles.pruneNote}>Old chats and calls are pruned automatically.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1C1C1C",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: SUB, fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeChat: { backgroundColor: "#1F3A2A" },
  badgeCall: { backgroundColor: "#3A2110" },
  badgeText: { color: TEXT, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  metaText: { color: SUB, fontSize: 12 },
  scroll: { flex: 1, width: "100%" },
  scrollContent: { paddingBottom: 24, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1C1C1C",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  when: { color: ACCENT, fontSize: 12, fontWeight: "700" },
  activeTag: {
    color: "#4ADE80",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    borderWidth: 1,
    borderColor: "#1F3A2A",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  preview: { color: TEXT, fontSize: 14, lineHeight: 19 },
  viewBtn: { padding: 6 },
  count: { color: SUB, fontSize: 11, marginTop: 4 },
  empty: { color: SUB, fontSize: 14, textAlign: "center", marginTop: 40, lineHeight: 20 },
  pruneNote: { color: "#6B6B6B", fontSize: 11, textAlign: "center", marginTop: 16 },
  bubble: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "92%" },
  bubbleMe: { alignSelf: "flex-end", backgroundColor: "#2A1608", borderWidth: 1, borderColor: "#5A2A0C" },
  bubbleAi: { alignSelf: "flex-start", backgroundColor: "#151515", borderWidth: 1, borderColor: "#262626" },
  role: { color: ACCENT, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 3 },
  text: { color: TEXT, fontSize: 14, lineHeight: 20 },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ACCENT,
  },
  continueText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#1C1C1C",
    borderWidth: 1,
    borderColor: "#3A1A1A",
  },
  deleteText: { color: TEXT, fontSize: 13, fontWeight: "600" },
});
