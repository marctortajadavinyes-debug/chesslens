import { useState, useCallback, useRef } from "react";
import {
  requestGoogleDriveToken,
  listPgnFilesFromDrive,
  downloadPgnContent,
} from "@/lib/google-drive";
import type { DriveGameFile } from "@/lib/google-drive";

type PgnResult = { ok: true; pgn: string } | { ok: false; error: string };

interface UseDriveLibraryResult {
  files: DriveGameFile[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  connectAndLoad: () => Promise<void>;
  refresh: () => Promise<void>;
  loadPgnContent: (file: DriveGameFile) => Promise<PgnResult>;
}

export function useDriveLibrary(): UseDriveLibraryResult {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveGameFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-memory PGN cache — keyed by Drive file id, never persisted to localStorage
  const pgnCacheRef = useRef<Map<string, string>>(new Map());

  const loadFiles = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    const result = await listPgnFilesFromDrive(token);
    setLoading(false);
    if (result.ok) {
      setFiles(result.files);
    } else {
      setError(result.error);
      if (
        result.error.toLowerCase().includes("401") ||
        result.error.toLowerCase().includes("unauthorized") ||
        result.error.toLowerCase().includes("invalid_token")
      ) {
        setAccessToken(null);
      }
    }
  }, []);

  const connectAndLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tokenResult = await requestGoogleDriveToken({ prompt: "" });
    if (!tokenResult.ok) {
      setLoading(false);
      setError(tokenResult.error);
      return;
    }
    setAccessToken(tokenResult.accessToken);
    await loadFiles(tokenResult.accessToken);
  }, [loadFiles]);

  const refresh = useCallback(async () => {
    if (!accessToken) {
      await connectAndLoad();
      return;
    }
    await loadFiles(accessToken);
  }, [accessToken, loadFiles, connectAndLoad]);

  const loadPgnContent = useCallback(
    async (file: DriveGameFile): Promise<PgnResult> => {
      // Return from cache if available
      const cached = pgnCacheRef.current.get(file.id);
      if (cached !== undefined) {
        return { ok: true, pgn: cached };
      }

      // Ensure we have a token
      let token = accessToken;
      if (!token) {
        const tokenResult = await requestGoogleDriveToken({ prompt: "" });
        if (!tokenResult.ok) return { ok: false, error: tokenResult.error };
        setAccessToken(tokenResult.accessToken);
        token = tokenResult.accessToken;
      }

      const result = await downloadPgnContent(token, file.id);

      if (!result.ok) {
        // Token expired — clear it so next call re-auths
        if (
          result.error.toLowerCase().includes("401") ||
          result.error.toLowerCase().includes("unauthorized")
        ) {
          setAccessToken(null);
        }
        return result;
      }

      pgnCacheRef.current.set(file.id, result.pgn);
      return { ok: true, pgn: result.pgn };
    },
    [accessToken],
  );

  return {
    files,
    loading,
    error,
    connected: accessToken !== null,
    connectAndLoad,
    refresh,
    loadPgnContent,
  };
}
