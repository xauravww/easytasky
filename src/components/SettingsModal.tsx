import React, { useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clearAiConfig, getAiConfig, saveAiConfig, testAiConnection } from "../lib/aiClient";
import { getHeyGenKey, saveHeyGenKey } from "../lib/talk";
import { useStore } from "../store/useStore";

const BG = "#161616";
const FIELD_BG = "#1E1E1E";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const GREEN = "#3ECF8E";
const RED = "#E5484D";

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

export default function SettingsModal({ onClose, onSaved }: Props) {
  const [baseURL, setBaseURL] = useState(() => getAiConfig().baseURL);
  const [apiKey, setApiKey] = useState(() => getAiConfig().apiKey);
  const [model, setModel] = useState(() => getAiConfig().model);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [profile, setProfile] = useState(() => useStore.getState().profile);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const setProfileStore = useStore((s) => s.setProfile);
  const [heygen, setHeygen] = useState(() => getHeyGenKey());
  const [showHeygen, setShowHeygen] = useState(false);

  const saveProfile = () => {
    setProfileStore(profile);
  };

  const save = async () => {
    await saveAiConfig({ baseURL: baseURL.trim(), apiKey: apiKey.trim(), model: model.trim() });
    await saveHeyGenKey(heygen);
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
      <KeyboardAvoidingView style={styles.scrim} behavior="padding">
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>AI settings</Text>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>
              Point EasyTasky at any OpenAI-compatible endpoint (OpenAI, Groq, OpenRouter, Ollama…). Your key stays on this device.
            </Text>

            <View style={styles.labelRow}>
              <Text style={styles.label}>About me</Text>
              <Pressable style={styles.expandBtn} onPress={() => setProfileExpanded((v) => !v)} accessibilityRole="button" accessibilityLabel={profileExpanded ? "Collapse" : "Expand"}>
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

            <Text style={styles.talkTitle}>Talk mode</Text>
            <Text style={styles.hint}>Speak and listen through the agent. Needs a HeyGen API key (speech out) and the AI base URL above (speech in).</Text>
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
              <Pressable style={styles.eye} onPress={() => setShowHeygen((v) => !v)} accessibilityRole="button" accessibilityLabel="Toggle HeyGen key visibility">
                <Ionicons name={showHeygen ? "eye-off-outline" : "eye-outline"} size={20} color={SUB} />
              </Pressable>
            </View>

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
              <Pressable style={styles.eye} onPress={() => setShowKey((v) => !v)} accessibilityRole="button" accessibilityLabel="Toggle key visibility">
                <Ionicons name={showKey ? "eye-off-outline" : "eye-outline"} size={20} color={SUB} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, (!connected || testing) && { opacity: 0.4 }, pressed && { opacity: 0.6 }]}
              onPress={test}
              disabled={!connected || testing}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>{testing ? "Testing…" : "Test connection"}</Text>
            </Pressable>

            {result && (
              <View style={[styles.result, result.ok ? styles.resultOk : styles.resultErr]}>
                <Ionicons name={result.ok ? "checkmark-circle" : "alert-circle"} size={16} color={result.ok ? GREEN : RED} />
                <Text style={[styles.resultText, { color: result.ok ? GREEN : RED }]} numberOfLines={3}>
                  {result.text}
                </Text>
              </View>
            )}

            <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]} onPress={save} accessibilityRole="button">
              <Text style={styles.saveText}>Save</Text>
            </Pressable>

            <Pressable style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.5 }]} onPress={reset} accessibilityRole="button">
              <Ionicons name="trash-outline" size={16} color={SUB} />
              <Text style={styles.clearText}>Reset to empty</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 8 },
  title: { color: TEXT, fontSize: 18, fontWeight: "700" },
  done: { color: ACCENT, fontSize: 16, fontWeight: "600" },
  content: { paddingHorizontal: 20, paddingBottom: 36 },
  hint: { color: SUB, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { color: SUB, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 8 },
  talkTitle: { color: TEXT, fontSize: 16, fontWeight: "700", marginTop: 20, marginBottom: 4 },
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
  clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, marginTop: 6 },
  clearText: { color: SUB, fontSize: 14, fontWeight: "600" },
});
