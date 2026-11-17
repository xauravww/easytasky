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

- **Progressive disclosure.** A screen shows its primary function first and hides configuration behind toggles. Never dump every control on screen at once (the Focus timer is the canonical example: dial + play/pause + stop on load; durations and task/habit attach live behind the "Focus ›" full-screen picker; the Tasks quick-add is collapsed behind the header "Add" button).
- **One primary action per screen.** Keep the flow scannable; secondary actions use tonal/outlined buttons, never competing filled buttons.
- **State-conveying motion only** (short fades, ~180ms), no decorative animation.
- **Focus dial is a comet trail, not a static progress arc** (`src/screens/FocusScreen.tsx`). The 60-tick ring highlights while progressing: the leading tick under the sweep is full orange (`ACCENT`), and ticks behind it fade back to the gray base over `TRAIL_TICKS` (~15 ticks, opacity `(1 - since/TRAIL)^1.5`). When the sweep wraps past 12 o'clock again, the previous revolution's ticks are already faded to background gray — never leave a hard-edged elapsed arc sitting on the ring.
- **Focus is an immersive, full-bleed screen.** Render it edge-to-edge on black, outside the `SafeAreaView`/tab bar; the Android navigation bar is hidden via `expo-navigation-bar`'s `<NavigationBar hidden />` while the Focus tab is active (it reappears on other tabs). Users exit Focus with the top-left chevron-down, not the tab bar.
- Match the Material 3 idiom: filled = primary action, tonal = secondary, outlined = tertiary; 48dp touch targets.
- **Color contrast:** body/label text must clear 4.5:1 on its surface. `COLORS.accent` is for indicators/selection only and is **never** used as text; `muted`/`danger`/`warn` are tuned to clear 5.4:1 / 5.6:1 / 6.9:1 — keep them that dark. Don't lighten text tokens "for elegance".
- **Premium icons, no emoji.** Use `@expo/vector-icons` (Ionicons / MaterialIcons / Feather) for **all** in-app icons — `import { Ionicons } from "@expo/vector-icons"`. Never use emoji as a UI icon (🥇, ⚙️, ⏰, ↺, etc. are banned); emojis appear only if a user explicitly asks for one. Size/color via props tuned to `COLORS` tokens. Icons must stay crisp at any DPI and themeable.

## Design language — the dark system (Focus screen + FocusPicker)

The Focus screen supports two engine modes (`pomo.mode`, switched via the pill above the dial, locked while running): **pomodoro** (countdown, auto focus/break transitions, `endAt`-driven) and **stopwatch** (count-up, no total, `startAt`-driven, logged as one session with `rounds: 1` on stop). `pomo.left` means "remaining" in pomodoro and "elapsed" in stopwatch — always branch on `mode` before interpreting it. The dial snake sweeps one lap per minute in both modes; the clock renders H:MM:SS past one hour. **Sessions log exact seconds** (`focus_sec`/`break_sec` columns; `focus_min` stays as a rounded legacy field) — even a few seconds of focus is recorded, and the "Today · X focused" counter formats as s / m s / h m.

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

## Design language — light screens (Tasks, Today, Review)

The light theme screens share the `COLORS` tokens and follow these conventions (Tasks page is the reference implementation):

- **Structure over card walls.** A screen is a header + sections, not a stack of equal white cards. Section = title (16–18, 700) + count pill (`accentSoft` bg, `primary` text, radius 999) + content, separated by whitespace (`marginBottom: 22`), no per-section card box.
- **Screen header:** display-size title (30, 700, tight letter-spacing) + one muted sub line ("12 open · 3 due today"); the primary action (e.g. "Add") is a filled pill in the header row, never buried in content.
- **Quick-add is collapsed by default.** Tapping the header button expands the form panel (input + quadrant/energy chips + estimate pill + filled submit) and collapses after submit. Forms that add to different lists must each own their input state — never share one `title` across two forms.
- **Rows, not buttons.** A task row = tap-to-complete check circle (24px, 2px `primary` border) + title (15, 600) + one muted meta line (quadrant · energy · estimate) + ghost icon actions (38–40px hit target, `muted` icons). **Never place full-width outlined "Done"/"Delete" buttons on every row.** Destructive ghosts use `danger` only in the section where destruction is the point (avoid list).
- **Eisenhower matrix is a real 2×2 grid** (two `~49%` cells per row, 10px gap), each cell a soft tint (`dangerSoft` / `accentSoft` / `warnSoft` / `tint`), radius 14, no border. Cell = colored icon + label + count, then compact rows (16px check + one-line title + one icon action per cell: delegate in "Delegate", park in others). Collapsible via chevron.
- **Empty states everywhere a list can be empty:** one confident line + one hint line (`EmptyState`), never a bare "—".
- **Press feedback on every tappable:** `pressed && { opacity: 0.5–0.85 }` or a 0.96 scale; nothing reacts instantly with zero visual change.

## Habits (reference: HabitsScreen)

