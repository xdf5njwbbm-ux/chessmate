import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { deleteAllMyPhotos } from "../lib/photos";
import { supabase } from "../lib/supabase";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { Avatar, Button, SectionTitle, Sheet, Toggle, TopBar } from "../components/ui";
import { useSaveProfile } from "../components/ProfileSteps";

export default function Settings() {
  const { profile, uid, session, signOut } = useSession();
  const save = useSaveProfile();
  const navigate = useNavigate();
  const toast = useToast();
  const [blocked, setBlocked] = useState<{ id: string; first_name: string; photo: string | null }[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBlocked = () => api.blocked().then(setBlocked).catch(() => setBlocked([]));
  useEffect(() => {
    loadBlocked();
  }, []);

  if (!profile) return null;

  const set = async (patch: Parameters<typeof save>[0]) => {
    try {
      await save(patch);
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-10">
      <TopBar back="/me" title="Settings & privacy" />
      <main className="px-4">
        <SectionTitle>Privacy</SectionTitle>
        <div className="card divide-y divide-white/5 px-4">
          <Toggle
            checked={profile.discoverable}
            onChange={(v) => set({ discoverable: v })}
            label="Show me in Discover"
            hint="Turn off to take a break. Your matches and games stay."
          />
          <Toggle checked={profile.show_online} onChange={(v) => set({ show_online: v })} label="Show when I'm online" />
          <Toggle checked={profile.show_distance} onChange={(v) => set({ show_distance: v })} label="Show my distance" hint="Others will only see your city." />
        </div>

        <SectionTitle>Blocked</SectionTitle>
        <div className="card divide-y divide-white/5">
          {blocked === null ? (
            <div className="px-4 py-4 text-sm text-mist">Loading…</div>
          ) : blocked.length === 0 ? (
            <div className="px-4 py-4 text-sm text-mist">You haven't blocked anyone.</div>
          ) : (
            blocked.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar path={b.photo} name={b.first_name} size={36} />
                <span className="flex-1 font-medium">{b.first_name}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await api.unblock(b.id).catch(() => {});
                    toast({ title: `${b.first_name} unblocked` });
                    loadBlocked();
                  }}
                >
                  Unblock
                </Button>
              </div>
            ))
          )}
        </div>

        <SectionTitle>Account</SectionTitle>
        <div className="card divide-y divide-white/5">
          <div className="px-4 py-3.5 text-sm">
            <div className="text-mist">Signed in as</div>
            <div className="mt-0.5 font-medium">{session?.user.email}</div>
          </div>
          <button
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            onClick={async () => {
              await signOut();
              navigate("/", { replace: true });
            }}
          >
            <LogOut className="size-5 text-mist" /> Sign out
          </button>
          <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[#ffb3b3]" onClick={() => setDeleting(true)}>
            <Trash2 className="size-5" /> Delete account
          </button>
        </div>
        <p className="mt-8 text-center text-xs text-mist">Chessmate · Play first. Fall later.</p>
      </main>

      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete your account?">
        <p className="text-fog">
          This permanently deletes your profile, photos, answers, matches and challenges. Games in progress end. This can't be undone.
        </p>
        <p className="mt-4 text-sm text-mist">
          Type <span className="font-semibold text-white">DELETE</span> to confirm.
        </p>
        <input className="field mt-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="characters" />
        <Button
          className="mt-4 w-full"
          size="lg"
          variant="danger"
          disabled={confirmText.trim() !== "DELETE"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteAllMyPhotos(uid!);
              await api.deleteAccount();
              await supabase.auth.signOut().catch(() => {});
              toast({ title: "Your account has been deleted" });
              navigate("/", { replace: true });
            } catch (e) {
              toast({ title: "Couldn't delete your account", body: (e as Error).message, tone: "error" });
            } finally {
              setBusy(false);
            }
          }}
        >
          Permanently delete
        </Button>
      </Sheet>
    </div>
  );
}
