# EasyTasky — Project Rules

## Stack

- **Framework:** Expo SDK 58 / React Native 0.88 / React 19
- **Language:** TypeScript (`strict` mode)
- **Local persistence:** `expo-sqlite` (SQLite, fully on-device — no backend, no cloud)
- **State:** Zustand v5 (`src/store/useStore.ts` is the single source of truth; screens read from it)
- **Package manager:** npm (project uses `package-lock.json`, **not** bun — use `npx`, not `bunx`)

## Do this first

1. Read the `expo` major version in `package.json` and consult the matching versioned docs at
   `https://docs.expo.dev/versions/v<major>.0.0/` before touching any Expo/RN API. Do not trust training memory.
2. Run `npx expo install <package>` (never `npm install <package>`) to get SDK-compatible versions.
3. Run `npx tsc --noEmit` and `npx eslint .` before declaring any task done.

## Commands

```bash
npx expo install <package>   # ALWAYS for new native deps
npx expo start --lan         # dev server for Expo Go
npx tsc --noEmit             # typecheck
npx eslint .                 # lint
npx expo-doctor              # dependency/config health check
# Native APK build (needs ~1.5GB free disk + Android SDK):
npx expo prebuild --platform android
cd android && ./gradlew :app:assembleDebug
```

## Architecture & conventions

- **Navigation:** custom bottom-tab switch in `App.tsx` (`tasks|focus|review`). We do **not** use Expo Router here — keep it that way unless a screen truly needs its own stack.
- **Folder layout:**
  - `src/db/database.ts` — SQLite schema, seed data, `loadAll()`
  - `src/store/useStore.ts` — Zustand store + derived analytics (`getPeakHours`, `auditByDay`, `estimateForTitle`)
  - `src/screens/` — one file per tab screen
  - `src/components/ui.tsx` — shared primitives (`Card`, `Button`, `Chip`, `Input`, `ProgressBar`, `Pill`, `Screen`, `Spinner`)
  - `src/utils/time.ts` — date/time helpers, `uid()`
- **Data access:** mutations go through store actions which write to SQLite **and** update in-memory state. Never write `db.*` calls directly inside a screen.
- **Local-first:** don't add a backend/cloud sync unless explicitly requested.
- **Native config:** `android/` & `ios/` are generated (Continuous Native Generation). Never hand-edit them — configure native behavior in `app.json` / config plugins.
- **Expo Go** only bundles a fixed set of native modules; currently used modules (`expo-sqlite`, `react-native-safe-area-context`) are supported.

## Database schema (SQLite)

- `tasks(id, title, context, energy, quadrant, status, delegate_note, created_at, due_date, estimated_min, actual_min, timebox_end, is_habit)` — `is_habit` flags tasks shown in the picker's Habit tab.
- `activity_log(id, task_id, action, at, minutes)` — feeds audit + peak-time detection
- `time_blocks(id, day, start_min, end_min, label, type, buffer)` — planning blocks (20% buffer default)
- `pomodoro_sessions(id, task_id, focus_min, break_min, rounds, started_at, completed_at)`

## Use AI skills (not raw memory)

- Before designing/redesigning UI, building a screen, or evaluating design quality, load a relevant skill via the `skill` tool rather than improvising.
- Installed skills live in `~/.agents/skills/` and `~/.claude/skills/`. Search them (e.g. `find-skills`) for the closest match to the task.
- Most relevant to this app: `impeccable` / `design-taste-frontend` (UI polish + audit), `emil-design-eng` and `apple-design` (motion/interface feel), `high-end-visual-design` (polish), `imagegen-frontend-mobile` (screen concepts), `find-skills` (discovery), `full-output-enforcement` (complete code generation).
- If a skill's description matches the task, load it and follow its instructions; report which skill you used.
- External skill catalogs (e.g. taskskill.dev) may be used to find additional/installable skills — verify the source and installed location before relying on one.

## Interface principles

