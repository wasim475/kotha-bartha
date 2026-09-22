import { ForumOutlined } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { cx } from "../../utility/cx";
import useDeleteMessage from "./hooks/useDeleteMessage";
import useE2EDecryption from "./hooks/useE2EDecryption";
import useEditMessage from "./hooks/useEditMessage";
import useMessageActions from "./hooks/useMessageActions";
import useMessageRealtime from "./hooks/useMessageRealtime";
import useMessageResources from "./hooks/useMessageResources";
import useMessageScroll from "./hooks/useMessageScroll";
import useMessageSearch from "./hooks/useMessageSearch";
import useMessageState from "./hooks/useMessageState";
import useVoiceCall from "./hooks/useVoiceCall";

import ChatHeader from "./components/ChatHeader";
import ConversationList from "./components/ConversationList";
import DeleteMessageDialog from "./components/DeleteMessageDialog";
import ForwardMessageDialog from "./components/ForwardMessageDialog";
import GroupInfoPanel from "./components/GroupInfoPanel";
import MessageComposer from "./components/MessageComposer";
import MessageThread from "./components/MessageThread";
import NewConversationDialog from "./components/NewConversationDialog";
import VoiceCall from "./components/VoicCall";

const confirmCopy = {
  conversation: {
    title: "Delete this conversation?",
    description: "This removes the conversation and its messages for you. This can't be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  },
};

const Message = ({ user }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const {
    conversations,
    archived,
    archiveView,
    setArchiveView,
    thread,
    selected,
    groupDetail,
  } = useMessageResources(conversationId);
  const isGroup = Boolean(selected?.isGroup);
  useE2EDecryption({ conversationId, selected, userId: user.id, thread });
  const search = useMessageSearch({ conversationId, selected, thread });
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const state = useMessageState({ conversationId, selected });
  const {
    body,
    setBody,
    mentionIds,
    setMentionIds,
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
    archived,
    state,
    scrollToBottom: scroll.scrollToBottom,
  });
  const edit = useEditMessage({
    conversationId,
    thread,
    conversations,
    selected,
    userId: user.id,
    preserveScrollPosition: scroll.preserveScrollPosition,
  });
  const deletion = useDeleteMessage({
    conversationId,
    thread,
    conversations,
    preserveScrollPosition: scroll.preserveScrollPosition,
  });
  const call = useVoiceCall({ selected, conversationId, thread, conversations });

  const jumpToMessage = (messageId) => {
    if (!messageId) return;
    const row = document.getElementById(`message-${messageId}`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedMessageId(messageId);
    setTimeout(() => setHighlightedMessageId((current) => (current === messageId ? null : current)), 2000);
  };

  useMessageRealtime({
    conversationId,
    selected,
    conversations,
    thread,
    groupDetail,
    setIsTyping,
    remoteTypingTimeoutRef: state.remoteTypingTimeoutRef,
    prepareForIncomingMessage: scroll.prepareForIncomingMessage,
  });

  const [pendingConfirm, setPendingConfirm] = useState(null); // { type: "conversation", id }
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [deleteDialogMessageId, setDeleteDialogMessageId] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);

  const openConversation = (id) => navigate(`/app/messages/${id}`);
  const closeConfirm = () => {
    if (!confirmLoading) setPendingConfirm(null);
  };

  const runPendingConfirm = async () => {
    if (!pendingConfirm) return;
    setConfirmLoading(true);
    try {
      await actions.deleteConversation(pendingConfirm.id);
      if (pendingConfirm.id === conversationId) navigate("/app/messages");
    } catch (error) {
      setSendError(
        error.response?.data?.error?.message || "Something went wrong.",
      );
    } finally {
      setConfirmLoading(false);
      setPendingConfirm(null);
    }
  };

  const [canDeleteForEveryone, setCanDeleteForEveryone] = useState(false);
  const openDeleteDialog = (id) => {
    const message = thread.data?.find((row) => row.id === id);
    const eligible =
      message &&
      String(message.senderId) === String(user.id) &&
      message.unsendExpiresAt &&
      Date.now() < new Date(message.unsendExpiresAt).getTime();
    setDeleteDialogMessageId(id);
    setCanDeleteForEveryone(Boolean(eligible));
  };

  const runDeleteForMe = async () => {
    const error = await deletion.deleteForMe(deleteDialogMessageId);
    if (error) setSendError(error);
    setDeleteDialogMessageId(null);
  };
  const runDeleteForEveryone = async () => {
    const error = await deletion.deleteForEveryone(deleteDialogMessageId);
    if (error) setSendError(error);
    setDeleteDialogMessageId(null);
  };

  const submitForward = async (message, targetConversationIds) => {
    if (message.encrypted) {
      // The server never saw this message's plaintext, so it can't copy
      // it for us — send it fresh (re-encrypted per target) instead.
      for (const targetId of targetConversationIds) {
        await actions.forwardPlaintext(targetId, message.body);
      }
      return;
    }
    await actions.forwardMessage(message.id, targetConversationIds);
  };

  const pinnedMessageIds = new Set(
    (groupDetail?.data?.pinnedMessages || []).map((pin) => pin.messageId),
  );

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
            conversations={archiveView ? archived : conversations}
            userId={user.id}
            activeId={conversationId}
            onOpenConversation={openConversation}
            onRequestDelete={(id) => setPendingConfirm({ type: "conversation", id })}
            onNewConversation={() => setNewConversationOpen(true)}
            archiveView={archiveView}
            onToggleArchiveView={() => setArchiveView((current) => !current)}
            onArchive={actions.archiveConversation}
            onUnarchive={actions.unarchiveConversation}
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
                isGroup={isGroup}
                groupDetail={groupDetail}
                onOpenGroupInfo={() => setGroupInfoOpen(true)}
                loading={conversations.loading}
                onBack={() => navigate("/app/messages")}
                callState={call.callState}
                startCall={call.startCall}
                finishCall={call.finishCall}
                isTyping={isTyping}
                search={search}
                searchOpen={searchOpen}
                onToggleSearch={() => {
                  setSearchOpen((open) => !open);
                  search.setQuery("");
                }}
                onSelectSearchResult={(messageId) => {
                  setSearchOpen(false);
                  jumpToMessage(messageId);
                }}
              />
              {!isGroup && (
                <VoiceCall
                  selected={selected}
                  callState={call.callState}
                  incomingCall={call.incomingCall}
                  callDuration={call.callDuration}
                  remoteAudio={call.remoteAudio}
                  acceptCall={call.acceptCall}
                  finishCall={call.finishCall}
                />
              )}
              <MessageThread
                messages={thread.data}
                loading={thread.loading}
                otherUser={selected?.user}
                isGroup={isGroup}
                threadRef={scroll.messageThreadRef}
                userId={user.id}
                editingMessage={edit.editingMessage}
                deletingMessage={deletion.deletingMessage}
                editBody={edit.editBody}
                editLoading={edit.editLoading}
                setEditBody={edit.setEditBody}
                onEdit={edit.handleEdit}
                onDelete={openDeleteDialog}
                onCancelEdit={edit.cancelEdit}
                onSaveEdit={edit.saveEdit}
                onReply={actions.replyToMessage}
                onReact={actions.reactToMessage}
                onForward={(message) => setForwardingMessage(message)}
                onTogglePin={actions.togglePin}
                pinnedMessageIds={pinnedMessageIds}
                firstUnreadMessageId={thread.meta?.firstUnreadMessageId}
                onJumpToUnread={() => jumpToMessage(thread.meta?.firstUnreadMessageId)}
                highlightedMessageId={highlightedMessageId}
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
                onSendAttachment={actions.sendAttachment}
                onTyping={notifyTyping}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                groupMembers={
                  isGroup
                    ? (groupDetail.data?.members || []).filter((member) => member.id !== user.id)
                    : []
                }
                mentionIds={mentionIds}
                setMentionIds={setMentionIds}
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

      <NewConversationDialog
        open={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
        onCreated={(id) => {
          setNewConversationOpen(false);
          conversations.reload();
          navigate(`/app/messages/${id}`);
        }}
      />

      <DeleteMessageDialog
        open={Boolean(deleteDialogMessageId)}
        canDeleteForEveryone={canDeleteForEveryone}
        loading={deletion.deletingMessage === deleteDialogMessageId}
        onDeleteForMe={runDeleteForMe}
        onDeleteForEveryone={runDeleteForEveryone}
        onCancel={() => setDeleteDialogMessageId(null)}
      />

      <ForwardMessageDialog
        open={Boolean(forwardingMessage)}
        message={forwardingMessage}
        conversations={conversations.data}
        onClose={() => setForwardingMessage(null)}
        onForward={submitForward}
      />

      {isGroup && (
        <GroupInfoPanel
          open={groupInfoOpen}
          onClose={() => setGroupInfoOpen(false)}
          conversationId={conversationId}
          groupDetail={groupDetail}
          currentUserId={user.id}
          onJumpToMessage={jumpToMessage}
          onLeft={() => {
            setGroupInfoOpen(false);
            conversations.reload();
            navigate("/app/messages");
          }}
        />
      )}
    </div>
  );
};

export default Message;
