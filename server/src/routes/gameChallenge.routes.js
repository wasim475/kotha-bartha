const express = require("express");
const service = require("../services/gameChallenge.service");
const { respond } = require("../utils/gameRespond");
const { ACTIONS, requireAction } = require("../utils/moderation");

const router = express.Router();

// Every route runs after the global requireAuth, so `req.user` is the ONLY
// source of "who is acting". Nothing about identity, timing, correctness,
// scores or winners is ever read from the body — the client names a friend and
// a game, or a question and one of its own option positions, and that is all.
const io = (req) => req.app.get("io");

// ---- friends who are online right now (the only people who can be challenged)
router.get("/games/challenges/friends/online", respond(async (req) => ({ data: await service.listOnlineFriends(req.user) })));

// ---- matches I can resume
router.get("/games/challenges/active", respond(async (req) => ({ data: await service.listActive(req.user._id, io(req)) })));

// ---- invitations
router.get("/games/challenges/invites/pending", respond(async (req) => ({ data: await service.listPending(req.user) })));
router.post(
  "/games/challenges/invites",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.createInvite(req.user, req.body?.userId, req.body?.gameType, io(req)) }), 201),
);
router.post(
  "/games/challenges/invites/:inviteId/accept",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.acceptRequest(req.user, req.params.inviteId, io(req), "invite") })),
);
router.post(
  "/games/challenges/invites/:inviteId/decline",
  respond(async (req) => ({ data: await service.declineRequest(req.user, req.params.inviteId, io(req), "invite") })),
);
router.post(
  "/games/challenges/invites/:inviteId/cancel",
  respond(async (req) => ({ data: await service.cancelRequest(req.user, req.params.inviteId, io(req)) })),
);

// ---- rematch requests
router.post(
  "/games/challenges/rematch/:requestId/accept",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.acceptRequest(req.user, req.params.requestId, io(req), "rematch") })),
);
router.post(
  "/games/challenges/rematch/:requestId/decline",
  respond(async (req) => ({ data: await service.declineRequest(req.user, req.params.requestId, io(req), "rematch") })),
);
router.post(
  "/games/challenges/rematch/:requestId/cancel",
  respond(async (req) => ({ data: await service.cancelRequest(req.user, req.params.requestId, io(req)) })),
);

// ---- a match
router.get("/games/challenges/:matchId", respond(async (req) => ({ data: await service.getMatch(req.user._id, req.params.matchId, io(req)) })));

// Body: { questionIndex, selectedPosition } — the fallback path when the socket
// is down; the socket "gameChallenge:answer" event calls the same function.
router.post(
  "/games/challenges/:matchId/answer",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({
    data: await service.submitAnswer(
      req.user._id,
      req.params.matchId,
      { questionIndex: req.body?.questionIndex, selectedPosition: req.body?.selectedPosition },
      io(req),
      Date.now(),
    ),
  })),
);
router.post("/games/challenges/:matchId/leave", respond(async (req) => ({ data: await service.leaveMatch(req.user._id, req.params.matchId, io(req)) })));
router.post(
  "/games/challenges/:matchId/rematch",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.requestRematch(req.user, req.params.matchId, io(req)) }), 201),
);

module.exports = router;
