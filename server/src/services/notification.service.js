const Notification = require("../models/Notification");
const { safeUser } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");
const { sendNotificationPush } = require("./push.service");
const { isBlockedEitherWay } = require("../utils/blocks");

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
  const writeResult = await Notification.findOneAndUpdate(
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
    { new: true, upsert: true, setDefaultsOnInsert: true, includeResultMetadata: true },
  );
  const notification = writeResult.value || writeResult;
  const isNew = Boolean(writeResult.lastErrorObject?.upserted);

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
  // Data-only FCM lets Android render across app states without Firebase auto-display duplicates.
  if (isNew && (!actorId || !(await isBlockedEitherWay(actorId, recipientId)))) {
    void sendNotificationPush(recipientId, {
      ...data,
      actorName: data.actor?.fullName,
    }).catch(() => console.error("notification push dispatch failed"));
  }

  return data;
}

module.exports = { createNotification };
