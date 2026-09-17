const Notification = require("../models/Notification");
const { safeUser } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");

async function createNotification(
  req,
  { recipientId, actorId, type, entityType, entityId, payload, uniqueEventId },
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
  };

  emitToUser(req, recipientId, "notification:new", data);

  return data;
}

module.exports = { createNotification };
