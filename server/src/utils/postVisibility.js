const Friendship = require("../models/Friendship");
const { isBlockedEitherWay } = require("./blocks");

/** Posts are visible to their author and current friends, unless either user blocked the other. */
async function canViewPost(viewerId, authorId) {
  const viewer = viewerId.toString();
  const author = authorId.toString();
  if (viewer === author) return true;

  const [friendship, blocked] = await Promise.all([
    Friendship.exists({ userIds: { $all: [viewerId, authorId] } }),
    isBlockedEitherWay(viewerId, authorId),
  ]);
  return Boolean(friendship) && !blocked;
}

module.exports = { canViewPost };
