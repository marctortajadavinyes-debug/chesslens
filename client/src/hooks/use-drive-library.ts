import { useState, useCallback } from "react";
import {
  requestGoogleDriveToken,
  listPgnFilesFromDrive,
} from "@/lib/google-drive";
import type { DriveGameFile } from "@/lib/google-drive";

interface UseDriveLibraryResult {
  files: DriveGameFile[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  connectAndLoad: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useDriveLibrary(): UseDriveLibraryResult {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveGameFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    const result = await listPgnFilesFromDrive(token);
    setLoading(false);
    if (result.ok) {
      setFiles(result.files);
    } else {
      setError(result.error);
      // If token may have expired, clear it so next connect re-auths
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

  return {
    files,
    loading,
    error,
    connected: accessToken !== null,
    connectAndLoad,
    refresh,
  };
}
