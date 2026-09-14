import {
  Add,
  Call,
  CallEnd,
  Delete,
  Edit,
  EmojiEmotions,
  MoreVert,
  Send,
} from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../utility/api";

import {
  Avatar,
  colorFor,
  formatTime,
  ResourceState,
  sendSignal,
  useRealtime,
  useResource,
} from "../../utility/helpers";

const Message = ({ user }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const conversations = useResource("/conversations");

  const thread = useResource(
    conversationId
      ? `/conversations/${conversationId}/messages`
      : "/conversations",
  );

  const [body, setBody] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);

  const [callState, setCallState] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null);

  // Message menu
  const [openMenu, setOpenMenu] = useState(null);

  // Message editing
  const [editingMessage, setEditingMessage] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Delete loading
  const [deletingMessage, setDeletingMessage] = useState(null);

  const remoteAudio = useRef(null);
  const peer = useRef(null);
  const localStream = useRef(null);
  const messageThreadRef = useRef(null);
  const scrollIntentRef = useRef("bottom");
  const savedScrollTopRef = useRef(0);

  const selected = conversations.data?.find(
    (item) => item.id === conversationId,
  );

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
  |--------------------------------------------------------------------------
  | CALL FUNCTIONS
  |--------------------------------------------------------------------------
  */

  const finishCall = (notify = true) => {
    if (notify && selected) {
      sendSignal(selected.user.id, {
        type: "end",
      });
    }

    peer.current?.close();
    peer.current = null;

    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;

    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
    }

    setIncomingCall(null);
    setCallState("idle");
  };

  const createPeer = async (targetId) => {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const connection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    peer.current = connection;

    localStream.current.getTracks().forEach((track) => {
      connection.addTrack(track, localStream.current);
    });

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal(targetId, {
          type: "ice",
          candidate,
        });
      }
    };

    connection.ontrack = ({ streams }) => {
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = streams[0];
      }
    };

    connection.onconnectionstatechange = () => {
      if (
        ["failed", "closed", "disconnected"].includes(
          connection.connectionState,
        )
      ) {
        finishCall(false);
      }
    };

    return connection;
  };

  const startCall = async () => {
    if (!selected) return;

    try {
      setCallState("calling");

      const connection = await createPeer(selected.user.id);

      const offer = await connection.createOffer();

      await connection.setLocalDescription(offer);

      sendSignal(selected.user.id, {
        type: "offer",
        sdp: offer,
      });
    } catch {
      finishCall(false);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      setCallState("active");

      const connection = await createPeer(incomingCall.from);

      await connection.setRemoteDescription(incomingCall.signal.sdp);

      const answer = await connection.createAnswer();

      await connection.setLocalDescription(answer);

      sendSignal(incomingCall.from, {
        type: "answer",
        sdp: answer,
      });

      setIncomingCall(null);
    } catch {
      finishCall(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | SEND MESSAGE
  |--------------------------------------------------------------------------
  */

  const sendMessage = async (e) => {
    e.preventDefault();

    const text = body.trim();

    if (!text || !conversationId || sending) {
      return;
    }

    const optimisticId = `pending-${Date.now()}`;

    const optimisticMessage = {
      id: optimisticId,
      body: text,
      senderId: user.id,
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

  const addEmoji = (emoji) => {
    setBody((current) => `${current}${emoji}`);
    setShowEmojiPicker(false);
  };

  /*
  |--------------------------------------------------------------------------
  | MESSAGE MENU
  |--------------------------------------------------------------------------
  */

  const toggleMessageMenu = (messageId) => {
    setOpenMenu((current) => (current === messageId ? null : messageId));
  };

  /*
  |--------------------------------------------------------------------------
  | EDIT MESSAGE
  |--------------------------------------------------------------------------
  */

  const handleEdit = (message) => {
    setEditingMessage(message.id);
    setEditBody(message.body || "");
    setOpenMenu(null);
    setSendError("");
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditBody("");
  };

  const saveEdit = async (messageId) => {
    const text = editBody.trim();

    if (!text || editLoading) {
      return;
    }

    setEditLoading(true);
    setSendError("");

    try {
      const { data } = await api.patch(
        `/conversations/${conversationId}/messages/${messageId}`,
        {
          body: text,
        },
      );

      const updated = data.data;

      preserveScrollPosition();
      thread.setData((messages = []) =>
        messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                ...updated,
                id: updated.id || updated._id || message.id,
                body: updated.body,
                editedAt: updated.editedAt || new Date().toISOString(),
              }
            : message,
        ),
      );

      setEditingMessage(null);
      setEditBody("");

      conversations.reload();
    } catch (error) {
      setSendError(
        error.response?.data?.error?.message || "Message could not be edited.",
      );
    } finally {
      setEditLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE MESSAGE
  |--------------------------------------------------------------------------
  */

  const handleDelete = async (messageId) => {
    if (deletingMessage) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this message?",
    );

    if (!confirmed) {
      setOpenMenu(null);
      return;
    }

    setDeletingMessage(messageId);
    setOpenMenu(null);
    setSendError("");

    try {
      await api.delete(
        `/conversations/${conversationId}/messages/${messageId}`,
      );

      // শুধু যে message delete করা হয়েছে
      // সেটাই UI থেকে remove হবে
      preserveScrollPosition();
      thread.setData((messages = []) =>
        messages.filter((message) => message.id !== messageId),
      );

      conversations.reload();
    } catch (error) {
      setSendError(
        error.response?.data?.error?.message || "Message could not be deleted.",
      );
    } finally {
      setDeletingMessage(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | REALTIME MESSAGE
  |--------------------------------------------------------------------------
  */

  useRealtime("message:new", (event) => {
    conversations.reload();

    if (event.detail.conversationId === conversationId) {
      prepareForIncomingMessage();
      thread.reload();
    }
  });

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

  useRealtime("realtime:connected", () => {
    conversations.reload();

    if (conversationId) {
      prepareForIncomingMessage();
      thread.reload();
    }
  });

  /*
  |--------------------------------------------------------------------------
  | AUTO REFRESH CONVERSATIONS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const timer = setInterval(conversations.reload, 5000);

    return () => clearInterval(timer);
  }, [conversationId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (conversationId) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();

    if (messageThreadRef.current) {
      messageThreadRef.current.scrollTop = 0;
    }
  }, [conversationId]);

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
  |--------------------------------------------------------------------------
  | CALL SIGNAL
  |--------------------------------------------------------------------------
  */

  useRealtime("call:signal", async (event) => {
    const { from, signal } = event.detail;

    if (from !== selected?.user.id) {
      return;
    }

    if (signal.type === "offer") {
      setIncomingCall({
        from,
        signal,
      });

      setCallState("incoming");
    } else if (signal.type === "answer" && peer.current) {
      await peer.current.setRemoteDescription(signal.sdp);

      setCallState("active");
    } else if (signal.type === "ice" && peer.current) {
      await peer.current.addIceCandidate(signal.candidate);
    } else if (signal.type === "end") {
      finishCall(false);
    }
  });

  /*
  |--------------------------------------------------------------------------
  | CLEANUP CALL
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      finishCall(false);
    };
  }, [conversationId]);

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

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

        <button className="icon-button" aria-label="Choose a conversation">
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
              <div className="chat-header">
                <button
                  className="text-button"
                  onClick={() => navigate("/app/messages")}
                >
                  Back
                </button>

                {selected && (
                  <>
                    <Avatar person={selected.user} />

                    <strong>{selected.user.fullName}</strong>
                  </>
                )}

                <button
                  className="icon-button"
                  onClick={
                    callState === "idle" ? startCall : () => finishCall()
                  }
                  aria-label="Voice call"
                >
                  {callState === "idle" ? <Call /> : <CallEnd />}
                </button>
              </div>

              {/* Incoming Call */}
              {incomingCall && (
                <div className="call-banner">
                  <span>{selected?.user.fullName} is calling</span>

                  <button className="primary-button small" onClick={acceptCall}>
                    Answer
                  </button>

                  <button
                    className="outline-button"
                    onClick={() => finishCall()}
                  >
                    Decline
                  </button>
                </div>
              )}

              {/* Calling */}
              {callState === "calling" && (
                <div className="call-banner">
                  Calling {selected?.user.fullName}…
                </div>
              )}

              {/* Active Call */}
              {callState === "active" && (
                <div className="call-banner">Voice call in progress</div>
              )}

              <audio ref={remoteAudio} autoPlay />

              {/* ==================================================
                MESSAGE THREAD
                ================================================== */}

              <div className="message-thread" ref={messageThreadRef}>
                {thread.data?.map((message) => {
                  const isOwn = String(message.senderId) === String(user.id);

                  const isEditing = editingMessage === message.id;

                  const isDeleting = deletingMessage === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`message-row ${isOwn ? "own" : ""}`}
                    >
                      {/* Message */}
                      {isEditing ? (
                        <div className="message-edit-box">
                          <input
                            value={editBody}
                            onChange={(event) =>
                              setEditBody(event.target.value)
                            }
                            autoFocus
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();

                                saveEdit(message.id);
                              }

                              if (event.key === "Escape") {
                                cancelEdit();
                              }
                            }}
                          />

                          <div className="message-edit-actions">
                            <button
                              type="button"
                              className="outline-button small"
                              onClick={cancelEdit}
                              disabled={editLoading}
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              className="primary-button small"
                              onClick={() => saveEdit(message.id)}
                              disabled={editLoading || !editBody.trim()}
                            >
                              {editLoading ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`message-bubble ${isOwn ? "own" : ""}`}>
                          {message.body}

                          {message.editedAt && (
                            <small className="edited-label">edited</small>
                          )}

                          {message.pending && (
                            <small className="pending-label">Sending...</small>
                          )}
                        </div>
                      )}

                      {isOwn && (
                        <div className="message-menu-wrapper">
                          <button
                            type="button"
                            className="message-menu-button"
                            aria-label="Message options"
                            title="Message options"
                            onClick={() => toggleMessageMenu(message.id)}
                          >
                            <MoreVert />
                          </button>

                          {/* Edit / Delete Popup */}
                          {openMenu === message.id && (
                            <div className="message-menu">
                              <button
                                type="button"
                                className="message-menu-item edit-item"
                                aria-label="Edit message"
                                title="Edit message"
                                onClick={() => handleEdit(message)}
                              >
                                <Edit fontSize="small" />
                              </button>

                              <button
                                type="button"
                                className="message-menu-item delete-item"
                                aria-label={
                                  isDeleting
                                    ? "Deleting message"
                                    : "Delete message"
                                }
                                title={
                                  isDeleting
                                    ? "Deleting message"
                                    : "Delete message"
                                }
                                onClick={() => handleDelete(message.id)}
                                disabled={isDeleting}
                              >
                                <Delete fontSize="small" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Message Composer */}
              <div className="message-composer-container">
                <form className="message-composer" onSubmit={sendMessage}>
                  <div className="emoji-wrapper">
                    <button
                      type="button"
                      className="emoji-button"
                      aria-label="Choose emoji"
                      title="Choose emoji"
                      onClick={() => setShowEmojiPicker((current) => !current)}
                    >
                      <EmojiEmotions fontSize="small" />
                    </button>

                    {showEmojiPicker && (
                      <div className="emoji-picker">
                        <EmojiPicker
                          onEmojiClick={(emojiData) =>
                            addEmoji(emojiData.emoji)
                          }
                          width={320}
                          height={400}
                          searchDisabled={false}
                          previewConfig={{ showPreview: false }}
                          lazyLoadEmojis
                        />
                      </div>
                    )}
                  </div>

                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write a message..."
                    autoFocus
                  />

                  <button className="primary-button small" disabled={sending}>
                    <Send fontSize="small" />

                    {sending ? "Sending..." : "Send"}
                  </button>
                </form>
              </div>

              {sendError && (
                <div className="form-error message-error">{sendError}</div>
              )}
            </section>
          </ResourceState>
        </div>
      ) : (
        /* ==================================================
           CONVERSATION LIST
           ================================================== */

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
                className={`conversation ${
                  conversation?.unreadCount ? "unread" : ""
                }`}
                key={conversation.id}
                onClick={() => navigate(`/app/messages/${conversation.id}`)}
              >
                <div
                  className={`avatar avatar-${colorFor(conversation.user.id)}`}
                >
                  {conversation.user.initials}

                  <i />
                </div>

                <div>
                  <strong>{conversation.user.fullName}</strong>

                  <span>{conversation?.lastMessage?.slice(0,30) || "No messages yet"}</span>
                </div>

                <time>{formatTime(conversation.lastMessageAt)}</time>

                {conversation.unreadCount > 0 && (
                  <b>{conversation.unreadCount}</b>
                )}
              </button>
            ))}
          </div>
        </ResourceState>
      )}
    </div>
  );
};

export default Message;
