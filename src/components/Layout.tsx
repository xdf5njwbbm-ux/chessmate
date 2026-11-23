import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, House, Library, Menu, Mic, Settings, Swords, Trophy, UserRound } from "lucide-react";
import { useLive } from "../state/live";
import { useSession } from "../state/session";
import { Initials, LevelBadge, Logo, Sheet } from "./ui";

export const NAV = [
  { to: "/home", label: "Home", Icon: House },
  { to: "/play", label: "Play Chess", short: "Play", Icon: Swords },
  { to: "/learn", label: "Learn Russian", short: "Learn", Icon: BookOpen },
  { to: "/practice", label: "Practice", Icon: Mic },
  { to: "/vocabulary", label: "Vocabulary", Icon: Library },
  { to: "/stats", label: "Statistics", Icon: BarChart3 },
  { to: "/leaderboards", label: "Leaderboards", Icon: Trophy },
  { to: "/profile", label: "Profile", Icon: UserRound },
  { to: "/settings", label: "Settings", Icon: Settings },
];
const MOBILE = ["/home", "/play", "/learn", "/practice"];

/** Screens where the mobile bottom bar would steal space from the board or the exercise. */
const IMMERSIVE = [/^\/game\//, /^\/play\/computer/, /^\/learn\/lesson\//, /^\/learn\/test\//, /^\/practice\/(review|listening|pronunciation|conversation|phrases)/, /^\/analysis\//, /^\/welcome/];

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink-950">{n > 9 ? "9+" : n}</span>;
}

export function Shell() {
  const { profile } = useSession();
  const { badge } = useLive();
  const location = useLocation();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const immersive = IMMERSIVE.some((r) => r.test(location.pathname));

  return (
    <div className="min-h-dvh">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.06] bg-ink-900/80 px-4 py-6 backdrop-blur lg:flex">
        <button className="px-2 text-left" onClick={() => navigate("/home")} aria-label="Home">
          <Logo size={34} />
        </button>
        <nav className="mt-8 grid gap-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  isActive ? "bg-white/[0.07] text-white" : "text-mist hover:bg-white/[0.04] hover:text-fog"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`size-[18px] ${isActive ? "text-accent" : ""}`} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="flex-1">{label}</span>
                  {to === "/play" && <Badge n={badge} />}
                </>
              )}
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
            <LevelBadge level={profile.ru_level} />
          </button>
        )}
      </aside>

      <div className="lg:pl-64">
        <main className={`mx-auto w-full max-w-6xl px-4 pt-5 md:px-8 md:pt-8 ${immersive ? "pb-8" : "pb-28 lg:pb-12"}`}>
          <Outlet />
        </main>
      </div>

      {/* mobile bottom bar */}
      {!immersive && (
        <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] lg:hidden">
          <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
            {NAV.filter((n) => MOBILE.includes(n.to)).map(({ to, label, short, Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? "text-white" : "text-mist"}`}>
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon className={`size-[22px] ${isActive ? "text-accent" : ""}`} strokeWidth={isActive ? 2.2 : 1.8} />
                      {to === "/play" && badge > 0 && <span className="absolute -right-2.5 -top-1.5"><Badge n={badge} /></span>}
                    </span>
                    {short ?? label}
                  </>
                )}
              </NavLink>
            ))}
            <button onClick={() => setMore(true)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-mist">
              <Menu className="size-[22px]" strokeWidth={1.8} />
              More
            </button>
          </div>
        </nav>
      )}

      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="grid grid-cols-2 gap-2">
          {NAV.filter((n) => !MOBILE.includes(n.to)).map(({ to, label, Icon }) => (
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
