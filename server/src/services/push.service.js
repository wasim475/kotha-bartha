const { GoogleAuth } = require("google-auth-library");
const User = require("../models/User");

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

async function sendDataPush(recipientIds, data) {
  const projectId = process.env.FCM_PROJECT_ID;
  if (!projectId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const auth = new GoogleAuth({ scopes: [FCM_SCOPE] });
  const client = await auth.getClient();
  const recipients = await User.find({ _id: { $in: recipientIds } }).select("+pushDevices").lean();
  for (const recipient of recipients) {
    for (const device of recipient.pushDevices || []) {
      try {
        await client.request({
          url: `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
          method: "POST",
          data: {
            message: {
              token: device.token,
              data,
              android: { priority: "high", ttl: "86400s" },
            },
          },
        });
      } catch (error) {
        const status = error.response?.status;
        const details = error.response?.data?.error?.details || [];
        const invalidToken = status === 404 || details.some((detail) => detail.errorCode === "UNREGISTERED");
        if (invalidToken) {
          await User.updateOne(
            { _id: recipient._id },
            { $pull: { pushDevices: { token: device.token } } },
          );
        }
        // Never log FCM tokens, message bodies, or response payloads.
        console.error("message push delivery failed", { status: Number.isInteger(status) ? status : "network" });
      }
    }
  }
}

/** Message previews are passed only after the caller has applied encryption/privacy rules. */
const messagePushData = ({ senderName, conversationId, messageId, preview }) => ({
  type: "message",
  notificationId: String(messageId),
  conversationId: String(conversationId),
  messageId: String(messageId),
  title: senderName || "New message",
  body: String(preview || "You have a new message.").slice(0, 160),
});

const sendNewMessagePush = ({ recipientIds, ...details }) => sendDataPush(recipientIds, messagePushData(details));

function notificationPushData(notification) {
  const payload = notification.payload || {};
  const reactionLabels = { like: "Like", love: "Love", haha: "Haha", sad: "Sad", angry: "Angry" };
  const body = payload.preview || (payload.reactionType
    ? `${payload.message || "Reacted"} · ${reactionLabels[payload.reactionType] || "Reaction"}`
    : payload.message) || "You have a new notification.";
  const data = {
    notificationId: String(notification._id || notification.id || ""),
    type: String(notification.type || "notification"),
    title: String(payload.title || notification.actorName || "Kotha-Barta"),
    body: String(body),
  };
  for (const key of ["postId", "commentId", "replyId"]) {
    if (notification[key]) data[key] = String(notification[key]);
  }
  if (payload.reactionType) data.reactionType = String(payload.reactionType);
  if (payload.conversationId) data.conversationId = String(payload.conversationId);
  if (payload.messageId) data.messageId = String(payload.messageId);
  return data;
}

const sendNotificationPush = (recipientId, notification) =>
  sendDataPush([recipientId], notificationPushData(notification));

const incomingCallPushData = ({ callerName, callId, conversationId, video }) => ({
  type: "call",
  callId: String(callId),
  conversationId: String(conversationId),
  video: video ? "true" : "false",
  title: callerName || "Incoming call",
  body: `Incoming ${video ? "video" : "audio"} call`,
});

const sendIncomingCallPush = ({ recipientId, ...details }) => sendDataPush([recipientId], incomingCallPushData(details));

module.exports = { sendNewMessagePush, sendIncomingCallPush, sendNotificationPush, messagePushData, incomingCallPushData, notificationPushData };
