import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getOptionalUser } from "@/lib/auth";

export async function HeaderNav() {
  const user = await getOptionalUser();
  if (!user) return null;

  return (
    <nav className="flex items-center gap-1 text-sm font-medium text-muted sm:gap-2">
      <Link className="rounded-full px-3 py-2 hover:bg-white hover:text-ink" href="/questionnaire">
        Questionnaire
      </Link>
      <Link className="rounded-full px-3 py-2 hover:bg-white hover:text-ink" href="/matches">
        Matches
      </Link>
      <form action={signOut}>
        <button
          className="rounded-full px-3 py-2 hover:bg-white hover:text-ink"
          type="submit"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
