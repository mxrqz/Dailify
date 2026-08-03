import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import type { Env as ServerEnv } from "../src/index";

declare global {
  namespace Cloudflare {
    interface Env extends ServerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
