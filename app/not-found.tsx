import Link from "next/link";
import { primaryButtonClass } from "@/lib/styles";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
      <h1 className="font-serif text-4xl text-ink">That page is not here</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        The match may have closed, or the link is old.
      </p>
      <Link className={`${primaryButtonClass} mt-6 w-fit`} href="/matches">
        Back to matches
      </Link>
    </main>
  );
}
