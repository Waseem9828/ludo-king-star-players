import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

// Placeholder route guard. Real auth checks will be added later.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
