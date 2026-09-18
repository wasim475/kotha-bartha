import { EmojiEmotions, Send } from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useState } from "react";

const MessageComposer = ({ body, setBody, sending, onSend, onTyping }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const addEmoji = (emoji) => {
    setBody((current) => `${current}${emoji}`);

    // emoji দেওয়ার পর picker বন্ধ হবে না
    // তাই একাধিক emoji দেওয়া যাবে
  };

  return (
    <div className="message-composer-container">
      <form className="message-composer" onSubmit={onSend}>
        <div className="emoji-wrapper">
          <button
            type="button"
            className="emoji-button"
            aria-label="Choose emoji"
            title="Choose emoji"
            onClick={() => setShowEmojiPicker((current) => !current)}
          >
            <EmojiEmotions fontSize="small" />
          </button>

          {showEmojiPicker && (
            <div className="emoji-picker">
              <EmojiPicker
                onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
                width={320}
                height={400}
                searchDisabled={false}
                previewConfig={{
                  showPreview: false,
                }}
                lazyLoadEmojis
              />
            </div>
          )}
        </div>

        <input
          value={body}
          onChange={(event) => {
            const value = event.target.value;
            setBody(value);
            onTyping(value);
          }}
          placeholder="Write a message..."
          autoFocus
        />

        <button
          type="submit"
          className="primary-button small"
          disabled={sending}
        >
          <Send fontSize="small" />

          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default MessageComposer;
