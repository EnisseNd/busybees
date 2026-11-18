import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import { Scrap } from "@/components/scrap";
import { requireUser } from "@/lib/auth";
import { draftFromStored, emptyDraft } from "@/lib/questionnaire";
import { cardClass, secondaryButtonClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Questionnaire",
};

export default function QuestionnairePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <h1>
        <Scrap tilt={-3}>
          <span className="font-script text-5xl leading-none ink-leaf">Who should</span>
        </Scrap>{" "}
        <Scrap shape={2} tilt={2}>
          <span className="font-serif text-4xl leading-none ink-rose">we look for?</span>
        </Scrap>
      </h1>
      <p className="mt-5 text-base font-semibold leading-7 text-ink">
        Five short steps about you, then one optional step if you want a study buddy too. You can
        change your answers any time. Each Sunday&rsquo;s matches use whatever is saved.
      </p>
      <div className={`${cardClass} relative mt-8`}>
        <span aria-hidden="true" className="tape tape-green -top-3 left-1/2 -ml-11" />
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
          You&rsquo;re signed in, but your college and class year didn&rsquo;t save. Sign out and
          create the account again.
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
        {profile.college}, class of {profile.classYear}.{" "}
        <Link className="font-extrabold text-leaf underline" href="/matches">
          Skip to my matches
        </Link>
      </p>
      <QuestionnaireForm initialDraft={initialDraft} />
    </>
  );
}
