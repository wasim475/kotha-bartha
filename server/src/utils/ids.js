function idsFor(userId, targetId) {
  return [userId.toString(), targetId.toString()].sort();
}

function pairKey(userId, targetId) {
  return idsFor(userId, targetId).join(":");
}

module.exports = { idsFor, pairKey };
