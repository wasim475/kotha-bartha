import {
  Popover as HeadlessPopover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";

import { cx } from "../../utility/cx";

/**
 * Generic anchored panel for free-form content that isn't a simple action
 * list (search results, profile card, reaction picker). Use `Menu` instead
 * when the content is just a list of clickable actions.
 *
 * `children` of PopoverPanel can be a render function `(close) => node` so
 * callers can close the popover after handling their own interaction.
 */
export default function Popover({
  trigger,
  children,
  align = "end",
  panelClassName = "",
  className = "",
}) {
  return (
    <HeadlessPopover as="div" className={cx("relative inline-block", className)}>
      <PopoverButton as={trigger.type} {...trigger.props} />

      <PopoverPanel
        transition
        anchor={{ to: align === "end" ? "bottom end" : "bottom start", gap: 8 }}
        className={cx(
          "z-30 rounded-md border border-line bg-panel shadow-soft focus:outline-none",
          "origin-top transition motion-safe:duration-100 ease-out",
          "data-[closed]:scale-95 data-[closed]:opacity-0",
          panelClassName,
        )}
      >
        {children}
      </PopoverPanel>
    </HeadlessPopover>
  );
}
