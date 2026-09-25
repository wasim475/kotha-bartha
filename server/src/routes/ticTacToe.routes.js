const express = require("express");
const service = require("../services/ticTacToe.service");
const { respond } = require("../utils/gameRespond");
const { ACTIONS, requireAction } = require("../utils/moderation");

const router = express.Router();

// Every route runs after the global requireAuth, so `req.user` is the
// authenticated user — the ONLY source of "who is acting". Nothing about
// identity, turn, board, winner, score or stats is ever read from the body.
const io = (req) => req.app.get("io");

// ---- settings (declared first: "settings" must not be read as a gameId)
router.get("/games/tic-tac-toe/settings", respond(async (req) => ({ data: await service.getSettings(req.user) })));
router.patch("/games/tic-tac-toe/settings", respond(async (req) => ({ data: await service.updateSettings(req.user, req.body) })));

// ---- statistics
router.get("/games/tic-tac-toe/stats", respond(async (req) => ({ data: await service.getStats(req.user._id) })));

// ---- friends who are online right now (the only people who can be invited)
router.get("/games/tic-tac-toe/friends/online", respond(async (req) => ({ data: await service.listOnlineFriends(req.user) })));

// ---- games I can resume
router.get("/games/tic-tac-toe/active", respond(async (req) => ({ data: await service.listActive(req.user._id) })));

// ---- invitations
router.get("/games/tic-tac-toe/invites/pending", respond(async (req) => ({ data: await service.listPending(req.user) })));
router.post(
  "/games/tic-tac-toe/invites",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.createInvite(req.user, req.body?.userId, io(req)) }), 201),
);
router.post(
  "/games/tic-tac-toe/invites/:inviteId/accept",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.acceptRequest(req.user, req.params.inviteId, io(req), "invite") })),
);
router.post(
  "/games/tic-tac-toe/invites/:inviteId/decline",
  respond(async (req) => ({ data: await service.declineRequest(req.user, req.params.inviteId, io(req), "invite") })),
);
router.post(
  "/games/tic-tac-toe/invites/:inviteId/cancel",
  respond(async (req) => ({ data: await service.cancelRequest(req.user, req.params.inviteId, io(req)) })),
);

// ---- rematch requests
router.post(
  "/games/tic-tac-toe/rematch/:requestId/accept",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.acceptRequest(req.user, req.params.requestId, io(req), "rematch") })),
);
router.post(
  "/games/tic-tac-toe/rematch/:requestId/decline",
  respond(async (req) => ({ data: await service.declineRequest(req.user, req.params.requestId, io(req), "rematch") })),
);
router.post(
  "/games/tic-tac-toe/rematch/:requestId/cancel",
  respond(async (req) => ({ data: await service.cancelRequest(req.user, req.params.requestId, io(req)) })),
);

// ---- a game
router.get("/games/tic-tac-toe/:gameId", respond(async (req) => ({ data: await service.getGame(req.user._id, req.params.gameId) })));

// Body: { cellIndex } — the cell is the only thing the client says. This is
// also the fallback path when the socket is down; the socket "ticTacToe:move"
// event calls the same service function.
router.post(
  "/games/tic-tac-toe/:gameId/move",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.makeMove(req.user._id, req.params.gameId, req.body?.cellIndex, io(req)) })),
);
router.post(
  "/games/tic-tac-toe/:gameId/rematch",
  requireAction(ACTIONS.GAME_PLAY),
  respond(async (req) => ({ data: await service.requestRematch(req.user, req.params.gameId, io(req)) }), 201),
);
router.post(
  "/games/tic-tac-toe/:gameId/leave",
  respond(async (req) => ({ data: await service.leaveGame(req.user._id, req.params.gameId, io(req)) })),
);

module.exports = router;
