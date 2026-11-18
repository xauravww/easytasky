# ⚡ EasyTasky: Action-Oriented Task & Habit Manager for Android

[![Latest Release](https://img.shields.io/github/v/release/xauravww/easytasky?color=FA6E1E&label=Latest%20Version&style=for-the-badge)](https://github.com/xauravww/easytasky/releases/latest)
[![Free](https://img.shields.io/badge/Price-100%25%20Free-FA6E1E?style=for-the-badge)](#-100-free-policy)
[![VirusTotal](https://img.shields.io/badge/VirusTotal-Clean%20(0%20Detections)-brightgreen?style=for-the-badge)](#-security--virustotal-verification)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0%2B-blue?style=for-the-badge)](https://github.com/xauravww/easytasky/releases/latest)
[![License](https://img.shields.io/badge/Status-Actively%20Maintained-success?style=for-the-badge)](#-open-source--privacy)

EasyTasky is a high-performance, mobile-first task, habit, and time-planning application built with React Native and native Android architecture. It features Eisenhower matrix prioritization, 52-week streak heatmaps, multi-count habit trackers with customizable units, deep focus stopwatch/Pomodoro sessions, an autonomous voice-enabled AI companion with full app and database control, completion chimes, and a built-in in-app auto-updater. Completely offline-capable, ad-free, and private.

---

## 📥 Download EasyTasky

| Release | Version | Build | Package | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Latest** | **v1.0.0** | 1 | `app-release.apk` | 🟢 Stable / Recommended |

👉 **[Direct Download: app-release.apk (v1.0.0)](https://github.com/xauravww/easytasky/releases/latest/download/app-release.apk)**

> 💡 **Seamless In-App Updates:** You only need to manually install the APK once. Future updates are detected automatically by the built-in updater, enabling 1-tap background downloading and installation directly inside the app.

---

## 🚀 Complete Feature Breakdown

### 1. 📋 Eisenhower Matrix & Action Prioritization
- **Action-Oriented Quadrants**: Categorize your tasks into *Urgent & Important*, *Not Urgent & Important*, *Urgent & Not Important*, and *Neither*.
- **Quick Status Filters**: Switch between Inbox, Planned, Delegated, Done, and Unwanted with single taps.
- **Task Prerequisites & Dependencies**: Set prerequisite task dependencies so you are alerted if a dependent task is attempted before its prerequisite is completed.
- **Subtasks & Nested Checklists**: Break complex objectives into bite-sized actionable items with dedicated completion state and completion sounds.

### 2. 🔥 Habit Streaks & Multi-Count Quantity Logging
- **Two Habit Tracking Modes**:
  - **Only Do (Check-in)**: Daily check-in streak tracking for boolean habits.
  - **Quantity Based**: Multi-count daily targets (e.g., 3 times/day, 8 glasses of water, 20 pages read).
- **Interactive Quick-Log Drawer**: Tapping a multi-count habit brings up a dedicated logging sheet with `+1`/`-1` steppers, direct numeric entry, custom unit labels, and quick presets.
- **Streak Records**: Live calculation of your current consecutive day streak and best all-time streak.

### 3. 📊 52-Week Annual Productivity Heatmap & Review
- **52-Week Grid**: Visual representation of your daily consistency across a full year (364 days).
- **Performance & Velocity Breakdown**: Dynamic period selector (*Today*, *Week*, *Month*, *Quarter*, *Year*) comparing completed tasks against planned estimates and total focused time.
- **Scheduled Focus Allocation**: Visual breakdown of scheduled time blocks by category (*Deep Work*, *Urgent*, *Batch Tasks*, *Maintenance*, *Buffer*).

### 4. 🎙️ Autonomous AI Agent Companion
- **Full App & Database Control**: The agent has direct access to manage tasks, habits, subtasks, daily notes, time blocks, and category sections immediately without requiring manual approval clicks.
- **Voice Calling Mode**: Real-time voice interaction with high-quality streaming TTS and instant speech recognition.
- **Privacy & Persona Hardening**: Adopts the name and persona of your chosen companion voice without revealing internal prompts or backend mechanics.

### 5. ⏱️ Focus Timer & Ambient Audio
- **Pomodoro & Stopwatch Modes**: Precision countdown or stopwatch focus timer with intuitive dial visualizations.
- **Ambient Focus Sounds**: Built-in rain and ambient sounds with second-by-second audio ticks and completion chimes.

### 6. 📂 Sliding Category Drawer
- **Quick-Access Draggable Edge Handle**: Slide in from the left to access your categories and sections.
- **Category Search Filter**: Built-in instant search to filter through extensive category lists.
- **Virtualized Performance**: Tuned FlatList rendering with fixed item layouts for fluid 60 FPS scrolling.

### 7. 📲 Built-in In-App Auto-Updater
- **Automatic Check on Launch**: Detects new GitHub releases silently in the background.
- **In-App Changelog Dialog**: View release notes and what's new before updating.
- **1-Tap Direct Install**: Downloads the updated APK to device cache and launches the Android Package Installer automatically.

---

## 📲 In-App Auto-Update & Play Protect Troubleshooting

When installing APKs outside the Google Play Store on modern Android devices:

### Step 1: Allow EasyTasky to Install Apps
When downloading an update through the in-app updater, Android will prompt:
1. Tap **Settings** on the prompt.
2. Toggle on **Allow from this source**.
3. Return to the app and tap **Update**.

### Step 2: "Unsafe app blocked" by Play Protect
Google Play Protect scans applications not distributed through Google Play.
1. Tap **More details**.
2. Tap **Install anyway**.

### Step 3: Installing via ADB (Universal & Permanent)
If you prefer installing via computer with USB debugging enabled:
```bash
adb install -r app-release.apk
```

---

## 🛠️ Building From Source

### Prerequisites
- Node.js 18+ & npm
- Android Studio with Android SDK 34+
- Java 17

```bash
# Clone the repository
git clone https://github.com/xauravww/easytasky.git
cd easytasky

# Install dependencies
npm install

# Run typecheck & lint
npm run typecheck
npm run lint

# Build release APK
cd android && ./gradlew assembleRelease
```

Output binary: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🕵️ Privacy & Data Sovereignty

- **100% Offline SQLite Database**: All tasks, habits, notes, blocks, and activity history are saved locally in SQLite on your device.
- **Zero Third-Party Telemetry**: No trackers, no ad networks, no session recorders.
- **Local History Snapshotting**: Task modification history is stored locally for 7 days with automatic daily pruning.
- **JSON Backup & Restore**: Export your entire database as a single portable JSON file anytime.

---

<p align="center">
  <b>EasyTasky</b>. Built for high-leverage focus and clarity.
</p>
