const express = require("express");
const service = require("../services/call.service");
const { respond } = require("../utils/gameRespond");
const { ACTIONS, requireAction } = require("../utils/moderation");

const router = express.Router();

// Every route runs after the global requireAuth, so `req.user` is the only
// source of "who is acting" — never the body. Mirrors games/ludo's REST
// surface (see LUDO.md) so the WebRTC socket layer can fall back to these
// when the socket is briefly down.
const io = (req) => req.app.get("io");
const call = requireAction(ACTIONS.CALL);
const withRole = (data, userId) => (data && data.caller ? service.forUser(data, userId) : data);

router.get("/calls/active", respond(async (req) => ({ data: withRole(await service.getActiveCall(req.user._id), req.user._id) })));
router.get("/calls/history", respond(async (req) => ({ data: await service.getHistory(req.user._id, { page: req.query.page }) })));
router.get("/calls/:callId", respond(async (req) => ({ data: withRole(await service.getCall(req.user._id, req.params.callId), req.user._id) })));

// Body: { userId, video }
router.post("/calls", call, respond(async (req) => ({ data: withRole(await service.initiateCall(req.user, req.body?.userId, { video: req.body?.video !== false }, io(req)), req.user._id) }), 201));
router.post("/calls/:callId/accept", call, respond(async (req) => ({ data: withRole(await service.acceptCall(req.user, req.params.callId, io(req)), req.user._id) })));
router.post("/calls/:callId/decline", respond(async (req) => ({ data: withRole(await service.declineCall(req.user, req.params.callId, io(req)), req.user._id) })));
router.post("/calls/:callId/cancel", respond(async (req) => ({ data: withRole(await service.cancelCall(req.user, req.params.callId, io(req)), req.user._id) })));
router.post("/calls/:callId/end", respond(async (req) => ({ data: withRole(await service.endCall(req.user, req.params.callId, io(req)), req.user._id) })));

module.exports = router;
