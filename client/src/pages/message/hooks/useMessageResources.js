import { useState } from "react";
import { useResource } from "../../../utility/helpers";

const useMessageResources = (conversationId) => {
  const [archiveView, setArchiveView] = useState(false);

  const conversations = useResource("/conversations");
  // Only fetched once the Archived tab is actually opened, so a normal page
  // load doesn't pay for a request nobody asked for.
  const archived = useResource(archiveView ? "/conversations?archived=true" : null);

  const thread = useResource(
    conversationId
      ? `/conversations/${conversationId}/messages`
      : "/conversations",
  );

  const selected =
    conversations.data?.find((conversation) => conversation.id === conversationId) ||
    archived.data?.find((conversation) => conversation.id === conversationId);

  // Full member list (needed for group info / @mentions) isn't in the
  // lightweight conversation-list summary, so it's fetched separately —
  // only once we know this conversation is actually a group.
  const groupDetail = useResource(
    conversationId && selected?.isGroup ? `/conversations/${conversationId}` : null,
  );

  const reloadLists = () => {
    conversations.reload();
    if (archiveView) archived.reload();
  };

  return {
    conversations,
    archived,
    archiveView,
    setArchiveView,
    thread,
    selected,
    groupDetail,
    reloadLists,
  };
};

export default useMessageResources;
