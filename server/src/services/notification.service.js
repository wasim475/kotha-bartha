const Notification = require("../models/Notification");
const { safeUser } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");

async function createNotification(
  req,
  {
    recipientId,
    actorId,
    type,
    entityType,
    entityId,
    postId,
    commentId,
    replyId,
    payload,
    uniqueEventId,
  },
) {
  const notification = await Notification.findOneAndUpdate(
    { uniqueEventId },
    {
      $set: {
        recipientId,
        actorId,
        type,
        entityType,
        entityId,
        postId: postId || null,
        commentId: commentId || null,
        replyId: replyId || null,
        payload,
        readAt: null,
      },
      $setOnInsert: { uniqueEventId },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await notification.populate("actorId");

  const data = {
    id: notification._id.toString(),
    type: notification.type,
    read: false,
    createdAt: notification.createdAt,
    actor: notification.actorId ? safeUser(notification.actorId) : null,
    payload: notification.payload,
    postId: notification.postId ? notification.postId.toString() : null,
    commentId: notification.commentId ? notification.commentId.toString() : null,
    replyId: notification.replyId ? notification.replyId.toString() : null,
  };

  emitToUser(req, recipientId, "notification:new", data);

  return data;
}

module.exports = { createNotification };
