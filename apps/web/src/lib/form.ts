/**
 * `FormData.get` devolve `string | File | null`, e o código todo fazia `as string`. Este
 * estreita de verdade — se o campo não existe (ou veio do tipo errado) você recebe o vazio, não
 * um `undefined` disfarçado de string.
 */
export function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}
