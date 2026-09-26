const H = require("./harness");
const { check, sleep, until } = H;

// 2-, 3- and 4-player online matches in every mode, plus timeouts, the deadline
// sweeper, races at the finish line, and 4-player rematches.
async function main() {
  const h = await H.start({ userNames: ["A", "B", "C", "D"], suffix: "mul" });
  const { api, users, befriend, connect, forceDice, patchState, ludo, LudoGame } = h;
  const id = (k) => String(users[k]._id);
  const socks = {};
  try {
    for (const [x, y] of [["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"]]) await befriend(x, y);
    for (const k of ["A", "B", "C", "D"]) socks[k] = await connect(k);
    await sleep(500);

    // helper: a lobby with the given members, started
    const startMatch = async (variantId, host, guests, { min = 2, max = 4 } = {}) => {
      const lob = await api("POST", "/games/ludo/lobbies", host, { variantId, minPlayers: min, maxPlayers: max });
      const gid = lob.data.game.id;
      for (const guest of guests) {
        const inv = await api("POST", "/games/ludo/invites", host, { gameId: gid, userId: id(guest) });
        const acc = await api("POST", `/games/ludo/invites/${inv.data.id}/accept`, guest);
        if (acc.status !== 200) throw new Error(`accept failed ${acc.code}`);
        await api("POST", `/games/ludo/${gid}/ready`, guest, { ready: true });
      }
      const st = await api("POST", `/games/ludo/${gid}/start`, host);
      if (st.status !== 200) throw new Error(`start failed ${st.code}`);
      for (const k of [host, ...guests]) await socks[k].ask("ludo:join", { gameId: gid });
      await patchState(gid, (s) => { s.startsAt = Date.now() - 1000; s.moveCount = 40; s.turnDeadline = Date.now() + 120000; });
      await LudoGame.updateOne({ _id: gid }, { $set: { nextDeadlineAt: new Date(Date.now() + 120000) } });
      return gid;
    };
    const setTurn = (gid, seat, tokens) => patchState(gid, (s) => {
      s.turnSeat = seat; s.phase = "ROLL"; s.dice = null; s.legal = []; s.turnDeadline = Date.now() + 120000;
      for (const [sSeat, pos] of Object.entries(tokens)) s.players.find((p) => p.seat === Number(sSeat)).tokens.forEach((t, i) => { t.pos = pos[i]; });
    });
    const seatOf = async (gid, who) => (await LudoGame.findById(gid)).state.players.find((p) => p.userId === id(who)).seat;
    const finishedFor = (who) => socks[who].events("ludo:finished").length;

    // ---------------------------------------------------------------- four-player Quick
    const g1 = await startMatch("QUICK_CAPTURE", "A", ["B", "C", "D"]);
    const d1 = await LudoGame.findById(g1);
    check("4 players: seats 0-3, one colour each, host first; rules from the mode (no turn time limit)", d1.state.players.map((p) => p.seat).join() === "0,1,2,3" && d1.state.players.map((p) => p.color).join() === "red,green,yellow,blue" && d1.state.rules.turnTimeMs === 0 && d1.state.turnSeat === 0);
    // C (seat 2, abs start 26) captures D (seat 3): D token at rel 12 -> abs (39+12)=51; C at rel 24 +1 -> rel 25 = abs 51
    const cSeat = await seatOf(g1, "C"), dSeat = await seatOf(g1, "D");
    await setTurn(g1, cSeat, { [cSeat]: [24, -1, -1, -1], [dSeat]: [12, -1, -1, -1] });
    await forceDice(g1, 1);
    const cap = await socks.C.ask("ludo:roll", { gameId: g1 });
    const g1doc = await LudoGame.findById(g1);
    check("4p Quick: the capturer wins immediately; the other three lose", cap.ok && g1doc.status === "finished" && String(g1doc.winnerId) === id("C") && g1doc.rankings.filter((r) => r.result === "LOSS").length === 3);
    check("4p Quick rewards: 5 points + 35 XP for the winner, 8 XP for each loser", g1doc.rankings.find((r) => String(r.userId) === id("C")).rewardPoints === 5 && g1doc.rankings.find((r) => String(r.userId) === id("C")).rewardXp === 35 && g1doc.rankings.filter((r) => r.rewardXp === 8).length === 3);
    check("4p Quick: all four clients receive ludo:finished with the results", await until(() => ["A", "B", "C", "D"].every((k) => finishedFor(k) === 1)));

    // ---------------------------------------------------------------- three-player Capture + Home
    const g2 = await startMatch("CAPTURE_AND_HOME", "A", ["B", "C"], { min: 2, max: 3 });
    const aSeat = await seatOf(g2, "A"), bSeat = await seatOf(g2, "B");
    await setTurn(g2, aSeat, { [aSeat]: [1, 52, -1, -1], [bSeat]: [29 - 26 + 0, -1, -1, -1] });
    // B (seat 1, start abs 13): B rel r sits on abs 13+r; A rel 3 = abs 3 -> need B at rel (3-13+52)=42
    await patchState(g2, (s) => { s.players.find((p) => p.seat === bSeat).tokens[0].pos = 42; });
    await forceDice(g2, 2);
    const roll2 = await socks.A.ask("ludo:roll", { gameId: g2 });
    check("3p Capture+Home: two tokens can move, so the player chooses", roll2.ok && roll2.game.game.phase === "MOVE" && roll2.game.game.legal.length === 2);
    const cap2 = await socks.A.ask("ludo:move", { gameId: g2, tokenId: 0 });
    check("3p Capture+Home: capturing alone does not win", cap2.ok && cap2.events.some((e) => e.type === "TOKEN_CAPTURED") && cap2.game.status === "active");
    await forceDice(g2, 4);
    await socks.A.ask("ludo:roll", { gameId: g2 });
    const home2 = await socks.A.ask("ludo:move", { gameId: g2, tokenId: 1 });
    const g2doc = await LudoGame.findById(g2);
    check("3p Capture+Home: then bringing a token Home wins (capture first, Home second)", home2.ok && g2doc.status === "finished" && String(g2doc.winnerId) === id("A") && g2doc.finishReason === "WIN_CONDITION");
    check("3p Capture+Home rewards: 6 points for the winner, none for the others", g2doc.rankings.find((r) => String(r.userId) === id("A")).rewardPoints === 6 && g2doc.rankings.filter((r) => r.rewardPoints === 0).length === 2);

    // ---------------------------------------------------------------- four-player Classic ranked (full ranking)
    const g3 = await startMatch("CLASSIC_RANKED", "A", ["B", "C", "D"]);
    const seats3 = { A: await seatOf(g3, "A"), B: await seatOf(g3, "B"), C: await seatOf(g3, "C"), D: await seatOf(g3, "D") };
    const finishSeat = async (who) => {
      await patchState(g3, (s) => { s.turnSeat = seats3[who]; s.phase = "ROLL"; s.dice = null; s.legal = []; s.turnDeadline = Date.now() + 120000; s.players.find((p) => p.seat === seats3[who]).tokens.forEach((t, i) => { t.pos = i < 3 ? 56 : 52; }); });
      await forceDice(g3, 4);
      return socks[who].ask("ludo:roll", { gameId: g3 });
    };
    const r1 = await finishSeat("B"); const r2 = await finishSeat("D"); const r3 = await finishSeat("A");
    check("4p Classic: finishing order decides 1st / 2nd / 3rd and the game continues until one player is left", r1.game.status === "active" && r2.game.status === "active" && r3.game.status === "finished");
    const g3doc = await LudoGame.findById(g3);
    check("4p Classic: final placement preserved — B 1st, D 2nd, A 3rd, C 4th", g3doc.rankings.map((r) => `${r.rank}:${String(r.userId)}`).join() === `1:${id("B")},2:${id("D")},3:${id("A")},4:${id("C")}` && g3doc.finishReason === "RANKING_COMPLETE");
    check("4p Classic rewards: 10 / 6 / 3 / 0 points and 50 / 30 / 18 / 10 XP", g3doc.rankings.map((r) => `${r.rewardPoints}/${r.rewardXp}`).join() === "10/50,6/30,3/18,0/10");

    // leaderboard + stats agree with the stored results
    const ranking = require(`${H.sr}/src/services/leaderboardRanking.service`);
    const rows = await ranking.rankedParticipants({ category: "games", dateMatch: ranking.periodDateMatch("today"), audience: "everyone", requesterId: null });
    const pts = (k) => rows.find((r) => r.id === id(k))?.gamePoints || 0;
    // A: g2 win (6) + g3 3rd (3) = 9; B: g3 1st (10); C: g1 win (5); D: g3 2nd (6)
    check("leaderboard: A 9, B 10, C 5, D 6", pts("A") === 9 && pts("B") === 10 && pts("C") === 5 && pts("D") === 6, JSON.stringify(["A", "B", "C", "D"].map(pts)));

    // ---------------------------------------------------------------- 4-player rematch
    const rem = await api("POST", `/games/ludo/${g3}/rematch`, "C");
    check("4p rematch: a lobby for all four is created and the other three are invited", rem.status === 201 && rem.data.game.expectedPlayers === 4 && rem.data.game.settings.maxPlayers === 4);
    const pendingB = await until(async () => (await api("GET", "/games/ludo/invites/pending", "B")).data.incoming[0]);
    const pendingD = (await api("GET", "/games/ludo/invites/pending", "D")).data.incoming[0];
    const pendingA = (await api("GET", "/games/ludo/invites/pending", "A")).data.incoming[0];
    check("4p rematch: each opponent gets a rematch request", pendingB?.kind === "rematch" && pendingD?.kind === "rematch" && pendingA?.kind === "rematch");
    await api("POST", `/games/ludo/invites/${pendingB.id}/decline`, "B");
    check("4p rematch: a declined request is reported to the host", await until(() => socks.C.events("ludo:rematch:declined").length > 0));
    await api("POST", `/games/ludo/invites/${pendingA.id}/accept`, "A");
    const accD = await api("POST", `/games/ludo/invites/${pendingD.id}/accept`, "D");
    check("4p rematch: with one player declined the lobby waits for the host to start (no auto-start below 'expected')", accD.status === 200 && accD.data.game.status === "lobby");
    const stR = await api("POST", `/games/ludo/${rem.data.game.id}/start`, "C");
    check("4p rematch: the host starts a 3-player rematch; the first mover rotates (previous first: A)", stR.status === 200 && stR.data.game.game.players.length === 3 && stR.data.game.game.players[0].user.id !== id("A"));
    await api("POST", `/games/ludo/${rem.data.game.id}/leave`, "C");
    await api("POST", `/games/ludo/${rem.data.game.id}/leave`, "A");

    // ---------------------------------------------------------------- forfeits pay nothing (ranked, mid-game leaver)
    const g4 = await startMatch("CLASSIC_RANKED", "A", ["B", "C", "D"]);
    const s4 = { A: await seatOf(g4, "A"), B: await seatOf(g4, "B"), C: await seatOf(g4, "C"), D: await seatOf(g4, "D") };
    const fin4 = async (who) => { await patchState(g4, (s) => { s.turnSeat = s4[who]; s.phase = "ROLL"; s.dice = null; s.legal = []; s.turnDeadline = Date.now() + 120000; s.players.find((p) => p.seat === s4[who]).tokens.forEach((t, i) => { t.pos = i < 3 ? 56 : 52; }); }); await forceDice(g4, 4); return socks[who].ask("ludo:roll", { gameId: g4 }); };
    await fin4("A");
    const lv = await api("POST", `/games/ludo/${g4}/leave`, "B");
    check("mid-game leave (ranked): the game continues for the others", lv.status === 200 && lv.data.game.status === "active" && lv.data.game.game.players.find((p) => p.user.id === id("B")).status === "LEFT");
    await fin4("C");
    const g4doc = await LudoGame.findById(g4);
    check("ranked with a leaver: A 1st, C 2nd, D 3rd, the leaver last (FORFEIT)", g4doc.status === "finished" && g4doc.rankings.map((r) => `${r.rank}:${r.result}`).join() === "1:FINISHED,2:FINISHED,3:FINISHED,4:FORFEIT", JSON.stringify(g4doc.rankings.map((r) => [r.rank, r.result])));
    check("no reward for the player who left (0 points, 0 XP) while the others are paid by placement", g4doc.rankings.find((r) => r.result === "FORFEIT").rewardPoints === 0 && g4doc.rankings.find((r) => r.result === "FORFEIT").rewardXp === 0 && g4doc.rankings[0].rewardPoints === 10);

    const stB = (await api("GET", "/games/ludo/stats", "B")).data;
    check("stats: B — played 4, one ranked win (1st place), 10 points, 68 XP (8 + 10 + 50, nothing for the forfeit)", stB.placements.first === 1 && stB.points === 10 && stB.xp === 68 && stB.played === 3 + 1 && stB.wins === 1, JSON.stringify(stB));

    // ---------------------------------------------------------------- repeated timeouts => AFK forfeit, no reward
    const g5 = await startMatch("QUICK_CAPTURE", "A", ["B"]);
    let guard = 0;
    while (guard++ < 12) {
      const d = await LudoGame.findById(g5);
      if (d.status !== "active") break;
      await patchState(g5, (s) => { s.turnDeadline = Date.now() - 1000; });
      await LudoGame.updateOne({ _id: g5 }, { $set: { nextDeadlineAt: new Date(Date.now() - 1000) } });
      await ludo.processDeadlines(h.io, g5);
    }
    const g5doc = await LudoGame.findById(g5);
    check("AFK: three timed-out turns in a row make a player forfeit; the other wins but no reward is paid", g5doc.status === "finished" && g5doc.finishReason === "FORFEIT" && g5doc.rewardsGranted === false && g5doc.rankings.every((r) => r.rewardPoints === 0) && g5doc.state.players.some((p) => p.leftReason === "AFK"), `${g5doc.finishReason} after ${guard}`);
    check("AFK: the timeout events were broadcast to both players (ludo:timer)", socks.A.events("ludo:timer").length + socks.B.events("ludo:timer").length >= 3);

    // ---------------------------------------------------------------- deadline sweeper (server restart safety net)
    const g6 = await startMatch("CAPTURE_AND_HOME", "A", ["B"]);
    const before6 = (await LudoGame.findById(g6)).stateVersion;
    await patchState(g6, (s) => { s.turnDeadline = Date.now() - 2000; });
    await LudoGame.updateOne({ _id: g6 }, { $set: { nextDeadlineAt: new Date(Date.now() - 2000) } });
    await ludo.sweep(h.io);
    check("sweeper: a turn that expired while no timer was armed (e.g. after a restart) is played out on the next sweep", await until(async () => (await LudoGame.findById(g6)).stateVersion > before6, 15000));
    // idle lobby cleanup
    const lobbyIdle = await api("POST", "/games/ludo/lobbies", "C", { variantId: "QUICK_CAPTURE" });
    await LudoGame.collection.updateOne({ _id: new (require(`${H.sr}/node_modules/mongoose`).Types.ObjectId)(lobbyIdle.data.game.id) }, { $set: { updatedAt: new Date(Date.now() - 30 * 60 * 1000) } });
    await ludo.sweep(h.io);
    check("sweeper: a lobby idle for 20+ minutes is closed and the member is told", await until(async () => (await LudoGame.findById(lobbyIdle.data.game.id)).status === "cancelled", 10000) && await until(() => socks.C.events("ludo:lobby:closed").some((e) => e.gameId === lobbyIdle.data.game.id)));
    await api("POST", `/games/ludo/${g6}/leave`, "A");

    // ---------------------------------------------------------------- races at the finish line
    const g7 = await startMatch("QUICK_CAPTURE", "A", ["B"]);
    const a7 = await seatOf(g7, "A"), b7 = await seatOf(g7, "B");
    await setTurn(g7, a7, { [a7]: [1, -1, -1, -1], [b7]: [29, -1, -1, -1] });
    await forceDice(g7, 2);
    const v7 = (await LudoGame.findById(g7)).stateVersion;
    const race = await Promise.all([1, 2, 3, 4].map(() => api("POST", `/games/ludo/${g7}/actions`, "A", { type: "ROLL_DICE", expectedVersion: v7 })));
    const g7doc = await LudoGame.findById(g7);
    check("race: four simultaneous winning rolls → exactly one applies; result and reward written once", race.filter((r) => r.status === 200 && !r.data.duplicate).length === 1 && g7doc.status === "finished" && g7doc.rankings.reduce((sum, r) => sum + r.rewardPoints, 0) === 3 && g7doc.stateVersion === v7 + 1, race.map((r) => r.status).join());
    const paid = await LudoGame.aggregate([{ $match: { _id: g7doc._id } }, { $unwind: "$rankings" }, { $group: { _id: null, p: { $sum: "$rankings.rewardPoints" } } }]);
    check("race: the stored reward total for the match is exactly 3 points", paid[0].p === 3);

    // ---------------------------------------------------------------- 2-player check of all variants' rules exposure
  } finally {
    await h.cleanup();
  }
  console.log(H.done() ? `\n${H.done()} FAILED` : "\nALL PASSED");
  process.exit(H.done() ? 1 : 0);
}
main().catch(async (e) => { console.error(e); try { await Promise.resolve(); } catch { /* */ } process.exit(1); });
