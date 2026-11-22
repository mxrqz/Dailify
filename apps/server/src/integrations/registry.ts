import type { ProviderId } from "@dailify/shared";
import { gmail } from "./gmail";
import { googleCalendar } from "./google-calendar";
import { slack } from "./slack";
import type { Provider } from "./types";

export const PROVIDERS = {
  "google-calendar": googleCalendar,
  slack,
  gmail,
} satisfies Record<ProviderId, Provider>;
