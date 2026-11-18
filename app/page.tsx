import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { NextDrop } from "@/components/next-drop";
import { Scrap } from "@/components/scrap";
import { Tray } from "@/components/tray";
import { getOptionalUser } from "@/lib/auth";
import { cardClass } from "@/lib/styles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/lib/types";

const SAMPLE_TRAY = [
  { label: "Sunflowers", emoji: "🌻", image: "/collage/thing-sunflowers.webp" },
  { label: "Romcoms", emoji: "🎬", image: "/collage/thing-clapper.webp" },
  { label: "East Rock", emoji: "👟", image: "/collage/thing-sneakers.webp" },
  { label: "Matcha", emoji: "🍵", image: "/collage/drink-matcha.webp" },
  {
    label: "Thrifting",
    emoji: "🧣",
    image: "/collage/thing-scarf.webp",
    extras: ["/collage/thing-skirt.webp"],
  },
];

export default function HomePage(props: PageProps<"/">) {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-12 px-5 py-8 md:grid-cols-[1.1fr_0.9fr] md:py-12">
      <section>
        <h1 className="flex flex-wrap items-end gap-x-2 gap-y-3">
          <Scrap tilt={-4}>
            <span className="font-script text-6xl leading-none ink-leaf sm:text-7xl">What&rsquo;s on</span>
          </Scrap>
          <Scrap shape={1} tilt={2}>
            <span className="font-serif text-5xl leading-none ink-rose sm:text-6xl">your tray?</span>
          </Scrap>
        </h1>
        <p className="paper-note mt-7 max-w-md px-4 pb-2 pt-2 text-lg font-semibold text-ink">
          Put five things on a lunch tray. Every Monday you get a few Yale students to swipe
          through, with a time you&rsquo;re both free.
        </p>
        <div className="mt-8 max-w-md">
          <Tray items={SAMPLE_TRAY} />
        </div>
        <div className="mt-10">
          <Suspense fallback={<p className="text-base font-extrabold text-leaf">New trays land every Monday at 9am.</p>}>
            <NextDrop />
          </Suspense>
        </div>
      </section>

      <section className={`${cardClass} relative`}>
        <span aria-hidden="true" className="tape -top-3 left-8" />
        <span aria-hidden="true" className="tape tape-green -top-3 right-8" style={{ "--tilt": "5deg" } as React.CSSProperties} />
        <h2 className="font-serif text-3xl text-leaf">Sign in with your Yale email</h2>
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
