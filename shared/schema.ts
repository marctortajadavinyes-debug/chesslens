import {
  pgTable,
  text,
  serial,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  alias: text("alias"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),

  userId: integer("user_id").references(() => users.id),
  deviceId: text("device_id"),

  imageUrl: text("image_url"),
  imagePath: text("image_path"),

  // Multi-planella
  imageUrls: jsonb("image_urls"),
  imagePaths: jsonb("image_paths"),

  pgn: text("pgn"),
  status: text("status").notNull().default("processing"),
  error: text("error"),
  moves: jsonb("moves"),
  manualCorrections: jsonb("manual_corrections"),
  errors: jsonb("errors"),
  meta: jsonb("meta"),
  ocr: jsonb("ocr"),
  reviewState: jsonb("review_state"),

  // Producto / biblioteca
  savedLocal: boolean("saved_local").default(false),
  includeImages: boolean("include_images").default(false),
  cloudStatus: text("cloud_status").default("local_only"),
  cloudProvider: text("cloud_provider"),
  cloudFolderId: text("cloud_folder_id"),
  cloudFileId: text("cloud_file_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gameImages = pgTable("game_images", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id),
  sheetIndex: integer("sheet_index").notNull(),
  imageUrl: text("image_url"),
  imagePath: text("image_path"),
  storageMode: text("storage_mode").default("local"),
  cloudFileId: text("cloud_file_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviewSideSchema = z.union([z.literal("w"), z.literal("b")]);

export const appLanguageSchema = z.union([
  z.literal("ca"),
  z.literal("es"),
  z.literal("en"),
]);

export const scoresheetLanguageSchema = z.union([
  z.literal("ca"),
  z.literal("es"),
  z.literal("en"),
  z.literal("fr"),
  z.literal("de"),
  z.literal("pt"),
  z.literal("it"),
  z.literal("ru"),
  z.literal("tr"),
  z.literal("zh"),
  z.literal("hi"),
]);

export const sheetFormatSchema = z.union([
  z.literal("fce_75_3x25"),
  z.literal("fide_60_3x20"),
  z.literal("standard_60_2x30"),
  z.literal("generic_40_2x20"),
]);

export const reviewStateSchema = z.object({
  stoppedForReview: z.boolean(),
  blockedRow: z.number().nullable(),
  blockedSide: reviewSideSchema.nullable(),
  blockedSheet: z.number().nullable(),
  rawToken: z.string().nullable(),
  candidates: z.array(z.string()),
  fen: z.string().nullable(),
});

export const manualCorrectionSchema = z.object({
  ply: z.number(),
  san: z.string(),
});

export const ocrRowSchema = z.object({
  row: z.number(),
  w: z.string(),
  b: z.string(),
  sheet: z.number().optional(),
  originalRow: z.number().nullable().optional(),
});

export const ocrPayloadSchema = z.object({
  meta: z.any(),
  rows: z.array(ocrRowSchema),
});

export const gameErrorSchema = z
  .object({
    row: z.number().optional(),
    side: reviewSideSchema.optional(),
    raw: z.string().optional(),
    normalized: z.string().optional(),
    candidates: z.array(z.string()).optional(),
    reason: z.string().optional(),
    fen: z.string().optional(),
  })
  .passthrough();

export const cloudStatusSchema = z.union([
  z.literal("local_only"),
  z.literal("pending_upload"),
  z.literal("synced"),
  z.literal("sync_error"),
]);

export const gameSchema = z.object({
  id: z.number(),

  userId: z.number().nullable().optional(),
  deviceId: z.string().nullable().optional(),

  createdAt: z.union([z.string(), z.date()]).nullable().optional(),
  updatedAt: z.union([z.string(), z.date()]).nullable().optional(),

  status: z.union([
    z.literal("processing"),
    z.literal("needs_review"),
    z.literal("completed"),
    z.literal("failed"),
  ]),

  imageUrl: z.string().nullable().optional(),
  imagePath: z.string().nullable().optional(),

  imageUrls: z.array(z.string()).optional(),
  imagePaths: z.array(z.string()).optional(),

  pgn: z.string().nullable(),
  error: z.string().nullable(),
  moves: z.array(z.string()).nullable(),
  manualCorrections: z.array(manualCorrectionSchema).optional(),
  errors: z.array(gameErrorSchema).nullable(),
  meta: z.any().nullable(),
  ocr: ocrPayloadSchema.nullable(),
  reviewState: reviewStateSchema,

  savedLocal: z.boolean().optional(),
  includeImages: z.boolean().optional(),
  cloudStatus: cloudStatusSchema.optional(),
  cloudProvider: z.string().nullable().optional(),
  cloudFolderId: z.string().nullable().optional(),
  cloudFileId: z.string().nullable().optional(),
});

export const createGameRequestSchema = z.object({
  imageUrls: z.array(z.string()).min(1),
  alias: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  deviceId: z.string().min(1).optional(),
  appLanguage: appLanguageSchema.optional(),
  scoresheetLanguage: scoresheetLanguageSchema.optional(),
  sheetFormat: sheetFormatSchema.optional(),
});

export const reviewGameRequestSchema = z
  .object({
    correctedMove: z.string().min(1).optional(),
    moveFrom: z.string().min(2).max(2).optional(),
    moveTo: z.string().min(2).max(2).optional(),
    promotion: z.string().min(1).max(1).optional(),
    undoIndex: z.number().min(0).optional(),
  })
  .refine(
    (data) => {
      const hasText = !!data.correctedMove;
      const hasBoard = !!data.moveFrom && !!data.moveTo;
      return hasText || hasBoard;
    },
    {
      message: "correctedMove o moveFrom/moveTo required",
    },
  );

export const updateGameRequestSchema = z.object({
  pgn: z.string().optional(),
  status: z
    .union([
      z.literal("processing"),
      z.literal("needs_review"),
      z.literal("completed"),
      z.literal("failed"),
    ])
    .optional(),
  error: z.string().nullable().optional(),
});

export const saveGameRequestSchema = z.object({
  saveToCloud: z.boolean().optional(),
  includeImages: z.boolean().optional(),
  cloudProvider: z
    .union([z.literal("drive"), z.literal("local"), z.literal("none")])
    .optional(),
});

export type Game = z.infer<typeof gameSchema>;
export type CreateGameRequest = z.infer<typeof createGameRequestSchema>;
export type ReviewGameRequest = z.infer<typeof reviewGameRequestSchema>;
export type UpdateGameRequest = z.infer<typeof updateGameRequestSchema>;
export type SaveGameRequest = z.infer<typeof saveGameRequestSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type OcrRow = z.infer<typeof ocrRowSchema>;
export type OcrPayload = z.infer<typeof ocrPayloadSchema>;
export type AppLanguage = z.infer<typeof appLanguageSchema>;
export type ScoresheetLanguage = z.infer<typeof scoresheetLanguageSchema>;
export type SheetFormat = z.infer<typeof sheetFormatSchema>;
