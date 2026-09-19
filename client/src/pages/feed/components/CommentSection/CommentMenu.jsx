import { Delete, Edit, MoreVert } from "@mui/icons-material";

const CommentMenu = ({ open, onToggle, onEdit, onDelete }) => (
  <div className="feed-menu">
    <button
      type="button"
      className="feed-menu-button"
      aria-label="Comment options"
      onClick={onToggle}
    >
      <MoreVert fontSize="small" />
    </button>
    {open && (
      <div className="feed-menu-popover">
        <button type="button" onClick={onEdit}>
          <Edit fontSize="small" /> Edit
        </button>
        <button type="button" onClick={onDelete}>
          <Delete fontSize="small" /> Delete
        </button>
      </div>
    )}
  </div>
);

export default CommentMenu;
