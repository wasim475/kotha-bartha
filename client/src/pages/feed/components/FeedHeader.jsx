import { Add } from "@mui/icons-material";

import Button from "../../../components/ui/Button";

/**
 * `onNewPost` focuses the composer rather than submitting anything itself
 * — previously this button silently posted whatever text happened to be
 * sitting in the composer, which was a confusing second submit trigger
 * alongside the composer's own Post button.
 */
const FeedHeader = ({ onNewPost }) => (
  <div className="mb-6 flex items-end justify-between gap-3">
    <div>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Your people
      </span>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
        Your feed
      </h1>
    </div>
    <Button variant="primary" size="sm" onClick={onNewPost}>
      <Add fontSize="small" />
      New post
    </Button>
  </div>
);

export default FeedHeader;
