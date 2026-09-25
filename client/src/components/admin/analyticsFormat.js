// Shared by the analytics screen and a user's activity tab.

export const PAGE_LABEL = {
  feed: "Feed",
  messages: "Messages",
  friends: "Friends",
  notifications: "Notifications",
  profile: "Profile",
  post: "Single post",
  "study/blogs": "Study · Blogs",
  "study/quiz": "Study · Quiz",
  "study/class-study": "Study · Class Study",
  "study/games": "Study · Games",
  "study/leaderboard": "Study · Leaderboard",
  "study/other": "Study · Other",
  admin: "Admin Panel",
  auth: "Login / Sign up",
  other: "Other",
};

export const pageLabel = (page) => PAGE_LABEL[page] || page;

/** 45 -> "45s", 252 -> "4m 12s", 67320 -> "18h 42m". Null (no measured visits) -> "—". */
export function formatDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || Number.isNaN(totalSeconds)) return "—";
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}
