import { Scrap } from "@/components/scrap";
import type { TrayItem } from "@/lib/types";

const TILTS = [-6, 4, -3, 5, -4];
const LABEL_TILTS = [-4, 3, -2, 4, -3];

/**
 * A lunch tray with five wells. Each well holds one thing: a photo if there
 * is one, otherwise an emoji, with a cut-paper label underneath.
 */
export function Tray({ items, className = "" }: { items: TrayItem[]; className?: string }) {
  const wells = Array.from({ length: 5 }, (_, index) => items[index] ?? null);

  return (
    <div className={`tray ${className}`}>
      <div className="tray-body">
        {wells.map((item, index) => (
          <div className={`tray-well tray-well-${index + 1}`} key={index}>
            {item && (item.image || item.emoji || item.label) ? (
              <>
                {item.image ? (
                  // Photos are small data URLs the student uploaded, so next/image adds nothing.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={item.label}
                    className="tray-photo"
                    src={item.image}
                    style={{ "--tilt": `${TILTS[index]}deg` } as React.CSSProperties}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="tray-thing"
                    style={{ "--tilt": `${TILTS[index]}deg` } as React.CSSProperties}
                  >
                    {item.emoji}
                  </span>
                )}
                {item.label ? (
                  <Scrap
                    className={`tray-label ${index % 2 === 0 ? "ink-leaf" : "ink-rose"}`}
                    shape={index}
                    tilt={LABEL_TILTS[index]}
                    white={index % 2 === 1}
                  >
                    {item.label}
                  </Scrap>
                ) : null}
              </>
            ) : (
              <span className="tray-empty">empty</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
