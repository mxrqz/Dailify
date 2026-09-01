import { describe, it, expect } from "vitest";
import { daysInMonth, zonedEpoch, zonedParts } from "./timezone";

describe("zonedParts", () => {
  it("lê a hora-de-parede no fuso pedido, não no do runtime", () => {
    // 2026-03-10T12:00:00Z = 09:00 em São Paulo (UTC-3)
    const at = Date.UTC(2026, 2, 10, 12, 0, 0);
    expect(zonedParts(at, "America/Sao_Paulo")).toMatchObject({
      year: 2026,
      month: 2,
      day: 10,
      hour: 9,
    });
    expect(zonedParts(at, "UTC")).toMatchObject({ hour: 12 });
    expect(zonedParts(at, "Asia/Tokyo")).toMatchObject({ day: 10, hour: 21 });
  });

  it("vira o dia para fusos longe de UTC", () => {
    // 23:30 de 31/10 em São Paulo já é 02:30 de 01/11 em UTC
    const at = Date.UTC(2026, 10, 1, 2, 30);
    expect(zonedParts(at, "America/Sao_Paulo")).toMatchObject({ month: 9, day: 31, hour: 23 });
  });
});

describe("zonedEpoch", () => {
  const roundTrip = (tz: string, parts: Parameters<typeof zonedEpoch>[0]) =>
    zonedParts(zonedEpoch(parts, tz), tz);

  it("ida e volta preserva a hora-de-parede", () => {
    const parts = { year: 2026, month: 6, day: 15, hour: 8, minute: 30, second: 0 };
    for (const tz of ["America/Sao_Paulo", "UTC", "Asia/Tokyo", "America/New_York"]) {
      expect(roundTrip(tz, parts)).toMatchObject(parts);
    }
  });

  it("09:00 em São Paulo é 12:00Z", () => {
    const at = zonedEpoch(
      { year: 2026, month: 2, day: 10, hour: 9, minute: 0, second: 0 },
      "America/Sao_Paulo",
    );
    expect(at).toBe(Date.UTC(2026, 2, 10, 12, 0, 0));
  });

  // O caso que a segunda passada do algoritmo existe para cobrir.
  it("acerta os dois lados do horário de verão americano", () => {
    // 2026-03-08 é a virada (EST -5 → EDT -4); 07:00 local antes e depois
    const before = zonedEpoch(
      { year: 2026, month: 2, day: 7, hour: 7, minute: 0, second: 0 },
      "America/New_York",
    );
    const after = zonedEpoch(
      { year: 2026, month: 2, day: 9, hour: 7, minute: 0, second: 0 },
      "America/New_York",
    );
    expect(before).toBe(Date.UTC(2026, 2, 7, 12, 0, 0)); // UTC-5
    expect(after).toBe(Date.UTC(2026, 2, 9, 11, 0, 0)); // UTC-4
  });
});

describe("daysInMonth", () => {
  it("conta fevereiro bissexto e os meses de 30/31", () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 3)).toBe(30);
    expect(daysInMonth(2026, 0)).toBe(31);
  });
});
