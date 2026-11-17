import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReviewScreen from "./ReviewScreen";
import TimeboxTool from "../components/TimeboxTool";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";

type Tool = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  render: () => React.ReactNode;
};

export default function ExtrasScreen() {
  const [tool, setTool] = useState<string | null>(null);

  const tools: Tool[] = [
    {
      id: "review",
      icon: "stats-chart-outline",
      title: "Review",
      desc: "Calendar, activity by hour, focus history",
      render: () => <ReviewScreen />,
    },
    {
      id: "timebox",
      icon: "time-outline",
      title: "Timeblocking",
      desc: "Plan your day into focused time blocks",
      render: () => <TimeboxTool />,
    },
  ];

  const active = tools.find((t) => t.id === tool);

  return (
    <View style={styles.root}>
      {active ? (
        <>
          <View style={styles.toolHeader}>
            <Pressable style={styles.backBtn} onPress={() => setTool(null)} accessibilityRole="button" accessibilityLabel="Back to extras">
              <Ionicons name="chevron-back" size={24} color={TEXT} />
            </Pressable>
            <Text style={styles.toolTitle}>{active.title}</Text>
            <View style={styles.backBtn} />
          </View>
          <View style={{ flex: 1 }}>{active.render()}</View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.h1}>Extras</Text>
          <Text style={styles.headerSub}>Tools & power-ups</Text>
          <View style={styles.grid}>
            {tools.map((t) => (
              <Pressable
                key={t.id}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                onPress={() => setTool(t.id)}
                accessibilityRole="button"
              >
                <View style={styles.cardIcon}>
                  <Ionicons name={t.icon as never} size={24} color={ACCENT} />
                </View>
                <Text style={styles.cardTitle}>{t.title}</Text>
                <Text style={styles.cardDesc}>{t.desc}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 30, fontWeight: "700", color: TEXT, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: SUB, marginTop: 2, marginBottom: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    gap: 10,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(250,110,30,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },
  cardDesc: { color: SUB, fontSize: 13, lineHeight: 18 },
  toolHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  toolTitle: { color: TEXT, fontSize: 18, fontWeight: "700" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
});
