// Talk mode: HeyGen TTS (streaming speech out) + expo-speech-recognition
// (speech in, works on the new architecture). The HeyGen API key is user-supplied
// at runtime (never hardcoded) and stored in AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { getAiConfig } from "./aiClient";

const HEYGEN_STORAGE_KEY = "@easytasky/heygen-key";
const HEYGEN_VOICE_STORAGE_KEY = "@easytasky/heygen-voice";
const HEYGEN_LANG_STORAGE_KEY = "@easytasky/heygen-lang";

const HEYGEN_TTS_URL = "https://api.heygen.com/v3/models/audio/tts";
const HEYGEN_TTS_STREAM_URL = "https://api.heygen.com/v3/models/audio/tts/stream";

export const VOICE_OPTIONS = [
  { id: "232a89926fca44fc9c8ba2e0f90064f4", name: "Kavya (Indian English / Hindi)", lang: "hi-IN", gender: "female" as const },
  { id: "4e79dcb0af2c4d07a5bf5db075884257", name: "Araj (Indian Male)", lang: "hi-IN", gender: "male" as const },
  { id: "f03273ea4c5b42d2ad8d05065747a217", name: "Peppy Priya (Indian Friendly)", lang: "hi-IN", gender: "female" as const },
  { id: "83548de556df48ba8c09c42a57c51d85", name: "Nadine (Global English)", lang: "en-US", gender: "female" as const },
];

const DEFAULT_VOICE = "232a89926fca44fc9c8ba2e0f90064f4"; // Kavya (Indian)
const HEYGEN_MODEL = "heygen-voice-1-turbo-free";

let heygenKey = "";
let selectedVoiceId = DEFAULT_VOICE;
let selectedSpeechLang = "hi-IN";

export const loadHeyGenKey = async (): Promise<void> => {
  try {
    heygenKey = (await AsyncStorage.getItem(HEYGEN_STORAGE_KEY)) ?? "";
    const savedVoice = await AsyncStorage.getItem(HEYGEN_VOICE_STORAGE_KEY);
    if (savedVoice) selectedVoiceId = savedVoice;
    const savedLang = await AsyncStorage.getItem(HEYGEN_LANG_STORAGE_KEY);
    if (savedLang) selectedSpeechLang = savedLang;
  } catch {}
};

export const getHeyGenKey = (): string => heygenKey;
export const getSelectedVoice = (): string => selectedVoiceId;
export const getSelectedVoiceInfo = (): { id: string; name: string; lang: string; gender: "male" | "female" } => {
  const opt = VOICE_OPTIONS.find((v) => v.id === selectedVoiceId);
  if (opt) return opt;
  return { id: DEFAULT_VOICE, name: "Kavya", lang: "hi-IN", gender: "female" };
};
export const getSpeechLang = (): string => selectedSpeechLang;

export const saveHeyGenKey = async (key: string): Promise<void> => {
  heygenKey = key.trim();
  try {
    if (heygenKey) await AsyncStorage.setItem(HEYGEN_STORAGE_KEY, heygenKey);
    else await AsyncStorage.removeItem(HEYGEN_STORAGE_KEY);
  } catch {}
};

export const saveVoiceSettings = async (voiceId: string, lang?: string): Promise<void> => {
  selectedVoiceId = voiceId;
  const opt = VOICE_OPTIONS.find((v) => v.id === voiceId);
  if (lang) {
    selectedSpeechLang = lang;
  } else if (opt) {
    selectedSpeechLang = opt.lang;
  }
  try {
    await AsyncStorage.setItem(HEYGEN_VOICE_STORAGE_KEY, selectedVoiceId);
    await AsyncStorage.setItem(HEYGEN_LANG_STORAGE_KEY, selectedSpeechLang);
  } catch {}
};

export const talkEnabled = (): boolean => !!heygenKey && !!getAiConfig().baseURL;

// Pre-warm TCP/TLS connection to HeyGen when Call Mode is opened
export const prewarmTalkSession = (): void => {
  if (!heygenKey) return;
  fetch(HEYGEN_TTS_URL, {
    method: "HEAD",
    headers: { "X-Api-Key": heygenKey },
  }).catch(() => {});
};

