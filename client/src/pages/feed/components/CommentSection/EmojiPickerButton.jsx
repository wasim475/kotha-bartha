import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { EmojiEmotions } from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";

const PICKER_WIDTH = 320;
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
            className="emoji-picker"
            style={{ position: "fixed", top: coords.top, left: coords.left, bottom: "auto" }}
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => onEmoji(emojiData.emoji)}
              width={PICKER_WIDTH}
              height={PICKER_HEIGHT}
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
              searchDisabled
              categories={[
                "smileys_people",
                "animals_nature",
                "food_drink",
                "travel_places",
                "activities",
                "objects",
                "symbols",
                "flags",
              ]}
            />
          </div>,
          document.body,
        )}
    </div>
  );
};

export default EmojiPickerButton;
