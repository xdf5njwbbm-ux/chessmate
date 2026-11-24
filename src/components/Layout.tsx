import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bot, BookOpen, House, Menu, Settings, Trophy, UserRound, Users } from "lucide-react";
import { useLive } from "../state/live";
import { useLearner, useSession } from "../state/session";
import { Initials, LevelBadge, Logo, Sheet } from "./ui";

/** The four things you come here to do. Chess-only accounts don't see Learn Russian. */
export const NAV = [
  { to: "/play/solo", label: "Play Solo", short: "Play Solo", Icon: Bot, match: [/^\/play\/(solo|computer|blindfold)/] },
  { to: "/play/friend", label: "Play With a Friend", short: "With a Friend", Icon: Users, match: [/^\/play\/friend/, /^\/game\//, /^\/invite\//] },
  { to: "/learn", label: "Learn Russian", short: "Learn Russian", Icon: BookOpen, learner: true, match: [/^\/learn/, /^\/practice/, /^\/vocabulary/] },
  { to: "/stats", label: "My Progress", short: "My Progress", Icon: BarChart3, match: [/^\/stats/, /^\/analysis\//] },
];
/** Everything else lives under More (and the logo goes home). */
const MORE = [
  { to: "/home", label: "Home", Icon: House },
  { to: "/profile", label: "Profile", Icon: UserRound },
  { to: "/leaderboards", label: "Leaderboards", Icon: Trophy },
  { to: "/settings", label: "Settings", Icon: Settings },
];

/** Screens where the mobile bottom bar would steal space from the board or the exercise. */
const IMMERSIVE = [/^\/game\//, /^\/play\/computer/, /^\/play\/blindfold/, /^\/learn\/lesson\//, /^\/learn\/test\//, /^\/practice\/(review|listening|pronunciation|conversation|phrases)/, /^\/analysis\//, /^\/welcome/];

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink-950">{n > 9 ? "9+" : n}</span>;
}

export function Shell() {
  const { profile } = useSession();
  const learner = useLearner();
  const { badge } = useLive();
  const nav = NAV.filter((n) => learner || !n.learner);
  const on = (n: (typeof NAV)[number]) => n.match.some((r) => r.test(location.pathname));
  const location = useLocation();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const immersive = IMMERSIVE.some((r) => r.test(location.pathname));
  const scroller = useRef<HTMLDivElement>(null);

  // Each screen opens at the top. A layout effect so it runs before a page's own scrollIntoView.
  useLayoutEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [location.pathname]);

  /*
   * On phones the bottom bar is docked, not `position: fixed`: the shell fills the screen, only the
   * content area scrolls, and the bar sits under it in normal layout. iOS Safari shrinks and grows its
   * toolbar while the page itself scrolls, and fixed bars get stranded mid-screen when it does. Here the
   * page never scrolls, so the toolbar stays put and the bar stays right above it.
   * Immersive screens (no bar) and desktop keep ordinary page scrolling.
   */
  return (
    <div data-docked-nav={immersive ? undefined : ""} className={immersive ? "min-h-dvh" : "fixed inset-0 flex flex-col lg:static lg:block lg:min-h-dvh"}>
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.06] bg-ink-900/80 px-4 py-6 backdrop-blur lg:flex">
        <button className="px-2 text-left" onClick={() => navigate("/home")} aria-label="Home">
          <Logo size={34} />
        </button>
        <nav className="mt-8 grid gap-1">
          {nav.map((n) => {
            const active = on(n);
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold transition-colors ${
                  active ? "bg-white/[0.07] text-white" : "text-mist hover:bg-white/[0.04] hover:text-fog"
                }`}
              >
                <n.Icon className={`size-5 ${active ? "text-accent" : ""}`} strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1">{n.label}</span>
                {n.to === "/play/friend" && <Badge n={badge} />}
              </NavLink>
            );
          })}
        </nav>
        <nav className="mt-6 grid gap-0.5 border-t border-white/[0.06] pt-4">
          {MORE.filter((m) => m.to !== "/home").map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? "text-white" : "text-mist hover:text-fog"}`}>
              <Icon className="size-4" strokeWidth={1.8} /> {label}
            </NavLink>
          ))}
        </nav>
        {profile && (
          <button onClick={() => navigate("/profile")} className="mt-auto flex items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.04]">
            <Initials name={profile.display_name} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{profile.display_name}</div>
              <div className="truncate text-xs text-mist">@{profile.username}</div>
            </div>
            {learner && <LevelBadge level={profile.ru_level} />}
          </button>
        )}
      </aside>

      <div ref={scroller} className={immersive ? "lg:pl-64" : "min-h-0 flex-1 overflow-y-auto overscroll-y-contain lg:overflow-visible lg:pl-64"}>
        <main className={`mx-auto w-full max-w-6xl px-4 pt-5 md:px-8 md:pt-8 ${immersive ? "pb-8" : "pb-8 lg:pb-12"}`}>
          <Outlet />
        </main>
      </div>

      {/* mobile bottom bar, docked under the scrolling content */}
      {!immersive && (
        <nav className="safe-bottom relative z-40 shrink-0 border-t border-white/[0.06] bg-ink-900 lg:hidden">
          <div className={`mx-auto grid h-16 max-w-xl ${nav.length === 4 ? "grid-cols-5" : "grid-cols-4"}`}>
            {nav.map((n) => {
              const active = on(n);
              return (
                <NavLink key={n.to} to={n.to} className={`relative flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[10.5px] font-medium leading-tight ${active ? "text-white" : "text-mist"}`}>
                  <span className="relative">
                    <n.Icon className={`size-[22px] ${active ? "text-accent" : ""}`} strokeWidth={active ? 2.2 : 1.8} />
                    {n.to === "/play/friend" && badge > 0 && <span className="absolute -right-2.5 -top-1.5"><Badge n={badge} /></span>}
                  </span>
                  {n.short}
                </NavLink>
              );
            })}
            <button onClick={() => setMore(true)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-mist">
              <Menu className="size-[22px]" strokeWidth={1.8} />
              More
            </button>
          </div>
        </nav>
      )}

      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="grid grid-cols-2 gap-2">
          {MORE.map(({ to, label, Icon }) => (
            <button
              key={to}
              onClick={() => {
                setMore(false);
                navigate(to);
              }}
              className="card card-hover flex items-center gap-3 p-4 text-left font-medium"
            >
              <Icon className="size-5 text-accent" />
              {label}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
