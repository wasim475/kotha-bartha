import { ArrowBack } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";

import AdminButton from "../../components/admin/AdminButton";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";
import AdminPage from "../../components/admin/AdminPage";
import AdminThread from "../../components/admin/AdminThread";
import { SkeletonLines } from "../../components/admin/AdminLoadingSkeleton";
import Card from "../../components/ui/Card";
import useAdminAction from "../../hooks/admin/useAdminAction";
import useAdminQuery from "../../hooks/admin/useAdminQuery";
import { useState } from "react";

/** /admin/posts/:postId — one post with its full thread (hidden and deleted items included). */
export default function AdminPostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const thread = useAdminQuery(`/admin/posts/${postId}`);
  const action = useAdminAction();
  const [confirm, setConfirm] = useState(false);

  const remove = async () => {
    if (await action.run("DELETE", `/admin/posts/${postId}`)) {
      setConfirm(false);
      thread.reload();
    }
  };

  return (
    <AdminPage
      title="Post"
      actions={
        <>
          <AdminButton variant="outline" onClick={() => navigate(-1)}>
            <ArrowBack fontSize="small" /> Back
          </AdminButton>
          {thread.data?.post.status !== "deleted" && (
            <AdminButton variant="danger" onClick={() => setConfirm(true)}>
              Delete post
            </AdminButton>
          )}
        </>
      }
    >
      {thread.loading && <SkeletonLines rows={5} />}
      {thread.error && (
        <Card className="text-sm text-danger" role="alert">
          {thread.error}
        </Card>
      )}
      {thread.data && <AdminThread post={thread.data.post} comments={thread.data.comments} />}
      <AdminConfirmDialog
        open={confirm}
        title="Delete this post permanently?"
        description="The post disappears for everyone, together with its photos and the notifications about it."
        confirmLabel="Delete post"
        variant="danger"
        busy={action.busy}
        error={action.error}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </AdminPage>
  );
}
