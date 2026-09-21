import { ForumOutlined } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { cx } from "../../utility/cx";
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

const confirmCopy = {
  conversation: {
    title: "Delete this conversation?",
    description: "This removes the conversation and its messages for you. This can't be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  },
  message: {
    title: "Delete this message?",
    description: "This removes the message for everyone in the conversation. This can't be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  },
};

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
    setSendError,
    sending,
    selectedMessageId,
    emojiMessageId,
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
  const call = useVoiceCall({ selected, conversationId, thread, conversations });

  useMessageRealtime({
    conversationId,
    selected,
    conversations,
    thread,
    setIsTyping,
    remoteTypingTimeoutRef: state.remoteTypingTimeoutRef,
    prepareForIncomingMessage: scroll.prepareForIncomingMessage,
  });

  const [pendingConfirm, setPendingConfirm] = useState(null); // { type: "conversation"|"message", id }
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConversation = (id) => navigate(`/app/messages/${id}`);
  const closeConfirm = () => {
    if (!confirmLoading) setPendingConfirm(null);
  };

  const runPendingConfirm = async () => {
    if (!pendingConfirm) return;
    setConfirmLoading(true);
    try {
      if (pendingConfirm.type === "conversation") {
        await actions.deleteConversation(pendingConfirm.id);
        if (pendingConfirm.id === conversationId) navigate("/app/messages");
      } else {
        const error = await deletion.handleDelete(pendingConfirm.id);
        if (error) setSendError(error);
      }
    } catch (error) {
      setSendError(
        error.response?.data?.error?.message || "Something went wrong.",
      );
    } finally {
      setConfirmLoading(false);
      setPendingConfirm(null);
    }
  };

  const dialogCopy = pendingConfirm ? confirmCopy[pendingConfirm.type] : null;
  const showingThread = Boolean(conversationId);

  return (
    <div className="flex h-[calc(100dvh-195px)] min-h-105 w-full flex-col md:h-[calc(100dvh-200px)]">
      <div className={cx("mb-3 shrink-0", showingThread && "hidden")}>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          Inbox
        </span>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
          Messages
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-panel shadow-soft">
        <div
          className={cx(
            "w-full shrink-0 flex-col overflow-y-auto md:flex md:w-80 md:border-r md:border-line lg:w-96",
            showingThread ? "hidden md:flex" : "flex",
          )}
        >
          <ConversationList
            conversations={conversations}
            userId={user.id}
            activeId={conversationId}
            onOpenConversation={openConversation}
            onRequestDelete={(id) => setPendingConfirm({ type: "conversation", id })}
          />
        </div>

        <div
          className={cx(
            "min-w-0 flex-1 flex-col",
            showingThread ? "flex" : "hidden md:flex",
          )}
        >
          {showingThread ? (
            <>
              <ChatHeader
                selected={selected}
                loading={conversations.loading}
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
                callDuration={call.callDuration}
                remoteAudio={call.remoteAudio}
                acceptCall={call.acceptCall}
                finishCall={call.finishCall}
              />
              <MessageThread
                messages={thread.data}
                loading={thread.loading}
                otherUser={selected?.user}
                threadRef={scroll.messageThreadRef}
                userId={user.id}
                editingMessage={edit.editingMessage}
                deletingMessage={deletion.deletingMessage}
                editBody={edit.editBody}
                editLoading={edit.editLoading}
                setEditBody={edit.setEditBody}
                onEdit={edit.handleEdit}
                onDelete={(id) => setPendingConfirm({ type: "message", id })}
                onCancelEdit={edit.cancelEdit}
                onSaveEdit={edit.saveEdit}
                onReply={actions.replyToMessage}
                onReact={actions.reactToMessage}
                selectedMessageId={selectedMessageId}
                emojiMessageId={emojiMessageId}
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
            </>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 px-6 text-center md:flex">
              <div className="flex size-14 items-center justify-center rounded-full bg-soft text-muted">
                <ForumOutlined fontSize="medium" />
              </div>
              <p className="font-display text-lg font-semibold text-ink">
                Select a conversation
              </p>
              <p className="max-w-xs text-sm text-muted">
                Choose someone from the list to see your conversation.
              </p>
            </div>
          )}
        </div>
      </div>

      {sendError && (
        <div className="mt-3 shrink-0 rounded-md bg-danger-soft px-4 py-2.5 text-xs font-medium text-danger">
          {sendError}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={dialogCopy?.title}
        description={dialogCopy?.description}
        confirmLabel={dialogCopy?.confirmLabel}
        variant={dialogCopy?.variant}
        loading={confirmLoading}
        onConfirm={runPendingConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default Message;
