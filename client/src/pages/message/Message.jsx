import { Add } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../../utility/api";

import {
  ResourceState,
  sendTypingSignal,
  useRealtime,
  useResource,
} from "../../utility/helpers";

import useDeleteMessage from "./hooks/useDeleteMessage";
import useEditMessage from "./hooks/useEditMessage";
import useVoiceCall from "./hooks/useVoiceCall";

import ChatHeader from "./components/ChatHeader";
import ConversationList from "./components/ConversationList";
import MessageBubble from "./components/MessageBubble";
import MessageComposer from "./components/MessageComposer";
import VoiceCall from "./components/VoicCall";

const Message = ({ user }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  /*
   * -----------------------------------------
   * RESOURCES
   * -----------------------------------------
   */

  const conversations = useResource("/conversations");

  const thread = useResource(
    conversationId
      ? `/conversations/${conversationId}/messages`
      : "/conversations",
  );

  /*
   * -----------------------------------------
   * MESSAGE STATE
   * -----------------------------------------
   */

  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);

  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [emojiMessageId, setEmojiMessageId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  /*
   * -----------------------------------------
   * SCROLL
   * -----------------------------------------
   */

  const messageThreadRef = useRef(null);

  const scrollIntentRef = useRef("bottom");

  const savedScrollTopRef = useRef(0);
  const localTypingTimeoutRef = useRef(null);
  const remoteTypingTimeoutRef = useRef(null);
  const pendingMessageSoundIdsRef = useRef(new Set());

  /*
   * -----------------------------------------
   * SELECTED CONVERSATION
   * -----------------------------------------
   */

  const selected = conversations.data?.find(
    (item) => item.id === conversationId,
  );

  const notifyTyping = (value) => {
    if (!conversationId || !selected?.user?.id) return;

    clearTimeout(localTypingTimeoutRef.current);

    const typing = Boolean(value.trim());
    sendTypingSignal(selected.user.id, conversationId, typing);

    if (typing) {
      localTypingTimeoutRef.current = setTimeout(() => {
        sendTypingSignal(selected.user.id, conversationId, false);
      }, 1200);
    }
  };

  useEffect(() => {
    return () => {
      clearTimeout(localTypingTimeoutRef.current);

      if (conversationId && selected?.user?.id) {
        sendTypingSignal(selected.user.id, conversationId, false);
      }
    };
  }, [conversationId, selected?.user?.id]);

  /*
   * -----------------------------------------
   * VOICE CALL
   * -----------------------------------------
   */

  const {
    callState,
    incomingCall,
    remoteAudio,
    startCall,
    acceptCall,
    finishCall,
  } = useVoiceCall({
    selected,
    conversationId,
  });

  /*
   * -----------------------------------------
   * SCROLL FUNCTIONS
   * -----------------------------------------
   */

  const isNearBottom = () => {
    const messageThread = messageThreadRef.current;

    if (!messageThread) {
      return true;
    }

    return (
      messageThread.scrollHeight -
        messageThread.scrollTop -
        messageThread.clientHeight <=
      48
    );
  };

  const scrollToBottom = () => {
    scrollIntentRef.current = "bottom";
  };

  const preserveScrollPosition = () => {
    scrollIntentRef.current = "preserve";

    savedScrollTopRef.current = messageThreadRef.current?.scrollTop || 0;
  };

  const prepareForIncomingMessage = () => {
    if (isNearBottom()) {
      scrollToBottom();
    } else {
      preserveScrollPosition();
    }
  };

  /*
   * -----------------------------------------
   * EDIT MESSAGE
   * -----------------------------------------
   */

  const {
    editingMessage,
    editBody,
    editLoading,
    setEditBody,
    handleEdit,
    cancelEdit,
    saveEdit,
  } = useEditMessage({
    conversationId,
    thread,
    conversations,
    preserveScrollPosition,
  });

  /*
   * -----------------------------------------
   * DELETE MESSAGE
   * -----------------------------------------
   */

  const { deletingMessage, handleDelete } = useDeleteMessage({
    conversationId,
    thread,
    conversations,
    preserveScrollPosition,
  });

  /*
   * -----------------------------------------
   * SEND MESSAGE
   * -----------------------------------------
   */

  const sendMessage = async (event) => {
    event.preventDefault();

    const text = body.trim();

    if (!text || !conversationId || sending) {
      return;
    }

    clearTimeout(localTypingTimeoutRef.current);
    sendTypingSignal(selected?.user?.id, conversationId, false);
    setIsTyping(false);

    const optimisticId = `pending-${Date.now()}`;

    const optimisticMessage = {
      id: optimisticId,
      body: text,
      senderId: user.id,
      status: "sent",
      replyTo: replyingTo,
      reactions: [],
      pending: true,
    };

    setBody("");
    setSendError("");
    setSending(true);

    scrollToBottom();

    thread.setData((messages = []) => [...messages, optimisticMessage]);

    try {
      const { data } = await api.post(
        `/conversations/${conversationId}/messages`,
        {
          body: text,
          replyTo: replyingTo?.id || null,
        },
      );

      const saved = data.data;

      thread.setData((messages = []) =>
        messages.map((message) =>
          message.id === optimisticId
            ? {
                ...saved,
                id: saved.id || saved._id,
                senderId: String(saved.senderId),
                pending: false,
              }
            : message,
        ),
      );

      setReplyingTo(null);
      closeMessageInteractions();
      conversations.reload();
    } catch (error) {
      thread.setData((messages = []) =>
        messages.filter((message) => message.id !== optimisticId),
      );

      setBody(text);

      setSendError(
        error.response?.data?.error?.message || "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  const reactToMessage = async (messageId, emoji) => {
    setSelectedMessageId(messageId);
    setEmojiMessageId(null);

    try {
      const { data } = await api.put(
        `/conversations/${conversationId}/messages/${messageId}/reaction`,
        { emoji },
      );

      thread.setData((messages = []) =>
        messages.map((message) =>
          message.id === messageId
            ? { ...message, reactions: data.data.reactions }
            : message,
        ),
      );
    } catch (error) {
      setSendError(
        error.response?.data?.error?.message || "Reaction could not be saved.",
      );
    }
  };

  /*
   * -----------------------------------------
   * MESSAGE MENU
   * -----------------------------------------
   */

  const toggleMessageMenu = (messageId) => {
    setOpenMenu((current) => (current === messageId ? null : messageId));
  };

  const selectMessage = (messageId) => {
    setSelectedMessageId(messageId);
    setEmojiMessageId(null);
    setOpenMenu(null);
  };

  const openEmojiPicker = (messageId) => {
    setSelectedMessageId(messageId);
    setEmojiMessageId((current) => (current === messageId ? null : messageId));
  };

  const replyToMessage = (message) => {
    setReplyingTo(message);
    closeMessageInteractions();
  };

  const closeMessageInteractions = () => {
    setSelectedMessageId(null);
    setEmojiMessageId(null);
    setOpenMenu(null);
  };

  useEffect(() => {
    const handleOutsideInteraction = (event) => {
      if (
        !event.target.closest(".message-interaction") &&
        !event.target.closest(".message-bubble") &&
        !event.target.closest(".message-menu")
      ) {
        closeMessageInteractions();
      }
    };

    document.addEventListener("mousedown", handleOutsideInteraction);
    return () =>
      document.removeEventListener("mousedown", handleOutsideInteraction);
  }, []);

  /*
   * -----------------------------------------
   * REALTIME MESSAGE
   * -----------------------------------------
   */

  useRealtime("message:new", (event) => {
    conversations.reload();

    if (event.detail.conversationId === conversationId) {
      if (event.detail.id) {
        pendingMessageSoundIdsRef.current.add(String(event.detail.id));
      }
      prepareForIncomingMessage();
      thread.reload();
    }
  });

  useEffect(() => {
    if (!thread.data || pendingMessageSoundIdsRef.current.size === 0) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      const renderedMessageIds = new Set(
        thread.data.map((message) => String(message.id)),
      );
      const renderedPendingIds = [...pendingMessageSoundIdsRef.current].filter(
        (id) => renderedMessageIds.has(id),
      );

      if (renderedPendingIds.length === 0) return;

      renderedPendingIds.forEach((id) =>
        pendingMessageSoundIdsRef.current.delete(id),
      );

      const messageSound = new Audio("/sounds/message.mp3");
      messageSound.currentTime = 0;
      messageSound.play().catch((error) => {
        console.error("Message sound failed:", error);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [thread.data]);

  useRealtime("message:updated", (event) => {
    if (event.detail.conversationId !== conversationId) {
      return;
    }

    prepareForIncomingMessage();

    thread.setData((messages = []) =>
      messages.map((message) =>
        message.id === event.detail.id
          ? {
              ...message,
              body: event.detail.body,
              editedAt: event.detail.editedAt,
            }
          : message,
      ),
    );

    conversations.reload();
  });

  useRealtime("message:deleted", (event) => {
    if (event.detail.conversationId !== conversationId) {
      return;
    }

    prepareForIncomingMessage();

    thread.setData((messages = []) =>
      messages.filter((message) => message.id !== event.detail.id),
    );

    conversations.reload();
  });

  useRealtime("message:reaction", (event) => {
    if (event.detail.conversationId !== conversationId) return;

    thread.setData((messages = []) =>
      messages.map((message) =>
        message.id === event.detail.id
          ? { ...message, reactions: event.detail.reactions }
          : message,
      ),
    );
  });

  useRealtime("message:read", (event) => {
    if (event.detail.conversationId !== conversationId) return;

    thread.setData((messages = []) =>
      messages.map((message) =>
        message.id === event.detail.id
          ? { ...message, status: "read" }
          : message,
      ),
    );
  });

  useRealtime("typing:start", (event) => {
    if (
      event.detail.conversationId !== conversationId ||
      event.detail.senderId !== String(selected?.user?.id)
    ) {
      return;
    }

    setIsTyping(true);
    clearTimeout(remoteTypingTimeoutRef.current);
    remoteTypingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2500);
  });

  useRealtime("typing:stop", (event) => {
    if (
      event.detail.conversationId === conversationId &&
      event.detail.senderId === String(selected?.user?.id)
    ) {
      clearTimeout(remoteTypingTimeoutRef.current);
      setIsTyping(false);
    }
  });

  useRealtime("realtime:connected", () => {
    conversations.reload();

    if (conversationId) {
      prepareForIncomingMessage();
      thread.reload();
    }
  });

  /*
   * -----------------------------------------
   * AUTO REFRESH
   * -----------------------------------------
   */

  useEffect(() => {
    const timer = setInterval(conversations.reload, 5000);

    return () => clearInterval(timer);
  }, [conversationId]);

  /*
   * -----------------------------------------
   * BODY SCROLL LOCK
   * -----------------------------------------
   */

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (conversationId) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [conversationId]);

  /*
   * -----------------------------------------
   * CONVERSATION CHANGE
   * -----------------------------------------
   */

  useEffect(() => {
    setSelectedMessageId(null);
    setEmojiMessageId(null);
    setOpenMenu(null);
    scrollToBottom();

    if (messageThreadRef.current) {
      messageThreadRef.current.scrollTop = 0;
    }
  }, [conversationId]);

  /*
   * -----------------------------------------
   * MESSAGE SCROLL
   * -----------------------------------------
   */

  useEffect(() => {
    if (!thread.data || !messageThreadRef.current) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      const messageThread = messageThreadRef.current;

      if (!messageThread) {
        return;
      }

      if (scrollIntentRef.current === "bottom") {
        messageThread.scrollTop = messageThread.scrollHeight;
      } else {
        messageThread.scrollTop = savedScrollTopRef.current;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [thread.data, conversationId]);

  /*
   * -----------------------------------------
   * RENDER
   * -----------------------------------------
   */

  return (
    <div
      className={
        conversationId ? "message-page message-page-chat" : "message-page"
      }
    >
      {/* Page Heading */}
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
              {/* Chat Header */}
              <ChatHeader
                selected={selected}
                onBack={() => navigate("/app/messages")}
                callState={callState}
                startCall={startCall}
                finishCall={finishCall}
                isTyping={isTyping}
              />

              {/* Voice Call */}
              <VoiceCall
                selected={selected}
                callState={callState}
                incomingCall={incomingCall}
                remoteAudio={remoteAudio}
                acceptCall={acceptCall}
                finishCall={finishCall}
              />

              {/* Message Thread */}
              <div className="message-thread" ref={messageThreadRef}>
                {thread.data?.map((message) => {
                  const isOwn = String(message.senderId) === String(user.id);

                  const isEditing = editingMessage === message.id;

                  const isDeleting = deletingMessage === message.id;

                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={isOwn}
                      isEditing={isEditing}
                      isDeleting={isDeleting}
                      openMenu={openMenu}
                      editBody={editBody}
                      editLoading={editLoading}
                      setEditBody={setEditBody}
                      onToggleMenu={toggleMessageMenu}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={saveEdit}
                      onReply={replyToMessage}
                      onReact={reactToMessage}
                      selected={selectedMessageId === message.id}
                      emojiOpen={emojiMessageId === message.id}
                      onSelectMessage={selectMessage}
                      onOpenEmoji={() => openEmojiPicker(message.id)}
                      onCloseInteraction={closeMessageInteractions}
                    />
                  );
                })}
              </div>

              {/* Message Composer */}
              <MessageComposer
                body={body}
                setBody={setBody}
                sending={sending}
                onSend={sendMessage}
                onTyping={notifyTyping}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />

              {/* Error */}
              {sendError && (
                <div className="form-error message-error">{sendError}</div>
              )}
            </section>
          </ResourceState>
        </div>
      ) : (
        /* Conversation List */
        <ConversationList
          conversations={conversations}
          onOpenConversation={(id) => navigate(`/app/messages/${id}`)}
        />
      )}
    </div>
  );
};

export default Message;
