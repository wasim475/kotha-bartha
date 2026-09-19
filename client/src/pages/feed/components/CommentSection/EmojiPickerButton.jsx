import { EmojiEmotions } from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";

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
        />
      </div>
    )}
  </div>
);

export default EmojiPickerButton;
