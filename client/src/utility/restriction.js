// The server refuses restricted actions with 403 ACCOUNT_RESTRICTED (banned) or
// ACCOUNT_MUTED (muted). The API client announces that once, app-wide, so the
// banner can appear even if the ban happened after the page had loaded.
export const RESTRICTION_EVENT = "kb:account-restricted";

export function announceRestriction(code) {
  if (code !== "ACCOUNT_RESTRICTED" && code !== "ACCOUNT_MUTED") return;
  window.dispatchEvent(new CustomEvent(RESTRICTION_EVENT, { detail: { reason: code === "ACCOUNT_RESTRICTED" ? "banned" : "muted" } }));
}
