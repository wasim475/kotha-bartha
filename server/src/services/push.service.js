const firebaseAdmin = require("firebase-admin");
const User = require("../models/User");
const Message = require("../models/Message");

const FCM_CONCURRENCY = 20;

function messagePushRecipients(conversation, senderId) {
  const sender = String(senderId);
  return [...new Set((conversation.participantIds || []).map(String).filter((id) => id !== sender))];
}

function createPushDispatcher({
  userModel = User,
  messageModel = Message,
  messagingFactory = createAdminMessaging,
  env = process.env,
  logger = console,
} = {}) {
  let missingConfigurationLogged = false;
  let messagingPromise = null;

  async function getMessaging(projectId) {
    if (!messagingPromise) {
      messagingPromise = Promise.resolve().then(() =>
        messagingFactory(firebaseAdmin, projectId, env.FCM_SERVICE_ACCOUNT_JSON),
      );
    }
    try {
      return await messagingPromise;
    } catch (error) {
      messagingPromise = null;
      throw error;
    }
  }

  async function claimMessagePushAttempt(messageId, installationId) {
    const result = await messageModel.updateOne(
      { _id: messageId, pushAttemptedInstallationIds: { $ne: installationId } },
      { $addToSet: { pushAttemptedInstallationIds: installationId } },
    );
    return result.modifiedCount === 1;
  }

  async function sendDataPush(recipientIds, data, messageId = null) {
    const projectId = env.FCM_PROJECT_ID;
    if (!projectId) {
      if (!missingConfigurationLogged) {
        logger.error("FCM push delivery is disabled: FCM_PROJECT_ID is not configured");
        missingConfigurationLogged = true;
      }
      return;
    }

    let recipients;
    try {
      const messaging = await getMessaging(projectId);
      recipients = await userModel.find({ _id: { $in: [...new Set(recipientIds.map(String))] } })
        .select("+pushDevices")
        .lean();
      const devices = recipients.flatMap((recipient) =>
        (recipient.pushDevices || []).map((device) => ({ recipient, device })),
      );
      for (let offset = 0; offset < devices.length; offset += FCM_CONCURRENCY) {
        await Promise.all(devices.slice(offset, offset + FCM_CONCURRENCY).map(({ recipient, device }) =>
          deliverToDevice(messaging, data, messageId, recipient, device),
        ));
      }
    } catch (error) {
      logger.error("message push initialization failed", { error: error.name || "Error" });
    }
  }

  async function deliverToDevice(messaging, data, messageId, recipient, device) {
    if (messageId) {
      try {
        if (!(await claimMessagePushAttempt(messageId, device.installationId))) return;
      } catch (error) {
        logger.error("message push deduplication failed", { error: error.name || "Error" });
        return;
      }
    }
    try {
      await messaging.send({
        token: device.token,
        data,
        android: { priority: "high", ttl: 86400000 },
      });
    } catch (error) {
      const code = error.code || "unknown";
      const invalidToken = [
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
      ].includes(code);
      if (invalidToken) {
        try {
          await userModel.updateOne(
            { _id: recipient._id },
            { $pull: { pushDevices: { installationId: device.installationId, token: device.token } } },
          );
        } catch (cleanupError) {
          logger.error("invalid push token cleanup failed", { error: cleanupError.name || "Error" });
        }
      }
      logger.error("message push delivery failed", {
        code,
        invalidToken,
      });
    }
  }

  return {
    sendDataPush,
    sendNewMessagePush: ({ recipientIds, conversationId, messageId }) =>
      sendDataPush(recipientIds, messagePushData({ conversationId, messageId }), String(messageId)),
    claimMessagePushAttempt,
  };
}

function createAdminMessaging(admin, projectId, serviceAccountJson) {
  const name = `kotha-barta-${projectId}`;
  const existingApp = admin.apps.find((app) => app.name === name);
  if (existingApp) return admin.messaging(existingApp);

  const credential = serviceAccountJson
    ? admin.credential.cert(JSON.parse(serviceAccountJson))
    : admin.credential.applicationDefault();
  const app = admin.initializeApp({ credential, projectId }, name);
  return admin.messaging(app);
}

const { sendDataPush, sendNewMessagePush, claimMessagePushAttempt } = createPushDispatcher();

const messagePushData = ({ conversationId, messageId }) => ({
  type: "message",
  notificationId: String(messageId),
  conversationId: String(conversationId),
  messageId: String(messageId),
  title: "KothaX",
  body: "New message",
});

function notificationPushData(notification) {
  const payload = notification.payload || {};
  const reactionLabels = { like: "Like", love: "Love", haha: "Haha", sad: "Sad", angry: "Angry" };
  const body = payload.preview || (payload.reactionType
    ? `${payload.message || "Reacted"} · ${reactionLabels[payload.reactionType] || "Reaction"}`
    : payload.message) || "You have a new notification.";
  const data = {
    notificationId: String(notification._id || notification.id || ""),
    type: String(notification.type || "notification"),
    title: String(payload.title || notification.actorName || "KothaX"),
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

module.exports = {
  sendNewMessagePush,
  sendIncomingCallPush,
  sendNotificationPush,
  sendDataPush,
  createPushDispatcher,
  createAdminMessaging,
  messagePushData,
  messagePushRecipients,
  claimMessagePushAttempt,
  incomingCallPushData,
  notificationPushData,
};
