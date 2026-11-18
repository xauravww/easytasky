import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import SectionsManagerModal from "../components/SectionsManagerModal";
import { BackupRestoreModal } from "../components/BackupRestoreModal";

const BG = "#141414";
const CARD = "#1C1C1C";
const FIELD = "#242424";
const LINE = "#2A2A2A";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const ON_ACCENT = "#FFFFFF";
const GREEN = "#22C55E";
const RED = "#EF4444";

type GridCardKey = "ai" | "voice" | "categories" | "backup";

type Props = {
  onBack?: () => void;
  onSaved?: () => void;
};

export default function SettingsScreen({ onBack, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState<GridCardKey | null>(null);

  // Sub-modal triggers
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
    onSaved?.();
    setActiveSection(null);
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
    onSaved?.();
  };

  const connected = !!baseURL.trim() && !!model.trim();

  const gridCards: {
    key: GridCardKey;
    icon: string;
    title: string;
    desc: string;
    badge?: string;
  }[] = [
    {
      key: "ai",
      icon: "sparkles",
      title: "AI & Model",
      desc: "Configure OpenAI / Ollama endpoint and persona",
      badge: connected ? "Connected" : "Not configured",
    },
    {
      key: "voice",
      icon: "mic",
      title: "Voice & Speech",
      desc: "HeyGen key, Indian voice accents, and Talk Mode",
      badge: heygen ? "Ready" : "Key needed",
    },
    {
      key: "categories",
      icon: "folder",
      title: "Categories",
      desc: "Color-coded project sections and task groups",
      badge: `${sections.length} active`,
    },
    {
      key: "backup",
      icon: "cloud",
      title: "Cloud Backup",
      desc: "GitHub Classic PAT & Google Drive sync",
      badge: "GitHub / Drive",
    },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top Header */}
      <View style={styles.header}>
        {activeSection ? (
          <Pressable style={styles.headerBtn} onPress={() => setActiveSection(null)}>
            <Ionicons name="arrow-back" size={22} color={TEXT} />
          </Pressable>
        ) : onBack ? (
          <Pressable style={styles.headerBtn} onPress={onBack}>
            <Ionicons name="close" size={22} color={TEXT} />
          </Pressable>
        ) : (
          <View style={styles.headerIcon}>
            <Ionicons name="settings-sharp" size={20} color={ACCENT} />
          </View>
        )}

        <Text style={styles.headerTitle}>
          {activeSection === "ai"
            ? "AI & Model Configuration"
            : activeSection === "voice"
            ? "Voice & Talk Settings"
            : activeSection === "categories"
            ? "Categories & Sections"
            : activeSection === "backup"
            ? "Cloud Backup & Sync"
            : "Settings"}
        </Text>

        {activeSection ? (
          <Pressable style={styles.saveHeaderBtn} onPress={save}>
            <Text style={styles.saveHeaderText}>Done</Text>
          </Pressable>
        ) : onBack ? (
          <Pressable style={styles.saveHeaderBtn} onPress={onBack}>
            <Text style={styles.saveHeaderText}>Done</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* =========================================================================
            GRID VIEW (When no specific card is active)
           ========================================================================= */}
        {!activeSection && (
          <>
            <Text style={styles.sectionSubtitle}>
              Customize your models, voice synthesis, task categories, and cloud backups.
            </Text>

            <View style={styles.gridContainer}>
              {gridCards.map((card) => (
                <Pressable
                  key={card.key}
                  style={({ pressed }) => [styles.gridCard, pressed && styles.gridCardPressed]}
                  onPress={() => {
                    if (card.key === "categories") {
                      setShowCategoriesModal(true);
                    } else if (card.key === "backup") {
                      setShowBackupModal(true);
                    } else {
                      setActiveSection(card.key);
                    }
                  }}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardIconBox}>
                      <Ionicons name={card.icon as never} size={22} color={ACCENT} />
                    </View>
                    {card.badge && (
                      <View style={styles.badgeBox}>
                        <Text style={styles.badgeText}>{card.badge}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {card.desc}
                  </Text>

                  <View style={styles.cardActionRow}>
                    <Text style={styles.cardActionText}>Manage</Text>
                    <Ionicons name="chevron-forward" size={14} color={ACCENT} />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* =========================================================================
            AI & MODEL SECTION DETAIL
           ========================================================================= */}
        {activeSection === "ai" && (
          <View style={styles.detailContainer}>
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
          </View>
        )}

        {/* =========================================================================
            VOICE & TALK MODE SECTION DETAIL
           ========================================================================= */}
        {activeSection === "voice" && (
          <View style={styles.detailContainer}>
            <Text style={styles.hint}>
              Speak and listen through the agent. Uses a HeyGen API key for natural Indian accent voices.
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
          </View>
        )}
      </ScrollView>

      {/* Sub Modals */}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  saveHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveHeaderText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionSubtitle: {
    color: SUB,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    gap: 8,
    justifyContent: "space-between",
  },
  gridCardPressed: {
    backgroundColor: "#222222",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(250,110,30,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeBox: {
    backgroundColor: FIELD,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: SUB,
    fontSize: 11,
    fontWeight: "600",
  },
  cardTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
  },
  cardDesc: {
    color: SUB,
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
  },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  cardActionText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "700",
  },
  detailContainer: {
    paddingTop: 4,
  },
  hint: { color: SUB, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  label: { color: SUB, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: FIELD,
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
    backgroundColor: FIELD,
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
  resultOk: { backgroundColor: "rgba(34,197,94,0.1)" },
  resultErr: { backgroundColor: "rgba(239,68,68,0.1)" },
  resultText: { flex: 1, fontSize: 13, fontWeight: "500" },
  saveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  saveText: { color: ON_ACCENT, fontWeight: "800", fontSize: 16 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    marginTop: 6,
  },
  clearText: { color: SUB, fontSize: 14, fontWeight: "600" },
});
