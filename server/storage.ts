import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { games, gameSchema, type Game } from "@shared/schema";

type DbGameInsert = typeof games.$inferInsert;
type DbGameUpdate = Partial<typeof games.$inferInsert>;
type DbGameRow = typeof games.$inferSelect;

function emptyReviewState() {
  return {
    stoppedForReview: false,
    blockedRow: null,
    blockedSide: null,
    blockedSheet: null,
    rawToken: null,
    candidates: [],
    fen: null,
  };
}

function toGame(row: DbGameRow): Game {
  return gameSchema.parse({
    ...row,

    imageUrls: Array.isArray(row.imageUrls) ? row.imageUrls : [],
    imagePaths: Array.isArray(row.imagePaths) ? row.imagePaths : [],

    moves: Array.isArray(row.moves) ? row.moves : null,
    manualCorrections: Array.isArray(row.manualCorrections)
      ? row.manualCorrections
      : [],
    errors: Array.isArray(row.errors) ? row.errors : null,

    ocr: row.ocr && typeof row.ocr === "object" ? row.ocr : null,

    reviewState:
      row.reviewState && typeof row.reviewState === "object"
        ? row.reviewState
        : emptyReviewState(),

    savedLocal: row.savedLocal ?? false,
    includeImages: row.includeImages ?? false,
    cloudStatus: row.cloudStatus ?? "local_only",
    cloudProvider: row.cloudProvider ?? null,
    cloudFolderId: row.cloudFolderId ?? null,
    cloudFileId: row.cloudFileId ?? null,
  });
}

export async function createGameRecord(data: DbGameInsert): Promise<Game> {
  const [created] = await db.insert(games).values(data).returning();

  if (!created) {
    throw new Error("Could not create game");
  }

  return toGame(created);
}

export async function getGameRecord(id: number): Promise<Game | null> {
  const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1);

  return game ? toGame(game) : null;
}

export async function updateGameRecord(
  id: number,
  updates: DbGameUpdate,
): Promise<Game | null> {
  const safeUpdates: DbGameUpdate = {
    ...updates,
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(games)
    .set(safeUpdates)
    .where(eq(games.id, id))
    .returning();

  return updated ? toGame(updated) : null;
}

export async function listGameRecords(filters?: {
  deviceId?: string;
  userId?: number;
}): Promise<Game[]> {
  if (filters?.userId != null) {
    const rows = await db
      .select()
      .from(games)
      .where(eq(games.userId, filters.userId))
      .orderBy(desc(games.createdAt));

    return rows.map(toGame);
  }

  if (filters?.deviceId) {
    const rows = await db
      .select()
      .from(games)
      .where(eq(games.deviceId, filters.deviceId))
      .orderBy(desc(games.createdAt));

    return rows.map(toGame);
  }

  const rows = await db.select().from(games).orderBy(desc(games.createdAt));
  return rows.map(toGame);
}
