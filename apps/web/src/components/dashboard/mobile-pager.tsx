import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";

import { copy } from "@/components/dashboard/copy";
import { cn } from "@/lib/utils";

type Page = 0 | 1;

/** Troca de página por distância (um quarto da tela) ou por um empurrão rápido. */
const DISTANCE = 0.25;
const FLICK_VELOCITY = 400;
const SPRING = { type: "spring", visualDuration: 0.2, bounce: 0 } as const;

const LABELS = [copy.undated.today, copy.undated.title] as const;

/**
 * As duas telas do mobile, Hoje | Sem data, lado a lado num trilho arrastável. O swipe de um cartão
 * não move o trilho: o framer dá o lock do eixo x a quem começa o arrasto primeiro, e o cartão,
 * mais fundo na árvore, recebe o pointerdown antes (`dragPropagation` desligado).
 */
export function MobilePager({
  pages,
  index,
  onIndexChange,
}: {
  pages: [ReactNode, ReactNode];
  index: Page;
  onIndexChange: (index: Page) => void;
}): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const reduced = useReducedMotion();
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrolls = useRef([0, 0]);
  const shown = useRef(index);

  // Cada página é uma tela: guarda a rolagem da que sai e devolve a da que entra.
  useLayoutEffect(() => {
    pageRefs.current.forEach((element, i) => {
      if (element) element.inert = i !== index;
    });
    if (shown.current === index) return;
    scrolls.current[shown.current] = window.scrollY;
    shown.current = index;
    window.scrollTo(0, scrolls.current[index]);
  }, [index]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => setWidth(element.offsetWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const settle = (page: Page) => {
    if (reduced) x.set(-page * width);
    else void animate(x, -page * width, SPRING);
  };

  useEffect(() => settle(index), [index, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (page: Page) => {
    if (page === index) settle(page);
    else onIndexChange(page);
  };

  return (
    <div ref={viewport} className="overflow-x-clip">
      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragElastic={0.2}
        dragConstraints={{ left: -width, right: 0 }}
        style={{ x }}
        onDragEnd={(_, { offset, velocity }) => {
          const swipe =
            Math.abs(velocity.x) > FLICK_VELOCITY
              ? velocity.x
              : Math.abs(offset.x) > width * DISTANCE
                ? offset.x
                : 0;
          go(swipe < 0 ? 1 : swipe > 0 ? 0 : index);
        }}
        className="flex touch-pan-y items-start"
      >
        {pages.map((page, i) => (
          <div
            key={i}
            ref={(element) => {
              pageRefs.current[i] = element;
            }}
            aria-hidden={i !== index || undefined}
            // A de fora não estica o trilho; sticky pra espiar no topo da tela durante o arrasto.
            className={cn(
              "w-full shrink-0 pb-12",
              i !== index && "sticky top-0 max-h-dvh overflow-hidden",
            )}
          >
            {page}
          </div>
        ))}
      </motion.div>

      {/* Peek do puxador: dica de que há outra tela à direita. */}
      {index === 0 && (
        <span
          aria-hidden
          className="fixed top-1/2 right-0 z-30 size-7 translate-x-1/2 -translate-y-1/2 rounded-lg border border-highlight bg-surface-panel"
        />
      )}

      <div
        role="group"
        aria-label={copy.undated.pages}
        className="fixed inset-x-0 bottom-6 z-30 flex justify-center"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") go(1);
          else if (event.key === "ArrowLeft") go(0);
        }}
      >
        {LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            aria-current={i === index || undefined}
            onClick={() => go(i === 0 ? 0 : 1)}
            className="cursor-pointer px-0.75 py-2"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full",
                i === index ? "w-4.5 bg-content-secondary" : "w-1.5 bg-highlight",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
