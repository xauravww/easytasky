// OpenAI-compatible client. Config is user-supplied at runtime (Chat › settings gear)
// and persisted in AsyncStorage — never hardcode a real key here.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type AIConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

const STORAGE_KEY = "@easytasky/ai-config";

let CONFIG: AIConfig = { baseURL: "", apiKey: "", model: "" };

export const getAiConfig = (): AIConfig => CONFIG;

export const aiEnabled = (): boolean => !!CONFIG.baseURL && !!CONFIG.model;

// One-shot completion with a custom system prompt (used by agents).
export const aiChatSystem = async (system: string, user: string): Promise<string> => {
  return chat([{ role: "system", content: system }, { role: "user", content: user }], false);
};

export const loadAiConfig = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) CONFIG = { ...CONFIG, ...(JSON.parse(raw) as Partial<AIConfig>) };
  } catch (err) {
    console.warn("loadAiConfig failed", err);
  }
};

export const saveAiConfig = async (next: Partial<AIConfig>): Promise<void> => {
  CONFIG = { ...CONFIG, ...next };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ baseURL: CONFIG.baseURL, apiKey: CONFIG.apiKey, model: CONFIG.model }));
  } catch (err) {
    console.warn("saveAiConfig failed", err);
  }
};

export const clearAiConfig = async (): Promise<void> => {
  CONFIG = { baseURL: "", apiKey: "", model: "" };
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("clearAiConfig failed", err);
  }
};

// Minimal live request to validate the user's settings; resolves with the reply
// text or throws with the provider's error.
export const testAiConnection = async (): Promise<string> => {
  const raw = await chat([{ role: "user", content: "Reply with the word: ready" }], false);
  return raw.trim().slice(0, 120);
};

type Msg = { role: "system" | "user" | "assistant"; content: string };

const chat = async (messages: Msg[], json = true): Promise<string> => {
  if (!aiEnabled()) throw new Error("AI is not configured");
  const url = `${CONFIG.baseURL.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (CONFIG.apiKey) headers.Authorization = `Bearer ${CONFIG.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: CONFIG.model,
      messages,
      temperature: 0.2,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
};

const safeJson = (raw: string): Record<string, unknown> => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {}
    }
    throw new Error("AI returned invalid JSON");
  }
};

const QUADRANTS = ["urgent_important", "not_urgent_important", "urgent_not_important", "neither"] as const;
const ENERGIES = ["low", "medium", "high"] as const;

export type ParsedTask = {
  title: string;
  quadrant: (typeof QUADRANTS)[number];
  energy: (typeof ENERGIES)[number];
};

export const parseTaskToForm = async (text: string): Promise<ParsedTask> => {
  const raw = await chat([
    { role: "system", content: "You are a task parser. Respond with JSON only." },
    {
      role: "user",
      content: `Parse this task into JSON: {"title": string, "quadrant": one of ${QUADRANTS.join(", ")}, "energy": one of ${ENERGIES.join(", ")}}.\nInput: "${text}"`,
    },
  ]);
  const j = safeJson(raw);
  const title = typeof j.title === "string" && j.title.trim() ? j.title.trim() : text.trim();
  const quadrant = QUADRANTS.includes(j.quadrant as never)
    ? (j.quadrant as (typeof QUADRANTS)[number])
    : "not_urgent_important";
  const energy = ENERGIES.includes(j.energy as never) ? (j.energy as (typeof ENERGIES)[number]) : "medium";
  return { title, quadrant, energy };
};

export type Suggestion = { id: string; reason: string };

export const suggestNext = async (items: { id: string; title: string }[]): Promise<Suggestion[]> => {
  const raw = await chat([
    { role: "system", content: "You pick the next best task. Respond with JSON only." },
    {
      role: "user",
      content: `Rank these tasks by what to do next. Return JSON: {"suggestions":[{"id": string, "reason": string}]} keeping at most 3.\nTasks: ${JSON.stringify(items)}`,
    },
  ]);
  const j = safeJson(raw);
  const list = Array.isArray(j.suggestions) ? (j.suggestions as { id?: string; reason?: string }[]) : [];
  return list
    .filter((s) => typeof s.id === "string")
    .map((s) => ({ id: s.id as string, reason: typeof s.reason === "string" ? s.reason : "" }));
};

export const chatMessage = async (
  history: { role: "user" | "assistant"; content: string }[]
): Promise<string> => {
  const msgs: Msg[] = [
    {
      role: "system",
      content:
        "You are EasyTasky's assistant. Be concise and helpful. You can propose tasks (title, quadrant, energy) when useful.",
    },
    ...history.map((h) => ({ role: h.role as Msg["role"], content: h.content })),
  ];
  return chat(msgs, false);
};

const decodeChunk = (value: Uint8Array): string => {
  try {
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(value);
  } catch {}
  let s = "";
  for (let i = 0; i < value.length; i++) s += String.fromCharCode(value[i]);
  return s;
};

export const chatStream = async (
  history: { role: "user" | "assistant"; content: string }[],
  onDelta: (text: string) => void
): Promise<string> => {
  if (!aiEnabled()) throw new Error("AI is not configured");
  const url = `${CONFIG.baseURL.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (CONFIG.apiKey) headers.Authorization = `Bearer ${CONFIG.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: CONFIG.model,
      temperature: 0.3,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are EasyTasky's assistant. Be concise and helpful. You can propose tasks (title, quadrant, energy) when useful.",
        },
        ...history.map((h) => ({ role: h.role, content: h.content })),
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body}`);
  }
  const reader = res.body.getReader();
  let buf = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decodeChunk(value);
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const delta = j?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {}
    }
  }
  return full;
};

export const estimateWithAI = async (title: string, samples: { title: string; minutes: number }[]): Promise<number> => {
  const raw = await chat([
    { role: "system", content: "You estimate task durations in minutes. Respond with JSON only." },
    {
      role: "user",
      content: `Predict minutes needed for "${title}" using past samples. Add a 25% buffer. Return JSON: {"minutes": number}.\nSamples: ${JSON.stringify(samples)}`,
    },
  ]);
  const j = safeJson(raw);
  const minutes = Number(j.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("Invalid estimate");
  return Math.round(minutes);
};
