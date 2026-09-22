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

  // Full member list (needed for group info / @mentions) isn't in the
  // lightweight conversation-list summary, so it's fetched separately —
  // only once we know this conversation is actually a group.
  const groupDetail = useResource(
    conversationId && selected?.isGroup ? `/conversations/${conversationId}` : null,
  );

  return { conversations, thread, selected, groupDetail };
};

export default useMessageResources;
