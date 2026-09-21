// In-memory online-presence tracker, keyed by userId, counting active
// socket connections (a user can have several tabs/devices open at once —
// they only go "offline" once the last one disconnects).
const onlineUsers = new Map();

function addConnection(userId) {
  const id = userId.toString();
  const next = (onlineUsers.get(id) || 0) + 1;
  onlineUsers.set(id, next);
  return next === 1;
}

function removeConnection(userId) {
  const id = userId.toString();
  const next = (onlineUsers.get(id) || 1) - 1;
  if (next <= 0) {
    onlineUsers.delete(id);
    return true;
  }
  onlineUsers.set(id, next);
  return false;
}

function isOnline(userId) {
  return onlineUsers.has(userId?.toString());
}

module.exports = { addConnection, removeConnection, isOnline };
