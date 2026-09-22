import { Close, Image as ImageIcon, Send } from "@mui/icons-material";
import { forwardRef, useEffect, useRef, useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import IconButton from "../../../components/ui/IconButton";
import EmojiPickerButton from "./CommentSection/EmojiPickerButton";

const MAX_IMAGES = 6;

const autoGrow = (event) => {
  const el = event.target;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const PostComposer = forwardRef(function PostComposer(
  { user, body, setBody, imageFiles = [], setImageFiles, busy, onSubmit },
  ref,
) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewUrls, setPreviewUrls] = useState([]);
  const fileInputRef = useRef(null);

  // One object URL per selected file, rebuilt whenever the selection
  // changes and revoked on cleanup so removed/replaced files never leak.
  useEffect(() => {
    if (!imageFiles.length) {
      setPreviewUrls([]);
      return undefined;
    }
    const urls = imageFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [imageFiles]);

  const canSubmit = (body.trim() || imageFiles.length > 0) && !busy;

  const addFiles = (files) => {
    if (!files.length) return;
    setImageFiles((current) => [...current, ...files].slice(0, MAX_IMAGES));
  };

  const removeImage = (index) => {
    setImageFiles((current) => current.filter((_, i) => i !== index));
  };

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

        {previewUrls.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {previewUrls.map((url, index) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-md border border-line bg-soft"
              >
                <img src={url} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => removeImage(index)}
                  className="absolute top-0.5 right-0.5 flex size-4.5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                >
                  <Close style={{ fontSize: 12 }} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <div className="flex items-center gap-1">
            <IconButton
              label="Add photos"
              icon={<ImageIcon fontSize="small" />}
              size="sm"
              disabled={imageFiles.length >= MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                addFiles(files);
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
