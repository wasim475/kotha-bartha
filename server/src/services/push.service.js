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

/** The message body is intentionally omitted for plaintext and E2E-encrypted messages alike. */
const messagePushData = ({ senderName, conversationId, messageId }) => ({
  type: "message",
  conversationId: String(conversationId),
  messageId: String(messageId),
  title: senderName || "New message",
  body: "You have a new message.",
});

const sendNewMessagePush = ({ recipientIds, ...details }) => sendDataPush(recipientIds, messagePushData(details));

const incomingCallPushData = ({ callerName, callId, conversationId, video }) => ({
  type: "call",
  callId: String(callId),
  conversationId: String(conversationId),
  video: video ? "true" : "false",
  title: callerName || "Incoming call",
  body: `Incoming ${video ? "video" : "audio"} call`,
});

const sendIncomingCallPush = ({ recipientId, ...details }) => sendDataPush([recipientId], incomingCallPushData(details));

module.exports = { sendNewMessagePush, sendIncomingCallPush, messagePushData, incomingCallPushData };
