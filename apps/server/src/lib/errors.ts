import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** `extra` = campos ao lado do `error` (ex.: o `code` que o cliente troca por outro recado). */
export const fail = (
  c: Context,
  status: ContentfulStatusCode,
  error: string,
  extra: Record<string, unknown> = {},
) => c.json({ ...extra, error }, status);
