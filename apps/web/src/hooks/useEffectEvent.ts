import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * O `useEffectEvent` do React 19.2, para o 18: chamado de dentro de um efeito, lê props e estado do
 * render atual sem entrar nas deps. O nome é o que o lint reconhece — e por isso ele também barra
 * usá-lo fora de efeito, como faria com o do React.
 */
export function useEffectEvent<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  // Antes dos efeitos do mesmo commit: quem chamar já vê a versão nova.
  useInsertionEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}
