// Cloud Backup Client supporting:
// 1. GitHub Classic Personal Access Token (PAT) with unique private repo (e.g. `easytasky-backup`)
// 2. Google Drive OAuth (Access Token) or Service Account
import AsyncStorage from "@react-native-async-storage/async-storage";

export type GitHubConfig = {
  token: string;
  repo: string;
  owner?: string;
  lastBackupAt?: string;
};

export type GoogleDriveConfig = {
  accessToken: string; // OAuth Access Token or Service Account OAuth Token
  userEmail?: string;
  folderId?: string;
  lastBackupAt?: string;
};

const GITHUB_CONFIG_KEY = "@easytasky/backup_github_config";
const GDRIVE_CONFIG_KEY = "@easytasky/backup_gdrive_config";

export const getGitHubConfig = async (): Promise<GitHubConfig | null> => {
  try {
    const raw = await AsyncStorage.getItem(GITHUB_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveGitHubConfig = async (cfg: GitHubConfig): Promise<void> => {
  await AsyncStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(cfg));
};

export const clearGitHubConfig = async (): Promise<void> => {
  await AsyncStorage.removeItem(GITHUB_CONFIG_KEY);
};

export const getGoogleDriveConfig = async (): Promise<GoogleDriveConfig | null> => {
  try {
    const raw = await AsyncStorage.getItem(GDRIVE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveGoogleDriveConfig = async (cfg: GoogleDriveConfig): Promise<void> => {
  await AsyncStorage.setItem(GDRIVE_CONFIG_KEY, JSON.stringify(cfg));
};

export const clearGoogleDriveConfig = async (): Promise<void> => {
  await AsyncStorage.removeItem(GDRIVE_CONFIG_KEY);
};

// Pure JavaScript Base64 encoder/decoder (works in React Native without Node Buffer)
const b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export const toBase64 = (input: string): string => {
  const utf8Bytes = encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  let output = "";
  let chr1: number, chr2: number, chr3: number;
  let enc1: number, enc2: number, enc3: number, enc4: number;
  let i = 0;

  while (i < utf8Bytes.length) {
    chr1 = utf8Bytes.charCodeAt(i++);
    chr2 = utf8Bytes.charCodeAt(i++);
    chr3 = utf8Bytes.charCodeAt(i++);

    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = isNaN(chr2) ? 64 : ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = isNaN(chr2) || isNaN(chr3) ? 64 : chr3 & 63;

    output +=
      b64chars.charAt(enc1) +
      b64chars.charAt(enc2) +
      b64chars.charAt(enc3) +
      b64chars.charAt(enc4);
  }
  return output;
};

export const fromBase64 = (input: string): string => {
  const cleanInput = input.replace(/[^A-Za-z0-9+/=]/g, "");
  let output = "";
  let chr1: number, chr2: number, chr3: number;
  let enc1: number, enc2: number, enc3: number, enc4: number;
  let i = 0;

  while (i < cleanInput.length) {
    enc1 = b64chars.indexOf(cleanInput.charAt(i++));
    enc2 = b64chars.indexOf(cleanInput.charAt(i++));
    enc3 = b64chars.indexOf(cleanInput.charAt(i++));
    enc4 = b64chars.indexOf(cleanInput.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }

  return decodeURIComponent(
    output
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
};

// ==========================================
// GITHUB BACKUP & RESTORE IMPLEMENTATION
// ==========================================

export const testGitHubAuth = async (token: string): Promise<{ login: string }> => {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `token ${token.trim()}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "EasyTasky-App",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub auth failed (${res.status}): ${body || res.statusText}`);
  }
  const user = await res.json();
  return { login: user.login };
};

export const ensureGitHubRepo = async (token: string, repoName: string): Promise<string> => {
  const headers = {
    Authorization: `token ${token.trim()}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "EasyTasky-App",
  };

  const user = await testGitHubAuth(token);
  const targetRepo = repoName.trim() || "easytasky-backup";

  // Check if repo exists
  const checkRes = await fetch(`https://api.github.com/repos/${user.login}/${targetRepo}`, {
    headers,
  });

  if (checkRes.ok) {
    return `${user.login}/${targetRepo}`;
  }

  // Create unique private repo if it does not exist
  const createRes = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: targetRepo,
      description: "Private automated backups for EasyTasky",
      private: true,
      auto_init: true,
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text().catch(() => "");
    throw new Error(`Could not create private repo "${targetRepo}": ${errBody}`);
  }

  return `${user.login}/${targetRepo}`;
};

export const backupToGitHub = async (
  token: string,
  repo: string,
  jsonData: string
): Promise<{ commitUrl: string; sha: string; repo: string }> => {
  const fullRepo = await ensureGitHubRepo(token, repo);
  const path = "backup.json";
  const url = `https://api.github.com/repos/${fullRepo}/contents/${path}`;
  const headers = {
    Authorization: `token ${token.trim()}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "EasyTasky-App",
    "Content-Type": "application/json",
  };

  // Get current sha if file already exists
  let sha: string | undefined;
  const getRes = await fetch(url, { headers });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  const contentB64 = toBase64(jsonData);
  const putRes = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `EasyTasky backup ${new Date().toISOString()}`,
      content: contentB64,
      sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text().catch(() => "");
    throw new Error(`Failed to upload backup to GitHub: ${err}`);
  }

  const putData = await putRes.json();
  const commitSha = putData?.commit?.sha || putData?.content?.sha || "updated";
  return {
    commitUrl: putData?.commit?.html_url || `https://github.com/${fullRepo}`,
    sha: commitSha,
    repo: fullRepo,
  };
};

export const restoreFromGitHub = async (token: string, repo: string): Promise<string> => {
  const user = await testGitHubAuth(token);
  const targetRepo = repo.trim() || "easytasky-backup";
  const path = "backup.json";
  const url = `https://api.github.com/repos/${user.login}/${targetRepo}/contents/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token.trim()}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "EasyTasky-App",
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`No backup.json found in private repo "${user.login}/${targetRepo}".`);
    }
    const err = await res.text().catch(() => "");
    throw new Error(`Failed to retrieve backup from GitHub (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.content) {
    throw new Error("Backup file content is empty on GitHub.");
  }
  return fromBase64(data.content);
};

// ==========================================
// GOOGLE DRIVE (OAUTH / SERVICE ACC) IMPLEMENTATION
// ==========================================

export const testGoogleDriveAuth = async (accessToken: string): Promise<{ email: string }> => {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });
  if (!res.ok) {
    // Try tokeninfo endpoint if userinfo is restricted
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken.trim()}`);
    if (tokenInfoRes.ok) {
      const info = await tokenInfoRes.json();
      return { email: info.email || "Google Account" };
    }
    throw new Error("Invalid or expired Google OAuth Access Token.");
  }
  const info = await res.json();
  return { email: info.email || "Connected Google Account" };
};

export const backupToGoogleDrive = async (
  accessToken: string,
  jsonData: string
): Promise<{ fileId: string }> => {
  const token = accessToken.trim();
  const fileName = "easytasky_backup.json";

  // Check if easytasky_backup.json already exists in user's Drive
  const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  let existingFileId: string | null = null;
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      existingFileId = searchData.files[0].id;
    }
  }

  if (existingFileId) {
    // Update existing file content
    const updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: jsonData,
      }
    );
    if (!updateRes.ok) {
      const err = await updateRes.text().catch(() => "");
      throw new Error(`Google Drive update failed (${updateRes.status}): ${err}`);
    }
    return { fileId: existingFileId };
  } else {
    // Create new file with multipart upload
    const metadata = {
      name: fileName,
      mimeType: "application/json",
      description: "EasyTasky automated application backup",
    };

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      jsonData +
      closeDelimiter;

    const createRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text().catch(() => "");
      throw new Error(`Google Drive upload failed (${createRes.status}): ${err}`);
    }

    const createdData = await createRes.json();
    return { fileId: createdData.id };
  }
};

export const restoreFromGoogleDrive = async (accessToken: string): Promise<string> => {
  const token = accessToken.trim();
  const fileName = "easytasky_backup.json";

  const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=modifiedTime desc`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    const err = await searchRes.text().catch(() => "");
    throw new Error(`Google Drive search failed: ${err}`);
  }

  const searchData = await searchRes.json();
  if (!searchData.files || searchData.files.length === 0) {
    throw new Error(`No "${fileName}" found in your Google Drive.`);
  }

  const fileId = searchData.files[0].id;
  const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!getRes.ok) {
    const err = await getRes.text().catch(() => "");
    throw new Error(`Failed to download backup from Google Drive: ${err}`);
  }

  return getRes.text();
};
