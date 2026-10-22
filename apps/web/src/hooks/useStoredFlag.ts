import { useState } from "react";

/** Um liga/desliga lembrado por device. Sem storage (aba privada) vale só a sessão. */
export function useStoredFlag(key: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });

  const change = (next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // sem storage a escolha só não sobrevive ao reload
    }
  };

  return [on, change];
}
