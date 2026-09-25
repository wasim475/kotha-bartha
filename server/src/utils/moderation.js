// The ONE place that decides what a banned or muted account may do. Routes never
// look at `user.accountStatus` or `user.isMuted` themselves: they name the action
// (`requireAction("CREATE_POST")`) and this file answers. Changing the policy —
// what a mute blocks, say — is a one-line edit here.
//
//   ban  -> the user can still sign in and browse, but cannot do anything that
//           changes state or reaches other people.
//   mute -> the user can browse and react, but cannot publish or contact people.

const ACTIONS = Object.freeze({
  CREATE_POST: "CREATE_POST", // new posts, stories and notes
  EDIT_POST: "EDIT_POST", // editing their own posts / comments
  COMMENT: "COMMENT",
  REPLY: "REPLY",
  REACT: "REACT", // likes and reactions on posts, comments, stories, messages
  FRIEND_REQUEST: "FRIEND_REQUEST", // sending or accepting friend requests
  SEND_MESSAGE: "SEND_MESSAGE",
  QUIZ_PLAY: "QUIZ_PLAY",
  GAME_PLAY: "GAME_PLAY", // single-player games, Tic-Tac-Toe and friend challenges
  UPLOAD: "UPLOAD", // photos and files
  EDIT_PROFILE: "EDIT_PROFILE",
});

const ALL_ACTIONS = Object.values(ACTIONS);

const DEFAULT_MUTE_BLOCKS = [
  ACTIONS.CREATE_POST,
  ACTIONS.EDIT_POST,
  ACTIONS.COMMENT,
  ACTIONS.REPLY,
  ACTIONS.SEND_MESSAGE,
  ACTIONS.FRIEND_REQUEST,
  ACTIONS.GAME_PLAY,
];

// Configurable without a code change: MODERATION_MUTE_BLOCKS="CREATE_POST,COMMENT,..."
const fromEnv = (value, fallback) => {
  if (!value) return fallback;
  const list = value.split(",").map((item) => item.trim()).filter((item) => ALL_ACTIONS.includes(item));
  return list.length ? list : fallback;
};

const POLICY = Object.freeze({
  banned: Object.freeze(fromEnv(process.env.MODERATION_BAN_BLOCKS, ALL_ACTIONS)),
  muted: Object.freeze(fromEnv(process.env.MODERATION_MUTE_BLOCKS, DEFAULT_MUTE_BLOCKS)),
});

const MESSAGES = {
  banned: "Your account is currently restricted.",
  muted: "Your account is currently muted, so you can't do this right now.",
};

// null if allowed, otherwise { code, message, reason: "banned" | "muted" }.
function restrictionFor(user, action) {
  if (!user) return null;
  if (user.accountStatus === "banned" && POLICY.banned.includes(action)) {
    return { code: "ACCOUNT_RESTRICTED", message: MESSAGES.banned, reason: "banned" };
  }
  if (user.isMuted && POLICY.muted.includes(action)) {
    return { code: "ACCOUNT_MUTED", message: MESSAGES.muted, reason: "muted" };
  }
  return null;
}

const canUserPerformAction = (user, action) => restrictionFor(user, action) === null;

const respondRestricted = (res, restriction) =>
  res.status(403).json({ error: { code: restriction.code, message: restriction.message } });

// Express middleware: `requireAction("CREATE_POST")`, or a function of the request
// for routes where the action depends on the body (a comment vs. a reply).
// Runs after requireAuth, which loads `req.user` fresh from the database on every
// request, so the state checked here is never something the client supplied.
function requireAction(actionOrPicker) {
  return (req, res, next) => {
    const action = typeof actionOrPicker === "function" ? actionOrPicker(req) : actionOrPicker;
    const restriction = restrictionFor(req.user, action);
    if (restriction) return respondRestricted(res, restriction);
    next();
  };
}

// For Socket.IO handlers, which only have a user id: loads the account and throws
// an error shaped like the game services' GameError.
async function assertUserCan(userId, action) {
  const User = require("../models/User");
  const { GameError } = require("../services/games/GameError");
  const user = await User.findById(userId).select("accountStatus isMuted");
  if (!user || user.accountStatus === "deleted") throw new GameError(401, "UNAUTHENTICATED", "Please log in again.");
  const restriction = restrictionFor(user, action);
  if (restriction) throw new GameError(403, restriction.code, restriction.message);
}

// User-generated content (posts, comments, replies) that ordinary views must not
// show. Documents from before moderation existed have no field at all, which
// `$nin` correctly treats as visible.
const HIDDEN_STATUSES = ["hidden_by_ban", "deleted"];
const VISIBLE_CONTENT = Object.freeze({ moderationStatus: { $nin: HIDDEN_STATUSES } });

module.exports = {
  ACTIONS,
  POLICY,
  restrictionFor,
  canUserPerformAction,
  requireAction,
  assertUserCan,
  VISIBLE_CONTENT,
  HIDDEN_STATUSES,
};
