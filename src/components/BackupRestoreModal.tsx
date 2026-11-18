import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import {
  clearGitHubConfig,
  clearGoogleDriveConfig,
  getGitHubConfig,
  getGoogleDriveConfig,
  saveGitHubConfig,
  saveGoogleDriveConfig,
  testGitHubAuth,
  testGoogleDriveAuth,
  backupToGitHub,
  backupToGoogleDrive,
  restoreFromGitHub,
  restoreFromGoogleDrive,
  type GitHubConfig,
  type GoogleDriveConfig,
} from "../lib/cloudBackup";

// Theme tokens matching EasyTasky standard theme
const BG = "#141414";
const CARD = "#1C1C1C";
const FIELD = "#242424";
const LINE = "#2A2A2A";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E"; // Product accent
const GREEN = "#22C55E";
const RED = "#EF4444";

interface BackupRestoreModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ visible, onClose }) => {
  const store = useStore();

  const [activeTab, setActiveTab] = useState<"github" | "gdrive">("github");

  // GitHub State
  const [ghToken, setGhToken] = useState("");
  const [ghRepo, setGhRepo] = useState("easytasky-backup");
  const [ghConfig, setGhConfig] = useState<GitHubConfig | null>(null);
  const [ghLoading, setGhLoading] = useState(false);

  // Google Drive State
  const [gdToken, setGdToken] = useState("");
  const [gdConfig, setGdConfig] = useState<GoogleDriveConfig | null>(null);
  const [gdLoading, setGdLoading] = useState(false);

  // General Action State
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (visible) {
      (async () => {
        try {
          const gh = await getGitHubConfig();
          const gd = await getGoogleDriveConfig();
          if (active) {
            if (gh) {
              setGhConfig(gh);
              setGhToken(gh.token);
              setGhRepo(gh.repo);
            } else {
              setGhConfig(null);
            }

            if (gd) {
              setGdConfig(gd);
              setGdToken(gd.accessToken);
            } else {
              setGdConfig(null);
            }
          }
        } catch {
          // ignore
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [visible]);

  // GitHub Handlers
  const handleConnectGitHub = async () => {
    if (!ghToken.trim()) {
      Alert.alert("Required", "Please enter your GitHub Personal Access Token (Classic PAT).");
      return;
    }
    setGhLoading(true);
    try {
      const trimmedToken = ghToken.trim();
      const trimmedRepo = ghRepo.trim() || "easytasky-backup";
      const user = await testGitHubAuth(trimmedToken);

      const newConfig: GitHubConfig = {
        token: trimmedToken,
        repo: trimmedRepo,
        owner: user.login,
        lastBackupAt: ghConfig?.lastBackupAt,
      };

      await saveGitHubConfig(newConfig);
      setGhConfig(newConfig);
      Alert.alert("Connected", `Authenticated as @${user.login}. Backup repo: ${trimmedRepo} (private).`);
    } catch (err: any) {
      Alert.alert("Connection Failed", err.message || "Unable to authenticate with GitHub.");
    } finally {
      setGhLoading(false);
    }
  };

  const handleDisconnectGitHub = () => {
    Alert.alert("Disconnect GitHub", "Are you sure you want to disconnect GitHub?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          await clearGitHubConfig();
          setGhConfig(null);
          setGhToken("");
        },
      },
    ]);
  };

