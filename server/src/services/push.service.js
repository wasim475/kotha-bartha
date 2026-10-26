const firebaseAdmin = require("firebase-admin");
const { getMessaging: getFirebaseMessaging } = require("firebase-admin/messaging");
const User = require("../models/User");
const Message = require("../models/Message");

const FCM_CONCURRENCY = 20;

function messagePushRecipients(conversation, senderId) {
  const sender = String(senderId);
  return [...new Set((conversation.participantIds || []).map(String).filter((id) => id !== sender))];
}

function safeFirebaseErrorCode(error) {
  return typeof error?.code === "string" && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(error.code)
    ? error.code
    : undefined;
}

function safeErrorDetails(error, stage, substage) {
  const name = typeof error?.name === "string" && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(error.name) ? error.name : "Error";
  const details = { stage, errorClass: name };
  if (typeof substage === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(substage)) details.substage = substage;
  const firebaseCode = safeFirebaseErrorCode(error);
  if (firebaseCode) details.firebaseCode = firebaseCode;
  if (typeof error?.code === "number" && Number.isFinite(error.code)) details.databaseCode = error.code;
  return details;
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
  let initializationSubstage = "firebase-admin-factory";

  async function getMessaging(projectId) {
    if (!messagingPromise) {
      initializationSubstage = "firebase-admin-factory";
      messagingPromise = Promise.resolve().then(() => messagingFactory(
        firebaseAdmin,
        projectId,
        env.FCM_SERVICE_ACCOUNT_JSON,
        { onStage: (substage) => { initializationSubstage = substage; } },
      ));
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
    let stage = "firebase-initialization";
    try {
      const messaging = await getMessaging(projectId);
      stage = "recipient-lookup";
      recipients = await userModel.find({ _id: { $in: [...new Set(recipientIds.map(String))] } })
        .select("+pushDevices")
        .lean();
      stage = "device-lookup";
      const devices = recipients.flatMap((recipient) =>
        (recipient.pushDevices || []).map((device) => ({ recipient, device })),
      );
      if (devices.length === 0) {
        logger.warn?.("FCM push skipped: no registered recipient devices", {
          recipientCount: recipients.length,
        });
        return;
      }

      const totals = { sent: 0, failed: 0, deduplicated: 0, missingToken: 0 };
      for (let offset = 0; offset < devices.length; offset += FCM_CONCURRENCY) {
        const outcomes = await Promise.all(devices.slice(offset, offset + FCM_CONCURRENCY).map(({ recipient, device }) =>
          deliverToDevice(messaging, data, messageId, recipient, device),
        ));
        for (const outcome of outcomes) totals[outcome] += 1;
      }
      logger.info?.("FCM push attempt completed", {
        recipientCount: recipients.length,
        deviceCount: devices.length,
        sentCount: totals.sent,
        failedCount: totals.failed,
        deduplicatedCount: totals.deduplicated,
        missingTokenCount: totals.missingToken,
      });
    } catch (error) {
      logger.error("FCM push initialization or lookup failed", {
        ...safeErrorDetails(error, stage, stage === "firebase-initialization" ? initializationSubstage : undefined),
      });
    }
  }

  async function deliverToDevice(messaging, data, messageId, recipient, device) {
    if (typeof device.token !== "string" || device.token.length === 0) return "missingToken";
    if (messageId) {
      try {
        if (!(await claimMessagePushAttempt(messageId, device.installationId))) return "deduplicated";
      } catch (error) {
        logger.error("FCM push deduplication failed", safeErrorDetails(error, "deduplication-claim"));
        return "failed";
      }
    }
    try {
      await messaging.send({
        token: device.token,
        data,
        android: { priority: "high", ttl: 86400000 },
      });
      return "sent";
    } catch (error) {
      const code = safeFirebaseErrorCode(error);
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
          logger.error("invalid FCM token cleanup failed", {
            ...safeErrorDetails(cleanupError, "token-cleanup"),
          });
        }
      }
      logger.error("FCM push delivery failed", {
        ...safeErrorDetails(error, "send"),
        invalidToken,
      });
      return "failed";
    }
  }

  return {
    sendDataPush,
    sendNewMessagePush: ({ recipientIds, conversationId, messageId }) =>
      sendDataPush(recipientIds, messagePushData({ conversationId, messageId }), String(messageId)),
    claimMessagePushAttempt,
  };
}

function createAdminMessaging(admin, projectId, serviceAccountJson, {
  onStage = () => {},
  messagingGetter = getFirebaseMessaging,
} = {}) {
  const name = `kotha-barta-${projectId}`;
  onStage("app-lookup");
  const existingApp = admin.getApps().find(
    (app) => app.name === name || app.options?.projectId === projectId,
  );
  if (existingApp) {
    onStage("messaging-service");
    return messagingGetter(existingApp);
  }

  let credential;
  if (serviceAccountJson) {
    onStage("service-account-json-parse");
    const serviceAccount = JSON.parse(serviceAccountJson);
    onStage("service-account-credential");
    credential = admin.cert(serviceAccount);
  } else {
    onStage("application-default-credential");
    credential = admin.applicationDefault();
  }
  onStage("app-initialization");
  const app = admin.initializeApp({ credential, projectId }, name);
  onStage("messaging-service");
  return messagingGetter(app);
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
  safeFirebaseErrorCode,
  safeErrorDetails,
  claimMessagePushAttempt,
  incomingCallPushData,
  notificationPushData,
};
