// Pure functions — no React, no side effects.
// All localStorage reads must be done by the caller.

export type UserColor = "white" | "black" | "unknown";

export interface PgnMetadata {
  white: string;
  black: string;
  date: string;
  result: string;
  userColor: UserColor;
  opponent: string;
  firstWhiteMoves: string;
  firstBlackMoves: string;
}

// --- Date helpers: PGN <-> ISO ---

/**
 * Convert PGN Date tag (YYYY.MM.DD) to ISO date (YYYY-MM-DD).
 * Tolerates unknowns, empty, "*", and already-ISO input.
 */
export function pgnDateToIsoDate(date: string): string {
  const d = (date ?? "").trim();
  if (!d || d === "*" || d === "????.??.??" || d === "????-??-??") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return d.replace(/\./g, "-");
}

/**
 * Convert ISO date (YYYY-MM-DD) to PGN Date tag (YYYY.MM.DD).
 * Tolerates unknowns, empty, "*", and already-PGN input.
 */
export function isoDateToPgnDate(date: string): string {
  const d = (date ?? "").trim();
  if (!d || d === "*" || d === "????.??.??" || d === "????-??-??") return "????.??.??";
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(d)) return d;
  return d.replace(/-/g, ".");
}

// --- Header extraction ---

export function extractPgnHeader(pgn: string, tag: string): string {
  const m = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`));
  return m ? m[1].trim() : "";
}

// --- Move section helpers ---

function getMoveSection(pgn: string): string {
  const lines = pgn.split("\n");
  const moveLines: string[] = [];
  let inMoves = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (inMoves) {
      moveLines.push(trimmed);
    } else if (!trimmed.startsWith("[") && trimmed.length > 0) {
      inMoves = true;
      moveLines.push(trimmed);
    }
  }
  return moveLines.join(" ");
}

function stripBraces(text: string): string {
  let result = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "{") { depth++; continue; }
    if (ch === "}") { if (depth > 0) depth--; continue; }
    if (depth === 0) result += ch;
  }
  return result;
}

function stripParens(text: string): string {
  let result = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { if (depth > 0) depth--; continue; }
    if (depth === 0) result += ch;
  }
  return result;
}

// --- Move extraction ---

/**
 * Extract the first 4 white and first 4 black moves from a PGN.
 * Returns { white: string[], black: string[] } — each array has up to 4 items.
 *
 * Strategy:
 *   1. Isolate the move section (after headers).
 *   2. Strip comments {}, variations (), NAGs $N.
 *   3. Strip move numbers (e.g. "1.", "2...", "...").
 *   4. Strip result tokens (1-0, 0-1, 1/2-1/2, *).
 *   5. Remaining tokens alternate white/black at indices 0,2,4,6 / 1,3,5,7.
 */
export function extractFirstMoves(pgn: string): { white: string[]; black: string[] } {
  let text = getMoveSection(pgn);
  text = stripBraces(text);
  text = stripParens(text);
  text = text.replace(/\$\d+/g, " ");
  text = text.replace(/\d+\s*\.{1,3}/g, " ");
  text = text.replace(/\.\.\./g, " ");
  text = text.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);

  const white: string[] = [];
  const black: string[] = [];

  for (let i = 0; i < tokens.length && (white.length < 4 || black.length < 4); i++) {
    if (i % 2 === 0) {
      if (white.length < 4) white.push(tokens[i]);
    } else {
      if (black.length < 4) black.push(tokens[i]);
    }
  }

  return { white, black };
}

// --- Color detection ---

function normalizeForComparison(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect whether the player (identified by playerAlias) played White or Black.
 * Comparison is case-insensitive, accent-insensitive, whitespace-collapsed.
 */
export function detectUserColor(pgn: string, playerAlias: string): UserColor {
  if (!playerAlias || !playerAlias.trim()) return "unknown";
  const alias = normalizeForComparison(playerAlias);
  const white = normalizeForComparison(extractPgnHeader(pgn, "White"));
  const black = normalizeForComparison(extractPgnHeader(pgn, "Black"));
  if (alias && white && alias === white) return "white";
  if (alias && black && alias === black) return "black";
  return "unknown";
}

// --- Filename builder (from meta, not from raw PGN) ---

function sanitizeForFilename(s: string): string {
  return (s ?? "")
    .replace(/\*/g, "")
    .replace(/[/\\:?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

function sanitizeDateForFilename(rawDate: string): string {
  return (rawDate ?? "")
    .replace(/\./g, "-")
    .replace(/[^0-9\-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/** Build filename from corrected dialog metadata (not from raw PGN). */
export function buildFilenameFromMeta(meta: PgnMetadata, gameId: number): string {
  const white = sanitizeForFilename(meta.white.trim());
  const black = sanitizeForFilename(meta.black.trim());
  const date = sanitizeDateForFilename(meta.date.trim());

  if (!white && !black) return `chess-game-${gameId}.pgn`;

  const parts: string[] = [];
  if (white) parts.push(white);
  parts.push("vs");
  if (black) parts.push(black);
  if (date) parts.push(date);

  return parts.join("_").replace(/_{2,}/g, "_") + ".pgn";
}

/** Legacy: build filename from raw PGN headers (used for Download). */
export function buildPgnFilename(pgn: string, gameId: number): string {
  return buildFilenameFromMeta(
    {
      white: extractPgnHeader(pgn, "White"),
      black: extractPgnHeader(pgn, "Black"),
      date: extractPgnHeader(pgn, "Date"),
      result: "",
      userColor: "unknown",
      opponent: "",
      firstWhiteMoves: "",
      firstBlackMoves: "",
    },
    gameId,
  );
}

// --- Apply dialog corrections to PGN ---

const STR_ORDER = ["Event", "Site", "Date", "Round", "White", "Black", "Result"];

function extractAllHeaders(pgn: string): Array<[string, string]> {
  const headers: Array<[string, string]> = [];
  const re = /\[(\w+)\s+"([^"]*)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pgn)) !== null) {
    headers.push([m[1], m[2]]);
  }
  return headers;
}

/**
 * Apply corrected metadata to the PGN text.
 * - Overwrites White, Black, Date, Result headers with meta values.
 * - Ensures all 7 STR headers are present.
 * - Updates the result token at the end of the move section.
 * - Preserves non-STR headers (ECO, Opening, etc.).
 */
export function applyMetadataToPgn(pgn: string, meta: PgnMetadata): string {
  const existing = extractAllHeaders(pgn);
  const headerMap = new Map<string, string>(existing);

  // Override with trimmed meta values
  if (meta.white !== undefined) headerMap.set("White", meta.white.trim() || "?");
  if (meta.black !== undefined) headerMap.set("Black", meta.black.trim() || "?");
  if (meta.date !== undefined) headerMap.set("Date", isoDateToPgnDate(meta.date.trim()));
  if (meta.result !== undefined) headerMap.set("Result", meta.result.trim() || "*");

  // Ensure all STR tags exist
  if (!headerMap.has("Event")) headerMap.set("Event", "?");
  if (!headerMap.has("Site")) headerMap.set("Site", "?");
  if (!headerMap.has("Round")) headerMap.set("Round", "?");

  // Build header block: STR first, then extras
  const strBlock = STR_ORDER.map(
    (tag) => `[${tag} "${headerMap.get(tag) ?? "?"}"]`,
  );
  const extraBlock = existing
    .filter(([tag]) => !STR_ORDER.includes(tag))
    .map(([tag]) => `[${tag} "${headerMap.get(tag) ?? ""}"]`);

  const headersBlock = [...strBlock, ...extraBlock].join("\n");

  // Update result token at end of move section
  const moveSection = getMoveSection(pgn).trim();
  const resultValue = headerMap.get("Result") ?? "*";
  const resultPattern = /\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/;
  const updatedMoves = resultPattern.test(moveSection)
    ? moveSection.replace(resultPattern, " " + resultValue)
    : moveSection + " " + resultValue;

  return headersBlock + "\n\n" + updatedMoves.trim() + "\n";
}

// --- Drive appProperties ---

/**
 * Build appProperties for Google Drive upload.
 * Built from corrected dialog metadata. All values are non-empty strings.
 */
export function buildDriveAppProperties(
  meta: PgnMetadata,
): Record<string, string> {
  const props: Record<string, string> = {
    source: "chesslens",
    type: "pgn",
  };
  if (meta.white) props.white = meta.white.trim();
  if (meta.black) props.black = meta.black.trim();
  if (meta.date) props.date = meta.date.trim();
  if (meta.result) props.result = meta.result.trim();
  if (meta.userColor) props.userColor = meta.userColor;
  if (meta.opponent) props.opponent = meta.opponent.trim();
  if (meta.firstWhiteMoves) props.firstWhiteMoves = meta.firstWhiteMoves;
  if (meta.firstBlackMoves) props.firstBlackMoves = meta.firstBlackMoves;
  return props;
}

// --- Convenience: build full metadata from PGN ---

export function extractPgnMetadata(
  pgn: string,
  _gameId: number,
  playerAlias?: string,
): PgnMetadata {
  const white = extractPgnHeader(pgn, "White");
  const black = extractPgnHeader(pgn, "Black");
  const date = pgnDateToIsoDate(extractPgnHeader(pgn, "Date"));
  const result = extractPgnHeader(pgn, "Result");
  const userColor = detectUserColor(pgn, playerAlias ?? "");
  const opponent =
    userColor === "white" ? black : userColor === "black" ? white : "";
  const moves = extractFirstMoves(pgn);

  return {
    white,
    black,
    date,
    result,
    userColor,
    opponent,
    firstWhiteMoves: moves.white.join(","),
    firstBlackMoves: moves.black.join(","),
  };
}
