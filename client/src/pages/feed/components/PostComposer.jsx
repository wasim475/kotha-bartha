import { Send } from "@mui/icons-material";
import { forwardRef } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";

const autoGrow = (event) => {
  const el = event.target;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const PostComposer = forwardRef(function PostComposer(
  { user, body, setBody, busy, onSubmit },
  ref,
) {
  return (
    <Card as="section" className="mb-4 flex gap-3">
      <Avatar person={user} size="md" />

      <div className="min-w-0 flex-1">
        <textarea
          ref={ref}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            autoGrow(event);
          }}
          placeholder={`What is on your mind, ${user.fullName.split(" ")[0]}?`}
          rows={2}
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-muted focus:outline-none"
        />

        <div className="mt-3 flex justify-end border-t border-line pt-3">
          <Button
            variant="primary"
            size="sm"
            disabled={!body.trim() || busy}
            loading={busy}
            onClick={onSubmit}
          >
            <Send fontSize="small" />
            {busy ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
    </Card>
  );
});

export default PostComposer;
