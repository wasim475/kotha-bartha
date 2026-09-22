// Shared conversation "chat theme" catalog — a per-conversation accent
// color pair, synced between participants (see Conversation.theme). Kept
// server-side to just the valid ids for validation; the actual color
// values live client-side (client/src/pages/message/utility/conversationThemes.js)
// since only the client renders them.
const THEME_IDS = ["default", "ocean", "sunset", "forest", "grape", "rose", "slate"];

module.exports = { THEME_IDS };
