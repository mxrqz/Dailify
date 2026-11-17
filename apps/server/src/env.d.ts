import type { Env as WorkerEnv } from "./index";

// O `env` de `cloudflare:workers` (src/auth.ts) com o mesmo tipo do `c.env`.
declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends WorkerEnv {}
  }
}
