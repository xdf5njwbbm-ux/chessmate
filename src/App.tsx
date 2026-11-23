import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { SessionProvider, useSession } from "./state/session";
import { ToastProvider } from "./state/toast";
import { LiveProvider } from "./state/live";
import { Shell } from "./components/Layout";
import { FullScreenLoader, PageLoader } from "./components/ui";
import Landing from "./pages/Landing";
import AuthPage, { ResetPassword } from "./pages/Auth";
import Home from "./pages/Home";

const Welcome = lazy(() => import("./pages/Welcome"));
const Play = lazy(() => import("./pages/Play"));
const ComputerGame = lazy(() => import("./pages/ComputerGame"));
const OnlineGame = lazy(() => import("./pages/OnlineGame"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Invite = lazy(() => import("./pages/Invite"));
const Learn = lazy(() => import("./pages/Learn"));
const LessonPage = lazy(() => import("./pages/Lesson"));
const TestPage = lazy(() => import("./pages/Test"));
const Practice = lazy(() => import("./pages/Practice"));
const Review = lazy(() => import("./pages/Review"));
const Listening = lazy(() => import("./pages/Listening"));
const Pronunciation = lazy(() => import("./pages/Pronunciation"));
const Conversation = lazy(() => import("./pages/Conversation"));
const Vocabulary = lazy(() => import("./pages/Vocabulary"));
const Stats = lazy(() => import("./pages/Stats"));
const Leaderboards = lazy(() => import("./pages/Leaderboards"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));

function Root() {
  const { ready, uid, profile } = useSession();
  if (!ready) return <FullScreenLoader />;
  if (!uid) return <Landing />;
  if (!profile) return <Navigate to="/welcome" replace />;
  return <Navigate to="/home" replace />;
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
  if (!uid) return <Navigate to={`/auth?mode=signin&next=${encodeURIComponent(window.location.hash.slice(1))}`} replace />;
  if (!profile) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

function RecoveryWatcher() {
  const { recovery } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (recovery) navigate("/reset", { replace: true });
  }, [recovery, navigate]);
  return null;
}

const lazyPage = (el: ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <SessionProvider>
          <LiveProvider>
            <RecoveryWatcher />
            <Routes>
              <Route path="/" element={<Root />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset" element={<ResetPassword />} />
              <Route path="/welcome" element={<RequireAuth><Suspense fallback={<FullScreenLoader />}><Welcome /></Suspense></RequireAuth>} />
              <Route element={<RequireProfile><Shell /></RequireProfile>}>
                <Route path="/home" element={<Home />} />
                <Route path="/play" element={lazyPage(<Play />)} />
                <Route path="/play/computer" element={lazyPage(<ComputerGame />)} />
                <Route path="/game/:id" element={lazyPage(<OnlineGame />)} />
                <Route path="/analysis/:id" element={lazyPage(<Analysis />)} />
                <Route path="/invite/:code" element={lazyPage(<Invite />)} />
                <Route path="/learn" element={lazyPage(<Learn />)} />
                <Route path="/learn/lesson/:id" element={lazyPage(<LessonPage />)} />
                <Route path="/learn/test/:id" element={lazyPage(<TestPage />)} />
                <Route path="/practice" element={lazyPage(<Practice />)} />
                <Route path="/practice/review" element={lazyPage(<Review />)} />
                <Route path="/practice/listening" element={lazyPage(<Listening />)} />
                <Route path="/practice/pronunciation" element={lazyPage(<Pronunciation />)} />
                <Route path="/practice/pronunciation/:id" element={lazyPage(<Pronunciation />)} />
                <Route path="/practice/conversation" element={lazyPage(<Conversation />)} />
                <Route path="/practice/conversation/:id" element={lazyPage(<Conversation />)} />
                <Route path="/vocabulary" element={lazyPage(<Vocabulary />)} />
                <Route path="/stats" element={lazyPage(<Stats />)} />
                <Route path="/leaderboards" element={lazyPage(<Leaderboards />)} />
                <Route path="/profile" element={lazyPage(<Profile />)} />
                <Route path="/u/:username" element={lazyPage(<Profile />)} />
                <Route path="/settings" element={lazyPage(<Settings />)} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </LiveProvider>
        </SessionProvider>
      </ToastProvider>
    </HashRouter>
  );
}
