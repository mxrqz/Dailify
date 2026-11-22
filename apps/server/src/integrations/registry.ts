import type { ProviderId } from "@dailify/shared";
import { github } from "./github";
import { gmail } from "./gmail";
import { googleCalendar } from "./google-calendar";
import { slack } from "./slack";
import type { Provider } from "./types";

export const PROVIDERS = {
  "google-calendar": googleCalendar,
  slack,
  gmail,
  github,
} satisfies Record<ProviderId, Provider>;
