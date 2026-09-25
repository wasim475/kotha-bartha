import { useRealtime, useResource } from "../../../../utility/helpers";

const byName = (a, b) => a.fullName.localeCompare(b.fullName);

/**
 * The friends who can be challenged right now: online (per the server's own
 * presence tracker), not blocked. Kept current by the same presence events the
 * Tic-Tac-Toe lobby uses — a friend coming online appears, one going offline
 * disappears, with no polling. (After a reconnect events may have been missed,
 * so it re-fetches.)
 */
export default function useOnlineFriends() {
  const friends = useResource("/games/challenges/friends/online");

  useRealtime("ticTacToe:presence", (event) => {
    const { userId, isOnline, user } = event.detail || {};
    if (!userId) return;
    friends.setData((current) => {
      const list = current || [];
      if (!isOnline) return list.filter((item) => item.id !== userId);
      if (!user || list.some((item) => item.id === userId)) return list;
      return [...list, user].sort(byName);
    });
  });
  useRealtime("realtime:connected", friends.reload);

  return friends;
}