- **Progressive disclosure.** A screen shows its primary function first and hides configuration behind toggles. Never dump every control on screen at once (the Focus timer is the canonical example: dial + play/pause + stop on load; focus/break/task settings hidden behind the "Focus ›" header sheet).
- **One primary action per screen.** Keep the flow scannable; secondary actions use tonal/outlined buttons, never competing filled buttons.
- **State-conveying motion only** (short fades, ~180ms), no decorative animation.
- **Focus dial is a comet trail, not a static progress arc** (`src/screens/FocusScreen.tsx`). The 60-tick ring highlights while progressing: the leading tick under the sweep is full orange (`ACCENT`), and ticks behind it fade back to the gray base over `TRAIL_TICKS` (~15 ticks, opacity `(1 - since/TRAIL)^1.5`). When the sweep wraps past 12 o'clock again, the previous revolution's ticks are already faded to background gray — never leave a hard-edged elapsed arc sitting on the ring.
- **Focus is an immersive, full-bleed screen.** Render it edge-to-edge on black, outside the `SafeAreaView`/tab bar; the Android navigation bar is hidden via `expo-navigation-bar`'s `<NavigationBar hidden />` while the Focus tab is active (it reappears on other tabs). Users exit Focus with the top-left chevron-down, not the tab bar.
- Match the Material 3 idiom: filled = primary action, tonal = secondary, outlined = tertiary; 48dp touch targets.
- **Color contrast:** body/label text must clear 4.5:1 on its surface. `COLORS.accent` is for indicators/selection only and is **never** used as text; `muted`/`danger`/`warn` are tuned to clear 5.4:1 / 5.6:1 / 6.9:1 — keep them that dark. Don't lighten text tokens "for elegance".
- **Premium icons, no emoji.** Use `@expo/vector-icons` (Ionicons / MaterialIcons / Feather) for **all** in-app icons — `import { Ionicons } from "@expo/vector-icons"`. Never use emoji as a UI icon (🥇, ⚙️, ⏰, ↺, etc. are banned); emojis appear only if a user explicitly asks for one. Size/color via props tuned to `COLORS` tokens. Icons must stay crisp at any DPI and themeable.

## Design language — the dark system (Focus screen + FocusPicker)

The Focus screen and the FocusPicker (task/habit attach) define a distinct **dark, minimalist** surface. Any new screen/sheet that lives in the focus flow (timer, focus settings, picker, task/habit pick) MUST follow this language — do not mix it with the light `COLORS` theme.

- **Palette** (defined in `FocusScreen.tsx` / `FocusPicker.tsx`):
  - Background `#000000`, secondary surfaces `#141414` / `#171717` / `#1A1A1A`, chips `#1E1E1E`, hairline borders `#262626`.
  - Accent `#FA6E1E` (orange) — reserved for primary action, selection, active chip border/tint, and the dial's lit ticks. Never for large surfaces or body text.
  - Text: white `#FFFFFF` (primary), `#D6D6D6` (secondary), `#9C9C9C` (muted/labels), `#B8B8B8` (icon secondary).
- **Typography:** one system family. Compact, restrained sizes — body ~16, captions/labels ~12–13, section headers 13 uppercase-ish with letterspacing ~0.5, header title ~22 medium. Light/medium weights; no display fonts.
- **Shape & elevation:** flat, no drop shadows. Cards/surfaces use subtle fill + a 1–1.5px `#262626` hairline border. Chips are pill (radius 999), ~40–42px tall; the active chip is tinted `rgba(250,110,30,0.12)` with an orange border and orange label.
- **Touch targets:** ≥44px (chips/rows ~48–52px). Icon buttons ~44px round.
- **Bottom sheet** (settings/picker): dark `#161616` body, 24px top radius, ~20px padding, a "Done"/close action in the accent; content scrolls; never more than one primary action.
- **FocusPicker modal:** full-screen `#141414`; tabs (Task / Habit) with an orange underline on the active tab; a search field; flat rows grouped by sections (OVERDUE / TODAY / UPCOMING / NO DATE). No decorative headers, no quick-add chrome inside the picker.
- **Focus screen:** immersive black, edge-to-edge, hidden nav bar. Attached task/habit shows as a small truncating pill (`numberOfLines={1}` + `ellipsizeMode="tail"`) under the header; the dial uses the comet-trail rule above.
- Keep it sparse: generous spacing, minimal chrome, nothing decorative. When in doubt, match `FocusScreen.tsx` and `FocusPicker.tsx` exactly.

## AI integration (OpenAI-compatible)

- Client lives in `src/lib/aiClient.ts` (uses the native `fetch`, no extra deps). Config (`baseURL`, `apiKey`, `model`) is set in that file's `CONFIG`.
- `aiEnabled()` returns false until a base URL + model are set; all AI features must fail gracefully (fall back to heuristics) when disabled.
- Available: `parseTaskToForm` (NLP task creation → wired into the Tasks "Add" drawer as "Parse with AI"), `suggestNext`, `estimateWithAI`.
- **Never commit a real API key.** Keep placeholders in `CONFIG`; inject real values at build/runtime from an env or a git-ignored file. Ship-time keys on a client are inherently exposed — flag this tradeoff if deploying publicly.

## Product rules (the 13 time-management techniques)

The app exists to encode these — keep them coherent:
1. Time audit + peak-time detection
2. 20% buffer blocks
3. Time batching
4. Timeboxing (hard end times)
5. Shutdown ritual
6. Reference past completion + 25% buffer (`estimateForTitle`)
7. Eisenhower matrix
8. Delegate at 70% perfection
9. CEO 3-3-3 generator
10. Unwanted-tasks inbox
11. Pomodoro
12. Task context environment
13. Next-day planning
