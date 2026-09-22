import { Close, Image as ImageIcon, Send } from "@mui/icons-material";
import { forwardRef, useEffect, useRef, useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import IconButton from "../../../components/ui/IconButton";
import EmojiPickerButton from "./CommentSection/EmojiPickerButton";

const autoGrow = (event) => {
  const el = event.target;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const PostComposer = forwardRef(function PostComposer(
  { user, body, setBody, imageFile, onImageChange, busy, onSubmit },
  ref,
) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // The preview is a local object URL for whatever file is currently
  // selected — created/revoked here so it never outlives the file it
  // points at (a stale URL from a previous selection, or one held past
  // unmount, would leak memory).
  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const canSubmit = (body.trim() || imageFile) && !busy;

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

        {imagePreviewUrl && (
          <div className="relative mt-2 inline-block">
            <img
              src={imagePreviewUrl}
              alt="Selected"
              className="max-h-64 rounded-lg border border-line object-contain"
            />
            <IconButton
              label="Remove image"
              icon={<Close fontSize="small" />}
              size="sm"
              onClick={() => onImageChange(null)}
              className="absolute top-1.5 right-1.5 bg-black/55 text-white hover:bg-black/70 hover:text-white"
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <div className="flex items-center gap-1">
            <IconButton
              label="Add a photo"
              icon={<ImageIcon fontSize="small" />}
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onImageChange(file);
              }}
            />
            <EmojiPickerButton
              open={showEmojiPicker}
              onToggle={() => setShowEmojiPicker((current) => !current)}
              onEmoji={(emoji) => setBody((current) => `${current}${emoji}`)}
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={!canSubmit}
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
