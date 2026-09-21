import { ArrowBack } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";

import { ResourceState, useResource } from "../../utility/helpers";
import PostCard from "./components/PostCard";

export default function SinglePost({ user }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const post = useResource(`/posts/${postId}`);

  return (
    <>
      <div className="page-heading single-post-heading">
        <div>
          <span className="eyebrow">Post</span>
          <h1>Conversation</h1>
        </div>
        <button
          type="button"
          className="outline-button"
          onClick={() => navigate("/app/feed")}
        >
          <ArrowBack fontSize="small" />
          Back to feed
        </button>
      </div>

      <ResourceState loading={post.loading} error={post.error}>
        {post.data ? (
          <PostCard
            post={post.data}
            user={user}
            onChanged={post.reload}
            initialShowComments
          />
        ) : null}
      </ResourceState>
    </>
  );
}
