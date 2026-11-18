import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Scrap } from "@/components/scrap";
import { TrayEditor } from "@/components/tray-editor";
import { requireUser } from "@/lib/auth";
import { cardClass, secondaryButtonClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { parseTray } from "@/lib/tray";

export const metadata: Metadata = {
  title: "My tray",
};

export default function TrayPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
      <h1 className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <Scrap tilt={-3}>
          <span className="font-script text-5xl leading-none ink-leaf sm:text-6xl">What&rsquo;s on</span>
        </Scrap>
        <Scrap shape={1} tilt={2}>
          <span className="font-serif text-4xl leading-none ink-rose sm:text-5xl">your tray?</span>
        </Scrap>
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-ink">
        Five things that say something about you. Your matches see this tray, your first name,
        your college and your class year. They don&rsquo;t see your email or your questionnaire.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted">Getting your tray…</p>}>
          <TrayLoader />
        </Suspense>
      </div>
    </main>
  );
}

async function TrayLoader() {
  const profile = await requireUser();
  if (profile.needsProfile) {
    return (
      <div className={cardClass}>
        <p className="text-sm leading-6 text-ink">
          You&rsquo;re signed in, but your profile never got created. Sign out and make the account
          again with your college and class year.
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
  // Before the tray migration runs these columns do not exist, so an error
  // here just means "nothing saved yet".
  const { data, error } = await supabase
    .from("users")
    .select("first_name, tray")
    .eq("id", profile.id)
    .maybeSingle();

  const row = error ? null : (data as { first_name: string | null; tray: unknown } | null);

  return (
    <TrayEditor
      college={profile.college}
      initialFirstName={row?.first_name ?? ""}
      initialItems={parseTray(row?.tray)}
    />
  );
}
