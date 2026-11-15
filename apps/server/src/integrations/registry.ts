import type { ProviderId } from "@dailify/shared";
import { googleCalendar } from "./google-calendar";
import type { Provider } from "./types";

export const PROVIDERS = {
  "google-calendar": googleCalendar,
} satisfies Record<ProviderId, Provider>;
