import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Close, EmojiEmotions } from "@mui/icons-material";
import IconButton from "../../../../components/ui/IconButton";
import SimpleEmojiPicker from "../../../../components/ui/SimpleEmojiPicker";

const PICKER_WIDTH = 320;
const HEADER_HEIGHT = 36;
const PICKER_HEIGHT = 400;
const GAP = 8;

// Rendered through a portal into document.body: the comment/reply composer
// sits inside a Card with `overflow-hidden` (so a card that grows with
// comments doesn't blow out its rounded corners), which clipped the picker
// whenever it didn't fit entirely inside that card. Portaling escapes that
// clipping, and the position is computed from the button's own on-screen
// rect so it still opens upward when there's room and flips to open
// downward near the top of the page instead of running off-screen.
const EmojiPickerButton = ({ open, onToggle, onEmoji }) => {
  const buttonRef = useRef(null);
  const pickerRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const place = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const openUpward = rect.top >= PICKER_HEIGHT + GAP;
      const top = openUpward
        ? rect.top - PICKER_HEIGHT - GAP
        : Math.min(rect.bottom + GAP, window.innerHeight - PICKER_HEIGHT - GAP);
      const left = Math.min(
        Math.max(GAP, rect.right - PICKER_WIDTH),
        window.innerWidth - PICKER_WIDTH - GAP,
      );
      setCoords({ top: Math.max(GAP, top), left });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Closes on outside click or Escape — previously the only way to close
  // this picker was clicking the toggle button again, so clicking away did
  // nothing. `onToggle` is always a plain boolean flip in every caller, so
  // calling it while already open is exactly "close". The button itself is
  // excluded from the outside-click check so its own onClick isn't fought
  // by this listener (no double-toggle/instant-reopen from event bubbling).
  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (
        !buttonRef.current?.contains(event.target) &&
        !pickerRef.current?.contains(event.target)
      ) {
        onToggle();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onToggle();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onToggle]);

  return (
    <div className="emoji-wrapper">
      <button
        ref={buttonRef}
        type="button"
        className="emoji-button"
        aria-label="Choose emoji"
        title="Choose emoji"
        onClick={onToggle}
      >
        <EmojiEmotions fontSize="small" />
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={pickerRef}
            className="emoji-picker overflow-hidden rounded-xl"
            style={{ position: "fixed", top: coords.top, left: coords.left, bottom: "auto" }}
          >
            <div className="flex items-center justify-between border-b border-line bg-panel px-2 py-1.5">
              <span className="text-xs font-semibold text-muted">Emoji</span>
              <IconButton
                label="Close emoji picker"
                icon={<Close fontSize="small" />}
                size="sm"
                onClick={onToggle}
              />
            </div>
            <SimpleEmojiPicker
              onEmojiClick={(emojiData) => onEmoji(emojiData.emoji)}
              width={PICKER_WIDTH}
              height={PICKER_HEIGHT - HEADER_HEIGHT}
            />
          </div>,
          document.body,
        )}
    </div>
  );
};

export default EmojiPickerButton;
