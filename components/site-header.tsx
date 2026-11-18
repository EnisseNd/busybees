import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getOptionalUser } from "@/lib/auth";

const LINKS = [
  { href: "/matches", label: "Matches" },
  { href: "/tray", label: "My tray" },
  { href: "/calendar", label: "Calendar" },
  { href: "/questionnaire", label: "Questions" },
] as const;

const linkClass =
  "px-2 py-1.5 font-extrabold text-ink underline-offset-4 hover:text-leaf hover:underline sm:px-2.5";

export async function HeaderNav() {
  const user = await getOptionalUser();
  if (!user) return null;

  return (
    <nav className="flex flex-wrap items-center justify-end rounded-[2px] border border-hairline bg-paper-white px-1 text-sm">
      {LINKS.map((link) => (
        <Link className={linkClass} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
      <form action={signOut}>
        <button className={`${linkClass} text-muted`} type="submit">
          Sign out
        </button>
      </form>
    </nav>
  );
}
