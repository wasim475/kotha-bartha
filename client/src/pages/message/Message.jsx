import { Add } from "@mui/icons-material";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ResourceState } from "../../utility/helpers";
import useDeleteMessage from "./hooks/useDeleteMessage";
import useEditMessage from "./hooks/useEditMessage";
import useMessageActions from "./hooks/useMessageActions";
import useMessageRealtime from "./hooks/useMessageRealtime";
import useMessageResources from "./hooks/useMessageResources";
import useMessageScroll from "./hooks/useMessageScroll";
import useMessageState from "./hooks/useMessageState";
import useVoiceCall from "./hooks/useVoiceCall";

import ChatHeader from "./components/ChatHeader";
import ConversationList from "./components/ConversationList";
import MessageComposer from "./components/MessageComposer";
import MessageThread from "./components/MessageThread";
import VoiceCall from "./components/VoicCall";

const Message = ({ user }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { conversations, thread, selected } =
    useMessageResources(conversationId);
  const state = useMessageState({ conversationId, selected });
  const {
    body,
    setBody,
    replyingTo,
    setReplyingTo,
    isTyping,
    setIsTyping,
    sendError,
    sending,
    selectedMessageId,
    emojiMessageId,
    openMenu,
    closeMessageInteractions,
    notifyTyping,
  } = state;

  const scroll = useMessageScroll({ conversationId, thread });
  const actions = useMessageActions({
    user,
    conversationId,
    selected,
    thread,
    conversations,
    state,
    scrollToBottom: scroll.scrollToBottom,
  });
  const edit = useEditMessage({
    conversationId,
    thread,
    conversations,
    preserveScrollPosition: scroll.preserveScrollPosition,
  });
  const deletion = useDeleteMessage({
    conversationId,
    thread,
    conversations,
    preserveScrollPosition: scroll.preserveScrollPosition,
  });
  const call = useVoiceCall({ selected, conversationId });

  useMessageRealtime({
    conversationId,
    selected,
    conversations,
    thread,
    setIsTyping,
    remoteTypingTimeoutRef: state.remoteTypingTimeoutRef,
    prepareForIncomingMessage: scroll.prepareForIncomingMessage,
  });

  useEffect(() => {
    const timer = setInterval(conversations.reload, 5000);
    return () => clearInterval(timer);
  }, [conversations.reload]);

  return (
    <div
      className={
        conversationId ? "message-page message-page-chat" : "message-page"
      }
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">Messages</span>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Choose a conversation"
        >
          <Add />
        </button>
      </div>

      {conversationId ? (
        <div className="chat-container">
          <ResourceState
            loading={conversations.loading || thread.loading}
            error={conversations.error || thread.error}
          >
            <section className="chat-panel">
              <ChatHeader
                selected={selected}
                onBack={() => navigate("/app/messages")}
                callState={call.callState}
                startCall={call.startCall}
                finishCall={call.finishCall}
                isTyping={isTyping}
              />
              <VoiceCall
                selected={selected}
                callState={call.callState}
                incomingCall={call.incomingCall}
                remoteAudio={call.remoteAudio}
                acceptCall={call.acceptCall}
                finishCall={call.finishCall}
              />
              <MessageThread
                messages={thread.data}
                threadRef={scroll.messageThreadRef}
                userId={user.id}
                editingMessage={edit.editingMessage}
                deletingMessage={deletion.deletingMessage}
                openMenu={openMenu}
                editBody={edit.editBody}
                editLoading={edit.editLoading}
                setEditBody={edit.setEditBody}
                selectedMessageId={selectedMessageId}
                emojiMessageId={emojiMessageId}
                onToggleMenu={actions.toggleMessageMenu}
                onEdit={edit.handleEdit}
                onDelete={deletion.handleDelete}
                onCancelEdit={edit.cancelEdit}
                onSaveEdit={edit.saveEdit}
                onReply={actions.replyToMessage}
                onReact={actions.reactToMessage}
                onSelectMessage={actions.selectMessage}
                onOpenEmoji={actions.openEmojiPicker}
                onCloseInteraction={closeMessageInteractions}
              />
              <MessageComposer
                body={body}
                setBody={setBody}
                sending={sending}
                onSend={actions.sendMessage}
                onTyping={notifyTyping}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />
              {sendError && (
                <div className="form-error message-error">{sendError}</div>
              )}
            </section>
          </ResourceState>
        </div>
      ) : (
        <ConversationList
          conversations={conversations}
          userId={user.id}
          onOpenConversation={(id) => navigate(`/app/messages/${id}`)}
          onDeleteConversation={actions.deleteConversation}
        />
      )}
    </div>
  );
};

export default Message;
