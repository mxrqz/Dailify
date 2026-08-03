import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const fail = (c: Context, status: ContentfulStatusCode, error: string) =>
  c.json({ error }, status);
