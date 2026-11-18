export const fieldClass =
  "w-full rounded-[2px] border-2 border-hairline bg-white px-3 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-leaf";

export const labelClass = "mb-1.5 block text-sm font-extrabold text-ink";

const stickerBase =
  "inline-flex items-center justify-center rounded-[2px] px-5 py-2.5 text-sm font-extrabold motion-safe:transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60";

/** Green sticker label. The hard offset shadow flattens when pressed. */
export const primaryButtonClass = `${stickerBase} bg-leaf text-white shadow-[3px_3px_0_var(--leaf-deep)] hover:bg-leaf-deep`;

/** White paper label with a pink edge. */
export const secondaryButtonClass = `${stickerBase} border-2 border-hairline bg-white text-ink shadow-[3px_3px_0_var(--hairline)] hover:border-rose`;

/** Pink sticker label, for the second choice in a pair (Pass, Remove). */
export const roseButtonClass = `${stickerBase} bg-[#c63a6c] text-white shadow-[3px_3px_0_var(--berry)] hover:bg-berry`;

/** A sheet of straight-cut paper. */
export const cardClass = "panel p-6";
