const CommentReply = ({ authorName, value, onChange, onSubmit, onCancel }) => (
  <form className="comment-reply-form" onSubmit={onSubmit}>
    <span>Replying to {authorName}</span>
    <div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write a reply..."
        autoFocus
      />
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="primary-button small">
        Reply
      </button>
    </div>
  </form>
);

export default CommentReply;
