import CommentItem from "./CommentItem";

const CommentList = ({ comments, postAuthorId, user, renderComment }) => (
  <div className="flex flex-col gap-4">
    {comments
      .filter((entry) => !entry.parentId)
      .map((entry) => (
        <CommentItem
          key={entry.id}
          postAuthorId={postAuthorId}
          user={user}
          {...renderComment(entry)}
        />
      ))}
  </div>
);

export default CommentList;
