"use client";

import { Scrap } from "@/components/scrap";
import { primaryButtonClass } from "@/lib/styles";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
      <h1>
        <Scrap tilt={-2}>
          <span className="font-serif text-4xl leading-tight ink-rose">That didn&rsquo;t work</span>
        </Scrap>
      </h1>
      <p className="mt-5 text-base font-semibold leading-7 text-ink">
        {error.message || "Something broke on our side. Try it once more."}
      </p>
      <button className={`${primaryButtonClass} mt-6 w-fit`} onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
