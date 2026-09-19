const CommentEditForm = ({ value, onChange, onSave, onCancel }) => (
  <div className="comment-edit-box">
    <input value={value} onChange={(event) => onChange(event.target.value)} />
    <button type="button" onClick={onSave}>
      Save
    </button>
    <button type="button" onClick={onCancel}>
      Cancel
    </button>
  </div>
);

export default CommentEditForm;
