import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStore } from "../store/useStore";

const BG = "#141414";
const CARD = "#1E1E1E";
const LINE = "#2E2E2E";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const GREEN = "#12B76A";
const RED = "#E5484D";

const AUTO_BACKUP_KEY = "@easytasky/auto_backup_enabled";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function BackupRestoreModal({ visible, onClose }: Props) {
  const exportDataJson = useStore((s) => s.exportDataJson);
  const importDataJson = useStore((s) => s.importDataJson);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);

  // Load auto backup setting
  React.useEffect(() => {
    AsyncStorage.getItem(AUTO_BACKUP_KEY).then((val) => {
      if (val !== null) setAutoBackup(val === "true");
    });
  }, []);

  const toggleAutoBackup = async (val: boolean) => {
    setAutoBackup(val);
    await AsyncStorage.setItem(AUTO_BACKUP_KEY, String(val));
    setMsg({
      text: val
        ? "Daily automated local backup enabled (triggered on app start)."
        : "Automated backup disabled.",
    });
  };

  const handleExport = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const json = await exportDataJson();
      const fileName = `easytasky_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Save EasyTasky Backup to Drive, GitHub, or Files",
          UTI: "public.json",
        });
        setMsg({ text: "Backup created and ready to save to Drive/Files!" });
      } else {
        setMsg({ text: `Backup written locally: ${fileUri}` });
      }
    } catch (e) {
      setMsg({ text: `Export failed: ${(e as Error).message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const res = await importDataJson(content);
      if (res.success) {
        setMsg({ text: "All tasks, routines, and data restored successfully!" });
      } else {
        setMsg({ text: res.error || "Failed to restore backup.", error: true });
      }
    } catch (e) {
      setMsg({ text: `Import failed: ${(e as Error).message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Backup & Restore</Text>
              <Text style={styles.sub}>Preserve or migrate your complete workspace</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={TEXT} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {msg && (
              <View
                style={[
                  styles.statusBanner,
                  msg.error ? styles.statusBannerErr : styles.statusBannerSuccess,
                ]}
              >
                <Ionicons
                  name={msg.error ? "alert-circle" : "checkmark-circle"}
                  size={18}
                  color={msg.error ? RED : GREEN}
                />
                <Text style={styles.statusText}>{msg.text}</Text>
              </View>
            )}

            {/* Export Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="cloud-upload-outline" size={22} color={ACCENT} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Export Backup</Text>
                  <Text style={styles.cardSub}>
                    Generate a full JSON backup. Save to Google Drive, share to GitHub, or store in files.
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.actionBtn}
                onPress={handleExport}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Export & Share Data</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Import Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="cloud-download-outline" size={22} color={GREEN} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Restore from Backup</Text>
                  <Text style={styles.cardSub}>
                    Select a previously exported EasyTasky JSON file to restore all tasks and configurations.
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.actionBtn, styles.restoreBtn]}
                onPress={handleImport}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="folder-open-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Pick & Restore Backup File</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Automated daily backup toggle */}
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Daily Automated Backup</Text>
                  <Text style={styles.cardSub}>
                    Automatically save a timestamped JSON snapshot to app documents every 24 hours.
                  </Text>
                </View>
                <Switch
                  value={autoBackup}
                  onValueChange={toggleAutoBackup}
                  thumbColor={autoBackup ? ACCENT : "#888888"}
                  trackColor={{ false: "#333333", true: "rgba(250,110,30,0.4)" }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: LINE,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  title: { color: TEXT, fontSize: 18, fontWeight: "700" },
  sub: { color: SUB, fontSize: 13, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, paddingBottom: 40 },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusBannerSuccess: {
    backgroundColor: "rgba(18,183,106,0.15)",
    borderWidth: 1,
    borderColor: GREEN,
  },
  statusBannerErr: {
    backgroundColor: "rgba(229,72,77,0.15)",
    borderWidth: 1,
    borderColor: RED,
  },
  statusText: { flex: 1, color: TEXT, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: "row", gap: 12, marginBottom: 14 },
  cardTitle: { color: TEXT, fontSize: 15, fontWeight: "700" },
  cardSub: { color: SUB, fontSize: 13, lineHeight: 18, marginTop: 2 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    minHeight: 46,
  },
  restoreBtn: { backgroundColor: "#2A2A2A", borderWidth: 1, borderColor: LINE },
  actionBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
