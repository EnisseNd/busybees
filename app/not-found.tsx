import Link from "next/link";
import { Scrap } from "@/components/scrap";
import { primaryButtonClass } from "@/lib/styles";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
      <h1>
        <Scrap tilt={-2}>
          <span className="font-serif text-4xl leading-tight ink-leaf">Nothing on this page</span>
        </Scrap>
      </h1>
      <p className="mt-5 text-base font-semibold leading-7 text-ink">
        The link is old, or that match has closed.
      </p>
      <Link className={`${primaryButtonClass} mt-6 w-fit`} href="/matches">
        Back to my matches
      </Link>
    </main>
  );
}
