import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, ChevronLeft, Ellipsis, Flag, Heart, HeartOff, MapPin, Pencil, Swords, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { EXPERIENCE, INTENTIONS, PLAY_STYLES, TIME_CONTROLS } from "../lib/constants";
import { miles } from "../lib/format";
import type { FullProfile, Question } from "../lib/types";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { useLive } from "../state/live";
import { Button, CompatRing, Confirm, EmptyState, FullScreenLoader, SectionTitle, Sheet } from "../components/ui";
import { PhotoCarousel } from "../components/PhotoCarousel";
import { ChallengeSheet } from "../components/ChallengeSheet";
import { ReportSheet } from "../components/ReportSheet";

const HIGHLIGHT_QS = ["f_first_date", "f_trash_talk", "f_beaten", "c_queen_sac", "d_first_date", "f_smart_funny", "c_good_loser", "f_let_win"];

function personalityTags(a: Record<string, string[]>): string[] {
  const one = (q: string) => a[q]?.[0];
  const tags: string[] = [];
  if (one("c_style")) tags.push(`${PLAY_STYLES[one("c_style")!]} player`);
  if (one("c_win") === "win") tags.push("Plays to win");
  if (one("c_win") === "fun") tags.push("Plays for fun");
  if (one("c_good_loser") === "gracious") tags.push("Good sport");
  if (one("f_trash_talk") === "love") tags.push("Trash talker");
  if (one("f_trash_talk") === "classy") tags.push("Classy competitor");
  if (one("c_queen_sac") === "heartbeat") tags.push("Risk taker");
  if (one("d_travel") === "love") tags.push("Traveler");
  if (one("d_travel") === "homebody") tags.push("Homebody");
  if (one("d_spontaneous") === "spontaneous") tags.push("Spontaneous");
  if (one("d_spontaneous") === "organized") tags.push("Planner");
  if (one("f_smart_funny") === "funnier") tags.push("Humor first");
  if (one("d_contact") === "call") tags.push("Prefers calls");
  return tags.slice(0, 6);
}

function answerText(q: Question | undefined, vals: string[] | undefined) {
  if (!q || !vals) return "";
  return vals.map((v) => q.options.find((o) => o.v === v)?.l ?? v).join(", ");
}

