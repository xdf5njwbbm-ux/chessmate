import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { SessionProvider, useSession } from "./state/session";
import { ToastProvider } from "./state/toast";
import { LiveProvider } from "./state/live";
import { BottomNav } from "./components/BottomNav";
import { FullScreenLoader } from "./components/ui";
import Landing from "./pages/Landing";
import AuthPage, { ResetPassword } from "./pages/Auth";
import Discover from "./pages/Discover";
import ProfileView from "./pages/ProfileView";
import Games from "./pages/Games";
import Matches from "./pages/Matches";
import Me from "./pages/Me";
import Settings from "./pages/Settings";

// heavier screens load on demand
const Onboarding = lazy(() => import("./pages/Onboarding"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const GamePage = lazy(() => import("./pages/Game"));

function Home() {
  const { ready, uid, profile } = useSession();
  if (!ready) return <FullScreenLoader />;
  if (!uid) return <Landing />;
  if (!profile?.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/discover" replace />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, uid } = useSession();
  if (!ready) return <FullScreenLoader />;
  if (!uid) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireProfile({ children }: { children: ReactNode }) {
  const { ready, uid, profile } = useSession();
  if (!ready) return <FullScreenLoader />;
  if (!uid) return <Navigate to="/" replace />;
  if (!profile?.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function Shell() {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function RecoveryWatcher() {
  const { recovery } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (recovery) navigate("/reset", { replace: true });
  }, [recovery, navigate]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <SessionProvider>
          <LiveProvider>
            <RecoveryWatcher />
            <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset" element={<ResetPassword />} />
              <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route element={<RequireProfile><Shell /></RequireProfile>}>
                <Route path="/discover" element={<Discover />} />
                <Route path="/games" element={<Games />} />
                <Route path="/matches" element={<Matches />} />
                <Route path="/me" element={<Me />} />
              </Route>
              <Route path="/u/:id" element={<RequireProfile><ProfileView /></RequireProfile>} />
              <Route path="/game/:id" element={<RequireProfile><GamePage /></RequireProfile>} />
              <Route path="/me/edit/:section" element={<RequireProfile><EditProfile /></RequireProfile>} />
              <Route path="/settings" element={<RequireProfile><Settings /></RequireProfile>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </LiveProvider>
        </SessionProvider>
      </ToastProvider>
    </HashRouter>
  );
}
