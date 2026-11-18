import { fill } from "./functions";

/** `one` for 1, else `many` with `{n}` filled: "1 item", "3 itens". */
export const countLabel = (n: number, one: string, many: string): string =>
  n === 1 ? one : fill(many, { n });
