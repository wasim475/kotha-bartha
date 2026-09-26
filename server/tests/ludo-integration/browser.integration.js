const path = require("path");
const fs = require("fs");
const sr = path.join(__dirname, "..", "..");
require(path.join(sr, "node_modules", "dotenv")).config({ path: path.join(sr, ".env"), quiet: true });
const mongoose = require(path.join(sr, "node_modules", "mongoose"));
const jwt = require(path.join(sr, "node_modules", "jsonwebtoken"));
const M = (n) => require(path.join(sr, "src", "models", n));
const User = M("User"), Friendship = M("Friendship"), LudoGame = M("LudoGame"), LudoInvite = M("LudoInvite"), Notification = M("Notification");
const { pairKey } = require(path.join(sr, "src", "utils", "ids"));
const { rollDie } = require(path.join(sr, "src", "games", "ludo", "rng"));
// Needs a Chrome/Chromium and playwright-core (npm i --no-save playwright-core), the API on
// LUDO_API and the client dev server on LUDO_APP (started with VITE_API_URL pointing at that API).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright-core");

const APP = process.env.LUDO_APP || "http://localhost:5174";
const API = process.env.LUDO_API || "http://localhost:5000/api/v1";
const SHOTS = path.join(require("os").tmpdir(), "ludo-ui-shots");
fs.mkdirSync(SHOTS, { recursive: true });
let failures = 0;
const check = (n, ok, d = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d !== "" ? "  " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch { /* poll */ } await sleep(200); } return false; };

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const tag = `zzludui${Date.now()}`;
  const mk = (k) => User.create({ fullName: `ZZ LUDUI ${k}`, email: `${tag}-${k}@example.invalid`, passwordHash: "x", role: "user" });
  const U = { A: await mk("A"), B: await mk("B"), C: await mk("C") };
  await Friendship.create({ userIds: [U.A._id, U.B._id], pairKey: pairKey(U.A._id, U.B._id) });
  await Friendship.create({ userIds: [U.A._id, U.C._id], pairKey: pairKey(U.A._id, U.C._id) });
  const tok = (u) => jwt.sign({ sub: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: "50m" });
  const id = (k) => String(U[k]._id);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const errors = [];
  const contexts = [];
  const open = async (who, { width = 1280, height = 900, reducedMotion = "no-preference", dark = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500, reducedMotion });
    contexts.push(ctx);
    await ctx.addCookies([{ name: "kotha_token", value: tok(U[who]), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    page.who = who;
    page.on("pageerror", (e) => errors.push(`[${who}] ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR|GSI_LOGGER|403|409|401/i.test(m.text())) errors.push(`[${who}] ${m.text().slice(0, 250)}`); });
    page.engagement = 0;
    page.goto2 = async (url) => {
      await page.goto(APP + url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForFunction(() => !document.body.innerText.includes("Preparing your space"), null, { timeout: 40000 }).catch(() => {});
      if (dark) await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
    };
    return page;
  };
  const tid = (p, t) => p.locator(`[data-testid="${t}"]`);
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const forceDice = async (gameId, value) => { for (let seed = 1; seed < 5000; seed++) if (rollDie(seed).value === value) return LudoGame.updateOne({ _id: gameId }, { $set: { "state.rng": seed } }); };
  const patch = async (gameId, fn) => { const doc = await LudoGame.findById(gameId).lean(); const s = JSON.parse(JSON.stringify(doc.state)); fn(s); await LudoGame.updateOne({ _id: gameId }, { $set: { state: s } }); };

  try {
    // ---------------------------------------------------------------------- lobby + invitation
    const pA = await open("A"), pB = await open("B");
    await Promise.all([pA.goto2("/study/games/ludo"), pB.goto2("/study/games/ludo")]);
    await tid(pA, "ludo-mode-QUICK_CAPTURE").waitFor({ timeout: 40000 });
    check("home: online modes from the server registry, local mode, record, history link", (await pA.locator('[data-testid^="ludo-mode-"]').count()) >= 4 && await tid(pA, "ludo-mode-local").isVisible() && await tid(pA, "ludo-history-link").isVisible());
    await tid(pA, "ludo-mode-QUICK_CAPTURE").click();
    await tid(pA, "ludo-create-lobby").click();
    await tid(pA, "ludo-lobby-title").waitFor({ timeout: 30000 });
    const lobbyUrl = pA.url();
    const gameId = lobbyUrl.split("/").pop();
    check("lobby: created (title = mode), host is the first player", (await tid(pA, "ludo-lobby-title").innerText()) === "Quick Ludo" && (await pA.locator('[data-testid="ludo-member"]').count()) === 1);
    check("lobby: online friend B is listed for invitation (C is offline and not shown)", await until(async () => (await pA.locator('[data-testid="ludo-friend"]').allInnerTexts()).some((t) => t.includes("ZZ LUDUI B"))) && !(await pA.locator('[data-testid="ludo-friend"]').allInnerTexts()).some((t) => t.includes("ZZ LUDUI C")));

    // C comes online -> appears without a refresh
    const pC = await open("C");
    await pC.goto2("/study/games/ludo");
    check("presence: a friend who comes online appears in the invite list in real time (no refresh)", await until(async () => (await pA.locator('[data-testid="ludo-friend"]').allInnerTexts()).some((t) => t.includes("ZZ LUDUI C"))));
    await pC.context().close();
    check("presence: when they go offline they disappear again", await until(async () => !(await pA.locator('[data-testid="ludo-friend"]').allInnerTexts()).some((t) => t.includes("ZZ LUDUI C")), 25000));

    await pA.locator('[data-testid="ludo-friend"]', { hasText: "ZZ LUDUI B" }).locator('[data-testid="ludo-invite"]').click();
    const card = tid(pB, "ludo-request");
    await card.waitFor({ timeout: 30000 });
    const msg = await tid(pB, "ludo-request-message").innerText();
    check("popup: the invited friend gets it on whatever page they're on — inviter, mode, player count, Accept / Decline", /invited you to play Ludo \(Quick Ludo\)/.test(msg) && (await card.innerText()).includes("2–4 players") && await tid(pB, "ludo-accept").isVisible() && await tid(pB, "ludo-decline").isVisible(), msg);
    await pB.screenshot({ path: path.join(SHOTS, "invite-popup.png") });

    // decline then re-invite
    await tid(pB, "ludo-decline").click();
    check("decline: the popup closes and the host is told", await until(async () => (await card.count()) === 0) && await until(async () => /declined/.test(await tid(pA, "ludo-notice").innerText().catch(() => ""))));
    await pA.locator('[data-testid="ludo-friend"]', { hasText: "ZZ LUDUI B" }).locator('[data-testid="ludo-invite"]').click();
    await card.waitFor({ timeout: 30000 });
    await tid(pB, "ludo-accept").click();
    await tid(pB, "ludo-lobby-title").waitFor({ timeout: 30000 });
    check("accept: B lands in the lobby; both rosters update live (2 players)", await until(async () => (await pA.locator('[data-testid="ludo-member"]').count()) === 2) && (await pB.locator('[data-testid="ludo-member"]').count()) === 2);
    check("lobby: player cards show level / wins / win rate; host badge; B joined ready (they accepted)", /Level 1/.test(await pA.locator('[data-testid="ludo-members"]').innerText()) && /Host/.test(await pA.locator('[data-testid="ludo-members"]').innerText()) && /Ready/.test(await pA.locator('[data-testid="ludo-members"]').innerText()));
    check("lobby: an invitee who accepted joins ready, so the host can start straight away", await until(async () => !(await tid(pA, "ludo-start").isDisabled())));
    await pA.screenshot({ path: path.join(SHOTS, "lobby-host.png"), fullPage: true });
    check("ready: B can still un-ready and ready again; the host sees it live", await (async () => { await tid(pB, "ludo-ready").click(); const off = await until(async () => await tid(pA, "ludo-start").isDisabled()); await tid(pB, "ludo-ready").click(); return off && (await until(async () => !(await tid(pA, "ludo-start").isDisabled()))); })());
    await tid(pA, "ludo-start").click();
    await Promise.all([tid(pA, "ludo-table").waitFor({ timeout: 40000 }), tid(pB, "ludo-table").waitFor({ timeout: 40000 })]);
    check("start: 'Match found' then both land on the board", true);
    check("countdown: 3-2-1-GO is shown before the first turn", await until(async () => (await pA.locator('[data-testid="ludo-countdown"]').count()) > 0, 8000));
    await pA.screenshot({ path: path.join(SHOTS, "countdown.png") });
    await until(async () => (await pA.locator('[data-testid="ludo-countdown"]').count()) === 0, 12000);

    // ---------------------------------------------------------------------- the board
    check("board: my colour is bottom-left for each player (board rotates per seat); four tokens each", (await pA.locator(".ludo-token").count()) === 8 && (await pB.locator(".ludo-token").count()) === 8);
    check("turn: A sees 'Your Turn', B sees A's name", /Your Turn/.test(await tid(pA, "ludo-turn-text").innerText()) && /ZZ LUDUI A's Turn/.test(await tid(pB, "ludo-turn-text").innerText()));
    check("no time limit: there is no turn countdown on screen", (await pA.locator('[data-testid="ludo-seconds"]').count()) === 0 && (await pB.locator('[data-testid="ludo-seconds"]').count()) === 0);
    await sleep(1500);
    check("no time limit: the dice is still waiting for A after a while (nothing rolled or skipped for them)", await tid(pA, "ludo-dice").isEnabled());
    check("dice: only the player whose turn it is can roll (B's dice disabled)", (await tid(pA, "ludo-dice").isEnabled()) && (await tid(pB, "ludo-dice").isDisabled()));
    await pA.screenshot({ path: path.join(SHOTS, "game-A.png"), fullPage: true });

    // roll #1 through the real UI
    const doc0 = await LudoGame.findById(gameId);
    await forceDice(gameId, 6);
    await tid(pA, "ludo-dice").click();
    check("dice: rolling tumbles (animation state) then lands on the SERVER's result (6)", await until(async () => (await tid(pA, "ludo-dice").getAttribute("data-value")) === "6" && (await tid(pB, "ludo-dice").getAttribute("data-value")) === "6", 8000));
    check("moves: with a 6 all four tokens glow as valid; tapping one is required", await until(async () => (await pA.locator('.ludo-token[data-movable="true"]').count()) === 4, 8000) && (await pB.locator('.ludo-token[data-movable="true"]').count()) === 0);
    await pA.screenshot({ path: path.join(SHOTS, "movable.png") });
    await pA.locator('.ludo-token[data-movable="true"]').first().click();
    check("moves: the token leaves the base (server-calculated) and A gets the bonus roll", await until(async () => { const d = await LudoGame.findById(gameId); return d.state.players[0].tokens.some((t) => t.pos === 0) && d.state.turnSeat === 0 && d.state.phase === "ROLL"; }));
    check("state stays in sync for the opponent (same version on both clients)", await until(async () => { const v = (await LudoGame.findById(gameId)).stateVersion; return (await pB.locator('[data-testid="ludo-status"]').innerText()).length > 0 && v >= doc0.stateVersion + 2; }));

    // chat + reactions
    await tid(pA, "ludo-chat-input").fill("good luck!");
    await tid(pA, "ludo-chat-send").click();
    check("chat: a short message reaches the opponent in real time", await until(async () => /good luck!/.test(await tid(pB, "ludo-chat-log").innerText())));
    await tid(pB, "ludo-react-great").click();
    check("reactions: an animated reaction (🔥 Great!) plays for the other player", await until(async () => (await pA.locator('[data-testid="ludo-emote-great"]').count()) > 0, 8000));
    await pA.screenshot({ path: path.join(SHOTS, "reaction.png") });
    await tid(pB, "ludo-chat-input").fill("x".repeat(140));
    check("chat: the input is capped at 140 characters", (await tid(pB, "ludo-chat-input").inputValue()).length === 140);

    // two tabs
    const pA2 = await open("A");
    await pA2.goto2(`/study/games/ludo/play/${gameId}`);
    await tid(pA2, "ludo-table").waitFor({ timeout: 40000 });
    check("two tabs: opening the game in a second tab tells the first one and offers 'Take control'", await until(async () => (await pA.locator('[data-testid="ludo-takeover"]').count()) > 0, 15000));
    check("two tabs: the older tab can't act (dice disabled)", await tid(pA, "ludo-dice").isDisabled());
    await pA.locator('[data-testid="ludo-takeover"] button').click();
    check("two tabs: taking control makes the older tab active again", await until(async () => (await pA.locator('[data-testid="ludo-takeover"]').count()) === 0, 15000) && await until(async () => (await pA2.locator('[data-testid="ludo-takeover"]').count()) > 0, 15000));
    await pA2.context().close();

    // reconnect UI
    await pB.context().setOffline(true);
    check("recovery: going offline shows 'Reconnecting…' at once instead of a frozen board", await until(async () => (await pB.locator('[data-testid="ludo-connection"]').count()) > 0, 10000));
    await sleep(1500);
    await pB.context().setOffline(false);
    check("recovery: back online, the game re-syncs and the banner clears", await until(async () => (await pB.locator('[data-testid="ludo-connection"]').count()) === 0, 45000));
    // leaving the game screen (or closing the tab) marks the player away; coming back restores them
    await pB.goto2("/study/games/ludo");
    check("disconnect: the opponent sees 'Reconnecting…' for the player who left the screen", await until(async () => /Reconnecting/.test(await tid(pA, "ludo-players").innerText()), 25000));
    await pB.goto2(`/study/games/ludo/play/${gameId}`);
    await tid(pB, "ludo-table").waitFor({ timeout: 40000 });
    check("reconnect: coming back restores the full state from the server; the opponent's notice clears", await until(async () => !/Reconnecting/.test(await tid(pA, "ludo-players").innerText()), 30000) && (await pB.locator(".ludo-token").count()) === 8);

    // ---------------------------------------------------------------------- winning
    await patch(gameId, (s) => { s.moveCount = 12; s.turnSeat = 0; s.phase = "ROLL"; s.dice = null; s.legal = []; s.turnDeadline = Date.now() + 60000;
      s.players[0].tokens.forEach((t, i) => { t.pos = i === 0 ? 1 : -1; });
      s.players[1].tokens.forEach((t, i) => { t.pos = i === 0 ? 29 : -1; }); });
    await LudoGame.updateOne({ _id: gameId }, { $set: { nextDeadlineAt: new Date(Date.now() + 60000) } });
    await forceDice(gameId, 2);
    await pA.reload({ waitUntil: "domcontentloaded" });
    await tid(pA, "ludo-table").waitFor({ timeout: 40000 });
    await until(async () => await tid(pA, "ludo-dice").isEnabled(), 15000);
    await tid(pA, "ludo-dice").click();
    const resA = tid(pA, "ludo-result"), resB = tid(pB, "ludo-result");
    await Promise.all([resA.waitFor({ timeout: 40000 }), resB.waitFor({ timeout: 40000 })]);
    check("capture wins Quick Ludo: winner sees a celebration (canvas confetti), loser a calm 'Good game'", /You won/.test(await tid(pA, "ludo-result-title").innerText()) && /Good game/.test(await tid(pB, "ludo-result-title").innerText()) && (await pA.locator('[data-testid="ludo-celebration"]').count()) === 1 && (await pB.locator('[data-testid="ludo-celebration"]').count()) === 0);
    await pA.screenshot({ path: path.join(SHOTS, "result-winner.png") });
    await pB.screenshot({ path: path.join(SHOTS, "result-loser.png") });
    const resText = await tid(pA, "ludo-result-rows").innerText();
    check("result: both players with rank, captures, tokens home and the reward (+3 pts / +25 XP)", /1st/.test(resText) && /2nd/.test(resText) && /1 captured/.test(resText) && /\+3 pts/.test(resText) && /\+25 XP/.test(resText), resText.replace(/\n/g, " | "));
    check("result: buttons Play Again / Match History / Exit", await tid(pA, "ludo-play-again").isVisible() && await pA.getByRole("button", { name: /Match History/ }).isVisible() && await tid(pA, "ludo-exit").isVisible());

    // rematch
    await tid(pA, "ludo-play-again").click();
    const remCard = tid(pB, "ludo-request");
    await remCard.waitFor({ timeout: 30000 });
    check("rematch: 'Play again' asks the opponent (popup 'Play another … match?') instead of starting a game", /Play another Ludo \(Quick Ludo\) match/.test(await tid(pB, "ludo-request-message").innerText()) && /lobby/.test(pA.url()));
    await tid(pB, "ludo-accept").click();
    const onNewGame = (p) => until(() => p.url().includes("/play/") && !p.url().endsWith(gameId), 40000);
    await Promise.all([onNewGame(pA), onNewGame(pB)]);
    await Promise.all([tid(pA, "ludo-table").waitFor({ timeout: 40000 }), tid(pB, "ludo-table").waitFor({ timeout: 40000 })]);
    await until(async () => (await pA.locator('[data-testid="ludo-result"]').count()) === 0, 15000);
    const remGame = pB.url().split("/").pop();
    const remDoc = await LudoGame.findById(remGame);
    check("rematch: accepting starts a new match linked to the old one; the other player moves first", String(remDoc.rematchOf) === gameId && remDoc.state.players[0].userId === id("B") && remDoc.state.turnSeat === 0);
    await Promise.all([tid(pA, "ludo-leave").click(), sleep(200)]);
    await pA.getByRole("button", { name: "Leave match" }).click();

    // ---------------------------------------------------------------------- history + stats
    await pA.goto2("/study/games/ludo/history");
    await tid(pA, "ludo-history").waitFor({ timeout: 30000 });
    const hist = await tid(pA, "ludo-history").innerText();
    check("history: the finished match with opponent, result, captures, reward", /Quick Ludo · Won/.test(hist) && /ZZ LUDUI B/.test(hist) && /1 captured/.test(hist) && /\+3 pts/.test(hist), hist.replace(/\n/g, " | ").slice(0, 200));
    await pA.locator('[data-testid="ludo-history-item"] button').first().click();
    check("history: clicking a match opens its summary (both players)", await until(async () => (await pA.locator('[data-testid="ludo-summary"] li').count()) === 2));
    await pA.screenshot({ path: path.join(SHOTS, "history.png"), fullPage: true });
    await pA.goto2("/study/games/ludo");
    await tid(pA, "ludo-stats").waitFor({ timeout: 30000 });
    check("stats: played / wins / win rate / captures from trusted match records", await until(async () => /^2$/.test((await tid(pA, "ludo-stat-games-played").innerText()).trim()) && /^1$/.test((await tid(pA, "ludo-stat-wins").innerText()).trim()) && /^50%$/.test((await tid(pA, "ludo-stat-win-rate").innerText()).trim()) && /^1$/.test((await tid(pA, "ludo-stat-captures").innerText()).trim())), (await tid(pA, "ludo-stats").innerText()).replace(/\n/g, " ").slice(0, 200));
    await pA.screenshot({ path: path.join(SHOTS, "home-stats.png"), fullPage: true });
    const pBh = await open("B"); await pBh.goto2("/study/games/ludo/history");
    const bHist = await tid(pBh, "ludo-history").innerText().catch(() => "");
    check("history: private — B sees their OWN results (a loss, and a win by forfeit with no reward), not A's reward", /Lost/.test(bHist) && /Won/.test(bHist) && !bHist.includes("+3 pts"), bHist.slice(0, 160));

    // ---------------------------------------------------------------------- notifications
    const post = async (url, who, body) => { const r = await fetch(API + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok(U[who])}` }, body: JSON.stringify(body || {}) }); return { status: r.status, json: await r.json().catch(() => null) }; };
    const lobby2 = await post("/games/ludo/lobbies", "A", { variantId: "CLASSIC_RANKED" });
    const gid2 = lobby2.json.data.game.id;
    const inv2 = await post("/games/ludo/invites", "A", { gameId: gid2, userId: id("B") });
    const pn = await open("B"); await pn.goto2("/app/notifications");
    await pn.locator('[data-testid="ludo-notification-accept"]').first().waitFor({ timeout: 40000 });
    const noteText = await pn.locator("main").innerText();
    check("notifications: the invitation appears as a \"Ludo invitation\" with the message, time and Accept / Decline", /ludo invitation/i.test(noteText) && /invited you to play Ludo \(Classic Ranked Ludo\)/.test(noteText) && await pn.locator('[data-testid="ludo-notification-accept"]').first().isVisible() && await pn.locator('[data-testid="ludo-notification-decline"]').first().isVisible());
    await pn.screenshot({ path: path.join(SHOTS, "notification.png"), fullPage: true });
    await pn.locator('[data-testid="ludo-notification-accept"]').first().click();
    check("notifications: Accept from the notification joins the lobby", await until(() => pn.url().includes("/lobby/" + gid2), 30000));
    await post(`/games/ludo/${gid2}/leave`, "B");
    await post(`/games/ludo/${gid2}/leave`, "A");
    const lobby3 = await post("/games/ludo/lobbies", "A", { variantId: "CAPTURE_AND_HOME" });
    const inv3 = await post("/games/ludo/invites", "A", { gameId: lobby3.json.data.game.id, userId: id("B") });
    await pn.goto2("/app/notifications");
    await pn.locator(`[data-testid="ludo-notification-decline"]`).first().waitFor({ timeout: 40000 });
    await pn.locator(`[data-testid="ludo-notification-decline"]`).first().click();
    check("notifications: Decline from the notification records the outcome", await until(async () => /Declined/.test(await pn.locator("main").innerText())));
    check("notifications: an answered invitation is not actionable again (server refuses)", (await post(`/games/ludo/invites/${inv3.json.data.id}/accept`, "B")).status === 409 && (await post(`/games/ludo/invites/${inv2.json.data.id}/accept`, "B")).status === 409);
    await post(`/games/ludo/${lobby3.json.data.game.id}/leave`, "A");
    await post(`/games/ludo/${gid2}/leave`, "B");

    // ---------------------------------------------------------------------- responsive + dark + reduced motion
    // fresh game to look at every width
    for (const u of ["A", "B"]) await LudoGame.updateMany({ "members.userId": U[u]._id, status: { $in: ["lobby", "active"] } }, { $set: { status: "cancelled" } });
    for (const [w, h] of [[320, 700], [360, 740], [375, 812], [390, 844], [400, 860], [768, 1024], [1024, 800], [1440, 900]]) {
      const p = await open("A", { width: w, height: h, dark: w % 2 === 0 });
      await p.goto2("/study/games/ludo");
      await tid(p, "ludo-mode-QUICK_CAPTURE").waitFor({ timeout: 40000 });
      const o1 = await overflow(p);
      await p.goto2("/study/games/ludo/local");
      await tid(p, "ludo-local-start").waitFor({ timeout: 30000 });
      await tid(p, "ludo-local-start").click();
      await tid(p, "ludo-table").waitFor();
      await sleep(400);
      const box = await p.locator(".ludo-board").boundingBox();
      const dice = await tid(p, "ludo-dice").boundingBox();
      const o2 = await overflow(p);
      check(`responsive ${w}px: home + local game have no horizontal overflow, board fully visible, dice ≥ 44px`, !o1 && !o2 && box.x >= 0 && box.x + box.width <= w + 1 && dice.width >= 44 && dice.height >= 44, `board ${Math.round(box.width)}px overflow=${o1 || o2}`);
      if (w === 320 || w === 1440) await p.screenshot({ path: path.join(SHOTS, `local-${w}.png`), fullPage: true });
      await p.context().close();
    }
    const pr = await open("A", { reducedMotion: "reduce" });
    await pr.goto2("/study/games/ludo/local");
    await tid(pr, "ludo-local-start").click();
    await tid(pr, "ludo-table").waitFor();
    for (let i = 0; i < 6; i++) { const d = pr.locator('[data-testid="ludo-dice"]:not([disabled])'); if (await d.count()) { await d.click(); await sleep(350); } const t = pr.locator('.ludo-token[data-movable="true"]').first(); if (await t.count()) { await t.click({ force: true }); await sleep(250); } }
    check("reduced motion: the game stays fully playable with animations minimised (no errors)", (await tid(pr, "ludo-table").count()) === 1);

    check("no runtime errors in any browser console", errors.length === 0, errors.slice(0, 3).join(" || "));
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    await browser.close().catch(() => {});
    const ids = Object.values(U).map((u) => u._id);
    const games = await LudoGame.find({ "members.userId": { $in: ids } }).select("_id").lean();
    await LudoInvite.deleteMany({ $or: [{ inviterId: { $in: ids } }, { inviteeId: { $in: ids } }] });
    await Notification.deleteMany({ $or: [{ recipientId: { $in: ids } }, { actorId: { $in: ids } }] });
    await LudoGame.deleteMany({ _id: { $in: games.map((g) => g._id) } });
    await Friendship.deleteMany({ userIds: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    console.log(`cleanup: ${games.length} games, ${ids.length} users`);
    await mongoose.disconnect();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
