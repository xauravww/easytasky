import React, { useEffect } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BG = "#141414";
const TEXT = "#FFFFFF";
const SUB = "#A6A6A6";
const ACCENT = "#FA6E1E";
const ON_ACCENT = "#FFFFFF";

type Props = {
  error: string | null;
  onRetry: () => void;
};

export default function AppStartupState({ error, onRetry }: Props) {
  useEffect(() => {
    if (error && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(
        "EasyTasky could not open your workspace. Your data is still safe."
      );
    }
  }, [error]);

  return (
    <View style={styles.root}>
      <View
        style={styles.status}
        accessible
        accessibilityLiveRegion={error ? "assertive" : "polite"}
        accessibilityLabel={error ? `EasyTasky could not start. ${error}` : "Loading EasyTasky"}
      >
        <View style={[styles.mark, error && styles.markError]}>
          <Ionicons
            name={error ? "alert-circle" : "checkmark-done"}
            size={34}
            color={error ? "#FF8D90" : ACCENT}
          />
        </View>
        <Text style={styles.title}>{error ? "Couldn’t open your workspace" : "EasyTasky"}</Text>
        <Text style={styles.body}>
          {error
            ? "Your data is still safe. Try opening the workspace again."
            : "Loading your workspace…"}
        </Text>
      </View>
      {error ? (
        <Pressable
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry opening EasyTasky"
        >
          <Ionicons name="refresh" size={18} color={ON_ACCENT} />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : (
        <ActivityIndicator style={styles.loader} color={ACCENT} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  status: { alignItems: "center" },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,110,30,0.12)",
    borderWidth: 1,
    borderColor: "rgba(250,110,30,0.32)",
    marginBottom: 22,
  },
  markError: {
    backgroundColor: "rgba(229,72,77,0.1)",
    borderColor: "rgba(229,72,77,0.3)",
  },
  title: { color: TEXT, fontSize: 24, lineHeight: 30, fontWeight: "700", textAlign: "center" },
  body: {
    color: SUB,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
  },
  loader: { marginTop: 24 },
  retry: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingHorizontal: 22,
    marginTop: 24,
  },
  retryText: { color: ON_ACCENT, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
});
