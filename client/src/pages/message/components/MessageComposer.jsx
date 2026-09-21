import { Close, EmojiEmotions, Send } from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";

import IconButton from "../../../components/ui/IconButton";
import useButtonColorFix from "../../../utility/useButtonColorFix";

const MessageComposer = ({
  body,
  setBody,
  sending,
  onSend,
  onTyping,
  replyingTo,
  onCancelReply,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiWrapperRef = useRef(null);
  const textareaRef = useRef(null);
  const sendFix = useButtonColorFix("primary");

  const addEmoji = (emoji) => {
    setBody((current) => `${current}${emoji}`);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (!showEmojiPicker) return undefined;

    const handleOutsideClick = (event) => {
      if (!emojiWrapperRef.current?.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showEmojiPicker]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [body]);

  const submit = (event) => {
    event?.preventDefault?.();
    onSend(event || { preventDefault: () => {} });
  };

  return (
    <div className="shrink-0 border-t border-line bg-panel">
      {replyingTo && (
        <div className="flex items-center gap-2 border-b border-line bg-soft px-3.5 py-2 text-xs text-muted sm:px-4">
          <div className="min-w-0 flex-1 border-l-2 border-accent pl-2">
            <span className="block truncate">Replying to: {replyingTo.body}</span>
          </div>
          <IconButton
            label="Cancel reply"
            icon={<Close fontSize="small" />}
            size="sm"
            onClick={onCancelReply}
          />
        </div>
      )}

      <form
        className="flex items-end gap-1.5 p-2.5 sm:gap-2 sm:p-3"
        onSubmit={submit}
      >
        <div className="relative shrink-0" ref={emojiWrapperRef}>
          <IconButton
            label="Choose emoji"
            icon={<EmojiEmotions fontSize="small" />}
            active={showEmojiPicker}
            onClick={() => setShowEmojiPicker((current) => !current)}
          />

          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 z-40 mb-2 overflow-hidden rounded-xl border border-line bg-panel shadow-soft">
              <EmojiPicker
                onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
                width={300}
                height={360}
                searchDisabled={false}
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis
              />
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={body}
          rows={1}
          onChange={(event) => {
            const value = event.target.value;
            setBody(value);
            onTyping(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message…"
          autoFocus
          className="min-h-9 max-h-30 flex-1 resize-none rounded-2xl border border-line bg-paper px-3.5 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
        />

        <button
          type="submit"
          disabled={sending || !body.trim()}
          aria-label={sending ? "Sending message" : "Send message"}
          style={sendFix.style}
          onMouseEnter={sendFix.onMouseEnter}
          onMouseLeave={sendFix.onMouseLeave}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm transition-colors motion-safe:duration-150 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Send fontSize="small" />
        </button>
      </form>
    </div>
  );
};

export default MessageComposer;
