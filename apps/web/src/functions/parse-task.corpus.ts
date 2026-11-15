import enDates from "./parse-task.corpus/en-dates";
import enMisc from "./parse-task.corpus/en-misc";
import enRepeat from "./parse-task.corpus/en-repeat";
import enTimes from "./parse-task.corpus/en-times";
import type { CorpusEntry } from "./parse-task.corpus/kit";
import mix from "./parse-task.corpus/mix";
import ptDates from "./parse-task.corpus/pt-dates";
import ptMisc from "./parse-task.corpus/pt-misc";
import ptRepeat from "./parse-task.corpus/pt-repeat";
import ptTimes from "./parse-task.corpus/pt-times";

/** O golden do parser (fase 1 do bd Dailify-1rb). Formato e convenções em `parse-task.corpus/kit.ts`. */
export const corpus: CorpusEntry[] = [
  ...ptDates,
  ...ptTimes,
  ...ptRepeat,
  ...ptMisc,
  ...enDates,
  ...enTimes,
  ...enRepeat,
  ...enMisc,
  ...mix,
];
