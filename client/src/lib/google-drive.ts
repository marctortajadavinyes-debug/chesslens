declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: GoogleTokenError) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenError {
  type: string;
  message?: string;
}

export type DriveTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: string };

export type DriveFolderResult =
  | { ok: true; folderId: string }
  | { ok: false; error: string };

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_CACHE_KEY = "chesslens.driveFolderId.chessGames";
const DRIVE_FOLDER_NAME = "Chess Games";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

// --- Token ---

export function requestGoogleDriveToken(): Promise<DriveTokenResult> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  if (!clientId || clientId.trim() === "") {
    return Promise.resolve({
      ok: false,
      error:
        "VITE_GOOGLE_CLIENT_ID is not configured. Add it to your Replit Secrets.",
    });
  }

  if (typeof window.google?.accounts?.oauth2?.initTokenClient !== "function") {
    return Promise.resolve({
      ok: false,
      error:
        "Google Identity Services script not loaded yet. Try again in a moment.",
    });
  }

  return new Promise<DriveTokenResult>((resolve) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response: GoogleTokenResponse) => {
        if (response.access_token) {
          resolve({ ok: true, accessToken: response.access_token });
        } else {
          resolve({
            ok: false,
            error:
              response.error_description ??
              response.error ??
              "No access token returned.",
          });
        }
      },
      error_callback: (err: GoogleTokenError) => {
        resolve({
          ok: false,
          error: err.message ?? err.type ?? "Google token request failed.",
        });
      },
    });

    client.requestAccessToken({ prompt: "consent" });
  });
}

// --- Folder cache helpers ---

function readCachedFolderId(): string | null {
  try {
    const v = window.localStorage.getItem(FOLDER_CACHE_KEY);
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeCachedFolderId(id: string): void {
  try {
    window.localStorage.setItem(FOLDER_CACHE_KEY, id);
  } catch {
    // ignore — cache is non-critical
  }
}

function clearCachedFolderId(): void {
  try {
    window.localStorage.removeItem(FOLDER_CACHE_KEY);
  } catch {
    // ignore
  }
}

// --- Drive API helpers ---

async function searchFolder(
  accessToken: string,
): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${DRIVE_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
  );
  const url = `${DRIVE_API}/files?q=${q}&fields=files(id)&pageSize=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Drive files.list failed: ${text}`);
  }
  const data: { files?: { id: string }[] } = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function createFolder(accessToken: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: FOLDER_MIME,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Drive files.create failed: ${text}`);
  }
  const data: { id?: string } = await res.json();
  if (!data.id) throw new Error("Drive did not return a folder id.");
  return data.id;
}

async function verifyFolder(
  accessToken: string,
  folderId: string,
): Promise<boolean> {
  const url = `${DRIVE_API}/files/${folderId}?fields=id,trashed`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;
  const data: { id?: string; trashed?: boolean } = await res.json();
  return !!data.id && data.trashed !== true;
}

// --- Public: ensure folder ---

export async function ensureChessDriveFolder(
  accessToken: string,
): Promise<DriveFolderResult> {
  try {
    // 1. Try cached id first
    const cached = readCachedFolderId();
    if (cached) {
      const valid = await verifyFolder(accessToken, cached);
      if (valid) {
        return { ok: true, folderId: cached };
      }
      clearCachedFolderId();
    }

    // 2. Search for existing folder
    let folderId = await searchFolder(accessToken);

    // 3. Create if not found
    if (!folderId) {
      folderId = await createFolder(accessToken);
    }

    writeCachedFolderId(folderId);
    return { ok: true, folderId };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unknown error accessing Drive.";
    return { ok: false, error: msg };
  }
}
