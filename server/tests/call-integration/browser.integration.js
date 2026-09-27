// Drives the REAL Call UI with two browser contexts and real (fake-device)
// WebRTC media. Needs a Chrome/Chromium + playwright-core (npm i --no-save
// playwright-core), the API on CALL_API and the client dev server on
// CALL_APP (started with VITE_API_URL pointing at that API) — same
// convention as tests/ludo-integration/browser.integration.js.
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
  const tag = `zzcallui${Date.now()}`;
  const A = await User.create({ fullName: "ZZ CALL UI A", email: `${tag}-a@example.invalid`, passwordHash: "x", role: "user" });
  const B = await User.create({ fullName: "ZZ CALL UI B", email: `${tag}-b@example.invalid`, passwordHash: "x", role: "user" });
  await Friendship.create({ userIds: [A._id, B._id], pairKey: pairKey(A._id, B._id) });
  const tok = (u) => jwt.sign({ sub: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: "30m" });

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });

  const tid = (p, t) => p.locator(`[data-testid="${t}"]`);
  let conv = null;

  try {
    const ctxA = await browser.newContext({ viewport: { width: 420, height: 860 }, permissions: ["camera", "microphone"] });
    const ctxB = await browser.newContext({ viewport: { width: 420, height: 860 }, permissions: ["camera", "microphone"] });
    await ctxA.addCookies([{ name: "kotha_token", value: tok(A), domain: "localhost", path: "/" }]);
    await ctxB.addCookies([{ name: "kotha_token", value: tok(B), domain: "localhost", path: "/" }]);
    const pA = await ctxA.newPage();
    const pB = await ctxB.newPage();
    const goto2 = async (page, url) => {
      await page.goto(APP + url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(() => !document.body.innerText.includes("Preparing your space"), null, { timeout: 30000 }).catch(() => {});
    };

    conv = await Conversation.findOneAndUpdate(
      { pairKey: pairKey(A._id, B._id) },
      { $setOnInsert: { participantIds: [A._id, B._id], pairKey: pairKey(A._id, B._id) } },
      { new: true, upsert: true },
    );
    await goto2(pA, `/app/messages/${conv._id}`);
    await goto2(pB, "/app/feed"); // B is deliberately NOT on Messages — the popup must still reach them
    await sleep(2500); // let both sockets connect and register presence

    // ---- Golden path: video call, real WebRTC connect, mid-call features, clean end ----------
    const videoCallBtn = pA.getByLabel("Start video call");
    check("the video-call button becomes enabled once the conversation/presence load", await until(() => videoCallBtn.isEnabled(), 20000));
    await videoCallBtn.click();
    check("A starts a video call and sees the outgoing call screen", await until(() => tid(pA, "call-screen").isVisible().catch(() => false)));

    check("B sees the incoming-call popup while on Feed, not Messages", await until(() => tid(pB, "call-incoming").isVisible().catch(() => false)));
    const name = await tid(pB, "call-incoming-name").innerText().catch(() => "");
    check("the popup names the caller", name.includes("ZZ CALL UI A"), name);

    await tid(pB, "call-accept").click();
    check("B accepting opens the full call screen", await until(() => tid(pB, "call-screen").isVisible().catch(() => false)));

    const connected = await until(async () => {
      const doc = await Call.findOne({ callerId: A._id, calleeId: B._id }).sort({ createdAt: -1 }).lean();
      return doc?.status === "connected" ? doc : false;
    }, 20000);
    check("the call reaches 'connected' server-side (real WebRTC offer/answer/ICE succeeded)", Boolean(connected));

    // Real media readiness, not just DOM visibility — a connectionState of
    // "connected" only proves the transport is up, never that the <video>
    // element is actually decoding and rendering frames (see CallProvider's
    // attachVideo/remoteMediaReady). Check readyState/dimensions and that
    // currentTime is actually advancing.
    const mediaFlowing = async (page) => page.evaluate(async () => {
      const video = document.querySelector("video.call-video");
      if (!video) return false;
      if (video.readyState < 2 || video.paused || !video.videoWidth || !video.videoHeight) return false;
      const t0 = video.currentTime;
      await new Promise((r) => setTimeout(r, 400));
      return video.currentTime > t0;
    });
    check("A's remote video is actually decoding and playing frames", await until(() => mediaFlowing(pA), 15000));
    check("B's remote video is actually decoding and playing frames", await until(() => mediaFlowing(pB), 15000));
    check("A's loading/connecting indicator clears once real media is flowing", await until(async () => !(await pA.getByText("Connecting…").isVisible().catch(() => false)), 8000));

    const audioWired = async (page) => page.evaluate(() => {
      const video = document.querySelector("video.call-video");
      if (!video || !video.srcObject) return false;
      const audioTracks = video.srcObject.getAudioTracks();
      return !video.muted && audioTracks.length > 0 && audioTracks.every((track) => track.readyState === "live" && track.enabled);
    });
    check("A's remote element carries a live, unmuted, enabled remote audio track", await audioWired(pA));
    check("B's remote element carries a live, unmuted, enabled remote audio track", await audioWired(pB));

    await tid(pA, "call-mic").click();
    check("toggling the mic updates its own accessible label", (await tid(pA, "call-mic").getAttribute("aria-label")) === "Unmute microphone");
    await tid(pA, "call-mic").click();

    // Screen share regression: camera video must resume once sharing stops.
    await pA.getByLabel("Share your screen").click();
    check("B sees the screen-share indicator", await until(() => pB.getByText("is sharing their screen").isVisible().catch(() => false)));
    await pA.getByLabel("Stop sharing your screen").click();
    check("camera video still flows for B after screen share stops", await until(() => mediaFlowing(pB), 8000));

    await pA.getByLabel("Reactions").click();
    await pA.getByLabel("Fire").click();
    check("B sees A's floating reaction live", await until(() => pB.locator(".call-reaction-float").first().isVisible().catch(() => false)));

    await tid(pA, "call-chat-toggle").click();
    await tid(pA, "call-chat-panel").getByPlaceholder("Message…").fill("hello from the call");
    await tid(pA, "call-chat-panel").locator('button[type="submit"]').click();
    check("an in-call chat message is delivered through the normal conversation", await until(() => Message.findOne({ conversationId: conv._id, body: "hello from the call" }).lean()));
    await tid(pA, "call-chat-toggle").click(); // close it again — must not be covered by the chat panel itself

    await tid(pA, "call-minimize").click();
    check("minimizing shows the floating call bar", await until(() => tid(pA, "call-floating").isVisible().catch(() => false)));
    await tid(pA, "call-expand").click();
    check("expanding from the floating bar returns to the full call screen", await until(() => tid(pA, "call-screen").isVisible().catch(() => false)));

    await tid(pA, "call-end").click();
    check("ending the call closes it for the caller", await until(async () => !(await tid(pA, "call-screen").isVisible().catch(() => true))));
    check("...and for the other participant too", await until(async () => !(await tid(pB, "call-screen").isVisible().catch(() => true))));

    const ended = await Call.findOne({ callerId: A._id, calleeId: B._id }).sort({ createdAt: -1 }).lean();
    check("the call is recorded as ended, server-side", ended?.status === "ended");
    const log = await Message.findOne({ conversationId: conv._id, type: "call" }).sort({ createdAt: -1 }).lean();
    check("a call-log bubble appears in the normal conversation afterwards", Boolean(log) && log.call.outcome === "completed" && log.call.video === true);

    // ---- Decline flow ----------------------------------------------------------------------
    await pA.getByLabel("Start video call").click();
    check("B sees a second incoming call", await until(() => tid(pB, "call-incoming").isVisible().catch(() => false)));
    await tid(pB, "call-decline").click();
    check("declining removes the popup for the callee", await until(async () => !(await tid(pB, "call-incoming").isVisible().catch(() => true))));
    check("...and closes the outgoing screen for the caller", await until(async () => !(await tid(pA, "call-screen").isVisible().catch(() => true))));

    // ---- Calling → Ringing, and a real audio-only call, with a fresh pair so B can start
    // genuinely absent (this is what "Calling…" vs "Ringing…" actually distinguishes) --------
    await ctxB.close();
    const ctxB2 = await browser.newContext({ viewport: { width: 420, height: 860 }, permissions: ["camera", "microphone"] });
    await ctxB2.addCookies([{ name: "kotha_token", value: tok(B), domain: "localhost", path: "/" }]);
    const pB2 = await ctxB2.newPage();

    await pA.getByLabel("Start video call").click();
    check("the caller sees 'Calling…' before the callee has opened the app at all", await until(() => pA.getByText("Calling…").isVisible().catch(() => false)));
    await pB2.goto(`${APP}/app/feed`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pB2.waitForFunction(() => !document.body.innerText.includes("Preparing your space"), null, { timeout: 30000 }).catch(() => {});
    check("the callee sees the incoming popup once they do open it", await until(() => tid(pB2, "call-incoming").isVisible().catch(() => false)));
    check("the caller's text flips to 'Ringing…' the instant it actually reaches a live device", await until(() => pA.getByText("Ringing…").isVisible().catch(() => false), 8000));
    await tid(pB2, "call-decline").click();
    await until(async () => !(await tid(pA, "call-screen").isVisible().catch(() => true)));
    await ctxA.close();

    // Audio-only call, with its own fresh caller context (a brand new tab, like
    // a real call would be, rather than a fourth consecutive WebRTC session
    // reusing the same page/devices) — the reported bug was that the <video>
    // element wasn't even mounted when `video: false`, so the remote
    // MediaStream had nowhere to play.
    const ctxA2 = await browser.newContext({ viewport: { width: 420, height: 860 }, permissions: ["camera", "microphone"] });
    await ctxA2.addCookies([{ name: "kotha_token", value: tok(A), domain: "localhost", path: "/" }]);
    const pA2 = await ctxA2.newPage();
    await pA2.goto(`${APP}/app/messages/${conv._id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pA2.waitForFunction(() => !document.body.innerText.includes("Preparing your space"), null, { timeout: 30000 }).catch(() => {});
    const voiceBtn = pA2.getByLabel("Start voice call");
    await until(() => voiceBtn.isEnabled(), 20000);
    await voiceBtn.click();
    check("the callee sees the incoming audio-call popup", await until(() => tid(pB2, "call-incoming").isVisible().catch(() => false)));
    await tid(pB2, "call-accept").click();
    const audioConnected = await until(async () => {
      const doc = await Call.findOne({ callerId: A._id, calleeId: B._id }).sort({ createdAt: -1 }).lean();
      return doc?.status === "connected" ? doc : false;
    }, 20000);
    check("the audio-only call reaches 'connected' server-side", Boolean(audioConnected));
    const audioActuallyPlaying = async (page) => page.evaluate(() => {
      const el = document.querySelector("video.call-video");
      if (!el || !el.srcObject) return false;
      const audioTracks = el.srcObject.getAudioTracks();
      return !el.paused && !el.muted && audioTracks.length > 0 && audioTracks.every((track) => track.readyState === "live" && track.enabled);
    });
    // This is the last of several WebRTC sessions this run has opened across
    // multiple browser contexts — give it a bit more margin than an isolated
    // run would need before treating a slow one as a real failure.
    check("the caller actually has live, unmuted, playing remote audio (the reported 'no sound' bug)", await until(() => audioActuallyPlaying(pA2), 18000));
    check("the callee actually has live, unmuted, playing remote audio", await until(() => audioActuallyPlaying(pB2), 18000));
    await tid(pA2, "call-end").click().catch(() => {});
    await ctxA2.close();
    await ctxB2.close();

    console.log(`\n${failures} failing check(s).`);
  } catch (error) {
    console.error("Browser test crashed:", error);
    failures++;
  } finally {
    await Call.deleteMany({ $or: [{ callerId: A._id }, { calleeId: A._id }] }).catch(() => {});
    if (conv) await Message.deleteMany({ conversationId: conv._id }).catch(() => {});
    await Conversation.deleteMany({ pairKey: pairKey(A._id, B._id) }).catch(() => {});
    await Friendship.deleteMany({ userIds: { $in: [A._id, B._id] } }).catch(() => {});
    await User.deleteMany({ _id: { $in: [A._id, B._id] } }).catch(() => {});
    await browser.close();
    await mongoose.disconnect();
  }
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
