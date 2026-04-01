import { Navigate, useLocation } from "react-router-dom";
import { getAuthState, getDefaultRoute } from "../lib/access.js";

export default function ProtectedRoute({ children, allow }) {
  const location = useLocation();
  const auth = getAuthState();

  if (!auth.token) {
    return <Navigate to="/login" replace />;
  }

  if (allow && !allow(auth)) {
    return <Navigate to={getDefaultRoute(auth)} replace state={{ from: location }} />;
  }

  return children;
}
