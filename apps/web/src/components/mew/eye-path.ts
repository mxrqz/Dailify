const K = 0.5523;

/** Olho aberto (elipse, m=0) ↔ feliz ("^", m=1): os mesmos 12 pontos, interpolados. */
export function eyePath(cx: number, cy: number, rx: number, ry: number, m: number): string {
  const w = rx * 0.92;
  const open = [
    [cx, cy - ry],
    [cx + K * rx, cy - ry],
    [cx + rx, cy - K * ry],
    [cx + rx, cy],
    [cx + rx, cy + K * ry],
    [cx + K * rx, cy + ry],
    [cx, cy + ry],
    [cx - K * rx, cy + ry],
    [cx - rx, cy + K * ry],
    [cx - rx, cy],
    [cx - rx, cy - K * ry],
    [cx - K * rx, cy - ry],
  ];
  const happy = [
    [cx, cy - 0.42 * ry],
    [cx + 0.62 * w, cy - 0.42 * ry],
    [cx + w, cy - 0.05 * ry],
    [cx + w, cy + 0.32 * ry],
    [cx + 0.9 * w, cy + 0.1 * ry],
    [cx + 0.5 * w, cy - 0.12 * ry],
    [cx, cy - 0.12 * ry],
    [cx - 0.5 * w, cy - 0.12 * ry],
    [cx - 0.9 * w, cy + 0.1 * ry],
    [cx - w, cy + 0.32 * ry],
    [cx - w, cy - 0.05 * ry],
    [cx - 0.62 * w, cy - 0.42 * ry],
  ];
  const p = open.map(
    ([x, y], i) =>
      `${(x + (happy[i][0] - x) * m).toFixed(1)} ${(y + (happy[i][1] - y) * m).toFixed(1)}`,
  );
  return `M${p[0]}C${p[1]} ${p[2]} ${p[3]}C${p[4]} ${p[5]} ${p[6]}C${p[7]} ${p[8]} ${p[9]}C${p[10]} ${p[11]} ${p[0]}Z`;
}
