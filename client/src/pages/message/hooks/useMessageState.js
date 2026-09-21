import { useEffect, useRef, useState } from "react";
import { sendTypingSignal } from "../../../utility/helpers";

const useMessageState = ({ conversationId, selected }) => {
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [emojiMessageId, setEmojiMessageId] = useState(null);

  const localTypingTimeoutRef = useRef(null);
  const remoteTypingTimeoutRef = useRef(null);

  const closeMessageInteractions = () => {
    setSelectedMessageId(null);
    setEmojiMessageId(null);
  };

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
    const remoteTypingTimeout = remoteTypingTimeoutRef.current;

    return () => {
      clearTimeout(localTypingTimeoutRef.current);
      clearTimeout(remoteTypingTimeout);

      if (conversationId && selected?.user?.id) {
        sendTypingSignal(selected.user.id, conversationId, false);
      }
    };
  }, [conversationId, selected?.user?.id]);

  return {
    body,
    setBody,
    replyingTo,
    setReplyingTo,
    isTyping,
    setIsTyping,
    sendError,
    setSendError,
    sending,
    setSending,
    selectedMessageId,
    setSelectedMessageId,
    emojiMessageId,
    setEmojiMessageId,
    localTypingTimeoutRef,
    remoteTypingTimeoutRef,
    notifyTyping,
    closeMessageInteractions,
  };
};

export default useMessageState;
