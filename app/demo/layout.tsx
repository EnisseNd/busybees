import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Demo",
};

const LINKS = [
  { href: "/demo", label: "Trays" },
  { href: "/demo/tray", label: "My tray" },
  { href: "/demo/calendar", label: "Calendar" },
] as const;

/** The walkthrough with sample people. Nothing here reads or writes the database. */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <nav aria-label="Demo" className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-hairline pb-3 text-sm">
        {LINKS.map((link) => (
          <Link className="font-extrabold text-ink underline-offset-4 hover:underline" href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
        <span className="ml-auto bg-scrap px-2 py-1 text-xs font-extrabold text-berry">Sample week, sample people</span>
      </nav>
      {children}
    </main>
  );
}
