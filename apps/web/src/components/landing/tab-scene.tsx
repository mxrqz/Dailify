import type { ReactNode } from "react";

interface TabSceneProps {
  title: string;
  blurb: string;
  /** Mockup layers — each positioned `absolute` by the caller; free to bleed off the edges. */
  children: ReactNode;
}

/**
 * Layout primitive for a feature-tab panel: caller-positioned mockup layers (which bleed past the
 * edges, clipped by the panel's overflow-hidden) with the copy pinned bottom-center over a fade
 * scrim. Layers are decorative (aria-hidden); only the copy stays in the a11y tree.
 */
export function TabScene({ title, blurb, children }: TabSceneProps): JSX.Element {
  return (
    <div className="relative h-full w-full">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-background via-background/85 to-transparent px-6 pb-8 pt-16 text-center">
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{blurb}</p>
      </div>
    </div>
  );
}
