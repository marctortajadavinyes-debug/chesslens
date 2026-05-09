import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),

  imageUrl: text("image_url"),
  imagePath: text("image_path"),

  // Multi-planella
  imageUrls: jsonb("image_urls"),
  imagePaths: jsonb("image_paths"),

  pgn: text("pgn"),
  status: text("status").notNull().default("processing"),
  error: text("error"),
  moves: jsonb("moves"),
  errors: jsonb("errors"),
  meta: jsonb("meta"),
  ocr: jsonb("ocr"),
  reviewState: jsonb("review_state"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const gameSchema = z.object({
  id: z.number(),
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
  errors: z.array(gameErrorSchema).nullable(),
  meta: z.any().nullable(),
  ocr: ocrPayloadSchema.nullable(),
  reviewState: reviewStateSchema,
});

export const createGameRequestSchema = z.object({
  imageUrls: z.array(z.string()).min(1),
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

export type Game = z.infer<typeof gameSchema>;
export type CreateGameRequest = z.infer<typeof createGameRequestSchema>;
export type ReviewGameRequest = z.infer<typeof reviewGameRequestSchema>;
export type UpdateGameRequest = z.infer<typeof updateGameRequestSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type OcrRow = z.infer<typeof ocrRowSchema>;
export type OcrPayload = z.infer<typeof ocrPayloadSchema>;
export type AppLanguage = z.infer<typeof appLanguageSchema>;
export type ScoresheetLanguage = z.infer<typeof scoresheetLanguageSchema>;
export type SheetFormat = z.infer<typeof sheetFormatSchema>;
