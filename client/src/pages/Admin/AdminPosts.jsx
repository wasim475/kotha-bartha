import { Search } from "@mui/icons-material";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AdminButton from "../../components/admin/AdminButton";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";
import AdminPage from "../../components/admin/AdminPage";
import AdminPagination from "../../components/admin/AdminPagination";
import { Pill } from "../../components/admin/AdminUserStatus";
import { SkeletonLines } from "../../components/admin/AdminLoadingSkeleton";
import Avatar from "../../components/ui/Avatar";
import Card from "../../components/ui/Card";
import useAdminAction from "../../hooks/admin/useAdminAction";
import useAdminQuery from "../../hooks/admin/useAdminQuery";
import useDebounced from "../../hooks/admin/useDebounced";
import { formatTime } from "../../utility/helpers";

const STATUSES = [
  ["all", "All statuses"],
  ["visible", "Visible"],
  ["hidden", "Hidden (banned author)"],
  ["deleted", "Deleted"],
];

const inputClass = "h-11 min-w-0 rounded-lg border border-line bg-panel px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent";

/** /admin/posts — every post, paginated and filtered on the server. */
export default function AdminPosts() {
  const [params, setParams] = useSearchParams();
  const userId = params.get("userId") || "";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const q = useDebounced(search.trim(), 350);
  const query = useMemo(() => ({ page, q, userId, status: status === "all" ? "" : status, from, to }), [page, q, userId, status, from, to]);
  const posts = useAdminQuery("/admin/posts", query);
  const action = useAdminAction();

  const reset = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const remove = async () => {
    if (await action.run("DELETE", `/admin/posts/${target.id}`)) {
      setTarget(null);
      posts.reload();
    }
  };

  return (
    <AdminPage title="Posts" subtitle="Everything people have posted.">
      <div className="grid grid-cols-1 gap-2.5 min-[560px]:grid-cols-2 xl:grid-cols-4">
        <label className="relative block min-[560px]:col-span-2">
          <span className="sr-only">Search post text</span>
          <Search fontSize="small" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={reset(setSearch)} placeholder="Search post text…" className={`${inputClass} w-full pl-10`} data-testid="admin-post-search" />
        </label>
        <select value={status} onChange={reset(setStatus)} aria-label="Status" className={inputClass}>
          {STATUSES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input type="date" value={from} onChange={reset(setFrom)} aria-label="From date" className={`${inputClass} flex-1`} />
          <input type="date" value={to} onChange={reset(setTo)} aria-label="To date" className={`${inputClass} flex-1`} />
        </div>
      </div>
      {userId && (
        <p className="flex items-center gap-2 text-xs text-muted">
          Showing one user&apos;s posts.
          <button type="button" className="font-semibold text-accent" onClick={() => setParams({})}>
            Show everyone
          </button>
        </p>
      )}

      {posts.loading ? (
        <SkeletonLines rows={5} />
      ) : posts.error ? (
        <Card className="text-sm text-danger" role="alert">
          {posts.error}
        </Card>
      ) : !posts.data.items.length ? (
        <Card className="py-10 text-center text-sm text-muted" data-testid="admin-empty">
          No posts match.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.data.items.map((post) => (
            <li key={post.id}>
              <Card className="flex min-w-0 flex-col gap-2.5" data-testid="admin-post">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar person={post.author} size="sm" />
                    <span className="min-w-0">
                      {post.author.id ? (
                        <Link to={`/admin/users/${post.author.id}`} className="block truncate text-sm font-semibold text-ink hover:underline">
                          {post.author.fullName}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-muted">{post.author.fullName}</span>
                      )}
                      <span className="text-xs text-muted">{formatTime(post.createdAt)}</span>
                    </span>
                  </span>
                  <Pill tone={post.status}>{post.status === "hidden" ? "Hidden (author banned)" : post.status.charAt(0).toUpperCase() + post.status.slice(1)}</Pill>
                </div>
                {post.preview && <p className="text-sm wrap-break-word text-ink">{post.preview}</p>}
                {post.media.length > 0 && (
                  <div className="flex gap-2">
                    {post.media.slice(0, 3).map((media) => (
                      <img key={media.secureUrl} src={media.secureUrl} alt="" className="size-16 rounded-lg border border-line object-cover" loading="lazy" />
                    ))}
                    {post.mediaCount > 3 && <span className="self-center text-xs text-muted">+{post.mediaCount - 3}</span>}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    {post.comments} comments · {post.reactions} reactions
                  </p>
                  <div className="flex gap-2">
                    <Link to={`/admin/posts/${post.id}`} className="inline-flex min-h-10 items-center rounded-md border border-line bg-panel px-3.5 text-xs font-semibold text-ink hover:bg-soft">
                      View
                    </Link>
                    {post.status !== "deleted" && (
                      <AdminButton variant="danger" className="min-h-10" onClick={() => { action.clearError(); setTarget(post); }}>
                        Delete
                      </AdminButton>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {posts.data && <AdminPagination page={posts.data.page} totalPages={posts.data.totalPages} total={posts.data.total} onPage={setPage} noun="posts" disabled={posts.loading} />}

      <AdminConfirmDialog
        open={Boolean(target)}
        title="Delete this post permanently?"
        description="The post disappears for everyone, together with its photos and the notifications about it."
        confirmLabel="Delete post"
        variant="danger"
        busy={action.busy}
        error={action.error}
        onConfirm={remove}
        onCancel={() => setTarget(null)}
      />
    </AdminPage>
  );
}