Habits are tasks with `is_habit: 1`, `status: "habit"`, plus `habit_freq` ("daily" | "weekly"), `habit_days` (comma weekday ints, weekly only), `habit_color` (hex). Check-ins live in the `habit_checks` table (`habit_id` + `day` key, UNIQUE pair) — never encode streaks in the task row.

- **HabitsScreen is dark** (same tokens as TasksScreen: BG `#141414`, cards `#1A1A1A`, lines `#262626`, ink `#FFFFFF`/`#9C9C9C`, accent `#FA6E1E`) — it does **not** use the legacy light `ui.tsx` kit (`COLORS`/`Screen`/`Chip`/`EmptyState`). Keep it in the dark family.
- **Exclusion rule:** every task list (TasksScreen, FocusPicker Task tab, Chat suggestions) must filter out `status === "habit"` / `is_habit === 1`. The Habit tab in FocusPicker filters `is_habit === 1`.
- **Check-in UX:** tap the colored check circle (habit's own `habit_color`, 2.5px border) → filled circle + white check via `toggleHabit(habitId, dayKey())`. Deleting a habit cascades its checks (`deleteTask`).
- **Streak math** comes from the shared `habitStreak(checks, habitId)` helper in `useStore.ts` — consecutive days ending today (or yesterday if today is unchecked). Never re-implement per screen.
- **Habit rows show:** streak line (flame icon, amber when lit) + frequency (weekday letters for weekly) + 7 trailing mini-dots (last 7 days, filled with habit color).
- **Screen header** mirrors the dark screens: display-size title + one muted sub line ("N habits · X/Y done today"); above it a week strip card (7 day circles, today ringed in `primary`, days with any check-in filled accent). Primary action ("Add") is a filled orange pill in the header row.
- **Add form:** collapsed panel with title, Daily/Weekly chips, weekday chips (weekly), 5-color swatch palette (`#E5484D #D8B62E #4CC3E8 #12B76A #8B5CF6`).

## Local notifications (src/lib/notifications.ts)

`expo-notifications` (~58.1.9, plugin added to app.json with accent `#FA6E1E`). One convention: reminders are a **derived schedule**, reconciled wholesale.

- `syncTaskReminders(tasks)` cancels every notification we scheduled (tracked in a module-level `Map<taskId, identifier>` — the identifier comes from `scheduleNotificationAsync`'s return value, not an input field) and re-registers reminders for open, dated, non-habit tasks: fires 09:00 local on `due_date`, past slots skipped.
- Call `syncTaskReminders` (fire-and-forget `void`) after **every** task mutation (`init`, `addTask`, `updateTask`, `deleteTask`) — completion/reschedule/cancel all fall out of the same reconcile. Never schedule per-feature.
- Permissions + the `reminders` channel are requested lazily once (`permAsked` flag) inside the first sync; Android 13+ needs the channel before the prompt appears.
- Notification handler (`setNotificationHandler`) lives in module scope so banners show while the app is foregrounded.
- Changing native notification config (icon, color, sounds) requires a prebuild + native rebuild.

## Task detail & subtasks (reference: TaskDetailSheet)

- **Row anatomy:** energy bar → check circle (tap = complete) → title (tap = open detail sheet) → due pill. The circle and the row are separate Pressables — never make completion open an editor.
- **Detail sheet owns editing.** Title + note save on `onEndEditing` and on scrim tap (`saveMeta`); quadrant/energy chips save immediately on tap; done/delete act immediately. No "Save" button.
- **Start focus handoff:** the sheet's "Start focus" row calls `startFocusFor(taskId)` (store) — it attaches the task, bumps `focusReq`, and starts the timer if idle; the App shell subscribes to `focusReq` and jumps to the immersive Focus screen. Any screen can trigger focus this way; never pass navigation props down for it.
- **Subtasks** live in the `subtasks` table (`task_id`, `sort`, `done`); add via input + plus button (return key submits), toggle = mini teal check, delete = ghost ×. `deleteTask` cascades subtasks.
- Shared `fmtDue` lives in `src/utils/taskFormat.ts` — never re-implement due-date labels per screen (and never use `toISOString().slice(0,10)` for "today" — that's UTC; use `dayKey()`).

## AI integration (OpenAI-compatible)

- Client lives in `src/lib/aiClient.ts` (uses the native `fetch`, no extra deps). **Config is user-supplied at runtime** — Chat › gear opens `SettingsModal` (base URL, model, optional API key with visibility toggle, Test connection), persisted to AsyncStorage (`@easytasky/ai-config`) and loaded during store `init`. Never hardcode credentials in source.
- `aiEnabled()` is true only when base URL + model are set (local endpoints like Ollama need no key). All AI features must fail gracefully (fall back to heuristics) when disabled.
- Components read config via `getAiConfig()` (not a snapshot import) and re-check `aiEnabled()` after the settings modal saves.
- Available: `parseTaskToForm` (Tasks "Parse with AI" — button only renders when enabled), `suggestNext`, `estimateWithAI`, `chatStream` (Chat), `testAiConnection` (settings sheet).
- Keys live in plaintext AsyncStorage — device-local by design; acceptable for a personal app, flag the tradeoff if this ever ships to stores.

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
