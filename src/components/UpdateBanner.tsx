import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  getDismissedUpdateVersion,
  setDismissedUpdateVersion,
  type UpdateInfo,
} from "../services/updater";

const CARD = "#1C1C1C";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";

export default function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await checkForUpdate();
        if (!mounted || !info || !info.updateAvailable) return;

        const dismissed = await getDismissedUpdateVersion();
        if (dismissed === info.latestVersion) {
          return;
        }
        setUpdate(info);
      } catch {}
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!update || hidden) {
    return null;
  }

  const handleUpdate = async () => {
    if (downloading) return;
    setDownloading(true);
    setProgress(0);
    try {
      await downloadAndInstallUpdate(update.downloadUrl, (pct) => {
        setProgress(pct);
      });
    } catch (e: any) {
      Alert.alert(
        "Update Failed",
        e?.message || "Could not download update. Please try again.",
        [{ text: "Close", style: "cancel" }]
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleDismiss = async () => {
    setHidden(true);
    await setDismissedUpdateVersion(update.latestVersion).catch(() => {});
  };

  const progressPercent = Math.round(progress * 100);
  const notes = (update.changelog || "")
    .split("\n")
    .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);

  return (
    <View
      style={[
        styles.container,
        { top: insets.top > 0 ? insets.top + 8 : 16 },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={18} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Update Available</Text>
              <Text style={styles.versionSub}>
                v{update.currentVersion} → v{update.latestVersion}
              </Text>
            </View>
          </View>

          {!downloading && (
            <Pressable
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={18} color={SUB} />
            </Pressable>
          )}
        </View>

        {downloading ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressText}>Downloading update…</Text>
              <Text style={styles.progressPct}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.max(5, progressPercent)}%` },
                ]}
              />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.notesHeader}>WHAT&apos;S NEW</Text>
            {notes.length > 0 ? (
              <ScrollView
                style={styles.notesList}
                nestedScrollEnabled
                showsVerticalScrollIndicator={notes.length > 4}
              >
                {notes.map((line, i) => (
                  <View key={i} style={styles.noteItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.noteText}>{line}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noteText}>
                A new version of EasyTasky is ready to install.
              </Text>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleDismiss}
                style={({ pressed }) => [
                  styles.laterBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.laterText}>Later</Text>
              </Pressable>
              <Pressable
                onPress={handleUpdate}
                style={({ pressed }) => [
                  styles.updateBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="arrow-down-outline" size={15} color="#FFFFFF" />
                <Text style={styles.updateText}>
                  Update to v{update.latestVersion}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ACCENT,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(250, 110, 30, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 15,
  },
  versionSub: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  progressWrap: {
    marginTop: 14,
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "600",
  },
  progressPct: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#262626",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  notesHeader: {
    color: SUB,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 8,
  },
  notesList: {
    maxHeight: 140,
  },
  noteItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ACCENT,
    marginTop: 6,
    marginRight: 8,
  },
  noteText: {
    color: "#E0E0E0",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  laterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#262626",
  },
  laterText: {
    color: SUB,
    fontSize: 13,
    fontWeight: "600",
  },
  updateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  updateText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
