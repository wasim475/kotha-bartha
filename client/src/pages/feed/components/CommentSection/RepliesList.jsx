import ReplyItem from "./ReplyItem";

/**
 * The branch/connector line for a comment's replies: a simple flex column
 * with a left border, not absolute positioning — so it wraps naturally
 * with long text and never causes horizontal overflow on narrow screens.
 */
const RepliesList = ({ replies, postAuthorId, renderReply }) => (
  <div className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-3 sm:pl-4">
    {replies.map((reply) => (
      <ReplyItem key={reply.id} entry={reply} postAuthorId={postAuthorId} {...renderReply(reply)} />
    ))}
  </div>
);

export default RepliesList;
