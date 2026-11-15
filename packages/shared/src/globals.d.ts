// O lib "ESNext" não traz as APIs de host. Só o que browser e Worker têm em comum, e só o que o
// shared usa — puxar o lib "DOM" inteiro deixaria `window` passar sem erro.
declare class URL {
  constructor(url: string, base?: string);
  static canParse(url: string, base?: string): boolean;
  readonly protocol: string;
  readonly hostname: string;
  readonly pathname: string;
  readonly search: string;
  readonly username: string;
}

declare const console: { info(...data: unknown[]): void; log(...data: unknown[]): void };
