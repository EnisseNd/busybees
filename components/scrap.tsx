import type { ReactNode } from "react";

const SHAPES = ["", "scrap-b", "scrap-c"] as const;

/** A cut-paper label. `shape` picks one of three hand-cut outlines. */
export function Scrap({
  children,
  tilt = -2,
  shape = 0,
  white = false,
  className = "",
}: {
  children: ReactNode;
  tilt?: number;
  shape?: number;
  white?: boolean;
  className?: string;
}) {
  const cut = SHAPES[Math.abs(shape) % SHAPES.length];
  return (
    <span
      className={`scrap ${cut} ${white ? "scrap-white" : ""} ${className}`}
      style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
    >
      <span className="scrap-paper">{children}</span>
    </span>
  );
}
