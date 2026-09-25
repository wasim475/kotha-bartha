// Authorization for every /admin API. Mounted after requireAuth (which loads
// `req.user` from the database on each request), so role and account status are
// always the server's own records, never anything the client claims.
//
// Which sections each role may use is declared here and only here. Moderators keep
// exactly what the existing role system already gave them (authoring Quiz and
// Game content); everything else is admin-only.

const SECTIONS = ["dashboard", "users", "posts", "reports", "messages", "quiz", "games", "analytics", "logs", "settings"];

const ROLE_SECTIONS = Object.freeze({
  admin: SECTIONS,
  moderator: ["quiz", "games"],
});

const deny = (res, status, code, message) => res.status(status).json({ error: { code, message } });

const sectionsFor = (role) => ROLE_SECTIONS[role] || [];

// Signed-in staff only: an admin or moderator whose account is in good standing.
function requireStaff(req, res, next) {
  const role = req.user?.role;
  if (!ROLE_SECTIONS[role]) return deny(res, 403, "FORBIDDEN", "You don't have permission to do this.");
  if (req.user.accountStatus === "banned" || req.user.accountStatus === "deleted") {
    return deny(res, 403, "ACCOUNT_RESTRICTED", "Your account is currently restricted.");
  }
  next();
}

// `requireAdminSection("users")`: staff whose role includes that section.
function requireAdminSection(section) {
  if (!SECTIONS.includes(section)) throw new Error(`Unknown admin section "${section}"`);
  return (req, res, next) =>
    requireStaff(req, res, () => {
      if (!sectionsFor(req.user.role).includes(section)) {
        return deny(res, 403, "FORBIDDEN", "You don't have permission to do this.");
      }
      next();
    });
}

module.exports = { SECTIONS, ROLE_SECTIONS, sectionsFor, requireStaff, requireAdminSection };
