import {
  Delete,
  Done,
  DoneAll,
  Download,
  Edit,
  EmojiEmotions,
  Forward,
  InsertDriveFile,
  PushPin,
  Reply,
} from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import { cx } from "../../../utility/cx";
import { toFileUrl } from "../../../utility/fileUrl";
import useButtonColorFix from "../../../utility/useButtonColorFix";
import ImageLightbox from "./ImageLightbox";
import LinkPreviewCard from "./LinkPreviewCard";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import { firstUrlIn, normalizeUrl, tokenizeMessageBody } from "../utility/richBody";

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileExtension = (fileName = "") => fileName.split(".").pop()?.slice(0, 5).toUpperCase() || "";

const emojiPickerWidth = 280;
const emojiPickerHeight = 360;
const viewportGap = 8;

const formatMessageTime = (date) => {
  if (!date) return "";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatFullTime = (date) => {
  if (!date) return "";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";
  return parsedDate.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const MessageBubble = ({
  message,
  isOwn,
  otherUser,
  groupStart,
  groupEnd,
  isEditing,
  isDeleting,
  editBody,
  editLoading,
  setEditBody,
  onEdit,
  onDelete,
  onCancelEdit,
  onSaveEdit,
  onReply,
  onReact,
  onForward,
  onTogglePin,
  isGroup,
  isPinned,
  selected,
  emojiOpen,
  onSelectMessage,
  onOpenEmoji,
  onCloseInteraction,
  showSenderName,
}) => {
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const primaryFix = useButtonColorFix("primary");
  // The bubble itself is a <button> (clickable to reveal actions), so it's
  // subject to the same app-wide App.css button reset the rest of this
  // page already works around — see utility/useButtonColorFix.js.
  const ownBubbleFix = useButtonColorFix("primary");
  const otherBubbleFix = useButtonColorFix("outline");
  const bubbleFix = isOwn ? ownBubbleFix : otherBubbleFix;

  useLayoutEffect(() => {
    if (!emojiOpen || !emojiButtonRef.current) {
      setEmojiPickerPosition(null);
      return undefined;
    }

    const positionEmojiPicker = () => {
      const buttonRect = emojiButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) return;

      const pickerWidth = Math.min(
        emojiPickerWidth,
        window.innerWidth - viewportGap * 2,
      );
      const pickerHeight = Math.min(
        emojiPickerHeight,
        window.innerHeight - viewportGap * 2,
      );

      const leftSpace = buttonRect.left - viewportGap;
      const rightSpace = window.innerWidth - buttonRect.right - viewportGap;
      const topSpace = buttonRect.top - viewportGap;
      const bottomSpace = window.innerHeight - buttonRect.bottom - viewportGap;

      const left =
        rightSpace >= pickerWidth || rightSpace >= leftSpace
          ? buttonRect.left
          : buttonRect.right - pickerWidth;
      const top =
        bottomSpace >= pickerHeight || bottomSpace >= topSpace
          ? buttonRect.bottom + viewportGap
          : buttonRect.top - pickerHeight - viewportGap;

      setEmojiPickerPosition({
        left: Math.max(
          viewportGap,
          Math.min(left, window.innerWidth - pickerWidth - viewportGap),
        ),
        top: Math.max(
          viewportGap,
          Math.min(top, window.innerHeight - pickerHeight - viewportGap),
        ),
        width: pickerWidth,
        height: pickerHeight,
      });
    };

    positionEmojiPicker();
    window.addEventListener("resize", positionEmojiPicker);
    window.addEventListener("scroll", positionEmojiPicker, true);

    return () => {
      window.removeEventListener("resize", positionEmojiPicker);
      window.removeEventListener("scroll", positionEmojiPicker, true);
    };
  }, [emojiOpen]);

  useEffect(() => {
    if (!emojiOpen) return undefined;

    const handleOutsideEmojiClick = (event) => {
      if (
        !emojiButtonRef.current?.contains(event.target) &&
        !emojiPickerRef.current?.contains(event.target)
      ) {
        onCloseInteraction();
      }
    };

    document.addEventListener("mousedown", handleOutsideEmojiClick);
    return () =>
      document.removeEventListener("mousedown", handleOutsideEmojiClick);
  }, [emojiOpen, onCloseInteraction]);

  const showActions = selected || emojiOpen;
  const isAttachment = message.type === "attachment";
  const attachment = message.attachment || {};

  return (
    <div
      className={cx("flex", groupStart ? "mt-3" : "mt-0.5", isOwn ? "justify-end" : "justify-start")}
    >
      <div
        className={cx(
          "flex max-w-[86%] items-end gap-1.5 sm:max-w-[min(75%,34rem)]",
          isOwn ? "flex-row-reverse" : "flex-row",
        )}
      >
        {!isOwn && (
          <div className="size-6 shrink-0">
            {groupEnd && <Avatar person={otherUser} size="xs" />}
          </div>
        )}

        <div className="relative flex min-w-0 flex-col">
          {showSenderName && !isOwn && (
            <span className="mb-0.5 ml-1 text-xs font-semibold text-accent">
              {message.sender?.fullName}
            </span>
          )}

          {(message.forwardedFrom || isPinned) && (
            <span
              className={cx(
                "mb-0.5 flex items-center gap-1 text-[10px] font-medium text-muted",
                isOwn ? "mr-1 justify-end" : "ml-1 justify-start",
              )}
            >
              {isPinned && (
                <span className="flex items-center gap-0.5">
                  <PushPin fontSize="inherit" className="text-[11px]" /> Pinned
                </span>
              )}
              {message.forwardedFrom && (
                <span className="flex items-center gap-0.5 italic">
                  <Forward fontSize="inherit" className="text-[11px]" /> Forwarded
                </span>
              )}
            </span>
          )}

          {isEditing ? (
            <div className="w-64 max-w-[70vw] rounded-2xl border border-line bg-panel p-2.5 shadow-soft">
              <input
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
                autoFocus
                aria-label="Edit message"
                className="w-full rounded-md border border-line bg-paper px-2.5 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSaveEdit(message.id);
                  }
                  if (event.key === "Escape") onCancelEdit();
                }}
              />
              <div className="mt-2 flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancelEdit}
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={editLoading}
                  disabled={editLoading || !editBody.trim()}
                  onClick={() => onSaveEdit(message.id)}
                  style={primaryFix.style}
                  onMouseEnter={primaryFix.onMouseEnter}
                  onMouseLeave={primaryFix.onMouseLeave}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : isAttachment ? (
            <div
              onClick={() => onSelectMessage(message.id)}
              className={cx(
                "min-w-0 rounded-2xl text-sm leading-relaxed shadow-sm transition-opacity",
                attachment.kind === "image" ? "p-1" : "px-3.5 py-2",
                isOwn ? "text-white" : "text-ink",
                message.pending && "opacity-70",
              )}
              style={bubbleFix.style}
              onMouseEnter={bubbleFix.onMouseEnter}
              onMouseLeave={bubbleFix.onMouseLeave}
            >
              {message.replyTo && (
                <div
                  className={cx(
                    "mb-1.5 truncate rounded-md border-l-2 px-2 py-1 text-xs",
                    attachment.kind === "image" && "mx-1 mt-1",
                    isOwn
                      ? "border-white/50 bg-white/10 text-white/85"
                      : "border-accent bg-soft text-muted",
                  )}
                >
                  {message.replyTo.body}
                </div>
              )}

              {attachment.kind === "image" && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setLightboxOpen(true);
                  }}
                  className="block"
                >
                  <img
                    src={toFileUrl(attachment.url)}
                    alt={attachment.fileName || "Photo"}
                    loading="lazy"
                    className="max-h-72 max-w-72 rounded-xl object-cover"
                  />
                </button>
              )}

              {attachment.kind === "voice" && (
                <VoiceMessagePlayer
                  src={toFileUrl(attachment.url)}
                  durationSec={attachment.durationSec}
                  isOwn={isOwn}
                />
              )}

              {attachment.kind === "file" && (
                <a
                  href={toFileUrl(attachment.url)}
                  download={attachment.fileName}
                  onClick={(event) => event.stopPropagation()}
                  className={cx(
                    "flex min-w-0 items-center gap-2 rounded-lg",
                    isOwn ? "hover:bg-white/10" : "hover:bg-black/5",
                  )}
                >
                  <InsertDriveFile fontSize="small" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {attachment.fileName || "File"}
                  </span>
                  {fileExtension(attachment.fileName) && (
                    <span
                      className={cx(
                        "shrink-0 rounded px-1 text-[9px] font-bold",
                        isOwn ? "bg-white/15 text-white/85" : "bg-line text-muted",
                      )}
                    >
                      {fileExtension(attachment.fileName)}
                    </span>
                  )}
                  <span
                    className={cx(
                      "shrink-0 text-[10px]",
                      isOwn ? "text-white/75" : "text-muted",
                    )}
                  >
                    {formatFileSize(attachment.size)}
                  </span>
                  <Download fontSize="small" className="shrink-0" />
                </a>
              )}

              {attachment.kind === "image" && lightboxOpen && (
                <ImageLightbox
                  src={toFileUrl(attachment.url)}
                  alt={attachment.fileName}
                  onClose={() => setLightboxOpen(false)}
                />
              )}

              <span
                className={cx(
                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                  attachment.kind === "image" && "px-1.5",
                  isOwn ? "text-white/75" : "text-muted",
                )}
              >
                {message.pending ? (
                  <span>
                    {Number.isFinite(message.uploadProgress)
                      ? `Uploading… ${message.uploadProgress}%`
                      : "Sending…"}
                  </span>
                ) : (
                  <span>{formatMessageTime(message.createdAt)}</span>
                )}
                {isOwn && !message.pending && (
                  <span className="flex items-center">
                    {message.status === "read" || message.status === "delivered" ? (
                      <DoneAll
                        fontSize="inherit"
                        className={message.status === "read" ? "text-[13px] text-sky-300" : "text-[13px]"}
                      />
                    ) : (
                      <Done fontSize="inherit" className="text-[13px]" />
                    )}
                  </span>
                )}
              </span>
            </div>
          ) : (
            <button
              type="button"
              title={formatFullTime(message.createdAt)}
              onClick={() => onSelectMessage(message.id)}
              className={cx(
                "min-w-0 rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed wrap-break-word shadow-sm transition-opacity",
                isOwn ? "text-white" : "text-ink",
                message.pending && "opacity-70",
              )}
              style={bubbleFix.style}
              onMouseEnter={bubbleFix.onMouseEnter}
              onMouseLeave={bubbleFix.onMouseLeave}
            >
              {message.replyTo && (
                <div
                  className={cx(
                    "mb-1.5 truncate rounded-md border-l-2 px-2 py-1 text-xs",
                    isOwn
                      ? "border-white/50 bg-white/10 text-white/85"
                      : "border-accent bg-soft text-muted",
                  )}
                >
                  {message.replyTo.body}
                </div>
              )}

              <span className="whitespace-pre-wrap">
                {tokenizeMessageBody(
                  message.body,
                  (message.mentions || []).map((mention) => mention.fullName),
                ).map((node) => {
                  if (node.type === "mention") {
                    return (
                      <span
                        key={node.key}
                        className={cx(
                          "rounded px-0.5 font-semibold",
                          isOwn ? "bg-white/20" : "bg-accent/15 text-accent",
                        )}
                      >
                        {node.text}
                      </span>
                    );
                  }
                  if (node.type === "url") {
                    return (
                      <a
                        key={node.key}
                        href={normalizeUrl(node.text)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="underline underline-offset-2"
                      >
                        {node.text}
                      </a>
                    );
                  }
                  return <span key={node.key}>{node.text}</span>;
                })}
              </span>

              {!message.pending &&
                firstUrlIn(message.body) &&
                !message.replyTo && (
                  <LinkPreviewCard url={firstUrlIn(message.body)} isOwn={isOwn} />
                )}

              <span
                className={cx(
                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                  isOwn ? "text-white/75" : "text-muted",
                )}
              >
                {message.editedAt && <span className="italic">edited</span>}
                {message.pending ? (
                  <span>Sending…</span>
                ) : (
                  <span>{formatMessageTime(message.createdAt)}</span>
                )}
                {isOwn && !message.pending && (
                  <span className="flex items-center">
                    {message.status === "read" || message.status === "delivered" ? (
                      <DoneAll
                        fontSize="inherit"
                        className={message.status === "read" ? "text-[13px] text-sky-300" : "text-[13px]"}
                      />
                    ) : (
                      <Done fontSize="inherit" className="text-[13px]" />
                    )}
                  </span>
                )}
              </span>
            </button>
          )}

          {message.reactions?.length > 0 && (
            <div className={cx("mt-1 flex flex-wrap gap-1", isOwn ? "justify-end" : "justify-start")}>
              {message.reactions.map((reaction) => (
                <span
                  key={`${reaction.userId}-${reaction.emoji}`}
                  className="rounded-full border border-line bg-panel px-1.5 py-0.5 text-xs shadow-sm"
                >
                  {reaction.emoji}
                </span>
              ))}
            </div>
          )}

          {!isEditing && showActions && (
            <div
              className={cx(
                "mt-1 flex items-center gap-0.5 rounded-full border border-line bg-panel p-0.5 shadow-soft",
                isOwn ? "self-end" : "self-start",
              )}
            >
              <IconButton
                label="Reply to message"
                icon={<Reply fontSize="small" />}
                size="sm"
                onClick={() => onReply(message)}
              />
              <IconButton
                ref={emojiButtonRef}
                label="React to message"
                icon={<EmojiEmotions fontSize="small" />}
                size="sm"
                active={emojiOpen}
                onClick={onOpenEmoji}
              />
              {isOwn && !isAttachment && (
                <IconButton
                  label="Edit message"
                  icon={<Edit fontSize="small" />}
                  size="sm"
                  onClick={() => onEdit(message)}
                />
              )}
              {message.type !== "call" && (
                <IconButton
                  label="Forward message"
                  icon={<Forward fontSize="small" />}
                  size="sm"
                  onClick={() => onForward(message)}
                />
              )}
              {isGroup && (
                <IconButton
                  label={isPinned ? "Unpin message" : "Pin message"}
                  icon={<PushPin fontSize="small" />}
                  size="sm"
                  active={isPinned}
                  onClick={() => onTogglePin(message.id, isPinned)}
                />
              )}
              <IconButton
                label={isDeleting ? "Deleting message" : "Delete message"}
                icon={<Delete fontSize="small" />}
                size="sm"
                variant="danger"
                disabled={isDeleting}
                onClick={() => onDelete(message.id)}
              />
            </div>
          )}
        </div>
      </div>

      {emojiOpen &&
        emojiPickerPosition &&
        createPortal(
          <div
            ref={emojiPickerRef}
            data-emoji-picker
            className="fixed z-40 overflow-hidden rounded-xl border border-line bg-panel shadow-soft"
            style={emojiPickerPosition}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                onCloseInteraction();
                onReact(message.id, emojiData.emoji);
              }}
              width={emojiPickerPosition.width}
              height={emojiPickerHeight}
              searchDisabled
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
            />
          </div>,
          document.body,
        )}
    </div>
  );
};

export default MessageBubble;
