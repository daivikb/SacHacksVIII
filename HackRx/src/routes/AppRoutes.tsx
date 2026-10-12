import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/Dashboard";
import Account from "@/pages/Account";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminAccount from "@/pages/AdminAccount";
import SignupPage from "@/pages/SignupPage";
import TeamPlanning from "@/pages/TeamPlanning";
import ApplicationForm from "@/pages/ApplicationForm";
import { useAuth } from "@/context/auth-context";
import { useAdmin } from "@/hooks/useAdmin";

/** Gates the hacker hub behind an active session. */
const Protected = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/" replace />;
};

const AdminOnly = ({ children }: { children: ReactElement }) => {
  const { isAdmin, loading } = useAdmin();
  if (loading) return null;
  return isAdmin ? children : <Navigate to="/" replace />;
};

/** Admins are organisers, not participants — send them to the admin workspace. */
const ParticipantDashboard = () => {
  const { isAdmin, loading } = useAdmin();
  if (loading) return null;
  return isAdmin ? <Navigate to="/admin" replace /> : <Dashboard />;
};

/** Central route table for the app. */
export const AppRoutes = () => (
  <Routes>

    <Route path="/" element={<Home />} />

    <Route
      path="/apply"
      element={
        <Protected>
          <SignupPage />
        </Protected>
      }
    />
    <Route path="/application-form" element={<Navigate to="/apply" replace />} />
    <Route path="/signup" element={<Navigate to="/apply" replace />} />

    <Route
      path="/dashboard"
      element={
        <Protected>
          <ParticipantDashboard />
        </Protected>
      }
    />

    <Route
      path="/account"
      element={
        <Protected>
          <Account />
        </Protected>
      }
    />

    <Route
      path="/admin"
      element={
        <AdminOnly>
          <AdminDashboard />
        </AdminOnly>
      }
    />
    <Route
      path="/admin/account"
      element={
        <AdminOnly>
          <AdminAccount />
        </AdminOnly>
      }
    />

    <Route
      path="/teams"
      element={
        <Protected>
          <TeamPlanning />
        </Protected>
      }
    />

    <Route
      path="/application-form"
      element={
        <ApplicationForm />
      }
    />

    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={<NotFound />} />

  </Routes>
);

export default AppRoutes;
