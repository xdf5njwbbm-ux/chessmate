import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bot, Copy, EyeOff, Link2, Search, Send, Swords, Users, X } from "lucide-react";
import { api } from "../lib/api";
import { POOLS, SUGGESTED_BOT_ELO, TIME_CONTROLS, bracket, tcLabel } from "../lib/constants";
import { ago, clock, pref, setPref } from "../lib/format";
import { BLIND_LEVELS, type BlindLevel } from "../lib/blindfold";
import type { ChallengeItem, GameSummary, Mini } from "../lib/types";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";
import { Button, Chip, Initials, LevelBadge, PageHeader, RatingBadge, SectionTitle, Segmented, Sheet, Spinner, Toggle } from "../components/ui";

export const inviteUrl = (code: string) => `${window.location.origin}${import.meta.env.BASE_URL}#/invite/${code}`;

function TimeControlPicker({ value, onChange, live }: { value: string; onChange: (v: string) => void; live?: boolean }) {
  return (
    <div className="grid gap-3">
      {POOLS.filter((p) => TIME_CONTROLS.some((t) => t.pool === p.id) && !(live && p.id === "daily")).map((p) => (
        <div key={p.id}>
          <div className="mb-1.5 text-xs font-semibold text-mist">{p.label} <span className="font-normal text-faint">· {p.hint}</span></div>
          <div className="flex flex-wrap gap-1.5">
            {TIME_CONTROLS.filter((t) => t.pool === p.id).map((t) => (
              <Chip key={t.id} on={value === t.id} onClick={() => onChange(t.id)}>{t.label}</Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Play() {
  const { profile } = useSession();
  const { inbox, refreshInbox } = useLive();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const onlineRef = useRef<HTMLDivElement>(null);

  const [botElo, setBotElo] = useState<number>(() => pref("botElo", SUGGESTED_BOT_ELO[profile?.chess_experience ?? "casual"] ?? 900));
  const [botColor, setBotColor] = useState<"white" | "black" | "random">(() => pref("botColor", "white"));
  const [tc, setTc] = useState<string>(() => pref("onlineTc", "rapid15_10"));
  const [rated, setRated] = useState<boolean>(() => pref("onlineRated", true));
  const [ruChat, setRuChat] = useState<boolean>(() => profile?.russian_chat ?? false);
  const [seeking, setSeeking] = useState<null | { waited: number; window: number; searching: number }>(null);
  const [friend, setFriend] = useState(false);
  const [botBlind, setBotBlind] = useState<boolean>(() => pref("botBlind", false));
  const [blindLevel, setBlindLevel] = useState<BlindLevel>(() => pref<BlindLevel>("blindLevel", "intermediate"));
  const [blind, setBlind] = useState<boolean>(() => pref("onlineBlind", false));

  useEffect(() => {
    if (params.get("mode") === "online") onlineRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [params]);
  useEffect(() => setPref("botElo", botElo), [botElo]);
  useEffect(() => setPref("botColor", botColor), [botColor]);
  useEffect(() => setPref("onlineTc", tc), [tc]);
  useEffect(() => setPref("onlineRated", rated), [rated]);
  useEffect(() => setPref("botBlind", botBlind), [botBlind]);
  useEffect(() => setPref("blindLevel", blindLevel), [blindLevel]);
  useEffect(() => setPref("onlineBlind", blind), [blind]);
  useEffect(() => {
    if (blind && TIME_CONTROLS.find((t) => t.id === tc)?.pool === "daily") setTc("rapid15_10");
  }, [blind, tc]);

  // matchmaking loop
  useEffect(() => {
    if (!seeking) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.findMatch(tc, rated, ruChat, blind);
        if (!alive) return;
        if ((r.status === "matched" || r.status === "in_game") && r.game_id) {
          setSeeking(null);
          if (r.status === "in_game") toast({ title: "You already have a game in progress." });
          navigate(`/game/${r.game_id}`);
          return;
        }
        setSeeking({ waited: r.waited_s ?? 0, window: r.window ?? 150, searching: r.searching ?? 1 });
      } catch (e) {
        if (!alive) return;
        setSeeking(null);
        toast({ title: (e as Error).message, tone: "error" });
      }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [seeking === null, tc, rated, ruChat, blind]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelSeek = async () => {
    setSeeking(null);
    try {
      const r = await api.cancelSeek();
      if (r.game_id) navigate(`/game/${r.game_id}`);
    } catch {
      /* ignore */
    }
  };

  const startBot = () => {
    const color = botColor === "random" ? (Math.random() < 0.5 ? "white" : "black") : botColor;
    navigate(`/play/${botBlind ? "blindfold" : "computer"}?elo=${botElo}&color=${color}`);
  };

  return (
    <div>
      <PageHeader title="Play chess" subtitle="Rated games are against people. Stockfish games are for practice and never change your rating." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06]"><Bot className="size-5 text-accent" /></div>
            <div>
              <div className="font-display text-xl font-semibold">Play Stockfish</div>
              <div className="text-sm text-mist">Unrated practice · undo allowed · Russian on every move</div>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-end justify-between">
              <div className="text-sm text-mist">Bot strength</div>
              <div className="text-2xl font-semibold tabular-nums">{botElo}</div>
            </div>
            <input type="range" className="range mt-3" min={100} max={3000} step={50} value={botElo} onChange={(e) => setBotElo(+e.target.value)} aria-label="Bot strength" />
            <div className="mt-2 flex justify-between text-xs text-faint"><span>100</span><span>{bracket(botElo)}</span><span>3000</span></div>
            <p className="mt-2 text-xs text-faint">
              {botElo >= 1320
                ? "Uses Stockfish's built-in strength limiter set to this Elo (Stockfish's own calibration)."
                : "Below 1320, the bot deliberately plays weaker moves to approximate this strength. It's an estimate."}{" "}
              Results never affect your rating.
            </p>
          </div>
          <div className="mt-3 divide-y divide-white/[0.06]">
            <Toggle checked={botBlind} onChange={setBotBlind} label={<span className="inline-flex items-center gap-1.5"><EyeOff className="size-4 text-gold" /> Blindfold</span>}
              hint="Pieces are invisible. Play from memory with spoken Russian announcements. Reveal the board any time." />
          </div>
          {botBlind && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1.5">
                {BLIND_LEVELS.map((l) => <Chip key={l.id} on={blindLevel === l.id} onClick={() => setBlindLevel(l.id)}>{l.label}</Chip>)}
              </div>
              <p className="mt-2 text-xs text-faint">{BLIND_LEVELS.find((l) => l.id === blindLevel)?.hint}</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Segmented value={botColor} onChange={setBotColor} options={[{ v: "white", l: "White" }, { v: "random", l: "Random" }, { v: "black", l: "Black" }]} />
            <Button onClick={startBot}>Start game</Button>
          </div>
        </div>

        <div className="card p-5" ref={onlineRef}>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06]"><Users className="size-5 text-accent" /></div>
            <div>
              <div className="font-display text-xl font-semibold">Play online</div>
              <div className="text-sm text-mist">Matched by rating with other Russian learners</div>
            </div>
          </div>
          {seeking ? (
            <div className="mt-8 flex flex-col items-center py-6 text-center">
              <Spinner className="size-9" />
              <div className="mt-4 font-semibold">Looking for an opponent · {tcLabel(tc)} {rated ? "rated" : "casual"}{blind ? " · blindfold" : ""}</div>
              <div className="mt-1 text-sm text-mist">
                {clock(seeking.waited * 1000)} · rating range ±{seeking.window} · {seeking.searching} searching
              </div>
              <Button variant="secondary" className="mt-5" onClick={cancelSeek}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <>
              <div className="mt-5"><TimeControlPicker value={tc} onChange={setTc} live={blind} /></div>
              <div className="mt-3 divide-y divide-white/[0.06]">
                <Toggle checked={rated} onChange={setRated} label="Rated" hint={blind ? "Counts toward your separate blindfold rating (5 placement games first)." : "Counts toward your Elo. New players play 5 placement games first."} />
                <Toggle checked={blind} onChange={setBlind} label={<span className="inline-flex items-center gap-1.5"><EyeOff className="size-4 text-gold" /> Blindfold</span>} hint="Both players' pieces are hidden. Matched only with other blindfold players." />
                <Toggle checked={ruChat} onChange={setRuChat} label="Russian-only chat" hint="Used when both players turn it on. Suggested phrases help you." />
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setFriend(true)}><Swords className="size-4" /> Challenge a friend</Button>
                <Button onClick={() => setSeeking({ waited: 0, window: 150, searching: 1 })}><Search className="size-4" /> Find opponent</Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Lists inbox={inbox} refresh={refreshInbox} />

      <FriendSheet open={friend} onClose={() => setFriend(false)} defaults={{ tc, rated, ruChat, blind }} onSent={refreshInbox} />
    </div>
  );
}

function Lists({ inbox, refresh }: { inbox: ReturnType<typeof useLive>["inbox"]; refresh: () => Promise<void> }) {
  if (!inbox) return null;
  const { incoming, outgoing, active } = inbox;
  return (
    <>
      {incoming.length > 0 && (
        <>
          <SectionTitle>Challenges for you</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{incoming.map((c) => <ChallengeRow key={c.id} c={c} incoming onDone={refresh} />)}</div>
        </>
      )}
      {active.length > 0 && (
        <>
          <SectionTitle>Games in progress</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{active.map((g) => <ActiveRow key={g.id} g={g} />)}</div>
        </>
      )}
      {outgoing.length > 0 && (
        <>
          <SectionTitle>Your open challenges</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{outgoing.map((c) => <ChallengeRow key={c.id} c={c} onDone={refresh} />)}</div>
        </>
      )}
    </>
  );
}

function ChallengeRow({ c, incoming, onDone }: { c: ChallengeItem; incoming?: boolean; onDone: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try {
      await fn();
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
      onDone();
    }
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        {c.user ? <Initials name={c.user.display_name} online={c.user.online} /> : <div className="grid size-10 place-items-center rounded-full bg-white/[0.06]"><Link2 className="size-4 text-mist" /></div>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{c.user ? c.user.display_name : "Invite link"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-mist">
            <span className="tag">{tcLabel(c.time_control)}</span>
            <span className={`tag ${c.rated ? "!bg-accent/10 !text-accent-soft" : ""}`}>{c.rated ? "Rated" : "Casual"}</span>
            {c.russian_chat && <span className="tag">RU chat</span>}
            {c.blindfold && <span className="tag !text-gold">Blindfold</span>}
            {c.user && <RatingBadge rating={c.user.rating} status={c.user.rating_status} />}
            <span>{ago(c.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {incoming ? (
          <>
            <Button size="sm" variant="secondary" loading={busy === "no"} onClick={() => run("no", async () => void (await api.respondChallenge(c.id, false)))}>Decline</Button>
            <Button size="sm" loading={busy === "yes"} onClick={() => run("yes", async () => { const g = await api.respondChallenge(c.id, true); if (g) navigate(`/game/${g}`); })}>Accept</Button>
          </>
        ) : (
          <>
            {c.invite_code && (
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(inviteUrl(c.invite_code!)).then(() => toast({ title: "Invite link copied" }))}>
                <Copy className="size-4" /> Copy link
              </Button>
            )}
            <Button size="sm" variant="ghost" loading={busy === "cancel"} onClick={() => run("cancel", () => api.cancelChallenge(c.id))}>Cancel</Button>
          </>
        )}
      </div>
    </div>
  );
}

function ActiveRow({ g }: { g: GameSummary }) {
  const navigate = useNavigate();
  const mine = (g.turn === "w") === (g.my_color === "white");
  return (
    <button onClick={() => navigate(`/game/${g.id}`)} className="card card-hover flex items-center gap-3 p-4 text-left">
      <Initials name={g.opponent?.display_name} online={g.opponent?.online} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{g.opponent?.display_name ?? "Opponent"}</div>
        <div className="text-xs text-mist">{tcLabel(g.time_control)} · {g.rated ? "Rated" : "Casual"}{g.blindfold ? " · Blindfold" : ""} · move {Math.floor(g.ply / 2) + 1}</div>
      </div>
      <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${mine ? "bg-accent/15 text-accent-soft" : "bg-white/[0.06] text-mist"}`}>{mine ? "Your move" : "Waiting"}</span>
    </button>
  );
}

function FriendSheet({ open, onClose, defaults, onSent }: { open: boolean; onClose: () => void; defaults: { tc: string; rated: boolean; ruChat: boolean; blind: boolean }; onSent: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Mini[]>([]);
  const [pick, setPick] = useState<Mini | null>(null);
  const [tc, setTc] = useState(defaults.tc);
  const [rated, setRated] = useState(false);
  const [ruChat, setRuChat] = useState(defaults.ruChat);
  const [color, setColor] = useState<"random" | "white" | "black">("random");
  const [blind, setBlind] = useState(defaults.blind);
  useEffect(() => {
    if (blind && TIME_CONTROLS.find((t) => t.id === tc)?.pool === "daily") setTc("rapid15_10");
  }, [blind, tc]);
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setPick(null);
      setLink(null);
    }
  }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => api.searchPlayers(q).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  const send = async () => {
    if (!pick) return;
    setBusy("send");
    try {
      await api.sendChallenge(pick.username, tc, rated, ruChat, color, blind);
      toast({ title: `Challenge sent to ${pick.display_name}`, tone: "success" });
      onSent();
      onClose();
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  };
  const invite = async () => {
    setBusy("link");
    try {
      const code = await api.createInvite(tc, rated, ruChat, color, blind);
      setLink(inviteUrl(code));
      onSent();
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Challenge a friend" wide>
      {link ? (
        <div>
          <p className="text-mist">Send this link to a friend. The game starts as soon as they open it and accept. It's valid for 24 hours.</p>
          <div className="mt-4 flex gap-2">
            <input readOnly className="field font-mono text-sm" value={link} onFocus={(e) => e.target.select()} />
            <Button onClick={() => navigator.clipboard?.writeText(link).then(() => toast({ title: "Copied" }))}><Copy className="size-4" /></Button>
          </div>
          {"share" in navigator && (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => navigator.share({ title: "Play chess with me", text: "Let's play a game on Russian Chess Academy!", url: link }).catch(() => {})}>
              <Send className="size-4" /> Share
            </Button>
          )}
        </div>
      ) : (
        <>
          <label className="text-sm font-medium text-fog">Find a player by username</label>
          <input className="field mt-2" placeholder="username" value={q} autoCapitalize="none" onChange={(e) => { setQ(e.target.value); setPick(null); }} />
          {!pick && results.length > 0 && (
            <div className="mt-2 grid gap-1">
              {results.map((u) => (
                <button key={u.id} onClick={() => { setPick(u); setQ(u.username); }} className="flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.05]">
                  <Initials name={u.display_name} size={32} online={u.online} />
                  <span className="flex-1"><span className="font-medium">{u.display_name}</span> <span className="text-sm text-mist">@{u.username}</span></span>
                  <LevelBadge level={u.ru_level} />
                </button>
              ))}
            </div>
          )}
          <div className="mt-5"><TimeControlPicker value={tc} onChange={setTc} live={blind} /></div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-mist">You play</span>
            <Segmented size="sm" value={color} onChange={setColor} options={[{ v: "white", l: "White" }, { v: "random", l: "Random" }, { v: "black", l: "Black" }]} />
          </div>
          <div className="mt-2 divide-y divide-white/[0.06]">
            <Toggle checked={rated} onChange={setRated} label="Rated" />
            <Toggle checked={ruChat} onChange={setRuChat} label="Russian-only chat" />
            <Toggle checked={blind} onChange={setBlind} label="Blindfold" hint="Pieces hidden for both players. Rated blindfold games use the blindfold rating." />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="secondary" loading={busy === "link"} onClick={invite}><Link2 className="size-4" /> Create invite link</Button>
            <Button disabled={!pick} loading={busy === "send"} onClick={send}><Send className="size-4" /> Send challenge</Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
