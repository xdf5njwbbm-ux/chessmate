import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Link2 } from "lucide-react";
import { api } from "../lib/api";
import { tcLabel } from "../lib/constants";
import { useToast } from "../state/toast";
import { Button, EmptyState, Initials, LevelBadge, PageLoader, RatingBadge } from "../components/ui";

export default function Invite() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof api.inviteInfo>> | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.inviteInfo(code).then(setInfo).catch(() => setInfo(null));
  }, [code]);

  if (info === undefined) return <PageLoader />;
  if (!info) return <EmptyState icon={<Link2 className="size-7" />} title="Invite not found" body="This link isn't valid. Ask your friend to send a new one." action={<Button variant="secondary" onClick={() => navigate("/play")}>Go to Play</Button>} />;
  if (info.game_id) {
    return <EmptyState icon={<Link2 className="size-7" />} title="This game has started" action={<Button onClick={() => navigate(`/game/${info.game_id}`)}>Open game</Button>} />;
  }
  const open = info.status === "pending";
  const colorText = info.color === "random" ? "Colours are chosen at random." : `${info.from.display_name} plays ${info.color}.`;

  return (
    <div className="mx-auto max-w-md pt-10">
      <div className="card animate-rise p-6 text-center">
        <div className="flex justify-center"><Initials name={info.from.display_name} size={64} online={info.from.online} /></div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{info.mine ? "Your invite link" : `${info.from.display_name} challenges you`}</h1>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-mist">
          <LevelBadge level={info.from.ru_level} /> <RatingBadge rating={info.from.rating} status={info.from.rating_status} />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          <span className="tag">{tcLabel(info.time_control)}</span>
          <span className="tag">{info.rated ? "Rated" : "Casual"}</span>
          {info.russian_chat && <span className="tag">Russian-only chat</span>}
        </div>
        <p className="mt-3 text-sm text-mist">{colorText}</p>
        <div className="ru mt-4 text-lg">Давай сыграем!</div>
        {info.mine ? (
          <p className="mt-5 text-sm text-mist">Share this page's link with a friend. It stays open for 24 hours.</p>
        ) : open ? (
          <Button className="mt-6 w-full" size="lg" loading={busy} onClick={async () => {
            setBusy(true);
            try {
              navigate(`/game/${await api.acceptInvite(code)}`, { replace: true });
            } catch (e) {
              toast({ title: (e as Error).message, tone: "error" });
              setBusy(false);
            }
          }}>Accept and play</Button>
        ) : (
          <p className="mt-5 text-sm text-mist">This invite has {info.status === "expired" ? "expired" : "already been used"}.</p>
        )}
      </div>
    </div>
  );
}
