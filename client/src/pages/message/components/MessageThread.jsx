import MessageBubble from "./MessageBubble";

const MessageThread = ({
  messages,
  threadRef,
  userId,
  editingMessage,
  deletingMessage,
  openMenu,
  editBody,
  editLoading,
  setEditBody,
  onToggleMenu,
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
}) => (
  <div className="message-thread" ref={threadRef}>
    {messages?.map((message) => (
      <MessageBubble
        key={message.id}
        message={message}
        isOwn={String(message.senderId) === String(userId)}
        isEditing={editingMessage === message.id}
        isDeleting={deletingMessage === message.id}
        openMenu={openMenu}
        editBody={editBody}
        editLoading={editLoading}
        setEditBody={setEditBody}
        onToggleMenu={onToggleMenu}
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
    ))}
  </div>
);

export default MessageThread;
