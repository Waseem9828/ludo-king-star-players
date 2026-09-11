import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

// Placeholder route guard. Real auth checks will be added later.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role } = useAuth();
  const isAdminRoute = allowedRoles && allowedRoles.some((r) => ["admin", "owner", "master", "finance_admin"].includes(r));

  if (!isAuthenticated) {
    if (isAdminRoute) {
      return <Navigate to="/omega-admin-login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (isAdminRoute) {
      return <Navigate to="/omega-admin-login" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
