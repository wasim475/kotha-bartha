// How long after sending a message the sender may still "delete for
// everyone" (unsend) it. Configurable via env so it can be tuned without a
// code change; defaults to 15 minutes.
const UNSEND_WINDOW_MS = (Number(process.env.UNSEND_WINDOW_MINUTES) || 15) * 60_000;

module.exports = { UNSEND_WINDOW_MS };
