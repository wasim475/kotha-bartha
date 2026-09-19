import CommentReaction from "./CommentReaction";

const ReactionSummary = ({ reactions = {} }) => {
  const total = Object.values(reactions).reduce((sum, count) => sum + count, 0);
  return (
    <div className="comment-reactions" aria-label="Comment reactions">
      {Object.entries(reactions)
        .filter(([, count]) => count > 0)
        .map(([type]) => (
          <span className={`comment-reaction ${type}`} key={type}>
            <CommentReaction type={type} />
          </span>
        ))}
      {total > 0 && <b className="comment-reaction-total">{total}</b>}
    </div>
  );
};

export default ReactionSummary;
