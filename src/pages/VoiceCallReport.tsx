import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { voiceApi, type CallRow } from "../lib/voice/api";
import { Button, EmptyState, PageHeader, PageLoader, Spinner } from "../components/ui";
import { VoiceReport } from "../components/voice/Report";

/** A past call: its report, review lesson and transcript. */
export default function VoiceCallReport() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [call, setCall] = useState<CallRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    let alive = true;
    voiceApi.call(id).then(async (c) => {
      if (!alive) return;
      setCall(c);
      // a call that was never closed properly: finish it now
      if (c && !c.report) {
        setBuilding(true);
        try {
          await voiceApi.end(c.id, null, null, null);
          const again = await voiceApi.call(id);
          if (alive) setCall(again);
        } catch (e) {
          if (alive) setError((e as Error).message);
        } finally {
          if (alive) setBuilding(false);
        }
      }
    }).catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [id]);

  if (call === undefined && !error) return <PageLoader />;
  if (!call) return <EmptyState title="Call not found" body={error ?? "It may have been removed."} action={<Button onClick={() => navigate("/practice/voice")}>Back to voice practice</Button>} />;

  return (
    <div>
      <PageHeader back="/practice/voice" title="Call report" subtitle={new Date(call.started_at).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} />
      {call.report ? (
        <VoiceReport
          report={call.report}
          tutor={call.tutor}
          turns={call.transcript}
          startedAt={call.started_at}
          onStartLesson={(lesson) => navigate(`/practice/voice?lesson=${lesson}`)}
          onReviewCall={() => navigate(`/practice/voice?review=${call.id}`)}
        />
      ) : building ? (
        <div className="card flex items-center gap-3 p-6 text-mist"><Spinner className="size-5" /> Writing the report for this call…</div>
      ) : (
        <div className="card p-6 text-mist">{error ?? "This call doesn't have a report."}</div>
      )}
    </div>
  );
}
