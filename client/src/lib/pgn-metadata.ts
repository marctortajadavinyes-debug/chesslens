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

// --- Header extraction ---

export function extractPgnHeader(pgn: string, tag: string): string {
  const m = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`));
  return m ? m[1].trim() : "";
}

// --- Move extraction ---

function stripBraces(text: string): string {
  let result = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "{") { depth++; continue; }
    if (ch === "}") { depth > 0 && depth--; continue; }
    if (depth === 0) result += ch;
  }
  return result;
}

function stripParens(text: string): string {
  let result = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth > 0 && depth--; continue; }
    if (depth === 0) result += ch;
  }
  return result;
}

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

/**
 * Extract the first 3 white and first 3 black moves from a PGN.
 * Returns { white: string[], black: string[] } — each array has up to 3 items.
 *
 * Strategy:
 *   1. Isolate the move section (after headers).
 *   2. Strip comments {}, variations (), NAGs $N.
 *   3. Strip move numbers (e.g. "1.", "2...", "...").
 *   4. Strip result tokens (1-0, 0-1, 1/2-1/2, *).
 *   5. Remaining tokens alternate white/black at indices 0,2,4 / 1,3,5.
 */
export function extractFirstMoves(pgn: string): { white: string[]; black: string[] } {
  let text = getMoveSection(pgn);
  text = stripBraces(text);
  text = stripParens(text);
  // Remove NAGs
  text = text.replace(/\$\d+/g, " ");
  // Remove move numbers: "1.", "12.", "1...", "..."
  text = text.replace(/\d+\s*\.{1,3}/g, " ");
  text = text.replace(/\.\.\./g, " ");
  // Remove results
  text = text.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");
  // Collapse whitespace
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);

  const white: string[] = [];
  const black: string[] = [];

  for (let i = 0; i < tokens.length && (white.length < 3 || black.length < 3); i++) {
    if (i % 2 === 0) {
      if (white.length < 3) white.push(tokens[i]);
    } else {
      if (black.length < 3) black.push(tokens[i]);
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

// --- Filename builder ---

function sanitizeForFilename(s: string): string {
  return (s ?? "")
    .replace(/\*/g, "")
    .replace(/[/\\:?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

export function buildPgnFilename(pgn: string, gameId: number): string {
  const rawWhite = extractPgnHeader(pgn, "White");
  const rawBlack = extractPgnHeader(pgn, "Black");
  const rawDate = extractPgnHeader(pgn, "Date");

  const white = sanitizeForFilename(rawWhite);
  const black = sanitizeForFilename(rawBlack);
  const date = rawDate
    .replace(/\./g, "-")
    .replace(/[^0-9\-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (!white && !black) return `chess-game-${gameId}.pgn`;

  const parts: string[] = [];
  if (white) parts.push(white);
  parts.push("vs");
  if (black) parts.push(black);
  if (date) parts.push(date);

  return parts.join("_").replace(/_{2,}/g, "_") + ".pgn";
}

// --- Drive appProperties ---

/**
 * Build appProperties for Google Drive upload.
 * All values must be non-empty strings (Drive requirement).
 */
export function buildDriveAppProperties(
  meta: PgnMetadata,
): Record<string, string> {
  const props: Record<string, string> = {};
  if (meta.white) props.white = meta.white;
  if (meta.black) props.black = meta.black;
  if (meta.date) props.date = meta.date;
  if (meta.result) props.result = meta.result;
  if (meta.userColor) props.userColor = meta.userColor;
  if (meta.opponent) props.opponent = meta.opponent;
  if (meta.firstWhiteMoves) props.firstWhiteMoves = meta.firstWhiteMoves;
  if (meta.firstBlackMoves) props.firstBlackMoves = meta.firstBlackMoves;
  return props;
}

// --- Convenience: build full metadata from PGN ---

export function extractPgnMetadata(
  pgn: string,
  gameId: number,
  playerAlias?: string,
): PgnMetadata {
  const white = extractPgnHeader(pgn, "White");
  const black = extractPgnHeader(pgn, "Black");
  const date = extractPgnHeader(pgn, "Date");
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
