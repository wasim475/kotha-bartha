import { Add, ChatBubble, Send, ThumbUpAlt } from "@mui/icons-material";
import { useState } from "react";
import { api } from "../../utility/api";
import { Avatar, ResourceState, formatTime, useResource } from "../../utility/helpers";

function PostCard({ post, onChanged }) {
  const [comments, setComments] = useState([]); const [showComments, setShowComments] = useState(false); const [comment, setComment] = useState("");
  const toggleLike = async () => { await api.put(`/posts/${post.id}/like`, { liked: !post.liked }); onChanged(); };
  const toggleComments = async () => { if (!showComments) { const { data } = await api.get(`/posts/${post.id}/comments`); setComments(data.data); } setShowComments(!showComments); };
  const addComment = async (event) => { event.preventDefault(); if (!comment.trim()) return; await api.post(`/posts/${post.id}/comments`, { body: comment.trim() }); setComment(""); toggleComments(); onChanged(); };
  return <article className="post-card"><div className="post-header"><Avatar person={post.author} /><div><strong>{post.author.fullName}</strong><span>{formatTime(post.createdAt)}</span></div></div><p className="post-body">{post.body}</p><div className="post-stats"><span><ThumbUpAlt fontSize="inherit" /> {post.likes}</span><span>{post.comments} comments</span></div><div className="post-actions"><button className={post.liked ? "selected" : ""} onClick={toggleLike}><ThumbUpAlt fontSize="small" /> Like</button><button onClick={toggleComments}><ChatBubble fontSize="small" /> Comment</button></div>{showComments && <div className="comments">{comments.map((entry) => <div className="comment" key={entry.id}><Avatar person={entry.author} /><div><strong>{entry.author.fullName}</strong><p>{entry.body}</p></div></div>)}<form className="comment-form" onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment..." /><button className="primary-button small">Comment</button></form></div>}</article>;
}

export default function Feed({ user }) {
  const posts = useResource("/posts/feed"); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  const createPost = async () => { if (!body.trim() || busy) return; setBusy(true); try { await api.post("/posts", { body: body.trim() }); setBody(""); posts.reload(); } finally { setBusy(false); } };
  return <><div className="page-heading"><div><span className="eyebrow">Your people</span><h1>Your feed</h1></div><button className="primary-button small" onClick={createPost}><Add fontSize="small" /> Create post</button></div><section className="composer"><div className="avatar avatar-coral">{user.fullName.slice(0, 2).toUpperCase()}</div><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={`What is on your mind, ${user.fullName.split(" ")[0]}?`} rows="2" /><div className="composer-actions"><button disabled={busy} onClick={createPost}><Send /> {busy ? "Posting..." : "Post"}</button></div></section><ResourceState loading={posts.loading} error={posts.error} empty="No posts yet. Add a friend or share the first post.">{posts.data?.map((post) => <PostCard key={post.id} post={post} onChanged={posts.reload} />)}</ResourceState></>;
}
