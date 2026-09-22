import { cx } from "../../../utility/cx";

/**
 * Facebook-style photo grid for a post's `media` array (1 image full-width,
 * 2 side-by-side, 3 as one large + two stacked, 4+ as a 2x2 grid with a
 * "+N more" overlay on the last tile). Shared by Feed, Profile → Posts and
 * Single Post so all three look identical. `onOpen(index)` is called with
 * whichever tile/overlay was clicked — the caller decides whether that
 * means "navigate to the single post" (Feed/Profile) or "open the inline
 * lightbox" (Single Post, which is already on that page).
 */
export default function PostMediaGrid({ media, onOpen }) {
  if (!media?.length) return null;

  const count = media.length;

  if (count === 1) {
    return (
      <button type="button" onClick={() => onOpen(0)} className="block w-full bg-soft">
        <img
          src={media[0].secureUrl}
          alt=""
          loading="lazy"
          className="max-h-130 w-full object-cover"
        />
      </button>
    );
  }

  if (count === 2) {
    return (
      <div className="grid h-64 grid-cols-2 gap-0.5 bg-soft">
        {media.map((item, index) => (
          <button
            key={item.publicId || index}
            type="button"
            onClick={() => onOpen(index)}
            className="block h-full overflow-hidden"
          >
            <img src={item.secureUrl} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid h-72 grid-cols-2 gap-0.5 bg-soft">
        <button type="button" onClick={() => onOpen(0)} className="block h-full overflow-hidden">
          <img src={media[0].secureUrl} alt="" loading="lazy" className="size-full object-cover" />
        </button>
        <div className="grid grid-rows-2 gap-0.5">
          {media.slice(1, 3).map((item, index) => (
            <button
              key={item.publicId || index}
              type="button"
              onClick={() => onOpen(index + 1)}
              className="block overflow-hidden"
            >
              <img src={item.secureUrl} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const visible = media.slice(0, 4);
  const hiddenCount = count - visible.length;

  return (
    <div className="grid h-72 grid-cols-2 grid-rows-2 gap-0.5 bg-soft">
      {visible.map((item, index) => {
        const isOverlayTile = index === visible.length - 1 && hiddenCount > 0;
        return (
          <button
            key={item.publicId || index}
            type="button"
            onClick={() => onOpen(index)}
            className={cx("relative block overflow-hidden", isOverlayTile && "group")}
          >
            <img src={item.secureUrl} alt="" loading="lazy" className="size-full object-cover" />
            {isOverlayTile && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white transition-colors group-hover:bg-black/65">
                +{hiddenCount} more
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
