import { ThumbUpAlt } from "@mui/icons-material";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cx } from "../../../utility/cx";
import ReactionIcon from "./ReactionIcons";
import ReactionPicker from "./ReactionPicker";
import { REACTION_LABELS, REACTION_TYPES } from "./reactionTypes";

const CAN_HOVER =
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const LONG_PRESS_MS = 400;

const sizes = {
  sm: { button: "h-8 px-2 text-[11px]", icon: "size-3.5", mui: "small" },
  md: { button: "h-9 px-2.5 text-xs", icon: "size-4", mui: "small" },
};

/**
 * The one reaction trigger shared by posts, comments and replies: a plain
 * tap/click toggles "Like"; hovering (desktop) or a long-press (touch, or
 * mouse) reveals the full picker. Selecting the currently-active reaction
 * again is treated by the caller as "remove" (same contract the comment
 * reaction endpoint already uses).
 */
export default function ReactionButton({
  value,
  onChange,
  types = REACTION_TYPES,
  size = "md",
  label = "React",
  fullWidth = false,
  className = "",
}) {
  const pickerEnabled = types.length > 1;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [placement, setPlacement] = useState("top");
  const [openedByKeyboard, setOpenedByKeyboard] = useState(false);

  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const pickerRef = useRef(null);
  const closeTimer = useRef(null);
  const longPressTimer = useRef(null);
  const suppressClick = useRef(false);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openPicker = () => {
    clearCloseTimer();
    setPickerOpen(true);
  };

  const closePicker = useCallback((returnFocus = false) => {
    setPickerOpen(false);
    setOpenedByKeyboard(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const scheduleClose = () => {
    if (!CAN_HOVER) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(closePicker, 200);
  };

  const startLongPress = () => {
    if (!pickerEnabled) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      openPicker();
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    // Touch devices have no hover, so a tap is the only way to reach the
    // picker — it must open it rather than instantly reacting, or the
    // other four reactions become unreachable without a long-press.
    if (pickerEnabled && !CAN_HOVER) {
      if (pickerOpen) closePicker(false);
      else openPicker();
      return;
    }
    onChange(value ? value : "like");
  };

  const sizing = sizes[size] || sizes.md;

  const handlePick = (type) => {
    closePicker(true);
    onChange(type);
  };

  const handleTriggerKeyDown = (event) => {
    if (!pickerEnabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpenedByKeyboard(true);
      openPicker();
    }
  };

  // Close on outside click / Escape (returning focus to the trigger when
  // Escape was used, so keyboard users don't lose their place).
  useEffect(() => {
    if (!pickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) closePicker(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closePicker(true);
    };

    // Pointer Events (not "mousedown") so a tap outside the picker closes
    // it reliably on touch — iOS Safari doesn't always synthesize a mouse
    // event for the first tap after content changes underneath it.
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen, closePicker]);

  // Keep the picker inside the viewport — horizontally centered where
  // possible, and flipped below the trigger instead of above it when there
  // isn't enough room above (e.g. a reaction near the top of the screen,
  // right under a sticky header).
  useLayoutEffect(() => {
    if (!pickerOpen) return;
    const wrap = wrapRef.current;
    const picker = pickerRef.current;
    if (!wrap || !picker) return;

    const wrapRect = wrap.getBoundingClientRect();
    const pickerWidth = picker.offsetWidth;
    const pickerHeight = picker.offsetHeight;
    const margin = 8;

    const centeredOffset = wrapRect.width / 2 - pickerWidth / 2;
    const minOffset = margin - wrapRect.left;
    const maxOffset = window.innerWidth - margin - pickerWidth - wrapRect.left;

    setOffset(
      Math.min(Math.max(centeredOffset, minOffset), Math.max(minOffset, maxOffset)),
    );
    setPlacement(wrapRect.top - pickerHeight - margin < 0 ? "bottom" : "top");
  }, [pickerOpen]);

  useEffect(() => () => {
    clearCloseTimer();
    clearTimeout(longPressTimer.current);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cx("relative inline-flex", fullWidth && "w-full", className)}
      onPointerEnter={CAN_HOVER && pickerEnabled ? openPicker : undefined}
      onPointerLeave={CAN_HOVER && pickerEnabled ? scheduleClose : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={value ? `${REACTION_LABELS[value]} — change reaction` : label}
        aria-haspopup={pickerEnabled ? "menu" : undefined}
        aria-expanded={pickerEnabled ? pickerOpen : undefined}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onClick={handleClick}
        onKeyDown={handleTriggerKeyDown}
        className={cx(
          "inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors motion-safe:duration-150",
          "hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          value ? "text-accent" : "text-muted hover:text-ink",
          fullWidth && "w-full justify-center",
          sizing.button,
        )}
      >
        {value ? (
          <ReactionIcon type={value} className={sizing.icon} />
        ) : (
          <ThumbUpAlt fontSize={sizing.mui} />
        )}
        {value ? REACTION_LABELS[value] : "Like"}
      </button>

      {pickerEnabled && (
        <AnimatePresence>
          {pickerOpen && (
            <div
              className={cx(
                "absolute left-0 z-20",
                placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
              )}
              style={{ transform: `translateX(${offset}px)` }}
            >
              <ReactionPicker
                ref={pickerRef}
                selected={value}
                onSelect={handlePick}
                types={types}
                autoFocus={openedByKeyboard}
                placement={placement}
              />
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
