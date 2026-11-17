// A ordem importa: o UA do Edge também diz "Chrome" e "Safari", o do Chrome também diz "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

// iPhone/iPad antes do macOS ("like Mac OS X"); Android antes do Linux.
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export type Device = { browser?: string; os?: string; mobile: boolean };

/**
 * Navegador, sistema e se é celular/tablet, a partir de um `User-Agent`.
 * ponytail: regex sobre o UA, erra o iPad em "modo desktop" (vira macOS); um parser de verdade
 * (ua-parser-js) se a lista de sessões precisar de modelo de aparelho.
 */
export function parseUserAgent(ua: string | null | undefined): Device {
  const s = ua ?? "";
  const browser = BROWSERS.find(([re]) => re.test(s))?.[1];
  const os = SYSTEMS.find(([re]) => re.test(s))?.[1];
  return {
    ...(browser && { browser }),
    ...(os && { os }),
    mobile: /Mobi|Android|iPhone|iPad|iPod/.test(s),
  };
}
