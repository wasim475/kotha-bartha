import { REACTION_TYPES } from "./reactionTypes";

/**
 * Messages store reactions as a raw emoji string (`{ userId, emoji }`),
 * not a canonical `type` like posts/comments — the message reaction API
 * still needs to accept literally any emoji from the full picker. This
 * maps the shared five canonical types to/from the specific emoji
 * character used for each, so the message quick-reaction bar can render
 * with the same `ReactionIcon` SVGs (and therefore the same size) as
 * everywhere else, while still writing a plain emoji string the existing
 * message reaction endpoint already understands.
 */
export const REACTION_TYPE_TO_EMOJI = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  sad: "😢",
  angry: "😡",
};

export const EMOJI_TO_REACTION_TYPE = Object.fromEntries(
  REACTION_TYPES.map((type) => [REACTION_TYPE_TO_EMOJI[type], type]),
);
