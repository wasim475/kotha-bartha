import CommentItem from "./CommentItem";

const CommentList = ({ comments, postAuthorId, renderComment }) => (
  <>
    {comments
      .filter((entry) => !entry.parentId)
      .map((entry) => (
        <CommentItem
          key={entry.id}
          {...renderComment(entry)}
          postAuthorId={postAuthorId}
        />
      ))}
  </>
);

export default CommentList;
