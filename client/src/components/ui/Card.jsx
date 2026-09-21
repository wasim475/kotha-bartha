import { cx } from "../../utility/cx";

/**
 * The one surface recipe shared by post cards, friend cards, profile
 * panels and the chat panel: a rounded panel on the theme's line/panel
 * tokens with a soft elevation shadow.
 */
export default function Card({
  as,
  padded = true,
  interactive = false,
  className = "",
  children,
  ...rest
}) {
  const Tag = as || "div";

  return (
    <Tag
      className={cx(
        "rounded-lg border border-line bg-panel shadow-soft",
        padded && "p-4",
        interactive &&
          "transition-shadow motion-safe:duration-150 hover:shadow-md",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
