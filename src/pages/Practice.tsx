import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioLines, Headphones, MessagesSquare, Mic, Repeat2, Smile, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import type { Dashboard } from "../lib/types";
import { useSession } from "../state/session";
import { PageHeader } from "../components/ui";

export default function Practice() {
  const navigate = useNavigate();
  const { tutorAI, speech } = useSession();
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => {
    api.dashboard().then(setD).catch(() => {});
  }, []);

  const tiles = [
    { to: "/practice/roleplay", Icon: AudioLines, title: "Real conversations", ru: "Разговор", body: "Talk with a Russian speaker who remembers what you said, asks follow-ups and corrects you — 20 role-plays, quick answers, a 10-reply challenge.", stat: "A1–B2" },
    { to: "/learn/how-are-you", Icon: Smile, title: "How are you?", ru: "Как дела?", body: "100 ways to answer — listen and repeat, flashcards, quizzes and a simulator where different people ask how you are.", stat: "A1–B2" },
    { to: "/practice/talk", Icon: MessagesSquare, title: "Conversations", ru: "Вопросы и ответы", body: "Everyday questions from the conversation lessons — one by one, as a random conversation, or just the ones you missed.", stat: "A1–A2" },
    { to: "/practice/review", Icon: Repeat2, title: "Review", ru: "Повторение", body: "Spaced repetition of your words and saved phrases. Missed items come back sooner.", stat: d ? `${d.russian.due_reviews} due now` : "" },
    { to: "/practice/listening", Icon: Headphones, title: "Listening", ru: "Аудирование", body: "Hear sentences from your level and pick what you heard or what it means.", stat: d && d.russian.listening.total ? `${Math.round((100 * d.russian.listening.correct) / d.russian.listening.total)}% accuracy` : "" },
    { to: "/practice/pronunciation", Icon: Mic, title: "Pronunciation", ru: "Произношение", body: speech.assess ? "Milestones from the alphabet to intonation, scored 0–100 by a pronunciation engine." : "Milestones from the alphabet to intonation. Record yourself and see which words came through clearly.", stat: d ? `${d.russian.speaking.attempts} attempts` : "" },
    { to: "/practice/conversation", Icon: AudioLines, title: "Conversation", ru: "Разговор", body: tutorAI ? "Talk with an AI Russian partner in real-life scenarios, by voice or text, with gentle corrections." : "Guided real-life conversations — order coffee, make plans, review a game — by voice or text.", stat: tutorAI ? "AI tutor" : "Guided" },
  ];

  return (
    <div>
      <PageHeader back="/learn" title="Practice" subtitle="Short, focused sessions. Everything you practise counts toward today's objectives and your streak." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tiles.map(({ to, Icon, title, ru, body, stat }) => (
          <button key={to} onClick={() => navigate(to)} className="card card-hover flex flex-col p-6 text-left">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent"><Icon className="size-5" /></div>
              <div>
                <div className="font-display text-xl font-semibold">{title}</div>
                <div className="ru text-mist">{ru}</div>
              </div>
              {stat && <span className="ml-auto text-sm text-mist">{stat}</span>}
            </div>
            <p className="mt-4 text-mist">{body}</p>
          </button>
        ))}
      </div>
      {d && d.objectives.sentences < 5 && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm text-mist">
          <Sparkles className="size-4 text-gold" /> Today: {d.objectives.sentences}/5 sentences practised. Listening, speaking and conversation all count.
        </div>
      )}
    </div>
  );
}
