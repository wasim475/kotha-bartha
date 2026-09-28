// "Add People" foundation (see server/src/models/Call.js's own comment): the
// call itself stays strictly 1-to-1 media, but the invitation UI/authorization
// is real. Needs a Chrome/Chromium + playwright-core (npm i --no-save
// playwright-core), the API on CALL_API and the client dev server on CALL_APP
// — same convention as browser.integration.js.
const path = require("path");
const sr = path.join(__dirname, "..", "..");
require(path.join(sr, "node_modules", "dotenv")).config({ path: path.join(sr, ".env"), quiet: true });
const mongoose = require(path.join(sr, "node_modules", "mongoose"));
const jwt = require(path.join(sr, "node_modules", "jsonwebtoken"));
const M = (n) => require(path.join(sr, "src", "models", n));
const User = M("User"), Friendship = M("Friendship"), Call = M("Call"), Conversation = M("Conversation"), Message = M("Message");
const { pairKey } = require(path.join(sr, "src", "utils", "ids"));
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright-core");

const APP = process.env.CALL_APP || "http://localhost:5174";
let failures = 0;
const check = (n, ok, d = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d !== "" ? "  " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch { /* poll */ } await sleep(150); } return false; };

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const tag = `zzaddppl${Date.now()}`;
  const A = await User.create({ fullName: "ZZ ADD A", email: `${tag}-a@example.invalid`, passwordHash: "x", role: "user" });
  const B = await User.create({ fullName: "ZZ ADD B", email: `${tag}-b@example.invalid`, passwordHash: "x", role: "user" });
  const C = await User.create({ fullName: "ZZ ADD C", email: `${tag}-c@example.invalid`, passwordHash: "x", role: "user" });
  await Friendship.create({ userIds: [A._id, B._id], pairKey: pairKey(A._id, B._id) });
  await Friendship.create({ userIds: [A._id, C._id], pairKey: pairKey(A._id, C._id) });
  const tok = (u) => jwt.sign({ sub: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: "30m" });

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });

  let conv = null;
  const allUsers = [A, B, C];
  try {
    conv = await Conversation.findOneAndUpdate(
      { pairKey: pairKey(A._id, B._id) },
      { $setOnInsert: { participantIds: [A._id, B._id], pairKey: pairKey(A._id, B._id) } },
      { new: true, upsert: true },
    );

    const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
    const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
    await ctxA.addCookies([{ name: "kotha_token", value: tok(A), domain: "localhost", path: "/" }]);
    await ctxB.addCookies([{ name: "kotha_token", value: tok(B), domain: "localhost", path: "/" }]);
    await ctxC.addCookies([{ name: "kotha_token", value: tok(C), domain: "localhost", path: "/" }]);
    const pA = await ctxA.newPage();
    const pB = await ctxB.newPage();
    const pC = await ctxC.newPage();
    await pA.goto(`${APP}/app/messages/${conv._id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pB.goto(`${APP}/app/feed`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pC.goto(`${APP}/app/friends`, { waitUntil: "domcontentloaded", timeout: 60000 }); // C is on an unrelated page — the popup must still reach them
    await sleep(2500);

    const videoBtn = pA.getByLabel("Start video call");
    await until(() => videoBtn.isEnabled(), 20000);
    await videoBtn.click();
    await pB.getByTestId("call-accept").click();
    await until(async () => {
      const doc = await Call.findOne({ callerId: A._id, calleeId: B._id }).sort({ createdAt: -1 }).lean();
      return doc?.status === "connected" ? doc : false;
    }, 20000);

    await pA.getByTestId("participant-panel-toggle").click();
    check("the participant panel opens and lists both real participants", await until(() => pA.getByText("ZZ ADD B", { exact: false }).first().isVisible().catch(() => false)));
    await pA.getByTestId("add-people-open").click();

    check("Add People shows C, an online eligible friend", await until(() => pA.getByText("ZZ ADD C", { exact: false }).first().isVisible().catch(() => false)));
    // Scoped to the actual "Invite"/"Sent" button (data-testid), not a <li>
    // text match — the participant panel behind this one also lists C once
    // invited (its own "Invited" status row), which a text-based match would
    // ambiguously hit first.
    const inviteBtn = pA.getByTestId("add-people-invite").first();
    await inviteBtn.click();
    check("the invite button changes to 'Sent' once it succeeds", await until(() => inviteBtn.innerText().then((text) => text.includes("Sent")).catch(() => false)));

    check("C sees the global 'invited to join a call' popup while on Friends, not Messages", await until(() => pC.getByTestId("participant-invite").isVisible().catch(() => false)));
    await pC.getByTestId("participant-invite-accept").click();
    check("accepting shows an honest 'not available yet' notice rather than pretending to connect C", await until(() => pC.getByText(/Group calling isn.t available yet/).isVisible().catch(() => false)));
    check("C's own call screen never opens — the call stays strictly 1-to-1 media", !(await pC.getByTestId("call-screen").isVisible().catch(() => false)));

    const callDoc = await Call.findOne({ callerId: A._id, calleeId: B._id }).sort({ createdAt: -1 }).lean();
    check("the call's real caller/callee are untouched by the accepted invite", String(callDoc.callerId) === String(A._id) && String(callDoc.calleeId) === String(B._id));
    check("the invite is recorded as accepted server-side", callDoc.participantInvites?.[0]?.status === "accepted");

    await pA.getByTestId("call-end").click().catch(() => {});
    console.log(`\n${failures} failing check(s).`);
  } catch (error) {
    console.error("Browser test crashed:", error);
    failures++;
  } finally {
    await Call.deleteMany({ $or: [{ callerId: A._id }, { calleeId: A._id }] }).catch(() => {});
    if (conv) await Message.deleteMany({ conversationId: conv._id }).catch(() => {});
    await Conversation.deleteMany({ pairKey: pairKey(A._id, B._id) }).catch(() => {});
    await Friendship.deleteMany({ userIds: { $in: allUsers.map((u) => u._id) } }).catch(() => {});
    await User.deleteMany({ _id: { $in: allUsers.map((u) => u._id) } }).catch(() => {});
    await browser.close();
    await mongoose.disconnect();
  }
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
