// Gera favicon.svg e os PNGs do PWA/push a partir do gato da marca (brand-cat.tsx).
// Rodar de apps/web: `bun scripts/icons.ts` (precisa do `resvg` no PATH).
import { mkdirSync, writeFileSync } from "node:fs";

import { EYES, PUPILS } from "@/components/brand-cat";
import { HEAD_D } from "@/components/mew/head-path";

// hex dos tokens de global.css (resvg não lê oklch)
const INK = "#131110"; // --ink claro
const INK_DARK = "#f6f5f4"; // --ink escuro
const BRAND = "#db173d"; // --brand
const WHITE = "#ffffff"; // --surface claro / --on-brand

const T = "translate(0 1280) scale(.1 -.1)";
// cabeça ocupa x 0..1280, y 28..1252: os viewBox são quadrados centrados em 640
const box = (size: number) => `${640 - size / 2} ${640 - size / 2} ${size} ${size}`;

const head = (attrs: string) => `<path transform="${T}" d="${HEAD_D}" ${attrs}/>`;
const ellipses = (rows: readonly (readonly number[])[], attrs: string) =>
  rows
    .map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${attrs}/>`)
    .join("");
const face = (eye: string, pupil: string) =>
  ellipses(EYES, eye) + ellipses(PUPILS, pupil) + ellipses([[805, 951, 50, 30]], eye);

const svg = (size: number, body: string, style = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box(size)}">${style}${body}</svg>\n`;

// contorno de 800 no espaço da path (escala .1) = 80 no viewBox ≈ 1px a 16px
const outlined = (fill: string, line: string, eye: string) =>
  head(`fill="${fill}" stroke="${line}" stroke-width="800" stroke-linejoin="round"`) +
  face(`fill="${eye}"`, `fill="${fill}"`);

// aba clara: gato branco com contorno escuro; aba escura: gato claro sem contorno, olhos pretos
const favicon = svg(
  1380,
  head(`class="h" stroke-width="800" stroke-linejoin="round"`) + face(`class="e"`, `class="h"`),
  `<style>.h{fill:${WHITE};stroke:${INK}}.e{fill:${INK}}` +
    `@media (prefers-color-scheme:dark){.h{fill:${INK_DARK};stroke:none}.e{fill:#000}}</style>`,
);
const any = svg(1380, outlined(WHITE, INK, INK));
// fundo cheio na cor da marca; o gato fica dentro do círculo seguro de 80% do maskable
const onBrand = (size: number) =>
  svg(
    size,
    `<rect x="-2000" y="-2000" width="6000" height="6000" fill="${BRAND}"/>` +
      head(`fill="${WHITE}"`) +
      face(`fill="#000"`, `fill="${WHITE}"`),
  );
// badge: só o alfa conta, então silhueta branca com olhos e nariz vazados
const badge = svg(
  1380,
  `<mask id="m">${head(`fill="#fff"`)}${face(`fill="#000"`, `fill="#fff"`)}</mask>` +
    `<rect x="-2000" y="-2000" width="6000" height="6000" fill="#fff" mask="url(#m)"/>`,
);

const out = "public/icons";
mkdirSync(out, { recursive: true });
writeFileSync("public/favicon.svg", favicon);

const tmp = `${out}/.src.svg`;
const png = (src: string, name: string, px: number) => {
  writeFileSync(tmp, src);
  const r = Bun.spawnSync(["resvg", "-w", String(px), "-h", String(px), tmp, name]);
  if (r.exitCode !== 0) throw new Error(`resvg ${name}: ${r.stderr.toString()}`);
};
png(any, `${out}/icon-192.png`, 192);
png(any, `${out}/icon-512.png`, 512);
png(onBrand(2200), `${out}/maskable-512.png`, 512);
png(onBrand(1800), `${out}/apple-touch-icon.png`, 180);
png(badge, `${out}/badge-96.png`, 96);
// fonte do `bunx tauri icon`, fora do public pra não ir pro build
png(any, "src-tauri/icons/source.png", 1024);
Bun.spawnSync(["rm", tmp]);
