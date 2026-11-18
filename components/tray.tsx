import { Scrap } from "@/components/scrap";
import type { TrayItem } from "@/lib/types";

const TILTS = [-6, 4, -3, 5, -4];
const LABEL_TILTS = [-4, 3, -2, 4, -3];

/** The main picture first, then any extras, at most three in a well. */
function pictures(item: TrayItem): string[] {
  return [item.image, ...(item.extras ?? [])].filter((src): src is string => Boolean(src)).slice(0, 3);
}

/**
 * A lunch tray with five wells. Each well holds one thing: a photo if there
 * is one, otherwise an emoji, with a cut-paper label underneath. Images under
 * /collage/ are ready-made cut-outs (the drinks) and are shown without a frame.
 */
export function Tray({ items, className = "" }: { items: TrayItem[]; className?: string }) {
  const wells = Array.from({ length: 5 }, (_, index) => items[index] ?? null);

  return (
    <div className={`tray ${className}`}>
      <div className="tray-body">
        {wells.map((item, index) => (
          <div className={`tray-well tray-well-${index + 1}`} key={index}>
            {item && (pictures(item).length > 0 || item.emoji || item.label) ? (
              <>
                <span className={`tray-pile ${pictures(item).length > 1 ? "tray-pile-many" : ""}`}>
                  {pictures(item).length > 0 ? (
                    pictures(item).map((src, place) => (
                      // Photos are small data URLs or local cut-outs, so next/image adds nothing.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={place === 0 ? item.label : ""}
                        className={src.startsWith("/collage/") ? "tray-cutout" : "tray-photo"}
                        key={place}
                        src={src}
                        style={{ "--tilt": `${TILTS[(index + place * 2) % 5]}deg` } as React.CSSProperties}
                      />
                    ))
                  ) : (
                    <span
                      aria-hidden="true"
                      className="tray-thing"
                      style={{ "--tilt": `${TILTS[index]}deg` } as React.CSSProperties}
                    >
                      {item.emoji}
                    </span>
                  )}
                </span>
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
