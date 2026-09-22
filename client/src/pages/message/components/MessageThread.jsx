import { ForumOutlined, KeyboardArrowDown } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import { cx } from "../../../utility/cx";
import useMountedTransition from "../../../utility/useMountedTransition";
import CallRecordRow from "./CallRecordRow";
import MessageBubble from "./MessageBubble";

const GROUP_GAP_MS = 5 * 60 * 1000;

const sameDay = (a, b) => {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
};

const formatDateSeparator = (date) => {
  const value = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(value, today)) return "Today";
  if (sameDay(value, yesterday)) return "Yesterday";

  return value.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: value.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

function ThreadSkeletonRow({ own }) {
  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <div
        className={`h-9 animate-pulse rounded-2xl bg-soft motion-reduce:animate-none ${
          own ? "w-40" : "w-52"
        }`}
      />
    </div>
  );
}

function MessageThreadSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading messages" className="flex flex-1 flex-col justify-end gap-2.5 p-4">
      <ThreadSkeletonRow />
      <ThreadSkeletonRow own />
      <ThreadSkeletonRow own />
      <ThreadSkeletonRow />
    </div>
  );
}

function MessageThreadEmpty({ name }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-soft text-muted">
        <ForumOutlined fontSize="small" />
      </div>
      <p className="font-display text-base font-semibold text-ink">
        {name ? `Say hello to ${name}` : "No messages yet"}
      </p>
      <p className="max-w-xs text-sm text-muted">
        Your conversation will show up here once you send a message.
      </p>
    </div>
  );
}

const MessageThread = ({
  messages,
  loading,
  otherUser,
  threadRef,
  userId,
  editingMessage,
  deletingMessage,
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
  pinnedMessageIds,
  firstUnreadMessageId,
  onJumpToUnread,
  highlightedMessageId,
  selectedMessageId,
  emojiMessageId,
  onSelectMessage,
  onOpenEmoji,
  onCloseInteraction,
  isGroup,
}) => {
  const unreadMarkerRef = useRef(null);
  const [trackedUnreadId, setTrackedUnreadId] = useState(firstUnreadMessageId);
  const [unreadSeen, setUnreadSeen] = useState(false);

  // The marker moved to a different message (a fresh unread batch) —
  // reset during render (the standard React pattern for "adjust state
  // when a prop changes") so the button can reappear for the new one.
  if (firstUnreadMessageId !== trackedUnreadId) {
    setTrackedUnreadId(firstUnreadMessageId);
    setUnreadSeen(false);
  }

  // Tracks whether the unread divider has scrolled into view at least once
  // — "seen", not "currently visible", so the button stays gone once the
  // user has scrolled past it rather than flickering back in.
  useEffect(() => {
    if (!firstUnreadMessageId || !unreadMarkerRef.current || !threadRef?.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setUnreadSeen(true);
      },
      { root: threadRef.current, threshold: 0.4 },
    );
    observer.observe(unreadMarkerRef.current);
    return () => observer.disconnect();
  }, [firstUnreadMessageId, threadRef]);

  const showJumpToUnread = Boolean(firstUnreadMessageId) && !unreadSeen;
  const jumpTransition = useMountedTransition(showJumpToUnread, 150);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto" ref={threadRef}>
        <MessageThreadSkeleton />
      </div>
    );
  }

  if (!messages?.length) {
    return (
      <div className="flex  flex-1 flex-col overflow-y-auto" ref={threadRef}>
        <MessageThreadEmpty name={otherUser?.fullName} />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        className="flex flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-6 lg:px-10"
        ref={threadRef}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end gap-0.5">
          {messages.map((message, index) => {
          const previous = messages[index - 1];
          const next = messages[index + 1];
          const isOwn = String(message.senderId) === String(userId);

          const showDateSeparator =
            !previous || !sameDay(previous.createdAt, message.createdAt);

          const groupedWithPrevious =
            !showDateSeparator &&
            previous &&
            String(previous.senderId) === String(message.senderId) &&
            Math.abs(new Date(message.createdAt) - new Date(previous.createdAt)) < GROUP_GAP_MS;

          const groupedWithNext =
            next &&
            sameDay(next.createdAt, message.createdAt) &&
            String(next.senderId) === String(message.senderId) &&
            Math.abs(new Date(next.createdAt) - new Date(message.createdAt)) < GROUP_GAP_MS;

          return (
            <div key={message.id} id={`message-${message.id}`} data-message-row>
              {showDateSeparator && (
                <div className="my-3 flex items-center justify-center first:mt-0">
                  <span className="rounded-full bg-soft px-3 py-1 text-[11px] font-semibold text-muted">
                    {formatDateSeparator(message.createdAt)}
                  </span>
                </div>
              )}
              {firstUnreadMessageId === message.id && (
                <div ref={unreadMarkerRef} className="my-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-danger/40" />
                  <span className="rounded-full bg-danger-soft px-3 py-1 text-[11px] font-semibold text-danger">
                    Unread messages
                  </span>
                  <span className="h-px flex-1 bg-danger/40" />
                </div>
              )}
              <div
                className={
                  highlightedMessageId === message.id
                    ? "rounded-xl bg-accent/15 transition-colors duration-1000"
                    : "rounded-xl transition-colors duration-1000"
                }
              >
                {message.type === "call" ? (
                  <CallRecordRow message={message} isOwn={isOwn} groupStart={!groupedWithPrevious} />
                ) : (
                  <MessageBubble
                    message={message}
                    isOwn={isOwn}
                    currentUserId={userId}
                    otherUser={isGroup ? message.sender : otherUser}
                    showSenderName={isGroup && !groupedWithPrevious}
                    groupStart={!groupedWithPrevious}
                    groupEnd={!groupedWithNext}
                    isEditing={editingMessage === message.id}
                    isDeleting={deletingMessage === message.id}
                    editBody={editBody}
                    editLoading={editLoading}
                    setEditBody={setEditBody}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCancelEdit={onCancelEdit}
                    onSaveEdit={onSaveEdit}
                    onReply={onReply}
                    onReact={onReact}
                    onForward={onForward}
                    onTogglePin={onTogglePin}
                    isGroup={isGroup}
                    isPinned={pinnedMessageIds?.has(message.id)}
                    selected={selectedMessageId === message.id}
                    emojiOpen={emojiMessageId === message.id}
                    onSelectMessage={onSelectMessage}
                    onOpenEmoji={() => onOpenEmoji(message.id)}
                    onCloseInteraction={onCloseInteraction}
                  />
                )}
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {jumpTransition.shouldRender && (
        <button
          type="button"
          onClick={onJumpToUnread}
          aria-label="Jump to first unread message"
          title="Jump to first unread message"
          className={cx(
            "absolute right-4 bottom-4 flex size-10 items-center justify-center rounded-full",
            "bg-accent text-white shadow-soft transition motion-safe:duration-150 ease-out hover:bg-accent-deep",
            jumpTransition.visible ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        >
          <KeyboardArrowDown fontSize="small" />
        </button>
      )}
    </div>
  );
};

export default MessageThread;
