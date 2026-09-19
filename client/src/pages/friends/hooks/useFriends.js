import { useState } from "react";

import { api } from "../../../utility/api";
import { useResource } from "../../../utility/helpers";

const useFriends = () => {
  const [tab, setTab] = useState("friends");
  const people = useResource(`/friends?tab=${tab}`);

  const act = async (entry) => {
    if (tab === "requests") {
      await api.post(`/friends/requests/${entry.id}/accept`);
    }

    if (tab === "sent") {
      await api.delete(`/friends/requests/${entry.user.id}`);
    }

    people.reload();
  };

  return {
    tab,
    setTab,
    people,
    act,
  };
};

export default useFriends;
