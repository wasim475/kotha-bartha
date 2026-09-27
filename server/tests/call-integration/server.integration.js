// Server-authoritative Call feature: REST + socket integration tests against
// a real (throwaway-user) MongoDB. Run: node tests/call-integration/server.integration.js
// Short enough to actually observe a "missed"/"failed" call within a test run,
// but comfortably above realistic Atlas round-trip latency for the several
// requests the golden-path scenario makes before accepting — too tight a
// margin here is exactly the kind of flake this project has seen before from
// remote-DB latency, not from the feature itself.
process.env.CALL_RING_TIMEOUT_MS = "3000";
process.env.CALL_RECONNECT_TIMEOUT_MS = "1500";

const { start, check, sleep, until, done } = require("./harness");

(async () => {
  const h = await start({ userNames: ["A", "B", "C", "D"], suffix: "callsrv" });
  const { users, api, connect, befriend, block, Call, Message, Notification } = h;
  const idOf = (key) => users[key]._id.toString();

  try {
    // ---- Friend / block / offline guards --------------------------------------------------
    let res = await api("POST", "/calls", "A", { userId: idOf("D") });
    check("cannot call a non-friend", res.status === 403 && res.code === "NOT_FRIENDS", res.code);

    await befriend("A", "D");
    await block("A", "D");
    res = await api("POST", "/calls", "A", { userId: idOf("D") });
    check("cannot call a blocked friend", res.status === 403 && res.code === "BLOCKED", res.code);

    await befriend("A", "C");
    res = await api("POST", "/calls", "A", { userId: idOf("C") });
    check("cannot call an offline friend", res.status === 409 && res.code === "TARGET_OFFLINE", res.code);

    // ---- Golden path: A calls C (video), C accepts, signalling relays, then ends ----------
    await befriend("A", "B");
    await befriend("B", "C");
    const sockA = await connect("A");
    const sockB = await connect("B");
    const sockC = await connect("C");

    res = await api("POST", "/calls", "A", { userId: idOf("C"), video: true });
    check("A can call an online friend", res.status === 201 && res.data.status === "ringing", JSON.stringify(res.json));
    const callId = res.data.id;
    check("initiate returns the caller's own role", res.data.role === "caller");

    const invite = await until(() => sockC.last("call:invite"));
    check("C receives call:invite", Boolean(invite) && invite.call.id === callId && invite.call.video === true);

    res = await api("POST", "/calls", "A", { userId: idOf("B") });
    check("caller can't start a second call while ringing", res.status === 409 && res.code === "ALREADY_IN_CALL", res.code);

    await sockA.ask("call:join", { callId });
    await sockC.ask("call:join", { callId });

    res = await api("POST", `/calls/${callId}/accept`, "C");
    check("callee can accept", res.status === 200 && res.data.status === "accepted");

    const accepted = await until(() => sockA.last("call:accepted"));
    check("caller receives call:accepted", Boolean(accepted) && accepted.call.id === callId);

    // Signalling relay: only participants may exchange signals for this call.
    let ask = await sockA.ask("call:offer", { callId, sdp: { type: "offer", sdp: "fake-a" } });
    check("caller's offer relay is accepted", ask.ok === true, JSON.stringify(ask));
    let sig = await until(() => sockC.last("call:signal"));
    check("callee receives the relayed offer", sig?.signal?.type === "offer" && sig.from === idOf("A"));

    ask = await sockC.ask("call:answer", { callId, sdp: { type: "answer", sdp: "fake-c" } });
    check("callee's answer relay is accepted", ask.ok === true);
    sig = await until(() => sockA.events("call:signal").find((entry) => entry.signal?.type === "answer"));
    check("caller receives the relayed answer", sig?.from === idOf("C"));

    ask = await sockA.ask("call:ice-candidate", { callId, candidate: { candidate: "fake" } });
    check("ICE candidate relay is accepted", ask.ok === true);
    sig = await until(() => sockC.events("call:signal").find((entry) => entry.signal?.type === "ice"));
    check("callee receives the relayed ICE candidate", Boolean(sig));

    ask = await sockB.ask("call:offer", { callId, sdp: { type: "offer", sdp: "x" } });
    check("a non-participant can't send a signal into someone else's call", ask.ok === false && ask.error.code === "NOT_FOUND", JSON.stringify(ask));

    // ---- State reporting (client-observed connecting/connected) --------------------------
    ask = await sockA.ask("call:state", { callId, status: "connecting" });
    check("connecting is a valid transition from accepted", ask.ok === true && ask.call.status === "connecting");
    ask = await sockC.ask("call:state", { callId, status: "connected" });
    check("connected is a valid transition", ask.ok === true && ask.call.status === "connected");
    let doc = await Call.findById(callId).lean();
    check("server recorded connectedAt on first 'connected' report", Boolean(doc.connectedAt));
    const firstConnectedAt = doc.connectedAt.getTime();
    await sleep(30);
    ask = await sockA.ask("call:state", { callId, status: "connected" });
    doc = await Call.findById(callId).lean();
    check("a repeated 'connected' report doesn't move connectedAt", doc.connectedAt.getTime() === firstConnectedAt);

    // ---- Reconnect timeout: stuck in "reconnecting" too long fails the call ----------------
    ask = await sockA.ask("call:state", { callId, status: "reconnecting" });
    check("reconnecting is a valid transition from connected", ask.ok === true && ask.call.status === "reconnecting");
    const recovered = await sockC.ask("call:state", { callId, status: "connected" });
    check("recovering back to connected cancels the failure timer", recovered.ok === true && recovered.call.status === "connected");
    await sleep(2200); // longer than CALL_RECONNECT_TIMEOUT_MS — should NOT have failed, since it recovered
    doc = await Call.findById(callId).lean();
    check("a call that recovered from 'reconnecting' is not later failed by the stale timer", doc.status === "connected", doc.status);

    // ---- Reactions: validated + rate-limited, broadcast to the room -----------------------
    ask = await sockA.ask("call:reaction", { callId, type: "bogus" });
    check("an invalid reaction type is rejected", ask.ok === false && ask.error.code === "INVALID_REACTION");

    // Fire both without awaiting the first ack in between — awaiting would insert
    // a real network round trip that could itself exceed the cooldown window.
    await Promise.all([sockA.ask("call:reaction", { callId, type: "heart" }), sockA.ask("call:reaction", { callId, type: "fire" })]);
    await sleep(200);
    const reactionsSeen = sockC.events("call:reaction");
    check("a reaction sent well within the cooldown is throttled, not double-delivered", reactionsSeen.length === 1 && reactionsSeen[0].type === "heart", reactionsSeen.length);

    // ---- Screen share: participant-only, mirrored to the room -----------------------------
    ask = await sockB.ask("call:screen-share:start", { callId });
    check("a non-participant can't start screen share on someone else's call", ask.ok === false && ask.error.code === "NOT_FOUND");

    ask = await sockA.ask("call:screen-share:start", { callId });
    check("a participant can start screen share", ask.ok === true && ask.call.screenShare.active === true);
    let share = await until(() => sockC.last("call:screen-share:start"));
    check("the other participant is told screen share started", share?.byUserId === idOf("A"));

    ask = await sockA.ask("call:screen-share:stop", { callId });
    check("the sharer can stop", ask.ok === true && ask.call.screenShare.active === false);

    // ---- End the call: message log + history + idempotent double-end ----------------------
    res = await api("POST", `/calls/${callId}/end`, "A");
    check("either side can end an active call", res.status === 200 && res.data.status === "ended");
    check("duration is measured from the server's own acceptedAt/endedAt", res.data.durationSec >= 0);

    const ended = await until(() => sockC.last("call:ended"));
    check("the other participant is told the call ended", Boolean(ended));

    const message = await Message.findOne({ conversationId: res.data.conversationId, type: "call" }).sort({ createdAt: -1 }).lean();
    check("a call-log message was created", Boolean(message) && message.call.outcome === "completed" && message.call.video === true);

    res = await api("POST", `/calls/${callId}/end`, "C");
    check("ending an already-ended call is idempotent, not an error", res.status === 200 && res.data.status === "ended");

    res = await api("GET", "/calls/history", "A");
    check("the call shows up in history", res.status === 200 && res.data.calls.some((row) => row.id === callId && row.status === "ended" && row.direction === "outgoing"));

    // ---- Cancel (caller hangs up before answer) --------------------------------------------
    res = await api("POST", "/calls", "A", { userId: idOf("B") });
    const cancelId = res.data.id;
    await sockB.ask("call:join", { callId: cancelId });
    res = await api("POST", `/calls/${cancelId}/cancel`, "A");
    check("the caller can cancel a ringing call", res.status === 200 && res.data.status === "cancelled");
    const cancelMsg = await Message.findOne({ conversationId: res.data.conversationId, type: "call" }).sort({ createdAt: -1 }).lean();
    check("a cancelled call is logged as a missed call to the callee", cancelMsg?.call?.outcome === "cancelled");

    // ---- Decline ------------------------------------------------------------------------------
    res = await api("POST", "/calls", "A", { userId: idOf("B") });
    const declineId = res.data.id;
    res = await api("POST", `/calls/${declineId}/decline`, "B");
    check("the callee can decline", res.status === 200 && res.data.status === "declined");
    const declineMsg = await Message.findOne({ conversationId: res.data.conversationId, type: "call" }).sort({ createdAt: -1 }).lean();
    check("a decline is logged distinctly from a miss", declineMsg?.call?.outcome === "declined");

    // ---- Busy target ------------------------------------------------------------------------
    res = await api("POST", "/calls", "B", { userId: idOf("C") });
    const busySetupId = res.data.id;
    await api("POST", `/calls/${busySetupId}/accept`, "C");
    res = await api("POST", "/calls", "A", { userId: idOf("B") });
    check("can't call someone already in a call", res.status === 409 && res.code === "TARGET_BUSY", res.code);
    await api("POST", `/calls/${busySetupId}/end`, "B");

    // ---- Missed call: nobody answers within the (shortened, for this test) ring timeout ----
    res = await api("POST", "/calls", "A", { userId: idOf("B") });
    const missedId = res.data.id;
    const missed = await until(async () => (await Call.findById(missedId).lean())?.status === "missed", 8000);
    check("an unanswered call becomes 'missed' after the ring timeout", Boolean(missed));
    // The Call document flips to "missed" and its log Message is created in two
    // separate awaited steps inside the same timeout callback — poll rather
    // than assuming the message exists the instant the Call status does.
    const missedMsg = await until(() => Message.findOne({ conversationId: res.data.conversationId, type: "call", "call.outcome": "missed" }).sort({ createdAt: -1 }).lean());
    check("a missed call is logged", Boolean(missedMsg));
    const note = await until(() => Notification.findOne({ recipientId: users.B._id, type: "missed_call", entityId: missedId }).lean());
    check("the callee gets a missed-call notification", Boolean(note));

    // ---- Moderation: muted/banned accounts can't call --------------------------------------
    const { User } = h;
    await User.updateOne({ _id: users.A._id }, { $set: { isMuted: true } });
    res = await api("POST", "/calls", "A", { userId: idOf("B") });
    check("a muted account can't start a call", res.status === 403 && res.code === "ACCOUNT_MUTED", res.code);
    await User.updateOne({ _id: users.A._id }, { $set: { isMuted: false } });

    await User.updateOne({ _id: users.A._id }, { $set: { accountStatus: "banned" } });
    res = await api("POST", "/calls", "A", { userId: idOf("B") });
    check("a banned account can't start a call", res.status === 403 && res.code === "ACCOUNT_RESTRICTED", res.code);
    ask = await sockA.ask("call:join", { callId: cancelId });
    check("a banned account is also rejected over the socket", ask.ok === false && ask.error.code === "ACCOUNT_RESTRICTED");
    await User.updateOne({ _id: users.A._id }, { $set: { accountStatus: "active" } });
  } catch (error) {
    console.error("Test run crashed:", error);
    check("test run completed without throwing", false, error.message);
  } finally {
    console.log(`\n${done()} failing check(s).`);
    await h.cleanup();
    process.exit(done() ? 1 : 0);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
