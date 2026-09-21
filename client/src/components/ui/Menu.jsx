import {
  Menu as HeadlessMenu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";

import { cx } from "../../utility/cx";

/**
 * Accessible dropdown action menu (post options, comment options,
 * conversation options, profile menu, ...). Built on @headlessui/react's
 * Menu so keyboard navigation, focus trapping/return, Escape-to-close and
 * viewport-aware anchoring come for free instead of the half-dozen
 * hand-rolled `useState` + `mousedown` popovers this replaces.
 *
 * `trigger` is the element that opens the menu (usually an <IconButton/>).
 * `items` is a flat list of { key?, label, icon?, onClick, danger? }.
 */
export default function Menu({ trigger, items, align = "end", className = "" }) {
  return (
    <HeadlessMenu as="div" className={cx("relative inline-block", className)}>
      <MenuButton as={trigger.type} {...trigger.props} />

      <MenuItems
        transition
        anchor={{ to: align === "end" ? "bottom end" : "bottom start", gap: 6 }}
        className={cx(
          "z-30 w-44 rounded-md border border-line bg-panel p-1 shadow-soft focus:outline-none",
          "origin-top transition motion-safe:duration-100 ease-out",
          "data-[closed]:scale-95 data-[closed]:opacity-0",
        )}
      >
        {items.map((item) => (
          <MenuItem key={item.key || item.label}>
            <button
              type="button"
              onClick={item.onClick}
              className={cx(
                "flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium",
                "data-[focus]:bg-soft",
                item.danger ? "text-danger" : "text-ink",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </HeadlessMenu>
  );
}
