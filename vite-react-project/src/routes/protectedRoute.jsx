import React, { useEffect } from "react";
import { useAuth } from "../provider/authProvider";
import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    console.log("AuthProvider rendered");
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default ProtectedRoute;
