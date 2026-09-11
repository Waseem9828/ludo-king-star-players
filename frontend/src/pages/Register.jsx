import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Login from "./Login.jsx";

export default function Register() {
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect cleanly to /login preserving query params like ?ref=...
  useEffect(() => {
    navigate(`/login${location.search}`, { replace: true, state: location.state });
  }, [location, navigate]);

  return <Login />;
}
