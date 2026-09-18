import { Delete, MoreVert, VolumeOff, VolumeUp } from "@mui/icons-material";
import { useEffect, useState } from "react";

import {
  isConversationMuted,
  setConversationMuted,
} from "../../../utility/conversationPreferences";
import { colorFor, formatTime, ResourceState } from "../../../utility/helpers";

const ConversationList = ({
  conversations,
  onOpenConversation,
  onDeleteConversation,
}) => {
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest(".conversation-menu-wrapper")) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const toggleMute = (conversationId) => {
    setConversationMuted(conversationId, !isConversationMuted(conversationId));
    setOpenMenu(null);
  };

  return (
    <ResourceState
      loading={conversations.loading}
      error={conversations.error}
      empty={
        !conversations.data?.length
          ? "No conversations yet. Message a friend to start chatting."
          : ""
      }
    >
      <div className="message-list">
        {conversations?.data?.map((conversation) => (
          <div
            className={`conversation ${conversation?.unreadCount ? "unread" : ""}`}
            key={conversation.id}
          >
            <button
              type="button"
              className="conversation-main"
              onClick={() => onOpenConversation(conversation.id)}
            >
              <div
                className={`avatar avatar-${colorFor(conversation.user.id)}`}
              >
                {conversation.user.initials}

                <i />
              </div>

              <div>
                <strong>{conversation.user.fullName}</strong>

                <span>
                  {conversation?.lastMessage?.slice(0, 30) || "No messages yet"}
                </span>
              </div>

              <time>{formatTime(conversation.lastMessageAt)}</time>

              {conversation.unreadCount > 0 && (
                <b
                  title={`${conversation.user.fullName} sent ${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? "" : "s"}`}
                >
                  {conversation.unreadCount}
                </b>
              )}
            </button>

            <div className="conversation-menu-wrapper">
              <button
                type="button"
                className="conversation-menu-button"
                aria-label={`Conversation options for ${conversation.user.fullName}`}
                title="Conversation options"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === conversation.id ? null : conversation.id,
                  )
                }
              >
                <MoreVert fontSize="small" />
              </button>

              {openMenu === conversation.id && (
                <div className="conversation-menu">
                  <button
                    type="button"
                    onClick={() => toggleMute(conversation.id)}
                  >
                    {isConversationMuted(conversation.id) ? (
                      <VolumeUp fontSize="small" />
                    ) : (
                      <VolumeOff fontSize="small" />
                    )}
                    {isConversationMuted(conversation.id) ? "Unmute" : "Mute"}
                  </button>
                  <button
                    type="button"
                    className="delete-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onDeleteConversation(conversation.id);
                    }}
                  >
                    <Delete fontSize="small" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ResourceState>
  );
};

export default ConversationList;
