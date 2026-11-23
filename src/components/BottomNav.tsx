import { NavLink } from "react-router-dom";
import { Compass, Heart, Swords, UserRound } from "lucide-react";
import { useLive } from "../state/live";

const tabs = [
  { to: "/discover", label: "Discover", Icon: Compass },
  { to: "/games", label: "Games", Icon: Swords },
  { to: "/matches", label: "Matches", Icon: Heart },
  { to: "/me", label: "Profile", Icon: UserRound },
];

export function BottomNav() {
  const { badge } = useLive();
  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/5">
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                isActive ? "text-gold" : "text-mist hover:text-fog"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className="size-6" strokeWidth={isActive ? 2.2 : 1.8} />
                  {to === "/games" && badge > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose px-1 text-[10px] font-bold text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
