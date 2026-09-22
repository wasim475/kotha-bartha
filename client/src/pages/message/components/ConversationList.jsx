import {
  Add,
  Delete,
  ErrorOutlined,
  ForumOutlined,
  MoreHoriz,
  VolumeOff,
  VolumeUp,
} from "@mui/icons-material";
import { useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import Menu from "../../../components/ui/Menu";
import { cx } from "../../../utility/cx";
import {
  isConversationMuted,
  setConversationMuted,
} from "../../../utility/conversationPreferences";
import { formatTime } from "../../../utility/helpers";
import useButtonColorFix from "../../../utility/useButtonColorFix";

function ConversationRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 p-3 motion-reduce:animate-none">
      <div className="size-11 shrink-0 rounded-full bg-soft" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded bg-soft" />
        <div className="h-2.5 w-36 rounded bg-soft" />
      </div>
      <div className="h-2.5 w-8 shrink-0 rounded bg-soft" />
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading conversations" className="divide-y divide-line">
      <ConversationRowSkeleton />
      <ConversationRowSkeleton />
      <ConversationRowSkeleton />
      <ConversationRowSkeleton />
      <ConversationRowSkeleton />
    </div>
  );
}

function ConversationListEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-soft text-muted">
        <ForumOutlined fontSize="small" />
      </div>
      <p className="font-display text-lg font-semibold text-ink">No conversations yet</p>
      <p className="max-w-xs text-sm text-muted">
        Message a friend from their profile or the Friends tab to start chatting.
      </p>
    </div>
  );
}

function ConversationListError({ message, onRetry }) {
  const outlineFix = useButtonColorFix("outline");
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <ErrorOutlined fontSize="small" />
      </div>
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          style={outlineFix.style}
          onMouseEnter={outlineFix.onMouseEnter}
          onMouseLeave={outlineFix.onMouseLeave}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

const ConversationList = ({
  conversations,
  userId,
  activeId,
  onOpenConversation,
  onRequestDelete,
  onNewConversation,
}) => {
  // Mute state lives in localStorage (see utility/conversationPreferences),
  // not React state; this counter just forces a re-read/re-render after a
  // toggle so the mute icon and menu label update immediately.
  const [, forceMuteRefresh] = useState(0);

  const header = (
    <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-line bg-panel px-3.5 py-2.5">
      <p className="font-display text-sm font-semibold text-ink">Chats</p>
      <IconButton
        label="New conversation"
        icon={<Add fontSize="small" />}
        size="sm"
        onClick={onNewConversation}
      />
    </div>
  );

  if (conversations.loading) {
    return (
      <>
        {header}
        <ConversationListSkeleton />
      </>
    );
  }
  if (conversations.error) {
    return (
      <>
        {header}
        <ConversationListError message={conversations.error} onRetry={conversations.reload} />
      </>
    );
  }
  if (!conversations.data?.length) {
    return (
      <>
        {header}
        <ConversationListEmpty />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="divide-y divide-line">
      {conversations.data.map((conversation) => {
        const active = conversation.id === activeId;
        const unread = conversation.unreadCount > 0;
        const muted = isConversationMuted(userId, conversation.id);
        const display = conversation.isGroup
          ? {
              fullName: conversation.group.name,
              avatar: conversation.group.avatar,
              initials: conversation.group.name?.slice(0, 2),
              isOnline: false,
            }
          : conversation.user;

        return (
          <div
            key={conversation.id}
            className={cx(
              "group relative flex items-center gap-3 px-3 py-3 transition-colors motion-safe:duration-150 sm:px-3.5",
              active ? "bg-soft" : "hover:bg-soft/60",
            )}
          >
            {active && (
              <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent" aria-hidden="true" />
            )}

            <button
              type="button"
              onClick={() => onOpenConversation(conversation.id)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <div className="relative shrink-0">
                <Avatar person={display} size="md" />
                {display.isOnline && (
                  <span
                    className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-panel bg-emerald-500"
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p
                    className={cx(
                      "truncate text-sm text-ink",
                      unread ? "font-bold" : "font-semibold",
                    )}
                  >
                    {display.fullName}
                  </p>
                  {muted && <VolumeOff fontSize="inherit" className="shrink-0 text-[13px] text-muted" />}
                </div>
                <p
                  className={cx(
                    "truncate text-xs",
                    unread ? "font-semibold text-ink" : "text-muted",
                  )}
                >
                  {conversation.lastMessage?.slice(0, 60) || "No messages yet"}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <time className="text-[11px] text-muted">
                  {formatTime(conversation.lastMessageAt)}
                </time>
                {unread && (
                  <Badge variant="accent">
                    {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                  </Badge>
                )}
              </div>
            </button>

            <Menu
              align="end"
              trigger={
                <IconButton
                  label={`Conversation options for ${display.fullName}`}
                  icon={<MoreHoriz fontSize="small" />}
                  size="sm"
                  className="md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                />
              }
              items={[
                {
                  key: "mute",
                  label: muted ? "Unmute" : "Mute",
                  icon: muted ? <VolumeUp fontSize="small" /> : <VolumeOff fontSize="small" />,
                  onClick: () => {
                    setConversationMuted(userId, conversation.id, !muted);
                    forceMuteRefresh((count) => count + 1);
                  },
                },
                {
                  key: "delete",
                  label: "Delete",
                  icon: <Delete fontSize="small" />,
                  danger: true,
                  onClick: () => onRequestDelete(conversation.id),
                },
              ]}
            />
          </div>
        );
      })}
      </div>
    </>
  );
};

export default ConversationList;
