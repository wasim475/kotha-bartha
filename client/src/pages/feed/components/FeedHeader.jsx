import { Add } from "@mui/icons-material";

const FeedHeader = ({ onCreatePost, busy }) => (
  <div className="page-heading">
    <div>
      <span className="eyebrow">Your people</span>
      <h1>Your feed</h1>
    </div>
    <button
      type="button"
      className="primary-button small"
      onClick={onCreatePost}
      disabled={busy}
    >
      <Add fontSize="small" />
      Create post
    </button>
  </div>
);

export default FeedHeader;
