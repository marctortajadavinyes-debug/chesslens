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

export type DriveUploadResult =
  | { ok: true; fileId: string }
  | { ok: false; error: string };

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_CACHE_KEY = "chesslens.driveFolderId.chessGames";
const DRIVE_FOLDER_NAME = "Chess Games";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

// --- Token ---

export function requestGoogleDriveToken(
  opts?: { prompt?: "" | "consent" },
): Promise<DriveTokenResult> {
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

  const initialPrompt: "" | "consent" = opts?.prompt ?? "";

  return new Promise<DriveTokenResult>((resolve) => {
    let retriedWithConsent = false;

    function tryRequest(prompt: "" | "consent") {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId as string,
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
          if (!retriedWithConsent && prompt === "") {
            retriedWithConsent = true;
            tryRequest("consent");
          } else {
            resolve({
              ok: false,
              error: err.message ?? err.type ?? "Google token request failed.",
            });
          }
        },
      });

      client.requestAccessToken({ prompt });
    }

    tryRequest(initialPrompt);
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

// --- Drive upload helpers ---

async function uploadMultipart(
  accessToken: string,
  filename: string,
  mimeType: string,
  content: string,
  folderId: string,
  appProperties?: Record<string, string>,
): Promise<string> {
  const boundary = "chesslens_boundary_" + Math.random().toString(36).slice(2);
  const metaObj: Record<string, unknown> = { name: filename, parents: [folderId] };
  if (appProperties && Object.keys(appProperties).length > 0) {
    metaObj.appProperties = appProperties;
  }
  const metadata = JSON.stringify(metaObj);

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Drive upload failed: ${text}`);
  }

  const data: { id?: string } = await res.json();
  if (!data.id) throw new Error("Drive did not return a file id.");
  return data.id;
}

async function uploadBlobMultipart(
  accessToken: string,
  filename: string,
  mimeType: string,
  content: Blob,
  folderId: string,
  appProperties?: Record<string, string>,
): Promise<string> {
  const boundary = "chesslens_boundary_" + Math.random().toString(36).slice(2);
  const metaObj: Record<string, unknown> = { name: filename, parents: [folderId] };
  if (appProperties && Object.keys(appProperties).length > 0) {
    metaObj.appProperties = appProperties;
  }
  const metadata = JSON.stringify(metaObj);

  // Build preamble as text ending with the blank line before binary content
  const preamble = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    "",
  ].join("\r\n");

  // Concatenate preamble + binary blob + closing boundary using Blob
  const body = new Blob([preamble, content, `\r\n--${boundary}--`]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Drive upload failed: ${text}`);
  }

  const data: { id?: string } = await res.json();
  if (!data.id) throw new Error("Drive did not return a file id.");
  return data.id;
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

// --- Public: list PGN files ---

export interface DriveGameFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  appProperties: Record<string, string>;
}

export type DriveListResult =
  | { ok: true; files: DriveGameFile[] }
  | { ok: false; error: string };

export async function listPgnFilesFromDrive(
  accessToken: string,
): Promise<DriveListResult> {
  try {
    const folderResult = await ensureChessDriveFolder(accessToken);
    if (!folderResult.ok) return folderResult;

    const q = encodeURIComponent(
      `'${folderResult.folderId}' in parents and name contains '.pgn' and trashed=false`,
    );
    const fields = encodeURIComponent(
      "files(id,name,createdTime,modifiedTime,appProperties)",
    );
    const url = `${DRIVE_API}/files?q=${q}&fields=${fields}&pageSize=100&orderBy=createdTime+desc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Drive files.list failed: ${text}`);
    }

    const data: { files?: Partial<DriveGameFile>[] } = await res.json();
    const files: DriveGameFile[] = (data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "",
      createdTime: f.createdTime ?? "",
      modifiedTime: f.modifiedTime ?? "",
      appProperties: f.appProperties ?? {},
    }));

    return { ok: true, files };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unknown error listing Drive files.";
    return { ok: false, error: msg };
  }
}

// --- Public: download PGN content ---

export type DriveDownloadResult =
  | { ok: true; pgn: string }
  | { ok: false; error: string };

export async function downloadPgnContent(
  accessToken: string,
  fileId: string,
): Promise<DriveDownloadResult> {
  try {
    const url = `${DRIVE_API}/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Drive download failed (${res.status}): ${text}`);
    }
    const pgn = await res.text();
    return { ok: true, pgn };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unknown error downloading PGN.";
    return { ok: false, error: msg };
  }
}

// --- Public: upload PGN ---

const TEST_PGN_CONTENT = `[Event "Chess Games Test"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "?"]
[Black "?"]
[Result "*"]

*
`;

export async function uploadPgnToDrive(
  accessToken: string,
  opts?: {
    filename?: string;
    pgn?: string;
    appProperties?: Record<string, string>;
  },
): Promise<DriveUploadResult> {
  try {
    const folderResult = await ensureChessDriveFolder(accessToken);
    if (!folderResult.ok) return folderResult;

    const filename = opts?.filename ?? "chess-games-test.pgn";
    const pgn = opts?.pgn ?? TEST_PGN_CONTENT;

    const fileId = await uploadMultipart(
      accessToken,
      filename,
      "application/x-chess-pgn",
      pgn,
      folderResult.folderId,
      opts?.appProperties,
    );

    return { ok: true, fileId };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unknown error uploading PGN.";
    return { ok: false, error: msg };
  }
}

// --- Public: upload scoresheet image ---

export async function uploadImageToDrive(
  accessToken: string,
  dataUrl: string,
  filename: string,
  appProperties?: Record<string, string>,
): Promise<DriveUploadResult> {
  try {
    const folderResult = await ensureChessDriveFolder(accessToken);
    if (!folderResult.ok) return folderResult;

    // Extract mime type from data URI header
    const mimeMatch = dataUrl.match(/^data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // Convert data URI to Blob safely via fetch (works for data: URIs in browsers)
    const imageBlob = await fetch(dataUrl).then((r) => r.blob());

    const fileId = await uploadBlobMultipart(
      accessToken,
      filename,
      mimeType,
      imageBlob,
      folderResult.folderId,
      appProperties,
    );

    return { ok: true, fileId };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unknown error uploading image.";
    return { ok: false, error: msg };
  }
}
