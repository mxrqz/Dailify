import enDates from "./parse-task.corpus/en-dates";
import enMisc from "./parse-task.corpus/en-misc";
import enRepeat from "./parse-task.corpus/en-repeat";
import enTimes from "./parse-task.corpus/en-times";
import holdoutEn from "./parse-task.corpus/holdout-en";
import holdoutPt from "./parse-task.corpus/holdout-pt";
import holdout2En from "./parse-task.corpus/holdout2-en";
import holdout2Pt from "./parse-task.corpus/holdout2-pt";
import type { CorpusEntry } from "./parse-task.corpus/kit";
import mix from "./parse-task.corpus/mix";
import ptDates from "./parse-task.corpus/pt-dates";
import ptMisc from "./parse-task.corpus/pt-misc";
import ptRepeat from "./parse-task.corpus/pt-repeat";
import ptTimes from "./parse-task.corpus/pt-times";
import unsure from "./parse-task.corpus/unsure";

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
  ...unsure,
  ...[...holdoutPt, ...holdoutEn, ...holdout2Pt, ...holdout2En].map((entry) => ({
    ...entry,
    holdout: true,
  })),
];
