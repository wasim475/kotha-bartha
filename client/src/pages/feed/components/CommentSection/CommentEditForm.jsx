import Button from "../../../../components/ui/Button";

const CommentEditForm = ({ value, onChange, onSave, onCancel }) => (
  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoFocus
      className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
    />
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" size="sm" type="button" onClick={onSave}>
        Save
      </Button>
    </div>
  </div>
);

export default CommentEditForm;
