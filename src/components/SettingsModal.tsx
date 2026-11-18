import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clearAiConfig, getAiConfig, saveAiConfig, testAiConnection } from "../lib/aiClient";
import {
  getHeyGenKey,
  getSelectedVoice,
  getSpeechLang,
  saveHeyGenKey,
  saveVoiceSettings,
  VOICE_OPTIONS,
} from "../lib/talk";
import { useStore } from "../store/useStore";
import SectionsManagerModal from "./SectionsManagerModal";
import BackupRestoreModal from "./BackupRestoreModal";

const BG = "#161616";
const FIELD_BG = "#1E1E1E";
const CARD_BG = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const GREEN = "#3ECF8E";
const RED = "#E5484D";

type SettingsTab = "ai" | "voice" | "categories" | "backup";

type Props = {
  initialTab?: SettingsTab;
  onClose: () => void;
  onSaved: () => void;
};

export default function SettingsModal({ initialTab = "ai", onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Sub-modals for categories and backup
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);

  // AI & Voice state
  const [baseURL, setBaseURL] = useState(() => getAiConfig().baseURL);
  const [apiKey, setApiKey] = useState(() => getAiConfig().apiKey);
  const [model, setModel] = useState(() => getAiConfig().model);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [profile, setProfile] = useState(() => useStore.getState().profile);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const setProfileStore = useStore((s) => s.setProfile);
  const sections = useStore((s) => s.sections);

  const [heygen, setHeygen] = useState(() => getHeyGenKey());
  const [showHeygen, setShowHeygen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => getSelectedVoice());
  const [speechLang, setSpeechLang] = useState(() => getSpeechLang());

  const saveProfile = () => {
    setProfileStore(profile);
  };

  const save = async () => {
    await saveAiConfig({ baseURL: baseURL.trim(), apiKey: apiKey.trim(), model: model.trim() });
    await saveHeyGenKey(heygen);
    await saveVoiceSettings(selectedVoice, speechLang);
    onSaved();
    onClose();
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    await saveAiConfig({ baseURL: baseURL.trim(), apiKey: apiKey.trim(), model: model.trim() });
    try {
      const reply = await testAiConnection();
      setResult({ ok: true, text: `Connected${reply ? ` · "${reply}"` : ""}` });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setTesting(false);
    }
  };

  const reset = async () => {
    await clearAiConfig();
    setBaseURL("");
    setApiKey("");
    setModel("");
    setResult(null);
    onSaved();
  };

  const connected = !!baseURL.trim() && !!model.trim();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.scrim}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          {/* Segmented Top Navigation */}
          <View style={styles.navBar}>
            <Pressable
              style={[styles.navBtn, activeTab === "ai" && styles.navBtnActive]}
              onPress={() => setActiveTab("ai")}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={activeTab === "ai" ? ACCENT : SUB}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.navBtnText, activeTab === "ai" && styles.navBtnTextActive]}>
                AI & Profile
              </Text>
            </Pressable>

            <Pressable
              style={[styles.navBtn, activeTab === "voice" && styles.navBtnActive]}
              onPress={() => setActiveTab("voice")}
            >
              <Ionicons
                name="mic"
                size={14}
                color={activeTab === "voice" ? ACCENT : SUB}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.navBtnText, activeTab === "voice" && styles.navBtnTextActive]}>
                Voice
              </Text>
            </Pressable>

            <Pressable
              style={[styles.navBtn, activeTab === "categories" && styles.navBtnActive]}
              onPress={() => setActiveTab("categories")}
            >
              <Ionicons
                name="folder"
                size={14}
                color={activeTab === "categories" ? ACCENT : SUB}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.navBtnText, activeTab === "categories" && styles.navBtnTextActive]}>
                Categories
              </Text>
            </Pressable>

            <Pressable
              style={[styles.navBtn, activeTab === "backup" && styles.navBtnActive]}
              onPress={() => setActiveTab("backup")}
            >
              <Ionicons
                name="cloud"
                size={14}
                color={activeTab === "backup" ? ACCENT : SUB}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.navBtnText, activeTab === "backup" && styles.navBtnTextActive]}>
                Cloud Backup
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* AI & PROFILE TAB */}
            {activeTab === "ai" && (
              <>
                <Text style={styles.hint}>
                  Point EasyTasky at any OpenAI-compatible endpoint (OpenAI, Groq, OpenRouter, Ollama…).
                  Your key stays strictly on this device.
                </Text>

                <View style={styles.labelRow}>
                  <Text style={styles.label}>About me (Agent Context)</Text>
                  <Pressable
                    style={styles.expandBtn}
                    onPress={() => setProfileExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={profileExpanded ? "Collapse" : "Expand"}
                  >
                    <Text style={styles.expandText}>{profileExpanded ? "Collapse" : "Expand"}</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.input, profileExpanded ? styles.profileInputExpanded : styles.profileInput]}
                  value={profile}
                  onChangeText={setProfile}
                  onEndEditing={saveProfile}
                  placeholder="Tell the agent about you, e.g.: I'm a designer, work mornings, and plan in 90-minute blocks."
                  placeholderTextColor={SUB}
                  multiline
                />

                <Text style={styles.label}>Base URL</Text>
                <TextInput
                  style={styles.input}
                  value={baseURL}
                  onChangeText={setBaseURL}
                  placeholder="https://api.openai.com/v1"
                  placeholderTextColor={SUB}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />

                <Text style={styles.label}>Model</Text>
                <TextInput
                  style={styles.input}
                  value={model}
                  onChangeText={setModel}
                  placeholder="gpt-4o-mini"
                  placeholderTextColor={SUB}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.label}>API key (optional for local models)</Text>
                <View style={styles.keyRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder="sk-…"
                    placeholderTextColor={SUB}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showKey}
                  />
                  <Pressable
                    style={styles.eye}
                    onPress={() => setShowKey((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle key visibility"
                  >
                    <Ionicons name={showKey ? "eye-off-outline" : "eye-outline"} size={20} color={SUB} />
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    (!connected || testing) && { opacity: 0.4 },
                    pressed && { opacity: 0.6 },
                  ]}
                  onPress={test}
                  disabled={!connected || testing}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryText}>{testing ? "Testing…" : "Test connection"}</Text>
                </Pressable>

                {result && (
                  <View style={[styles.result, result.ok ? styles.resultOk : styles.resultErr]}>
                    <Ionicons
                      name={result.ok ? "checkmark-circle" : "alert-circle"}
                      size={16}
                      color={result.ok ? GREEN : RED}
                    />
                    <Text
                      style={[styles.resultText, { color: result.ok ? GREEN : RED }]}
                      numberOfLines={3}
                    >
                      {result.text}
                    </Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
                  onPress={save}
                  accessibilityRole="button"
                >
                  <Text style={styles.saveText}>Save Changes</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.5 }]}
                  onPress={reset}
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={16} color={SUB} />
                  <Text style={styles.clearText}>Reset AI Config to empty</Text>
                </Pressable>
              </>
            )}

            {/* VOICE TAB */}
            {activeTab === "voice" && (
              <>
                <Text style={styles.hint}>
                  Speak and listen through the agent. Uses a HeyGen API key for ultra-natural Indian accent voices.
                </Text>

                <Text style={styles.label}>HeyGen API key</Text>
                <View style={styles.keyRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={heygen}
                    onChangeText={setHeygen}
                    placeholder="sk_…"
                    placeholderTextColor={SUB}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showHeygen}
                  />
                  <Pressable
                    style={styles.eye}
                    onPress={() => setShowHeygen((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle HeyGen key visibility"
                  >
                    <Ionicons name={showHeygen ? "eye-off-outline" : "eye-outline"} size={20} color={SUB} />
                  </Pressable>
                </View>

                <Text style={styles.label}>Voice & Language</Text>
                <View style={styles.voiceOptions}>
                  {VOICE_OPTIONS.map((opt) => {
                    const isSelected = selectedVoice === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[styles.voiceItem, isSelected && styles.voiceItemSelected]}
                        onPress={() => {
                          setSelectedVoice(opt.id);
                          setSpeechLang(opt.lang);
                        }}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={isSelected ? ACCENT : SUB}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[styles.voiceItemText, isSelected && styles.voiceItemTextSelected]}>
                          {opt.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
                  onPress={save}
                  accessibilityRole="button"
                >
                  <Text style={styles.saveText}>Save Voice Settings</Text>
                </Pressable>
              </>
            )}

            {/* CATEGORIES / SECTIONS TAB */}
            {activeTab === "categories" && (
              <View style={styles.tabSection}>
                <Text style={styles.hint}>
                  Manage task categories and sections. You can configure colors, add custom groupings, and edit or delete them.
                </Text>

                <View style={styles.cardBox}>
                  <View style={styles.cardBoxHeader}>
                    <Ionicons name="folder-outline" size={20} color={ACCENT} />
                    <Text style={styles.cardBoxTitle}>Configured Categories ({sections.length})</Text>
                  </View>

                  <View style={styles.sectionPreviewList}>
                    {sections.length === 0 ? (
                      <Text style={styles.emptyNote}>No categories created yet.</Text>
                    ) : (
                      sections.map((sec) => (
                        <View key={sec.id} style={styles.sectionChipPreview}>
                          <View style={[styles.colorDot, { backgroundColor: sec.color }]} />
                          <Text style={styles.sectionChipName}>{sec.name}</Text>
                        </View>
                      ))
                    )}
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.openModalBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => setShowCategoriesModal(true)}
                  >
                    <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.openModalBtnText}>Open Categories Manager</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* BACKUP & RESTORE TAB */}
            {activeTab === "backup" && (
              <View style={styles.tabSection}>
                <Text style={styles.hint}>
                  Secure cloud backups with GitHub Classic Token (unique private repository) and/or Google Drive OAuth.
                </Text>

                <View style={styles.cardBox}>
                  <View style={styles.cardBoxHeader}>
                    <Ionicons name="cloud-upload-outline" size={20} color={ACCENT} />
                    <Text style={styles.cardBoxTitle}>Cloud Backup & Sync</Text>
                  </View>
                  <Text style={styles.cardBoxDesc}>
                    Connect GitHub to push/pull `backup.json` to your private repo, or connect Google Drive for automatic cloud synchronization.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [styles.openModalBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => setShowBackupModal(true)}
                  >
                    <Ionicons name="options-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.openModalBtnText}>Configure Cloud Backup</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sub-modals inside Settings */}
          {showCategoriesModal && (
            <SectionsManagerModal
              visible={showCategoriesModal}
              onClose={() => setShowCategoriesModal(false)}
            />
          )}

          {showBackupModal && (
            <BackupRestoreModal
              visible={showBackupModal}
              onClose={() => setShowBackupModal(false)}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: { color: TEXT, fontSize: 18, fontWeight: "700" },
  done: { color: ACCENT, fontSize: 16, fontWeight: "600" },
  navBar: {
    flexDirection: "row",
    backgroundColor: FIELD_BG,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
  },
  navBtnActive: {
    backgroundColor: "#2A2A2A",
  },
  navBtnText: {
    color: SUB,
    fontSize: 12,
    fontWeight: "600",
  },
  navBtnTextActive: {
    color: TEXT,
    fontWeight: "700",
  },
  content: { paddingHorizontal: 20, paddingBottom: 36 },
  hint: { color: SUB, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  label: { color: SUB, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    color: TEXT,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 15,
    marginBottom: 4,
  },
  keyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceOptions: { marginTop: 4, gap: 8 },
  voiceItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  voiceItemSelected: { borderColor: ACCENT },
  voiceItemText: { color: SUB, fontSize: 14, fontWeight: "500" },
  voiceItemTextSelected: { color: TEXT, fontWeight: "700" },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  expandBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  expandText: { color: ACCENT, fontSize: 13, fontWeight: "700" },
  profileInput: { maxHeight: 120, minHeight: 76, textAlignVertical: "top" },
  profileInputExpanded: { maxHeight: 320, minHeight: 160, textAlignVertical: "top" },
  eye: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 14,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  secondaryText: { color: TEXT, fontWeight: "600", fontSize: 15 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  resultOk: { backgroundColor: "rgba(62,207,142,0.1)" },
  resultErr: { backgroundColor: "rgba(229,72,77,0.1)" },
  resultText: { flex: 1, fontSize: 13, fontWeight: "500" },
  saveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  saveText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    marginTop: 6,
  },
  clearText: { color: SUB, fontSize: 14, fontWeight: "600" },
  tabSection: {
    marginTop: 4,
  },
  cardBox: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    marginTop: 8,
  },
  cardBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardBoxTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
  },
  cardBoxDesc: {
    color: SUB,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  sectionPreviewList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  emptyNote: {
    color: "#666666",
    fontSize: 13,
    fontStyle: "italic",
  },
  sectionChipPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FIELD_BG,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: LINE,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionChipName: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "600",
  },
  openModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
  },
  openModalBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
