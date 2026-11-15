import { type RefObject, useEffect, useState } from "react";

/** `true` enquanto o elemento cruza a viewport — pra pausar loops de animação fora da tela. */
export function useInView(ref: RefObject<Element | null>, rootMargin = "64px"): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setInView(true);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return inView;
}
