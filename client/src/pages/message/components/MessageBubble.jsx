import {
  Add,
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
import ReactionIcon from "../../../components/ui/reactions/ReactionIcons";
import ReactionPicker from "../../../components/ui/reactions/ReactionPicker";
import { EMOJI_TO_REACTION_TYPE, REACTION_TYPE_TO_EMOJI } from "../../../components/ui/reactions/reactionEmoji";
import { REACTION_TYPES } from "../../../components/ui/reactions/reactionTypes";
import { cx } from "../../../utility/cx";
import { toFileUrl } from "../../../utility/fileUrl";
import useButtonColorFix from "../../../utility/useButtonColorFix";
import useMountedTransition from "../../../utility/useMountedTransition";
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

// Compact, visually-secondary "replying to a Story/Note" card — the
// reaction/reply text itself stays the primary, readable content; this is
// just muted context underneath it (see server/src/routes/stories.routes.js
// and notes.routes.js, which attach `storyContext` to these messages).
// Never re-fetches the original Story/Note — everything it needs is a
// snapshot already denormalized onto the message, so it still renders
// correctly (as "expired") long after the original TTL-expires and is
// gone from the database.
const isStoryContextExpired = (expiresAt) => new Date(expiresAt).getTime() < Date.now();

function StoryContextCard({ context, isOwn }) {
  const expired = isStoryContextExpired(context.expiresAt);
  const snapshot = context.snapshot || {};
  const label = context.refType === "story" ? "Story" : "Note";

  return (
    <div
      className={cx(
        "mb-1.5 flex items-center gap-2 rounded-lg border px-2 py-1.5 opacity-70",
        isOwn ? "border-white/25 bg-white/10" : "border-line bg-soft",
      )}
    >
      {expired ? (
        <span className="text-[11px] italic">{label} expired</span>
      ) : (
        <>
          {snapshot.mediaUrl ? (
            <img
              src={snapshot.mediaUrl}
              alt=""
              className="size-8 shrink-0 rounded object-cover blur-[1.5px] brightness-90"
            />
          ) : (
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded text-[10px] font-semibold"
              style={{
                backgroundColor: snapshot.backgroundColor || "var(--soft)",
                color: snapshot.textColor || "inherit",
              }}
            >
              {label[0]}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[11px] italic">
            {snapshot.text ? `"${snapshot.text}"` : `Their ${label.toLowerCase()}`}
          </span>
        </>
      )}
    </div>
  );
}

const emojiPickerWidth = 280;
const emojiPickerHeight = 360;
const reactionBarWidth = 268;
const reactionBarHeight = 56;
const viewportGap = 8;
const actionsGap = 8;
const actionsHeightEstimate = 40;

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
  currentUserId,
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
  const messageColumnRef = useRef(null);
  const actionsRef = useRef(null);
  const [actionsPosition, setActionsPosition] = useState(null);

  // "bar" (the compact 5-reaction + Plus row) is always the first thing
  // that opens; Plus escalates to "full" (the full emoji-picker-react
  // library picker). Reset to "bar" whenever the whole reaction UI closes,
  // via the render-time "adjust state when a prop changes" pattern (not an
  // effect) so it's ready fresh the next time it opens.
  const [trackedEmojiOpen, setTrackedEmojiOpen] = useState(emojiOpen);
  const [reactionMode, setReactionMode] = useState("bar");
  if (emojiOpen !== trackedEmojiOpen) {
    setTrackedEmojiOpen(emojiOpen);
    if (!emojiOpen) setReactionMode("bar");
  }

  const showActions = Boolean((selected || emojiOpen) && !isEditing);

  const primaryFix = useButtonColorFix("primary");
  // The bubble itself is a <button> (clickable to reveal actions), so it's
  // subject to the same app-wide App.css button reset the rest of this
  // page already works around — see utility/useButtonColorFix.js.
  const ownBubbleFix = useButtonColorFix("primary");
  const otherBubbleFix = useButtonColorFix("outline");
  const bubbleFix = isOwn ? ownBubbleFix : otherBubbleFix;

  useLayoutEffect(() => {
    // Deliberately doesn't clear the position on close — the portal below
    // stays mounted for a bit longer (reactionUITransition.shouldRender)
    // to play its exit animation, and nulling this out immediately would
    // make it disappear at that same instant instead, since the portal is
    // gated on both. The stale position is harmless once actually
    // unmounted, and gets recomputed fresh the next time this opens.
    if (!emojiOpen || !emojiButtonRef.current) return undefined;

    const positionEmojiPicker = () => {
      const buttonRect = emojiButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) return;

      const isBar = reactionMode === "bar";
      const targetWidth = isBar ? reactionBarWidth : emojiPickerWidth;
      const targetHeight = isBar ? reactionBarHeight : emojiPickerHeight;

      const pickerWidth = Math.min(targetWidth, window.innerWidth - viewportGap * 2);
      const pickerHeight = Math.min(targetHeight, window.innerHeight - viewportGap * 2);

      const leftSpace = buttonRect.left - viewportGap;
      const rightSpace = window.innerWidth - buttonRect.right - viewportGap;
      const topSpace = buttonRect.top - viewportGap;
      const bottomSpace = window.innerHeight - buttonRect.bottom - viewportGap;

      const left =
        rightSpace >= pickerWidth || rightSpace >= leftSpace
          ? buttonRect.left
          : buttonRect.right - pickerWidth;
      const placeBelow = bottomSpace >= pickerHeight || bottomSpace >= topSpace;
      const top = placeBelow
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
        placement: placeBelow ? "bottom" : "top",
      });
    };

    positionEmojiPicker();
    window.addEventListener("resize", positionEmojiPicker);
    window.addEventListener("scroll", positionEmojiPicker, true);

    return () => {
      window.removeEventListener("resize", positionEmojiPicker);
      window.removeEventListener("scroll", positionEmojiPicker, true);
    };
  }, [emojiOpen, reactionMode]);

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

  // The action toolbar is portaled and positioned relative to this
  // message's own bounding box so opening/closing it never changes the
  // row's in-flow height (which would otherwise push neighboring messages
  // and the avatar around). Anchoring to the bubble's own side (right edge
  // for own messages, left edge for others — the side already near the
  // viewport edge) keeps it on-screen without needing to measure its width.
  useLayoutEffect(() => {
    // Same reasoning as the reaction-UI position effect above — don't
    // clear this on close, or the exit transition never gets a chance to
    // play since the portal is also gated on this being non-null.
    if (!showActions || !messageColumnRef.current) return undefined;

    const positionActions = () => {
      const rect = messageColumnRef.current?.getBoundingClientRect();
      if (!rect) return;

      const spaceAbove = rect.top - viewportGap;
      const top =
        spaceAbove >= actionsHeightEstimate + actionsGap
          ? rect.top - actionsHeightEstimate - actionsGap
          : rect.bottom + actionsGap;

      const clampedTop = Math.max(
        viewportGap,
        Math.min(top, window.innerHeight - actionsHeightEstimate - viewportGap),
      );

      setActionsPosition(
        isOwn
          ? { top: clampedTop, right: Math.max(viewportGap, window.innerWidth - rect.right) }
          : { top: clampedTop, left: Math.max(viewportGap, rect.left) },
      );
    };

    positionActions();
    window.addEventListener("resize", positionActions);
    window.addEventListener("scroll", positionActions, true);

    return () => {
      window.removeEventListener("resize", positionActions);
      window.removeEventListener("scroll", positionActions, true);
    };
  }, [showActions, isOwn]);

  useEffect(() => {
    if (!showActions) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onCloseInteraction();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showActions, onCloseInteraction]);

  const actionsTransition = useMountedTransition(showActions, 150);
  const reactionUITransition = useMountedTransition(emojiOpen, 150);

  const isAttachment = message.type === "attachment";
  const attachment = message.attachment || {};

  const myReactionEmoji = currentUserId
    ? message.reactions?.find((reaction) => String(reaction.userId) === String(currentUserId))
        ?.emoji
    : null;
  const currentReactionType = myReactionEmoji ? EMOJI_TO_REACTION_TYPE[myReactionEmoji] : null;

  const handleQuickReact = (type) => {
    onCloseInteraction();
    onReact(message.id, REACTION_TYPE_TO_EMOJI[type]);
  };

  // Aggregates the raw per-user emoji reactions into distinct emoji groups,
  // then mirrors ReactionSummary's own display contract exactly (up to
  // three overlapping icons + one total count) so the badge reads
  // identically wherever reactions show up in the app, and so it stays a
  // small, bounded pill that can never overflow horizontally.
  const reactionGroups = (message.reactions || []).reduce((groups, reaction) => {
    const existing = groups.find((group) => group.emoji === reaction.emoji);
    if (existing) existing.count += 1;
    else groups.push({ emoji: reaction.emoji, count: 1, type: EMOJI_TO_REACTION_TYPE[reaction.emoji] });
    return groups;
  }, []);
  const visibleReactionGroups = reactionGroups.slice(0, 3);
  const totalReactionCount = reactionGroups.reduce((sum, group) => sum + group.count, 0);

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

        <div ref={messageColumnRef} className="relative flex min-w-0 flex-col">
          {message.adminMessage && (
            <span className="mb-0.5 ml-1 inline-flex items-center gap-1 text-[11px] font-bold text-accent" data-testid="admin-message-label">
              <span className="rounded bg-accent px-1.5 py-px text-[10px] tracking-wide text-white uppercase">Admin</span>
              Kotha-Barta Administration
            </span>
          )}

          {showSenderName && !isOwn && !message.adminMessage && (
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

          {/* Wraps just the bubble/edit box (not the sender name, pinned
              label, etc.) so the reaction badge below can be positioned
              absolutely against this exact box — it overlaps the bubble's
              own bottom edge regardless of how tall the bubble is, instead
              of taking up flow space and pushing the avatar/next row down. */}
          <div className="relative">
          {isEditing ? (
            <div className="w-64 max-w-[70vw] rounded-2xl border border-line bg-panel p-2.5 shadow-soft">
              <input
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
                autoFocus
                aria-label="Edit message"
                className="font-message w-full rounded-md border border-line bg-paper px-2.5 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                "font-message min-w-0 rounded-2xl text-sm leading-relaxed shadow-sm transition-opacity",
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
                "font-message min-w-0 rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed wrap-anywhere shadow-sm transition-opacity",
                isOwn ? "text-white" : "text-ink",
                message.pending && "opacity-70",
              )}
              style={bubbleFix.style}
              onMouseEnter={bubbleFix.onMouseEnter}
              onMouseLeave={bubbleFix.onMouseLeave}
            >
              {message.storyContext && (
                <StoryContextCard context={message.storyContext} isOwn={isOwn} />
              )}

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

          {reactionGroups.length > 0 && (
            // Absolutely positioned, overlapping the bubble's bottom edge
            // (~half in, half out — the Facebook-style treatment): never
            // part of document flow, so it can never move the avatar or
            // push the row height, and it doesn't reserve space that would
            // shove the next message down. Bounded to 3 icons + a count,
            // exactly like ReactionSummary, so it can't overflow
            // horizontally either.
            <div
              className={cx(
                "absolute -bottom-2.5 z-10 flex items-center gap-1 rounded-full",
                "border border-line bg-panel px-1.5 py-0.5 shadow-soft",
                isOwn ? "right-2" : "left-2",
              )}
              aria-label={`${totalReactionCount} reaction${totalReactionCount === 1 ? "" : "s"}`}
            >
              <span className="flex items-center -space-x-1">
                {visibleReactionGroups.map((group) => (
                  <span
                    key={group.emoji}
                    className="flex size-4 items-center justify-center rounded-full ring-2 ring-panel"
                  >
                    {group.type ? (
                      <ReactionIcon type={group.type} className="size-4" />
                    ) : (
                      <span className="text-[10px] leading-none">{group.emoji}</span>
                    )}
                  </span>
                ))}
              </span>
              <span className="text-[10px] font-semibold text-muted">{totalReactionCount}</span>
            </div>
          )}
          </div>
        </div>
      </div>

      {actionsTransition.shouldRender &&
        actionsPosition &&
        createPortal(
          <div
            ref={actionsRef}
            data-message-actions
            style={actionsPosition}
            onMouseDown={(event) => event.stopPropagation()}
            className={cx(
              "fixed z-40 flex items-center gap-0.5 rounded-full border border-line bg-panel p-0.5 shadow-soft",
              "transition motion-safe:duration-150 ease-out",
              actionsTransition.visible
                ? "scale-100 opacity-100"
                : cx("scale-95 opacity-0", isOwn ? "origin-bottom-right" : "origin-bottom-left"),
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
          </div>,
          document.body,
        )}

      {reactionUITransition.shouldRender &&
        emojiPickerPosition &&
        createPortal(
          <div
            ref={emojiPickerRef}
            data-emoji-picker
            className={cx(
              "fixed z-40 transition motion-safe:duration-150 ease-out",
              reactionMode === "full" &&
                "overflow-hidden rounded-xl border border-line bg-panel shadow-soft",
              reactionUITransition.visible ? "scale-100 opacity-100" : "scale-90 opacity-0",
            )}
            style={
              reactionMode === "full"
                ? {
                    top: emojiPickerPosition.top,
                    left: emojiPickerPosition.left,
                    width: emojiPickerPosition.width,
                    height: emojiPickerPosition.height,
                  }
                : { top: emojiPickerPosition.top, left: emojiPickerPosition.left }
            }
            onMouseDown={(event) => event.stopPropagation()}
          >
            {reactionMode === "bar" ? (
              <ReactionPicker
                selected={currentReactionType}
                onSelect={handleQuickReact}
                types={REACTION_TYPES}
                placement={emojiPickerPosition.placement}
                trailing={
                  <button
                    type="button"
                    aria-label="More reactions"
                    title="More reactions"
                    onClick={() => setReactionMode("full")}
                    className={cx(
                      "flex size-9 items-center justify-center rounded-full p-1.5 text-muted",
                      "transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-125 hover:text-ink",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    )}
                  >
                    <Add className="size-full" />
                  </button>
                }
              />
            ) : (
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
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default MessageBubble;