// ---- Text to Speech (HeyGen): returns an audio URL to play ----
export const synthesizeSpeech = async (text: string): Promise<string> => {
  if (!heygenKey) throw new Error("Add your HeyGen API key in Agent → Talk settings.");
  const res = await fetch(HEYGEN_TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": heygenKey },
    body: JSON.stringify({
      model: HEYGEN_MODEL,
      voice_id: selectedVoiceId,
      text: text.slice(0, 10000),
      language: selectedSpeechLang.startsWith("hi") ? "hi" : "en",
    }),
  });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`HeyGen TTS failed (${res.status}): ${b}`);
  }
  const data = (await res.json()) as { data?: { audio_url?: string } };
  const url = data?.data?.audio_url;
  if (!url) throw new Error("HeyGen returned no audio URL");
  return url;
};

// ---- Streaming Text to Speech (HeyGen SSE) ----
// Returns decoded WAV byte chunks as they arrive, so playback can start before the
// whole reply finishes synthesizing.
export const synthesizeSpeechStream = async function* (
  text: string
): AsyncGenerator<Uint8Array, void, undefined> {
  if (!heygenKey) throw new Error("Add your HeyGen API key in Agent → Talk settings.");
  const res = await fetch(HEYGEN_TTS_STREAM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": heygenKey, Accept: "text/event-stream" },
    body: JSON.stringify({
      model: HEYGEN_MODEL,
      voice_id: selectedVoiceId,
      text: text.slice(0, 10000),
      language: selectedSpeechLang.startsWith("hi") ? "hi" : "en",
    }),
  });
  if (!res.ok || !res.body) {
    const b = await res.text().catch(() => "");
    throw new Error(`HeyGen TTS stream failed (${res.status}): ${b}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as { type?: string; audio?: string; detail?: string };
        if (j.type === "error") throw new Error(j.detail ?? "HeyGen stream error");
        if (j.audio) {
          const bytes = Uint8Array.from(atob(j.audio), (c) => c.charCodeAt(0));
          yield bytes;
        }
      } catch {
        // ignore malformed events
      }
    }
  }
};

// ---- Speech to Text (expo-speech-recognition) ----
export type VoiceListener = {
  onResult: (text: string) => void;
  onPartial?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError: (message: string) => void;
};

let started = false;
let currentListener: VoiceListener | null = null;

export const startVoice = async (listener: VoiceListener): Promise<void> => {
  currentListener = listener;
  if (started) return;
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) {
    listener.onError("Microphone/speech permission not granted");
    return;
  }
  try {
    ExpoSpeechRecognitionModule.start({
      lang: selectedSpeechLang || "hi-IN",
      interimResults: true,
      continuous: false,
    });
    started = true;
  } catch (err: any) {
    started = false;
    throw err;
  }
};

export const stopVoice = async (): Promise<string | null> => {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {}
  started = false;
  currentListener = null;
  return null;
};

export const destroyVoice = async (): Promise<void> => {
  try {
    ExpoSpeechRecognitionModule.abort();
  } catch {}
  started = false;
  currentListener = null;
};

// Wire the module's native events to the current listener.
ExpoSpeechRecognitionModule.addListener("start", () => {
  started = true;
  currentListener?.onStart?.();
});
ExpoSpeechRecognitionModule.addListener("end", () => {
  started = false;
  currentListener?.onEnd?.();
});
ExpoSpeechRecognitionModule.addListener("result", (event) => {
  const text = event.results?.[0]?.transcript ?? "";
  if (!text || !currentListener) return;
  if (event.isFinal) {
    currentListener.onResult(text.trim());
  } else if (currentListener.onPartial) {
    currentListener.onPartial(text.trim());
  }
});
ExpoSpeechRecognitionModule.addListener("error", (event) => {
  started = false;
  const message = event.message || event.error || "Speech recognition error";
  currentListener?.onError(message);
});
