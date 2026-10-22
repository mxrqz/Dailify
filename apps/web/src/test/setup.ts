/**
 * Setup comum dos testes. Roda também nos arquivos de ambiente `node` (a maioria), por isso tudo
 * aqui é guardado por `typeof window` — sem DOM não há nada a preparar.
 */
import { afterEach } from "vitest";

if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");

  // Sem isto cada teste herda o DOM do anterior e um getByText passa a achar dois elementos.
  afterEach(() => cleanup());

  // jsdom não implementa nenhuma das três, e elas não são opcionais no app: framer-motion observa o
  // viewport (`whileInView`), o Radix mede elementos, e `useMediaQuery` decide o layout inteiro.
  class NoopIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  class NoopResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  window.IntersectionObserver ??= NoopIntersectionObserver;
  window.ResizeObserver ??= NoopResizeObserver;

  window.matchMedia ??= (query: string): MediaQueryList => ({
    matches: false, // desktop: é onde mora a UI com mais estado condicional
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
