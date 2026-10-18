import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, subscriptionLoading } = useAuth();
  const location = useLocation();

  if (loading || subscriptionLoading) return <div className="min-h-screen bg-[#F0EAE0] p-10 text-center font-serif" role="status">Loading your account…</div>;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};
