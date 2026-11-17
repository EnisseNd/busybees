import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import { requireUser } from "@/lib/auth";
import { draftFromStored, emptyDraft } from "@/lib/questionnaire";
import { cardClass, secondaryButtonClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Questionnaire",
};

export default function QuestionnairePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gold">Friend matching</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Tell us who to look for</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        The first five steps are for friends. The last step is optional and only turns on study
        buddies. You can edit this later. Matching reads the latest version each week.
      </p>
      <div className={`${cardClass} mt-6`}>
        <Suspense fallback={<p className="text-sm text-muted">Loading your answers…</p>}>
          <QuestionnaireLoader />
        </Suspense>
      </div>
    </main>
  );
}

async function QuestionnaireLoader() {
  const profile = await requireUser();
  if (profile.needsProfile) {
    return (
      <div>
        <p className="text-sm leading-6 text-ink">
          This account is signed in, but the profile row never landed. Sign out and create the
          account again with your college and class year.
        </p>
        <form action={signOut} className="mt-4">
          <button className={secondaryButtonClass} type="submit">
            Sign out
          </button>
        </form>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("questionnaires")
    .select("answers, looking_for_study_buddy")
    .eq("user_id", profile.id)
    .maybeSingle();

  const row = data as { answers: unknown; looking_for_study_buddy: boolean } | null;
  const initialDraft = row
    ? draftFromStored(row.answers, row.looking_for_study_buddy)
    : emptyDraft();

  return (
    <>
      <p className="mb-5 text-sm text-muted">
        {profile.college} · Class of {profile.classYear}.{" "}
        <Link className="underline" href="/matches">
          Skip to matches
        </Link>
      </p>
      <QuestionnaireForm initialDraft={initialDraft} />
    </>
  );
}
