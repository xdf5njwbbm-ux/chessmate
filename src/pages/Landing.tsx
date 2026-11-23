import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioLines, BookOpen, Crown, Mic, Swords, Trophy } from "lucide-react";
import { Button, Logo, Segmented } from "../components/ui";

const SAME_MOVE = {
  A1: { ru: "Я защищаю короля.", en: "I protect the king." },
  A2: { ru: "Я хочу защитить своего короля.", en: "I want to protect my king." },
  B1: { ru: "Я решил защитить короля, потому что он находится под угрозой.", en: "I decided to protect the king because he is under threat." },
  B2: { ru: "Я предпочёл укрепить позицию короля, поскольку соперник начал создавать непосредственные угрозы.", en: "I preferred to strengthen the king's position because my opponent started creating immediate threats." },
} as const;

const FEATURES = [
  { Icon: Swords, title: "Russian on every move", body: "Each move you play becomes a short phrase, its vocabulary and grammar — at your level, in a panel beside the board." },
  { Icon: BookOpen, title: "A full A1–B2 course", body: "56 lessons across 25 everyday topics plus chess talk, with word-by-word breakdowns, grammar and level tests." },
  { Icon: Mic, title: "Listen and speak", body: "Hear every sentence at full or slow speed, record yourself, and see which words came through clearly." },
  { Icon: Trophy, title: "A real Elo ladder", body: "Placement games, provisional ratings, separate pools for each time control and leaderboards. Server-checked moves." },
  { Icon: AudioLines, title: "Conversation practice", body: "Order coffee, meet a friend, review a game with a coach — guided scenarios from A1 to B2." },
  { Icon: Crown, title: "Two progressions, never mixed", body: "Your Russian level and your chess rating grow separately. Neither one ever inflates the other." },
];

export default function Landing() {
  const navigate = useNavigate();
  const [lvl, setLvl] = useState<keyof typeof SAME_MOVE>("A1");
  return (
    <div className="min-h-dvh">
      <header className="safe-top mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Logo size={34} />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth?mode=signin")}>Sign in</Button>
          <Button size="sm" onClick={() => navigate("/auth")}>Get started</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 md:px-8">
        <section className="grid grid-cols-1 items-center gap-10 py-10 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-rise">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Русский · Шахматы</div>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Learn Russian.<br />Think in Russian.<br /><span className="text-accent">Play chess.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-fog">
              A serious Russian course built around real chess games. Go from your first «Привет!» to natural B2 conversation while you become a stronger player.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate("/auth")}>Start learning — free</Button>
              <Button size="lg" variant="secondary" onClick={() => navigate("/auth?mode=signin")}>I have an account</Button>
            </div>
          </div>

          <div className="card animate-rise p-6" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-mist">The same move at every level</div>
              <Segmented size="sm" value={lvl} onChange={setLvl} options={(["A1", "A2", "B1", "B2"] as const).map((v) => ({ v, l: v }))} />
            </div>
            <div key={lvl} className="mt-6 min-h-[150px] animate-fade-in">
              <div className="ru text-2xl leading-snug md:text-[28px]">{SAME_MOVE[lvl].ru}</div>
              <div className="mt-3 text-mist">{SAME_MOVE[lvl].en}</div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-5 text-center">
              <div><div className="text-2xl font-semibold">A1–B2</div><div className="text-xs text-mist">Russian levels</div></div>
              <div><div className="text-2xl font-semibold">100–2500+</div><div className="text-xs text-mist">Elo brackets</div></div>
              <div><div className="text-2xl font-semibold">552</div><div className="text-xs text-mist">glossed sentences</div></div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 pb-20 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="card p-6">
              <Icon className="size-6 text-accent" />
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-mist">{body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-faint">
        Russian Chess Academy · Chess engine: Stockfish (GPLv3)
      </footer>
    </div>
  );
}
