/**
 * Canonical reaction vocabulary shared by posts, comments and replies.
 * Backend alignment (Phase 3/7): the Reaction model enum and the
 * post/comment reaction route whitelists will be updated to match this
 * exact list so every surface in the app offers the same five reactions.
 */
export const REACTION_TYPES = ["like", "love", "haha", "sad", "angry"];

export const REACTION_LABELS = {
  like: "Like",
  love: "Love",
  haha: "Haha",
  sad: "Sad",
  angry: "Angry",
};
