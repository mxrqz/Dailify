import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Metadados do Clerk e campos opcionais chegam como `unknown` — evita um `as string` por leitura. */
export function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
