// Renders the e-mail logo, public/email/mew.gif: the idle Mew blinking, then flicking an ear.
// Run from apps/web: `bun scripts/email-mew.tsx` (needs `resvg` and `magick` on PATH).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { MewArt, restPose, type Pose } from "@/components/mew/mew-static";

// Token hex (resvg reads no oklch or Tailwind): the app icon's look, a canvas-white Mew on an ink
// tile, so one GIF reads on the white card and the dark one (a white Mew on white vanished).
const STYLE =
  "<style>.fill-surface{fill:#f6f5f4}.fill-ink{fill:#131110}.stroke-ink{stroke:#131110}" +
  ".stroke-ink-secondary{stroke:none}.fill-none{fill:none}.stroke-none{stroke:none}" +
  ".mew-x,.mew-q,[data-mew=dot]{display:none}</style>";
const TILE = '<rect x="-260" y="-300" width="1800" height="1800" rx="400" fill="#131110"/>';
const PX = 96;
// resvg has no non-scaling-stroke: half of the stroke hides under the head fill, so 58 viewBox
// units ≈ 2 px visible at 96 px. The head paths sit under HEAD_T's scale(.1), the seam doesn't.
const OUTLINE = 58;
const NON_SCALING = 'stroke-width="2.4" vector-effect="non-scaling-stroke"';

const rest = restPose("idle");
// [pose, blink scaleY, delay in 1/100 s]; the blink and flick follow BLINK and ear() in mew.tsx.
const FRAMES: [Pose, number, number][] = [
  [rest, 1, 240],
  [rest, 0.45, 4],
  [rest, 0.08, 8],
  [rest, 0.45, 4],
  [rest, 1, 140],
  [{ ...rest, er: 7 }, 1, 10],
  [{ ...rest, er: -3 }, 1, 11],
  [{ ...rest, er: 2 }, 1, 10],
];

const svg = (pose: Pose, blink: number) =>
  renderToStaticMarkup(<MewArt pose={pose} />)
    .replace(/^<span[^>]*>|<\/span>$/g, "")
    .replace(
      /<svg [^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-260 -300 1800 1800">${STYLE}${TILE}`,
    )
    .replaceAll(`stroke-linejoin="round" ${NON_SCALING}`, `stroke-width="${OUTLINE * 10}"`)
    .replaceAll(NON_SCALING, `stroke-width="${OUTLINE}"`)
    // the WAAPI blink as an attribute: resvg reads no transform-origin
    .replace(
      /data-mew="blink" style="transform-origin:([\d.]+)px ([\d.]+)px"/g,
      `transform="translate($1 $2) scale(1 ${blink}) translate(-$1 -$2)"`,
    );

const tmp = "public/email/.frames";
mkdirSync(tmp, { recursive: true });
const args = FRAMES.flatMap(([pose, blink, delay], i) => {
  const src = `${tmp}/${i}.svg`;
  writeFileSync(src, svg(pose, blink));
  const png = `${tmp}/${i}.png`;
  const r = Bun.spawnSync(["resvg", "-w", String(PX), "-h", String(PX), src, png]);
  if (r.exitCode !== 0) throw new Error(`resvg ${src}: ${r.stderr.toString()}`);
  return ["-delay", String(delay), png];
});
const r = Bun.spawnSync([
  "magick",
  "-dispose",
  "background",
  ...args,
  "-loop",
  "0",
  "-layers",
  "optimize",
  "public/email/mew.gif",
]);
if (r.exitCode !== 0) throw new Error(`magick: ${r.stderr.toString()}`);
rmSync(tmp, { recursive: true });
