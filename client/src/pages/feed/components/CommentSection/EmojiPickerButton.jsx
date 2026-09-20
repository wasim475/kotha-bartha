import { EmojiEmotions } from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
console.log(EmojiPicker)   
const EmojiPickerButton = ({ open, onToggle, onEmoji }) => (
  <div className="emoji-wrapper">
    <button
      type="button"
      className="emoji-button"
      aria-label="Choose emoji"
      title="Choose emoji"
      onClick={onToggle}
    >
      <EmojiEmotions fontSize="small" />
    </button>
    {open && (
      <div className="emoji-picker">
        <EmojiPicker
          onEmojiClick={(emojiData) => onEmoji(emojiData.emoji)}
          width={320}
          height={400}
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
      </div>
    )}
  </div>
);

export default EmojiPickerButton;
