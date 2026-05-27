const STORAGE_KEY = "chesslens.deviceId";

let memoryFallbackId: string | null = null;

function generateUuid(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof (crypto as Crypto & { randomUUID?: () => string }).randomUUID ===
        "function"
    ) {
      return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
    }
  } catch {
    // Fall through to manual generation
  }

  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex: string[] = [];
      for (let i = 0; i < 16; i++) {
        hex.push(bytes[i].toString(16).padStart(2, "0"));
      }
      return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
        .slice(6, 8)
        .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
    }
  } catch {
    // Fall through to Math.random
  }

  const rand = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${rand()}${rand()}-${rand()}-4${rand().substring(1)}-${rand()}-${rand()}${rand()}${rand()}`;
}

function safeReadStorage(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const value = window.localStorage.getItem(STORAGE_KEY);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function safeWriteStorage(value: string): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function getOrCreateDeviceId(): string {
  const stored = safeReadStorage();
  if (stored) {
    memoryFallbackId = stored;
    return stored;
  }

  if (memoryFallbackId) {
    safeWriteStorage(memoryFallbackId);
    return memoryFallbackId;
  }

  const generated = generateUuid();
  const persisted = safeWriteStorage(generated);
  memoryFallbackId = generated;

  if (!persisted) {
    return generated;
  }

  return generated;
}
