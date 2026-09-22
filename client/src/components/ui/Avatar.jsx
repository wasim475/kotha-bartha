import { colorFor } from "../../utility/helpers";
import { cx } from "../../utility/cx";
import { useActiveStoryAuthorIds } from "../../utility/storyPresence";

const sizes = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[10px]",
  md: "size-10 text-xs",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
};

const ringColors = {
  blue: "bg-[#7396ac]",
  gold: "bg-[#c39b57]",
  mint: "bg-[#72a48e]",
  coral: "bg-[#e98768]",
};

/**
 * Sized avatar for the design system. Same initials-on-color fallback as
 * the original `Avatar` helper (kept in utility/helpers.jsx for existing
 * call sites) so both render identically for the same person.
 *
 * Automatically draws a blue "active Story" ring around the avatar itself
 * whenever `person.id` is in the app-wide active-story-authors set (see
 * utility/storyPresence.js, populated by provider/StoriesProvider.jsx) —
 * every caller gets this for free, with zero per-call-site wiring, which
 * is what makes it consistent across Feed/Comments/Friends/Messages/
 * Profile/Notifications rather than a one-off reimplemented in each. It's
 * drawn with `ring`/`ring-offset` (box-shadow, not a border or wrapper
 * element), so it never changes the avatar's box size or shifts
 * surrounding layout, and it disappears automatically the moment the
 * story expires and drops out of that set (no separate cleanup needed —
 * see StoriesProvider's own TTL-backed refresh).
 */
export default function Avatar({ person, size = "md", className = "" }) {
  const sizeClass = sizes[size] || sizes.md;
  const activeStoryAuthorIds = useActiveStoryAuthorIds();
  const hasStory = Boolean(person?.id && activeStoryAuthorIds.has(person.id));
  const ringClass = hasStory && "ring-2 ring-blue-500 ring-offset-2 ring-offset-panel";

  if (person?.avatar?.secureUrl) {
    return (
      <img
        src={person.avatar.secureUrl}
        alt=""
        className={cx(
          "shrink-0 rounded-full bg-soft object-cover",
          sizeClass,
          ringClass,
          className,
        )}
      />
    );
  }

  const initials =
    person?.initials || person?.fullName?.slice(0, 2).toUpperCase() || "";

  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        ringColors[colorFor(person?.id)] || ringColors.blue,
        sizeClass,
        ringClass,
        className,
      )}
    >
      {initials}
    </div>
  );
}
