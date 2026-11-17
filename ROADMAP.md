# TickTick parity backlog

Status legend: `[ ]` planned · `[~]` in progress · `[x]` done.

## Core features

- [x] **Recurring tasks** — daily / weekly / monthly repeat on normal tasks. On completion, auto-create the next instance. Foundation already exists in habits; generalize it. *Priority: high — biggest TickTick signature.*
- [ ] **Calendar view** — month grid (Review tab) showing tasks per day + focus-intensity heat strip.
- [x] **Exact due time + time-based reminders** — we store date-only; add time-of-day so reminders fire at a precise time (not just 09:00).
- [ ] **Smart "next best task" card** — surface `suggestNext` (aiClient) as a "Focus on this" suggestion on the Tasks/Today screen.
- [ ] **Per-task focus summary chip** — show total `actual_min` and a small timer chip on each task row.

## Interactions / polish

- [ ] **Swipe actions on rows** — `react-native-gesture-handler` (bundled in Expo Go): swipe to complete / snooze to tomorrow / delete.
- [ ] **Notes markdown** — render `note` with react-native-markdown-display (already a dep).
- [ ] **Review charts** — weekly focus bars + GitHub-style streak calendar.

## Done

- [x] Habits (schema, screen, streaks, tab)
- [x] Recurring tasks (repeat_rule + auto respawn on completion)
- [x] Calendar view (month grid + focus heat + per-day tasks)
- [x] Exact due-time reminders (remind_time presets)
- [x] Task detail sheet (notes, subtasks, energy/quadrant, start-focus)
- [x] User-supplied AI keys (settings gear → AsyncStorage)
- [x] Local due-date reminders (expo-notifications)
- [x] Stopwatch focus mode + exact-second session logging
- [x] Dark restyle of HabitsScreen, shared `fmtDue`
- [x] "Today · X focused" counter on Focus

## Notes / security

- A real API key once existed in `src/lib/aiClient.ts` working tree (never committed). If it was shared anywhere, **rotate it**.
- Recurring-task repeat rules should mirror habits' `habit_freq`/`habit_days` columns where possible.