export default function ProfileView() {
  const { id } = useParams();
  const { questions } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshInbox } = useLive();
  const [p, setP] = useState<FullProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [confirm, setConfirm] = useState<null | "block" | "unmatch">(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setP(await api.profile(id!));
    } catch (e) {
      setError((e as Error).message);
      setP(null);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (p === undefined) return <FullScreenLoader />;
  if (!p) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<UserRound className="size-8" />}
          title="Profile unavailable"
          body={error ?? "This person may have paused or deleted their profile."}
          action={<Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>}
        />
      </div>
    );
  }

  const qMap = Object.fromEntries(questions.map((q) => [q.id, q]));
  const rel = p.relationship;
  const intent = INTENTIONS.find((i) => i.v === p.intentions);
  const tags = personalityTags(p.answers);
  const highlights = HIGHLIGHT_QS.filter((q) => p.answers[q] && qMap[q]).slice(0, 4);
  const sharedQs = p.shared_answers.filter((q) => qMap[q] && q !== "c_style").slice(0, 3);
  const where = miles(p.distance_km) ?? p.city;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-32">
      <PhotoCarousel
        photos={p.photos}
        name={p.first_name}
        overlay={
          <>
            <div className="safe-top absolute inset-x-0 top-3 flex justify-between px-3">
              <button aria-label="Back" onClick={() => navigate(-1)} className="glass grid size-10 place-items-center rounded-full">
                <ChevronLeft className="size-6" />
              </button>
              {!p.is_me && (
                <button aria-label="More" onClick={() => setMenu(true)} className="glass grid size-10 place-items-center rounded-full">
                  <Ellipsis className="size-5" />
                </button>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
              {rel?.matched && (
                <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-rose/90 px-3 py-1 text-xs font-bold">
                  <Heart className="size-3.5 fill-white" /> Matched
                </span>
              )}
              <h1 className="font-display text-[40px] font-semibold leading-none tracking-tight">
                {p.first_name}
                <span className="ml-2 font-sans text-3xl font-normal text-fog">{p.age}</span>
              </h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-fog">
                {where && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" /> {where}
                  </span>
                )}
                {p.online && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-mint" /> Online
                  </span>
                )}
              </div>
            </div>
          </>
        }
      />

      <div className="px-4">
        {!p.is_me && (
          <div className="card mt-4 flex animate-rise items-center gap-4 p-4">
            <CompatRing value={p.compat} size={72} stroke={6} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">You're a {p.compat}% match</div>
              <div className="mt-1 text-sm text-mist">
                {p.shared_interests.length
                  ? `You both love ${p.shared_interests.slice(0, 3).join(", ")}`
                  : sharedQs.length
                    ? "You think alike on the questions that matter"
                    : "Opposites attract? Find out over the board."}
              </div>
            </div>
          </div>
        )}

        {sharedQs.length > 0 && (
          <div className="mt-3 grid gap-2">
            {sharedQs.map((q) => (
              <div key={q} className="flex items-start gap-3 rounded-2xl bg-gold/[0.07] px-4 py-3 text-sm">
                <Heart className="mt-0.5 size-4 shrink-0 fill-gold/40 text-gold" />
                <span>
                  <span className="text-mist">{qMap[q].prompt}</span> <span className="font-semibold">Both: {answerText(qMap[q], p.answers[q])}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <SectionTitle>About</SectionTitle>
        <div className="card p-4">
          <p className="whitespace-pre-line leading-relaxed text-fog">{p.bio}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {intent && (
              <span className="tag">
                {intent.emoji} {intent.l}
              </span>
            )}
            {tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>

        <SectionTitle>Chess</SectionTitle>
        <div className="card grid grid-cols-3 divide-x divide-white/5 py-4 text-center">
          <div>
            <div className="text-2xl font-semibold">{p.elo ?? "—"}</div>
            <div className="mt-0.5 text-xs text-mist">Elo{p.elo ? " (self-reported)" : ""}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-gold">{p.rating}</div>
            <div className="mt-0.5 text-xs text-mist">Chessmate rating</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {p.stats.wins}
              <span className="text-mist">–</span>
              {p.stats.losses}
              <span className="text-mist">–</span>
              {p.stats.draws}
            </div>
            <div className="mt-0.5 text-xs text-mist">W–L–D</div>
          </div>
        </div>
        <div className="card mt-2 divide-y divide-white/5 px-4">
          {[
            ["Experience", EXPERIENCE.find((e) => e.v === p.experience)?.l],
            ["Playing style", p.play_style ? PLAY_STYLES[p.play_style] : null],
            ["Favorite opening", p.opening ? answerText(qMap["c_opening"], [p.opening]) : null],
            ["Plays", p.formats.map((f) => TIME_CONTROLS.find((t) => t.v === f)?.short).join(" · ")],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 text-sm">
                <span className="text-mist">{k}</span>
                <span className="text-right font-medium">{v}</span>
              </div>
            ))}
        </div>

        {p.interests.length > 0 && (
          <>
            <SectionTitle>Interests</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {p.interests.map((i) => (
                <span key={i} className={`chip ${p.shared_interests.includes(i) ? "!border-gold/50 !text-gold" : ""}`}>
                  {i}
                </span>
              ))}
            </div>
          </>
        )}

        {highlights.length > 0 && (
          <>
            <SectionTitle>In their words</SectionTitle>
            <div className="grid gap-2">
              {highlights.map((q) => (
                <div key={q} className="card p-4">
                  <div className="text-sm text-mist">{qMap[q].prompt}</div>
                  <div className="mt-1 font-display text-xl font-semibold">{answerText(qMap[q], p.answers[q])}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* action bar */}
      <div className="glass safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/5">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          {p.is_me ? (
            <Button className="flex-1" size="lg" variant="secondary" onClick={() => navigate("/me")}>
              <Pencil className="size-4" /> Edit my profile
            </Button>
          ) : rel?.active_game ? (
            <Button className="flex-1" size="lg" onClick={() => navigate(`/game/${rel.active_game}`)}>
              <Swords className="size-5" /> Resume your game
            </Button>
          ) : rel?.incoming_challenge ? (
            <>
              <Button
                variant="secondary"
                size="lg"
                loading={busy}
                onClick={() =>
                  act(async () => {
                    await api.respondChallenge(rel.incoming_challenge!, false);
                    refreshInbox();
                    load();
                  })
                }
              >
                Decline
              </Button>
              <Button
                className="flex-1"
                size="lg"
                loading={busy}
                onClick={() =>
                  act(async () => {
                    const g = await api.respondChallenge(rel.incoming_challenge!, true);
                    refreshInbox();
                    if (g) navigate(`/game/${g}`);
                  })
                }
              >
                Accept challenge
              </Button>
            </>
          ) : rel?.outgoing_challenge ? (
            <>
              <div className="flex flex-1 items-center gap-2 rounded-full bg-white/5 px-5 text-sm text-fog">
                <Swords className="size-4 text-gold" /> Challenge sent
              </div>
              <Button
                variant="ghost"
                size="lg"
                loading={busy}
                onClick={() =>
                  act(async () => {
                    await api.cancelChallenge(rel.outgoing_challenge!);
                    refreshInbox();
                    load();
                  })
                }
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button className="flex-1" size="lg" onClick={() => setChallengeOpen(true)}>
              <Swords className="size-5" /> {rel?.games_played ? `Play ${p.first_name} again` : `Challenge ${p.first_name}`}
            </Button>
          )}
        </div>
      </div>

      <ChallengeSheet open={challengeOpen} onClose={() => setChallengeOpen(false)} user={p} theirFormats={p.formats} onSent={load} />

      <Sheet open={menu} onClose={() => setMenu(false)} title={p.first_name}>
        <div className="grid gap-2">
          {rel?.matched && (
            <button className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 text-left" onClick={() => (setMenu(false), setConfirm("unmatch"))}>
              <HeartOff className="size-5 text-mist" /> Unmatch
            </button>
          )}
          <button className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 text-left" onClick={() => (setMenu(false), setReport(true))}>
            <Flag className="size-5 text-mist" /> Report {p.first_name}
          </button>
          <button className="flex items-center gap-3 rounded-2xl bg-danger/10 px-4 py-3.5 text-left text-[#ffb3b3]" onClick={() => (setMenu(false), setConfirm("block"))}>
            <Ban className="size-5" /> Block {p.first_name}
          </button>
        </div>
      </Sheet>

      <ReportSheet open={report} onClose={() => setReport(false)} user={p} onBlocked={() => navigate("/discover", { replace: true })} />

      <Confirm
        open={confirm === "block"}
        onClose={() => setConfirm(null)}
        title={`Block ${p.first_name}?`}
        body={`You won't see each other anywhere on Chessmate. Any open challenges are cancelled and a game in progress ends. You can unblock in Settings.`}
        confirmLabel="Block"
        danger
        onConfirm={async () => {
          await api.block(p.id);
          toast({ title: `${p.first_name} is blocked` });
          refreshInbox();
          navigate("/discover", { replace: true });
        }}
      />
      <Confirm
        open={confirm === "unmatch"}
        onClose={() => setConfirm(null)}
        title={`Unmatch ${p.first_name}?`}
        body="You'll both be removed from each other's matches. You can still play again later."
        confirmLabel="Unmatch"
        danger
        onConfirm={async () => {
          await api.unmatch(p.id);
          toast({ title: "Unmatched" });
          load();
        }}
      />
    </div>
  );
}
