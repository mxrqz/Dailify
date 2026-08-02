import { Hono } from "hono";
import { PLAN_PERMISSIONS } from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { getUserRole } from "../lib/clerk";

const billing = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

billing.get("/permissions", requireAuth, async (c) =>
  c.json(PLAN_PERMISSIONS[await getUserRole(c.env, c.get("userId"))]),
);

export default billing;
