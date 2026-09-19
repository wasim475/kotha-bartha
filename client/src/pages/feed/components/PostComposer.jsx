import { Send } from "@mui/icons-material";

const PostComposer = ({ user, body, setBody, busy, onSubmit }) => (
  <section className="composer">
    <div className="avatar avatar-coral">
      {user.fullName.slice(0, 2).toUpperCase()}
    </div>
    <textarea
      value={body}
      onChange={(event) => setBody(event.target.value)}
      placeholder={`What is on your mind, ${user.fullName.split(" ")[0]}?`}
      rows="2"
    />
    <div className="composer-actions">
      <button type="button" disabled={busy} onClick={onSubmit}>
        <Send />
        {busy ? "Posting..." : "Post"}
      </button>
    </div>
  </section>
);

export default PostComposer;
