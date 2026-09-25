import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import Avatar from "../ui/Avatar";
import Card from "../ui/Card";
import { formatTime } from "../../utility/helpers";
import { cx } from "../../utility/cx";
import { Pill } from "./AdminUserStatus";

const STATE_TONE = { visible: "visible", hidden: "hidden", deleted: "deleted" };

function Author({ author }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar person={author} size="sm" />
      {author.id ? (
        <Link to={`/admin/users/${author.id}`} className="min-w-0 truncate text-sm font-semibold text-ink hover:underline">
          {author.fullName}
        </Link>
      ) : (
        <span className="text-sm font-semibold text-muted">{author.fullName}</span>
      )}
    </span>
  );
}

/**
 * A post with its whole thread exactly as stored — hidden and deleted items are
 * shown (labelled), because an admin must be able to read what was reported. The
 * item flagged `highlighted` is scrolled into view and outlined, so a report's
 * comment or reply is unmistakable.
 */
export default function AdminThread({ post, comments }) {
  const marked = useRef(null);
  const focusId = comments.find((comment) => comment.highlighted)?.id;

  useEffect(() => {
    marked.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [focusId]);

  const top = comments.filter((comment) => !comment.parentId);
  const repliesOf = (id) => comments.filter((comment) => comment.parentId === id);

  const item = (comment, nested) => (
    <li
      key={comment.id}
      ref={comment.highlighted ? marked : null}
      data-testid={comment.highlighted ? "admin-highlight" : "admin-comment"}
      className={cx("min-w-0 rounded-lg border p-2.5", nested ? "ml-4 sm:ml-8" : "", comment.highlighted ? "border-accent bg-accent/10 ring-2 ring-accent" : "border-line bg-soft/60")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Author author={comment.author} />
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          {comment.status !== "visible" && <Pill tone={STATE_TONE[comment.status]}>{comment.status === "hidden" ? "Hidden (author banned)" : "Deleted"}</Pill>}
          {formatTime(comment.createdAt)}
        </span>
      </div>
      <p className="mt-1.5 text-sm wrap-break-word text-ink">{comment.body}</p>
      {nested ? null : <ul className="mt-2 flex flex-col gap-2">{repliesOf(comment.id).map((reply) => item(reply, true))}</ul>}
    </li>
  );

  return (
    <Card className="flex min-w-0 flex-col gap-3" data-testid="admin-thread">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Author author={post.author} />
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          {post.status !== "visible" && <Pill tone={STATE_TONE[post.status]}>{post.status === "hidden" ? "Hidden (author banned)" : "Deleted"}</Pill>}
          {formatTime(post.createdAt)}
        </span>
      </div>
      {post.body && <p className="text-sm whitespace-pre-wrap wrap-break-word text-ink">{post.body}</p>}
      {post.media?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.media.map((media) => (
            <img key={media.secureUrl} src={media.secureUrl} alt="" className="size-24 rounded-lg border border-line object-cover" loading="lazy" />
          ))}
        </div>
      )}
      <p className="text-xs text-muted">
        {post.comments} comments · {post.reactions} reactions
      </p>
      {top.length > 0 ? <ul className="flex flex-col gap-2">{top.map((comment) => item(comment, false))}</ul> : <p className="text-xs text-muted">No comments.</p>}
    </Card>
  );
}
