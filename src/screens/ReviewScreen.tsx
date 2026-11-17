import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { useStore } from "../store/useStore";
import MonthCalendar from "../components/MonthCalendar";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const BAR = "#3A3A3A";

const fmtHour = (h: number) => {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? "a" : "p"}`;
};

export default function ReviewScreen() {
  const logs = useStore((s) => s.logs);
  const tasks = useStore((s) => s.tasks);
  const pomos = useStore((s) => s.pomos);
  const { width: winW } = useWindowDimensions();
  const plotW = Math.min(winW - 32 - 38, 380);
  const plotH = 110;

  const hist = useMemo(() => {
    const h = new Array(24).fill(0);
    for (const l of logs) h[new Date(l.at).getHours()] += l.minutes || 0;
    return h;
  }, [logs]);

  const max = Math.max(1, ...hist);
  const peakHour = hist.indexOf(Math.max(...hist));
  const peakMin = hist[peakHour];

  const barW = (plotW - 6) / 24;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <MonthCalendar tasks={tasks} pomos={pomos} />

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>Activity by hour</Text>
          </View>

          <Svg width={plotW} height={plotH + 14}>
            {hist.map((val, h) => {
              const bh = Math.max(2, (val / max) * (plotH - 8));
              const x = 3 + h * barW;
              return (
                <Rect
                  key={h}
                  x={x}
                  y={plotH - bh}
                  width={Math.max(2, barW - 2)}
                  height={bh}
                  rx={2}
                  fill={h === peakHour ? ACCENT : BAR}
                />
              );
            })}
            <Line x1={0} y1={plotH + 0.5} x2={plotW} y2={plotH + 0.5} stroke={LINE} strokeWidth={1} />
          </Svg>

          <View style={styles.axis}>
            {[0, 6, 12, 18, 23].map((h) => (
              <Text key={h} style={styles.axisLabel}>{fmtHour(h)}</Text>
            ))}
          </View>

          <View style={styles.peakBox}>
            <Text style={styles.peakLabel}>PEAK</Text>
            <Text style={styles.peakHour}>{fmtHour(peakHour)}</Text>
            <Text style={styles.peakMin}>{peakMin}m</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  card: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 16 },
  cardTop: { marginBottom: 12 },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingHorizontal: 2 },
  axisLabel: { color: SUB, fontSize: 11 },
  peakBox: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 14 },
  peakLabel: { color: ACCENT, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  peakHour: { color: TEXT, fontSize: 18, fontWeight: "700" },
  peakMin: { color: SUB, fontSize: 14 },
});
