import { colorFor } from "../../utility/helpers";
import { cx } from "../../utility/cx";

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
 */
export default function Avatar({ person, size = "md", className = "" }) {
  const sizeClass = sizes[size] || sizes.md;

  if (person?.avatar?.secureUrl) {
    return (
      <img
        src={person.avatar.secureUrl}
        alt=""
        className={cx(
          "shrink-0 rounded-full bg-soft object-cover",
          sizeClass,
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
        className,
      )}
    >
      {initials}
    </div>
  );
}
