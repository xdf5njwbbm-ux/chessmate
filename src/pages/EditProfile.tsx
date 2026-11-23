import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PROFILE_STEPS } from "../components/ProfileSteps";
import { TopBar } from "../components/ui";
import { useToast } from "../state/toast";

const TITLES: Record<string, string> = {
  basics: "Basics",
  looking: "Dating preferences",
  location: "Location",
  photos: "Photos",
  about: "About me",
  chess: "Chess",
  interests: "Interests",
  "q-chess": "Chess personality",
  "q-fun": "Fun questions",
  "q-dating": "Dating questions",
};

export default function EditProfile() {
  const { section = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const def = PROFILE_STEPS.find((s) => s.key === section);
  if (!def) return <Navigate to="/me" replace />;
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <TopBar back="/me" title={TITLES[section]} />
      <div className="animate-rise px-5 pt-2">
        <p className="text-fog">{def.subtitle}</p>
        <def.Component
          cta={section === "photos" ? "Done" : "Save"}
          onDone={() => {
            if (section !== "photos") toast({ title: "Saved", tone: "success" });
            navigate("/me");
          }}
        />
      </div>
    </div>
  );
}
