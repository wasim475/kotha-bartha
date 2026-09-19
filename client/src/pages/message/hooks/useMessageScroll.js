import { useEffect, useRef } from "react";

const useMessageScroll = ({ conversationId, thread }) => {
  const messageThreadRef = useRef(null);
  const scrollIntentRef = useRef("bottom");
  const savedScrollTopRef = useRef(0);

  const isNearBottom = () => {
    const messageThread = messageThreadRef.current;
    if (!messageThread) return true;

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
    if (isNearBottom()) scrollToBottom();
    else preserveScrollPosition();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (conversationId) document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
    if (messageThreadRef.current) messageThreadRef.current.scrollTop = 0;
  }, [conversationId]);

  useEffect(() => {
    if (!thread.data || !messageThreadRef.current) return undefined;

    const frame = requestAnimationFrame(() => {
      const messageThread = messageThreadRef.current;
      if (!messageThread) return;

      messageThread.scrollTop =
        scrollIntentRef.current === "bottom"
          ? messageThread.scrollHeight
          : savedScrollTopRef.current;
    });

    return () => cancelAnimationFrame(frame);
  }, [thread.data, conversationId]);

  return {
    messageThreadRef,
    scrollToBottom,
    preserveScrollPosition,
    prepareForIncomingMessage,
  };
};

export default useMessageScroll;
