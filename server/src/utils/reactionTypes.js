// Canonical reaction vocabulary shared by posts, comments and replies —
// mirrors client/src/components/ui/reactions/reactionTypes.js. Single
// source of truth so the Reaction model enum and every reaction route
// whitelist can't drift apart.
const REACTION_TYPES = ["like", "love", "haha", "sad", "angry"];

module.exports = { REACTION_TYPES };
