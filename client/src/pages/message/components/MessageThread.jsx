import { ForumOutlined } from "@mui/icons-material";

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
  selectedMessageId,
  emojiMessageId,
  onSelectMessage,
  onOpenEmoji,
  onCloseInteraction,
}) => {
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
    <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-6 lg:px-10" ref={threadRef}>
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
            <div key={message.id} data-message-row>
              {showDateSeparator && (
                <div className="my-3 flex items-center justify-center first:mt-0">
                  <span className="rounded-full bg-soft px-3 py-1 text-[11px] font-semibold text-muted">
                    {formatDateSeparator(message.createdAt)}
                  </span>
                </div>
              )}
              {message.type === "call" ? (
                <CallRecordRow message={message} isOwn={isOwn} groupStart={!groupedWithPrevious} />
              ) : (
                <MessageBubble
                  message={message}
                  isOwn={isOwn}
                  otherUser={otherUser}
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
                  selected={selectedMessageId === message.id}
                  emojiOpen={emojiMessageId === message.id}
                  onSelectMessage={onSelectMessage}
                  onOpenEmoji={() => onOpenEmoji(message.id)}
                  onCloseInteraction={onCloseInteraction}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MessageThread;
