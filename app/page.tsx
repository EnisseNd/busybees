import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { NextDrop } from "@/components/next-drop";
import { getOptionalUser } from "@/lib/auth";
import { cardClass } from "@/lib/styles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/lib/types";

export default function HomePage(props: PageProps<"/">) {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 px-5 py-10 md:grid-cols-[1.15fr_0.85fr] md:py-16">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gold">
          Weekly · platonic · on campus
        </p>
        <h1 className="mt-3 max-w-xl font-serif text-5xl leading-[1.05] text-ink sm:text-6xl">
          A weekly friend for lunch, a walk, or a problem set.
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-muted">
          SocialSync pairs Yale students for friendship, and adds a study-buddy path when you want
          one. Matches drop once a week. The conversation stays here.
        </p>
        <ul className="mt-8 grid gap-3 text-sm leading-6 text-ink">
          <li className="rounded-2xl bg-white/70 px-4 py-3">
            Your residential college and class year are part of the account.
          </li>
          <li className="rounded-2xl bg-white/70 px-4 py-3">
            Friend matching is the main list. Study buddies are optional and separate.
          </li>
          <li className="rounded-2xl bg-white/70 px-4 py-3">
            Chat opens after you both tap Interested.
          </li>
        </ul>
        <div className="mt-8">
          <Suspense
            fallback={
              <p className="text-sm font-medium text-yale">Next matches drop Mondays at 9:00am ET.</p>
            }
          >
            <NextDrop />
          </Suspense>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-serif text-3xl text-ink">Come in with your Yale email</h2>
        <div className="mt-5">
          <Suspense fallback={<p className="text-sm text-muted">Loading sign-in…</p>}>
            <HomeAuth searchParams={props.searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function HomeAuth({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getOptionalUser();

  if (user) {
    if (user.needsProfile) redirect("/questionnaire");
    const supabase = await createClient();
    const { data } = await supabase
      .from("questionnaires")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    redirect(data ? "/matches" : "/questionnaire");
  }

  const nextPath = typeof params.next === "string" ? params.next : "";
  const initialState: AuthFormState =
    params.error === "auth"
      ? { tone: "error", message: "That link didn't work. Request a new one." }
      : { tone: "idle", message: "" };

  return (
    <AuthForm
      configured={isSupabaseConfigured()}
      initialState={initialState}
      nextPath={nextPath}
    />
  );
}
