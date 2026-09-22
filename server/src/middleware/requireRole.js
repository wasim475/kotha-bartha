// Mounted after requireAuth (see middleware/auth.js), so req.user is
// already populated — just checks the role it already loaded.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You don't have permission to do this." },
      });
    }
    next();
  };
}

module.exports = { requireRole };
