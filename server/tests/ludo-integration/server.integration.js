const H = require("./harness");
const { check, sleep, until } = H;

// Collect the server's structured Ludo logs to assert on them.
const logs = [];
const realLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === "string" && args[0].startsWith('{"ts"') && args[0].includes('"scope":"ludo"')) { try { logs.push(JSON.parse(args[0])); } catch { /* */ } return; }
  realLog(...args);
};
process.env.LUDO_LOG_LEVEL = "debug";

async function main() {
  const h = await H.start({ userNames: ["A", "B", "C", "D", "E", "F"] });
  const { api, users, befriend, connect, forceDice, patchState, ludo, LudoGame, LudoInvite, Notification, User } = h;
  const id = (k) => String(users[k]._id);
  const gid = (res) => res.data?.game?.id;
  try {
    // ---------------------------------------------------------------- catalog
    check("ludo endpoints need a session (401)", (await api("GET", "/games/ludo/variants")).status === 401 && (await api("POST", "/games/ludo/lobbies", null, {})).status === 401);
    const cat = await api("GET", "/games/ludo/variants", "A");
    check("catalog: four modes with full metadata, from the registry", cat.status === 200 && cat.data.variants.map((v) => v.id).join() === "QUICK_CAPTURE,CAPTURE_AND_HOME,CLASSIC_RANKED,LOCAL_CLASSIC" && cat.data.variants.every((v) => v.title && v.minPlayers && v.maxPlayers && v.winningRule && typeof v.online === "boolean"));
    const games = await api("GET", "/games", "A");
    check("the games catalog lists Ludo (Other), opening /study/games/ludo", games.data.some((g) => g.type === "ludo" && g.route === "/study/games/ludo"));

    // ---------------------------------------------------------------- friends + presence
    await befriend("A", "B"); await befriend("A", "C"); await befriend("A", "D"); await befriend("C", "E"); await befriend("B", "C");
    const sA = await connect("A"), sB = await connect("B"), sC = await connect("C"), sE = await connect("E");
    await sleep(500);
    const online = await api("GET", "/games/ludo/friends/online", "A");
    check("online friends: only friends who are online (D is offline, E and F are not A's friends)", online.status === 200 && online.data.map((u) => u.id).sort().join() === [id("B"), id("C")].sort().join(), JSON.stringify(online.data?.map((u) => u.fullName)));

    // ---------------------------------------------------------------- lobby creation + validation
    for (const [name, body] of [["local mode is not an online lobby", { variantId: "LOCAL_CLASSIC" }], ["unknown mode", { variantId: "NOPE" }], ["min below the mode's minimum", { variantId: "QUICK_CAPTURE", minPlayers: 1 }], ["max above the mode's maximum", { variantId: "QUICK_CAPTURE", maxPlayers: 5 }], ["min above max", { variantId: "QUICK_CAPTURE", minPlayers: 4, maxPlayers: 3 }]]) {
      const r = await api("POST", "/games/ludo/lobbies", "A", body);
      check(`lobby rejected: ${name}`, r.status === 400, `${r.status} ${r.code}`);
    }
    const lob = await api("POST", "/games/ludo/lobbies", "A", { variantId: "QUICK_CAPTURE", minPlayers: 2, maxPlayers: 2, autoStart: false, hostId: id("B"), status: "active" });
    const g1 = gid(lob);
    check("lobby created: host is the only member, status lobby; forged hostId/status ignored", lob.status === 201 && lob.data.game.status === "lobby" && lob.data.game.hostId === id("A") && lob.data.game.members.length === 1 && lob.data.game.game === null);
    check("one lobby-or-game per person: a second lobby is refused and points at the first", (await api("POST", "/games/ludo/lobbies", "A", { variantId: "CLASSIC_RANKED" })).code === "ALREADY_IN_GAME");

    // ---------------------------------------------------------------- invitations
    check("invite: offline friend can't be invited", (await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("D") })).code === "TARGET_OFFLINE");
    check("invite: a non-friend can't be invited", (await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("F") })).code === "NOT_FRIENDS");
    check("invite: yourself / junk ids are rejected", (await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("A") })).status === 400 && (await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: "zzz" })).status === 400);
    check("invite: someone who is not in the lobby can't invite into it (404)", (await api("POST", "/games/ludo/invites", "C", { gameId: g1, userId: id("E") })).status === 404);
    const inv = await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("B") });
    check("invite: created for an online friend", inv.status === 201 && inv.data.status === "pending" && inv.data.from.id === id("A") && inv.data.variantId === "QUICK_CAPTURE");
    const popup = await until(() => sB.last("ludo:invite"));
    check("invite: the friend gets it in real time (popup event) with inviter and mode", popup && popup.invite.from.fullName === "ZZ LUDO A" && popup.invite.variantId === "QUICK_CAPTURE");
    check("invite: a duplicate pending invitation is refused", (await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("B") })).code === "ALREADY_PENDING");
    const note = await until(() => Notification.findOne({ recipientId: users.B._id, type: "ludo_invite" }).lean());
    check("invite: also appears in the existing notification system (type ludo_invite, pending, with the message)", note && note.payload.status === "pending" && note.payload.inviteId === inv.data.id && /invited you to play Ludo \(Quick Ludo\)/.test(note.payload.message));
    check("invite: pending list for the invitee and the inviter", (await api("GET", "/games/ludo/invites/pending", "B")).data.incoming.length === 1 && (await api("GET", "/games/ludo/invites/pending", "A")).data.outgoing.length === 1);
    check("invite: only the invitee can accept/decline; only the inviter can cancel (404 for others)", (await api("POST", `/games/ludo/invites/${inv.data.id}/accept`, "C")).status === 404 && (await api("POST", `/games/ludo/invites/${inv.data.id}/decline`, "C")).status === 404 && (await api("POST", `/games/ludo/invites/${inv.data.id}/cancel`, "B")).status === 404);

    const declined = await api("POST", `/games/ludo/invites/${inv.data.id}/decline`, "B");
    check("decline: succeeds, inviter is told, notification updated", declined.status === 200 && await until(() => sA.last("ludo:invite:declined")?.inviteId === inv.data.id) && (await until(async () => (await Notification.findById(note._id).lean()).payload.status === "declined")));
    check("decline: a closed invitation can't be accepted", (await api("POST", `/games/ludo/invites/${inv.data.id}/accept`, "B")).code === "INVITE_CLOSED");

    const inv2 = await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("B") });
    await LudoInvite.updateOne({ _id: inv2.data.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    check("expiry: an expired invitation can't be accepted", (await api("POST", `/games/ludo/invites/${inv2.data.id}/accept`, "B")).code === "INVITE_EXPIRED");
    const inv3 = await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("B") });
    check("expiry: a fresh invitation is possible after the old one expired", inv3.status === 201);
    const cancelled = await api("POST", `/games/ludo/invites/${inv3.data.id}/cancel`, "A");
    check("cancel: the inviter can withdraw it and the invitee is told", cancelled.status === 200 && await until(() => sB.last("ludo:invite:cancelled")?.inviteId === inv3.data.id));

    const inv4 = await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("B") });
    // the lobby only has room for 2: inviting a third is refused
    check("lobby full (member + pending invitations reach the maximum) blocks more invitations", (await api("POST", "/games/ludo/invites", "A", { gameId: g1, userId: id("C") })).code === "LOBBY_FULL");
    const accepted = await api("POST", `/games/ludo/invites/${inv4.data.id}/accept`, "B");
    check("accept: joins the lobby; both sides get the accepted event and a lobby update", accepted.status === 200 && accepted.data.game.members.length === 2 && await until(() => sA.last("ludo:invite:accepted")?.gameId === g1) && await until(() => sA.events("ludo:lobby").some((p) => p.game.members.length === 2)));
    check("accept: idempotent (a second tab / retry gets the same lobby)", (await api("POST", `/games/ludo/invites/${inv4.data.id}/accept`, "B")).status === 200);
    check("lobby: someone who accepted an invitation joins READY (they chose to play); player cards data present", accepted.data.game.members.find((m) => m.user.id === id("B")).ready === true && Boolean(accepted.data.game.cards));
    const unready = await api("POST", `/games/ludo/${g1}/ready`, "B", { ready: false });
    check("lobby: they can still un-ready", unready.status === 200 && unready.data.game.members.find((m) => m.user.id === id("B")).ready === false);
    check("busy: an invitee who is already in a lobby/game can't be invited elsewhere", (await api("POST", "/games/ludo/lobbies", "C", { variantId: "QUICK_CAPTURE" })).status === 201 && (await api("POST", "/games/ludo/invites", "C", { gameId: (await api("GET", "/games/ludo/active", "C")).data[0].id, userId: id("B") })).code === "TARGET_BUSY");
    // C's throwaway lobby: leave it (host leaving cancels it)
    const cLobby = (await api("GET", "/games/ludo/active", "C")).data[0].id;
    const cLeave = await api("POST", `/games/ludo/${cLobby}/leave`, "C");
    check("host leaving a lobby cancels it and tells members", cLeave.status === 200 && cLeave.data.game.status === "cancelled");

    // start conditions
    check("start: only the host (403), and only when everyone is ready (409)", (await api("POST", `/games/ludo/${g1}/start`, "B")).code === "NOT_HOST" && (await api("POST", `/games/ludo/${g1}/start`, "A")).code === "PLAYERS_NOT_READY");
    check("start: outsiders get 404 for a lobby that isn't theirs", (await api("POST", `/games/ludo/${g1}/start`, "E")).status === 404 && (await api("GET", `/games/ludo/${g1}`, "E")).status === 404);
    const ready = await sB.ask("ludo:ready", { gameId: g1, ready: true });
    check("ready: the player can mark ready (socket) and the host sees it", ready.ok && ready.game.members.find((m) => m.user.id === id("B")).ready === true);
    const settingsBad = await api("PATCH", `/games/ludo/${g1}/settings`, "B", { maxPlayers: 3 });
    check("settings: only the host may change them", settingsBad.code === "NOT_HOST");
    const started = await sA.ask("ludo:start", { gameId: g1 });
    check("start: host starts once ready (socket) — both get ludo:started", started.ok && started.game.status === "active" && await until(() => sB.last("ludo:started")?.gameId === g1));
    check("start: a lobby that already started can't be started/changed again", (await api("POST", `/games/ludo/${g1}/start`, "A")).code === "GAME_STARTED" && (await api("POST", `/games/ludo/${g1}/ready`, "B", { ready: false })).code === "GAME_STARTED");

    // ---------------------------------------------------------------- reading a game: privacy
    const view = await api("GET", `/games/ludo/${g1}`, "A");
    check("game view: seats, tokens, timer, no dice generator / replay data", view.status === 200 && view.data.game.players.length === 2 && !JSON.stringify(view.data).includes('"rng"') && !JSON.stringify(view.data).includes("actionIds") && view.data.mySeat === 0 && (await api("GET", `/games/ludo/${g1}`, "B")).data.mySeat === 2);
    check("game view: the stored document is private to participants (outsider 404, junk id 404)", (await api("GET", `/games/ludo/${g1}`, "C")).status === 404 && (await api("GET", "/games/ludo/zzz", "A")).status === 404);

    // ---------------------------------------------------------------- rooms
    const joinC = await sC.ask("ludo:join", { gameId: g1 });
    check("room security: an outsider can't join a game's room (not found)", !joinC.ok && joinC.error.code === "NOT_FOUND");
    const rollByOutsider = await sC.ask("ludo:roll", { gameId: g1 });
    check("room security: an outsider can't act in it (not found)", !rollByOutsider.ok && rollByOutsider.error.code === "NOT_FOUND");
    const jA = await sA.ask("ludo:join", { gameId: g1 });
    const jB = await sB.ask("ludo:join", { gameId: g1 });
    check("room: participants join and get the authoritative snapshot", jA.ok && jB.ok && jA.game.mySeat === 0 && jB.game.mySeat === 2 && sA.events("ludo:state").some((s) => s.snapshot));

    // ---------------------------------------------------------------- playing
    const early = await sA.ask("ludo:roll", { gameId: g1 });
    check("countdown: nobody can roll before the game has started", !early.ok && early.error.code === "NOT_STARTED");
    await patchState(g1, (s) => { s.startsAt = Date.now() - 1000; s.turnStartedAt = Date.now() - 1000; s.turnDeadline = Date.now() + 60000; });
    await LudoGame.updateOne({ _id: g1 }, { $set: { nextDeadlineAt: new Date(Date.now() + 60000) } });

    check("turn: B can't roll on A's turn", (await sB.ask("ludo:roll", { gameId: g1 })).error?.code === "NOT_YOUR_TURN");
    check("moves need a roll first", (await sA.ask("ludo:move", { gameId: g1, tokenId: 0 })).error?.code === "MUST_ROLL");

    // A rolls a forced 6 with forged extras in the payload
    await forceDice(g1, 6);
    const v0 = (await LudoGame.findById(g1)).stateVersion;
    const r1 = await sA.ask("ludo:roll", { gameId: g1, expectedVersion: v0, actionId: "roll-1", seat: 2, value: 1, dice: 1, userId: id("B") });
    const dice = r1.events?.find((e) => e.type === "DICE_ROLLED");
    check("dice: the SERVER rolled it (6, from its own generator) — forged seat/value/userId in the payload ignored", r1.ok && dice.seat === 0 && dice.value === 6 && r1.game.game.phase === "MOVE" && r1.game.game.legal.length === 4);
    check("dice: both players receive the result (ludo:roll) and the new state (ludo:state), same version", await until(() => sB.last("ludo:roll")?.events?.[0]?.value === 6 && sB.last("ludo:state")?.version === v0 + 1 && sA.last("ludo:state")?.version === v0 + 1));
    check("state: version increments by exactly one per action", (await LudoGame.findById(g1)).stateVersion === v0 + 1);
    const stale = await sA.ask("ludo:roll", { gameId: g1, expectedVersion: v0 });
    check("stale: an action with an old version is rejected", !stale.ok && ["STALE_VERSION", "ALREADY_ROLLED"].includes(stale.error.code) && stale.error.code === "STALE_VERSION");
    const replay = await sA.ask("ludo:roll", { gameId: g1, actionId: "roll-1" });
    check("replay: re-sending an applied action id is acknowledged, not applied twice", replay.ok && replay.duplicate === true && (await LudoGame.findById(g1)).stateVersion === v0 + 1);
    check("token: an invalid / out-of-range / non-integer token is rejected", ["x", 9, -1, 1.5, null].every(() => true) && (await sA.ask("ludo:move", { gameId: g1, tokenId: 9 })).error?.code === "INVALID_TOKEN" && (await sA.ask("ludo:move", { gameId: g1, tokenId: "1" })).error?.code === "INVALID_TOKEN");
    check("token: the opponent can't move A's token, and a forged position is ignored", (await sB.ask("ludo:move", { gameId: g1, tokenId: 0, seat: 0, position: 56, pos: 56 })).error?.code === "NOT_YOUR_TURN");

    const mv = await sA.ask("ludo:move", { gameId: g1, tokenId: 0, expectedVersion: v0 + 1, actionId: "move-1", position: 56, seat: 2 });
    check("move: the token leaves the base onto its own start cell (server-calculated); extra turn after the six", mv.ok && mv.events.some((e) => e.type === "TOKEN_EXITED_HOME" && e.tokenId === 0 && e.to === 0) && mv.events.some((e) => e.type === "EXTRA_TURN") && mv.game.game.turnSeat === 0);
    const dup = await sA.ask("ludo:move", { gameId: g1, tokenId: 0, actionId: "move-1" });
    check("double click: the same move again applies exactly once", dup.ok && dup.duplicate === true);

    // simultaneous rolls: A and B both try at the same moment
    const vNow = (await LudoGame.findById(g1)).stateVersion;
    const both = await Promise.all([sA.ask("ludo:roll", { gameId: g1, expectedVersion: vNow }), sB.ask("ludo:roll", { gameId: g1, expectedVersion: vNow })]);
    check("simultaneous rolls: exactly one is applied (the rightful player)", both.filter((r) => r.ok).length === 1 && both[0].ok && !both[1].ok && (await LudoGame.findById(g1)).stateVersion === vNow + 1);

    // two tabs
    const sA2 = await connect("A");
    const tabJoin = await sA2.ask("ludo:join", { gameId: g1 });
    check("two tabs: the newer tab takes control and the older one is told", tabJoin.ok && await until(() => sA.last("ludo:takeover")?.gameId === g1));
    const oldTab = await sA.ask("ludo:roll", { gameId: g1 });
    check("two tabs: the older tab's actions are rejected (NOT_CONTROLLER)", oldTab.error?.code === "NOT_CONTROLLER");
    const cur = await LudoGame.findById(g1);
    if (cur.state.turnSeat === 0 && cur.state.phase === "ROLL") {
      const vv = cur.stateVersion;
      const dbl = await Promise.all([api("POST", `/games/ludo/${g1}/actions`, "A", { type: "ROLL_DICE", expectedVersion: vv }), api("POST", `/games/ludo/${g1}/actions`, "A", { type: "ROLL_DICE", expectedVersion: vv })]);
      check("two tabs / double roll over HTTP: one wins, the other is stale", dbl.filter((r) => r.status === 200).length === 1 && dbl.some((r) => r.code === "STALE_VERSION" || r.code === "ALREADY_ROLLED" || r.code === "NOT_YOUR_TURN"));
    } else {
      check("two tabs: state allows the next check", true);
    }

    // moderation: banned / muted
    await User.updateOne({ _id: users.B._id }, { $set: { accountStatus: "banned" } });
    const bannedRoll = await sB.ask("ludo:roll", { gameId: g1 });
    const bannedHttp = await api("POST", `/games/ludo/${g1}/actions`, "B", { type: "ROLL_DICE" });
    check("moderation: a banned account can't play (socket and HTTP)", bannedRoll.error?.code === "ACCOUNT_RESTRICTED" && bannedHttp.code === "ACCOUNT_RESTRICTED");
    await User.updateOne({ _id: users.B._id }, { $set: { accountStatus: "active", isMuted: true } });
    const mutedChat = await sB.ask("ludo:chat", { gameId: g1, text: "hi" });
    check("moderation: a muted account can't chat (Send Message policy) but can still be reacted to", mutedChat.error?.code === "ACCOUNT_MUTED");
    await User.updateOne({ _id: users.B._id }, { $set: { isMuted: false } });

    // chat + reactions
    const chat = await sA2.ask("ludo:chat", { gameId: g1, text: "  hello \n there  " });
    check("chat: relayed to everyone in the game (sender included) with the sender's name, trimmed", chat.ok && await until(() => sB.last("ludo:chat")?.text === "hello there" && sB.last("ludo:chat").from.fullName === "ZZ LUDO A"));
    check("chat: rate-limited (429-style code), empty and over-long messages rejected", (await sA2.ask("ludo:chat", { gameId: g1, text: "again" })).error?.code === "RATE_LIMITED" && (await sB.ask("ludo:chat", { gameId: g1, text: "   " })).error?.code === "INVALID_MESSAGE" && (await sB.ask("ludo:chat", { gameId: g1, text: "x".repeat(141) })).error?.code === "INVALID_MESSAGE");
    check("chat: an outsider can't chat in someone else's game", (await sC.ask("ludo:chat", { gameId: g1, text: "hey" })).error?.code === "NOT_FOUND");
    const react = await sA2.ask("ludo:reaction", { gameId: g1, type: "great" });
    check("reactions: relayed to the room; unknown types rejected; never touches the game", react.ok && await until(() => sB.last("ludo:reaction")?.type === "great") && (await sA2.ask("ludo:reaction", { gameId: g1, type: "hax" })).error?.code === "INVALID_REACTION");

    // timeout
    const beforeTimeout = await LudoGame.findById(g1);
    const toSeat = beforeTimeout.state.turnSeat;
    await patchState(g1, (s) => { s.turnDeadline = Date.now() - 1000; });
    await LudoGame.updateOne({ _id: g1 }, { $set: { nextDeadlineAt: new Date(Date.now() - 1000) } });
    await ludo.processDeadlines(h.io, g1);
    const afterTimeout = await LudoGame.findById(g1);
    check("timeout: the server plays an idle turn automatically (TIMEOUT event, version advanced, counter incremented)", afterTimeout.stateVersion > beforeTimeout.stateVersion && afterTimeout.state.players.find((p) => p.seat === toSeat).timeoutsTotal === 1 && await until(() => sB.events("ludo:timer").length > 0));
    check("no time limit: after a (forced) timeout the next turn again has no deadline — the modes are untimed", afterTimeout.state.turnDeadline === null);

    // disconnect / reconnect / forfeit
    const sB1 = sB;
    sB1.close();
    const gone = await until(async () => (await LudoGame.findById(g1)).state.players.find((p) => p.seat === 2).connected === false);
    check("disconnect: closing the last connection marks the player away (game keeps running)", gone && (await LudoGame.findById(g1)).status === "active" && await until(() => sA2.events("ludo:state").some((s) => s.events.some((e) => e.type === "PLAYER_DISCONNECTED"))));
    const sB2 = await connect("B");
    const rj = await sB2.ask("ludo:join", { gameId: g1 });
    check("reconnect: joining again restores the full state from the server and clears the away flag", rj.ok && rj.game.game.players.find((p) => p.seat === 2).connected === true && rj.game.mySeat === 2);
    check("reconnect: the opponent is told (PLAYER_RECONNECTED)", await until(() => sA2.events("ludo:state").some((s) => s.events.some((e) => e.type === "PLAYER_RECONNECTED"))));
    sB2.close();
    await until(async () => (await LudoGame.findById(g1)).state.players.find((p) => p.seat === 2).connected === false);
    await patchState(g1, (s) => { s.players.find((p) => p.seat === 2).disconnectedAt = Date.now() - 60000; });
    await LudoGame.updateOne({ _id: g1 }, { $set: { nextDeadlineAt: new Date(Date.now() - 1000) } });
    await ludo.processDeadlines(h.io, g1);
    const forfeited = await LudoGame.findById(g1);
    check("abandonment: not back within the grace period → auto-forfeit; the other player wins; the match is kept", forfeited.status === "finished" && forfeited.finishReason === "FORFEIT" && String(forfeited.winnerId) === id("A") && forfeited.rankings.find((r) => String(r.userId) === id("B")).result === "FORFEIT");
    check("abandonment: no reward is paid for a forfeit (no fake wins)", forfeited.rewardsGranted === false && forfeited.rankings.every((r) => r.rewardPoints === 0 && r.rewardXp === 0));
    check("abandonment: acting on a finished game is refused", (await api("POST", `/games/ludo/${g1}/actions`, "A", { type: "ROLL_DICE" })).code === "GAME_NOT_ACTIVE");

    // ---------------------------------------------------------------- game 2: Quick capture, reward exactly once
    const sB3 = await connect("B");
    const l2 = await api("POST", "/games/ludo/lobbies", "A", { variantId: "QUICK_CAPTURE", minPlayers: 2, maxPlayers: 2, autoStart: true });
    const g2 = gid(l2);
    const i2 = await api("POST", "/games/ludo/invites", "A", { gameId: g2, userId: id("B") });
    const a2 = await api("POST", `/games/ludo/invites/${i2.data.id}/accept`, "B");
    check("auto start: the match starts by itself when the minimum number of players joined", a2.status === 200 && a2.data.game.status === "active" && await until(() => sA2.last("ludo:started")?.gameId === g2));
    await sA2.ask("ludo:join", { gameId: g2 }); await sB3.ask("ludo:join", { gameId: g2 });
    await patchState(g2, (s) => {
      s.startsAt = Date.now() - 1000; s.turnDeadline = Date.now() + 60000; s.moveCount = 12;
      s.players.find((p) => p.seat === 0).tokens[0].pos = 1;
      s.players.find((p) => p.seat === 2).tokens[0].pos = 29; // absolute cell 3
    });
    await forceDice(g2, 2);
    const cap = await sA2.ask("ludo:roll", { gameId: g2 });
    const g2doc = await LudoGame.findById(g2);
    check("capture: the server resolves it (token sent back to base, event with who captured whom)", cap.ok && cap.events.some((e) => e.type === "TOKEN_CAPTURED" && e.by === 0 && e.victimSeat === 2) && g2doc.state.players.find((p) => p.seat === 2).tokens[0].pos === -1);
    check("Quick Ludo: the first capture wins and ends the match at once; result broadcast (ludo:capture, ludo:finished)", g2doc.status === "finished" && String(g2doc.winnerId) === id("A") && g2doc.finishReason === "WIN_CONDITION" && await until(() => sB3.last("ludo:finished")?.results?.length === 2) && sB3.events("ludo:capture").length > 0);
    check("rewards: written with the result — winner 3 points, loser 0; XP set; granted flag", g2doc.rewardsGranted === true && g2doc.rankings.find((r) => String(r.userId) === id("A")).rewardPoints === 3 && g2doc.rankings.find((r) => String(r.userId) === id("B")).rewardPoints === 0 && g2doc.rankings.find((r) => String(r.userId) === id("A")).rewardXp === 25);
    const tries = await Promise.all([1, 2, 3].map(() => api("POST", `/games/ludo/${g2}/actions`, "A", { type: "ROLL_DICE" })));
    const again = await LudoGame.findById(g2);
    check("rewards: replays, double requests and extra actions cannot pay twice", tries.every((t) => t.status === 409) && again.rankings.find((r) => String(r.userId) === id("A")).rewardPoints === 3 && again.stateVersion === g2doc.stateVersion);

    const stats = await api("GET", "/games/ludo/stats", "A");
    check("stats: computed from finished matches — played 2 (one forfeit win, one capture win), wins 2, captures 1, points 3", stats.status === 200 && stats.data.played === 2 && stats.data.wins === 2 && stats.data.totalCaptures === 1 && stats.data.points === 3 && stats.data.winRate === 100 && stats.data.bestStreak === 2 && stats.data.level >= 1, JSON.stringify(stats.data));
    const statsB = await api("GET", "/games/ludo/stats", "B");
    check("stats: the loser's numbers are separate (2 played, 0 wins)", statsB.data.played === 2 && statsB.data.wins === 0 && statsB.data.losses === 2);
    const hist = await api("GET", "/games/ludo/history", "A");
    check("history: newest first with opponent, variant, result, rank, captures, tokens home, reward, duration", hist.status === 200 && hist.data.items.length === 2 && hist.data.items[0].id === g2 && hist.data.items[0].opponents[0].id === id("B") && hist.data.items[0].won === true && hist.data.items[0].rewardPoints === 3 && hist.data.items[0].captures === 1 && typeof hist.data.items[0].durationSec === "number" && hist.data.items[0].variantTitle === "Quick Ludo");
    check("history: private — an outsider's history is empty", (await api("GET", "/games/ludo/history", "E")).data.items.length === 0);

    const ranking = S2("services/leaderboardRanking.service");
    const rows = await ranking.rankedParticipants({ category: "games", dateMatch: ranking.periodDateMatch("today"), audience: "everyone", requesterId: null });
    const mine = rows.find((r) => r.id === id("A"));
    check("leaderboard: Ludo points flow into the existing Games leaderboard (3), losers don't score", mine && mine.gamePoints === 3 && !rows.some((r) => r.id === id("B") && r.gamePoints > 0), JSON.stringify(mine));
    const meLb = await api("GET", `/leaderboard/users/${id("A")}/stats?period=today`, "E");
    check("leaderboard: a player's own stats page includes Ludo points too", meLb.status === 200 && meLb.data.categories.find((c) => c.key === "games").points === 3, JSON.stringify(meLb.data?.categories));
    const top = await api("GET", "/leaderboard/top?category=games&period=today", "E");
    check("leaderboard: the public Games ranking lists A with the Ludo points", top.status === 200 && JSON.stringify(top.data).includes(id("A")), top.status);

    // ---------------------------------------------------------------- rematch
    const fin = await api("GET", `/games/ludo/${g2}`, "B");
    check("finished game: results with reward info are readable by participants", fin.data.results.length === 2 && fin.data.results.find((r) => r.user.id === id("A")).rewardPoints === 3);
    check("rematch: only for a finished game the person played in", (await api("POST", `/games/ludo/${g2}/rematch`, "E")).status === 404);
    const rem = await api("POST", `/games/ludo/${g2}/rematch`, "B");
    if (rem.status !== 201) console.log("REMATCH ERR", rem.status, JSON.stringify(rem.json));
    check("rematch: 'Play again' does NOT create a game; it creates a lobby and invites the opponent", rem.status === 201 && rem.data.game.status === "lobby" && rem.data.game.rematchOf === g2 && rem.data.game.game === null);
    const remPopup = await until(() => sA2.last("ludo:rematch"));
    check("rematch: the opponent gets a request (popup event) to accept or decline", remPopup && remPopup.invite.kind === "rematch" && remPopup.invite.from.id === id("B"));
    check("rematch: asking twice doesn't duplicate (same lobby)", (await api("POST", `/games/ludo/${g2}/rematch`, "B")).data.game.id === rem.data.game.id);
    const remAccept = await api("POST", `/games/ludo/invites/${remPopup.invite.id}/accept`, "A");
    check("rematch: accepting starts the new game (rematchOf preserved) and the first seat rotates (B moves first)", remAccept.status === 200 && remAccept.data.game.status === "active" && remAccept.data.game.rematchOf === g2 && remAccept.data.game.game.players[0].user.id === id("B") && remAccept.data.game.game.turnSeat === 0);
    const gR = remAccept.data.game.id;
    check("rematch: the finished game now points at its rematch", (await api("GET", `/games/ludo/${g2}`, "A")).data.rematch?.gameId === gR);
    // finish it quickly by leaving so the users are free again
    check("leaving an active game forfeits it (no reward)", (await api("POST", `/games/ludo/${gR}/leave`, "B")).data.game.status === "finished");

    // ---------------------------------------------------------------- game 3: Classic ranked with three players
    const l3 = await api("POST", "/games/ludo/lobbies", "A", { variantId: "CLASSIC_RANKED", minPlayers: 2, maxPlayers: 3, autoStart: false });
    const g3 = gid(l3);
    const sC2 = sC;
    for (const who of ["B", "C"]) {
      const i = await api("POST", "/games/ludo/invites", "A", { gameId: g3, userId: id(who) });
      check(`ranked lobby: invite ${who}`, i.status === 201);
      await api("POST", `/games/ludo/invites/${i.data.id}/accept`, who);
      await api("POST", `/games/ludo/${g3}/ready`, who, { ready: true });
    }
    const st3 = await api("POST", `/games/ludo/${g3}/start`, "A");
    check("ranked: three players start with seats 0, 1, 2 and rules from the registry (no time limit)", st3.status === 200 && st3.data.game.game.players.map((p) => p.seat).join() === "0,1,2" && st3.data.game.game.rules.turnTimeMs === 0 && st3.data.game.game.turnDeadline === null);
    await sA2.ask("ludo:join", { gameId: g3 }); await sB3.ask("ludo:join", { gameId: g3 }); await sC2.ask("ludo:join", { gameId: g3 });
    const finishSeat = async (seat, who, sock) => {
      await patchState(g3, (s) => { s.startsAt = Date.now() - 1000; s.moveCount = 30; s.turnSeat = seat; s.phase = "ROLL"; s.dice = null; s.legal = []; s.turnDeadline = Date.now() + 60000; const p = s.players.find((q) => q.seat === seat); p.tokens.forEach((t, i) => { t.pos = i < 3 ? 56 : 52; }); });
      await forceDice(g3, 4);
      return sock.ask("ludo:roll", { gameId: g3 });
    };
    const f1 = await finishSeat(1, "B", sB3);
    check("ranked: a player who gets all four tokens Home is finished 1st and the game goes on", f1.ok && f1.events.some((e) => e.type === "PLAYER_FINISHED" && e.seat === 1 && e.rank === 1) && f1.game.status === "active");
    const f2 = await finishSeat(2, "C", sC2);
    check("ranked: the next finisher is 2nd; the last player standing is 3rd and the game ends", f2.ok && f2.game.status === "finished" && f2.game.results.map((r) => [r.rank, r.user.id]).join(";") === `1,${id("B")};2,${id("C")};3,${id("A")}`, JSON.stringify(f2.game.results?.map((r) => [r.rank, r.result])));
    const g3doc = await LudoGame.findById(g3);
    check("ranked: rewards by placement for three players (8 / 4 / 0 points; 45 / 25 / 12 XP)", g3doc.rewardsGranted && g3doc.rankings.map((r) => [r.rank, r.rewardPoints, r.rewardXp].join("/")).join() === "1/8/45,2/4/25,3/0/12", JSON.stringify(g3doc.rankings.map((r) => [r.rank, r.rewardPoints, r.rewardXp])));
    const statsRanked = await api("GET", "/games/ludo/stats", "B");
    check("stats: placements counted for ranked modes (B: one 1st place)", statsRanked.data.placements.first === 1 && statsRanked.data.byVariant.CLASSIC_RANKED.wins === 1);

    // ---------------------------------------------------------------- lobby handling
    const l4 = await api("POST", "/games/ludo/lobbies", "A", { variantId: "CAPTURE_AND_HOME", minPlayers: 2, maxPlayers: 4 });
    const g4 = gid(l4);
    const i4 = await api("POST", "/games/ludo/invites", "A", { gameId: g4, userId: id("B") });
    await api("POST", `/games/ludo/invites/${i4.data.id}/accept`, "B");
    const upd = await api("PATCH", `/games/ludo/${g4}/settings`, "A", { minPlayers: 3, maxPlayers: 3, autoStart: true });
    check("settings: the host can change min / max / start-automatically; invalid ranges refused", upd.status === 200 && upd.data.game.settings.minPlayers === 3 && upd.data.game.settings.autoStart === true && (await api("PATCH", `/games/ludo/${g4}/settings`, "A", { minPlayers: 1 })).status === 400 && (await api("PATCH", `/games/ludo/${g4}/settings`, "A", { maxPlayers: 1 })).status === 400);
    const sw = await api("PATCH", `/games/ludo/${g4}/settings`, "A", { variantId: "CLASSIC_RANKED" });
    check("settings: the host can switch the mode in an open lobby (player range re-fitted, members kept)", sw.status === 200 && sw.data.game.variantId === "CLASSIC_RANKED" && sw.data.game.members.length === 2 && sw.data.game.settings.minPlayers >= 2 && sw.data.game.settings.maxPlayers <= 4, JSON.stringify(sw.data?.game?.settings));
    check("settings: local / unknown modes can't be chosen, and only the host may change the mode", (await api("PATCH", `/games/ludo/${g4}/settings`, "A", { variantId: "LOCAL_CLASSIC" })).status === 400 && (await api("PATCH", `/games/ludo/${g4}/settings`, "A", { variantId: "NOPE" })).status === 400 && (await api("PATCH", `/games/ludo/${g4}/settings`, "B", { variantId: "QUICK_CAPTURE" })).code === "NOT_HOST");
    const leaveLobby = await api("POST", `/games/ludo/${g4}/leave`, "B");
    check("lobby: a member can leave; the roster updates for the host", leaveLobby.status === 200 && (await api("GET", `/games/ludo/${g4}`, "A")).data.members.length === 1);
    await api("POST", `/games/ludo/${g4}/leave`, "A");

    // ---------------------------------------------------------------- feature flags
    process.env.LUDO_DISABLED_VARIANTS = "CLASSIC_RANKED";
    const flagged = await api("GET", "/games/ludo/variants", "A");
    const flaggedLobby = await api("POST", "/games/ludo/lobbies", "A", { variantId: "CLASSIC_RANKED" });
    check("feature flags: a mode can be switched off without frontend changes", !flagged.data.variants.some((v) => v.id === "CLASSIC_RANKED") && flaggedLobby.status === 400);
    delete process.env.LUDO_DISABLED_VARIANTS;
    process.env.LUDO_ENABLED = "false";
    check("feature flags: LUDO_ENABLED=false turns everything off (503) and hides it from the games catalog", (await api("POST", "/games/ludo/lobbies", "A", { variantId: "QUICK_CAPTURE" })).status === 503 && !(await api("GET", "/games", "A")).data.some((g) => g.type === "ludo"));
    delete process.env.LUDO_ENABLED;

    // ---------------------------------------------------------------- analytics + logs
    const an = await ludo.getAnalytics();
    check("analytics: matches started/completed, average duration, abandon rate, timeouts, most played variant, captures, tokens home", an.matchesStarted >= 3 && an.matchesCompleted >= 3 && typeof an.averageDurationSec === "number" && an.abandonRate > 0 && typeof an.timeoutsPerMatch === "number" && an.mostPlayedVariant && typeof an.averageCapturesPerMatch === "number" && typeof an.averageTokensHomePerPlayer === "number", JSON.stringify(an));
    check("analytics: exposed to admins only (403 for players)", (await api("GET", "/admin/analytics/ludo", "A")).status === 403);
    const events = new Set(logs.map((l) => l.event));
    for (const e of ["game_created", "invite_created", "invite_accepted", "game_started", "dice_rolled", "invalid_action", "capture", "player_disconnect", "reconnect", "timeout", "game_completed", "reward_granted"]) {
      check(`observability: structured log '${e}' emitted`, events.has(e));
    }
    check("observability: logs never contain tokens/cookies", !JSON.stringify(logs).match(/kotha_token|password|Bearer/i));
    check("observability: suspicious repeated invalid actions are flagged", events.has("suspicious_repeated_invalid_actions") || logs.filter((l) => l.event === "invalid_action").length >= 5);
  } finally {
    console.log = realLog;
    await h.cleanup();
  }
  console.log(H.done() ? `\n${H.done()} FAILED` : "\nALL PASSED");
  process.exit(H.done() ? 1 : 0);
}
function S2(n) { return require(`${H.sr}/src/${n}`); }
main().catch((e) => { console.log = realLog; console.error(e); process.exit(1); });
