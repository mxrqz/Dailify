import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const PREFIX = "scroll:";

/**
 * The window is the scroller: a new page starts at the top, back/forward restores where that entry
 * was. Only a pathname change moves it — `?view=calendar` is an overlay, and the day list scrolls
 * itself to `targetDay` under it.
 */
export function ScrollRestoration(): null {
  const { key, pathname } = useLocation();
  const type = useNavigationType();
  const entry = useRef(key);
  const path = useRef(pathname);

  // Saved on every scroll, not on leave: by the time the route changes the new page may have clamped it.
  useEffect(() => {
    history.scrollRestoration = "manual";
    const save = () => sessionStorage.setItem(PREFIX + entry.current, String(window.scrollY));
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);

  useLayoutEffect(() => {
    entry.current = key;
    if (path.current === pathname) return;
    path.current = pathname;
    window.scrollTo(0, type === "POP" ? Number(sessionStorage.getItem(PREFIX + key)) : 0);
  }, [key, pathname, type]);

  return null;
}
