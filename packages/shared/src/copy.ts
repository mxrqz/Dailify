import type { ProviderId } from "./integrations";

/**
 * pt-BR text that both apps must render identically (the calendar event preview is the web card
 * and the server action preview). The file that gets an English pair (bd Dailify-1xy).
 */
export const sharedCopy = {
  /** `Intl` locale of the dates and times below. */
  locale: "pt-BR",
  /** "16/03": a yearly series' day. */
  dayMonth: "{dd}/{mm}",
  providers: {
    "google-calendar": "Google Agenda",
    slack: "Slack",
    gmail: "Gmail",
    github: "GitHub",
  } satisfies Record<ProviderId, string>,
  /** Sunday first, as `Date#getDay`. */
  weekdays: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"],
  /** Joins the last item of a list: "segunda, terça e quarta". */
  listAnd: "{rest} e {last}",
  repeat: {
    /** Saturday and Sunday take the masculine article. */
    weekly: "toda {days}",
    weeklyWeekend: "todo {days}",
    weeklyEvery: "a cada {n} semanas, {days}",
    daily: "todo dia",
    dailyEvery: "a cada {n} dias",
    monthly: "todo dia {day}",
    monthlyEvery: "a cada {n} meses, dia {day}",
    yearly: "todo ano em {date}",
    yearlyEvery: "a cada {n} anos em {date}",
  },
  calendarPreview: {
    title: "Criar evento na Agenda",
    withMeet: "com Meet",
    allDay: "dia inteiro",
    today: "hoje",
    tomorrow: "amanhã",
    /** A series: its rule, its time, and the day it starts. `{sep}` is "," on all-day series. */
    series: "{rule}{sep} {time}, desde {since}",
    allDayOn: "{day} · dia inteiro",
    timedOn: "{day} {time}",
  },
};

/** The `{placeholder}` interpolation of the web's `fill` (`functions/functions.ts`). */
export const fillShared = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
