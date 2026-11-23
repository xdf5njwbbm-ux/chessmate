import { useNavigate } from "react-router-dom";
import { Heart, Sparkles, Swords } from "lucide-react";
import { Button, Logo } from "../components/ui";

const steps = [
  { Icon: Sparkles, title: "Match on personality", body: "Answer playful questions. We score compatibility, not chess skill." },
  { Icon: Swords, title: "Play a game", body: "Your first date is a match: blitz, rapid or a slow daily game." },
  { Icon: Heart, title: "Like each other", body: "After the final move, a mutual like makes it a match." },
];

function HeroBoard() {
  // a tilted 6×6 board fragment with two floating player cards
  const squares = Array.from({ length: 36 }, (_, i) => ((Math.floor(i / 6) + (i % 6)) % 2 === 0));
  const pieces: Record<number, string> = { 8: "♞", 15: "♛", 21: "♝", 26: "♜", 29: "♚" };
  return (
    <div className="relative mx-auto mt-8 h-[300px] w-full max-w-[340px]">
      <div
        className="absolute left-1/2 top-6 grid w-[230px] grid-cols-6 overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10"
        style={{ transform: "translateX(-50%) perspective(700px) rotateX(28deg) rotateZ(-8deg)" }}
      >
        {squares.map((light, i) => (
          <div
            key={i}
            className="grid aspect-square place-items-center text-2xl"
            style={{
              background: light ? "#dfe5f0" : "#5a6a8c",
              color: i === 15 || i === 29 ? "#0b1222" : "#fff",
              textShadow: i === 15 || i === 29 ? "none" : "0 1px 2px rgba(0,0,0,.5)",
              boxShadow: i === 8 || i === 21 ? "inset 0 0 0 100px rgba(227,185,100,.35)" : undefined,
            }}
          >
            {pieces[i] ? <span style={{ fontFamily: "serif" }}>{pieces[i]}&#xFE0E;</span> : null}
          </div>
        ))}
      </div>

      <div className="glass absolute left-0 top-0 flex animate-rise items-center gap-3 rounded-2xl border border-white/10 py-2.5 pl-2.5 pr-4 shadow-xl" style={{ animationDelay: "150ms" }}>
        <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-rose/80 to-gold/80 font-display text-lg font-semibold">S</div>
        <div>
          <div className="text-sm font-semibold">Sofia, 28</div>
          <div className="text-xs text-mist">1480 Elo · Rapid</div>
        </div>
        <div className="ml-1 rounded-full bg-gold/15 px-2 py-1 text-xs font-bold text-gold">94%</div>
      </div>

      <div className="glass absolute bottom-2 right-0 flex animate-rise items-center gap-3 rounded-2xl border border-white/10 py-2.5 pl-3 pr-4 shadow-xl" style={{ animationDelay: "320ms" }}>
        <div className="grid size-9 place-items-center rounded-full bg-rose">
          <Heart className="size-4 fill-white text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold">Good game!</div>
          <div className="text-xs text-mist">Sofia liked you back</div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-md flex-col px-6">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <button className="text-sm font-medium text-fog hover:text-white" onClick={() => navigate("/auth?mode=signin")}>
          Sign in
        </button>
      </header>

      <HeroBoard />

      <h1 className="mt-6 animate-rise font-display text-[44px] font-semibold leading-[1.02] tracking-tight">
        Play first.
        <br />
        <span className="gold-text">Fall later.</span>
      </h1>
      <p className="mt-4 animate-rise text-[17px] leading-relaxed text-fog" style={{ animationDelay: "80ms" }}>
        Chessmate matches you on personality, then lets you meet over a game of chess. You'll see their humor,
        nerve and sportsmanship before you ever say hello.
      </p>

      <div className="mt-8 grid animate-rise gap-3" style={{ animationDelay: "140ms" }}>
        <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
          Create your profile
        </Button>
        <Button size="lg" variant="secondary" onClick={() => navigate("/auth?mode=signin")}>
          I already have an account
        </Button>
      </div>

      <div className="mt-12 grid gap-3">
        {steps.map(({ Icon, title, body }, i) => (
          <div key={title} className="card flex animate-rise items-start gap-4 p-4" style={{ animationDelay: `${200 + i * 70}ms` }}>
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/10 text-gold">
              <Icon className="size-5" />
            </div>
            <div>
              <div className="font-semibold">{title}</div>
              <div className="mt-0.5 text-sm text-mist">{body}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="mb-6 mt-10 text-center text-xs text-mist">
        Chessmate is for adults 18+. Be kind, play fair, and report anyone who doesn't.
      </p>
    </div>
  );
}
