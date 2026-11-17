// Talk mode: HeyGen TTS (speech out) + native on-device speech recognition
// (@react-native-voice/voice) for speech in. The HeyGen API key is user-supplied
// at runtime (never hardcoded) and stored in AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Voice from "@react-native-voice/voice";
import { getAiConfig } from "./aiClient";

const HEYGEN_STORAGE_KEY = "@easytasky/heygen-key";
const HEYGEN_TTS_URL = "https://api.heygen.com/v3/models/audio/tts";
const HEYGEN_TTS_STREAM_URL = "https://api.heygen.com/v3/models/audio/tts/stream";
const HEYGEN_VOICE = "83548de556df48ba8c09c42a57c51d85"; // Nadine (public)
const HEYGEN_MODEL = "heygen-voice-1-turbo-free";

let heygenKey = "";

export const loadHeyGenKey = async (): Promise<void> => {
  try {
    heygenKey = (await AsyncStorage.getItem(HEYGEN_STORAGE_KEY)) ?? "";
  } catch {}
};

export const getHeyGenKey = (): string => heygenKey;

export const saveHeyGenKey = async (key: string): Promise<void> => {
  heygenKey = key.trim();
  try {
    if (heygenKey) await AsyncStorage.setItem(HEYGEN_STORAGE_KEY, heygenKey);
    else await AsyncStorage.removeItem(HEYGEN_STORAGE_KEY);
  } catch {}
};

export const talkEnabled = (): boolean => !!heygenKey && !!getAiConfig().baseURL;

// ---- Text to Speech (HeyGen): returns an audio URL to play ----
export const synthesizeSpeech = async (text: string): Promise<string> => {
  if (!heygenKey) throw new Error("Add your HeyGen API key in Agent → Talk settings.");
  const res = await fetch(HEYGEN_TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": heygenKey },
    body: JSON.stringify({
      model: HEYGEN_MODEL,
      voice_id: HEYGEN_VOICE,
      text: text.slice(0, 10000),
      language: "en",
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
      voice_id: HEYGEN_VOICE,
      text: text.slice(0, 10000),
      language: "en",
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
        const j = JSON.parse(payload) as { type?: string; audio?: string; part_index?: number; detail?: string };
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

// ---- Speech to Text (native on-device recognition) ----
export type VoiceListener = {
  onResult: (text: string) => void;
  onPartial?: (text: string) => void;
  onError: (message: string) => void;
};

let voiceStarted = false;
let currentListener: VoiceListener | null = null;

Voice.onSpeechPartialResults = (e) => {
  const text = (e.value ?? []).join(" ").trim();
  if (text && currentListener?.onPartial) currentListener.onPartial(text);
};

Voice.onSpeechResults = (e) => {
  const text = (e.value ?? []).join(" ").trim();
  if (text && currentListener) currentListener.onResult(text);
};

Voice.onSpeechError = (e) => {
  const message = e.error?.message ?? e.error?.code ?? "Speech recognition error";
  if (currentListener) currentListener.onError(message);
};

export const startVoice = async (listener: VoiceListener): Promise<void> => {
  if (voiceStarted) return;
  currentListener = listener;
  await Voice.start("en-US");
  voiceStarted = true;
};

export const stopVoice = async (): Promise<string | null> => {
  if (!voiceStarted) return null;
  try {
    await Voice.stop();
  } catch {}
  voiceStarted = false;
  currentListener = null;
  return null;
};

export const destroyVoice = async (): Promise<void> => {
  try {
    await Voice.destroy();
  } catch {}
  voiceStarted = false;
  currentListener = null;
};
