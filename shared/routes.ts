import { z } from "zod";
import {
  createGameRequestSchema,
  gameSchema,
  reviewGameRequestSchema,
  updateGameRequestSchema,
} from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  games: {
    create: {
      method: "POST" as const,
      path: "/api/games" as const,
      input: createGameRequestSchema,
      responses: {
        200: gameSchema,
        400: errorSchemas.validation,
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/games/:id" as const,
      responses: {
        200: gameSchema,
        404: errorSchemas.notFound,
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/games" as const,
      responses: {
        200: z.array(gameSchema),
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/games/:id" as const,
      input: updateGameRequestSchema,
      responses: {
        200: gameSchema,
        404: errorSchemas.notFound,
      },
    },
    review: {
      method: "POST" as const,
      path: "/api/games/:id/review" as const,
      input: reviewGameRequestSchema,
      responses: {
        200: gameSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(
  path: string,
  params?: Record<string, string | number>,
): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
