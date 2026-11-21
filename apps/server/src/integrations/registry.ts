import type { ProviderId } from "@dailify/shared";
import { googleCalendar } from "./google-calendar";
import { slack } from "./slack";
import type { Provider } from "./types";

export const PROVIDERS = {
  "google-calendar": googleCalendar,
  slack,
} satisfies Record<ProviderId, Provider>;
