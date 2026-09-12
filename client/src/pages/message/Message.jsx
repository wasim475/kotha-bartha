import { Add, Call, CallEnd, Send } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from '../../utility/api'; // api import করুন ঠিক মতো
import { useRealtime, sendSignal, colorFor, formatTime, ResourceState, Avatar, useResource } from '../../utility/helpers'; // helper ফাংশনগুলো উপযুক্ত ভাবে import করুন

const Message = ({ user }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const conversations = useResource("/conversations");

  // console.log(conversations.data)

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

  const remoteAudio = useRef(null);
  const peer = useRef(null);
  const localStream = useRef(null);

  const selected = conversations.data?.find(
    (item) => item.id === conversationId
  );

  const finishCall = (notify = true) => {
    if (notify && selected)
      sendSignal(selected.user.id, { type: "end" });

    peer.current?.close();
    peer.current = null;

    localStream.current?.getTracks().forEach(track => track.stop());
    localStream.current = null;

    if (remoteAudio.current)
      remoteAudio.current.srcObject = null;

    setIncomingCall(null);
    setCallState("idle");
  };

  const createPeer = async (targetId) => {
    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peer.current = connection;

    localStream.current.getTracks().forEach(track => connection.addTrack(track, localStream.current));

    connection.onicecandidate = ({ candidate }) => {
      if (candidate)
        sendSignal(targetId, { type: "ice", candidate });
    };

    connection.ontrack = ({ streams }) => {
      if (remoteAudio.current)
        remoteAudio.current.srcObject = streams[0];
    };

    connection.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(connection.connectionState))
        finishCall(false);
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

      sendSignal(selected.user.id, { type: "offer", sdp: offer });
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

      sendSignal(incomingCall.from, { type: "answer", sdp: answer });

      setIncomingCall(null);
    } catch {
      finishCall(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || !conversationId || sending) return;

    const optimisticId = `pending-${Date.now()}`;
    const optimisticMessage = { id: optimisticId, body: text, senderId: user.id, pending: true };
    setBody("");
    setSendError("");
    setSending(true);
    thread.setData((messages = []) => [...messages, optimisticMessage]);

    try {
      const { data } = await api.post(`/conversations/${conversationId}/messages`, { body: text });
      const saved = data.data;
      thread.setData((messages = []) => messages.map((message) =>
        message.id === optimisticId
          ? { ...saved, id: saved.id || saved._id, senderId: String(saved.senderId), pending: false }
          : message,
      ));
      conversations.reload();
    } catch (error) {
      thread.setData((messages = []) => messages.filter((message) => message.id !== optimisticId));
      setBody(text);
      setSendError(error.response?.data?.error?.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  useRealtime("message:new", (event) => {
    conversations.reload();

    if (event.detail.conversationId === conversationId)
      thread.reload();
  });

  useRealtime("realtime:connected", () => {
    conversations.reload();
    if (conversationId)
      thread.reload();
  });

  useEffect(() => {
    const timer = setInterval(conversations.reload, 5000);
    return () => clearInterval(timer);
  }, [conversationId]);

  useRealtime("call:signal", async (event) => {
    const { from, signal } = event.detail;

    if (from !== selected?.user.id) return;

    if (signal.type === "offer") {
      setIncomingCall({ from, signal });
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

  useEffect(() => () => finishCall(false), [conversationId]);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Keep in touch</span>
          <h1>Messages</h1>
        </div>

        <button className="icon-button" aria-label="Choose a conversation">
          <Add />
        </button>
      </div>

      {conversationId ? (
        <ResourceState loading={conversations.loading || thread.loading} error={conversations.error || thread.error}>
          <section className="chat-panel">
            <div className="chat-header">
              <button className="text-button" onClick={() => navigate("/app/messages")}>
                Back
              </button>

              {selected && (
                <>
                  <Avatar person={selected.user} />
                  <strong>{selected.user.fullName}</strong>
                </>
              )}

              <button className="icon-button" onClick={callState === "idle" ? startCall : () => finishCall()} aria-label="Voice call">
                {callState === "idle" ? <Call /> : <CallEnd />}
              </button>
            </div>

            {incomingCall && (
              <div className="call-banner">
                <span>{selected?.user.fullName} is calling</span>
                <button className="primary-button small" onClick={acceptCall}>Answer</button>
                <button className="outline-button" onClick={() => finishCall()}>Decline</button>
              </div>
            )}

            {callState === "calling" && <div className="call-banner">Calling {selected?.user.fullName}…</div>}
            {callState === "active" && <div className="call-banner">Voice call in progress</div>}

            <audio ref={remoteAudio} autoPlay />

            <div className="message-thread">
              {thread.data?.map((message) => (
                <div key={message.id} className={`message-bubble ${message.senderId === user.id ? "own" : ""}`}>
                  {message.body}
                </div>
              ))}
            </div>

            <form className="message-composer" onSubmit={sendMessage}>
              <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message..." autoFocus />
              <button className="primary-button small" disabled={sending}><Send fontSize="small" /> {sending ? "Sending..." : "Send"}</button>
            </form>
            {sendError && <div className="form-error">{sendError}</div>}
          </section>
        </ResourceState>
      ) : (
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
            {/* {console.log("concersations",conversations)} */}
            {conversations?.data?.map((conversation) => (
              <button
                className={`conversation ${conversation?.unreadCount ? "unread" : ""}`}
                key={conversation.id}
                onClick={() => navigate(`/app/messages/${conversation.id}`)}
              >
                <div className={`avatar avatar-${colorFor(conversation.user.id)}`}>
                  {conversation.user.initials}
                  <i />
                </div>

                <div>
                
                  <strong>{conversation.user.fullName}</strong>
                  <span>{conversation.lastMessage || "No messages yet"}</span>
                </div>

                <time>{formatTime(conversation.lastMessageAt)}</time>

                {conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}
              </button>
            ))}
          </div>
        </ResourceState>
      )}
    </>
  );
};

export default Message;
