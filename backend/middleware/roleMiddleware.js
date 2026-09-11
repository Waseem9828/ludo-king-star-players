// Restricts a route to specific roles. Must run after requireAuth.
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export const requireMaster = requireRole("master");
export const requireOwner = requireRole("master", "owner");
export const requireFinance = requireRole("master", "owner", "admin", "finance_admin");
export const requireUserAdmin = requireRole("master", "owner", "admin", "finance_admin");
export const requireAnyAdmin = requireRole("master", "owner", "admin", "finance_admin");