  const handleBackupGitHub = async () => {
    if (!ghConfig) return;
    setActionLoading("backup-gh");
    try {
      const jsonData = await store.exportDataJson();
      const result = await backupToGitHub(ghConfig.token, ghConfig.repo, jsonData);

      const updatedConfig = { ...ghConfig, lastBackupAt: new Date().toISOString() };
      await saveGitHubConfig(updatedConfig);
      setGhConfig(updatedConfig);

      Alert.alert("Success", `Backup pushed to ${result.repo} (commit: ${result.sha.substring(0, 7)})`);
    } catch (err: any) {
      Alert.alert("Backup Failed", err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreGitHub = () => {
    if (!ghConfig) return;
    Alert.alert(
      "Restore from GitHub",
      "This will replace your current local data with the latest backup in your GitHub private repo. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setActionLoading("restore-gh");
            try {
              const dataStr = await restoreFromGitHub(ghConfig.token, ghConfig.repo);
              const res = await store.importDataJson(dataStr);
              if (res.success) {
                Alert.alert("Restored", "Your data has been successfully restored from GitHub!");
              } else {
                Alert.alert("Restore Failed", res.error || "Failed to parse backup.");
              }
            } catch (err: any) {
              Alert.alert("Restore Failed", err.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  // Google Drive Handlers
  const handleConnectDrive = async () => {
    if (!gdToken.trim()) {
      Alert.alert("Required", "Please enter your Google OAuth / Service Account Access Token.");
      return;
    }
    setGdLoading(true);
    try {
      const trimmed = gdToken.trim();
      const user = await testGoogleDriveAuth(trimmed);
      const newConfig: GoogleDriveConfig = {
        accessToken: trimmed,
        userEmail: user.email || "Connected User",
        lastBackupAt: gdConfig?.lastBackupAt,
      };

      await saveGoogleDriveConfig(newConfig);
      setGdConfig(newConfig);
      Alert.alert("Connected", `Authenticated Google Drive for ${newConfig.userEmail}`);
    } catch (err: any) {
      Alert.alert("Connection Failed", err.message || "Unable to authenticate with Google Drive.");
    } finally {
      setGdLoading(false);
    }
  };

  const handleDisconnectDrive = () => {
    Alert.alert("Disconnect Google Drive", "Are you sure you want to disconnect Google Drive?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          await clearGoogleDriveConfig();
          setGdConfig(null);
          setGdToken("");
        },
      },
    ]);
  };

  const handleBackupDrive = async () => {
    if (!gdConfig) return;
    setActionLoading("backup-gd");
    try {
      const jsonData = await store.exportDataJson();
      const result = await backupToGoogleDrive(gdConfig.accessToken, jsonData);

      const updatedConfig = { ...gdConfig, lastBackupAt: new Date().toISOString() };
      await saveGoogleDriveConfig(updatedConfig);
      setGdConfig(updatedConfig);

      Alert.alert("Success", `Backup saved to Google Drive (File ID: ${result.fileId})`);
    } catch (err: any) {
      Alert.alert("Backup Failed", err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreDrive = () => {
    if (!gdConfig) return;
    Alert.alert(
      "Restore from Google Drive",
      "This will replace your current local data with the latest backup in your Google Drive. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setActionLoading("restore-gd");
            try {
              const dataStr = await restoreFromGoogleDrive(gdConfig.accessToken);
              const res = await store.importDataJson(dataStr);
              if (res.success) {
                Alert.alert("Restored", "Your data has been successfully restored from Google Drive!");
              } else {
                Alert.alert("Restore Failed", res.error || "Failed to parse backup.");
              }
            } catch (err: any) {
              Alert.alert("Restore Failed", err.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="cloud-done-outline" size={22} color={ACCENT} />
              <Text style={styles.title}>Cloud Backup & Sync</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={SUB} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Connect GitHub (Classic PAT) and/or Google Drive (OAuth / Service Account). Both can be connected together.
          </Text>

          {/* Segmented Provider Tabs */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, activeTab === "github" && styles.tabActive]}
              onPress={() => setActiveTab("github")}
            >
              <Ionicons
                name="logo-github"
                size={16}
                color={activeTab === "github" ? TEXT : SUB}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, activeTab === "github" && styles.tabTextActive]}>
                GitHub {ghConfig ? "✓" : ""}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tab, activeTab === "gdrive" && styles.tabActive]}
              onPress={() => setActiveTab("gdrive")}
            >
              <Ionicons
                name="logo-google"
                size={16}
                color={activeTab === "gdrive" ? TEXT : SUB}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, activeTab === "gdrive" && styles.tabTextActive]}>
                Google Drive {gdConfig ? "✓" : ""}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            {/* GITHUB TAB */}
            {activeTab === "github" && (
              <View style={styles.tabContent}>
                <View style={styles.infoBanner}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={ACCENT} />
                  <Text style={styles.infoBannerText}>
                    Create a GitHub Classic Token with `repo` scope. EasyTasky will automatically manage a private
                    repository for your backups.
                  </Text>
                </View>

                {ghConfig ? (
                  <View style={styles.connectedCard}>
                    <View style={styles.connectedHeader}>
                      <View style={styles.statusDot} />
                      <Text style={styles.connectedUser}>Connected: @{ghConfig.owner}</Text>
                    </View>
                    <Text style={styles.connectedDetail}>Private Repo: {ghConfig.repo}</Text>
                    {ghConfig.lastBackupAt ? (
                      <Text style={styles.lastBackupText}>
                        Last backup: {new Date(ghConfig.lastBackupAt).toLocaleString()}
                      </Text>
                    ) : (
                      <Text style={styles.lastBackupText}>No cloud backup taken yet</Text>
                    )}

                    <View style={styles.actionRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.actionBtnPrimary,
                          actionLoading === "backup-gh" && styles.btnDisabled,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={handleBackupGitHub}
                        disabled={actionLoading !== null}
                      >
                        <Ionicons name="cloud-upload" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnText}>
                          {actionLoading === "backup-gh" ? "Pushing…" : "Backup Now"}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.actionBtnSecondary,
                          actionLoading === "restore-gh" && styles.btnDisabled,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={handleRestoreGitHub}
                        disabled={actionLoading !== null}
                      >
                        <Ionicons name="cloud-download" size={16} color={TEXT} style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnText, { color: TEXT }]}>
                          {actionLoading === "restore-gh" ? "Pulling…" : "Restore"}
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable style={styles.btnDisconnect} onPress={handleDisconnectGitHub}>
                      <Text style={styles.btnDisconnectText}>Disconnect GitHub</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.formContainer}>
                    <Text style={styles.inputLabel}>Personal Access Token (Classic)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      placeholderTextColor="#555555"
                      value={ghToken}
                      onChangeText={setGhToken}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <Text style={styles.inputLabel}>Private Repository Name</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="easytasky-backup"
                      placeholderTextColor="#555555"
                      value={ghRepo}
                      onChangeText={setGhRepo}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <Pressable
                      style={({ pressed }) => [
                        styles.submitBtn,
                        ghLoading && styles.btnDisabled,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={handleConnectGitHub}
                      disabled={ghLoading}
                    >
                      <Text style={styles.submitBtnText}>
                        {ghLoading ? "Authenticating…" : "Authenticate & Connect"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* GOOGLE DRIVE TAB */}
            {activeTab === "gdrive" && (
              <View style={styles.tabContent}>
                <View style={styles.infoBanner}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={ACCENT} />
                  <Text style={styles.infoBannerText}>
                    Provide a Google OAuth access token or Service Account token with Drive scope (`drive.file` / `drive`).
                  </Text>
                </View>

                {gdConfig ? (
                  <View style={styles.connectedCard}>
                    <View style={styles.connectedHeader}>
                      <View style={styles.statusDot} />
                      <Text style={styles.connectedUser}>Connected: {gdConfig.userEmail || "Google Drive"}</Text>
                    </View>
                    {gdConfig.lastBackupAt ? (
                      <Text style={styles.lastBackupText}>
                        Last backup: {new Date(gdConfig.lastBackupAt).toLocaleString()}
                      </Text>
                    ) : (
                      <Text style={styles.lastBackupText}>No cloud backup taken yet</Text>
                    )}

                    <View style={styles.actionRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.actionBtnPrimary,
                          actionLoading === "backup-gd" && styles.btnDisabled,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={handleBackupDrive}
                        disabled={actionLoading !== null}
                      >
                        <Ionicons name="cloud-upload" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnText}>
                          {actionLoading === "backup-gd" ? "Saving…" : "Backup Now"}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.actionBtnSecondary,
                          actionLoading === "restore-gd" && styles.btnDisabled,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={handleRestoreDrive}
                        disabled={actionLoading !== null}
                      >
                        <Ionicons name="cloud-download" size={16} color={TEXT} style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnText, { color: TEXT }]}>
                          {actionLoading === "restore-gd" ? "Fetching…" : "Restore"}
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable style={styles.btnDisconnect} onPress={handleDisconnectDrive}>
                      <Text style={styles.btnDisconnectText}>Disconnect Google Drive</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.formContainer}>
                    <Text style={styles.inputLabel}>OAuth / Service Account Token</Text>
                    <TextInput
                      style={[styles.textInput, { height: 74, textAlignVertical: "top" }]}
                      placeholder="ya29.xxxxxxxxxxxxxxxxxxxx"
                      placeholderTextColor="#555555"
                      value={gdToken}
                      onChangeText={setGdToken}
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <Pressable
                      style={({ pressed }) => [
                        styles.submitBtn,
                        gdLoading && styles.btnDisabled,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={handleConnectDrive}
                      disabled={gdLoading}
                    >
                      <Text style={styles.submitBtnText}>
                        {gdLoading ? "Authenticating…" : "Authenticate & Connect"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default BackupRestoreModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
  },
  subtitle: {
    fontSize: 13,
    color: SUB,
    marginBottom: 16,
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: FIELD,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#2E2E2E",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: SUB,
  },
  tabTextActive: {
    color: TEXT,
  },
  scrollArea: {
    maxHeight: 400,
  },
  tabContent: {
    paddingVertical: 4,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderColor: LINE,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    alignItems: "center",
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: SUB,
    lineHeight: 17,
  },
  formContainer: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: SUB,
    marginBottom: -4,
  },
  textInput: {
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT,
    fontSize: 14,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: ACCENT,
    marginTop: 8,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  connectedCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: LINE,
    gap: 10,
  },
  connectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  connectedUser: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  connectedDetail: {
    fontSize: 13,
    color: SUB,
  },
  lastBackupText: {
    fontSize: 12,
    color: "#666666",
    fontStyle: "italic",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnPrimary: {
    backgroundColor: ACCENT,
  },
  actionBtnSecondary: {
    backgroundColor: "#2E2E2E",
    borderWidth: 1,
    borderColor: LINE,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisconnect: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  btnDisconnectText: {
    color: RED,
    fontSize: 12,
    fontWeight: "600",
  },
});
