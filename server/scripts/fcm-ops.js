const fs = require("node:fs");
const firebaseAdmin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");
const { createAdminMessaging } = require("../src/services/push.service");

const EXPECTED_PROJECT_ID = "kothax-14bd0";
const TEST_NOTIFICATION = Object.freeze({
  title: "KothaX test notification",
  body: "FCM test message.",
});

function inspectCredentialFile(env = process.env, readFile = fs.readFileSync) {
  const projectId = env.FCM_PROJECT_ID;
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error("FCM_PROJECT_ID must be configured as the expected Firebase project.");
  }

  const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not configured.");
  }

  let credentials;
  try {
    credentials = JSON.parse(readFile(credentialsPath, "utf8"));
  } catch {
    throw new Error("The configured Firebase credential file is missing or is not valid JSON.");
  }

  if (credentials.type !== "service_account" || !credentials.project_id) {
    throw new Error("The configured Firebase credential file is missing required service-account fields.");
  }
  if (credentials.project_id !== projectId) {
    throw new Error("Firebase credential project_id does not match FCM_PROJECT_ID.");
  }

  return { projectId };
}

function initializeMessaging(admin, projectId) {
  const before = admin.apps.length;
  const messaging = createAdminMessaging(admin, projectId, null);
  const after = admin.apps.length;
  const app = admin.apps.find(
    (candidate) => candidate.name === `kotha-barta-${projectId}` || candidate.options?.projectId === projectId,
  );
  if (!app || after > before + 1) {
    throw new Error("Firebase Admin initialization did not resolve to one project app.");
  }

  createAdminMessaging(admin, projectId, null);
  if (admin.apps.length !== after) {
    throw new Error("Firebase Admin initialization created a duplicate app.");
  }

  return messaging;
}

async function authenticateApplicationDefaultCredentials(projectId, GoogleAuthClient = GoogleAuth) {
  const auth = new GoogleAuthClient({
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  if (!access?.token) {
    throw new Error(`Could not authenticate Application Default Credentials for ${projectId}.`);
  }
  return { authenticated: true, projectId };
}

async function sendTestNotification(messaging, token) {
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new Error("FCM_TEST_TOKEN must contain one registered device token.");
  }
  try {
    return await messaging.send({
      token,
      notification: TEST_NOTIFICATION,
      android: { priority: "normal" },
    });
  } catch (error) {
    const safeError = new Error("FCM test notification failed.");
    if (typeof error.code === "string" && /^[a-z0-9/-]+$/.test(error.code)) {
      safeError.code = error.code;
    }
    throw safeError;
  }
}

async function main(args = process.argv.slice(2), env = process.env) {
  const send = args.length === 1 && args[0] === "--send";
  if (args.length > (send ? 1 : 0)) {
    throw new Error("Usage: node scripts/fcm-ops.js [--send]");
  }

  const { projectId } = inspectCredentialFile(env);
  try {
    await authenticateApplicationDefaultCredentials(projectId);
  } catch {
    throw new Error("Application Default Credentials could not obtain a Firebase Messaging access token.");
  }
  let messaging;
  try {
    messaging = initializeMessaging(firebaseAdmin, projectId);
  } catch {
    throw new Error("Firebase Admin app initialization failed.");
  }
  console.log(`Firebase Admin initialized for ${projectId}; credential file is readable and valid JSON.`);
  console.log("Application Default Credentials are selected; no notification was sent.");

  if (send) {
    const messageId = await sendTestNotification(messaging, env.FCM_TEST_TOKEN);
    console.log(`FCM accepted the one-device test message (message ID: ${messageId}).`);
  }
}

if (require.main === module) {
  if (process.env.RENDER !== "true") require("dotenv").config();
  main().catch((error) => {
    console.error(error.message || "FCM operation failed.");
    if (process.argv.includes("--send") && error.code) {
      console.error(`Firebase error code: ${error.code}`);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_PROJECT_ID,
  inspectCredentialFile,
  initializeMessaging,
  authenticateApplicationDefaultCredentials,
  sendTestNotification,
};
