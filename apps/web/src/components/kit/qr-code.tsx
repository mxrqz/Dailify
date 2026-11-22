import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A QR code in `ink` on `canvas`, one `<rect>` per dark module. The encoder (`uqr`, ~8 KB gzip, no
 * deps) loads on first use: only desktop MFA setup shows one.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [modules, setModules] = useState<boolean[][]>();

  useEffect(() => {
    let live = true;
    void import("uqr").then(({ encode }) => {
      if (live) setModules(encode(value, { ecc: "M", border: 2 }).data);
    });
    return () => {
      live = false;
    };
  }, [value]);

  const size = modules?.length ?? 1;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("aspect-square rounded-md bg-canvas text-ink", className)}
    >
      {modules?.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}
