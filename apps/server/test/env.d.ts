import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import type { Env as ServerEnv } from "../src/index";

declare global {
  namespace Cloudflare {
    interface Env extends ServerEnv {
      TEST_MIGRATIONS: D1Migration[];
      // Só existem quando o ambiente tem as credenciais reais (ver vitest.config.ts).
      LIVE_STRIPE_SECRET_KEY?: string;
      LIVE_PRICE_PRO?: string;
      LIVE_PRICE_PRO_YEAR?: string;
      LIVE_PRICE_PROAI?: string;
      LIVE_PRICE_PROAI_YEAR?: string;
    }
  }
}
