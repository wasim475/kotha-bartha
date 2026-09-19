import EmojiPickerButton from "./EmojiPickerButton";

const CommentForm = ({
  value,
  onChange,
  onSubmit,
  emojiOpen,
  onToggleEmoji,
  onEmoji,
}) => (
  <form className="comment-form" onSubmit={onSubmit}>
    <EmojiPickerButton
      open={emojiOpen}
      onToggle={onToggleEmoji}
      onEmoji={onEmoji}
    />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Write a comment..."
    />
    <button type="submit" className="primary-button small">
      Comment
    </button>
  </form>
);

export default CommentForm;
