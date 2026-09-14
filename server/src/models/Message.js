import {
  Add,
  Call,
  CallEnd,
  DeleteOutline,
  EditOutlined,
  MoreVert,
  Send,
} from "@mui/icons-material";

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../../utility/api";

import {
  Avatar,
  ResourceState,
  colorFor,
  formatTime,
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
      : "/conversations"
  );

  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);

  const [callState, setCallState] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null);

  // Message edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingBody, setEditingBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Three dot menu
  const [openMenuId, setOpenMenuId] = useState(null);

  const remoteAudio = useRef(null);
  const peer = useRef(null);
  const localStream = useRef(null);


  const selected = conversations.data?.find(
    (item) => String(item.id) === String(conversationId)
  );


  /*
  |--------------------------------------------------------------------------
  | Call
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
    localStream.current =
      await navigator.mediaDevices.getUserMedia({
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

    localStream.current
      .getTracks()
      .forEach((track) => {
        connection.addTrack(
          track,
          localStream.current
        );
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
          connection.connectionState
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

      const connection = await createPeer(
        selected.user.id
      );

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

      const connection = await createPeer(
        incomingCall.from
      );

      await connection.setRemoteDescription(
        incomingCall.signal.sdp
      );

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
  | Send Message
  |--------------------------------------------------------------------------
  */

  const sendMessage = async (e) => {
    e.preventDefault();

    const text = body.trim();

    if (
      !text ||
      !conversationId ||
      sending
    ) {
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

    thread.setData((messages = []) => [
      ...messages,
      optimisticMessage,
    ]);


    try {
      const { data } = await api.post(
        `/conversations/${conversationId}/messages`,
        {
          body: text,
        }
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
            : message
        )
      );

      conversations.reload();
    } catch (error) {
      thread.setData((messages = []) =>
        messages.filter(
          (message) =>
            message.id !== optimisticId
        )
      );

      setBody(text);

      setSendError(
        error.response?.data?.error?.message ||
          "Message could not be sent."
      );
    } finally {
      setSending(false);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Edit Message
  |--------------------------------------------------------------------------
  */

  const startEdit = (message) => {
    setEditingMessageId(
      String(message.id)
    );

    setEditingBody(message.body);

    setOpenMenuId(null);
  };


  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingBody("");
  };


  const saveEdit = async (messageId) => {
    const text = editingBody.trim();

    if (!text || savingEdit) {
      return;
    }

    setSavingEdit(true);

    try {
      const { data } = await api.patch(
        `/conversations/${conversationId}/messages/${messageId}`,
        {
          body: text,
        }
      );

      const updated = data.data;

      thread.setData((messages = []) =>
        messages.map((message) =>
          String(message.id) ===
          String(messageId)
            ? {
                ...message,
                ...updated,
                id:
                  updated.id ||
                  updated._id ||
                  message.id,
                body: updated.body || text,
                editedAt:
                  updated.editedAt ||
                  new Date().toISOString(),
              }
            : message
        )
      );

      setEditingMessageId(null);
      setEditingBody("");
    } catch (error) {
      setSendError(
        error.response?.data?.error?.message ||
          "Message could not be edited."
      );
    } finally {
      setSavingEdit(false);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Delete Message
  |--------------------------------------------------------------------------
  */

  const deleteMessage = async (messageId) => {
    setOpenMenuId(null);

    try {
      await api.delete(
        `/conversations/${conversationId}/messages/${messageId}`
      );

      // শুধু যে message delete করা হয়েছে সেটাই remove হবে
      thread.setData((messages = []) =>
        messages.filter(
          (message) =>
            String(message.id) !==
            String(messageId)
        )
      );

      conversations.reload();
    } catch (error) {
      setSendError(
        error.response?.data?.error?.message ||
          "Message could not be deleted."
      );
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Realtime Messages
  |--------------------------------------------------------------------------
  */

  useRealtime("message:new", (event) => {
    conversations.reload();

    if (
      String(event.detail.conversationId) ===
      String(conversationId)
    ) {
      thread.reload();
    }
  });


  useRealtime("realtime:connected", () => {
    conversations.reload();

    if (conversationId) {
      thread.reload();
    }
  });


  useEffect(() => {
    const timer = setInterval(
      conversations.reload,
      5000
    );

    return () => clearInterval(timer);
  }, [conversationId]);


  /*
  |--------------------------------------------------------------------------
  | Realtime Calls
  |--------------------------------------------------------------------------
  */

  useRealtime("call:signal", async (event) => {
    const { from, signal } = event.detail;

    if (
      String(from) !==
      String(selected?.user.id)
    ) {
      return;
    }


    if (signal.type === "offer") {
      setIncomingCall({
        from,
        signal,
      });

      setCallState("incoming");
    }


    else if (
      signal.type === "answer" &&
      peer.current
    ) {
      await peer.current.setRemoteDescription(
        signal.sdp
      );

      setCallState("active");
    }


    else if (
      signal.type === "ice" &&
      peer.current
    ) {
      await peer.current.addIceCandidate(
        signal.candidate
      );
    }


    else if (signal.type === "end") {
      finishCall(false);
    }
  });


  useEffect(() => {
    return () => {
      finishCall(false);
    };
  }, [conversationId]);


  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            Keep in touch
          </span>

          <h1>Messages</h1>
        </div>

        <button
          className="icon-button"
          aria-label="Choose a conversation"
        >
          <Add />
        </button>
      </div>


      {conversationId ? (
        <ResourceState
          loading={
            conversations.loading ||
            thread.loading
          }
          error={
            conversations.error ||
            thread.error
          }
        >
          <section className="chat-panel">

            {/* Chat Header */}

            <div className="chat-header">
              <button
                className="text-button"
                onClick={() =>
                  navigate("/app/messages")
                }
              >
                Back
              </button>


              {selected && (
                <>
                  <Avatar
                    person={selected.user}
                  />

                  <strong>
                    {selected.user.fullName}
                  </strong>
                </>
              )}


              <button
                className="icon-button"
                onClick={
                  callState === "idle"
                    ? startCall
                    : () => finishCall()
                }
                aria-label="Voice call"
              >
                {callState === "idle" ? (
                  <Call />
                ) : (
                  <CallEnd />
                )}
              </button>
            </div>


            {/* Incoming Call */}

            {incomingCall && (
              <div className="call-banner">
                <span>
                  {selected?.user.fullName} is
                  calling
                </span>

                <button
                  className="primary-button small"
                  onClick={acceptCall}
                >
                  Answer
                </button>

                <button
                  className="outline-button"
                  onClick={() =>
                    finishCall()
                  }
                >
                  Decline
                </button>
              </div>
            )}


            {callState === "calling" && (
              <div className="call-banner">
                Calling{" "}
                {selected?.user.fullName}…
              </div>
            )}


            {callState === "active" && (
              <div className="call-banner">
                Voice call in progress
              </div>
            )}


            <audio
              ref={remoteAudio}
              autoPlay
            />


            {/* Message Thread */}

            <div className="message-thread">

              {thread.data?.map((message) => {

                /*
                 * গুরুত্বপূর্ণ:
                 * senderId এবং user.id দুইটাকেই String করা হয়েছে।
                 * তাই ObjectId বনাম string mismatch হবে না।
                 */

                const isOwnMessage =
                  String(message.senderId) ===
                  String(user.id);

                const messageId =
                  String(message.id);

                const isEditing =
                  editingMessageId ===
                  messageId;


                return (
                  <div
                    key={messageId}
                    className={`message-row ${
                      isOwnMessage
                        ? "own-message"
                        : "other-message"
                    }`}
                  >

                    {/* নিজের message হলে ONLY এখানে three-dot */}
                    {isOwnMessage && !isEditing && (
                      <div className="message-menu-wrapper">

                        <button
                          type="button"
                          className="message-menu-button"
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId ===
                                messageId
                                ? null
                                : messageId
                            )
                          }
                          aria-label="Message options"
                        >
                          <MoreVert />
                        </button>


                        {openMenuId ===
                          messageId && (
                          <div className="message-menu">

                            <button
                              type="button"
                              className="message-menu-item edit-item"
                              onClick={() =>
                                startEdit(
                                  message
                                )
                              }
                            >
                              <EditOutlined fontSize="small" />
                              <span>Edit</span>
                            </button>


                            <button
                              type="button"
                              className="message-menu-item delete-item"
                              onClick={() =>
                                deleteMessage(
                                  messageId
                                )
                              }
                            >
                              <DeleteOutline fontSize="small" />
                              <span>Delete</span>
                            </button>

                          </div>
                        )}

                      </div>
                    )}


                    {/* Message */}

                    <div
                      className={`message-bubble ${
                        isOwnMessage
                          ? "own"
                          : ""
                      }`}
                    >

                      {isEditing ? (
                        <div className="message-edit-box">

                          <textarea
                            value={editingBody}
                            onChange={(e) =>
                              setEditingBody(
                                e.target.value
                              )
                            }
                            autoFocus
                            rows="2"
                          />


                          <div className="message-edit-actions">

                            <button
                              type="button"
                              className="edit-cancel-button"
                              onClick={
                                cancelEdit
                              }
                            >
                              Cancel
                            </button>


                            <button
                              type="button"
                              className="edit-save-button"
                              disabled={
                                savingEdit
                              }
                              onClick={() =>
                                saveEdit(
                                  messageId
                                )
                              }
                            >
                              {savingEdit
                                ? "Saving..."
                                : "Save"}
                            </button>

                          </div>

                        </div>
                      ) : (
                        <>
                          {message.body}

                          {message.editedAt && (
                            <span className="edited-label">
                              edited
                            </span>
                          )}
                        </>
                      )}

                    </div>

                  </div>
                );
              })}

            </div>


            {/* Composer */}

            <form
              className="message-composer"
              onSubmit={sendMessage}
            >
              <input
                value={body}
                onChange={(e) =>
                  setBody(e.target.value)
                }
                placeholder="Write a message..."
                autoFocus
              />

              <button
                className="primary-button small"
                disabled={sending}
              >
                <Send fontSize="small" />

                {sending
                  ? "Sending..."
                  : "Send"}
              </button>
            </form>


            {sendError && (
              <div className="form-error">
                {sendError}
              </div>
            )}

          </section>
        </ResourceState>
      ) : (

        <ResourceState
          loading={
            conversations.loading
          }
          error={conversations.error}
          empty={
            !conversations.data?.length
              ? "No conversations yet. Message a friend to start chatting."
              : ""
          }
        >

          <div className="message-list">

            {conversations.data?.map(
              (conversation) => (
                <button
                  className={`conversation ${
                    conversation.unreadCount
                      ? "unread"
                      : ""
                  }`}
                  key={conversation.id}
                  onClick={() =>
                    navigate(
                      `/app/messages/${conversation.id}`
                    )
                  }
                >

                  <div
                    className={`avatar avatar-${colorFor(
                      conversation.user.id
                    )}`}
                  >
                    {
                      conversation.user
                        .initials
                    }

                    <i />
                  </div>


                  <div>
                    <strong>
                      {
                        conversation.user
                          .fullName
                      }
                    </strong>

                    <span>
                      {
                        conversation.lastMessage ||
                        "No messages yet"
                      }
                    </span>
                  </div>


                  <time>
                    {formatTime(
                      conversation.lastMessageAt
                    )}
                  </time>


                  {conversation.unreadCount >
                    0 && (
                    <b>
                      {
                        conversation.unreadCount
                      }
                    </b>
                  )}

                </button>
              )
            )}

          </div>

        </ResourceState>
      )}

    </>
  );
};


export default Message;