import { useResource } from "../../../utility/helpers";

const useMessageResources = (conversationId) => {
  const conversations = useResource("/conversations");
  const thread = useResource(
    conversationId
      ? `/conversations/${conversationId}/messages`
      : "/conversations",
  );

  const selected = conversations.data?.find(
    (conversation) => conversation.id === conversationId,
  );

  return { conversations, thread, selected };
};

export default useMessageResources;
