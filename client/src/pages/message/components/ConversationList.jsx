import {
  Avatar,
  colorFor,
  formatTime,
  ResourceState,
} from "../../../utility/helpers";

const ConversationList = ({
  conversations,
  onOpenConversation,
}) => {
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
          <button
            type="button"
            className={`conversation ${
              conversation?.unreadCount ? "unread" : ""
            }`}
            key={conversation.id}
            onClick={() =>
              onOpenConversation(conversation.id)
            }
          >
            <div
              className={`avatar avatar-${colorFor(
                conversation.user.id,
              )}`}
            >
              {conversation.user.initials}

              <i />
            </div>

            <div>
              <strong>
                {conversation.user.fullName}
              </strong>

              <span>
                {conversation?.lastMessage?.slice(0, 30) ||
                  "No messages yet"}
              </span>
            </div>

            <time>
              {formatTime(conversation.lastMessageAt)}
            </time>

            {conversation.unreadCount > 0 && (
              <b
                title={`${conversation.user.fullName} sent ${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? "" : "s"}`}
              >
                {conversation.unreadCount}
              </b>
            )}
          </button>
        ))}
      </div>
    </ResourceState>
  );
};

export default ConversationList;