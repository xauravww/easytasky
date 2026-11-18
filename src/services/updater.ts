import { NativeModules, Platform } from "react-native";
import { Paths, File as ExpoFile, DownloadTask } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  currentVersionCode: number;
  latestVersion: string;
  latestVersionCode: number;
  downloadUrl: string;
  changelog: string;
}

const UPDATE_CHECK_URL =
  "https://raw.githubusercontent.com/xauravww/easytasky/master/version.json";
const UPDATE_FALLBACK_URL =
  "https://cdn.jsdelivr.net/gh/xauravww/easytasky@master/version.json";

export const RELEASES_URL =
  "https://github.com/xauravww/easytasky/releases/latest";

export const ERR_UNKNOWN_SOURCES = "E_UNKNOWN_SOURCES";
const DISMISSED_UPDATE_KEY = "@easytasky/dismissed_update_version";

interface NativeAppUpdate {
  getAppVersion(): Promise<{ versionName: string; versionCode: number }>;
  installApk(filePath: string): Promise<boolean>;
}

const nativeAppUpdate = NativeModules.AppUpdate as NativeAppUpdate | undefined;

export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = v2.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export async function getCurrentAppVersion(): Promise<{
  versionName: string;
  versionCode: number;
}> {
  if (Platform.OS === "android" && nativeAppUpdate) {
    try {
      return await nativeAppUpdate.getAppVersion();
    } catch {}
  }
  return { versionName: "1.0.0", versionCode: 1 };
}

async function fetchWithTimeout(url: string, ms = 6000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // timeout or network failure
  } finally {
    clearTimeout(timer);
  }
  return null;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (Platform.OS !== "android") {
    return null;
  }

  let data = await fetchWithTimeout(`${UPDATE_CHECK_URL}?t=${Date.now()}`);
  if (!data || !data.version) {
    data = await fetchWithTimeout(`${UPDATE_FALLBACK_URL}?t=${Date.now()}`);
  }

  if (!data || !data.version) {
    return null;
  }

  const { versionName, versionCode } = await getCurrentAppVersion();
  const latestVersion = String(data.version).trim();
  const latestVersionCode = Number(data.versionCode) || 0;
  const downloadUrl = String(data.downloadUrl || "").trim();
  const changelog = String(data.changelog || "").trim();

  const isSemverHigher = compareVersions(latestVersion, versionName) > 0;
  const isCodeHigher = latestVersionCode > versionCode;
  const updateAvailable = (isSemverHigher || isCodeHigher) && !!downloadUrl;

  return {
    updateAvailable,
    currentVersion: versionName,
    currentVersionCode: versionCode,
    latestVersion,
    latestVersionCode,
    downloadUrl,
    changelog,
  };
}

export async function downloadAndInstallUpdate(
  downloadUrl: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (Platform.OS !== "android" || !nativeAppUpdate) {
    throw new Error("In-app update is only supported on Android");
  }

  const apkFile = new ExpoFile(Paths.cache, "easytasky-update.apk");

  // Remove stale download if exists
  try {
    if (apkFile.exists) {
      apkFile.delete();
    }
  } catch {}

  const task = new DownloadTask(downloadUrl, apkFile, {
    onProgress: (p) => {
      if (onProgress && p.totalBytes > 0) {
        onProgress(p.bytesWritten / p.totalBytes);
      }
    },
  });

  const downloaded = await task.downloadAsync();
  if (!downloaded) {
    throw new Error("Download was interrupted");
  }

  // Get raw local filesystem path (remove file:// prefix if present)
  const localUri = downloaded.uri.replace(/^file:\/\//, "");
  await nativeAppUpdate.installApk(localUri);
}

export async function getDismissedUpdateVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DISMISSED_UPDATE_KEY);
  } catch {
    return null;
  }
}

export async function setDismissedUpdateVersion(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_UPDATE_KEY, version);
  } catch {}
}
