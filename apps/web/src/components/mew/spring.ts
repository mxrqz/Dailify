export type SpringState = { x: number; v: number };

const LN2 = 0.6931;

/** Damper exponencial por meia-vida: o mesmo resultado em 60 e 120Hz. */
export function damp(x: number, goal: number, halfLife: number, dt: number): number {
  return goal + (x - goal) * Math.exp((-LN2 * dt) / (halfLife + 1e-5));
}

/** Mola criticamente amortecida (forma fechada, orangeduck); muta e devolve `s`. */
export function springStep(s: SpringState, goal: number, halfLife: number, dt: number) {
  const y = (4 * LN2) / (halfLife + 1e-5) / 2;
  const j0 = s.x - goal;
  const j1 = s.v + j0 * y;
  const e = Math.exp(-y * dt);
  s.x = e * (j0 + j1 * dt) + goal;
  s.v = e * (s.v - j1 * y * dt);
  return s;
}
