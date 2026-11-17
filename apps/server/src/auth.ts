import { env, waitUntil } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { authOptions } from "./auth-options";

// Escopo de módulo: uma instância por isolate, não por request. O e-mail sai no `waitUntil`.
export const auth = betterAuth(authOptions(env, waitUntil));
