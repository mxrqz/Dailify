import { describe, expect, it } from "vitest";

import { parseUserAgent } from "./user-agent";

describe("parseUserAgent", () => {
  it("separa navegador e sistema mesmo quando o UA cita os outros", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      ),
    ).toEqual({ browser: "Edge", os: "Windows", mobile: false });
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
      ),
    ).toEqual({ browser: "Safari", os: "macOS", mobile: false });
    expect(
      parseUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0"),
    ).toEqual({ browser: "Firefox", os: "Linux", mobile: false });
  });

  it("celular: iPhone com Chrome é iOS, Android não vira Linux", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ browser: "Chrome", os: "iOS", mobile: true });
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Android", mobile: true });
  });

  it("UA ausente ou desconhecido não inventa nada", () => {
    expect(parseUserAgent(null)).toEqual({ mobile: false });
    expect(parseUserAgent("curl/8.0")).toEqual({ mobile: false });
  });
});
