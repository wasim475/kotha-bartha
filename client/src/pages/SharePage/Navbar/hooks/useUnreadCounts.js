import { useEffect, useState } from "react";
import { api } from "../../../../utility/api";
import { useRealtime } from "../../../../utility/helpers";

const initialCounts = {
  feed: 0,
  friends: 0,
  messages: 0,
  notifications: 0,
};

export default function useUnreadCounts() {
  const [counts, setCounts] = useState(initialCounts);

  const loadCounts = async () => {
    try {
      const { data } = await api.get("/notifications/unread-counts");

      setCounts({
        feed: Number(data.data?.feed || 0),
        friends: Number(data.data?.friends || 0),
        messages: Number(data.data?.messages || 0),
        notifications: Number(data.data?.notifications || 0),
      });
    } catch (error) {
      console.error("Unable to load unread counts:", error);
    }
  };

  useEffect(() => {
    // The initial request hydrates badge state from the authenticated API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCounts();
  }, []);

  useRealtime("message:new", loadCounts);

  useRealtime("notification:new", () => {
    setCounts((current) => ({
      ...current,
      notifications: current.notifications + 1,
    }));
  });

  useRealtime("post:new", () => {
    setCounts((current) => ({
      ...current,
      feed: current.feed + 1,
    }));
  });

  useRealtime("friend:new", () => {
    setCounts((current) => ({
      ...current,
      friends: current.friends + 1,
    }));
  });

  useRealtime("realtime:connected", loadCounts);

  const clearCount = (key) => {
    setCounts((current) => ({
      ...current,
      [key]: 0,
    }));
  };

  return { counts, clearCount };
}
