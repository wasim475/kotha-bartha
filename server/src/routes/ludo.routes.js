const express = require("express");
const service = require("../services/ludo.service");
const { respond } = require("../utils/gameRespond");
const { ACTIONS, requireAction } = require("../utils/moderation");
const { GameError } = require("../services/games/GameError");

const router = express.Router();

// Every route runs after the global requireAuth, so `req.user` is the
// authenticated user — the ONLY source of "who is acting". Nothing about
// identity, seat, dice, token positions, turn, winner, ranking or rewards is
// ever read from the body: the client only names its intention.
const io = (req) => req.app.get("io");
const play = requireAction(ACTIONS.GAME_PLAY);

// ---- Catalog + personal data (declared before "/:gameId" so they aren't read as an id)
router.get("/games/ludo", respond(async (req) => ({ data: { ...service.listCatalog(), active: await service.listActive(req.user._id) } })));
router.get("/games/ludo/variants", respond(async () => ({ data: service.listCatalog() })));
router.get("/games/ludo/history", respond(async (req) => ({ data: await service.listHistory(req.user._id, { page: req.query.page }) })));
router.get("/games/ludo/stats", respond(async (req) => ({ data: await service.getStats(req.user._id) })));
router.get("/games/ludo/friends/online", respond(async (req) => ({ data: await service.listOnlineFriendsFor(req.user) })));
router.get("/games/ludo/active", respond(async (req) => ({ data: await service.listActive(req.user._id) })));

// ---- Lobbies
router.post("/games/ludo/lobbies", play, respond(async (req) => ({ data: await service.createLobby(req.user, req.body, io(req)) }), 201));

// ---- Invitations
router.get("/games/ludo/invites/pending", respond(async (req) => ({ data: await service.listPendingInvites(req.user) })));
// Body: { gameId, userId } — the lobby to invite into and the friend to invite.
router.post("/games/ludo/invites", play, respond(async (req) => ({ data: await service.createInvite(req.user, req.body?.gameId, req.body?.userId, io(req)) }), 201));
router.post("/games/ludo/invites/:inviteId/accept", play, respond(async (req) => ({ data: await service.acceptInvite(req.user, req.params.inviteId, io(req)) })));
router.post("/games/ludo/invites/:inviteId/decline", respond(async (req) => ({ data: await service.declineInvite(req.user, req.params.inviteId, io(req)) })));
router.post("/games/ludo/invites/:inviteId/cancel", respond(async (req) => ({ data: await service.cancelInvite(req.user, req.params.inviteId, io(req)) })));

// ---- A game
router.get("/games/ludo/:gameId", respond(async (req) => ({ data: await service.getGame(req.user._id, req.params.gameId) })));
router.patch("/games/ludo/:gameId/settings", play, respond(async (req) => ({ data: await service.updateLobbySettings(req.user, req.params.gameId, req.body, io(req)) })));
router.post("/games/ludo/:gameId/ready", play, respond(async (req) => ({ data: await service.setReady(req.user, req.params.gameId, req.body?.ready, io(req)) })));
router.post("/games/ludo/:gameId/start", play, respond(async (req) => ({ data: await service.startLobby(req.user, req.params.gameId, io(req)) })));
router.post("/games/ludo/:gameId/leave", respond(async (req) => ({ data: await service.leaveGame(req.user, req.params.gameId, io(req)) })));
router.post("/games/ludo/:gameId/rematch", play, respond(async (req) => ({ data: await service.requestRematch(req.user, req.params.gameId, io(req)) }), 201));

// The fallback for when the socket is down: the same validated action over HTTP.
// Body: { type: "ROLL_DICE" | "SELECT_TOKEN", tokenId?, expectedVersion?, actionId? }
router.post(
  "/games/ludo/:gameId/actions",
  play,
  respond(async (req) => {
    const { type, tokenId, expectedVersion, actionId } = req.body || {};
    if (type === "ROLL_DICE") return { data: await service.rollDice(io(req), req.user._id, req.params.gameId, { expectedVersion, actionId }) };
    if (type === "SELECT_TOKEN") return { data: await service.selectToken(io(req), req.user._id, req.params.gameId, { tokenId, expectedVersion, actionId }) };
    throw new GameError(400, "INVALID_ACTION", "That action isn't recognised.");
  }),
);

module.exports = router;
