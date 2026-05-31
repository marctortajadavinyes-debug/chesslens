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

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

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
