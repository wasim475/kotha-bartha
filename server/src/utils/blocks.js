const Block = require("../models/Block");

// A block's effect is mutual even though the underlying record is
// directional: if A blocked B, neither side can friend-request or message
// the other. Every route that gates on "is this pair blocked" should go
// through this helper rather than querying one direction only.
async function isBlockedEitherWay(userIdA, userIdB) {
  const exists = await Block.exists({
    $or: [
      { blockerId: userIdA, blockedId: userIdB },
      { blockerId: userIdB, blockedId: userIdA },
    ],
  });
  return Boolean(exists);
}

// The set of every user id involved in a block with `userId`, in either
// direction (excluding `userId` itself) — for excluding blocked pairs from
// listings/search in one query instead of one lookup per candidate.
async function blockedPairIds(userId) {
  const blocks = await Block.find({
    $or: [{ blockerId: userId }, { blockedId: userId }],
  })
    .select("blockerId blockedId")
    .lean();

  const ids = new Set();
  blocks.forEach((block) => {
    ids.add(block.blockerId.toString());
    ids.add(block.blockedId.toString());
  });
  ids.delete(userId.toString());
  return ids;
}

module.exports = { isBlockedEitherWay, blockedPairIds };
